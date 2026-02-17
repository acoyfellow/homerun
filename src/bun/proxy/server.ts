import { nanoid } from "nanoid";
import { PROXY_PORT } from "../../shared/constants";
import type { ProxyRequest, ProxyResponse, ProxyStatus } from "../../shared/types";
import type { Interceptor } from "./interceptor";
import { handleConnect } from "./tunnel";

export interface ProxyServerOptions {
	port?: number | undefined;
	interceptor?: Interceptor | undefined;
}

export interface ProxyServer {
	readonly port: number;
	readonly status: ProxyStatus;
	stop(): void;
}

export function createProxyServer(options: ProxyServerOptions = {}): ProxyServer {
	const port = options.port ?? PROXY_PORT;
	const interceptor = options.interceptor;
	let requestCount = 0;
	let activeConnections = 0;
	const startTime = Date.now();

	const server = Bun.serve({
		port,
		async fetch(req) {
			const url = new URL(req.url);

			if (req.method === "CONNECT") {
				return handleConnect(req, url);
			}

			requestCount++;
			activeConnections++;

			try {
				const proxyReq: ProxyRequest = {
					id: nanoid(),
					method: req.method,
					url: req.url,
					headers: Object.fromEntries(req.headers.entries()),
					body: req.body ? await Bun.readableStreamToArrayBuffer(req.body) : null,
					timestamp: Date.now(),
				};

				if (interceptor?.onRequest) {
					await interceptor.onRequest(proxyReq);
				}

				const upstreamHeaders = new Headers(proxyReq.headers);
				upstreamHeaders.delete("proxy-connection");
				upstreamHeaders.delete("proxy-authorization");

				const upstreamRes = await fetch(proxyReq.url, {
					method: proxyReq.method,
					headers: upstreamHeaders,
					body: proxyReq.body,
				});

				const responseBody = await upstreamRes.arrayBuffer();

				const proxyRes: ProxyResponse = {
					id: nanoid(),
					requestId: proxyReq.id,
					status: upstreamRes.status,
					statusText: upstreamRes.statusText,
					headers: Object.fromEntries(upstreamRes.headers.entries()),
					body: responseBody,
					timestamp: Date.now(),
					duration: Date.now() - proxyReq.timestamp,
				};

				if (interceptor?.onResponse) {
					await interceptor.onResponse(proxyReq, proxyRes);
				}

				return new Response(proxyRes.body, {
					status: proxyRes.status,
					statusText: proxyRes.statusText,
					headers: proxyRes.headers,
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : "Proxy error";
				return new Response(message, { status: 502 });
			} finally {
				activeConnections--;
			}
		},
	});

	return {
		get port() {
			return server.port ?? port;
		},
		get status(): ProxyStatus {
			return {
				running: true,
				port: server.port ?? port,
				requestCount,
				activeConnections,
				uptime: Date.now() - startTime,
			};
		},
		stop() {
			server.stop();
		},
	};
}
