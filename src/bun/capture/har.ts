export interface HarLog {
	version: string;
	creator: HarCreator;
	entries: HarEntry[];
}

export interface HarCreator {
	name: string;
	version: string;
}

export interface HarEntry {
	startedDateTime: string;
	time: number;
	request: HarRequest;
	response: HarResponse;
	timings: HarTimings;
}

export interface HarRequest {
	method: string;
	url: string;
	httpVersion: string;
	headers: HarHeader[];
	queryString: HarQueryParam[];
	bodySize: number;
	postData?: HarPostData | undefined;
}

export interface HarResponse {
	status: number;
	statusText: string;
	httpVersion: string;
	headers: HarHeader[];
	content: HarContent;
	bodySize: number;
}

export interface HarHeader {
	name: string;
	value: string;
}

export interface HarQueryParam {
	name: string;
	value: string;
}

export interface HarPostData {
	mimeType: string;
	text: string;
}

export interface HarContent {
	size: number;
	mimeType: string;
	text?: string | undefined;
}

export interface HarTimings {
	send: number;
	wait: number;
	receive: number;
}

export function createHarLog(): HarLog {
	return {
		version: "1.2",
		creator: { name: "homerun", version: "0.1.0" },
		entries: [],
	};
}

export function headersToHar(headers: Record<string, string>): HarHeader[] {
	return Object.entries(headers).map(([name, value]) => ({ name, value }));
}

export function queryParamsFromUrl(url: string): HarQueryParam[] {
	try {
		const parsed = new URL(url);
		return Array.from(parsed.searchParams.entries()).map(([name, value]) => ({
			name,
			value,
		}));
	} catch {
		return [];
	}
}
