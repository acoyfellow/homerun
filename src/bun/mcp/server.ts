import { McpServer as McpServerClass } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { TrafficRecorder } from "../capture/recorder";
import { generateOpenApi } from "../discovery/openapi";
import type { ProxyServer } from "../proxy/server";
import type { SessionStore } from "../session/store";
import { TOOL_DEFINITIONS } from "./tools";

export interface McpServerContext {
	proxy: {
		server: ProxyServer | null;
		create: (port: number) => ProxyServer;
	};
	recorder: TrafficRecorder;
	sessionStore: SessionStore | null;
}

export interface HomerunMcpServer {
	start(): Promise<void>;
	stop(): Promise<void>;
}

export function createMcpServer(context: McpServerContext): HomerunMcpServer {
	const transport = new StdioServerTransport();
	const mcp = new McpServerClass(
		{
			name: "homerun",
			version: "0.1.0",
		},
		{
			capabilities: {
				tools: {},
				resources: {},
			},
		},
	);

	for (const [name, definition] of Object.entries(TOOL_DEFINITIONS)) {
		mcp.registerTool(
			name,
			{
				title: definition.name,
				description: definition.description,
				inputSchema: definition.inputSchema as any,
			},
			async (args: any) => {
				const result = await handleToolCall(name, args, context);
				return { content: result.content as any };
			},
		);
	}

	return {
		async start() {
			await mcp.connect(transport);
			console.log("[homerun] MCP server ready (stdio)");
		},

		async stop() {
			await mcp.close();
			console.log("[homerun] MCP server stopped");
		},
	};
}

async function handleToolCall(
	toolName: string,
	args: any,
	context: McpServerContext,
): Promise<{ content: Array<{ type: string; text: string }> }> {
	try {
		switch (toolName) {
			case "proxy_start": {
				const port = (args?.port as number) ?? 8080;
				if (!context.proxy.server) {
					context.proxy.server = context.proxy.create(port);
				}
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(context.proxy.server.status),
						},
					],
				};
			}

			case "proxy_stop": {
				if (context.proxy.server) {
					context.proxy.server.stop();
					context.proxy.server = null;
				}
				return {
					content: [{ type: "text", text: JSON.stringify({ success: true }) }],
				};
			}

			case "capture_start": {
				const domain = args?.domain as string | undefined;
				context.recorder.clear();
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ capturing: true, domain: domain ?? "all" }),
						},
					],
				};
			}

			case "capture_stop": {
				const entryCount = context.recorder.entries.length;
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ entries: entryCount }),
						},
					],
				};
			}

			case "get_openapi_spec": {
				const domain = args?.domain as string;
				if (!domain) {
					throw new Error("domain is required");
				}
				const spec = generateOpenApi(context.recorder.harLog, domain);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(spec),
						},
					],
				};
			}

			case "replay_form": {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ error: "replay_form not fully implemented" }),
						},
					],
				};
			}

			case "list_sessions": {
				const sessions = context.sessionStore?.listSessions() ?? [];
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(sessions),
						},
					],
				};
			}

			case "export_har": {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(context.recorder.harLog, null, 2),
						},
					],
				};
			}

			default:
				throw new Error(`Unknown tool: ${toolName}`);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify({ error: message }),
				},
			],
		};
	}
}
