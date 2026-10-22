import { describe, expect, it } from 'vitest';
import { scriptRuns } from './text';

describe('scriptRuns', () => {
	it('splits mixed English and Tamil into font runs', () => {
		expect(scriptRuns('Sloka Chanting – ஸ்லோகம் 1')).toEqual([
			{ script: 'lat', text: 'Sloka Chanting – ' },
			{ script: 'ta', text: 'ஸ்லோகம் 1' }
		]);
	});
	it('keeps pure strings in one run', () => {
		expect(scriptRuns('மாதிரி பங்கேற்பாளர்')).toHaveLength(1);
		expect(scriptRuns('Demo Child 01')).toEqual([{ script: 'lat', text: 'Demo Child 01' }]);
	});
});
