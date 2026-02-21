import { BrowserView, BrowserWindow, Tray, Utils } from "electrobun/bun";
import { PROXY_PORT } from "../shared/constants";
import type { CapturedExchange, ProxyStatus, TunnelConfig, TunnelStatus } from "../shared/types";
import { createRecorder } from "./capture/recorder";
import { createInterceptor } from "./proxy/interceptor";
import { type ProxyServer, createProxyServer } from "./proxy/server";
import { TunnelClient } from "./tunnel/client";
import type { HomerunRPC } from "./types/rpc";

let proxyServer: ProxyServer | null = null;
let tunnelClient: TunnelClient | null = null;
const { interceptor, addHook } = createInterceptor();
const recorder = createRecorder();

addHook(recorder.interceptor);

const disconnectedTunnelStatus: TunnelStatus = {
	state: "disconnected",
	tunnelId: null,
	tunnelUrl: null,
	relayUrl: "",
	connectedAt: null,
	requestsProxied: 0,
	upstream: null,
};

function stoppedProxyStatus(port = PROXY_PORT): ProxyStatus {
	return {
		running: false,
		port,
		requestCount: 0,
		activeConnections: 0,
		uptime: 0,
	};
}

function normalizeProxyStartError(error: unknown, port: number): string {
	const message = error instanceof Error ? error.message : String(error);
	if (message.includes("EADDRINUSE")) {
		return `Port ${port} is already in use`;
	}
	return message;
}

function tryStartProxy(port = PROXY_PORT): { status: ProxyStatus; error: string | null } {
	try {
		proxyServer = createProxyServer({ port, interceptor });
		console.log(`[homerun] Proxy started on :${proxyServer.port}`);
		return { status: proxyServer.status, error: null };
	} catch (error) {
		const message = normalizeProxyStartError(error, port);
		proxyServer = null;
		console.error(`[homerun] Failed to start proxy on :${port}: ${message}`);
		return { status: stoppedProxyStatus(port), error: message };
	}
}

function getProxyStatusSnapshot(): ProxyStatus {
	return proxyServer?.status ?? stoppedProxyStatus();
}

const rpc = BrowserView.defineRPC<HomerunRPC>({
	maxRequestTime: 10_000,
	handlers: {
		requests: {
			getProxyStatus: () => {
				if (!proxyServer) {
					return stoppedProxyStatus();
				}
				return proxyServer.status;
			},
			startProxy: ({ port }) => {
				if (proxyServer) {
					return proxyServer.status;
				}
				const requestedPort = port ?? PROXY_PORT;
				const result = tryStartProxy(requestedPort);
				if (result.error) {
					throw new Error(`Could not start proxy on port ${requestedPort}: ${result.error}`);
				}
				updateTrayMenu();
				emitProxyStatusChanged();
				return result.status;
			},
			stopProxy: () => {
				if (!proxyServer) return false;
				proxyServer.stop();
				proxyServer = null;
				console.log("[homerun] Proxy stopped");
				updateTrayMenu();
				emitProxyStatusChanged();
				return true;
			},
			listSessions: () => {
				return [];
			},
			getSession: () => {
				return null;
			},
			startCapture: () => {
				recorder.clear();
				return true;
			},
			stopCapture: () => {
				return recorder.entries.length;
			},
			getTunnelStatus: () => {
				return tunnelClient?.status ?? disconnectedTunnelStatus;
			},
			startTunnel: ({ apiKey, tunnelId, upstream, relayUrl }) => {
				if (tunnelClient) {
					return tunnelClient.status;
				}
				tunnelClient = new TunnelClient({
					apiKey,
					tunnelId,
					upstream,
					relayUrl,
				} as TunnelConfig);
				tunnelClient.onStateChange((status) => {
					updateTrayMenu();
					emitTunnelStatusChanged(status);
				});
				tunnelClient.connect();
				updateTrayMenu();
				emitTunnelStatusChanged(tunnelClient.status);
				return tunnelClient.status;
			},
			stopTunnel: () => {
				if (!tunnelClient) return false;
				tunnelClient.disconnect();
				tunnelClient = null;
				console.log("[homerun] Tunnel stopped");
				updateTrayMenu();
				emitTunnelStatusChanged();
				return true;
			},
		},
		messages: {
			logToBun: ({ msg }) => {
				console.log("[webview]", msg);
			},
		},
	},
});

