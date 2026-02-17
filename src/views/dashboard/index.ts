import { Electroview } from "electrobun/view";
import type { HomerunRPC } from "../../bun/types/rpc";
import type { TunnelStatus } from "../../shared/types";

const rpc = Electroview.defineRPC<HomerunRPC>({
	maxRequestTime: 10_000,
	handlers: {
		requests: {},
		messages: {
			proxyStatusChanged: (status) => {
				updateStatusUI(status.running, status.port, status.requestCount);
			},
			trafficEntry: (exchange) => {
				appendTrafficEntry(exchange.request.method, exchange.request.url, exchange.response.status);
			},
			sessionUpdated: () => {},
			tunnelStatusChanged: (status) => {
				updateTunnelUI(status);
			},
		},
	},
});

const _electrobun = new Electroview({ rpc });

const toggleBtn = document.getElementById("toggle-proxy") as HTMLButtonElement;
const statusBadge = document.getElementById("proxy-status") as HTMLDivElement;
const portDisplay = document.getElementById("port-display") as HTMLSpanElement;
const requestCountEl = document.getElementById("request-count") as HTMLSpanElement;
const entriesEl = document.getElementById("entries") as HTMLDivElement;

const tunnelApiKeyInput = document.getElementById("tunnel-apikey") as HTMLInputElement;
const tunnelUpstreamInput = document.getElementById("tunnel-upstream") as HTMLInputElement;
const toggleTunnelBtn = document.getElementById("toggle-tunnel") as HTMLButtonElement;
const tunnelInfoEl = document.getElementById("tunnel-info") as HTMLDivElement;
const tunnelStateDot = document.getElementById("tunnel-state-dot") as HTMLSpanElement;
const tunnelStateText = document.getElementById("tunnel-state-text") as HTMLSpanElement;
const tunnelUrlEl = document.getElementById("tunnel-url") as HTMLElement;
const copyTunnelUrlBtn = document.getElementById("copy-tunnel-url") as HTMLButtonElement;
const tunnelRequestsEl = document.getElementById("tunnel-requests") as HTMLSpanElement;

let proxyRunning = false;
let tunnelRunning = false;

toggleBtn.addEventListener("click", async () => {
	if (proxyRunning) {
		await rpc.request.stopProxy({});
		proxyRunning = false;
	} else {
		const status = await rpc.request.startProxy({});
		proxyRunning = true;
		updateStatusUI(status.running, status.port, status.requestCount);
	}
	updateToggleButton();
});

toggleTunnelBtn.addEventListener("click", async () => {
	if (tunnelRunning) {
		await rpc.request.stopTunnel({});
		tunnelRunning = false;
		updateTunnelUI({ state: "disconnected" } as TunnelStatus);
	} else {
		const apiKey = tunnelApiKeyInput.value.trim();
		if (!apiKey) {
			alert("API Key is required");
			return;
		}
		const upstream = tunnelUpstreamInput.value.trim() || undefined;
		const params: { apiKey: string; upstream?: string } = { apiKey };
		if (upstream) {
			params.upstream = upstream;
		}
		const status = await rpc.request.startTunnel(params as any);
		tunnelRunning = status.state === "connected" || status.state === "connecting";
		updateTunnelUI(status);
	}
	updateTunnelButton();
});

copyTunnelUrlBtn.addEventListener("click", async () => {
	const url = tunnelUrlEl.textContent;
	if (url) {
		await navigator.clipboard.writeText(url);
		copyTunnelUrlBtn.textContent = "Copied!";
		setTimeout(() => {
			copyTunnelUrlBtn.textContent = "Copy";
		}, 2000);
	}
});

async function init() {
	const status = await rpc.request.getProxyStatus({});
	proxyRunning = status.running;
	updateStatusUI(status.running, status.port, status.requestCount);
	updateToggleButton();

	const tunnelStatus = await rpc.request.getTunnelStatus({});
	tunnelRunning = tunnelStatus.state === "connected" || tunnelStatus.state === "connecting";
	updateTunnelUI(tunnelStatus);
	updateTunnelButton();
}

function updateStatusUI(running: boolean, port: number, requests: number) {
	statusBadge.textContent = running ? "Running" : "Stopped";
	statusBadge.className = `status-badge ${running ? "running" : "stopped"}`;
	portDisplay.textContent = `Port: ${port}`;
	requestCountEl.textContent = `Requests: ${requests}`;
}

function updateToggleButton() {
	toggleBtn.textContent = proxyRunning ? "Stop Proxy" : "Start Proxy";
}

function updateTunnelUI(status: TunnelStatus) {
	const state = status.state;
	tunnelStateText.textContent = state.charAt(0).toUpperCase() + state.slice(1);
	tunnelStateDot.className = `state-dot state-${state}`;

	if (state === "connected" && status.tunnelUrl) {
		tunnelInfoEl.classList.remove("hidden");
		tunnelUrlEl.textContent = status.tunnelUrl;
		tunnelRequestsEl.textContent = `Proxied: ${status.requestsProxied}`;
	} else if (state === "connecting" || state === "reconnecting") {
		tunnelInfoEl.classList.remove("hidden");
		tunnelUrlEl.textContent = state === "connecting" ? "Connecting..." : "Reconnecting...";
	} else {
		tunnelInfoEl.classList.add("hidden");
	}

	tunnelRunning = state === "connected" || state === "connecting" || state === "reconnecting";
	updateTunnelButton();
}

function updateTunnelButton() {
	if (tunnelRunning) {
		toggleTunnelBtn.textContent = "Stop Tunnel";
		tunnelApiKeyInput.disabled = true;
		tunnelUpstreamInput.disabled = true;
	} else {
		toggleTunnelBtn.textContent = "Start Tunnel";
		tunnelApiKeyInput.disabled = false;
		tunnelUpstreamInput.disabled = false;
	}
}

function appendTrafficEntry(method: string, url: string, status: number) {
	const entry = document.createElement("div");
	entry.className = "traffic-entry";
	entry.innerHTML = `<span class="method">${method}</span> <span class="url">${url}</span> <span class="status status-${Math.floor(status / 100)}xx">${status}</span>`;
	entriesEl.prepend(entry);
}

init();
