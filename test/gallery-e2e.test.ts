import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { NetworkEvent } from "../src/domain/NetworkEvent.js";
import { Browser, makeTestBrowserWithEvents } from "../src/services/Browser.js";
import { Gallery, makeTestGallery } from "../src/services/Gallery.js";
import { OpenApiGenerator, makeOpenApiGenerator } from "../src/services/OpenApiGenerator.js";
import { SchemaInferrer, makeSchemaInferrer } from "../src/services/SchemaInferrer.js";
import { Store, makeTestStore } from "../src/services/Store.js";
import { scout } from "../src/tools/Scout.js";

// ==================== Test Fixtures ====================

function makeApiEvents(): NetworkEvent[] {
	return [
		new NetworkEvent({
			requestId: "req-1",
			url: "https://api.gallery-test.com/users",
			method: "GET",
			resourceType: "fetch",
			requestHeaders: { accept: "application/json" },
			responseStatus: 200,
			responseHeaders: { "content-type": "application/json" },
			responseBody: JSON.stringify([
				{ id: 1, name: "Alice" },
				{ id: 2, name: "Bob" },
			]),
			timestamp: Date.now(),
		}),
		new NetworkEvent({
			requestId: "req-2",
			url: "https://api.gallery-test.com/users/1",
			method: "GET",
			resourceType: "fetch",
			requestHeaders: { accept: "application/json" },
			responseStatus: 200,
			responseHeaders: { "content-type": "application/json" },
			responseBody: JSON.stringify({ id: 1, name: "Alice", email: "alice@test.com" }),
			timestamp: Date.now(),
		}),
		new NetworkEvent({
			requestId: "req-3",
			url: "https://api.gallery-test.com/posts",
			method: "POST",
			resourceType: "xhr",
			requestHeaders: { "content-type": "application/json" },
			requestBody: JSON.stringify({ title: "Hello", body: "World" }),
			responseStatus: 201,
			responseHeaders: { "content-type": "application/json" },
			responseBody: JSON.stringify({ id: 42, title: "Hello", body: "World" }),
			timestamp: Date.now(),
		}),
	];
}

function buildE2ELayer(events: NetworkEvent[]) {
	const testStore = makeTestStore();
	const testGallery = makeTestGallery(testStore);
	return {
		store: testStore,
		gallery: testGallery,
		layer: Layer.mergeAll(
			Layer.succeed(Browser, makeTestBrowserWithEvents(events)),
			Layer.succeed(Store, testStore),
			Layer.succeed(SchemaInferrer, makeSchemaInferrer()),
			Layer.succeed(OpenApiGenerator, makeOpenApiGenerator()),
			Layer.succeed(Gallery, testGallery),
		),
	};
}

// ==================== Tests ====================

