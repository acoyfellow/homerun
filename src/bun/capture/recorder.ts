import type { CapturedExchange, ProxyRequest } from "../../shared/types";
import type { Interceptor } from "../proxy/interceptor";
import type { CaptureFilter } from "./filter";
import { createHarLog, type HarEntry, type HarLog, headersToHar, queryParamsFromUrl } from "./har";

export interface TrafficRecorder {
	readonly harLog: HarLog;
	readonly entries: CapturedExchange[];
	readonly interceptor: Interceptor;
	clear(): void;
}

export function createRecorder(filter?: CaptureFilter): TrafficRecorder {
	const harLog = createHarLog();
	const entries: CapturedExchange[] = [];
	const pending = new Map<string, ProxyRequest>();

	const interceptor: Interceptor = {
		onRequest(request) {
			if (filter && !filter.matches(request.url)) {
				return;
			}
			pending.set(request.id, request);
		},

		onResponse(request, response) {
			if (!pending.has(request.id)) {
				return;
			}
			pending.delete(request.id);

			entries.push({ request, response });

			const decoder = new TextDecoder();
			const requestBody = request.body ? decoder.decode(request.body) : undefined;
			const responseBody = response.body ? decoder.decode(response.body) : undefined;

			const harEntry: HarEntry = {
				startedDateTime: new Date(request.timestamp).toISOString(),
				time: response.duration,
				request: {
					method: request.method,
					url: request.url,
					httpVersion: "HTTP/1.1",
					headers: headersToHar(request.headers),
					queryString: queryParamsFromUrl(request.url),
					bodySize: request.body?.byteLength ?? 0,
					postData: requestBody
						? {
								mimeType: request.headers["content-type"] || "application/octet-stream",
								text: requestBody,
							}
						: undefined,
				},
				response: {
					status: response.status,
					statusText: response.statusText,
					httpVersion: "HTTP/1.1",
					headers: headersToHar(response.headers),
					content: {
						size: response.body?.byteLength ?? 0,
						mimeType: response.headers["content-type"] || "application/octet-stream",
						text: responseBody,
					},
					bodySize: response.body?.byteLength ?? 0,
				},
				timings: {
					send: 0,
					wait: response.duration,
					receive: 0,
				},
			};

			harLog.entries.push(harEntry);
		},
	};

	return {
		get harLog() {
			return harLog;
		},
		get entries() {
			return entries;
		},
		get interceptor() {
			return interceptor;
		},
		clear() {
			harLog.entries.length = 0;
			entries.length = 0;
			pending.clear();
		},
	};
}
