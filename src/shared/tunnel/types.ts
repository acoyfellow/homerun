export const enum TunnelMessageType {
	REQUEST = 0x01,
	RESPONSE = 0x02,
	PING = 0x03,
	PONG = 0x04,
	ERROR = 0x05,
}

export interface TunnelRequestMeta {
	method: string;
	url: string;
	headers: Record<string, string>;
}

export interface TunnelResponseMeta {
	status: number;
	statusText: string;
	headers: Record<string, string>;
}

export interface TunnelErrorMeta {
	message: string;
	code?: string | undefined;
}

export type TunnelFrame =
	| { type: TunnelMessageType.REQUEST; requestId: number; meta: TunnelRequestMeta; body: ArrayBuffer | null }
	| { type: TunnelMessageType.RESPONSE; requestId: number; meta: TunnelResponseMeta; body: ArrayBuffer | null }
	| { type: TunnelMessageType.PING; requestId: number }
	| { type: TunnelMessageType.PONG; requestId: number }
	| { type: TunnelMessageType.ERROR; requestId: number; meta: TunnelErrorMeta };

export interface TunnelConfig {
	relayUrl: string;
	apiKey: string;
	tunnelId?: string;
	upstream?: string;
}

export type TunnelState = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface TunnelStatus {
	state: TunnelState;
	tunnelId: string | null;
	tunnelUrl: string | null;
	relayUrl: string;
	connectedAt: number | null;
	requestsProxied: number;
	upstream: string | null;
}
