/**
 * Usage:
 *   bun run scripts/batch-scout.ts [flags]
 *
 * Flags:
 *   --resume      Continue from last interruption (skips already-scouted URLs)
 *   --publish     Auto-publish successful scouts to the directory
 *   --dry-run     Print plan without executing
 *   --limit=N     Only scout first N sites
 *   --delay=N     Rate limit delay in ms (default: 5000)
 *   --timeout=N   Per-scout timeout in ms (default: 60000)
 *   --retries=N   Max retries per site on failure (default: 2)
 */

const UNSURF_URL = process.env.UNSURF_URL ?? "https://unsurf-api.coey.dev";
const SAAS_PATH = ".sisyphus/data/top-100-saas.json";
const RESULTS_PATH = ".sisyphus/evidence/task-9-batch-results.json";

const cliArgs = new Set(process.argv.slice(2));
const getFlag = (name: string, fallback: number): number => {
	for (const arg of process.argv.slice(2)) {
		if (arg.startsWith(`--${name}=`)) return Number(arg.split("=")[1]);
	}
	return fallback;
};

const RESUME = cliArgs.has("--resume");
const PUBLISH = cliArgs.has("--publish");
const DRY_RUN = cliArgs.has("--dry-run");
const LIMIT = getFlag("limit", 0);
const DELAY_MS = getFlag("delay", 5_000);
const TIMEOUT_MS = getFlag("timeout", 60_000);
const MAX_RETRIES = getFlag("retries", 2);

interface SaasEntry {
	name: string;
	url: string;
	apiUrl?: string;
	category: string;
	difficulty: string;
	priority?: number;
	description: string;
	notes?: string;
}

interface SaasFile {
	_meta: Record<string, unknown>;
	sites: SaasEntry[];
}

interface ScoutResult {
	name: string;
	url: string;
	category: string;
	difficulty: string;
	success: boolean;
	endpointCount: number;
	siteId: string;
	pathId: string;
	fromGallery: boolean;
	published: boolean;
	error: string;
	durationMs: number;
	retries: number;
	timestamp: string;
}

