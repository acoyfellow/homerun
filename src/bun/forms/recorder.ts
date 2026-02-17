import { nanoid } from "nanoid";
import type { Interceptor } from "../proxy/interceptor";
import type { FormAction, FormSequence } from "./types";

export interface FormRecorder {
	readonly interceptor: Interceptor;
	readonly sequences: FormSequence[];
	startRecording(sessionId: string, name: string): void;
	stopRecording(): FormSequence | null;
}

export function createFormRecorder(): FormRecorder {
	const sequences: FormSequence[] = [];
	let currentActions: FormAction[] | null = null;
	let currentSessionId: string | null = null;
	let currentName: string | null = null;

	const interceptor: Interceptor = {
		onRequest(request) {
			if (!currentActions) return;
			if (request.method === "POST" && request.headers["content-type"]?.includes("form")) {
				currentActions.push({
					type: "submit",
					selector: "",
					value: undefined,
					url: request.url,
					method: request.method,
					timestamp: request.timestamp,
				});
			}
		},
	};

	return {
		get interceptor() {
			return interceptor;
		},
		get sequences() {
			return sequences;
		},
		startRecording(sessionId, name) {
			currentActions = [];
			currentSessionId = sessionId;
			currentName = name;
		},
		stopRecording() {
			if (!currentActions || !currentSessionId || !currentName) return null;
			const sequence: FormSequence = {
				id: nanoid(),
				sessionId: currentSessionId,
				name: currentName,
				actions: currentActions,
				createdAt: Date.now(),
			};
			sequences.push(sequence);
			currentActions = null;
			currentSessionId = null;
			currentName = null;
			return sequence;
		},
	};
}
