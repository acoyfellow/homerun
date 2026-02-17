export interface InferredSchema {
	type: string;
	properties?: Record<string, InferredSchema> | undefined;
	items?: InferredSchema | undefined;
	enum?: unknown[] | undefined;
	required?: string[] | undefined;
	nullable?: boolean | undefined;
	format?: string | undefined;
	example?: unknown;
}

export interface InferredEndpoint {
	method: string;
	path: string;
	pathParams: string[];
	queryParams: Record<string, InferredSchema>;
	requestBody?: InferredSchema | undefined;
	responseBody?: InferredSchema | undefined;
	responseStatus: number[];
	contentType: string;
	samples: number;
}
