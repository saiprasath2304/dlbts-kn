import PDFDocument from 'pdfkit';
import { createHash } from 'node:crypto';
import { reportFonts, reportLogo } from './fonts.ts';
import { hasTamil, scriptRuns } from './text.ts';
import { translate, formatDateTime } from '#lib/i18n/index.ts';
import { formatMark, ordinal } from '#lib/scoring.ts';
import type { FinalSnapshot } from '#lib/results.ts';
import type { Locale } from '#lib/types.ts';

export interface ProgressEvent {
	group: string;
	event: string;
	required: number;
	submitted: number;
	judges: { name: string; status: string }[];
	finalized: boolean;
}

export interface FinalEventEntry {
	group: string;
	groupOrder: number;
	event: string;
	eventOrder: number;
	snapshot: FinalSnapshot | null;
	finalizedAt: string | null;
}

export type ReportInput =
	| {
			kind: 'final';
			title: string;
			locale: Locale;
			generatedAt: Date;
			breakdown: boolean;
			events: FinalEventEntry[];
	  }
	| { kind: 'progress'; title: string; locale: Locale; generatedAt: Date; events: ProgressEvent[] };

const A4 = { width: 595.28, height: 841.89 };
const M = 42;
const COLORS = {
	text: '#1c2a35',
	heading: '#26336f',
	muted: '#556372',
	line: '#cfdfe2',
	head: '#e6f2f2',
	accent: '#0c6f74',
	warn: '#92400e',
	warnBg: '#fef3c7'
};

type Doc = PDFKit.PDFDocument;

function font(doc: Doc, script: 'ta' | 'lat', bold: boolean) {
	doc.font(`${script}${bold ? '-bold' : ''}`);
}

/** Write mixed-script text, switching fonts per run. */
function write(
	doc: Doc,
	text: string,
	opts: PDFKit.Mixins.TextOptions & {
		x?: number;
		y?: number;
		bold?: boolean;
		size?: number;
		color?: string;
	} = {}
) {
	const { x, y, bold = false, size = 10, color = COLORS.text, ...rest } = opts;
	doc.fontSize(size).fillColor(color);
	const runs = scriptRuns(text || ' ');
	runs.forEach((run, i) => {
		font(doc, run.script, bold);
		const last = i === runs.length - 1;
		if (i === 0 && x !== undefined) doc.text(run.text, x, y, { ...rest, continued: !last });
		else doc.text(run.text, { ...rest, continued: !last });
	});
}

function measure(doc: Doc, text: string, width: number, size: number, bold = false): number {
	doc.fontSize(size);
	font(doc, hasTamil(text) ? 'ta' : 'lat', bold);
	return doc.heightOfString(text || ' ', { width });
}

function ensureSpace(doc: Doc, needed: number) {
	if (doc.y + needed > A4.height - M - 20) doc.addPage();
}

interface Column {
	header: string;
	width: number;
	align?: 'left' | 'right' | 'center';
}

function table(doc: Doc, columns: Column[], rows: string[][], size = 9) {
	const pad = 4;
	const drawRow = (cells: string[], header: boolean) => {
		const heights = cells.map((c, i) => measure(doc, c, columns[i].width - pad * 2, size, header));
		const h = Math.max(...heights) + pad * 2;
		if (doc.y + h > A4.height - M - 20) {
			doc.addPage();
			if (!header)
				drawRow(
					columns.map((c) => c.header),
					true
				);
		}
		const top = doc.y;
		let x = M;
		if (header)
			doc
				.rect(
					M,
					top,
					columns.reduce((s, c) => s + c.width, 0),
					h
				)
				.fill(COLORS.head);
		cells.forEach((c, i) => {
			write(doc, c, {
				x: x + pad,
				y: top + pad,
				width: columns[i].width - pad * 2,
				align: columns[i].align ?? 'left',
				size,
				bold: header
			});
			x += columns[i].width;
		});
		doc
			.moveTo(M, top + h)
			.lineTo(x, top + h)
			.strokeColor(COLORS.line)
			.lineWidth(0.5)
			.stroke();
		doc.x = M;
		doc.y = top + h;
	};
	drawRow(
		columns.map((c) => c.header),
		true
	);
	for (const r of rows) drawRow(r, false);
	doc.moveDown(0.6);
}

