import { Effect, Exit, Layer, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { CapturedEndpoint } from "../src/domain/Endpoint.js";
import type { ScoutedPath } from "../src/domain/Path.js";
import { Store, makeTestStore } from "../src/services/Store.js";
import { worker } from "../src/tools/Worker.js";

// ==================== Helpers ====================

function seedStore() {
	const store = makeTestStore();

	// Seed a site
	Effect.runSync(
		store.saveSite({
			id: "site-1",
			url: "https://api.example.com",
			domain: "api.example.com",
			firstScoutedAt: "2025-01-01T00:00:00Z",
			lastScoutedAt: "2025-01-01T00:00:00Z",
		}),
	);

	// Seed endpoints
	Effect.runSync(
		store.saveEndpoints([
			{
				id: "ep-get",
				siteId: "site-1",
				method: "GET",
				pathPattern: "https://api.example.com/users",
				requestSchema: Option.none(),
				responseSchema: Option.some({ type: "array" }),
				sampleCount: 1,
				firstSeenAt: "2025-01-01T00:00:00Z",
				lastSeenAt: "2025-01-01T00:00:00Z",
			} as CapturedEndpoint,
			{
				id: "ep-post",
				siteId: "site-1",
				method: "POST",
				pathPattern: "https://api.example.com/users",
				requestSchema: Option.some({ type: "object" }),
				responseSchema: Option.some({ type: "object" }),
				sampleCount: 1,
				firstSeenAt: "2025-01-01T00:00:00Z",
				lastSeenAt: "2025-01-01T00:00:00Z",
			} as CapturedEndpoint,
		]),
	);

	// Seed a path
	Effect.runSync(
		store.savePath({
			id: "path-1",
			siteId: "site-1",
			task: "get users",
			steps: [{ action: "navigate", url: "https://api.example.com" }],
			endpointIds: ["ep-get", "ep-post"],
			status: "active",
			createdAt: "2025-01-01T00:00:00Z",
			lastUsedAt: Option.none(),
			failCount: 0,
			healCount: 0,
		} as ScoutedPath),
	);

	return store;
}

function runWorker(
	store: ReturnType<typeof makeTestStore>,
	input: {
		pathId: string;
		data?: Record<string, unknown> | undefined;
		headers?: Record<string, string> | undefined;
	},
) {
	const layer = Layer.succeed(Store, store);
	return Effect.provide(worker(input), layer);
}

// ==================== Tests ====================

describe("Worker", () => {
	it("fails with NotFoundError for missing path", async () => {
		const store = makeTestStore();
		const exit = await Effect.runPromiseExit(runWorker(store, { pathId: "nonexistent" }));
		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("returns failure when path has no endpoints", async () => {
		const store = makeTestStore();

		// Save a path with no matching endpoints
		Effect.runSync(
			store.savePath({
				id: "empty-path",
				siteId: "site-empty",
				task: "nothing",
				steps: [],
				endpointIds: ["ep-nonexistent"],
				status: "active",
				createdAt: "2025-01-01T00:00:00Z",
				lastUsedAt: Option.none(),
				failCount: 0,
				healCount: 0,
			} as ScoutedPath),
		);

		const result = await Effect.runPromise(runWorker(store, { pathId: "empty-path" }));
		expect(result.success).toBe(false);
	});

	it("prefers GET when no data provided", async () => {
		const store = seedStore();

		// Mock fetch to capture what was called
		const fetchSpy = vi.fn().mockResolvedValue(
			new Response(JSON.stringify([{ id: 1 }]), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const result = await Effect.runPromise(runWorker(store, { pathId: "path-1" }));

		expect(result.success).toBe(true);
		expect(fetchSpy).toHaveBeenCalledOnce();

		const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(opts.method).toBe("GET");
		expect(url).toBe("https://api.example.com/users");

		vi.unstubAllGlobals();
	});

	it("prefers POST when data is provided", async () => {
		const store = seedStore();

		const fetchSpy = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ id: 42 }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const result = await Effect.runPromise(
			runWorker(store, {
				pathId: "path-1",
				data: { name: "Alice" },
			}),
		);

		expect(result.success).toBe(true);
		expect(fetchSpy).toHaveBeenCalledOnce();

		const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(opts.method).toBe("POST");
		expect(opts.body).toBe('{"name":"Alice"}');

		vi.unstubAllGlobals();
	});

	it("returns parsed JSON response", async () => {
		const store = seedStore();

		const responseData = [
			{ id: 1, name: "Alice" },
			{ id: 2, name: "Bob" },
		];
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify(responseData), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			),
		);

		const result = await Effect.runPromise(runWorker(store, { pathId: "path-1" }));

		expect(result.success).toBe(true);
		expect(result.response).toEqual(responseData);

		vi.unstubAllGlobals();
	});

	it("fails on HTTP error status", async () => {
		const store = seedStore();

		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(new Response("Not Found", { status: 404, statusText: "Not Found" })),
		);

		const exit = await Effect.runPromiseExit(runWorker(store, { pathId: "path-1" }));
		expect(Exit.isFailure(exit)).toBe(true);

		vi.unstubAllGlobals();
	});

	it("saves run history on success", async () => {
		const store = seedStore();

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			),
		);

		await Effect.runPromise(runWorker(store, { pathId: "path-1" }));
		// No throw = run was saved successfully

		vi.unstubAllGlobals();
	});

	it("passes custom headers to fetch", async () => {
		const store = seedStore();

		const fetchSpy = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ authenticated: true }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const result = await Effect.runPromise(
			runWorker(store, {
				pathId: "path-1",
				headers: {
					Authorization: "Bearer test-token",
					"X-Custom-Header": "custom-value",
					Cookie: "session=abc123",
				},
			}),
		);

		expect(result.success).toBe(true);
		expect(fetchSpy).toHaveBeenCalledOnce();

		const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
		const headers = opts.headers as Record<string, string>;

		expect(headers.Authorization).toBe("Bearer test-token");
		expect(headers["X-Custom-Header"]).toBe("custom-value");
		expect(headers.Cookie).toBe("session=abc123");
		// Default headers should still be present
		expect(headers.Accept).toBe("application/json");

		vi.unstubAllGlobals();
	});

	it("custom headers override default Accept header", async () => {
		const store = seedStore();

		const fetchSpy = vi.fn().mockResolvedValue(
			new Response("<html></html>", {
				status: 200,
				headers: { "content-type": "text/html" },
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await Effect.runPromise(
			runWorker(store, {
				pathId: "path-1",
				headers: {
					Accept: "text/html",
				},
			}),
		);

		const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
		const headers = opts.headers as Record<string, string>;

		// Custom Accept should override default
		expect(headers.Accept).toBe("text/html");

		vi.unstubAllGlobals();
	});
});