interface BatchResults {
	meta: {
		startedAt: string;
		completedAt: string;
		unsurfUrl: string;
		totalSites: number;
		scouted: number;
		succeeded: number;
		failed: number;
		published: number;
		avgDurationMs: number;
		avgEndpoints: number;
	};
	results: ScoutResult[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadSaasEntries(): Promise<SaasEntry[]> {
	const file = Bun.file(SAAS_PATH);
	if (!(await file.exists())) {
		throw new Error(`SaaS list not found: ${SAAS_PATH}`);
	}
	const data = await file.json();
	if (Array.isArray(data)) return data as SaasEntry[];
	return (data as SaasFile).sites;
}

async function loadExistingResults(): Promise<BatchResults | null> {
	const file = Bun.file(RESULTS_PATH);
	if (!(await file.exists())) return null;
	try {
		return (await file.json()) as BatchResults;
	} catch {
		return null;
	}
}

async function saveResults(batch: BatchResults): Promise<void> {
	await Bun.write(RESULTS_PATH, JSON.stringify(batch, null, "\t"));
}

const TASK_BY_CATEGORY: Record<string, string> = {
	communication: "find messaging or communication API endpoints",
	productivity: "find productivity tool API endpoints",
	devtools: "find developer tool API endpoints",
	design: "find design tool API endpoints",
	"project-management": "find project management API endpoints",
	automation: "find automation workflow API endpoints",
	ecommerce: "find e-commerce API endpoints",
	marketing: "find marketing platform API endpoints",
	crm: "find CRM data API endpoints",
	"customer-support": "find customer support API endpoints",
	analytics: "find analytics and tracking API endpoints",
	finance: "find payment or financial API endpoints",
	security: "find authentication and security API endpoints",
	cloud: "find cloud service API endpoints",
	storage: "find file storage API endpoints",
	collaboration: "find collaboration tool API endpoints",
	sales: "find sales platform API endpoints",
};

function inferTask(entry: SaasEntry): string {
	return (
		TASK_BY_CATEGORY[entry.category] ?? `find API endpoints for ${entry.description.toLowerCase()}`
	);
}

function makeFailResult(
	entry: SaasEntry,
	error: string,
	durationMs: number,
	retries: number,
): ScoutResult {
	return {
		name: entry.name,
		url: entry.url,
		category: entry.category,
		difficulty: entry.difficulty,
		success: false,
		endpointCount: 0,
		siteId: "",
		pathId: "",
		fromGallery: false,
		published: false,
		error,
		durationMs,
		retries,
		timestamp: new Date().toISOString(),
	};
}

function makeSuccessResult(
	entry: SaasEntry,
	body: Record<string, unknown>,
	durationMs: number,
	attempt: number,
): ScoutResult {
	return {
		name: entry.name,
		url: entry.url,
		category: entry.category,
		difficulty: entry.difficulty,
		success: true,
		endpointCount: (body.endpointCount as number) ?? 0,
		siteId: (body.siteId as string) ?? "",
		pathId: (body.pathId as string) ?? "",
		fromGallery: (body.fromGallery as boolean) ?? false,
		published: false,
		error: "",
		durationMs,
		retries: attempt,
		timestamp: new Date().toISOString(),
	};
}

function extractError(e: unknown): string {
	if (e instanceof DOMException && e.name === "AbortError")
		return `timeout (${TIMEOUT_MS / 1000}s)`;
	if (e instanceof Error) return e.message;
	return String(e);
}

function shouldRetry(status: number): boolean {
	if (status === 429) return true;
	return status < 400 || status >= 500;
}

async function scoutOnce(
	entry: SaasEntry,
	task: string,
): Promise<
	| { ok: true; result: ScoutResult }
	| { ok: false; error: string; durationMs: number; retryable: boolean }
> {
	const start = Date.now();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const res = await fetch(`${UNSURF_URL}/tools/scout`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url: entry.apiUrl ?? entry.url, task }),
			signal: controller.signal,
		});
		clearTimeout(timeout);

		const body = (await res.json()) as Record<string, unknown>;
		const durationMs = Date.now() - start;

		if (res.ok) {
			return { ok: true, result: makeSuccessResult(entry, body, durationMs, 0) };
		}

		const error = (body.error as string) ?? `HTTP ${res.status}`;
		return { ok: false, error, durationMs, retryable: shouldRetry(res.status) };
	} catch (e: unknown) {
		clearTimeout(timeout);
		return { ok: false, error: extractError(e), durationMs: Date.now() - start, retryable: true };
	}
}

async function scoutUrl(entry: SaasEntry): Promise<ScoutResult> {
	const task = inferTask(entry);

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		const outcome = await scoutOnce(entry, task);

		if (outcome.ok) {
			outcome.result.retries = attempt;
			return outcome.result;
		}

		if (!outcome.retryable) {
			return makeFailResult(entry, outcome.error, outcome.durationMs, attempt);
		}

		if (attempt < MAX_RETRIES) {
			await sleep(DELAY_MS * 2 ** attempt);
		} else {
			return makeFailResult(entry, outcome.error, outcome.durationMs, attempt);
		}
	}

	return makeFailResult(entry, "max retries exceeded", 0, MAX_RETRIES);
}

async function publishToDirectory(siteId: string): Promise<boolean> {
	try {
		const res = await fetch(`${UNSURF_URL}/d/publish`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ siteId }),
		});
		return res.ok;
	} catch {
		return false;
	}
}

function buildMeta(
	startedAt: string,
	totalSites: number,
	results: ScoutResult[],
	succeeded: number,
	failed: number,
	published: number,
): BatchResults["meta"] {
	const successResults = results.filter((r) => r.success);
	return {
		startedAt,
		completedAt: new Date().toISOString(),
		unsurfUrl: UNSURF_URL,
		totalSites,
		scouted: results.length,
		succeeded,
		failed,
		published,
		avgDurationMs:
			results.length > 0 ? results.reduce((sum, r) => sum + r.durationMs, 0) / results.length : 0,
		avgEndpoints:
			succeeded > 0 ? successResults.reduce((sum, r) => sum + r.endpointCount, 0) / succeeded : 0,
	};
}

