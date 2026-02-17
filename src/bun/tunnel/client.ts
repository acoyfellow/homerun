import { nanoid } from "nanoid";
import {
	DEFAULT_RELAY_URL,
	TUNNEL_PING_INTERVAL,
	TUNNEL_PONG_TIMEOUT,
	TUNNEL_RECONNECT_BASE_DELAY,
	TUNNEL_RECONNECT_MAX_DELAY,
} from "../../shared/constants";
import { decodeFrame, encodePong, encodeResponse, encodeError } from "../../shared/tunnel/protocol";
import { TunnelMessageType, type TunnelConfig, type TunnelState, type TunnelStatus } from "../../shared/tunnel/types";

export class TunnelClient {
	private config: { relayUrl: string; apiKey: string; tunnelId: string; upstream?: string };
	private ws: WebSocket | null = null;
	private state: TunnelState = "disconnected";
	private tunnelId: string;
	private connectedAt: number | null = null;
	private requestsProxied = 0;
	private reconnectAttempt = 0;
	private reconnectTimer: Timer | null = null;
	private pingInterval: Timer | null = null;
	private pongTimeout: Timer | null = null;
	private intentionalClose = false;
	private stateChangeHandlers: Set<(status: TunnelStatus) => void> = new Set();
	private pendingPongs: Map<number, Timer> = new Map();
	private nextPingId = 1;

	constructor(config: TunnelConfig) {
		this.config = {
			relayUrl: config.relayUrl || DEFAULT_RELAY_URL,
			apiKey: config.apiKey,
			tunnelId: config.tunnelId || nanoid(12),
		};
		if (config.upstream) {
			this.config.upstream = config.upstream;
		}
		this.tunnelId = this.config.tunnelId;
	}

	get status(): TunnelStatus {
		return {
			state: this.state,
			tunnelId: this.state === "connected" ? this.tunnelId : null,
			tunnelUrl: this.state === "connected" ? this.buildTunnelUrl() : null,
			relayUrl: this.config.relayUrl,
			connectedAt: this.connectedAt,
			requestsProxied: this.requestsProxied,
			upstream: this.config.upstream || null,
		};
	}

	private buildTunnelUrl(): string {
		const relayBase = this.config.relayUrl.replace(/^wss?:\/\//, "https://").replace(/\/ws.*$/, "");
		return `${relayBase}/${this.tunnelId}/`;
	}

	onStateChange(handler: (status: TunnelStatus) => void): () => void {
		this.stateChangeHandlers.add(handler);
		return () => {
			this.stateChangeHandlers.delete(handler);
		};
	}

	private emitStateChange(): void {
		const status = this.status;
		for (const handler of this.stateChangeHandlers) {
			handler(status);
		}
	}

	private setState(newState: TunnelState): void {
		if (this.state !== newState) {
			this.state = newState;
			this.emitStateChange();
		}
	}

	connect(): void {
		if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
			return;
		}

		this.intentionalClose = false;
		this.setState("connecting");

		const wsUrl = new URL(`${this.config.relayUrl}/ws/${this.tunnelId}`);
		if (this.config.upstream) {
			wsUrl.searchParams.set("upstream", this.config.upstream);
		}
		wsUrl.searchParams.set("token", this.config.apiKey);

		this.ws = new WebSocket(wsUrl.toString());

		this.ws.binaryType = "arraybuffer";

		this.ws.onopen = () => {
			this.setState("connected");
			this.connectedAt = Date.now();
			this.reconnectAttempt = 0;
			this.startPingInterval();
			console.log(`[tunnel] Connected: ${this.buildTunnelUrl()}`);
		};

		this.ws.onmessage = async (event) => {
			if (!(event.data instanceof ArrayBuffer)) {
				console.error("[tunnel] Received non-binary message");
				return;
			}

			try {
				const frame = decodeFrame(event.data);

				if (frame.type === TunnelMessageType.REQUEST) {
					await this.handleRequest(frame);
				} else if (frame.type === TunnelMessageType.PING) {
					this.handlePing(frame.requestId);
				}
			} catch (error) {
				console.error("[tunnel] Error decoding frame:", error);
			}
		};

		this.ws.onclose = () => {
			this.stopPingInterval();
			this.clearPongTimeouts();

			if (!this.intentionalClose) {
				console.log("[tunnel] Disconnected unexpectedly, scheduling reconnect");
				this.setState("reconnecting");
				this.scheduleReconnect();
			} else {
				this.setState("disconnected");
				console.log("[tunnel] Disconnected");
			}
		};

		this.ws.onerror = (error) => {
			console.error("[tunnel] WebSocket error:", error);
		};
	}

	private async handleRequest(frame: { requestId: number; meta: { method: string; url: string; headers: Record<string, string> }; body: ArrayBuffer | null }): Promise<void> {
		const { requestId, meta, body } = frame;

		try {
			const fetchOptions: RequestInit = {
				method: meta.method,
				headers: meta.headers,
			};

			if (body) {
				fetchOptions.body = body;
			}

			const response = await fetch(meta.url, fetchOptions);
			const responseHeaders: Record<string, string> = {};
			response.headers.forEach((value, key) => {
				responseHeaders[key] = value;
			});

			const responseBody = response.body ? await new Response(response.body).arrayBuffer() : null;

			const responseFrame = encodeResponse(requestId, response.status, response.statusText, responseHeaders, responseBody);
			this.ws?.send(responseFrame);

			this.requestsProxied++;
			this.emitStateChange();
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error(`[tunnel] Request failed: ${message}`);
			const errorFrame = encodeError(requestId, message);
			this.ws?.send(errorFrame);
		}
	}

	private handlePing(pingId: number): void {
		const pongFrame = encodePong(pingId);
		this.ws?.send(pongFrame);
	}

	private startPingInterval(): void {
		this.stopPingInterval();

		this.pingInterval = setInterval(() => {
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
				return;
			}

			const pingId = this.nextPingId++;
			const pingFrame = new Uint8Array([
				TunnelMessageType.PING,
				(pingId >> 24) & 0xff,
				(pingId >> 16) & 0xff,
				(pingId >> 8) & 0xff,
				pingId & 0xff,
				0, 0, 0, 0,
			]);

			this.ws.send(pingFrame.buffer);

			const pongTimer = setTimeout(() => {
				console.warn("[tunnel] PONG timeout, forcing reconnect");
				this.ws?.close(4000, "PONG timeout");
			}, TUNNEL_PONG_TIMEOUT);

			this.pendingPongs.set(pingId, pongTimer);
		}, TUNNEL_PING_INTERVAL);
	}

	private stopPingInterval(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
	}

	private clearPongTimeouts(): void {
		for (const timer of this.pendingPongs.values()) {
			clearTimeout(timer);
		}
		this.pendingPongs.clear();
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
		}

		const delay = Math.min(
			TUNNEL_RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempt),
			TUNNEL_RECONNECT_MAX_DELAY,
		);
		const jitter = delay * (0.8 + Math.random() * 0.4);

		this.reconnectAttempt++;

		console.log(`[tunnel] Reconnecting in ${Math.round(jitter)}ms (attempt ${this.reconnectAttempt})`);

		this.reconnectTimer = setTimeout(() => {
			this.connect();
		}, jitter);
	}

	disconnect(): void {
		this.intentionalClose = true;

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		this.stopPingInterval();
		this.clearPongTimeouts();

		if (this.ws) {
			this.ws.close(1000, "Disconnect");
			this.ws = null;
		}

		this.connectedAt = null;
		this.setState("disconnected");
	}
}
