import { fail } from '@sveltejs/kit';
import { translate } from '#lib/i18n/index.ts';
import { errorCode } from '#lib/server/errors.ts';
import { optStr, str } from '#lib/server/form.ts';
import { readRecords, UploadError } from '#lib/server/spreadsheet.ts';
import { loadKnown } from '#lib/server/participants.ts';
import {
	normalizeRecords,
	validateRows,
	type ImportRow,
	type RowError
} from '#lib/import/participants.ts';
import type { Actions } from './$types';

async function check(locals: App.Locals, rows: ImportRow[]) {
	const known = await loadKnown(
		locals.supabase,
		rows.map((r) => r.code)
	);
	return validateRows(rows, known);
}

/** Event codes in the file whose events already have marks (needs a reason). */
async function scoredTargets(locals: App.Locals, rows: ImportRow[]) {
	const { data: events } = await locals.supabase
		.from('events')
		.select('id, code, name, groups(code)');
	const targets = new Map<string, { id: string; name: string }>();
	for (const r of rows) {
		if (!r.event_code) continue;
		const e = (events ?? []).find(
			(x) => x.code === r.event_code && x.groups?.code === r.group_code
		);
		if (e) targets.set(e.id, { id: e.id, name: e.name });
	}
	const scored: string[] = [];
	for (const e of targets.values()) {
		const { data } = await locals.supabase.rpc('event_has_scores', { p_event_id: e.id });
		if (data) scored.push(e.name);
	}
	return scored;
}

export const actions: Actions = {
	preview: async ({ request, locals }) => {
		const f = await request.formData();
		const file = f.get('file');
		if (!(file instanceof File))
			return fail(400, { errors: [{ row: 0, code: 'EMPTY_FILE' }] as RowError[] });
		let records: Record<string, unknown>[];
		try {
			records = await readRecords(file);
		} catch (e) {
			const code = e instanceof UploadError ? e.message : 'UNREADABLE';
			return fail(400, { errors: [{ row: 0, code }] as RowError[], fileName: file.name });
		}
		const { rows, errors: shapeErrors } = normalizeRecords(records);
		if (shapeErrors.length) return fail(400, { errors: shapeErrors, fileName: file.name });
		const { valid, errors } = await check(locals, rows);
		return {
			fileName: file.name,
			rows: valid,
			total: rows.length,
			errors,
			scoredEvents: errors.length ? [] : await scoredTargets(locals, valid)
		};
	},

	confirm: async ({ request, locals }) => {
		const f = await request.formData();
		let rows: ImportRow[];
		try {
			rows = JSON.parse(str(f, 'rows'));
			if (!Array.isArray(rows)) throw new Error();
		} catch {
			return fail(400, { error: translate(locals.locale, 'error.INVALID_REQUEST') });
		}
		// Never trust the round-tripped preview: validate again.
		const { valid, errors } = await check(locals, rows);
		if (errors.length || valid.length !== rows.length) {
			return fail(400, { errors, error: translate(locals.locale, 'admin.import.blocked') });
		}
		const { data, error } = await locals.supabase.rpc('admin_import_participants', {
			p_rows: valid as unknown as never,
			p_source: str(f, 'file_name').slice(0, 200),
			p_reason: optStr(f, 'reason') ?? ''
		});
		if (error) {
			const { code, detail } = errorCode(error);
			let rowErrors: RowError[] = [];
			if (code === 'IMPORT_INVALID' && detail) {
				try {
					rowErrors = JSON.parse(detail);
				} catch {
					/* ignore */
				}
			}
			return fail(400, {
				errors: rowErrors,
				error: translate(
					locals.locale,
					code === 'CONFIRMATION_REQUIRED' ? 'error.CONFIRMATION_REQUIRED' : 'admin.import.blocked'
				),
				needsReason: code === 'CONFIRMATION_REQUIRED'
			});
		}
		const result = data as { created: number; linked: number; already_linked: number };
		return {
			success: translate(locals.locale, 'admin.import.success', {
				created: result.created,
				linked: result.linked,
				already: result.already_linked
			})
		};
	}
};
