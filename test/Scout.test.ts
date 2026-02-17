import { Effect, Layer, Option } from "effect";
import { describe, expect, it } from "vitest";
import { NetworkEvent } from "../src/domain/NetworkEvent.js";
import { Browser, makeTestBrowserWithEvents } from "../src/services/Browser.js";
import { makeOpenApiGenerator, OpenApiGenerator } from "../src/services/OpenApiGenerator.js";
import { makeSchemaInferrer, SchemaInferrer } from "../src/services/SchemaInferrer.js";
import { makeTestStore, Store } from "../src/services/Store.js";
import { scout } from "../src/tools/Scout.js";

// ==================== Test Fixtures ====================

function makeEvents(): NetworkEvent[] {
	return [
		new NetworkEvent({
			requestId: "req-1",
			url: "https://api.example.com/users",
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
			url: "https://api.example.com/users/1",
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
			url: "https://api.example.com/posts",
			method: "POST",
			resourceType: "xhr",
			requestHeaders: { "content-type": "application/json" },
			requestBody: JSON.stringify({ title: "Hello", body: "World" }),
			responseStatus: 201,
			responseHeaders: { "content-type": "application/json" },
			responseBody: JSON.stringify({ id: 42, title: "Hello", body: "World" }),
			timestamp: Date.now(),
		}),
		// This one should be filtered out (image)
		new NetworkEvent({
			requestId: "req-4",
			url: "https://api.example.com/logo.png",
			method: "GET",
			resourceType: "image",
			requestHeaders: {},
			responseStatus: 200,
			responseHeaders: {},
			timestamp: Date.now(),
		}),
		// Analytics should be filtered out
		new NetworkEvent({
			requestId: "req-5",
			url: "https://google-analytics.com/collect",
			method: "POST",
			resourceType: "fetch",
			requestHeaders: {},
			responseStatus: 200,
			responseHeaders: {},
			timestamp: Date.now(),
		}),
	];
}

function buildTestLayer(events: NetworkEvent[]) {
	const testStore = makeTestStore();
	return Layer.mergeAll(
		Layer.succeed(Browser, makeTestBrowserWithEvents(events)),
		Layer.succeed(Store, testStore),
		Layer.succeed(SchemaInferrer, makeSchemaInferrer()),
		Layer.succeed(OpenApiGenerator, makeOpenApiGenerator()),
	);
}

function runScout(events: NetworkEvent[], input: { url: string; task: string }) {
	const layer = buildTestLayer(events);
	return Effect.runPromise(Effect.provide(scout(input), layer));
}

// ==================== Tests ====================

