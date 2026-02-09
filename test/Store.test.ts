import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { Store, makeTestStore } from "../src/services/Store.js";

const store = makeTestStore();
const run = <A, E>(effect: Effect.Effect<A, E, never>) =>
	Effect.runPromise(effect);

describe("Store", () => {
	describe("sites", () => {
		it("saves and retrieves a site", async () => {
			await run(store.saveSite({
				id: "site-1",
				url: "https://example.com",
				domain: "example.com",
				firstScoutedAt: "2025-01-01T00:00:00Z",
				lastScoutedAt: "2025-01-01T00:00:00Z",
			}));

			const site = await run(store.getSite("site-1"));
			expect(site.id).toBe("site-1");
			expect(site.url).toBe("https://example.com");
			expect(site.domain).toBe("example.com");
		});

		it("returns NotFoundError for missing site", async () => {
			const exit = await Effect.runPromiseExit(store.getSite("nonexistent"));
			expect(Exit.isFailure(exit)).toBe(true);
		});

		it("upserts on save", async () => {
			await run(store.saveSite({
				id: "site-upsert",
				url: "https://test.com",
				domain: "test.com",
				firstScoutedAt: "2025-01-01T00:00:00Z",
				lastScoutedAt: "2025-01-01T00:00:00Z",
			}));

			await run(store.saveSite({
				id: "site-upsert",
				url: "https://test.com",
				domain: "test.com",
				firstScoutedAt: "2025-01-01T00:00:00Z",
				lastScoutedAt: "2025-02-01T00:00:00Z",
			}));

			const site = await run(store.getSite("site-upsert"));
			expect(site.lastScoutedAt).toBe("2025-02-01T00:00:00Z");
		});
	});

	describe("endpoints", () => {
		it("saves and retrieves endpoints by site", async () => {
			await run(store.saveSite({
				id: "site-ep",
				url: "https://api.example.com",
				domain: "api.example.com",
				firstScoutedAt: "2025-01-01T00:00:00Z",
				lastScoutedAt: "2025-01-01T00:00:00Z",
			}));

			await run(store.saveEndpoints([
				{
					id: "ep-1",
					siteId: "site-ep",
					method: "GET" as const,
					pathPattern: "/users/:id",
					requestSchema: undefined,
					responseSchema: { type: "object" },
					sampleCount: 3,
					firstSeenAt: "2025-01-01T00:00:00Z",
					lastSeenAt: "2025-01-01T00:00:00Z",
				} as any,
				{
					id: "ep-2",
					siteId: "site-ep",
					method: "POST" as const,
					pathPattern: "/users",
					requestSchema: { type: "object" },
					responseSchema: { type: "object" },
					sampleCount: 1,
					firstSeenAt: "2025-01-01T00:00:00Z",
					lastSeenAt: "2025-01-01T00:00:00Z",
				} as any,
			]));

			const eps = await run(store.getEndpoints("site-ep"));
			expect(eps).toHaveLength(2);
			expect(eps[0]!.pathPattern).toBe("/users/:id");
			expect(eps[1]!.method).toBe("POST");
		});

		it("returns empty array for unknown site", async () => {
			const eps = await run(store.getEndpoints("nonexistent"));
			expect(eps).toHaveLength(0);
		});
	});

	describe("paths", () => {
		it("saves and retrieves a path", async () => {
			await run(store.savePath({
				id: "path-1",
				siteId: "site-1",
				task: "find contact form",
				steps: [{ action: "navigate" as const, url: "https://example.com/contact" }],
				endpointIds: ["ep-1"],
				status: "active" as const,
				createdAt: "2025-01-01T00:00:00Z",
				failCount: 0,
				healCount: 0,
			} as any));

			const path = await run(store.getPath("path-1"));
			expect(path.id).toBe("path-1");
			expect(path.task).toBe("find contact form");
			expect(path.steps).toHaveLength(1);
			expect(path.endpointIds).toEqual(["ep-1"]);
		});

		it("lists paths by site", async () => {
			const paths = await run(store.listPaths("site-1"));
			expect(paths.length).toBeGreaterThanOrEqual(1);
		});

		it("returns NotFoundError for missing path", async () => {
			const exit = await Effect.runPromiseExit(store.getPath("nonexistent"));
			expect(Exit.isFailure(exit)).toBe(true);
		});
	});

	describe("blobs", () => {
		it("saves and retrieves a blob", async () => {
			const data = new TextEncoder().encode("hello world");
			await run(store.saveBlob("test-key", data));

			const result = await run(store.getBlob("test-key"));
			expect(result).not.toBeNull();
			expect(new TextDecoder().decode(result!)).toBe("hello world");
		});

		it("returns null for missing blob", async () => {
			const result = await run(store.getBlob("nonexistent"));
			expect(result).toBeNull();
		});
	});

	describe("runs", () => {
		it("saves a run", async () => {
			await run(store.saveRun({
				id: "run-1",
				pathId: "path-1",
				tool: "scout",
				status: "success",
				input: JSON.stringify({ url: "https://example.com" }),
				output: JSON.stringify({ endpointCount: 5 }),
				createdAt: "2025-01-01T00:00:00Z",
			}));
			// No error = success
		});
	});
});
