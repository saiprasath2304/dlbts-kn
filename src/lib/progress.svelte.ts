import type { SubmitFunction } from '$app/forms';

/** Number of form submissions in flight; drives the top progress bar. */
export const progress = $state({ forms: 0 });

/**
 * use:enhance={withProgress()} - shows the progress bar immediately on submit,
 * keeps form values on validation errors, and always clears the bar.
 */
export function withProgress(
	opts: { reset?: boolean; onDone?: (type: string) => void } = {}
): SubmitFunction {
	return () => {
		progress.forms++;
		return async ({ result, update }) => {
			try {
				await update({ reset: opts.reset ?? result.type === 'success' });
				opts.onDone?.(result.type);
			} finally {
				progress.forms--;
			}
		};
	};
}
