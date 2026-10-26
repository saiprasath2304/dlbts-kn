import { COLUMNS, toCsv } from '#lib/import/participants.ts';
import { toXlsx } from '#lib/server/spreadsheet.ts';
import type { RequestHandler } from './$types';

const EXAMPLE = [
	[
		'G1-SLOKA-001',
		'Example Participant',
		'grp1',
		'sloka',
		'individual',
		'Example Unit',
		'',
		'',
		''
	],
	[
		'T-QUIZ-01',
		'Example Team',
		'team',
		'quiz',
		'team',
		'Example Unit',
		'',
		'',
		'Member One, Member Two'
	]
];

export const GET: RequestHandler = async ({ url }) => {
	if (url.searchParams.get('format') === 'xlsx') {
		return new Response(await toXlsx('participants', COLUMNS, EXAMPLE), {
			headers: {
				'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'content-disposition': 'attachment; filename="participants-template.xlsx"'
			}
		});
	}
	return new Response(toCsv(COLUMNS, EXAMPLE), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': 'attachment; filename="participants-template.csv"'
		}
	});
};
