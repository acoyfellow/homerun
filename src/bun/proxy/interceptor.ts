import type { ProxyRequest, ProxyResponse } from "../../shared/types";

export interface Interceptor {
	onRequest?(request: ProxyRequest): Promise<void> | void;
	onResponse?(request: ProxyRequest, response: ProxyResponse): Promise<void> | void;
}

export function createInterceptor(): {
	interceptor: Interceptor;
	addHook(hook: Interceptor): () => void;
} {
	const hooks: Set<Interceptor> = new Set();

	const interceptor: Interceptor = {
		async onRequest(request) {
			for (const hook of hooks) {
				if (hook.onRequest) {
					await hook.onRequest(request);
				}
			}
		},
		async onResponse(request, response) {
			for (const hook of hooks) {
				if (hook.onResponse) {
					await hook.onResponse(request, response);
				}
			}
		},
	};

	function addHook(hook: Interceptor): () => void {
		hooks.add(hook);
		return () => {
			hooks.delete(hook);
		};
	}

	return { interceptor, addHook };
}