const mainWindow = new BrowserWindow({
	title: "homerun",
	url: "views://dashboard/index.html",
	frame: { width: 1200, height: 800, x: 100, y: 100 },
	rpc,
});

function emitProxyStatusChanged() {
	mainWindow.webview.rpc.send.proxyStatusChanged(getProxyStatusSnapshot());
}

function emitTunnelStatusChanged(status = tunnelClient?.status ?? disconnectedTunnelStatus) {
	mainWindow.webview.rpc.send.tunnelStatusChanged(status);
}

function emitTrafficEntry(exchange: CapturedExchange) {
	mainWindow.webview.rpc.send.trafficEntry(exchange);
}

addHook({
	onRequest() {
		emitProxyStatusChanged();
	},
	onResponse(request, response) {
		emitTrafficEntry({ request, response });
		emitProxyStatusChanged();
	},
});

const tray = new Tray({
	title: "homerun",
	width: 22,
	height: 22,
});

function updateTrayMenu() {
	const isRunning = proxyServer !== null;
	const tunnelState = tunnelClient?.status.state ?? "disconnected";
	const tunnelLabel =
		tunnelState === "connected"
			? `Tunnel: ${tunnelClient?.status.tunnelId}`
			: `Tunnel: ${tunnelState}`;
	tray.setMenu([
		{
			type: "normal",
			label: isRunning ? `Proxy running on :${proxyServer?.port}` : "Proxy stopped",
			action: "status",
			enabled: false,
		},
		{
			type: "normal",
			label: isRunning ? "Stop Proxy" : "Start Proxy",
			action: "toggle-proxy",
		},
		{ type: "divider" },
		{
			type: "normal",
			label: tunnelLabel,
			action: "tunnel-status",
			enabled: false,
		},
		{
			type: "normal",
			label: tunnelState === "connected" ? "Stop Tunnel" : "Start Tunnel",
			action: "toggle-tunnel",
		},
		{ type: "divider" },
		{
			type: "normal",
			label: "Show Dashboard",
			action: "show-dashboard",
		},
		{ type: "divider" },
		{
			type: "normal",
			label: "Quit",
			action: "quit",
		},
	]);
}

tray.on("tray-clicked", () => {
	updateTrayMenu();
});

tray.on("tray-item-clicked" as any, (e: any) => {
	const action = e.data?.action as string;

	switch (action) {
		case "toggle-proxy": {
			if (proxyServer) {
				proxyServer.stop();
				proxyServer = null;
			} else {
				tryStartProxy(PROXY_PORT);
			}
			updateTrayMenu();
			emitProxyStatusChanged();
			break;
		}
		case "toggle-tunnel": {
			if (tunnelClient) {
				tunnelClient.disconnect();
				tunnelClient = null;
			} else {
				mainWindow.focus();
			}
			updateTrayMenu();
			emitTunnelStatusChanged();
			break;
		}
		case "show-dashboard": {
			mainWindow.focus();
			break;
		}
		case "quit": {
			if (proxyServer) {
				proxyServer.stop();
			}
			if (tunnelClient) {
				tunnelClient.disconnect();
			}
			Utils.quit();
			break;
		}
	}
});

mainWindow.on("close", () => {
	/* intentional no-op: app stays alive in system tray */
});

const startupProxyResult = tryStartProxy(PROXY_PORT);
if (startupProxyResult.error) {
	console.warn(
		"[homerun] App started without proxy. Start it from the dashboard once the port is available.",
	);
}
updateTrayMenu();
emitProxyStatusChanged();
emitTunnelStatusChanged();
