import type { HarLog } from "../capture/har";
import { inferSchema } from "./inferrer";
import type { InferredEndpoint, InferredSchema } from "./types";

export interface OpenApiSpec {
	openapi: string;
	info: { title: string; version: string };
	servers: Array<{ url: string }>;
	paths: Record<string, Record<string, OpenApiOperation>>;
}

interface OpenApiOperation {
	summary: string;
	parameters?: OpenApiParameter[];
	requestBody?: { content: Record<string, { schema: InferredSchema }> };
	responses: Record<
		string,
		{ description: string; content?: Record<string, { schema: InferredSchema }> }
	>;
}

interface OpenApiParameter {
	name: string;
	in: "query" | "path" | "header";
	schema: InferredSchema;
	required: boolean;
}

export function generateOpenApi(harLog: HarLog, domain: string): OpenApiSpec {
	const endpoints = extractEndpoints(harLog);

	const paths: OpenApiSpec["paths"] = {};

	for (const endpoint of endpoints) {
		const pathKey = endpoint.path;
		if (!paths[pathKey]) {
			paths[pathKey] = {};
		}

		const operation: OpenApiOperation = {
			summary: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
			responses: {},
		};

		const queryParams = Object.entries(endpoint.queryParams);
		if (queryParams.length > 0) {
			operation.parameters = queryParams.map(([name, schema]) => ({
				name,
				in: "query" as const,
				schema,
				required: false,
			}));
		}

		if (endpoint.requestBody) {
			operation.requestBody = {
				content: { [endpoint.contentType]: { schema: endpoint.requestBody } },
			};
		}

		for (const status of endpoint.responseStatus) {
			if (endpoint.responseBody) {
				operation.responses[String(status)] = {
					description: `${status} response`,
					content: { [endpoint.contentType]: { schema: endpoint.responseBody } },
				};
			} else {
				operation.responses[String(status)] = {
					description: `${status} response`,
				};
			}
		}

		paths[pathKey]![endpoint.method.toLowerCase()] = operation;
	}

	return {
		openapi: "3.1.0",
		info: { title: `${domain} API`, version: "1.0.0" },
		servers: [{ url: `https://${domain}` }],
		paths,
	};
}

function extractEndpoints(harLog: HarLog): InferredEndpoint[] {
	const endpointMap = new Map<string, InferredEndpoint>();

	for (const entry of harLog.entries) {
		const url = new URL(entry.request.url);
		const key = `${entry.request.method}:${url.pathname}`;

		if (!endpointMap.has(key)) {
			const queryParams: Record<string, InferredSchema> = {};
			for (const param of entry.request.queryString) {
				queryParams[param.name] = inferSchema(param.value);
			}

			let responseBody: InferredSchema | undefined;
			if (entry.response.content.text) {
				try {
					responseBody = inferSchema(JSON.parse(entry.response.content.text));
				} catch {
					responseBody = { type: "string" };
				}
			}

			let requestBody: InferredSchema | undefined;
			if (entry.request.postData?.text) {
				try {
					requestBody = inferSchema(JSON.parse(entry.request.postData.text));
				} catch {
					requestBody = { type: "string" };
				}
			}

			endpointMap.set(key, {
				method: entry.request.method,
				path: url.pathname,
				pathParams: [],
				queryParams,
				requestBody,
				responseBody,
				responseStatus: [entry.response.status],
				contentType: entry.response.content.mimeType || "application/json",
				samples: 1,
			});
		} else {
			const existing = endpointMap.get(key)!;
			existing.samples++;
			if (!existing.responseStatus.includes(entry.response.status)) {
				existing.responseStatus.push(entry.response.status);
			}
		}
	}

	return Array.from(endpointMap.values());
}