function heading(doc: Doc, text: string, size: number) {
	ensureSpace(doc, size * 3);
	doc.moveDown(0.4);
	write(doc, text, { x: M, y: doc.y, size, bold: true, width: A4.width - 2 * M });
	doc.moveDown(0.2);
}

function para(doc: Doc, text: string, size = 10, color = COLORS.text) {
	ensureSpace(doc, size * 2);
	write(doc, text, { x: M, y: doc.y, size, color, width: A4.width - 2 * M });
}

function banner(doc: Doc, text: string) {
	const h = 26;
	ensureSpace(doc, h + 10);
	const top = doc.y;
	doc.rect(M, top, A4.width - 2 * M, h).fill(COLORS.warnBg);
	write(doc, text, {
		x: M + 8,
		y: top + 7,
		size: 11,
		bold: true,
		color: COLORS.warn,
		width: A4.width - 2 * M - 16
	});
	doc.y = top + h + 6;
}

export async function renderReport(input: ReportInput): Promise<{ pdf: Buffer; sha256: string }> {
	const t = (k: string, p?: Record<string, string | number>) => translate(input.locale, k, p);
	const fonts = reportFonts();
	// Default to an embedded font so pdfkit never reads its built-in AFM files from disk
	// (keeps PDF generation working inside bundled/serverless deployments).
	const doc = new PDFDocument({
		size: 'A4',
		margin: M,
		bufferPages: true,
		font: fonts.lat as unknown as string,
		info: { Title: input.title },
		lang: input.locale === 'ta' ? 'ta-IN' : 'en-IN'
	});
	for (const [name, data] of Object.entries(fonts)) doc.registerFont(name, data);
	const chunks: Buffer[] = [];
	doc.on('data', (c: Buffer) => chunks.push(c));
	const done = new Promise<void>((resolve) => doc.on('end', resolve));

	const LOGO = 54;
	doc.image(reportLogo(), M, M, { width: LOGO, height: LOGO });
	const tx = M + LOGO + 12;
	const tw = A4.width - tx - M;
	write(doc, input.title, {
		x: tx,
		y: M + 2,
		size: 18,
		bold: true,
		width: tw,
		color: COLORS.heading
	});
	write(doc, input.kind === 'final' ? t('report.title') : t('report.progress_title'), {
		x: tx,
		y: doc.y,
		size: 13,
		bold: true,
		color: COLORS.accent
	});
	write(doc, t('report.generated', { time: formatDateTime(input.locale, input.generatedAt) }), {
		x: tx,
		y: doc.y,
		size: 9,
		color: COLORS.muted,
		width: tw
	});
	doc.x = M;
	doc.y = Math.max(doc.y, M + LOGO) + 6;
	doc.moveDown(0.5);

	if (input.kind === 'progress') {
		banner(doc, t('report.not_final'));
		const rows = input.events.map((e) => [
			e.group,
			e.event,
			`${e.submitted} / ${e.required}`,
			e.judges.map((j) => `${j.name}: ${t(`status.${j.status}`)}`).join('\n'),
			e.finalized
				? t('result_status.finalized')
				: e.required > 0 && e.submitted === e.required
					? t('admin.dashboard.complete')
					: t('result_status.judging_in_progress')
		]);
		table(
			doc,
			[
				{ header: t('common.group'), width: 80 },
				{ header: t('common.event'), width: 110 },
				{ header: t('report.judges_submitted'), width: 60, align: 'center' },
				{ header: t('report.judges'), width: 165 },
				{ header: t('report.status'), width: 96 }
			],
			rows
		);
	} else {
		renderFinal(doc, input, t);
	}

	const range = doc.bufferedPageRange();
	for (let i = range.start; i < range.start + range.count; i++) {
		doc.switchToPage(i);
		write(doc, `${input.title} · ${t('report.page', { n: i + 1 })}`, {
			x: M,
			y: A4.height - M + 10,
			size: 8,
			color: COLORS.muted,
			width: A4.width - 2 * M,
			align: 'center',
			lineBreak: false
		});
	}
	doc.end();
	await done;
	const pdf = Buffer.concat(chunks);
	return { pdf, sha256: createHash('sha256').update(pdf).digest('hex') };
}

