export const TOOL_DEFINITIONS = {
	proxy_start: {
		name: "proxy_start",
		description: "Start the HTTP proxy server on localhost",
		inputSchema: {
			type: "object" as const,
			properties: {
				port: { type: "number", description: "Port to listen on (default: 8080)" },
			},
		},
	},
	proxy_stop: {
		name: "proxy_stop",
		description: "Stop the HTTP proxy server",
		inputSchema: { type: "object" as const, properties: {} },
	},
	capture_start: {
		name: "capture_start",
		description: "Begin capturing traffic for a domain",
		inputSchema: {
			type: "object" as const,
			properties: {
				domain: { type: "string", description: "Domain to capture traffic for" },
			},
		},
	},
	capture_stop: {
		name: "capture_stop",
		description: "Stop capturing traffic and return summary",
		inputSchema: { type: "object" as const, properties: {} },
	},
	get_openapi_spec: {
		name: "get_openapi_spec",
		description: "Generate OpenAPI spec from captured traffic",
		inputSchema: {
			type: "object" as const,
			properties: {
				domain: { type: "string", description: "Domain to generate spec for" },
			},
			required: ["domain"],
		},
	},
	replay_form: {
		name: "replay_form",
		description: "Replay a recorded form sequence",
		inputSchema: {
			type: "object" as const,
			properties: {
				sequenceId: { type: "string", description: "ID of the form sequence to replay" },
				variables: {
					type: "object",
					description: "Variable substitutions for the replay",
					additionalProperties: { type: "string" },
				},
			},
			required: ["sequenceId"],
		},
	},
	list_sessions: {
		name: "list_sessions",
		description: "List all saved sessions",
		inputSchema: { type: "object" as const, properties: {} },
	},
	export_har: {
		name: "export_har",
		description: "Export captured traffic as HAR file",
		inputSchema: {
			type: "object" as const,
			properties: {
				sessionId: { type: "string", description: "Session ID to export" },
			},
			required: ["sessionId"],
		},
	},
} as const;
