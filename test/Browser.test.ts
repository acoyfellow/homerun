import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { isApiRequest, NetworkEvent } from "../src/domain/NetworkEvent.js";
import { makeTestBrowser, makeTestBrowserWithEvents } from "../src/services/Browser.js";

const run = <A, E>(effect: Effect.Effect<A, E, never>) => Effect.runPromise(effect);

describe("NetworkEvent", () => {
	describe("isApiRequest", () => {
		it("accepts fetch/xhr requests", () => {
			expect(isApiRequest("fetch", "https://api.example.com/users")).toBe(true);
			expect(isApiRequest("xhr", "https://api.example.com/data")).toBe(true);
		});

		it("rejects image/css/font requests", () => {
			expect(isApiRequest("image", "https://example.com/logo.png")).toBe(false);
			expect(isApiRequest("stylesheet", "https://example.com/style.css")).toBe(false);
			expect(isApiRequest("font", "https://example.com/font.woff2")).toBe(false);
		});

		it("rejects tracking/analytics URLs even if fetch", () => {
			expect(isApiRequest("fetch", "https://google-analytics.com/collect")).toBe(false);
			expect(isApiRequest("fetch", "https://www.googletagmanager.com/gtag/js")).toBe(false);
			expect(isApiRequest("fetch", "https://connect.facebook.net/en_US/sdk.js")).toBe(false);
		});

		it("rejects static asset URLs in fetch", () => {
			expect(isApiRequest("fetch", "https://example.com/image.png")).toBe(false);
			expect(isApiRequest("fetch", "https://example.com/style.css")).toBe(false);
			expect(isApiRequest("fetch", "https://fonts.googleapis.com/css2")).toBe(false);
		});

		it("accepts document requests", () => {
			expect(isApiRequest("document", "https://example.com/page")).toBe(true);
		});
	});
});

describe("TestBrowser", () => {
	it("navigates without error", async () => {
		const browser = makeTestBrowser();
		await run(browser.navigate("https://example.com"));
	});

	it("returns a screenshot", async () => {
		const browser = makeTestBrowser();
		const png = await run(browser.screenshot());
		expect(png).toBeInstanceOf(Uint8Array);
		expect(png.length).toBeGreaterThan(0);
	});

	it("returns empty events by default", async () => {
		const browser = makeTestBrowser();
		const events = await run(browser.getNetworkEvents());
		expect(events).toHaveLength(0);
	});

	it("returns injected events", async () => {
		const fakeEvents = [
			new NetworkEvent({
				requestId: "req-1",
				url: "https://api.example.com/users",
				method: "GET",
				resourceType: "fetch",
				requestHeaders: {},
				responseStatus: 200,
				responseHeaders: { "content-type": "application/json" },
				responseBody: '{"users": []}',
				timestamp: Date.now(),
			}),
		];

		const browser = makeTestBrowserWithEvents(fakeEvents);
		const events = await run(browser.getNetworkEvents());
		expect(events).toHaveLength(1);
		expect(events[0]?.url).toBe("https://api.example.com/users");
	});
});