function renderFinal(
	doc: Doc,
	input: Extract<ReportInput, { kind: 'final' }>,
	t: (k: string, p?: Record<string, string | number>) => string
) {
	const finalized = input.events.filter((e) => e.snapshot?.participants);

	heading(doc, t('report.summary'), 13);
	if (finalized.length === 0) para(doc, t('report.pending'), 10, COLORS.muted);
	const summary: string[][] = [];
	for (const e of finalized) {
		const top = e.snapshot!.participants!.filter((p) => p.final_rank !== null && p.final_rank <= 3);
		for (const p of top)
			summary.push([
				e.group,
				e.event,
				ordinal(p.final_rank!, input.locale),
				`${p.name} (${p.code})`,
				p.affiliation ?? '',
				formatMark(p.aggregate)
			]);
	}
	if (summary.length) {
		table(
			doc,
			[
				{ header: t('common.group'), width: 70 },
				{ header: t('common.event'), width: 100 },
				{ header: t('report.place'), width: 46, align: 'center' },
				{ header: t('report.participant'), width: 139 },
				{ header: t('report.affiliation'), width: 89 },
				{ header: t('report.aggregate'), width: 67, align: 'right' }
			],
			summary
		);
	}

	let lastGroup = '';
	for (const e of input.events) {
		if (e.group !== lastGroup) {
			doc.addPage();
			heading(doc, e.group, 15);
			lastGroup = e.group;
		}
		heading(doc, e.event, 12);
		const s = e.snapshot;
		if (!s || !s.participants) {
			banner(doc, t('report.pending'));
			continue;
		}
		para(
			doc,
			t('report.finalized_on', { time: formatDateTime(input.locale, e.finalizedAt) }),
			9,
			COLORS.muted
		);
		doc.moveDown(0.3);

		const judgeCols = input.breakdown ? s.judges : [];
		const fixed = 40 + 60 + 70;
		const nameW = Math.max(120, 511 - fixed - judgeCols.length * 48);
		const cols: Column[] = [
			{ header: t('report.rank'), width: 40, align: 'center' },
			{ header: t('report.participant'), width: nameW },
			{ header: t('report.code'), width: 60 },
			...judgeCols.map((j) => ({ header: j.display_name, width: 48, align: 'right' as const })),
			{ header: t('report.aggregate'), width: 70, align: 'right' }
		];
		table(
			doc,
			cols,
			s.participants.map((p) => [
				p.final_rank ? String(p.final_rank) : '–',
				p.affiliation ? `${p.name}\n${p.affiliation}` : p.name,
				p.code,
				...judgeCols.map((j) => formatMark(Number(p.judge_totals[j.judge_id] ?? 0))),
				formatMark(p.aggregate)
			])
		);
		for (const tie of s.ties.filter((x) => x.resolved)) {
			para(
				doc,
				t('report.tie_note', { aggregate: formatMark(tie.aggregate), reason: tie.reason ?? '' }),
				9,
				COLORS.warn
			);
		}

		if (input.breakdown && s.breakdown?.length) {
			for (const j of s.judges) {
				heading(doc, `${t('report.criteria_breakdown')}: ${j.display_name}`, 10);
				const critW = Math.max(42, Math.floor((511 - 150 - 64) / Math.max(1, s.criteria.length)));
				table(
					doc,
					[
						{ header: t('report.participant'), width: 150 },
						...s.criteria.map((c) => ({
							header: `${c.name} (/${formatMark(Number(c.max_marks))})`,
							width: critW,
							align: 'right' as const
						})),
						{ header: t('score.total'), width: 64, align: 'right' }
					],
					s.participants.map((p) => {
						const vals = s.criteria.map(
							(c) =>
								s.breakdown.find(
									(b) =>
										b.judge_id === j.judge_id &&
										b.participant_id === p.participant_id &&
										b.criterion_id === c.id
								)?.value
						);
						return [
							p.name,
							...vals.map((v) => (v === undefined ? '–' : formatMark(Number(v)))),
							formatMark(Number(p.judge_totals[j.judge_id] ?? 0))
						];
					}),
					8
				);
			}
		}
	}
}

// -----------------------------------------------------------------------------
// Feedback report: one page per participant with the judges' remarks.
// -----------------------------------------------------------------------------
export interface FeedbackParticipant {
	name: string;
	code: string;
	affiliation: string | null;
	members: string | null;
	group: string;
	events: {
		event: string;
		venue: string | null;
		judges: { label: number; remark: string; total: number | null; max: number }[];
	}[];
}

