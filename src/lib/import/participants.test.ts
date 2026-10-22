import { describe, expect, it } from 'vitest';
import { csvCell, normalizeRecords, toCsv, validateRows, type KnownData } from './participants';

const known: KnownData = {
	groups: new Map([
		['grp1', new Set(['sc', 'dw'])],
		['team', new Set(['qu'])]
	]),
	existing: new Map([['G1-001', { name: 'Existing Child', group_code: 'grp1' }]])
};

const rec = (o: Record<string, string>) => ({
	code: '',
	name: '',
	group_code: '',
	event_code: '',
	...o
});

describe('normalizeRecords', () => {
	it('maps headers, aliases and Tamil text', () => {
		const { rows, errors } = normalizeRecords([
			{
				'Participant Code': 'g1-010',
				Name: '  மாதிரி  பெயர் ',
				Group: 'GRP1',
				Event: 'SC',
				Type: 'Team',
				Samithi: 'Unit A'
			}
		]);
		expect(errors).toEqual([]);
		expect(rows[0]).toMatchObject({
			row: 2,
			code: 'G1-010',
			name: 'மாதிரி பெயர்',
			group_code: 'grp1',
			event_code: 'sc',
			kind: 'team',
			affiliation: 'Unit A'
		});
	});
	it('reports missing required columns', () => {
		const { errors } = normalizeRecords([{ code: 'A', name: 'B' }]);
		expect(errors[0]).toMatchObject({ code: 'MISSING_COLUMNS' });
		expect(String(errors[0].params?.columns)).toContain('group_code');
	});
	it('rejects empty files and skips blank lines', () => {
		expect(normalizeRecords([]).errors[0].code).toBe('EMPTY_FILE');
		const { rows } = normalizeRecords([
			rec({ code: 'A1', name: 'X', group_code: 'grp1' }),
			rec({})
		]);
		expect(rows).toHaveLength(1);
	});
	it('limits file size', () => {
		const many = Array.from({ length: 5001 }, (_, i) =>
			rec({ code: `A${i}`, name: 'X', group_code: 'grp1' })
		);
		expect(normalizeRecords(many).errors[0].code).toBe('TOO_MANY_ROWS');
	});
});

describe('validateRows', () => {
	const rows = (recs: Record<string, string>[]) => normalizeRecords(recs.map(rec)).rows;

	it('accepts valid rows', () => {
		const { valid, errors } = validateRows(
			rows([{ code: 'G1-100', name: 'New Child', group_code: 'grp1', event_code: 'sc' }]),
			known
		);
		expect(errors).toEqual([]);
		expect(valid).toHaveLength(1);
	});
	it('gives row-specific errors', () => {
		const { valid, errors } = validateRows(
			rows([
				{ code: 'bad code!', name: 'X', group_code: 'grp1', event_code: 'sc' },
				{ code: 'G1-101', name: '', group_code: 'grp1', event_code: 'sc' },
				{ code: 'G1-102', name: 'Y', group_code: 'nope', event_code: 'sc' },
				{ code: 'G1-103', name: 'Z', group_code: 'grp1', event_code: 'qu' },
				{ code: 'G1-104', name: 'W', group_code: 'grp1', event_code: 'sc', kind: 'group' }
			]),
			known
		);
		expect(valid).toEqual([]);
		expect(errors.map((e) => [e.row, e.code])).toEqual([
			[2, 'INVALID_CODE'],
			[3, 'INVALID_NAME'],
			[4, 'UNKNOWN_GROUP'],
			[5, 'UNKNOWN_EVENT'],
			[6, 'INVALID_KIND']
		]);
	});
	it('detects duplicates inside the file and against existing data', () => {
		const { errors } = validateRows(
			rows([
				{ code: 'G1-200', name: 'Same', group_code: 'grp1', event_code: 'sc' },
				{ code: 'G1-200', name: 'Same', group_code: 'grp1', event_code: 'sc' },
				{ code: 'G1-200', name: 'Different', group_code: 'grp1', event_code: 'dw' },
				{ code: 'G1-001', name: 'Someone Else', group_code: 'grp1', event_code: 'sc' }
			]),
			known
		);
		expect(errors.map((e) => e.code)).toEqual([
			'DUPLICATE_ROW',
			'CONFLICTING_DUPLICATE',
			'CODE_USED_BY_OTHER_NAME'
		]);
	});
	it('links an existing participant to another event without duplicating', () => {
		const { valid, errors } = validateRows(
			rows([{ code: 'G1-001', name: 'existing child', group_code: 'grp1', event_code: 'dw' }]),
			known
		);
		expect(errors).toEqual([]);
		expect(valid).toHaveLength(1);
	});
	it('allows one participant in several events', () => {
		const { valid } = validateRows(
			rows([
				{ code: 'G1-300', name: 'Multi', group_code: 'grp1', event_code: 'sc' },
				{ code: 'G1-300', name: 'Multi', group_code: 'grp1', event_code: 'dw' }
			]),
			known
		);
		expect(valid).toHaveLength(2);
	});
});

describe('CSV export safety', () => {
	it('neutralises formula injection and quotes', () => {
		expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
		expect(csvCell('+1')).toBe("'+1");
		expect(csvCell('a,b')).toBe('"a,b"');
		expect(csvCell('மாதிரி')).toBe('மாதிரி');
	});
	it('writes UTF-8 with BOM for Excel', () => {
		const csv = toCsv(['name'], [['மாதிரி']]);
		expect(csv.startsWith('\uFEFF')).toBe(true);
		expect(csv).toContain('மாதிரி');
	});
});
