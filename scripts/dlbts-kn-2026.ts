/**
 * DLBTS KN 2026: groups, events, criteria and judges.
 * Single source for supabase/setup/02_dlbts_kn_2026.sql (run `npm run setup:sql`).
 *
 * Usernames: judge<NN><group code><event code>, e.g. judge01grp2slokagirls.
 * Passwords: the same with "judge" replaced by "pwd", e.g. pwd01grp2slokagirls.
 * Criteria and maximum marks are taken from the DLBTS 2025 app; admins can change
 * them under Events before judging starts.
 */
export type Criterion = [name: string, max: number];

const C = {
	chant: [
		['Bhaavam', 5],
		['Tune', 5],
		['Pronunciation', 10],
		['Memory', 10]
	] as Criterion[],
	veda: [
		['Pronunciation', 15],
		['Bhaavam', 5],
		['Intonation', 15],
		['Memory', 15]
	] as Criterion[],
	story: [
		['Presentation', 10],
		['Content', 10],
		['Language', 10]
	] as Criterion[],
	fancy: [
		['Character Representation', 10],
		['Expression and Delivery', 10],
		['Content and Relevance', 10]
	] as Criterion[],
	drawing: [
		['Theme', 10],
		['Colour Coordination', 10],
		['Layout', 10]
	] as Criterion[],
	bhajan: [
		['Shruthi', 10],
		['Bhaavam', 10],
		['Ragam', 10],
		['Talam', 10],
		['Memory & Pronunciation', 10]
	] as Criterion[],
	jam: [
		['Content', 10],
		['Language & Fluency', 10],
		['Overall Presentation', 10]
	] as Criterion[],
	ted: [
		['Content & Relevance', 10],
		['Personal Connection', 10],
		['Expression & Delivery', 5],
		['Language & Fluency', 5]
	] as Criterion[],
	charades: [['Accurate Guessing', 10]] as Criterion[],
	waste: [
		['Creativity & Uniqueness', 10],
		['Wastage Minimisation', 5],
		['Utility / Practicality', 10],
		['Neatness and Finish', 10],
		['Team Work', 5]
	] as Criterion[],
	quiz: [
		['General Round', 10],
		['AV Round', 10],
		['Rapid Fire Round', 10]
	] as Criterion[],
	rangoli: [
		['Theme Relevance', 10],
		['Creativity', 10],
		['Colour Combination', 10],
		['Symmetry', 5],
		['Team Coordination', 5]
	] as Criterion[],
	altar: [
		['Aesthetics', 10],
		['Resource Management', 10],
		['Teamwork', 10]
	] as Criterion[]
};

export interface EventDef {
	code: string;
	name: string;
	note: string;
	criteria: Criterion[];
}
export interface GroupDef {
	code: string;
	name: string;
	events: EventDef[];
}

const BOTH = 'Boys and girls together';
const ev = (code: string, name: string, criteria: Criterion[], note = BOTH): EventDef => ({
	code,
	name,
	note,
	criteria
});
const split = (code: string, name: string, criteria: Criterion[]): EventDef[] => [
	ev(`${code}boys`, `${name} – Boys`, criteria, 'Boys'),
	ev(`${code}girls`, `${name} – Girls`, criteria, 'Girls')
];

export const JUDGES_PER_EVENT = 2;
export const SCORE_PRECISION = 1; // marks like 7.5 are allowed

export const groups: GroupDef[] = [
	{
		code: 'grp1',
		name: 'Group 1',
		events: [
			ev('sloka', 'Sloka Chanting', C.chant),
			ev('veda', 'Veda Chanting', C.veda),
			ev('tamil', 'Tamil Chant', C.chant),
			ev('story', 'Story Telling', C.story),
			ev('fancy', 'Fancy Dress', C.fancy),
			ev('drawing', 'Drawing', C.drawing),
			ev('bhajan', 'Bhajan Singing', C.bhajan)
		]
	},
	{
		code: 'grp2',
		name: 'Group 2',
		events: [
			...split('sloka', 'Sloka Chanting', C.chant),
			...split('veda', 'Veda Chanting', C.veda),
			...split('tamil', 'Tamil Chant', C.chant),
			ev('jameng', 'Just A Minute (JAM) – English', C.jam),
			ev('jamtamil', 'Just A Minute (JAM) – Tamil', C.jam),
			ev('drawing', 'Drawing', C.drawing),
			...split('bhajan', 'Bhajan Singing', C.bhajan),
			ev('charades', 'Dumb Charades', C.charades, 'Teams of 2 boys or 2 girls')
		]
	},
	{
		code: 'grp3',
		name: 'Group 3',
		events: [
			...split('sloka', 'Sloka Chanting', C.chant),
			...split('veda', 'Veda Chanting', C.veda),
			...split('tamil', 'Tamil Chant', C.chant),
			ev('tedeng', 'TED SAI – English', C.ted),
			ev('tedtamil', 'TED SAI – Tamil', C.ted),
			ev('drawing', 'Drawing', C.drawing),
			...split('bhajan', 'Bhajan Singing', C.bhajan)
		]
	},
	{
		code: 'team',
		name: 'Team Events',
		events: [
			ev('waste', 'Wealth out of Waste', C.waste, 'Team event'),
			ev('quiz', 'Quiz', C.quiz, 'Team event'),
			ev('rangoli', 'Rangoli', C.rangoli, 'Team event')
		]
	},
	{
		code: 'gevent',
		name: 'Group Events',
		events: [
			...split('altar', 'Altar Decoration', C.altar),
			...split('namakam', 'Namakam Chanting', C.veda)
		]
	}
];

export const username = (nn: number, g: GroupDef, e: EventDef) =>
	`judge${String(nn).padStart(2, '0')}${g.code}${e.code}`;