export async function renderFeedback(input: {
	title: string;
	locale: Locale;
	generatedAt: Date;
	includeMarks: boolean;
	participants: FeedbackParticipant[];
}): Promise<Buffer> {
	const t = (k: string, p?: Record<string, string | number>) => translate(input.locale, k, p);
	const fonts = reportFonts();
	const doc = new PDFDocument({
		size: 'A4',
		margin: M,
		bufferPages: true,
		font: fonts.lat as unknown as string,
		info: { Title: `${input.title} – ${t('report.feedback_title')}` },
		lang: input.locale === 'ta' ? 'ta-IN' : 'en-IN'
	});
	for (const [name, data] of Object.entries(fonts)) doc.registerFont(name, data);
	const chunks: Buffer[] = [];
	doc.on('data', (c: Buffer) => chunks.push(c));
	const done = new Promise<void>((resolve) => doc.on('end', resolve));
	const W = A4.width - 2 * M;

	input.participants.forEach((p, i) => {
		if (i > 0) doc.addPage();
		const LOGO = 46;
		doc.image(reportLogo(), M, M, { width: LOGO, height: LOGO });
		const tx = M + LOGO + 12;
		write(doc, input.title, {
			x: tx,
			y: M + 2,
			size: 15,
			bold: true,
			width: W - LOGO - 12,
			color: COLORS.heading
		});
		write(doc, t('report.feedback_title'), {
			x: tx,
			y: doc.y,
			size: 11,
			bold: true,
			color: COLORS.accent
		});
		doc.x = M;
		doc.y = Math.max(doc.y, M + LOGO) + 14;

		write(doc, p.name, { x: M, y: doc.y, size: 17, bold: true, width: W });
		const sub = [p.code, p.group, p.affiliation].filter(Boolean).join(' · ');
		write(doc, sub, { x: M, y: doc.y, size: 10, color: COLORS.muted, width: W });
		if (p.members)
			write(doc, `${t('score.members')}: ${p.members}`, {
				x: M,
				y: doc.y,
				size: 10,
				color: COLORS.muted,
				width: W
			});
		doc.moveDown(0.6);

		for (const e of p.events) {
			ensureSpace(doc, 70);
			const top = doc.y;
			doc.rect(M, top, W, 22).fill(COLORS.head);
			write(doc, e.venue ? `${e.event}  ·  ${e.venue}` : e.event, {
				x: M + 8,
				y: top + 5,
				size: 11,
				bold: true,
				width: W - 16
			});
			doc.x = M;
			doc.y = top + 30;
			const withRemarks = e.judges.filter(
				(j) => j.remark.trim() || (input.includeMarks && j.total !== null)
			);
			if (withRemarks.length === 0) {
				para(doc, t('report.no_remarks'), 10, COLORS.muted);
			}
			for (const j of withRemarks) {
				ensureSpace(doc, 40);
				let label = t('report.judge_n', { n: j.label });
				if (input.includeMarks && j.total !== null)
					label += `  ·  ${t('report.total_marks')}: ${formatMark(j.total)} / ${formatMark(j.max)}`;
				write(doc, label, {
					x: M + 8,
					y: doc.y,
					size: 10,
					bold: true,
					color: COLORS.accent,
					width: W - 16
				});
				if (j.remark.trim())
					write(doc, j.remark.trim(), {
						x: M + 8,
						y: doc.y + 2,
						size: 11,
						width: W - 16,
						lineGap: 2
					});
				doc.moveDown(0.7);
			}
			doc.moveDown(0.4);
		}
	});
	if (input.participants.length === 0) para(doc, t('report.no_remarks'), 11, COLORS.muted);

	const range = doc.bufferedPageRange();
	for (let i = range.start; i < range.start + range.count; i++) {
		doc.switchToPage(i);
		write(
			doc,
			`${t('report.generated', { time: formatDateTime(input.locale, input.generatedAt) })} · ${t('report.page', { n: i + 1 })}`,
			{
				x: M,
				y: A4.height - M + 10,
				size: 8,
				color: COLORS.muted,
				width: W,
				align: 'center',
				lineBreak: false
			}
		);
	}
	doc.end();
	await done;
	return Buffer.concat(chunks);
}
