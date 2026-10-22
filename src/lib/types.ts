export type Locale = 'en' | 'ta';
export const LOCALES: readonly Locale[] = ['en', 'ta'] as const;

export type Role = 'admin' | 'judge';

export type SubmissionStatus =
	| 'not_started'
	| 'in_progress'
	| 'submitted'
	| 'reopening_requested'
	| 'correction_requested'
	| 'reopened'
	| 'resubmitted';

export type ResultStatus =
	'judging_in_progress' | 'awaiting_tie_resolution' | 'ready_for_finalization' | 'finalized';

export interface Profile {
	id: string;
	username: string;
	display_name: string;
	role: Role;
	is_active: boolean;
}

export interface Criterion {
	id: string;
	name: string;
	description?: string | null;
	max_marks: number;
	display_order: number;
	is_active?: boolean;
}
