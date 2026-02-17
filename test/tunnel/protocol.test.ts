import { describe, expect, test } from "bun:test";
import {
	encodeFrame,
	decodeFrame,
	encodeRequest,
	encodeResponse,
	encodePing,
	encodePong,
	encodeError,
} from "../../src/shared/tunnel/protocol";
import { TunnelMessageType } from "../../src/shared/tunnel/types";

describe("Tunnel Protocol", () => {
	describe("encodeFrame / decodeFrame", () => {
		test("round-trip REQUEST with JSON body", () => {
			const frame = encodeFrame({
				type: TunnelMessageType.REQUEST,
				requestId: 123,
				meta: { method: "POST", url: "https://example.com/api", headers: { "Content-Type": "application/json" } },
				body: new TextEncoder().encode('{"foo":"bar"}').buffer,
			});

			const decoded = decodeFrame(frame);

			expect(decoded.type).toBe(TunnelMessageType.REQUEST);
			expect(decoded.requestId).toBe(123);
			if (decoded.type === TunnelMessageType.REQUEST) {
				expect(decoded.meta.method).toBe("POST");
				expect(decoded.meta.url).toBe("https://example.com/api");
				expect(decoded.meta.headers["Content-Type"]).toBe("application/json");
				expect(decoded.body).not.toBeNull();
				const bodyText = new TextDecoder().decode(decoded.body!);
				expect(bodyText).toBe('{"foo":"bar"}');
			}
		});

		test("round-trip REQUEST with empty body", () => {
			const frame = encodeFrame({
				type: TunnelMessageType.REQUEST,
				requestId: 456,
				meta: { method: "GET", url: "https://example.com/", headers: {} },
				body: null,
			});

			const decoded = decodeFrame(frame);

			expect(decoded.type).toBe(TunnelMessageType.REQUEST);
			expect(decoded.requestId).toBe(456);
			if (decoded.type === TunnelMessageType.REQUEST) {
				expect(decoded.meta.method).toBe("GET");
				expect(decoded.body).toBeNull();
			}
		});

		test("round-trip RESPONSE status 200", () => {
			const frame = encodeFrame({
				type: TunnelMessageType.RESPONSE,
				requestId: 789,
				meta: { status: 200, statusText: "OK", headers: { "X-Custom": "value" } },
				body: new TextEncoder().encode("success").buffer,
			});

			const decoded = decodeFrame(frame);

			expect(decoded.type).toBe(TunnelMessageType.RESPONSE);
			if (decoded.type === TunnelMessageType.RESPONSE) {
				expect(decoded.meta.status).toBe(200);
				expect(decoded.meta.statusText).toBe("OK");
				expect(decoded.meta.headers["X-Custom"]).toBe("value");
			}
		});

		test("round-trip RESPONSE status 404", () => {
			const frame = encodeFrame({
				type: TunnelMessageType.RESPONSE,
				requestId: 100,
				meta: { status: 404, statusText: "Not Found", headers: {} },
				body: null,
			});

			const decoded = decodeFrame(frame);

			expect(decoded.type).toBe(TunnelMessageType.RESPONSE);
			if (decoded.type === TunnelMessageType.RESPONSE) {
				expect(decoded.meta.status).toBe(404);
			}
		});

		test("round-trip RESPONSE status 500", () => {
			const frame = encodeFrame({
				type: TunnelMessageType.RESPONSE,
				requestId: 101,
				meta: { status: 500, statusText: "Internal Server Error", headers: {} },
				body: null,
			});

			const decoded = decodeFrame(frame);

			if (decoded.type === TunnelMessageType.RESPONSE) {
				expect(decoded.meta.status).toBe(500);
			}
		});

		test("round-trip RESPONSE with large binary body (1MB)", () => {
			const largeBody = new Uint8Array(1024 * 1024);
			for (let i = 0; i < largeBody.length; i++) {
				largeBody[i] = i % 256;
			}

			const frame = encodeFrame({
				type: TunnelMessageType.RESPONSE,
				requestId: 200,
				meta: { status: 200, statusText: "OK", headers: {} },
				body: largeBody.buffer,
			});

			const decoded = decodeFrame(frame);

			expect(decoded.type).toBe(TunnelMessageType.RESPONSE);
			if (decoded.type === TunnelMessageType.RESPONSE) {
				expect(decoded.body).not.toBeNull();
				expect(decoded.body!.byteLength).toBe(1024 * 1024);
				const resultBytes = new Uint8Array(decoded.body!);
				for (let i = 0; i < 100; i++) {
					expect(resultBytes[i]).toBe(i % 256);
				}
			}
		});

		test("PING frame is exactly 9 bytes", () => {
			const frame = encodeFrame({
				type: TunnelMessageType.PING,
				requestId: 1,
			});

			expect(frame.byteLength).toBe(9);
		});

		test("PONG frame is exactly 9 bytes", () => {
			const frame = encodeFrame({
				type: TunnelMessageType.PONG,
				requestId: 1,
			});

			expect(frame.byteLength).toBe(9);
		});

		test("round-trip PING", () => {
			const frame = encodeFrame({
				type: TunnelMessageType.PING,
				requestId: 999,
			});

			const decoded = decodeFrame(frame);

			expect(decoded.type).toBe(TunnelMessageType.PING);
			expect(decoded.requestId).toBe(999);
		});

		test("round-trip PONG", () => {
			const frame = encodeFrame({
				type: TunnelMessageType.PONG,
				requestId: 888,
			});

			const decoded = decodeFrame(frame);

			expect(decoded.type).toBe(TunnelMessageType.PONG);
			expect(decoded.requestId).toBe(888);
		});

		test("round-trip ERROR with message and code", () => {
			const frame = encodeFrame({
				type: TunnelMessageType.ERROR,
				requestId: 777,
				meta: { message: "Connection refused", code: "ECONNREFUSED" },
			});

			const decoded = decodeFrame(frame);

			expect(decoded.type).toBe(TunnelMessageType.ERROR);
			if (decoded.type === TunnelMessageType.ERROR) {
				expect(decoded.meta.message).toBe("Connection refused");
				expect(decoded.meta.code).toBe("ECONNREFUSED");
			}
		});

		test("preserves headers with special characters", () => {
			const frame = encodeFrame({
				type: TunnelMessageType.REQUEST,
				requestId: 1,
				meta: {
					method: "GET",
					url: "https://example.com/path?a=1&b=2",
					headers: { "X-Special": "value with spaces and \"quotes\"" },
				},
				body: null,
			});

			const decoded = decodeFrame(frame);

			if (decoded.type === TunnelMessageType.REQUEST) {
				expect(decoded.meta.headers["X-Special"]).toBe('value with spaces and "quotes"');
			}
		});

		test("handles URL with unicode characters", () => {
			const frame = encodeFrame({
				type: TunnelMessageType.REQUEST,
				requestId: 1,
				meta: {
					method: "GET",
					url: "https://example.com/路径/путь",
					headers: {},
				},
				body: null,
			});

			const decoded = decodeFrame(frame);

			if (decoded.type === TunnelMessageType.REQUEST) {
				expect(decoded.meta.url).toBe("https://example.com/路径/путь");
			}
		});

		test("handles body containing null bytes", () => {
			const bodyWithNulls = new Uint8Array([0, 1, 0, 2, 0, 0, 3]);
			const frame = encodeFrame({
				type: TunnelMessageType.RESPONSE,
				requestId: 1,
				meta: { status: 200, statusText: "OK", headers: {} },
				body: bodyWithNulls.buffer,
			});

			const decoded = decodeFrame(frame);

			if (decoded.type === TunnelMessageType.RESPONSE) {
				const resultBytes = new Uint8Array(decoded.body!);
				expect(resultBytes[0]).toBe(0);
				expect(resultBytes[1]).toBe(1);
				expect(resultBytes[2]).toBe(0);
				expect(resultBytes[6]).toBe(3);
			}
		});

		test("request ID at boundary values (0, 1, max)", () => {
			for (const id of [0, 1, 0xffffffff]) {
				const frame = encodeFrame({
					type: TunnelMessageType.PING,
					requestId: id,
				});

				const decoded = decodeFrame(frame);
				expect(decoded.requestId).toBe(id);
			}
		});
	});

	describe("convenience functions", () => {
		test("encodeRequest", () => {
			const frame = encodeRequest(1, "POST", "https://api.example.com", { "X-Auth": "token" }, null);
			const decoded = decodeFrame(frame);

			expect(decoded.type).toBe(TunnelMessageType.REQUEST);
			if (decoded.type === TunnelMessageType.REQUEST) {
				expect(decoded.meta.method).toBe("POST");
				expect(decoded.meta.url).toBe("https://api.example.com");
				expect(decoded.meta.headers["X-Auth"]).toBe("token");
			}
		});

		test("encodeResponse", () => {
			const body = new TextEncoder().encode("hello").buffer;
			const frame = encodeResponse(2, 201, "Created", { Location: "/resource/1" }, body);
			const decoded = decodeFrame(frame);

			expect(decoded.type).toBe(TunnelMessageType.RESPONSE);
			if (decoded.type === TunnelMessageType.RESPONSE) {
				expect(decoded.meta.status).toBe(201);
				expect(decoded.meta.statusText).toBe("Created");
				expect(decoded.meta.headers.Location).toBe("/resource/1");
			}
		});

		test("encodePing / encodePong", () => {
			const ping = encodePing(42);
			const pong = encodePong(42);

			expect(ping.byteLength).toBe(9);
			expect(pong.byteLength).toBe(9);

			const decodedPing = decodeFrame(ping);
			const decodedPong = decodeFrame(pong);

			expect(decodedPing.type).toBe(TunnelMessageType.PING);
			expect(decodedPong.type).toBe(TunnelMessageType.PONG);
		});

		test("encodeError", () => {
			const frame = encodeError(3, "Timeout", "ETIMEDOUT");
			const decoded = decodeFrame(frame);

			expect(decoded.type).toBe(TunnelMessageType.ERROR);
			if (decoded.type === TunnelMessageType.ERROR) {
				expect(decoded.meta.message).toBe("Timeout");
				expect(decoded.meta.code).toBe("ETIMEDOUT");
			}
		});
	});
});