function formatSuccessLog(result: ScoutResult): string {
	const base = `✓ ${result.endpointCount} endpoints (${(result.durationMs / 1000).toFixed(1)}s)`;
	const cached = result.fromGallery ? " [cached]" : "";
	const pub = result.published ? " [published]" : "";
	const retried = result.retries > 0 ? ` [${result.retries} retries]` : "";
	return `${base}${cached}${pub}${retried}`;
}

function formatFailLog(result: ScoutResult): string {
	const base = `✗ ${result.error} (${(result.durationMs / 1000).toFixed(1)}s)`;
	const retried = result.retries > 0 ? ` [${result.retries} retries]` : "";
	return `${base}${retried}`;
}

function printHeader(totalInQueue: number, queueLength: number): void {
	console.log("\n══════════════════════════════════════════════════");
	console.log("          unsurf Batch Scout Pipeline             ");
	console.log("══════════════════════════════════════════════════");
	console.log(`  Target:     ${UNSURF_URL}`);
	console.log(`  Sites:      ${totalInQueue} total, ${queueLength} to scout`);
	console.log(`  Rate limit: ${DELAY_MS / 1000}s between requests`);
	console.log(`  Timeout:    ${TIMEOUT_MS / 1000}s per scout`);
	console.log(`  Retries:    ${MAX_RETRIES}`);
	console.log(`  Publish:    ${PUBLISH ? "yes" : "no"}`);
	console.log(`  Resume:     ${RESUME ? "yes" : "no"}`);
	console.log(`${"─".repeat(52)}\n`);
}

function groupBy(
	results: ScoutResult[],
	key: "category" | "difficulty",
): Record<string, { total: number; success: number }> {
	const groups: Record<string, { total: number; success: number }> = {};
	for (const r of results) {
		const k = r[key];
		if (!groups[k]) groups[k] = { total: 0, success: 0 };
		groups[k].total++;
		if (r.success) groups[k].success++;
	}
	return groups;
}

function printSummary(
	results: ScoutResult[],
	succeeded: number,
	failed: number,
	published: number,
	totalInQueue: number,
): void {
	const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
	const avgEndpoints =
		succeeded > 0
			? results.filter((r) => r.success).reduce((sum, r) => sum + r.endpointCount, 0) / succeeded
			: 0;

	console.log(`\n${"═".repeat(52)}`);
	console.log("  BATCH SCOUT COMPLETE");
	console.log(`${"═".repeat(52)}`);
	console.log(`  Total scouted:   ${results.length}/${totalInQueue}`);
	console.log(
		`  Succeeded:       ${succeeded} (${((succeeded / results.length) * 100).toFixed(1)}%)`,
	);
	console.log(`  Failed:          ${failed} (${((failed / results.length) * 100).toFixed(1)}%)`);
	console.log(`  Published:       ${published}`);
	console.log(`  Avg endpoints:   ${avgEndpoints.toFixed(1)}`);
	console.log(`  Avg duration:    ${(totalDuration / results.length / 1000).toFixed(1)}s`);
	console.log(`${"─".repeat(52)}`);

	printGroupBreakdown(
		"BY CATEGORY:",
		groupBy(results, "category"),
		([, a], [, b]) => b.total - a.total,
	);

	const diffOrder = ["easy", "medium", "hard"];
	printGroupBreakdown(
		"BY DIFFICULTY:",
		groupBy(results, "difficulty"),
		([a], [b]) => diffOrder.indexOf(a) - diffOrder.indexOf(b),
	);

	printTopFailures(results.filter((r) => !r.success));

	console.log(`\n  Results saved to: ${RESULTS_PATH}`);
	console.log(`${"═".repeat(52)}\n`);
}

