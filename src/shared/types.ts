export interface ProxyRequest {
	id: string;
	method: string;
	url: string;
	headers: Record<string, string>;
	body: ArrayBuffer | null;
	timestamp: number;
}

export interface ProxyResponse {
	id: string;
	requestId: string;
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: ArrayBuffer | null;
	timestamp: number;
	duration: number;
}

export interface CapturedExchange {
	request: ProxyRequest;
	response: ProxyResponse;
}

export interface Session {
	id: string;
	name: string;
	domain: string | undefined;
	createdAt: number;
	updatedAt: number;
}

export interface ProxyStatus {
	running: boolean;
	port: number;
	requestCount: number;
	activeConnections: number;
	uptime: number;
}

export interface CaptureFilter {
	domains: string[];
	methods: string[];
	contentTypes: string[];
	excludePaths: string[];
}

export interface FormAction {
	type: "submit" | "click" | "input" | "select";
	selector: string;
	value: string | undefined;
	url: string;
	method: string;
	timestamp: number;
}

export interface FormSequence {
	id: string;
	sessionId: string;
	name: string;
	actions: FormAction[];
	createdAt: number;
}

export { type TunnelStatus, type TunnelState, type TunnelConfig } from "./tunnel/types.js";
