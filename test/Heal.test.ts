import { Effect, Layer, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { CapturedEndpoint } from "../src/domain/Endpoint.js";
import { NetworkEvent } from "../src/domain/NetworkEvent.js";
import type { ScoutedPath } from "../src/domain/Path.js";
import { Browser, makeTestBrowserWithEvents } from "../src/services/Browser.js";
import { makeOpenApiGenerator, OpenApiGenerator } from "../src/services/OpenApiGenerator.js";
import { makeSchemaInferrer, SchemaInferrer } from "../src/services/SchemaInferrer.js";
import { makeTestStore, Store } from "../src/services/Store.js";
import { heal } from "../src/tools/Heal.js";

// ==================== Helpers ====================

function seedBrokenStore() {
	const store = makeTestStore();

	Effect.runSync(
		store.saveSite({
			id: "site-1",
			url: "https://api.example.com",
			domain: "api.example.com",
			firstScoutedAt: "2025-01-01T00:00:00Z",
			lastScoutedAt: "2025-01-01T00:00:00Z",
		}),
	);

	Effect.runSync(
		store.saveEndpoints([
			{
				id: "ep-1",
				siteId: "site-1",
				method: "GET",
				pathPattern: "https://api.example.com/users",
				requestSchema: Option.none(),
				responseSchema: Option.some({ type: "array" }),
				sampleCount: 1,
				firstSeenAt: "2025-01-01T00:00:00Z",
				lastSeenAt: "2025-01-01T00:00:00Z",
			} as CapturedEndpoint,
		]),
	);

	Effect.runSync(
		store.savePath({
			id: "path-broken",
			siteId: "site-1",
			task: "get users",
			steps: [{ action: "navigate", url: "https://api.example.com" }],
			endpointIds: ["ep-1"],
			status: "broken",
			createdAt: "2025-01-01T00:00:00Z",
			lastUsedAt: Option.none(),
			failCount: 1,
			healCount: 0,
		} as ScoutedPath),
	);

	return store;
}

function makeScoutEvents(): NetworkEvent[] {
	return [
		new NetworkEvent({
			requestId: "r1",
			url: "https://api.example.com/users",
			method: "GET",
			resourceType: "fetch",
			requestHeaders: {},
			responseStatus: 200,
			responseHeaders: { "content-type": "application/json" },
			responseBody: JSON.stringify([{ id: 1, name: "Alice" }]),
			timestamp: Date.now(),
		}),
	];
}

function buildLayer(store: ReturnType<typeof makeTestStore>, events: NetworkEvent[]) {
	return Layer.mergeAll(
		Layer.succeed(Browser, makeTestBrowserWithEvents(events)),
		Layer.succeed(Store, store),
		Layer.succeed(SchemaInferrer, makeSchemaInferrer()),
		Layer.succeed(OpenApiGenerator, makeOpenApiGenerator()),
	);
}

// ==================== Tests ====================

describe("Heal", () => {
	it("heals via retry if worker succeeds on retry", async () => {
		const store = seedBrokenStore();

		// Worker will succeed (mock fetch)
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify([{ id: 1 }]), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			),
		);

		const layer = buildLayer(store, makeScoutEvents());
		const result = await Effect.runPromise(Effect.provide(heal({ pathId: "path-broken" }), layer));

		expect(result.healed).toBe(true);
		// No new path needed — retry was enough
		expect(result.newPathId).toBeUndefined();

		vi.unstubAllGlobals();
	});

	it("re-scouts when retries fail, then succeeds", async () => {
		const store = seedBrokenStore();
		let callCount = 0;

		// First 3 calls fail (retry exhaustion), then succeed (re-scouted worker)
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(() => {
				callCount++;
				if (callCount <= 3) {
					return Promise.resolve(new Response("Server Error", { status: 500 }));
				}
				return Promise.resolve(
					new Response(JSON.stringify({ ok: true }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);
			}),
		);

		const layer = buildLayer(store, makeScoutEvents());
		const result = await Effect.runPromise(Effect.provide(heal({ pathId: "path-broken" }), layer));

		expect(result.healed).toBe(true);
		expect(result.newPathId).toBeTruthy();

		vi.unstubAllGlobals();
	});

	it("returns healed:false when everything fails", async () => {
		const store = seedBrokenStore();

		// All calls fail
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("Server Error", { status: 500 })),
		);

		const layer = buildLayer(store, makeScoutEvents());
		const result = await Effect.runPromise(Effect.provide(heal({ pathId: "path-broken" }), layer));

		expect(result.healed).toBe(false);

		// Path should still be broken
		const path = await Effect.runPromise(store.getPath("path-broken"));
		expect(path.status).toBe("broken");

		vi.unstubAllGlobals();
	});

	it("increments healCount", async () => {
		const store = seedBrokenStore();

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("Server Error", { status: 500 })),
		);

		const layer = buildLayer(store, makeScoutEvents());
		await Effect.runPromise(Effect.provide(heal({ pathId: "path-broken" }), layer));

		const path = await Effect.runPromise(store.getPath("path-broken"));
		expect(path.healCount).toBe(1);

		vi.unstubAllGlobals();
	});
});
