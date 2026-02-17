import { TunnelRelay } from "./relay";

export { TunnelRelay };

interface Env {
	TUNNEL_RELAY: DurableObjectNamespace;
	API_KEY: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		if (path === "/health") {
			return new Response(JSON.stringify({ status: "ok" }), {
				headers: { "Content-Type": "application/json" },
			});
		}

		const wsMatch = path.match(/^\/ws\/([^/]+)$/);
		if (wsMatch && request.headers.get("Upgrade") === "websocket") {
			const token = url.searchParams.get("token");
			if (!token || token !== env.API_KEY) {
				return new Response("Unauthorized", { status: 401 });
			}

			const tunnelId = wsMatch[1];
			const id = env.TUNNEL_RELAY.idFromName(tunnelId);
			const stub = env.TUNNEL_RELAY.get(id);

			const newUrl = new URL(request.url);
			newUrl.pathname = `/ws/${tunnelId}`;

			return stub.fetch(new Request(newUrl, request));
		}

		const tunnelMatch = path.match(/^\/([^/]+)(\/.*)?$/);
		if (tunnelMatch) {
			const tunnelId = tunnelMatch[1];
			const id = env.TUNNEL_RELAY.idFromName(tunnelId);
			const stub = env.TUNNEL_RELAY.get(id);

			return stub.fetch(request);
		}

		return new Response("Not Found", { status: 404 });
	},
};
