import type { InferredSchema } from "./types";

export function inferSchema(value: unknown): InferredSchema {
	if (value === null) {
		return { type: "null" };
	}

	if (Array.isArray(value)) {
		const items = value.length > 0 ? inferSchema(value[0]) : { type: "unknown" };
		return { type: "array", items };
	}

	switch (typeof value) {
		case "string":
			return { type: "string", format: detectStringFormat(value), example: value };
		case "number":
			return {
				type: Number.isInteger(value) ? "integer" : "number",
				example: value,
			};
		case "boolean":
			return { type: "boolean", example: value };
		case "object": {
			const properties: Record<string, InferredSchema> = {};
			const required: string[] = [];
			for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
				properties[key] = inferSchema(val);
				if (val !== undefined) {
					required.push(key);
				}
			}
			return { type: "object", properties, required };
		}
		default:
			return { type: "string" };
	}
}

function detectStringFormat(value: string): string | undefined {
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return "date-time";
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
	if (/^[^@]+@[^@]+\.[^@]+$/.test(value)) return "email";
	if (/^https?:\/\//.test(value)) return "uri";
	if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return "uuid";
	return undefined;
}
