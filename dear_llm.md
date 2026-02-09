# unsurf — Development Progress & North Star

## North Star

**Turn any website into a typed API.** An agent visits a site, captures every API call happening under the hood, and gives you back an OpenAPI spec, a TypeScript client, and replayable execution paths. No reverse engineering. No docs. No browser needed after the first pass.

Three MCP tools: **Scout** (explore + capture), **Worker** (replay API directly), **Heal** (re-scout + diff + patch when sites change).

## Stack

- **Effect** — typed errors, DI via Layer/Context.Tag, streams, retries, Scope for resource safety
- **Alchemy** — infrastructure as TypeScript (replaces wrangler.toml). Handles D1 migrations automatically on deploy.
- **Drizzle** — typed SQL schema + queries (D1/SQLite)
- **Cloudflare Workers** — edge runtime
- **Cloudflare Browser Rendering** — headless Chrome via @cloudflare/puppeteer
- **D1** + **R2** — storage
- **Biome** — lint + format (tabs, 100 line width)
- **Vitest** — tests
- **Astro Starlight** — docs site at unsurf.coey.dev

## Architecture

Every service is a `Context.Tag` with a live implementation (CF bindings) and a test implementation (in-memory). Business logic uses the service interface; layers swap implementations.

- `src/domain/` — Effect Schema definitions (Endpoint, Path, NetworkEvent, Errors, Site)
- `src/db/` — Drizzle schema + typed query helpers
- `src/services/` — Effect services (Browser, Store, SchemaInferrer, OpenApiGenerator)
- `src/tools/` — MCP tool implementations (Scout, Worker, Heal)
- `src/ai/` — LLM scout agent
- `src/lib/` — utilities (url normalization, codegen)
- `src/Api.ts` — HttpApi definition
- `src/ApiLive.ts` — HttpApiBuilder handlers
- `src/index.ts` — Worker entry point

## Conventions

- `exactOptionalPropertyTypes: true` — use `?: T | undefined` not `?: T`
- Effect `Schema.optionalWith(..., { as: "Option" })` produces `Option<T>`, handle with `Option.isSome/getOrUndefined`
- Alchemy handles D1 migrations automatically — users never run `drizzle-kit generate`
- Biome ignores: `docs/`, `migrations/`, `node_modules/`, `dist/`, `.alchemy/`, `.wrangler/`
- Git: pre-push secret scanning hook
- CI: check + typecheck + test in `check` job; docs build + deploy in `docs` job

## Roadmap — 10 Phases

### ✅ Phase 1 — Skeleton (v0.0.1)
- Domain types, stub services, HttpApi definition, Worker entry point
- URL normalization + tests
- Commit: `faf2e0e`

### ✅ Phase 2 — Drizzle Store
- `src/db/queries.ts` — typed CRUD for sites, endpoints, paths, runs
- `src/services/Store.ts` — D1+R2 live impl + in-memory test impl
- Option handling for lastUsedAt, requestSchema, responseSchema
- Migration: `0000_good_the_call.sql` (4 tables)
- 11 tests
- Commit: `572ad93`

### ✅ Phase 3 — Browser Service
- `src/services/Browser.ts` — CF Puppeteer impl with Scope-managed lifecycle
- Network capture: request interception + response pairing → NetworkEvent stream
- WeakMap for request ID tracking, extracted helper functions
- click, type, waitForSelector, waitForNavigation, evaluate, screenshot
- Test browser + configurable test browser with injected events
- `src/domain/NetworkEvent.ts` — API filtering (skip images/analytics/fonts)
- 9 tests
- Commit: `93de298`

### ✅ Phase 4 — Schema Inferrer
- JSON → JSON Schema inference (all types + nested objects/arrays)
- Format detection: date-time, date, email, uri, uuid
- Schema merging: same-type deep merge, integer+number→number, anyOf for different types
- Object merge: union properties, required only if in all samples
- 22 tests
- Commit: `b37d8ef`

### ✅ Phase 5 — OpenAPI Generator
- CapturedEndpoints → OpenAPI 3.1 spec
- Path params (:id → {id}), request body for POST/PUT/PATCH
- Group methods under same path, server URL
- 8 tests
- Commit: `b37d8ef`

### 🔲 Phase 6 — Scout Tool
The big integration phase. Wire Browser + SchemaInferrer + OpenApiGenerator + Store:
- Navigate to URL, capture network traffic
- Filter to API requests, normalize URL patterns, group by endpoint
- Infer schemas from response bodies
- Save site, endpoints, paths to Store
- Generate and return OpenAPI spec
- Return siteId, endpointCount, pathId, openApiSpec

### 🔲 Phase 7 — Worker Tool
- Replay a scouted path by calling the API directly (no browser)
- Load path + endpoints from Store
- Execute HTTP calls with captured headers/auth
- Validate response against stored schema
- Save run history

### 🔲 Phase 8 — Heal Tool
- Re-scout when a path is broken
- Diff old vs new endpoints
- Patch stored path
- Retry execution
- Update path status (active/broken/healing)

### 🔲 Phase 9 — API + Worker Entry Point
- Wire ToolsLive handlers to real Scout/Worker/Heal
- Provide all layers (Store, Browser, SchemaInferrer, OpenApiGenerator)
- HttpApiBuilder → fetch handler in Worker entry point
- Health check, error handling, CORS

### 🔲 Phase 10 — Alchemy Infrastructure
- Verify alchemy.run.ts deploys correctly
- Custom domain setup
- CI deploys both docs + worker
- End-to-end test against live deployment

## Current Status

**55 tests passing** across 5 test files. Check + typecheck + lint all clean.

**Next up: Phase 6 (Scout Tool)** — the first tool that actually does something. Wires all the services together.

## Docs

- Live at https://unsurf.coey.dev
- 7 Diátaxis pages (tutorial, 3 how-to, 2 reference, 1 explanation)
- Dogfooding: `<SourceCode>` component imports real source files
- Auto-deployed from main via GitHub Actions

## Repo

https://github.com/acoyfellow/unsurf
