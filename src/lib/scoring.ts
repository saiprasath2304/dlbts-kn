/**
 * Pure scoring logic shared by the judge UI (instant feedback) and tests.
 * The database recomputes and enforces everything authoritatively; nothing
 * here is trusted when it arrives from a browser.
 *
 * Marks have at most 2 decimal places, so arithmetic is done in integer
 * hundredths to avoid floating-point drift (0.1 + 0.2 !== 0.3).
 */

export type MarkError = 'NOT_A_NUMBER' | 'NEGATIVE' | 'ABOVE_MAX' | 'TOO_MANY_DECIMALS';

export type MarkParse = { ok: true; value: number | null } | { ok: false; error: MarkError };

const toHundredths = (n: number) => Math.round(n * 100);
const fromHundredths = (n: number) => n / 100;

/** Parse what a judge typed. Empty means "no mark yet". Accepts "22,5" as 22.5. */
export function parseMark(input: string, max: number, precision: number): MarkParse {
	const raw = input.trim().replace(',', '.');
	if (raw === '') return { ok: true, value: null };
	if (/^-/.test(raw)) return { ok: false, error: 'NEGATIVE' };
	if (!/^\d+(\.\d*)?$|^\.\d+$/.test(raw)) return { ok: false, error: 'NOT_A_NUMBER' };
	const decimals = raw.includes('.') ? raw.split('.')[1].replace(/0+$/, '').length : 0;
	if (decimals > precision) return { ok: false, error: 'TOO_MANY_DECIMALS' };
	const value = Number(raw);
	if (!Number.isFinite(value)) return { ok: false, error: 'NOT_A_NUMBER' };
	if (toHundredths(value) > toHundredths(max)) return { ok: false, error: 'ABOVE_MAX' };
	return { ok: true, value: fromHundredths(toHundredths(value)) };
}

/** Validate an already-numeric mark (e.g. from an offline draft). */
export function validateMark(
	value: number | null,
	max: number,
	precision: number
): MarkError | null {
	if (value === null) return null;
	if (!Number.isFinite(value)) return 'NOT_A_NUMBER';
	if (value < 0) return 'NEGATIVE';
	if (toHundredths(value) > toHundredths(max)) return 'ABOVE_MAX';
	const scaled = value * 10 ** precision;
	if (Math.abs(scaled - Math.round(scaled)) > 1e-9) return 'TOO_MANY_DECIMALS';
	return null;
}

export function sumMarks(values: Iterable<number | null | undefined>): number {
	let total = 0;
	for (const v of values) if (typeof v === 'number') total += toHundredths(v);
	return fromHundredths(total);
}

export interface CriterionLike {
	id: string;
	max_marks: number;
}

export interface ParticipantTotal {
	total: number;
	max: number;
	filled: number;
	required: number;
	complete: boolean;
}

/** One judge's total for one participant: the sum of their criterion marks. */
export function participantTotal(
	criteria: readonly CriterionLike[],
	marks: Readonly<Record<string, number | null | undefined>>
): ParticipantTotal {
	const values = criteria.map((c) => marks[c.id]);
	const filled = values.filter((v) => typeof v === 'number').length;
	return {
		total: sumMarks(values),
		max: sumMarks(criteria.map((c) => c.max_marks)),
		filled,
		required: criteria.length,
		complete: filled === criteria.length
	};
}

/** Final aggregate = sum of every required judge's total. */
export function aggregateTotals(judgeTotals: Iterable<number>): number {
	return sumMarks(judgeTotals);
}

export function formatMark(value: number | null | undefined, precision = 2): string {
	if (value === null || value === undefined) return '';
	const fixed = value.toFixed(precision);
	return precision > 0 ? fixed.replace(/\.?0+$/, '') : fixed;
}

// -----------------------------------------------------------------------------
// Ranking and ties
// -----------------------------------------------------------------------------

export interface RankInput {
	participant_id: string;
	aggregate: number;
	code?: string;
	name?: string;
}

export interface Ranked extends RankInput {
	calc_rank: number;
	tie_size: number;
	tied: boolean;
}

