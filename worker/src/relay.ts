import { decodeFrame, encodeRequest, encodeError } from "@shared/tunnel/protocol";
import { TunnelMessageType, TUNNEL_REQUEST_TIMEOUT } from "@shared/tunnel/types";

interface PendingRequest {
	resolve: (response: Response) => void;
	reject: (error: Error) => void;
	timer: number;
}

export class TunnelRelay {
	private state: DurableObjectState;
	private ws: WebSocket | null = null;
	private upstream: string | null = null;
	private pending: Map<number, PendingRequest> = new Map();
	private nextRequestId = 1;

	constructor(state: DurableObjectState) {
		this.state = state;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (request.headers.get("Upgrade") === "websocket") {
			return this.handleWebSocketUpgrade(request, url);
		}

		return this.handleHttpRequest(request, url);
	}

	private async handleWebSocketUpgrade(request: Request, url: URL): Promise<Response> {
		if (this.ws) {
			this.ws.close(4000, "Replaced by new connection");
			this.rejectAllPending("Replaced by new connection");
		}

		const upstreamParam = url.searchParams.get("upstream");
		this.upstream = upstreamParam ? decodeURIComponent(upstreamParam) : null;

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		server.accept();
		this.ws = server;

		server.addEventListener("message", (event) => {
			if (event.data instanceof ArrayBuffer) {
				this.handleWebSocketMessage(event.data);
			}
		});

		server.addEventListener("close", () => {
			this.ws = null;
			this.rejectAllPending("Tunnel disconnected");
		});

		server.addEventListener("error", () => {
			this.ws = null;
			this.rejectAllPending("Tunnel error");
		});

		return new Response(null, { status: 101, webSocket: client });
	}

	private handleWebSocketMessage(data: ArrayBuffer): void {
		try {
			const frame = decodeFrame(data);

			if (frame.type === TunnelMessageType.RESPONSE) {
				const pending = this.pending.get(frame.requestId);
				if (pending) {
					clearTimeout(pending.timer);
					this.pending.delete(frame.requestId);

					const headers = new Headers(frame.meta.headers);
					pending.resolve(
						new Response(frame.body, {
							status: frame.meta.status,
							statusText: frame.meta.statusText,
							headers,
						}),
					);
				}
			} else if (frame.type === TunnelMessageType.ERROR) {
				const pending = this.pending.get(frame.requestId);
				if (pending) {
					clearTimeout(pending.timer);
					this.pending.delete(frame.requestId);
					pending.reject(new Error(frame.meta.message));
				}
			} else if (frame.type === TunnelMessageType.PONG) {
				// No action needed - PONG confirms tunnel is alive
			}
		} catch (error) {
			console.error("Error handling WebSocket message:", error);
		}
	}

	private async handleHttpRequest(request: Request, url: URL): Promise<Response> {
		if (!this.ws) {
			return new Response("Tunnel not connected", { status: 502 });
		}

		let targetUrl: string;

		if (this.upstream) {
			const pathPart = url.pathname.replace(/^\/[^/]+/, "") || "/";
			targetUrl = `${this.upstream}${pathPart}${url.search}`;
		} else {
			const tunnelTarget = request.headers.get("X-Tunnel-Target");
			if (!tunnelTarget) {
				return new Response("No target URL. Provide X-Tunnel-Target header or connect with upstream.", {
					status: 400,
				});
			}
			targetUrl = tunnelTarget;
		}

		const requestId = this.nextRequestId++;
		if (this.nextRequestId > 0xffffffff) {
			this.nextRequestId = 1;
		}

		const headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			if (!["host", "x-tunnel-target", "x-tunnel-key"].includes(key.toLowerCase())) {
				headers[key] = value;
			}
		});

		let body: ArrayBuffer | null = null;
		if (request.body) {
			body = await request.arrayBuffer();
		}

		const frame = encodeRequest(requestId, request.method, targetUrl, headers, body);
		this.ws.send(frame);

		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(requestId);
				reject(new Error("Request timeout"));
			}, TUNNEL_REQUEST_TIMEOUT);

			this.pending.set(requestId, {
				resolve,
				reject,
				timer: timer as unknown as number,
			});
		}).catch((error) => {
			return new Response(error.message, { status: 504 });
		}) as Promise<Response>;
	}

	private rejectAllPending(reason: string): void {
		for (const [requestId, pending] of this.pending) {
			clearTimeout(pending.timer);
			pending.reject(new Error(reason));
		}
		this.pending.clear();
	}
}
