import type { FormSequence } from "./types";

export interface ReplayResult {
	sequenceId: string;
	success: boolean;
	actionsExecuted: number;
	errors: string[];
}

export async function replaySequence(
	sequence: FormSequence,
	variables?: Record<string, string>,
): Promise<ReplayResult> {
	const errors: string[] = [];
	let actionsExecuted = 0;

	for (const action of sequence.actions) {
		try {
			let url = action.url;

			if (variables) {
				for (const [key, value] of Object.entries(variables)) {
					url = url.replaceAll(`{{${key}}}`, value);
				}
			}

			await fetch(url, {
				method: action.method,
			});
			actionsExecuted++;
		} catch (error) {
			errors.push(error instanceof Error ? error.message : "Unknown error");
		}
	}

	return {
		sequenceId: sequence.id,
		success: errors.length === 0,
		actionsExecuted,
		errors,
	};
}
