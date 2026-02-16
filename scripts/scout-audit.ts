import urls from "./scout-audit-urls.json";

const UNSURF_URL = process.env.UNSURF_URL ?? "https://unsurf-api.coey.dev";
const DELAY_MS = 6_000;
const TIMEOUT_MS = 60_000;

interface UrlEntry {
	url: string;
	task: string;
	category: string;
}

interface AuditResult {
	url: string;
	category: string;
	success: boolean;
	endpointCount: number;
	error: string;
	durationMs: number;
	timestamp: string;
	siteId: string;
	pathId: string;
	fromGallery: boolean;
}

const results: AuditResult[] = [];

console.log("\nScout Success Rate Audit");
console.log(`Target: ${UNSURF_URL}`);
console.log(`Sites: ${urls.length}`);
console.log(`Delay: ${DELAY_MS}ms | Timeout: ${TIMEOUT_MS}ms`);
console.log(`${"=".repeat(60)}\n`);

for (const entry of urls as UrlEntry[]) {
	const start = Date.now();
	let result: AuditResult;

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

		const res = await fetch(`${UNSURF_URL}/tools/scout`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url: entry.url, task: entry.task }),
			signal: controller.signal,
		});
		clearTimeout(timeout);

		const body = (await res.json()) as Record<string, unknown>;

		if (!res.ok) {
			result = {
				url: entry.url,
				category: entry.category,
				success: false,
				endpointCount: 0,
				error: (body.error as string) ?? `HTTP ${res.status}`,
				durationMs: Date.now() - start,
				timestamp: new Date().toISOString(),
				siteId: "",
				pathId: "",
				fromGallery: false,
			};
		} else {
			result = {
				url: entry.url,
				category: entry.category,
				success: true,
				endpointCount: (body.endpointCount as number) ?? 0,
				error: "",
				durationMs: Date.now() - start,
				timestamp: new Date().toISOString(),
				siteId: (body.siteId as string) ?? "",
				pathId: (body.pathId as string) ?? "",
				fromGallery: (body.fromGallery as boolean) ?? false,
			};
		}
	} catch (e: unknown) {
		const errMsg =
			e instanceof DOMException && e.name === "AbortError"
				? "timeout (60s)"
				: e instanceof Error
					? e.message
					: String(e);
		result = {
			url: entry.url,
			category: entry.category,
			success: false,
			endpointCount: 0,
			error: errMsg,
			durationMs: Date.now() - start,
			timestamp: new Date().toISOString(),
			siteId: "",
			pathId: "",
			fromGallery: false,
		};
	}

	results.push(result);
	console.log(
		`[${results.length}/${urls.length}] ${result.success ? "✓" : "✗"} ${result.url} — ${result.endpointCount} endpoints (${(result.durationMs / 1000).toFixed(1)}s)${result.error ? ` — ${result.error}` : ""}`,
	);

	if (results.length < urls.length) {
		await new Promise((r) => setTimeout(r, DELAY_MS));
	}
}

