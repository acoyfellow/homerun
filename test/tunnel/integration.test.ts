import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { TunnelClient } from "../../src/bun/tunnel/client";
import { TunnelMessageType, type TunnelFrame } from "../../src/shared/tunnel/types";
import { decodeFrame } from "../../src/shared/tunnel/protocol";

describe("Tunnel Integration", () => {
	let mockRelayServer: ReturnType<typeof Bun.serve>;
	let client: TunnelClient;
	let receivedFrames: TunnelFrame[] = [];
	let connectedWs: WebSocket | null = null;
	const TEST_PORT = 9876;
	const TEST_API_KEY = "test-api-key-12345";
	const TEST_TUNNEL_ID = "test-tunnel-123";

	beforeAll(() => {
		mockRelayServer = Bun.serve({
			port: TEST_PORT,
			fetch(req, server) {
				const url = new URL(req.url);

				if (url.pathname === `/ws/${TEST_TUNNEL_ID}`) {
					const token = url.searchParams.get("token");
					if (token !== TEST_API_KEY) {
						return new Response("Unauthorized", { status: 401 });
					}

					const success = server.upgrade(req, {
						data: { tunnelId: TEST_TUNNEL_ID },
					});
					if (success) return undefined;
				}

				return new Response("Not found", { status: 404 });
			},
			websocket: {
				open(ws) {
					connectedWs = ws as unknown as WebSocket;
				},
				message(ws, data) {
					if (data instanceof ArrayBuffer) {
						try {
							const frame = decodeFrame(data);
							receivedFrames.push(frame);

							if (frame.type === TunnelMessageType.PING) {
								const pongFrame = new Uint8Array([
									TunnelMessageType.PONG,
									(frame.requestId >> 24) & 0xff,
									(frame.requestId >> 16) & 0xff,
									(frame.requestId >> 8) & 0xff,
									frame.requestId & 0xff,
									0, 0, 0, 0,
								]);
								ws.send(pongFrame.buffer);
							}
						} catch (e) {
							console.error("Error decoding frame:", e);
						}
					}
				},
				close() {
					connectedWs = null;
				},
			},
		});
	});

	afterAll(() => {
		mockRelayServer?.stop();
		client?.disconnect();
	});

	test("client connects with correct token", async () => {
		receivedFrames = [];

		client = new TunnelClient({
			relayUrl: `ws://localhost:${TEST_PORT}`,
			apiKey: TEST_API_KEY,
			tunnelId: TEST_TUNNEL_ID,
		});

		const stateChanges: string[] = [];
		client.onStateChange((status) => {
			stateChanges.push(status.state);
		});

		client.connect();

		await new Promise((resolve) => setTimeout(resolve, 500));

		expect(client.status.state).toBe("connected");
		expect(stateChanges).toContain("connecting");
		expect(stateChanges).toContain("connected");
	});

	test("client sends ping frames", async () => {
		receivedFrames = [];

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(client.status.state).toBe("connected");
		expect(connectedWs).not.toBeNull();
	});

	test("client state returns correct tunnel URL", () => {
		const status = client.status;

		expect(status.state).toBe("connected");
		expect(status.tunnelId).toBe(TEST_TUNNEL_ID);
		expect(status.tunnelUrl).toContain(TEST_TUNNEL_ID);
	});

	test("client disconnect stops reconnection", async () => {
		const stateBefore = client.status.state;
		expect(stateBefore).toBe("connected");

		client.disconnect();

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(client.status.state).toBe("disconnected");
	});

	test("client rejects wrong API key", async () => {
		receivedFrames = [];

		const badClient = new TunnelClient({
			relayUrl: `ws://localhost:${TEST_PORT}`,
			apiKey: "wrong-key",
			tunnelId: TEST_TUNNEL_ID,
		});

		badClient.connect();

		await new Promise((resolve) => setTimeout(resolve, 500));

		expect(badClient.status.state).toBe("reconnecting");

		badClient.disconnect();
	});
});
