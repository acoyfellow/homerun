import { MCP_PORT } from "../../shared/constants";

export interface McpServerOptions {
	port?: number | undefined;
}

export function createMcpServer(_options: McpServerOptions = {}) {
	const _port = _options.port ?? MCP_PORT;

	return {
		start() {
			console.log(`[homerun] MCP server ready`);
		},
		stop() {
			console.log("[homerun] MCP server stopped");
		},
	};
}
