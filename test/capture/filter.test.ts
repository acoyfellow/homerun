import { describe, expect, test } from "bun:test";
import { createCaptureFilter } from "../../src/bun/capture/filter";

describe("CaptureFilter", () => {
	test("matches all URLs with no filter options", () => {
		const filter = createCaptureFilter({});
		expect(filter.matches("https://example.com/api/users")).toBe(true);
		expect(filter.matches("https://other.com/data")).toBe(true);
	});

	test("filters by domain", () => {
		const filter = createCaptureFilter({ domains: ["example.com"] });
		expect(filter.matches("https://example.com/api")).toBe(true);
		expect(filter.matches("https://api.example.com/v1")).toBe(true);
		expect(filter.matches("https://other.com/api")).toBe(false);
	});

	test("excludes paths", () => {
		const filter = createCaptureFilter({
			domains: ["example.com"],
			excludePaths: ["/health", "/metrics"],
		});
		expect(filter.matches("https://example.com/api/users")).toBe(true);
		expect(filter.matches("https://example.com/health")).toBe(false);
		expect(filter.matches("https://example.com/metrics/cpu")).toBe(false);
	});

	test("returns false for invalid URLs", () => {
		const filter = createCaptureFilter({});
		expect(filter.matches("not-a-url")).toBe(false);
	});
});