/**
 * Competition ranking ("1, 2, 2, 4") by descending aggregate. Participants with
 * equal aggregates share the calculated rank and are flagged as tied. Display
 * order inside a tie uses the code only for stable rendering; it does NOT
 * decide placement.
 */
export function rankParticipants(rows: readonly RankInput[]): Ranked[] {
	const sorted = [...rows].sort(
		(a, b) =>
			toHundredths(b.aggregate) - toHundredths(a.aggregate) ||
			(a.code ?? '').localeCompare(b.code ?? '')
	);
	const counts = new Map<number, number>();
	for (const r of sorted) {
		const k = toHundredths(r.aggregate);
		counts.set(k, (counts.get(k) ?? 0) + 1);
	}
	const firstIndex = new Map<number, number>();
	return sorted.map((r, i) => {
		const k = toHundredths(r.aggregate);
		if (!firstIndex.has(k)) firstIndex.set(k, i);
		const tie_size = counts.get(k) ?? 1;
		return { ...r, calc_rank: (firstIndex.get(k) ?? i) + 1, tie_size, tied: tie_size > 1 };
	});
}

export interface TieGroup {
	aggregate: number;
	participant_ids: string[];
	start_rank: number;
}

export function findTies(ranked: readonly Ranked[]): TieGroup[] {
	const groups = new Map<number, TieGroup>();
	for (const r of ranked) {
		if (!r.tied) continue;
		const k = toHundredths(r.aggregate);
		const g = groups.get(k) ?? {
			aggregate: r.aggregate,
			participant_ids: [],
			start_rank: r.calc_rank
		};
		g.participant_ids.push(r.participant_id);
		g.start_rank = Math.min(g.start_rank, r.calc_rank);
		groups.set(k, g);
	}
	return [...groups.values()]
		.map((g) => ({ ...g, participant_ids: [...g.participant_ids].sort() }))
		.sort((a, b) => a.start_rank - b.start_rank);
}

export type TieRankError =
	'WRONG_PARTICIPANTS' | 'NOT_INTEGER' | 'OUT_OF_RANGE' | 'BEST_RANK_MISSING';

/**
 * Admin-chosen ranks for a tie group must be whole numbers within the places
 * the group occupies, and someone must take the best of those places. Equal
 * ranks (a shared place) are allowed when the admin decides so.
 */
export function validateTieRanks(
	group: TieGroup,
	ranks: Readonly<Record<string, number>>
): TieRankError | null {
	const ids = Object.keys(ranks).sort();
	if (
		ids.length !== group.participant_ids.length ||
		ids.some((id, i) => id !== group.participant_ids[i])
	) {
		return 'WRONG_PARTICIPANTS';
	}
	const values = ids.map((id) => ranks[id]);
	if (values.some((v) => !Number.isInteger(v))) return 'NOT_INTEGER';
	const lo = group.start_rank;
	const hi = group.start_rank + group.participant_ids.length - 1;
	if (values.some((v) => v < lo || v > hi)) return 'OUT_OF_RANGE';
	if (Math.min(...values) !== lo) return 'BEST_RANK_MISSING';
	return null;
}

export interface FinalRanked extends Ranked {
	final_rank: number | null;
}

/** Apply tie resolutions; unresolved tied participants get final_rank = null. */
export function applyTieResolutions(
	ranked: readonly Ranked[],
	resolutions: Readonly<Record<string, number>>
): FinalRanked[] {
	return ranked
		.map((r) => ({
			...r,
			final_rank: r.tied ? (resolutions[r.participant_id] ?? null) : r.calc_rank
		}))
		.sort(
			(a, b) =>
				(a.final_rank ?? a.calc_rank) - (b.final_rank ?? b.calc_rank) ||
				(a.code ?? '').localeCompare(b.code ?? '')
		);
}

/** Podium entries (ranks 1-3) that actually exist; never invents places. */
export function podium<T extends { final_rank: number | null }>(
	rows: readonly T[],
	places = 3
): T[] {
	return rows.filter((r) => r.final_rank !== null && r.final_rank <= places);
}

/** Place label: 1st, 2nd... in English; 1-ஆம், 2-ஆம்... in Tamil. */
export function ordinal(n: number, locale: 'en' | 'ta' = 'en'): string {
	if (locale === 'ta') return `${n}-ஆம்`;
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
