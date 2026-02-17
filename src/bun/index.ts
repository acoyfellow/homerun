import { BrowserView, BrowserWindow, Tray, Utils } from "electrobun/bun";
import { PROXY_PORT } from "../shared/constants";
import { createRecorder } from "./capture/recorder";
import { createInterceptor } from "./proxy/interceptor";
import { createProxyServer, type ProxyServer } from "./proxy/server";
import type { HomerunRPC } from "./types/rpc";

let proxyServer: ProxyServer | null = null;
const { interceptor, addHook } = createInterceptor();
const recorder = createRecorder();

addHook(recorder.interceptor);

const rpc = BrowserView.defineRPC<HomerunRPC>({
	maxRequestTime: 10_000,
	handlers: {
		requests: {
			getProxyStatus: () => {
				if (!proxyServer) {
					return {
						running: false,
						port: PROXY_PORT,
						requestCount: 0,
						activeConnections: 0,
						uptime: 0,
					};
				}
				return proxyServer.status;
			},
			startProxy: ({ port }) => {
				if (proxyServer) {
					return proxyServer.status;
				}
				proxyServer = createProxyServer({ port: port ?? PROXY_PORT, interceptor });
				console.log(`[homerun] Proxy started on :${proxyServer.port}`);
				return proxyServer.status;
			},
			stopProxy: () => {
				if (!proxyServer) return false;
				proxyServer.stop();
				proxyServer = null;
				console.log("[homerun] Proxy stopped");
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

const tray = new Tray({
	title: "homerun",
	width: 22,
	height: 22,
});

function updateTrayMenu() {
	const isRunning = proxyServer !== null;
	tray.setMenu([
		{
			type: "normal",
			label: isRunning ? `Proxy running on :${proxyServer?.port}` : "Proxy stopped",
			action: "status",
			enabled: false,
		},
		{ type: "divider" },
		{
			type: "normal",
			label: isRunning ? "Stop Proxy" : "Start Proxy",
			action: "toggle-proxy",
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
				proxyServer = createProxyServer({ port: PROXY_PORT, interceptor });
			}
			updateTrayMenu();
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
			Utils.quit();
			break;
		}
	}
});

mainWindow.on("close", () => {
	/* intentional no-op: app stays alive in system tray */
});

proxyServer = createProxyServer({ port: PROXY_PORT, interceptor });
console.log(`[homerun] Started. Proxy on :${proxyServer.port}`);
updateTrayMenu();
