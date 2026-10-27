import { describe, expect, it } from 'vitest';
import { eventChoices, type ChoiceGroup } from './event-choices';

const groups: ChoiceGroup[] = [
	{
		id: 'g1',
		name: 'Group 1',
		events: [
			{ id: 'sloka1', name: 'Sloka', participation: 'individual' },
			{ id: 'draw1', name: 'Drawing', participation: 'individual' }
		]
	},
	{
		id: 'g2',
		name: 'Group 2',
		events: [
			{ id: 'sloka2', name: 'Sloka', participation: 'individual' },
			{ id: 'charades', name: 'Dumb Charades', participation: 'team' }
		]
	},
	{
		id: 'team',
		name: 'Team Events',
		events: [{ id: 'quiz', name: 'Quiz', participation: 'team' }]
	},
	{
		id: 'gev',
		name: 'Group Events',
		events: [{ id: 'altar', name: 'Altar', participation: 'team' }]
	}
];
const ids = (x: { value: string }[]) => x.map((o) => o.value);

describe('eventChoices', () => {
	it('individual: only the child group individual events, minus ones already joined', () => {
		expect(ids(eventChoices(groups, 'individual', 'g1', ['sloka1']))).toEqual(['draw1']);
	});
	it('team: own group team events plus the common team groups', () => {
		expect(ids(eventChoices(groups, 'team', 'g2'))).toEqual(['charades', 'quiz', 'altar']);
		expect(ids(eventChoices(groups, 'team', 'g1'))).toEqual(['quiz', 'altar']);
	});
	it('no group: everything of that kind', () => {
		expect(ids(eventChoices(groups, 'individual', null))).toEqual(['sloka1', 'draw1', 'sloka2']);
	});
});
