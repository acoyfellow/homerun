export const Events = {
	PROXY_STARTED: "proxy:started",
	PROXY_STOPPED: "proxy:stopped",
	PROXY_ERROR: "proxy:error",
	PROXY_REQUEST: "proxy:request",
	PROXY_RESPONSE: "proxy:response",
	CAPTURE_STARTED: "capture:started",
	CAPTURE_STOPPED: "capture:stopped",
	CAPTURE_ENTRY: "capture:entry",
	SESSION_CREATED: "session:created",
	SESSION_UPDATED: "session:updated",
	SESSION_DELETED: "session:deleted",
	FORM_RECORDED: "form:recorded",
	FORM_REPLAYED: "form:replayed",
	SPEC_GENERATED: "spec:generated",
} as const;

export type EventName = (typeof Events)[keyof typeof Events];
