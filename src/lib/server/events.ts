import { fail } from '@sveltejs/kit';
import { translate } from '#lib/i18n/index.ts';
import { failWith } from './errors.ts';
import { bool, int, isUuid, optStr, str } from './form.ts';

/** Create or update an event through the audited admin function. */
export async function saveEvent(locals: App.Locals, f: FormData) {
	const id = str(f, 'id');
	const code = str(f, 'code').toLowerCase();
	const name = str(f, 'name');
	const groupId = str(f, 'group_id');
	const precision = int(f, 'score_precision', 1);
	if (
		!/^[a-z0-9]{1,12}$/.test(code) ||
		!name ||
		!isUuid(groupId) ||
		precision < 0 ||
		precision > 2
	) {
		return fail(400, { error: translate(locals.locale, 'admin.events.code_help') });
	}
	const { data, error } = await locals.supabase.rpc('admin_save_event', {
		p_id: isUuid(id) ? id : (null as unknown as string),
		p_group_id: groupId,
		p_code: code,
		p_name: name,
		p_description: optStr(f, 'description') ?? '',
		p_instructions: optStr(f, 'instructions') ?? '',
		p_score_precision: precision,
		p_display_order: int(f, 'display_order'),
		p_is_active: isUuid(id) ? bool(f, 'is_active') : true,
		p_reason: optStr(f, 'reason') ?? ''
	});
	if (error)
		return failWith(locals.locale, error, {
			needsReason: error.message === 'CONFIRMATION_REQUIRED'
		});
	return { success: translate(locals.locale, 'common.saved_ok'), id: data };
}
