import { Electroview } from "electrobun/view";
import type { HomerunRPC } from "../../bun/types/rpc";

const rpc = Electroview.defineRPC<HomerunRPC>({
	maxRequestTime: 10_000,
	handlers: {
		requests: {},
		messages: {
			proxyStatusChanged: () => {},
			trafficEntry: (exchange) => {
				appendEntry(exchange);
			},
			sessionUpdated: () => {},
		},
	},
});

const _electrobun = new Electroview({ rpc });

interface TrafficExchange {
	request: { method: string; url: string; headers: Record<string, string> };
	response: { status: number; statusText: string; headers: Record<string, string> };
}

const requestList = document.getElementById("request-list") as HTMLDivElement;
const requestDetail = document.getElementById("request-detail") as HTMLDivElement;
const responseDetail = document.getElementById("response-detail") as HTMLDivElement;

function appendEntry(exchange: TrafficExchange) {
	const row = document.createElement("div");
	row.className = "entry-row";
	row.textContent = `${exchange.request.method} ${exchange.request.url} → ${exchange.response.status}`;
	row.addEventListener("click", () => showDetail(exchange));
	requestList.prepend(row);
}

function showDetail(exchange: TrafficExchange) {
	requestDetail.innerHTML = `<h3>Request</h3><pre>${JSON.stringify(exchange.request, null, 2)}</pre>`;
	responseDetail.innerHTML = `<h3>Response</h3><pre>${JSON.stringify(exchange.response, null, 2)}</pre>`;
}
