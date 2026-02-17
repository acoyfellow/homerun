export const RESOURCE_TEMPLATES = {
	session: {
		uriTemplate: "session://{id}",
		name: "Session",
		description: "Session details including metadata and statistics",
		mimeType: "application/json",
	},
	traffic: {
		uriTemplate: "traffic://{session_id}",
		name: "Traffic",
		description: "Captured traffic entries for a session",
		mimeType: "application/json",
	},
	spec: {
		uriTemplate: "spec://{domain}",
		name: "OpenAPI Spec",
		description: "Generated OpenAPI specification for a domain",
		mimeType: "application/json",
	},
} as const;
