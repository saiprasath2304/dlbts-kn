/**
 * Split text into runs by script so each run can use a font that has its
 * glyphs (Noto Sans Tamil has no Latin letters; Noto Sans has no Tamil).
 * Digits, spaces and common punctuation exist in both and stay in the
 * surrounding run to keep shaping contexts intact.
 */
export type Script = 'ta' | 'lat';

const TAMIL = /[\u0B80-\u0BFF]/;
const JOINERS = /[\u200C\u200D]/;
const NEUTRAL = /[\s0-9.,:;()/\-–—'"!?%+&#*·]/;

export function scriptRuns(text: string): { script: Script; text: string }[] {
	const runs: { script: Script; text: string }[] = [];
	let current: Script | null = null;
	let buf = '';
	for (const ch of text) {
		let script: Script | null;
		if (TAMIL.test(ch) || JOINERS.test(ch)) script = 'ta';
		else if (NEUTRAL.test(ch)) script = null;
		else script = 'lat';
		if (script === null || script === current || current === null) {
			if (current === null && script !== null) current = script;
			buf += ch;
			continue;
		}
		runs.push({ script: current, text: buf });
		current = script;
		buf = ch;
	}
	if (buf) runs.push({ script: current ?? 'lat', text: buf });
	return runs;
}

export function hasTamil(text: string): boolean {
	return TAMIL.test(text);
}