describe("Gallery E2E", () => {
	it("scout → publish → search: full flow", async () => {
		const { gallery, layer } = buildE2ELayer(makeApiEvents());

		// 1. Scout a site (captures endpoints, publishes to gallery automatically)
		const scoutResult = await Effect.runPromise(
			Effect.provide(scout({ url: "https://api.gallery-test.com", task: "discover API" }), layer),
		);

		expect(scoutResult.siteId).toBeTruthy();
		expect(scoutResult.endpointCount).toBe(3);
		expect(scoutResult.fromGallery).toBeUndefined(); // First scout, not from gallery

		// 2. Search gallery by domain → verify the site appears
		const searchResults = await Effect.runPromise(gallery.search("", "api.gallery-test.com"));

		expect(searchResults.length).toBe(1);
		const entry = searchResults[0];
		expect(entry).toBeDefined();
		expect(entry?.domain).toBe("api.gallery-test.com");
		expect(entry?.endpointCount).toBe(3);
		expect(entry?.version).toBe(1);
		expect(entry?.id).toMatch(/^gal_/);
	});

	it("gallery cache hit: second scout returns fromGallery", async () => {
		const { store, gallery, layer } = buildE2ELayer(makeApiEvents());

		// 1. First scout — captures from browser
		const firstResult = await Effect.runPromise(
			Effect.provide(scout({ url: "https://api.gallery-test.com", task: "discover API" }), layer),
		);
		expect(firstResult.fromGallery).toBeUndefined();

		// Store the spec blob so getSpec works on second scout
		const galleryEntry = await Effect.runPromise(gallery.getByDomain("api.gallery-test.com"));
		expect(galleryEntry).not.toBeNull();

		const specBlob = new TextEncoder().encode(JSON.stringify(firstResult.openApiSpec));
		await Effect.runPromise(store.saveBlob(galleryEntry?.specKey ?? "", specBlob));

		// 2. Second scout — should hit gallery cache
		const secondResult = await Effect.runPromise(
			Effect.provide(
				scout({ url: "https://api.gallery-test.com", task: "discover API again" }),
				layer,
			),
		);

		expect(secondResult.fromGallery).toBe(true);
		expect(secondResult.endpointCount).toBe(3);
		// Same spec should be returned
		expect(secondResult.openApiSpec).toEqual(firstResult.openApiSpec);
	});

	it("FTS5 search: finds entry by endpoint path keyword", async () => {
		const { gallery, layer } = buildE2ELayer(makeApiEvents());

		// Scout to populate gallery
		await Effect.runPromise(
			Effect.provide(scout({ url: "https://api.gallery-test.com", task: "discover API" }), layer),
		);

		// Search by endpoint path keyword "users"
		const userResults = await Effect.runPromise(gallery.search("users"));
		expect(userResults.length).toBeGreaterThanOrEqual(1);
		expect(userResults.some((e) => e.domain === "api.gallery-test.com")).toBe(true);

		// Search by endpoint path keyword "posts"
		const postResults = await Effect.runPromise(gallery.search("posts"));
		expect(postResults.length).toBeGreaterThanOrEqual(1);
		expect(postResults.some((e) => e.domain === "api.gallery-test.com")).toBe(true);

		// Search for something not present
		const noResults = await Effect.runPromise(gallery.search("zzz-nonexistent-xyz"));
		expect(noResults).toHaveLength(0);
	});

	it("fetch full spec: returns valid OpenAPI from gallery", async () => {
		const { gallery, layer } = buildE2ELayer(makeApiEvents());

		// Scout to create and publish
		const scoutResult = await Effect.runPromise(
			Effect.provide(scout({ url: "https://api.gallery-test.com", task: "discover API" }), layer),
		);

		// Get the gallery entry
		const entry = await Effect.runPromise(gallery.getByDomain("api.gallery-test.com"));
		expect(entry).not.toBeNull();

		// The spec is already stored at specs/<siteId>/openapi.json by scout
		// Fetch full spec via gallery
		const spec = await Effect.runPromise(gallery.getSpec(entry?.id ?? ""));
		expect(spec.openapi).toBe("3.1.0");
		expect(spec.paths).toBeDefined();

		const paths = spec.paths as Record<string, unknown>;
		expect(Object.keys(paths).length).toBeGreaterThan(0);

		// Spec should match what scout returned
		expect(spec).toEqual(scoutResult.openApiSpec);
	});

	it("deduplication: publish same domain twice increments version", async () => {
		const { store, gallery, layer } = buildE2ELayer(makeApiEvents());

		// First scout → publishes version 1
		await Effect.runPromise(
			Effect.provide(scout({ url: "https://api.gallery-test.com", task: "first scout" }), layer),
		);

		const entryV1 = await Effect.runPromise(gallery.getByDomain("api.gallery-test.com"));
		expect(entryV1).not.toBeNull();
		expect(entryV1?.version).toBe(1);
		const originalId = entryV1?.id;

		// Manually publish again (simulating second scout publishing to gallery)
		// We need a second site with the same domain to trigger version increment
		await Effect.runPromise(
			store.saveSite({
				id: "site-dedup-2",
				url: "https://api.gallery-test.com",
				domain: "api.gallery-test.com",
				firstScoutedAt: new Date().toISOString(),
				lastScoutedAt: new Date().toISOString(),
			}),
		);
		await Effect.runPromise(gallery.publish("site-dedup-2", "second-contributor"));

		const entryV2 = await Effect.runPromise(gallery.getByDomain("api.gallery-test.com"));
		expect(entryV2).not.toBeNull();
		expect(entryV2?.version).toBe(2);
		// Same ID — not a duplicate entry
		expect(entryV2?.id).toBe(originalId);

		// Search should return only one entry for this domain
		const searchResults = await Effect.runPromise(gallery.search("", "api.gallery-test.com"));
		expect(searchResults.length).toBe(1);
	});

	it("scout with publish=false does not publish to gallery", async () => {
		const { gallery, layer } = buildE2ELayer(makeApiEvents());

		// Scout with publish disabled
		await Effect.runPromise(
			Effect.provide(
				scout({ url: "https://api.gallery-test.com", task: "no publish", publish: false }),
				layer,
			),
		);

		// Gallery should be empty for this domain
		const entry = await Effect.runPromise(gallery.getByDomain("api.gallery-test.com"));
		expect(entry).toBeNull();
	});

	it("gallery cache hit returns same OpenAPI spec structure", async () => {
		const { store, gallery, layer } = buildE2ELayer(makeApiEvents());

		// First scout
		const firstResult = await Effect.runPromise(
			Effect.provide(scout({ url: "https://api.gallery-test.com", task: "discover API" }), layer),
		);

		// Store the spec blob for cache retrieval
		const galleryEntry = await Effect.runPromise(gallery.getByDomain("api.gallery-test.com"));
		await Effect.runPromise(
			store.saveBlob(
				galleryEntry?.specKey ?? "",
				new TextEncoder().encode(JSON.stringify(firstResult.openApiSpec)),
			),
		);

		// Second scout from gallery cache
		const secondResult = await Effect.runPromise(
			Effect.provide(scout({ url: "https://api.gallery-test.com", task: "different task" }), layer),
		);

		expect(secondResult.fromGallery).toBe(true);

		// Verify identical spec structure
		const firstPaths = Object.keys(firstResult.openApiSpec.paths as Record<string, unknown>);
		const secondPaths = Object.keys(secondResult.openApiSpec.paths as Record<string, unknown>);
		expect(secondPaths).toEqual(firstPaths);

		// Verify OpenAPI version preserved
		expect(secondResult.openApiSpec.openapi).toBe("3.1.0");
	});
});
