/**
 * Participant import: column mapping and validation. Pure functions so the
 * same rules run for the preview, again on confirm, and in tests. The database
 * function re-validates everything inside one transaction.
 */
export const COLUMNS = [
	'code',
	'name',
	'group_code',
	'event_code',
	'kind',
	'affiliation',
	'registration_no',
	'notes',
	'members'
] as const;
export const REQUIRED_COLUMNS = ['code', 'name', 'group_code', 'event_code'] as const;
export const MAX_ROWS = 5000;
export const CODE_RE = /^[A-Z0-9][A-Z0-9._/-]{0,39}$/;

export type Column = (typeof COLUMNS)[number];

const ALIASES: Record<string, Column> = {
	code: 'code',
	participant_code: 'code',
	team_code: 'code',
	id: 'code',
	name: 'name',
	participant_name: 'name',
	team_name: 'name',
	participant: 'name',
	group: 'group_code',
	group_code: 'group_code',
	event: 'event_code',
	event_code: 'event_code',
	kind: 'kind',
	type: 'kind',
	affiliation: 'affiliation',
	unit: 'affiliation',
	samithi: 'affiliation',
	registration_no: 'registration_no',
	registration_number: 'registration_no',
	reg_no: 'registration_no',
	notes: 'notes',
	note: 'notes',
	remarks: 'notes',
	members: 'members',
	team_members: 'members'
};

export interface ImportRow {
	row: number;
	code: string;
	name: string;
	kind: 'individual' | 'team';
	group_code: string;
	event_code: string;
	affiliation: string;
	registration_no: string;
	notes: string;
	members: string;
}

export interface RowError {
	row: number;
	field?: string;
	code: string;
	value?: string;
	params?: Record<string, string | number>;
}

export function normalizeHeader(h: string): string {
	return h
		.normalize('NFKC')
		.replace(/^\uFEFF/, '')
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
}

/** Map raw records (header -> value) to ImportRows. Spreadsheet row numbers start at 2. */
export function normalizeRecords(
	records: Record<string, unknown>[],
	firstDataRow = 2
): { rows: ImportRow[]; errors: RowError[] } {
	if (records.length === 0) return { rows: [], errors: [{ row: 0, code: 'EMPTY_FILE' }] };
	if (records.length > MAX_ROWS)
		return { rows: [], errors: [{ row: 0, code: 'TOO_MANY_ROWS', params: { max: MAX_ROWS } }] };

	const headers = [...new Set(records.flatMap((r) => Object.keys(r)))];
	const mapping = new Map<string, Column>();
	for (const h of headers) {
		const col = ALIASES[normalizeHeader(h)];
		if (col && ![...mapping.values()].includes(col)) mapping.set(h, col);
	}
	const present = new Set(mapping.values());
	const missing = REQUIRED_COLUMNS.filter((c) => !present.has(c));
	if (missing.length)
		return {
			rows: [],
			errors: [{ row: 0, code: 'MISSING_COLUMNS', params: { columns: missing.join(', ') } }]
		};

	const rows: ImportRow[] = [];
	records.forEach((rec, i) => {
		const v: Partial<Record<Column, string>> = {};
		for (const [h, col] of mapping) v[col] = cell(rec[h]);
		if (COLUMNS.every((c) => !v[c])) return; // blank line
		const kind = (v.kind ?? '').toLowerCase();
		rows.push({
			row: i + firstDataRow,
			code: (v.code ?? '').toUpperCase(),
			name: v.name ?? '',
			kind:
				kind === 'team'
					? 'team'
					: kind === '' || kind === 'individual'
						? 'individual'
						: (kind as 'individual'),
			group_code: (v.group_code ?? '').toLowerCase(),
			event_code: (v.event_code ?? '').toLowerCase(),
			affiliation: v.affiliation ?? '',
			registration_no: v.registration_no ?? '',
			notes: v.notes ?? '',
			members: v.members ?? ''
		});
	});
	if (rows.length === 0) return { rows, errors: [{ row: 0, code: 'EMPTY_FILE' }] };
	return { rows, errors: [] };
}

function cell(v: unknown): string {
	if (v === null || v === undefined) return '';
	return String(v).normalize('NFC').replace(/\s+/g, ' ').trim();
}

export interface KnownData {
	/** group code -> set of event codes */
	groups: Map<string, Set<string>>;
	/** existing participant code -> { name, group_code } */
	existing: Map<string, { name: string; group_code: string | null }>;
}

export function validateRows(
	rows: ImportRow[],
	known: KnownData
): { valid: ImportRow[]; errors: RowError[] } {
	const errors: RowError[] = [];
	const firstByCode = new Map<string, ImportRow>();
	const seenLinks = new Set<string>();
	const valid: ImportRow[] = [];

	for (const r of rows) {
		const before = errors.length;
		if (!CODE_RE.test(r.code))
			errors.push({ row: r.row, field: 'code', code: 'INVALID_CODE', value: r.code });
		if (!r.name || r.name.length > 200)
			errors.push({ row: r.row, field: 'name', code: 'INVALID_NAME', value: r.name });
		if (r.kind !== 'individual' && r.kind !== 'team')
			errors.push({ row: r.row, field: 'kind', code: 'INVALID_KIND', value: r.kind });

		const events = known.groups.get(r.group_code);
		if (!events)
			errors.push({ row: r.row, field: 'group_code', code: 'UNKNOWN_GROUP', value: r.group_code });
		else if (r.event_code && !events.has(r.event_code))
			errors.push({ row: r.row, field: 'event_code', code: 'UNKNOWN_EVENT', value: r.event_code });

		const existing = known.existing.get(r.code);
		if (existing) {
			if (existing.name.trim().toLowerCase() !== r.name.trim().toLowerCase())
				errors.push({
					row: r.row,
					field: 'code',
					code: 'CODE_USED_BY_OTHER_NAME',
					value: r.code,
					params: { name: existing.name }
				});
			else if (existing.group_code !== r.group_code)
				errors.push({
					row: r.row,
					field: 'group_code',
					code: 'GROUP_MISMATCH',
					value: r.group_code
				});
		}

		const first = firstByCode.get(r.code);
		if (
			first &&
			(first.name.toLowerCase() !== r.name.toLowerCase() || first.group_code !== r.group_code)
		) {
			errors.push({
				row: r.row,
				field: 'code',
				code: 'CONFLICTING_DUPLICATE',
				value: r.code,
				params: { first: first.row }
			});
		}
		if (!first) firstByCode.set(r.code, r);

		const link = `${r.code}|${r.group_code}|${r.event_code}`;
		if (seenLinks.has(link)) errors.push({ row: r.row, code: 'DUPLICATE_ROW', value: r.code });
		seenLinks.add(link);

		if (errors.length === before) valid.push(r);
	}
	return { valid, errors };
}

/** Neutralise spreadsheet formula injection and quote for CSV. */
export function csvCell(value: unknown): string {
	let s = value === null || value === undefined ? '' : String(value);
	if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
	// BOM so Excel opens UTF-8 (Tamil) correctly.
	return '\uFEFF' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