function printGroupBreakdown(
	label: string,
	groups: Record<string, { total: number; success: number }>,
	sortFn: (
		a: [string, { total: number; success: number }],
		b: [string, { total: number; success: number }],
	) => number,
): void {
	console.log(`\n  ${label}`);
	for (const [key, stats] of Object.entries(groups).sort(sortFn)) {
		const rate = ((stats.success / stats.total) * 100).toFixed(0);
		console.log(`    ${key.padEnd(22)} ${stats.success}/${stats.total} (${rate}%)`);
	}
}

function printTopFailures(failures: ScoutResult[]): void {
	if (failures.length === 0) return;
	console.log("\n  TOP FAILURES:");
	for (const f of failures.slice(0, 10)) {
		console.log(`    ✗ ${f.name} (${f.url})`);
		console.log(`      ${f.error}`);
	}
	if (failures.length > 10) {
		console.log(`    ... and ${failures.length - 10} more`);
	}
}

function resolveQueue(
	entries: SaasEntry[],
	existing: BatchResults | null,
): {
	queue: SaasEntry[];
	previousResults: ScoutResult[];
	totalInQueue: number;
} {
	const completedUrls = new Set<string>();
	const previousResults: ScoutResult[] = [];
	if (existing?.results) {
		for (const r of existing.results) {
			completedUrls.add(r.url);
			previousResults.push(r);
		}
	}

	const limited = LIMIT > 0 ? entries.slice(0, LIMIT) : entries;
	const totalInQueue = limited.length;

	let queue = limited;
	if (RESUME && completedUrls.size > 0) {
		queue = limited.filter((e) => !completedUrls.has(e.url));
		console.log(`\nResuming: ${completedUrls.size} already done, ${queue.length} remaining`);
	}

	return { queue, previousResults, totalInQueue };
}

async function processEntry(
	entry: SaasEntry,
	counters: { succeeded: number; failed: number; published: number },
): Promise<ScoutResult> {
	const result = await scoutUrl(entry);

	if (result.success) {
		counters.succeeded++;
		if (PUBLISH && result.siteId) {
			result.published = await publishToDirectory(result.siteId);
			if (result.published) counters.published++;
		}
		console.log(formatSuccessLog(result));
	} else {
		counters.failed++;
		console.log(formatFailLog(result));
	}

	return result;
}

async function main(): Promise<void> {
	const startedAt = new Date().toISOString();
	const entries = await loadSaasEntries();
	const existing = RESUME ? await loadExistingResults() : null;
	const { queue, previousResults, totalInQueue } = resolveQueue(entries, existing);

	printHeader(totalInQueue, queue.length);

	if (DRY_RUN) {
		console.log("DRY RUN — would scout these URLs:\n");
		for (const [i, entry] of queue.entries()) {
			console.log(`  ${i + 1}. ${entry.name} (${entry.url}) [${entry.difficulty}]`);
		}
		console.log(`\nTotal: ${queue.length} sites`);
		return;
	}

	const results: ScoutResult[] = [...previousResults];
	const counters = {
		succeeded: previousResults.filter((r) => r.success).length,
		failed: previousResults.filter((r) => !r.success).length,
		published: previousResults.filter((r) => r.published).length,
	};

	for (const [i, entry] of queue.entries()) {
		const globalIndex = results.length + 1;
		const progressPct = ((globalIndex / totalInQueue) * 100).toFixed(0);
		process.stdout.write(
			`[${globalIndex}/${totalInQueue}] (${progressPct}%) Scouting ${entry.name}... `,
		);

		const result = await processEntry(entry, counters);
		results.push(result);

		await saveResults({
			meta: buildMeta(
				startedAt,
				totalInQueue,
				results,
				counters.succeeded,
				counters.failed,
				counters.published,
			),
			results,
		});

		if (i < queue.length - 1) await sleep(DELAY_MS);
	}

	await saveResults({
		meta: buildMeta(
			startedAt,
			totalInQueue,
			results,
			counters.succeeded,
			counters.failed,
			counters.published,
		),
		results,
	});

	printSummary(results, counters.succeeded, counters.failed, counters.published, totalInQueue);
}

main().catch((err) => {
	console.error("\nFatal error:", err);
	process.exit(1);
});
