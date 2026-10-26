import { describe, expect, it } from 'vitest';
import * as fontkit from 'fontkit';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { renderFeedback, renderReport, type FinalEventEntry } from './pdf';
import { reportFonts } from './fonts';
import type { FinalSnapshot } from '#lib/results.ts';

async function extractText(pdf: Buffer): Promise<string> {
	const doc = await getDocument({
		data: new Uint8Array(pdf),
		useSystemFonts: false,
		isEvalSupported: false
	}).promise;
	let text = '';
	for (let i = 1; i <= doc.numPages; i++) {
		const page = await doc.getPage(i);
		const content = await page.getTextContent();
		text += content.items.map((it) => ('str' in it ? it.str : '')).join('') + '\n';
	}
	return text;
}

const snapshot = {
	event_id: 'e1',
	status: 'finalized',
	complete: true,
	required_judges: 3,
	submitted_judges: 3,
	incomplete_submissions: 0,
	judges: [
		{
			judge_id: 'j1',
			display_name: 'Judge One',
			username: 'judge01',
			submission_id: 's1',
			status: 'submitted',
			submitted_at: null,
			missing: 0
		},
		{
			judge_id: 'j2',
			display_name: 'Judge Two',
			username: 'judge02',
			submission_id: 's2',
			status: 'submitted',
			submitted_at: null,
			missing: 0
		},
		{
			judge_id: 'j3',
			display_name: 'Judge Three',
			username: 'judge03',
			submission_id: 's3',
			status: 'submitted',
			submitted_at: null,
			missing: 0
		}
	],
	criteria: [{ id: 'c1', name: 'Pronunciation', max_marks: 100, display_order: 0 }],
	max_per_judge: 100,
	participant_count: 2,
	participants: [
		{
			participant_id: 'p1',
			code: 'G1-001',
			name: 'Asha Demo',
			affiliation: 'Unit North',
			kind: 'individual',
			aggregate: 267,
			judge_totals: { j1: 90, j2: 85, j3: 92 },
			calc_rank: 1,
			tie_size: 1,
			tied: false,
			final_rank: 1
		},
		{
			participant_id: 'p2',
			code: 'G1-002',
			name: 'மாதிரி பங்கேற்பாளர்',
			affiliation: null,
			kind: 'individual',
			aggregate: 250,
			judge_totals: { j1: 80, j2: 85, j3: 85 },
			calc_rank: 2,
			tie_size: 1,
			tied: false,
			final_rank: 2
		}
	],
	ties: [],
	unresolved_ties: 0,
	finalization: { id: 'f1', finalized_at: '2026-10-22T10:00:00Z', finalized_by: 'a1' },
	event: {
		id: 'e1',
		code: 'sc',
		name: 'Sloka Chanting',
		group: { id: 'g1', code: 'grp1', name: 'Group 1' }
	},
	breakdown: [{ judge_id: 'j1', participant_id: 'p1', criterion_id: 'c1', value: 90 }]
} as unknown as FinalSnapshot;

const events: FinalEventEntry[] = [
	{
		group: 'Group 1',
		groupOrder: 1,
		event: 'Sloka Chanting',
		eventOrder: 1,
		snapshot,
		finalizedAt: '2026-10-22T10:00:00Z'
	},
	{
		group: 'Group 1',
		groupOrder: 1,
		event: 'Pending Drawing',
		eventOrder: 2,
		snapshot: null,
		finalizedAt: null
	}
];

describe('PDF reports', () => {
	it('includes finalized rankings and aggregate marks', async () => {
		const { pdf, sha256 } = await renderReport({
			kind: 'final',
			title: 'Test Event',
			locale: 'en',
			generatedAt: new Date('2026-10-22T10:00:00Z'),
			breakdown: true,
			events
		});
		expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
		expect(sha256).toMatch(/^[0-9a-f]{64}$/);
		const text = await extractText(pdf);
		expect(text).toContain('Results Report');
		expect(text).toContain('Asha Demo');
		expect(text).toContain('267');
		expect(text).toContain('Judge One');
	});

	it('never shows rankings for events that are not finalized', async () => {
		const { pdf } = await renderReport({
			kind: 'final',
			title: 'Test Event',
			locale: 'en',
			generatedAt: new Date(),
			breakdown: false,
			events: [{ ...events[1] }]
		});
		const text = await extractText(pdf);
		expect(text).toContain('Pending Drawing');
		expect(text).toContain('Not finalized');
		expect(text).not.toContain('Asha Demo');
	});

	it('marks progress reports as not final and lists no marks', async () => {
		const { pdf } = await renderReport({
			kind: 'progress',
			title: 'Test Event',
			locale: 'en',
			generatedAt: new Date(),
			events: [
				{
					group: 'Group 1',
					event: 'Sloka Chanting',
					required: 3,
					submitted: 2,
					finalized: false,
					judges: [{ name: 'Judge One', status: 'submitted' }]
				}
			]
		});
		const text = await extractText(pdf);
		expect(text).toContain('NOT FINAL');
		expect(text).toContain('2 / 3');
	});

	it('embeds the Tamil font and renders Tamil labels and names', async () => {
		const { pdf } = await renderReport({
			kind: 'final',
			title: 'சோதனை நிகழ்வு',
			locale: 'ta',
			generatedAt: new Date(),
			breakdown: false,
			events
		});
		expect(pdf.toString('latin1')).toMatch(/\/BaseFont \/[A-Z]{6}\+NotoSansTamil/);
		const text = await extractText(pdf);
		expect(text).toContain('முடிவுகள்'); // "Results" label in Tamil
		expect(text).toMatch(/[\u0B80-\u0BFF]{3,}/);
		expect(text).toContain('267');
	});

	it('shapes Tamil correctly (prefix vowel sign is placed before its consonant)', () => {
		const font = fontkit.create(reportFonts().ta) as fontkit.Font;
		const run = font.layout('கே');
		expect(run.glyphs.map((g) => g.codePoints)).toEqual([[0x0bc7], [0x0b95]]);
		const split = font.layout('கொ').glyphs.map((g) => g.codePoints.flat());
		expect(split.length).toBe(3); // ெ + க + ா around the consonant
		expect(split[1]).toEqual([0x0b95]);
	});
	it('renders a feedback report with remarks, Tamil text and optional marks', async () => {
		const pdf = await renderFeedback({
			title: 'DLBTS KN 2026',
			locale: 'ta',
			generatedAt: new Date(),
			includeMarks: true,
			participants: [
				{
					name: 'மாதிரி பங்கேற்பாளர்',
					code: 'G1-001',
					affiliation: 'Unit A',
					members: null,
					group: 'Group 1',
					events: [
						{
							event: 'Sloka Chanting',
							venue: 'Room 12',
							judges: [
								{
									label: 1,
									remark: 'Clear pronunciation, keep practising tune.',
									total: 27,
									max: 30
								},
								{ label: 2, remark: '', total: null, max: 30 }
							]
						}
					]
				}
			]
		});
		const text = await extractText(pdf);
		expect(text).toContain('Clear pronunciation');
		expect(text).toContain('Room 12');
		expect(text).toContain('27');
		expect(text).toMatch(/[஀-௿]{3,}/);
	});
});
