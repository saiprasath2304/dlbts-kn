import type { SubmissionStatus } from './types';

export const EDITABLE_STATUSES: readonly SubmissionStatus[] = [
	'not_started',
	'in_progress',
	'reopened',
	'correction_requested'
];

export const SUBMITTED_STATUSES: readonly SubmissionStatus[] = ['submitted', 'resubmitted'];

export function isEditable(status: SubmissionStatus): boolean {
	return EDITABLE_STATUSES.includes(status);
}

export function isSubmitted(status: SubmissionStatus): boolean {
	return SUBMITTED_STATUSES.includes(status);
}

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function statusTone(status: SubmissionStatus): Tone {
	switch (status) {
		case 'submitted':
		case 'resubmitted':
			return 'success';
		case 'in_progress':
		case 'reopened':
			return 'info';
		case 'reopening_requested':
		case 'correction_requested':
			return 'warning';
		default:
			return 'neutral';
	}
}
