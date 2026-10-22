import type { ResultStatus } from './types.ts';

/** Shape returned by the database function get_event_results / stored in snapshots. */
export interface EventResults {
	event_id: string;
	status: ResultStatus;
	complete: boolean;
	required_judges: number;
	submitted_judges: number;
	incomplete_submissions: number;
	judges: {
		judge_id: string;
		display_name: string;
		username: string;
		submission_id: string | null;
		status: string | null;
		submitted_at: string | null;
		missing: number | null;
	}[];
	criteria: { id: string; name: string; max_marks: number; display_order: number }[];
	max_per_judge: number;
	participant_count: number;
	participants:
		| {
				participant_id: string;
				code: string;
				name: string;
				affiliation: string | null;
				kind: string;
				aggregate: number;
				judge_totals: Record<string, number>;
				calc_rank: number;
				tie_size: number;
				tied: boolean;
				final_rank: number | null;
		  }[]
		| null;
	ties: {
		aggregate: number;
		participant_ids: string[];
		start_rank: number;
		resolved: boolean;
		resolution_id: string | null;
		ranks: Record<string, number> | null;
		reason: string | null;
		resolved_at: string | null;
	}[];
	unresolved_ties: number;
	finalization: { id: string; finalized_at: string; finalized_by: string } | null;
}

export interface FinalSnapshot extends EventResults {
	event: {
		id: string;
		code: string;
		name: string;
		group: { id: string; code: string; name: string };
	};
	breakdown: { judge_id: string; participant_id: string; criterion_id: string; value: number }[];
}
