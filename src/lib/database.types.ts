export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	graphql_public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			graphql: {
				Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			app_settings: {
				Row: {
					key: string;
					updated_at: string;
					updated_by: string | null;
					value: NonNullable<Json>;
				};
				ComputedFields: never;
				Insert: {
					key: string;
					updated_at?: string;
					updated_by?: string | null;
					value: NonNullable<Json>;
				};
				Update: {
					key?: string;
					updated_at?: string;
					updated_by?: string | null;
					value?: NonNullable<Json>;
				};
				Relationships: [
					{
						foreignKeyName: 'app_settings_updated_by_fkey';
						columns: ['updated_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			audit_logs: {
				Row: {
					action: string;
					actor_id: string | null;
					actor_role: string | null;
					created_at: string;
					entity_id: string | null;
					entity_type: string | null;
					event_id: string | null;
					group_id: string | null;
					id: number;
					judge_id: string | null;
					metadata: NonNullable<Json>;
					new_value: Json | null;
					old_value: Json | null;
					participant_id: string | null;
					reason: string | null;
					request_id: string | null;
					submission_id: string | null;
				};
				ComputedFields: never;
				Insert: {
					action: string;
					actor_id?: string | null;
					actor_role?: string | null;
					created_at?: string;
					entity_id?: string | null;
					entity_type?: string | null;
					event_id?: string | null;
					group_id?: string | null;
					id?: never;
					judge_id?: string | null;
					metadata?: NonNullable<Json>;
					new_value?: Json | null;
					old_value?: Json | null;
					participant_id?: string | null;
					reason?: string | null;
					request_id?: string | null;
					submission_id?: string | null;
				};
				Update: {
					action?: string;
					actor_id?: string | null;
					actor_role?: string | null;
					created_at?: string;
					entity_id?: string | null;
					entity_type?: string | null;
					event_id?: string | null;
					group_id?: string | null;
					id?: never;
					judge_id?: string | null;
					metadata?: NonNullable<Json>;
					new_value?: Json | null;
					old_value?: Json | null;
					participant_id?: string | null;
					reason?: string | null;
					request_id?: string | null;
					submission_id?: string | null;
				};
				Relationships: [];
			};
			correction_requests: {
				Row: {
					created_at: string;
					created_by: string;
					criterion_ids: string[];
					event_id: string;
					id: string;
					judge_response: string | null;
					message: string;
					participant_id: string | null;
					resolution_note: string | null;
					resolved_at: string | null;
					resolved_by: string | null;
					responded_at: string | null;
					status: Database['public']['Enums']['correction_status'];
					submission_id: string;
					unlocks_submission: boolean;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					created_by: string;
					criterion_ids?: string[];
					event_id: string;
					id?: string;
					judge_response?: string | null;
					message: string;
					participant_id?: string | null;
					resolution_note?: string | null;
					resolved_at?: string | null;
					resolved_by?: string | null;
					responded_at?: string | null;
					status?: Database['public']['Enums']['correction_status'];
					submission_id: string;
					unlocks_submission?: boolean;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					created_by?: string;
					criterion_ids?: string[];
					event_id?: string;
					id?: string;
					judge_response?: string | null;
					message?: string;
					participant_id?: string | null;
					resolution_note?: string | null;
					resolved_at?: string | null;
					resolved_by?: string | null;
					responded_at?: string | null;
					status?: Database['public']['Enums']['correction_status'];
					submission_id?: string;
					unlocks_submission?: boolean;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'correction_requests_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'correction_requests_event_id_fkey';
						columns: ['event_id'];
						isOneToOne: false;
						referencedRelation: 'events';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'correction_requests_participant_id_fkey';
						columns: ['participant_id'];
						isOneToOne: false;
						referencedRelation: 'participants';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'correction_requests_resolved_by_fkey';
						columns: ['resolved_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'correction_requests_submission_id_fkey';
						columns: ['submission_id'];
						isOneToOne: false;
						referencedRelation: 'submissions';
						referencedColumns: ['id'];
					}
				];
			};
			criterion_scores: {
				Row: {
					created_at: string;
					criterion_id: string;
					id: string;
					participant_id: string;
					submission_id: string;
					updated_at: string;
					updated_by: string | null;
					value: number | null;
					version: number;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					criterion_id: string;
					id?: string;
					participant_id: string;
					submission_id: string;
					updated_at?: string;
					updated_by?: string | null;
					value?: number | null;
					version?: number;
				};
				Update: {
					created_at?: string;
					criterion_id?: string;
					id?: string;
					participant_id?: string;
					submission_id?: string;
					updated_at?: string;
					updated_by?: string | null;
					value?: number | null;
					version?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'criterion_scores_criterion_id_fkey';
						columns: ['criterion_id'];
						isOneToOne: false;
						referencedRelation: 'evaluation_criteria';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'criterion_scores_participant_id_fkey';
						columns: ['participant_id'];
						isOneToOne: false;
						referencedRelation: 'participants';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'criterion_scores_submission_id_fkey';
						columns: ['submission_id'];
						isOneToOne: false;
						referencedRelation: 'submissions';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'criterion_scores_updated_by_fkey';
						columns: ['updated_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			evaluation_criteria: {
				Row: {
					created_at: string;
					description: string | null;
					display_order: number;
					event_id: string;
					id: string;
					is_active: boolean;
					max_marks: number;
					name: string;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					description?: string | null;
					display_order?: number;
					event_id: string;
					id?: string;
					is_active?: boolean;
					max_marks: number;
					name: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					description?: string | null;
					display_order?: number;
					event_id?: string;
					id?: string;
					is_active?: boolean;
					max_marks?: number;
					name?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'evaluation_criteria_event_id_fkey';
						columns: ['event_id'];
						isOneToOne: false;
						referencedRelation: 'events';
						referencedColumns: ['id'];
					}
				];
			};
			event_participants: {
				Row: {
					created_at: string;
					display_order: number;
					event_id: string;
					id: string;
					is_active: boolean;
					participant_id: string;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					display_order?: number;
					event_id: string;
					id?: string;
					is_active?: boolean;
					participant_id: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					display_order?: number;
					event_id?: string;
					id?: string;
					is_active?: boolean;
					participant_id?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'event_participants_event_id_fkey';
						columns: ['event_id'];
						isOneToOne: false;
						referencedRelation: 'events';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'event_participants_participant_id_fkey';
						columns: ['participant_id'];
						isOneToOne: false;
						referencedRelation: 'participants';
						referencedColumns: ['id'];
					}
				];
			};
			events: {
				Row: {
					code: string;
					created_at: string;
					description: string | null;
					display_order: number;
					group_id: string;
					id: string;
					instructions: string | null;
					is_active: boolean;
					name: string;
					score_precision: number;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					code: string;
					created_at?: string;
					description?: string | null;
					display_order?: number;
					group_id: string;
					id?: string;
					instructions?: string | null;
					is_active?: boolean;
					name: string;
					score_precision?: number;
					updated_at?: string;
				};
				Update: {
					code?: string;
					created_at?: string;
					description?: string | null;
					display_order?: number;
					group_id?: string;
					id?: string;
					instructions?: string | null;
					is_active?: boolean;
					name?: string;
					score_precision?: number;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'events_group_id_fkey';
						columns: ['group_id'];
						isOneToOne: false;
						referencedRelation: 'groups';
						referencedColumns: ['id'];
					}
				];
			};
			groups: {
				Row: {
					code: string;
					created_at: string;
					description: string | null;
					display_order: number;
					id: string;
					is_active: boolean;
					name: string;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					code: string;
					created_at?: string;
					description?: string | null;
					display_order?: number;
					id?: string;
					is_active?: boolean;
					name: string;
					updated_at?: string;
				};
				Update: {
					code?: string;
					created_at?: string;
					description?: string | null;
					display_order?: number;
					id?: string;
					is_active?: boolean;
					name?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			judge_assignments: {
				Row: {
					created_at: string;
					created_by: string | null;
					event_id: string;
					id: string;
					is_active: boolean;
					judge_id: string;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					created_by?: string | null;
					event_id: string;
					id?: string;
					is_active?: boolean;
					judge_id: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					created_by?: string | null;
					event_id?: string;
					id?: string;
					is_active?: boolean;
					judge_id?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'judge_assignments_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'judge_assignments_event_id_fkey';
						columns: ['event_id'];
						isOneToOne: false;
						referencedRelation: 'events';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'judge_assignments_judge_id_fkey';
						columns: ['judge_id'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			participants: {
				Row: {
					affiliation: string | null;
					code: string;
					created_at: string;
					group_id: string | null;
					id: string;
					is_active: boolean;
					kind: Database['public']['Enums']['participant_kind'];
					name: string;
					notes: string | null;
					registration_no: string | null;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					affiliation?: string | null;
					code: string;
					created_at?: string;
					group_id?: string | null;
					id?: string;
					is_active?: boolean;
					kind?: Database['public']['Enums']['participant_kind'];
					name: string;
					notes?: string | null;
					registration_no?: string | null;
					updated_at?: string;
				};
				Update: {
					affiliation?: string | null;
					code?: string;
					created_at?: string;
					group_id?: string | null;
					id?: string;
					is_active?: boolean;
					kind?: Database['public']['Enums']['participant_kind'];
					name?: string;
					notes?: string | null;
					registration_no?: string | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'participants_group_id_fkey';
						columns: ['group_id'];
						isOneToOne: false;
						referencedRelation: 'groups';
						referencedColumns: ['id'];
					}
				];
			};
			profiles: {
				Row: {
					created_at: string;
					created_by: string | null;
					display_name: string;
					id: string;
					is_active: boolean;
					role: Database['public']['Enums']['app_role'];
					updated_at: string;
					username: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					created_by?: string | null;
					display_name: string;
					id: string;
					is_active?: boolean;
					role?: Database['public']['Enums']['app_role'];
					updated_at?: string;
					username: string;
				};
				Update: {
					created_at?: string;
					created_by?: string | null;
					display_name?: string;
					id?: string;
					is_active?: boolean;
					role?: Database['public']['Enums']['app_role'];
					updated_at?: string;
					username?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'profiles_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			reopening_requests: {
				Row: {
					created_at: string;
					id: string;
					previous_status: Database['public']['Enums']['submission_status'];
					reason: string;
					requested_by: string;
					resolution_note: string | null;
					resolved_at: string | null;
					resolved_by: string | null;
					status: Database['public']['Enums']['request_status'];
					submission_id: string;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					id?: string;
					previous_status: Database['public']['Enums']['submission_status'];
					reason: string;
					requested_by: string;
					resolution_note?: string | null;
					resolved_at?: string | null;
					resolved_by?: string | null;
					status?: Database['public']['Enums']['request_status'];
					submission_id: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					previous_status?: Database['public']['Enums']['submission_status'];
					reason?: string;
					requested_by?: string;
					resolution_note?: string | null;
					resolved_at?: string | null;
					resolved_by?: string | null;
					status?: Database['public']['Enums']['request_status'];
					submission_id?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'reopening_requests_requested_by_fkey';
						columns: ['requested_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'reopening_requests_resolved_by_fkey';
						columns: ['resolved_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'reopening_requests_submission_id_fkey';
						columns: ['submission_id'];
						isOneToOne: false;
						referencedRelation: 'submissions';
						referencedColumns: ['id'];
					}
				];
			};
			report_records: {
				Row: {
					byte_size: number | null;
					email_attempts: number;
					email_last_error: string | null;
					email_recipient_masked: string | null;
					email_sent_at: string | null;
					email_status: string;
					event_ids: string[];
					file_sha256: string | null;
					generated_at: string;
					generated_by: string;
					id: string;
					idempotency_key: string | null;
					include_breakdown: boolean;
					kind: string;
					locale: string;
					provider_message_id: string | null;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					byte_size?: number | null;
					email_attempts?: number;
					email_last_error?: string | null;
					email_recipient_masked?: string | null;
					email_sent_at?: string | null;
					email_status?: string;
					event_ids?: string[];
					file_sha256?: string | null;
					generated_at?: string;
					generated_by: string;
					id?: string;
					idempotency_key?: string | null;
					include_breakdown?: boolean;
					kind: string;
					locale?: string;
					provider_message_id?: string | null;
					updated_at?: string;
				};
				Update: {
					byte_size?: number | null;
					email_attempts?: number;
					email_last_error?: string | null;
					email_recipient_masked?: string | null;
					email_sent_at?: string | null;
					email_status?: string;
					event_ids?: string[];
					file_sha256?: string | null;
					generated_at?: string;
					generated_by?: string;
					id?: string;
					idempotency_key?: string | null;
					include_breakdown?: boolean;
					kind?: string;
					locale?: string;
					provider_message_id?: string | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'report_records_generated_by_fkey';
						columns: ['generated_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			result_finalizations: {
				Row: {
					event_id: string;
					finalized_at: string;
					finalized_by: string;
					id: string;
					invalidated_at: string | null;
					invalidated_by: string | null;
					invalidation_reason: string | null;
					snapshot: NonNullable<Json>;
					status: string;
				};
				ComputedFields: never;
				Insert: {
					event_id: string;
					finalized_at?: string;
					finalized_by: string;
					id?: string;
					invalidated_at?: string | null;
					invalidated_by?: string | null;
					invalidation_reason?: string | null;
					snapshot: NonNullable<Json>;
					status?: string;
				};
				Update: {
					event_id?: string;
					finalized_at?: string;
					finalized_by?: string;
					id?: string;
					invalidated_at?: string | null;
					invalidated_by?: string | null;
					invalidation_reason?: string | null;
					snapshot?: NonNullable<Json>;
					status?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'result_finalizations_event_id_fkey';
						columns: ['event_id'];
						isOneToOne: false;
						referencedRelation: 'events';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'result_finalizations_finalized_by_fkey';
						columns: ['finalized_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			score_history: {
				Row: {
					changed_at: string;
					changed_by: string | null;
					criterion_id: string;
					id: number;
					new_value: number | null;
					new_version: number;
					old_value: number | null;
					old_version: number | null;
					participant_id: string;
					reason: string | null;
					score_id: string;
					source: string;
					submission_id: string;
				};
				ComputedFields: never;
				Insert: {
					changed_at?: string;
					changed_by?: string | null;
					criterion_id: string;
					id?: never;
					new_value?: number | null;
					new_version: number;
					old_value?: number | null;
					old_version?: number | null;
					participant_id: string;
					reason?: string | null;
					score_id: string;
					source: string;
					submission_id: string;
				};
				Update: {
					changed_at?: string;
					changed_by?: string | null;
					criterion_id?: string;
					id?: never;
					new_value?: number | null;
					new_version?: number;
					old_value?: number | null;
					old_version?: number | null;
					participant_id?: string;
					reason?: string | null;
					score_id?: string;
					source?: string;
					submission_id?: string;
				};
				Relationships: [];
			};
			submission_rounds: {
				Row: {
					id: string;
					round: number;
					scores: NonNullable<Json>;
					status: Database['public']['Enums']['submission_status'];
					submission_id: string;
					submitted_at: string;
					submitted_by: string;
					totals: NonNullable<Json>;
				};
				ComputedFields: never;
				Insert: {
					id?: string;
					round: number;
					scores: NonNullable<Json>;
					status: Database['public']['Enums']['submission_status'];
					submission_id: string;
					submitted_at?: string;
					submitted_by: string;
					totals: NonNullable<Json>;
				};
				Update: {
					id?: string;
					round?: number;
					scores?: NonNullable<Json>;
					status?: Database['public']['Enums']['submission_status'];
					submission_id?: string;
					submitted_at?: string;
					submitted_by?: string;
					totals?: NonNullable<Json>;
				};
				Relationships: [
					{
						foreignKeyName: 'submission_rounds_submission_id_fkey';
						columns: ['submission_id'];
						isOneToOne: false;
						referencedRelation: 'submissions';
						referencedColumns: ['id'];
					}
				];
			};
			submission_transitions: {
				Row: {
					actor_id: string | null;
					created_at: string;
					from_status: Database['public']['Enums']['submission_status'] | null;
					id: number;
					reason: string | null;
					request_id: string | null;
					submission_id: string;
					to_status: Database['public']['Enums']['submission_status'];
				};
				ComputedFields: never;
				Insert: {
					actor_id?: string | null;
					created_at?: string;
					from_status?: Database['public']['Enums']['submission_status'] | null;
					id?: never;
					reason?: string | null;
					request_id?: string | null;
					submission_id: string;
					to_status: Database['public']['Enums']['submission_status'];
				};
				Update: {
					actor_id?: string | null;
					created_at?: string;
					from_status?: Database['public']['Enums']['submission_status'] | null;
					id?: never;
					reason?: string | null;
					request_id?: string | null;
					submission_id?: string;
					to_status?: Database['public']['Enums']['submission_status'];
				};
				Relationships: [
					{
						foreignKeyName: 'submission_transitions_submission_id_fkey';
						columns: ['submission_id'];
						isOneToOne: false;
						referencedRelation: 'submissions';
						referencedColumns: ['id'];
					}
				];
			};
			submissions: {
				Row: {
					created_at: string;
					event_id: string;
					id: string;
					judge_id: string;
					last_saved_at: string | null;
					round: number;
					status: Database['public']['Enums']['submission_status'];
					submitted_at: string | null;
					submitted_by: string | null;
					updated_at: string;
					version: number;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					event_id: string;
					id?: string;
					judge_id: string;
					last_saved_at?: string | null;
					round?: number;
					status?: Database['public']['Enums']['submission_status'];
					submitted_at?: string | null;
					submitted_by?: string | null;
					updated_at?: string;
					version?: number;
				};
				Update: {
					created_at?: string;
					event_id?: string;
					id?: string;
					judge_id?: string;
					last_saved_at?: string | null;
					round?: number;
					status?: Database['public']['Enums']['submission_status'];
					submitted_at?: string | null;
					submitted_by?: string | null;
					updated_at?: string;
					version?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'submissions_event_id_fkey';
						columns: ['event_id'];
						isOneToOne: false;
						referencedRelation: 'events';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'submissions_judge_id_fkey';
						columns: ['judge_id'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'submissions_submitted_by_fkey';
						columns: ['submitted_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			tie_resolutions: {
				Row: {
					aggregate: number;
					event_id: string;
					id: string;
					is_active: boolean;
					original: NonNullable<Json>;
					participant_ids: string[];
					ranks: NonNullable<Json>;
					reason: string;
					related_correction_ids: string[];
					resolved_at: string;
					resolved_by: string;
				};
				ComputedFields: never;
				Insert: {
					aggregate: number;
					event_id: string;
					id?: string;
					is_active?: boolean;
					original: NonNullable<Json>;
					participant_ids: string[];
					ranks: NonNullable<Json>;
					reason: string;
					related_correction_ids?: string[];
					resolved_at?: string;
					resolved_by: string;
				};
				Update: {
					aggregate?: number;
					event_id?: string;
					id?: string;
					is_active?: boolean;
					original?: NonNullable<Json>;
					participant_ids?: string[];
					ranks?: NonNullable<Json>;
					reason?: string;
					related_correction_ids?: string[];
					resolved_at?: string;
					resolved_by?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'tie_resolutions_event_id_fkey';
						columns: ['event_id'];
						isOneToOne: false;
						referencedRelation: 'events';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'tie_resolutions_resolved_by_fkey';
						columns: ['resolved_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			admin_event_progress: {
				Args: Record<PropertyKey, never>;
				Returns: {
					corrections_open: number;
					criteria_count: number;
					event_active: boolean;
					event_code: string;
					event_id: string;
					event_name: string;
					event_order: number;
					finalized: boolean;
					group_code: string;
					group_id: string;
					group_name: string;
					group_order: number;
					in_progress: number;
					incomplete_submissions: number;
					not_started: number;
					participant_count: number;
					reopening_pending: number;
					required_judges: number;
					submitted: number;
				}[];
			};
			admin_import_participants: {
				Args: { p_reason?: string; p_rows: Json; p_source?: string };
				Returns: Json;
			};
			admin_reopen_submission: {
				Args: { p_reason: string; p_submission_id: string };
				Returns: undefined;
			};
			admin_reset_event_data: { Args: { p_confirm: string }; Returns: Json };
			admin_save_criterion: {
				Args: {
					p_description: string;
					p_display_order: number;
					p_event_id: string;
					p_id: string;
					p_is_active: boolean;
					p_max_marks: number;
					p_name: string;
					p_reason?: string;
				};
				Returns: string;
			};
			admin_save_event: {
				Args: {
					p_code: string;
					p_description: string;
					p_display_order: number;
					p_group_id: string;
					p_id: string;
					p_instructions: string;
					p_is_active: boolean;
					p_name: string;
					p_reason?: string;
					p_score_precision: number;
				};
				Returns: string;
			};
			admin_set_assignment: {
				Args: { p_active: boolean; p_event_id: string; p_judge_id: string; p_reason?: string };
				Returns: string;
			};
			admin_set_event_participant: {
				Args: {
					p_active: boolean;
					p_event_id: string;
					p_participant_id: string;
					p_reason?: string;
				};
				Returns: string;
			};
			admin_set_participant_active: {
				Args: { p_active: boolean; p_participant_id: string; p_reason?: string };
				Returns: undefined;
			};
			admin_set_score: {
				Args: {
					p_criterion_id: string;
					p_participant_id: string;
					p_reason: string;
					p_submission_id: string;
					p_value: number;
				};
				Returns: Json;
			};
			apply_reason: { Args: { p_reason: string }; Returns: undefined };
			assert_admin: { Args: Record<PropertyKey, never>; Returns: undefined };
			create_account: {
				Args: {
					p_display_name: string;
					p_domain?: string;
					p_password: string;
					p_role?: Database['public']['Enums']['app_role'];
					p_username: string;
				};
				Returns: string;
			};
			create_correction_request: {
				Args: {
					p_criterion_ids: string[];
					p_message: string;
					p_participant_id: string;
					p_submission_id: string;
					p_unlock: boolean;
				};
				Returns: string;
			};
			current_reason: { Args: Record<PropertyKey, never>; Returns: string };
			event_has_scores: { Args: { p_event_id: string }; Returns: boolean };
			event_results_internal: { Args: { p_event_id: string }; Returns: Json };
			finalize_event_results: { Args: { p_event_id: string }; Returns: string };
			get_event_results: { Args: { p_event_id: string }; Returns: Json };
			in_reset_mode: { Args: Record<PropertyKey, never>; Returns: boolean };
			invalidate_finalization_internal: {
				Args: { p_event_id: string; p_reason: string };
				Returns: boolean;
			};
			is_active_judge: { Args: Record<PropertyKey, never>; Returns: boolean };
			is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
			is_assigned: { Args: { p_event_id: string }; Returns: boolean };
			is_editable_status: {
				Args: { p_status: Database['public']['Enums']['submission_status'] };
				Returns: boolean;
			};
			lock_own_submission: {
				Args: { p_submission_id: string };
				Returns: {
					created_at: string;
					event_id: string;
					id: string;
					judge_id: string;
					last_saved_at: string | null;
					round: number;
					status: Database['public']['Enums']['submission_status'];
					submitted_at: string | null;
					submitted_by: string | null;
					updated_at: string;
					version: number;
				};
				SetofOptions: {
					from: '*';
					to: 'submissions';
					isOneToOne: true;
					isSetofReturn: false;
				};
			};
			lock_submission_as_admin: {
				Args: { p_submission_id: string };
				Returns: {
					created_at: string;
					event_id: string;
					id: string;
					judge_id: string;
					last_saved_at: string | null;
					round: number;
					status: Database['public']['Enums']['submission_status'];
					submitted_at: string | null;
					submitted_by: string | null;
					updated_at: string;
					version: number;
				};
				SetofOptions: {
					from: '*';
					to: 'submissions';
					isOneToOne: true;
					isSetofReturn: false;
				};
			};
			log_audit: {
				Args: {
					p_action: string;
					p_actor_id?: string;
					p_entity_id?: string;
					p_entity_type?: string;
					p_event_id?: string;
					p_group_id?: string;
					p_judge_id?: string;
					p_metadata?: Json;
					p_new?: Json;
					p_old?: Json;
					p_participant_id?: string;
					p_reason?: string;
					p_request_id?: string;
					p_submission_id?: string;
				};
				Returns: undefined;
			};
			missing_count_internal: { Args: { p_submission_id: string }; Returns: number };
			owns_submission: { Args: { p_submission_id: string }; Returns: boolean };
			request_reopening: { Args: { p_reason: string; p_submission_id: string }; Returns: string };
			require_reason: { Args: { p_what: string }; Returns: undefined };
			resolve_correction_request: {
				Args: { p_cancel: boolean; p_note: string; p_request_id: string };
				Returns: undefined;
			};
			resolve_reopening_request: {
				Args: { p_approve: boolean; p_note: string; p_request_id: string };
				Returns: undefined;
			};
			resolve_tie: {
				Args: {
					p_event_id: string;
					p_participant_ids: string[];
					p_ranks: Json;
					p_reason: string;
					p_related_correction_ids?: string[];
				};
				Returns: string;
			};
			respond_correction_request: {
				Args: { p_request_id: string; p_response: string };
				Returns: undefined;
			};
			save_scores: { Args: { p_changes: Json; p_submission_id: string }; Returns: Json };
			service_create_profile: {
				Args: {
					p_actor: string;
					p_display_name: string;
					p_id: string;
					p_role: Database['public']['Enums']['app_role'];
					p_username: string;
				};
				Returns: undefined;
			};
			service_log_audit: {
				Args: {
					p_action: string;
					p_actor: string;
					p_entity_id?: string;
					p_entity_type?: string;
					p_judge_id?: string;
					p_metadata?: Json;
					p_reason?: string;
				};
				Returns: undefined;
			};
			service_update_profile: {
				Args: {
					p_actor: string;
					p_display_name: string;
					p_id: string;
					p_is_active: boolean;
					p_reason?: string;
				};
				Returns: undefined;
			};
			set_account_password: {
				Args: { p_password: string; p_username: string };
				Returns: undefined;
			};
			submission_missing_count: { Args: { p_submission_id: string }; Returns: number };
			submit_submission: {
				Args: { p_expected_version: number; p_submission_id: string };
				Returns: Json;
			};
			transition_submission: {
				Args: {
					p_reason?: string;
					p_request_id?: string;
					p_submission_id: string;
					p_to: Database['public']['Enums']['submission_status'];
				};
				Returns: undefined;
			};
			unfinalize_event_results: {
				Args: { p_event_id: string; p_reason: string };
				Returns: undefined;
			};
		};
		Enums: {
			app_role: 'admin' | 'judge';
			correction_status: 'open' | 'responded' | 'resolved' | 'cancelled';
			participant_kind: 'individual' | 'team';
			request_status: 'pending' | 'approved' | 'rejected' | 'cancelled';
			submission_status:
				| 'not_started'
				| 'in_progress'
				| 'submitted'
				| 'reopening_requested'
				| 'correction_requested'
				| 'reopened'
				| 'resubmitted';
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never) = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
	EnumName extends (DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never) = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never) = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	graphql_public: {
		Enums: {}
	},
	public: {
		Enums: {
			app_role: ['admin', 'judge'],
			correction_status: ['open', 'responded', 'resolved', 'cancelled'],
			participant_kind: ['individual', 'team'],
			request_status: ['pending', 'approved', 'rejected', 'cancelled'],
			submission_status: [
				'not_started',
				'in_progress',
				'submitted',
				'reopening_requested',
				'correction_requested',
				'reopened',
				'resubmitted'
			]
		}
	}
} as const;