function escapeCsv(value: string): string {
	if (value.includes(",") || value.includes('"') || value.includes("\n")) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

const csvHeader =
	"url,category,success,endpointCount,error,durationMs,timestamp,siteId,pathId,fromGallery";
const csvRows = results.map((r) =>
	[
		escapeCsv(r.url),
		escapeCsv(r.category),
		r.success,
		r.endpointCount,
		escapeCsv(r.error),
		r.durationMs,
		r.timestamp,
		escapeCsv(r.siteId),
		escapeCsv(r.pathId),
		r.fromGallery,
	].join(","),
);
const csv = [csvHeader, ...csvRows].join("\n");

await Bun.write(".sisyphus/evidence/task-1-scout-results.csv", csv);

const ERROR_PATTERNS: Array<[string, string[]]> = [
	["timeout", ["timeout", "abort"]],
	["auth_wall", ["403", "forbidden", "auth"]],
	["rate_limited", ["429", "rate limit", "too many"]],
	["browser_error", ["navigation", "browser", "puppeteer"]],
	["ssl_error", ["ssl", "cert", "tls"]],
	["dns_error", ["dns", "enotfound", "getaddrinfo"]],
	["server_error", ["500", "502", "503", "504"]],
	["no_endpoints", ["no endpoints", "0 endpoints"]],
];

function categorizeError(error: string): string {
	const err = error.toLowerCase();
	for (const [category, patterns] of ERROR_PATTERNS) {
		if (patterns.some((p) => err.includes(p))) return category;
	}
	return "other";
}

const total = results.length;
const successes = results.filter((r) => r.success).length;
const failures = results.filter((r) => !r.success).length;
const avgEndpoints =
	successes > 0
		? results.filter((r) => r.success).reduce((sum, r) => sum + r.endpointCount, 0) / successes
		: 0;
const galleryHits = results.filter((r) => r.fromGallery).length;
const avgDuration = results.reduce((sum, r) => sum + r.durationMs, 0) / total;

const failureCategories: Record<string, Array<{ url: string; error: string }>> = {};
for (const r of results.filter((r) => !r.success)) {
	const cat = categorizeError(r.error);
	if (!failureCategories[cat]) failureCategories[cat] = [];
	failureCategories[cat].push({ url: r.url, error: r.error });
}

const successByCategory: Record<string, number> = {};
const totalByCategory: Record<string, number> = {};
for (const r of results) {
	totalByCategory[r.category] = (totalByCategory[r.category] ?? 0) + 1;
	if (r.success) {
		successByCategory[r.category] = (successByCategory[r.category] ?? 0) + 1;
	}
}

const taxonomy = `# Task 1: Scout Failure Taxonomy

**Date**: ${new Date().toISOString()}
**Target**: ${UNSURF_URL}

## Summary

| Metric | Value |
|--------|-------|
| Total sites tested | ${total} |
| Successes | ${successes} (${((successes / total) * 100).toFixed(1)}%) |
| Failures | ${failures} (${((failures / total) * 100).toFixed(1)}%) |
| Avg endpoints per success | ${avgEndpoints.toFixed(1)} |
| Gallery cache hits | ${galleryHits} |
| Avg duration | ${(avgDuration / 1000).toFixed(1)}s |

## Success Rate by Site Category

| Category | Total | Success | Rate |
|----------|-------|---------|------|
${Object.entries(totalByCategory)
	.sort(([, a], [, b]) => b - a)
	.map(([cat, count]) => {
		const s = successByCategory[cat] ?? 0;
		return `| ${cat} | ${count} | ${s} | ${((s / count) * 100).toFixed(0)}% |`;
	})
	.join("\n")}

## Failure Categories

${
	Object.entries(failureCategories).length > 0
		? Object.entries(failureCategories)
				.sort(([, a], [, b]) => b.length - a.length)
				.map(
					([cat, entries]) => `### ${cat} (${entries.length})
${entries.map((e) => `- ${e.url} — \`${e.error}\``).join("\n")}`,
				)
				.join("\n\n")
		: "*No failures recorded.*"
}

## Successful Sites (${successes})

${results
	.filter((r) => r.success)
	.sort((a, b) => b.endpointCount - a.endpointCount)
	.map(
		(r) =>
			`- ${r.url} — ${r.endpointCount} endpoints (${(r.durationMs / 1000).toFixed(1)}s)${r.fromGallery ? " [gallery]" : ""}`,
	)
	.join("\n")}

## Notes

- Timeout: ${TIMEOUT_MS / 1000}s per scout
- Delay: ${DELAY_MS / 1000}s between requests
- Sites marked [gallery] were served from cache, not live-scouted
`;

await Bun.write(".sisyphus/evidence/task-1-failure-taxonomy.md", taxonomy);

console.log(`\n${"=".repeat(60)}`);
console.log(`SUCCESS RATE: ${successes}/${total} = ${((successes / total) * 100).toFixed(1)}%`);
console.log(`Avg endpoints per success: ${avgEndpoints.toFixed(1)}`);
console.log(`Gallery cache hits: ${galleryHits}`);
console.log(`Avg duration: ${(avgDuration / 1000).toFixed(1)}s`);
console.log("=".repeat(60));
console.log("\nResults: .sisyphus/evidence/task-1-scout-results.csv");
console.log("Taxonomy: .sisyphus/evidence/task-1-failure-taxonomy.md");
