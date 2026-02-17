import type { RPCSchema } from "electrobun/bun";
import type { CapturedExchange, ProxyStatus, Session, TunnelStatus } from "../../shared/types";

export interface HomerunRPC {
	bun: RPCSchema<{
		requests: {
			getProxyStatus: { params: Record<string, never>; response: ProxyStatus };
			startProxy: { params: { port?: number }; response: ProxyStatus };
			stopProxy: { params: Record<string, never>; response: boolean };
			listSessions: { params: Record<string, never>; response: Session[] };
			getSession: { params: { id: string }; response: Session | null };
			startCapture: { params: { domain?: string }; response: boolean };
			stopCapture: { params: Record<string, never>; response: number };
			getTunnelStatus: { params: Record<string, never>; response: TunnelStatus };
			startTunnel: { params: { apiKey: string; tunnelId?: string; upstream?: string; relayUrl?: string }; response: TunnelStatus };
			stopTunnel: { params: Record<string, never>; response: boolean };
		};
		messages: {
			logToBun: { msg: string };
		};
	}>;
	webview: RPCSchema<{
		requests: Record<string, never>;
		messages: {
			proxyStatusChanged: ProxyStatus;
			trafficEntry: CapturedExchange;
			sessionUpdated: Session;
			tunnelStatusChanged: TunnelStatus;
		};
	}>;
}
