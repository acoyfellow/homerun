import type { OpenApiSpec } from "./openapi";

export function mergeSpecs(specs: OpenApiSpec[]): OpenApiSpec | null {
	if (specs.length === 0) return null;
	if (specs.length === 1) return specs[0]!;

	const base = structuredClone(specs[0]!);

	for (let i = 1; i < specs.length; i++) {
		const spec = specs[i]!;
		for (const [path, methods] of Object.entries(spec.paths)) {
			if (!base.paths[path]) {
				base.paths[path] = methods;
			} else {
				Object.assign(base.paths[path]!, methods);
			}
		}
	}

	return base;
}