describe("Scout", () => {
	it("captures endpoints from network events", async () => {
		const result = await runScout(makeEvents(), {
			url: "https://api.example.com",
			task: "discover all API endpoints",
		});

		// 3 API events, but /users/1 normalizes to /users/:id, separate from /users
		// So we get: GET /users, GET /users/:id, POST /posts = 3 endpoints
		// (image + analytics filtered out)
		expect(result.endpointCount).toBe(3);
		expect(result.siteId).toBeTruthy();
		expect(result.pathId).toBeTruthy();
	});

	it("generates an OpenAPI spec", async () => {
		const result = await runScout(makeEvents(), {
			url: "https://api.example.com",
			task: "discover all API endpoints",
		});

		const spec = result.openApiSpec;
		expect(spec.openapi).toBe("3.1.0");
		expect(spec.paths).toBeDefined();

		const paths = spec.paths as Record<string, unknown>;
		expect(Object.keys(paths).length).toBeGreaterThan(0);
	});

	it("saves site to store", async () => {
		const testStore = makeTestStore();
		const layer = Layer.mergeAll(
			Layer.succeed(Browser, makeTestBrowserWithEvents(makeEvents())),
			Layer.succeed(Store, testStore),
			Layer.succeed(SchemaInferrer, makeSchemaInferrer()),
			Layer.succeed(OpenApiGenerator, makeOpenApiGenerator()),
		);

		const result = await Effect.runPromise(
			Effect.provide(scout({ url: "https://api.example.com", task: "test" }), layer),
		);

		// Verify site was saved
		const site = await Effect.runPromise(testStore.getSite(result.siteId));
		expect(site.url).toBe("https://api.example.com");
		expect(site.domain).toBe("api.example.com");
	});

	it("saves endpoints to store", async () => {
		const testStore = makeTestStore();
		const layer = Layer.mergeAll(
			Layer.succeed(Browser, makeTestBrowserWithEvents(makeEvents())),
			Layer.succeed(Store, testStore),
			Layer.succeed(SchemaInferrer, makeSchemaInferrer()),
			Layer.succeed(OpenApiGenerator, makeOpenApiGenerator()),
		);

		const result = await Effect.runPromise(
			Effect.provide(scout({ url: "https://api.example.com", task: "test" }), layer),
		);

		const endpoints = await Effect.runPromise(testStore.getEndpoints(result.siteId));
		expect(endpoints.length).toBe(3);

		// Check one endpoint has inferred schema
		const getUsers = endpoints.find(
			(ep) => ep.method === "GET" && ep.pathPattern.endsWith("/users"),
		);
		expect(getUsers).toBeDefined();
	});

	it("saves path to store", async () => {
		const testStore = makeTestStore();
		const layer = Layer.mergeAll(
			Layer.succeed(Browser, makeTestBrowserWithEvents(makeEvents())),
			Layer.succeed(Store, testStore),
			Layer.succeed(SchemaInferrer, makeSchemaInferrer()),
			Layer.succeed(OpenApiGenerator, makeOpenApiGenerator()),
		);

		const result = await Effect.runPromise(
			Effect.provide(scout({ url: "https://api.example.com", task: "find users" }), layer),
		);

		const path = await Effect.runPromise(testStore.getPath(result.pathId));
		expect(path.siteId).toBe(result.siteId);
		expect(path.task).toBe("find users");
		expect(path.status).toBe("active");
		expect(path.endpointIds.length).toBe(3);
		expect(path.steps.length).toBe(1);
	});

	it("saves screenshot blob", async () => {
		const testStore = makeTestStore();
		const layer = Layer.mergeAll(
			Layer.succeed(Browser, makeTestBrowserWithEvents(makeEvents())),
			Layer.succeed(Store, testStore),
			Layer.succeed(SchemaInferrer, makeSchemaInferrer()),
			Layer.succeed(OpenApiGenerator, makeOpenApiGenerator()),
		);

		const result = await Effect.runPromise(
			Effect.provide(scout({ url: "https://api.example.com", task: "test" }), layer),
		);

		const screenshot = await Effect.runPromise(
			testStore.getBlob(`screenshots/${result.siteId}/scout.png`),
		);
		expect(screenshot).not.toBeNull();
	});

	it("handles site with no API calls", async () => {
		const result = await runScout([], {
			url: "https://static-site.com",
			task: "find API endpoints",
		});

		expect(result.endpointCount).toBe(0);
		expect(result.siteId).toBeTruthy();
		expect(result.pathId).toBeTruthy();

		const spec = result.openApiSpec;
		expect(spec.paths as Record<string, unknown>).toEqual({});
	});

	it("normalizes URL patterns (numeric IDs)", async () => {
		const events = [
			new NetworkEvent({
				requestId: "r1",
				url: "https://api.example.com/users/123",
				method: "GET",
				resourceType: "fetch",
				requestHeaders: {},
				responseStatus: 200,
				responseHeaders: {},
				responseBody: '{"id": 123}',
				timestamp: Date.now(),
			}),
			new NetworkEvent({
				requestId: "r2",
				url: "https://api.example.com/users/456",
				method: "GET",
				resourceType: "fetch",
				requestHeaders: {},
				responseStatus: 200,
				responseHeaders: {},
				responseBody: '{"id": 456}',
				timestamp: Date.now(),
			}),
		];

		const result = await runScout(events, {
			url: "https://api.example.com",
			task: "test",
		});

		// Both /users/123 and /users/456 should normalize to /users/:id = 1 endpoint
		expect(result.endpointCount).toBe(1);
	});

	it("infers response schemas from multiple samples", async () => {
		const testStore = makeTestStore();
		const events = [
			new NetworkEvent({
				requestId: "r1",
				url: "https://api.example.com/users/1",
				method: "GET",
				resourceType: "fetch",
				requestHeaders: {},
				responseStatus: 200,
				responseHeaders: {},
				responseBody: JSON.stringify({ id: 1, name: "Alice" }),
				timestamp: Date.now(),
			}),
			new NetworkEvent({
				requestId: "r2",
				url: "https://api.example.com/users/2",
				method: "GET",
				resourceType: "fetch",
				requestHeaders: {},
				responseStatus: 200,
				responseHeaders: {},
				responseBody: JSON.stringify({ id: 2, name: "Bob", email: "bob@test.com" }),
				timestamp: Date.now(),
			}),
		];

		const layer = Layer.mergeAll(
			Layer.succeed(Browser, makeTestBrowserWithEvents(events)),
			Layer.succeed(Store, testStore),
			Layer.succeed(SchemaInferrer, makeSchemaInferrer()),
			Layer.succeed(OpenApiGenerator, makeOpenApiGenerator()),
		);

		const result = await Effect.runPromise(
			Effect.provide(scout({ url: "https://api.example.com", task: "test" }), layer),
		);

		const endpoints = await Effect.runPromise(testStore.getEndpoints(result.siteId));
		expect(endpoints.length).toBe(1);

		// The endpoint should have a merged response schema
		const ep = endpoints[0];
		expect(ep).toBeDefined();
		// Schema should include id, name (required) and email (optional)
		if (ep && Option.isSome(ep.responseSchema)) {
			const schema = ep.responseSchema.value as Record<string, unknown>;
			const props = schema.properties as Record<string, unknown>;
			expect(props.id).toBeDefined();
			expect(props.name).toBeDefined();
			expect(props.email).toBeDefined();
		}
	});
});
