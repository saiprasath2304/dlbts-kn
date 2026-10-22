import { describe, expect, it } from 'vitest';
import {
	aggregateTotals,
	applyTieResolutions,
	findTies,
	formatMark,
	parseMark,
	participantTotal,
	podium,
	rankParticipants,
	sumMarks,
	validateMark,
	validateTieRanks
} from './scoring';

describe('parseMark (criterion mark validation)', () => {
	it('accepts valid marks within the maximum', () => {
		expect(parseMark('22', 25, 1)).toEqual({ ok: true, value: 22 });
		expect(parseMark('25', 25, 0)).toEqual({ ok: true, value: 25 });
		expect(parseMark('0', 25, 0)).toEqual({ ok: true, value: 0 });
	});
	it('treats empty input as "no mark yet"', () => {
		expect(parseMark('  ', 25, 1)).toEqual({ ok: true, value: null });
	});
	it('rejects negative marks', () => {
		expect(parseMark('-1', 25, 1)).toEqual({ ok: false, error: 'NEGATIVE' });
	});
	it('rejects marks above the criterion maximum', () => {
		expect(parseMark('25.5', 25, 1)).toEqual({ ok: false, error: 'ABOVE_MAX' });
		expect(parseMark('26', 25, 0)).toEqual({ ok: false, error: 'ABOVE_MAX' });
	});
	it('rejects non-numeric input', () => {
		for (const bad of ['abc', '1e2', '12a', '1.2.3', '--']) {
			expect(parseMark(bad, 25, 2).ok).toBe(false);
		}
	});
	it('supports decimals with configurable precision', () => {
		expect(parseMark('22.5', 25, 1)).toEqual({ ok: true, value: 22.5 });
		expect(parseMark('22,5', 25, 1)).toEqual({ ok: true, value: 22.5 });
		expect(parseMark('22.25', 25, 2)).toEqual({ ok: true, value: 22.25 });
		expect(parseMark('22.25', 25, 1)).toEqual({ ok: false, error: 'TOO_MANY_DECIMALS' });
		expect(parseMark('22.5', 25, 0)).toEqual({ ok: false, error: 'TOO_MANY_DECIMALS' });
		expect(parseMark('22.50', 25, 1)).toEqual({ ok: true, value: 22.5 });
	});
	it('validates numeric drafts the same way', () => {
		expect(validateMark(22.5, 25, 1)).toBeNull();
		expect(validateMark(22.55, 25, 1)).toBe('TOO_MANY_DECIMALS');
		expect(validateMark(-0.5, 25, 1)).toBe('NEGATIVE');
		expect(validateMark(30, 25, 1)).toBe('ABOVE_MAX');
		expect(validateMark(null, 25, 1)).toBeNull();
	});
});

describe('totals', () => {
	const criteria = [
		{ id: 'c1', max_marks: 25 },
		{ id: 'c2', max_marks: 25 },
		{ id: 'c3', max_marks: 25 },
		{ id: 'c4', max_marks: 25 }
	];
	it("sums one judge's criterion marks (22+24+21+23 = 90/100)", () => {
		const t = participantTotal(criteria, { c1: 22, c2: 24, c3: 21, c4: 23 });
		expect(t).toMatchObject({ total: 90, max: 100, complete: true, filled: 4 });
	});
	it('reports incomplete participants', () => {
		const t = participantTotal(criteria, { c1: 22, c2: null });
		expect(t).toMatchObject({ total: 22, complete: false, filled: 1, required: 4 });
	});
	it('adds decimals without floating-point drift', () => {
		expect(sumMarks([0.1, 0.2])).toBe(0.3);
		expect(sumMarks([22.1, 24.2, 21.3, 23.4])).toBe(91);
	});
	it("aggregates by summing all judges' totals (90+85+92 = 267)", () => {
		expect(aggregateTotals([90, 85, 92])).toBe(267);
		expect(aggregateTotals([90.5, 85.25])).toBe(175.75);
	});
	it('formats marks compactly', () => {
		expect(formatMark(22.5, 1)).toBe('22.5');
		expect(formatMark(22, 1)).toBe('22');
		expect(formatMark(null)).toBe('');
	});
});

describe('ranking and ties', () => {
	const rows = [
		{ participant_id: 'a', aggregate: 267, code: 'A' },
		{ participant_id: 'b', aggregate: 250, code: 'B' },
		{ participant_id: 'c', aggregate: 267, code: 'C' },
		{ participant_id: 'd', aggregate: 240, code: 'D' }
	];

	it('ranks by descending aggregate with shared calculated ranks', () => {
		const r = rankParticipants(rows);
		expect(r.map((x) => [x.participant_id, x.calc_rank, x.tied])).toEqual([
			['a', 1, true],
			['c', 1, true],
			['b', 3, false],
			['d', 4, false]
		]);
	});

	it('detects ties without breaking them', () => {
		const ties = findTies(rankParticipants(rows));
		expect(ties).toEqual([{ aggregate: 267, participant_ids: ['a', 'c'], start_rank: 1 }]);
		const final = applyTieResolutions(rankParticipants(rows), {});
		expect(final.find((x) => x.participant_id === 'a')?.final_rank).toBeNull();
		expect(final.find((x) => x.participant_id === 'c')?.final_rank).toBeNull();
		expect(final.find((x) => x.participant_id === 'b')?.final_rank).toBe(3);
	});

	it('validates admin tie resolutions', () => {
		const tie = { aggregate: 267, participant_ids: ['a', 'c'], start_rank: 1 };
		expect(validateTieRanks(tie, { a: 1, c: 2 })).toBeNull();
		expect(validateTieRanks(tie, { a: 1, c: 1 })).toBeNull(); // explicit shared place
		expect(validateTieRanks(tie, { a: 2, c: 2 })).toBe('BEST_RANK_MISSING');
		expect(validateTieRanks(tie, { a: 1, c: 3 })).toBe('OUT_OF_RANGE');
		expect(validateTieRanks(tie, { a: 1 })).toBe('WRONG_PARTICIPANTS');
		expect(validateTieRanks(tie, { a: 1, c: 1.5 })).toBe('NOT_INTEGER');
	});

	it('applies resolutions and keeps calculated order otherwise', () => {
		const final = applyTieResolutions(rankParticipants(rows), { c: 1, a: 2 });
		expect(final.map((x) => [x.participant_id, x.final_rank])).toEqual([
			['c', 1],
			['a', 2],
			['b', 3],
			['d', 4]
		]);
	});

	it('only shows places that exist', () => {
		const two = applyTieResolutions(
			rankParticipants([
				{ participant_id: 'x', aggregate: 10 },
				{ participant_id: 'y', aggregate: 5 }
			]),
			{}
		);
		expect(podium(two).map((p) => p.final_rank)).toEqual([1, 2]);
	});
});
