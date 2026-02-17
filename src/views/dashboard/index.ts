import { Electroview } from "electrobun/view";
import type { HomerunRPC } from "../../bun/types/rpc";

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
		},
	},
});

const _electrobun = new Electroview({ rpc });

const toggleBtn = document.getElementById("toggle-proxy") as HTMLButtonElement;
const statusBadge = document.getElementById("proxy-status") as HTMLDivElement;
const portDisplay = document.getElementById("port-display") as HTMLSpanElement;
const requestCountEl = document.getElementById("request-count") as HTMLSpanElement;
const entriesEl = document.getElementById("entries") as HTMLDivElement;

let proxyRunning = false;

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

async function init() {
	const status = await rpc.request.getProxyStatus({});
	proxyRunning = status.running;
	updateStatusUI(status.running, status.port, status.requestCount);
	updateToggleButton();
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

function appendTrafficEntry(method: string, url: string, status: number) {
	const entry = document.createElement("div");
	entry.className = "traffic-entry";
	entry.innerHTML = `<span class="method">${method}</span> <span class="url">${url}</span> <span class="status status-${Math.floor(status / 100)}xx">${status}</span>`;
	entriesEl.prepend(entry);
}

init();
