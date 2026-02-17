# homerun — Implementation Plan

> Turn your laptop into a local HTTP proxy for web automation.

## Architecture Overview

```
                    +-----------------------+
                    |    Electrobun App      |
                    |  (System Tray + UI)    |
                    +-----------+-----------+
                                |
                    +-----------+-----------+
                    |    Main Process (Bun)  |
                    |                        |
                    |  +------------------+  |
                    |  |  Proxy Engine    |  |
                    |  |  localhost:8080  |  |
                    |  +--------+---------+  |
                    |           |             |
                    |  +--------+---------+  |
                    |  | Traffic Capture  |  |
                    |  | (HAR Recording)  |  |
                    |  +--------+---------+  |
                    |           |             |
                    |  +--------+---------+  |
                    |  | Schema Inferrer  |  |
                    |  | (→ OpenAPI)      |  |
                    |  +--------+---------+  |
                    |           |             |
                    |  +--------+---------+  |
                    |  | Form Recorder    |  |
                    |  | (Record/Replay)  |  |
                    |  +--------+---------+  |
                    |           |             |
                    |  +--------+---------+  |
                    |  | Session Store    |  |
                    |  | (SQLite/JSON)    |  |
                    |  +--------+---------+  |
                    |           |             |
                    |  +--------+---------+  |
                    |  | MCP Server       |  |
                    |  | (stdio/SSE)      |  |
                    |  +------------------+  |
                    +-----------------------+
```

---

## 1. Folder Structure

```
homerun/
├── electrobun.config.ts          # Electrobun build config
├── package.json
├── tsconfig.json
├── biome.json
├── .gitignore
├── README.md
├── PLAN.md
│
├── src/
│   ├── bun/                      # Main process (Bun runtime)
│   │   ├── index.ts              # Entry point: boots proxy, tray, windows
│   │   ├── types/
│   │   │   └── rpc.ts            # RPC schema (main ↔ webview)
│   │   │
│   │   ├── proxy/
│   │   │   ├── server.ts         # HTTP/HTTPS proxy server (Bun.serve)
│   │   │   ├── tunnel.ts         # CONNECT tunnel handler (HTTPS)
│   │   │   ├── interceptor.ts    # Request/response interceptor & transform
│   │   │   └── certificate.ts    # Self-signed CA for HTTPS interception
│   │   │
│   │   ├── capture/
│   │   │   ├── recorder.ts       # Traffic capture → HAR format
│   │   │   ├── har.ts            # HAR type definitions & serialization
│   │   │   └── filter.ts         # Domain/path filtering rules
│   │   │
│   │   ├── discovery/
│   │   │   ├── inferrer.ts       # Schema inference from captured traffic
│   │   │   ├── openapi.ts        # OpenAPI 3.1 spec generator
│   │   │   ├── merger.ts         # Merge multiple captures into one spec
│   │   │   └── types.ts          # Inferred schema types
│   │   │
│   │   ├── forms/
│   │   │   ├── recorder.ts       # Form interaction recorder
│   │   │   ├── replayer.ts       # Form replay engine
│   │   │   └── types.ts          # Form action types
│   │   │
│   │   ├── session/
│   │   │   ├── store.ts          # Session persistence (SQLite via bun:sqlite)
│   │   │   ├── cookies.ts        # Cookie jar management
│   │   │   └── migrations.ts     # DB schema migrations
│   │   │
│   │   ├── mcp/
│   │   │   ├── server.ts         # MCP server (JSON-RPC over stdio/SSE)
│   │   │   ├── tools.ts          # MCP tool definitions
│   │   │   └── resources.ts      # MCP resource definitions
│   │   │
│   │   └── tray/
│   │       └── menu.ts           # System tray icon & menu
│   │
│   ├── views/                    # Webview UI (rendered in BrowserWindow)
│   │   ├── dashboard/
│   │   │   ├── index.html
│   │   │   ├── index.ts
│   │   │   └── style.css
│   │   ├── traffic/
│   │   │   ├── index.html
│   │   │   ├── index.ts
│   │   │   └── style.css
│   │   └── assets/
│   │       └── icon.png
│   │
│   └── shared/                   # Shared types between bun & views
│       ├── types.ts              # Domain types
│       ├── constants.ts          # Ports, defaults
│       └── events.ts             # Event names
│
├── test/
│   ├── proxy/
│   │   ├── server.test.ts
│   │   ├── tunnel.test.ts
│   │   └── interceptor.test.ts
│   ├── capture/
│   │   ├── recorder.test.ts
│   │   └── har.test.ts
│   ├── discovery/
│   │   ├── inferrer.test.ts
│   │   └── openapi.test.ts
│   ├── forms/
│   │   ├── recorder.test.ts
│   │   └── replayer.test.ts
│   ├── session/
│   │   └── store.test.ts
│   ├── mcp/
│   │   └── server.test.ts
│   └── fixtures/
│       ├── sample-har.json
│       └── sample-openapi.json
│
└── scripts/
    ├── generate-ca.ts            # Generate local CA cert
    └── dev.ts                    # Dev helper scripts
```

---

## 2. Dependencies

### Runtime Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `electrobun` | Desktop framework (Bun-native) | `^1.0.0` |
| `@modelcontextprotocol/sdk` | MCP server SDK | `^1.x` |
| `zod` | Runtime validation & schema | `^3.x` |
| `yaml` | OpenAPI YAML serialization | `^2.x` |
| `nanoid` | ID generation | `^5.x` |

### Dev Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `typescript` | Type checking | `^5.x` |
| `@biomejs/biome` | Lint + format | `^1.x` |
| `@types/bun` | Bun type defs | `latest` |

### Bun Built-ins (no install needed)

| Built-in | Purpose |
|----------|---------|
| `Bun.serve()` | HTTP proxy server |
| `Bun.connect()` | TCP tunnel for CONNECT |
| `bun:sqlite` | Session/traffic persistence |
| `bun:test` | Test runner |
| `Bun.CryptoHasher` | Certificate fingerprinting |
| `node:tls` | TLS for HTTPS interception |
| `node:net` | TCP socket management |

---

## 3. Implementation Phases

### Phase 0: Project Scaffold
**Effort:** 1 hour | **Dependencies:** None

- [x] `bun init` + folder structure
- [x] `electrobun.config.ts`
- [x] `tsconfig.json`, `biome.json`, `.gitignore`
- [x] `package.json` with scripts
- [x] `README.md`
- [x] Git init + initial commit

### Phase 1: HTTP Proxy Core
**Effort:** 4-6 hours | **Dependencies:** Phase 0

```
1a. HTTP Proxy Server          1b. Shared Types & Constants
    ├── Bun.serve() on :8080       ├── ProxyRequest type
    ├── Request forwarding         ├── ProxyResponse type
    └── Response passthrough       └── Config constants
         │
         ▼
1c. CONNECT Tunnel Handler
    ├── Bun.connect() TCP
    ├── Pipe client ↔ upstream
    └── 200 Connection Established
         │
         ▼
1d. Request/Response Interceptor
    ├── Before-request hooks
    ├── After-response hooks
    └── Header manipulation
```

**Files:**
- `src/bun/proxy/server.ts` — `Bun.serve()` HTTP proxy
- `src/bun/proxy/tunnel.ts` — CONNECT method TCP tunnel
- `src/bun/proxy/interceptor.ts` — Hook system for req/res
- `src/shared/types.ts` — Request/Response domain types
- `src/shared/constants.ts` — `PROXY_PORT = 8080`

**Key decisions:**
- HTTP proxy via `Bun.serve()` with `fetch` handler
- CONNECT tunnel via raw TCP (`Bun.connect()`)
- Phase 1 does **not** decrypt HTTPS (just tunnels)
- Interceptor uses a plugin/hook pattern for extensibility

### Phase 2: Traffic Capture
**Effort:** 3-4 hours | **Dependencies:** Phase 1

```
2a. HAR Types & Serialization
    ├── HAR 1.2 spec types
    ├── Entry builder
    └── JSON serialization
         │
         ▼
2b. Traffic Recorder              2c. Domain Filter
    ├── Hooks into interceptor        ├── Include/exclude rules
    ├── Captures req/res pairs        ├── Glob matching
    ├── Timing measurement            └── Content-type filter
    └── Streams to HAR log
```

**Files:**
- `src/bun/capture/har.ts` — HAR 1.2 types + builder
- `src/bun/capture/recorder.ts` — Capture engine (wires into interceptor hooks)
- `src/bun/capture/filter.ts` — Domain/path/content-type filtering

### Phase 3: API Discovery
**Effort:** 6-8 hours | **Dependencies:** Phase 2

```
3a. Schema Inferrer                3b. OpenAPI Generator
    ├── JSON body → JSON Schema        ├── HAR entries → paths
    ├── Query param inference          ├── Schema refs
    ├── Header pattern detection       ├── Info/server blocks
    └── Type narrowing                 └── YAML/JSON output
              │                              │
              └──────────┬───────────────────┘
                         ▼
                   3c. Spec Merger
                       ├── Merge multiple captures
                       ├── Union/intersect schemas
                       └── Deduplicate endpoints
```

**Files:**
- `src/bun/discovery/inferrer.ts` — Value → JSON Schema inference
- `src/bun/discovery/openapi.ts` — Build OpenAPI 3.1 from inferred data
- `src/bun/discovery/merger.ts` — Merge multiple sessions into one spec
- `src/bun/discovery/types.ts` — Intermediate inference types

### Phase 4: Form Automation
**Effort:** 4-5 hours | **Dependencies:** Phase 1

```
4a. Form Recorder                  4b. Form Replayer
    ├── Inject JS into webview         ├── Load recorded actions
    ├── Capture form submissions       ├── Execute via fetch
    ├── Track field names/values       ├── Variable substitution
    └── Save action sequences          └── Retry logic
```

**Files:**
- `src/bun/forms/recorder.ts` — Record form submissions via proxy intercept
- `src/bun/forms/replayer.ts` — Replay captured form sequences
- `src/bun/forms/types.ts` — FormAction, FormSequence types

### Phase 5: Session Persistence
**Effort:** 3-4 hours | **Dependencies:** Phase 2, Phase 4

```
5a. SQLite Store                   5b. Cookie Jar
    ├── bun:sqlite                     ├── Set-Cookie capture
    ├── Sessions table                 ├── Cookie replay
    ├── Traffic entries table          ├── Domain scoping
    ├── Forms table                    └── Expiry handling
    └── Specs table
         │
         ▼
5c. Migrations
    ├── Version tracking
    ├── Up/down functions
    └── Auto-run on start
```

**Files:**
- `src/bun/session/store.ts` — SQLite CRUD (bun:sqlite)
- `src/bun/session/cookies.ts` — Cookie jar tied to sessions
- `src/bun/session/migrations.ts` — Schema versioning

**Schema:**
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE traffic (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  status INTEGER,
  request_headers TEXT,  -- JSON
  response_headers TEXT, -- JSON
  request_body BLOB,
  response_body BLOB,
  timing TEXT,           -- JSON (HAR timing)
  created_at INTEGER NOT NULL
);

CREATE TABLE form_sequences (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  name TEXT NOT NULL,
  actions TEXT NOT NULL,  -- JSON array of FormAction
  created_at INTEGER NOT NULL
);

CREATE TABLE specs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  domain TEXT NOT NULL,
  spec TEXT NOT NULL,     -- OpenAPI JSON
  version TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE cookies (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  domain TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  path TEXT DEFAULT '/',
  expires INTEGER,
  secure INTEGER DEFAULT 0,
  http_only INTEGER DEFAULT 0
);
```

### Phase 6: Desktop UI
**Effort:** 6-8 hours | **Dependencies:** Phase 1-5

```
6a. System Tray                    6b. Dashboard View
    ├── Tray icon                      ├── Proxy status
    ├── Start/Stop proxy               ├── Active sessions
    ├── Quick session switch           ├── Recent traffic
    └── Quit                           └── Quick actions
         │                                   │
         ▼                                   ▼
6c. Traffic Inspector              6d. RPC Wiring
    ├── Request list                   ├── Type-safe RPC schema
    ├── Req/Res detail                 ├── Bun ↔ Webview comms
    ├── HAR export                     └── Event streaming
    └── OpenAPI preview
```

**Files:**
- `src/bun/tray/menu.ts` — System tray + menu
- `src/bun/types/rpc.ts` — RPC schema definition
- `src/views/dashboard/` — Main dashboard webview
- `src/views/traffic/` — Traffic inspector webview

### Phase 7: MCP Server
**Effort:** 4-5 hours | **Dependencies:** Phase 1-5

```
7a. MCP Server Core                7b. Tool Definitions
    ├── JSON-RPC handler               ├── proxy_start / proxy_stop
    ├── stdio transport                ├── capture_traffic
    ├── SSE transport                  ├── get_openapi_spec
    └── Session management             ├── replay_form
                                       ├── list_sessions
         7c. Resource Definitions      └── export_har
             ├── session://
             ├── traffic://
             └── spec://
```

**MCP Tools:**

| Tool | Description |
|------|-------------|
| `proxy_start` | Start proxy on configurable port |
| `proxy_stop` | Stop the proxy |
| `capture_start` | Begin traffic capture for a domain |
| `capture_stop` | End capture, return summary |
| `get_openapi_spec` | Generate OpenAPI from captured traffic |
| `replay_form` | Replay a recorded form sequence |
| `list_sessions` | List all saved sessions |
| `export_har` | Export traffic as HAR file |

**MCP Resources:**

| URI Pattern | Description |
|-------------|-------------|
| `session://{id}` | Session details |
| `traffic://{session_id}` | Traffic entries |
| `spec://{domain}` | Generated OpenAPI spec |

---

## 4. Parallel Task Graph

```
Phase 0 (Scaffold)
    │
    ├──────────────────────────────────┐
    ▼                                  ▼
Phase 1 (Proxy Core)            Phase 1b (Shared Types)
    │                                  │
    ├──────────┬───────────┬───────────┤
    ▼          ▼           ▼           │
Phase 2    Phase 4     Phase 6a       │
(Capture)  (Forms)     (Tray)         │
    │          │           │           │
    ▼          │           │           │
Phase 3       │           │           │
(Discovery)   │           │           │
    │          │           │           │
    ├──────────┤           │           │
    ▼          ▼           │           │
Phase 5 (Session Store)    │           │
    │                      │           │
    ├──────────────────────┤           │
    ▼                      ▼           │
Phase 6b-d (UI Views)                 │
    │                                  │
    ├──────────────────────────────────┤
    ▼
Phase 7 (MCP Server)
```

### Parallelizable Work Streams

**Stream A (Data Pipeline):** Phase 1 → 2 → 3 → 5
**Stream B (Automation):** Phase 1 → 4 → 5
**Stream C (Desktop Shell):** Phase 0 → 6a → 6b-d
**Stream D (Integration):** Phase 5 → 7

Streams A and B can run in parallel after Phase 1.
Stream C can start immediately after Phase 0.
Stream D starts after A+B converge at Phase 5.

---

## 5. Commit Strategy

Atomic commits, each buildable. Prefix with scope.

```
# Phase 0
scaffold: init electrobun project with folder structure
scaffold: add tsconfig, biome, and dev tooling
scaffold: add README with project overview

# Phase 1
proxy: implement HTTP forward proxy with Bun.serve
proxy: add CONNECT tunnel for HTTPS passthrough
proxy: add request/response interceptor hooks

# Phase 2
capture: add HAR 1.2 types and entry builder
capture: implement traffic recorder with filtering
capture: wire recorder into proxy interceptor

# Phase 3
discovery: implement JSON schema inference from values
discovery: generate OpenAPI 3.1 from captured traffic
discovery: add spec merger for multi-session captures

# Phase 4
forms: implement form submission recorder
forms: add form replay engine with variable substitution

# Phase 5
session: add SQLite store with migrations
session: implement cookie jar management
session: persist traffic, forms, and specs to store

# Phase 6
ui: add system tray with proxy controls
ui: create dashboard view with session list
ui: add traffic inspector with req/res detail
ui: wire RPC between main process and webviews

# Phase 7
mcp: implement MCP server with stdio transport
mcp: add proxy and capture tools
mcp: add session and spec resources
```

---

## 6. Testing Approach

### Unit Tests (bun:test)

Every module gets a co-located test in `test/`:

```typescript
// test/proxy/server.test.ts
import { describe, test, expect } from "bun:test";
import { createProxyServer } from "../../src/bun/proxy/server";

describe("Proxy Server", () => {
  test("forwards HTTP GET requests", async () => {
    const proxy = createProxyServer({ port: 0 }); // random port
    const res = await fetch("http://httpbin.org/get", {
      proxy: `http://localhost:${proxy.port}`,
    });
    expect(res.status).toBe(200);
    proxy.stop();
  });
});
```

### Integration Tests

- Proxy → Capture → OpenAPI pipeline end-to-end
- Form record → replay cycle
- Session save → load round-trip
- MCP tool invocation → proxy action

### Test Matrix

| Module | Unit | Integration | Manual |
|--------|------|-------------|--------|
| Proxy Server | x | x | |
| CONNECT Tunnel | x | x | |
| Interceptor | x | | |
| HAR Recorder | x | x | |
| Schema Inferrer | x | | |
| OpenAPI Generator | x | x | |
| Form Recorder | x | | x |
| Form Replayer | x | x | |
| Session Store | x | x | |
| Cookie Jar | x | | |
| MCP Server | x | x | |
| System Tray | | | x |
| Dashboard UI | | | x |

### Test Commands

```bash
bun test                    # All tests
bun test --filter proxy     # Module-specific
bun test --watch            # Watch mode
```

---

## 7. Key Technical Decisions

### Proxy Architecture
- **HTTP:** `Bun.serve()` with custom `fetch` handler that forwards requests upstream
- **HTTPS:** CONNECT tunnel via `Bun.connect()` — raw TCP pipe, no decryption in v1
- **Future:** Optional MITM with generated CA certs for HTTPS body inspection

### Storage
- **`bun:sqlite`** for structured data (sessions, traffic metadata, forms)
- **Filesystem** for large response bodies (referenced by ID)
- **`Utils.paths.userData`** for Electrobun-scoped data directory

### Schema Inference
- Sample-based: collect N responses, infer union type
- JSON values → JSON Schema draft 2020-12
- Query params: string analysis (number, boolean, enum detection)
- Merge strategy: union for response variants, intersect for required fields

### MCP Integration
- stdio transport primary (for Claude Desktop, Cursor, etc.)
- SSE transport secondary (for web-based MCP clients)
- Tools map 1:1 to proxy/capture/replay operations
- Resources expose live session data

---

## 8. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Electrobun v1 API changes | Pin version, abstract behind interfaces |
| HTTPS interception complexity | Phase 1 = tunnel only, defer MITM to later |
| Bun.serve() proxy limitations | Fallback to raw TCP server if needed |
| SQLite concurrency | Single-writer pattern, WAL mode |
| Large response bodies | Stream to disk, reference by hash |
| MCP SDK compatibility | Pin SDK version, integration test suite |

---

## 9. Success Criteria (MVP)

- [ ] Proxy starts on `localhost:8080` from system tray
- [ ] HTTP requests are forwarded and captured
- [ ] HTTPS requests tunnel through (no body capture)
- [ ] Captured traffic generates valid OpenAPI 3.1 spec
- [ ] Sessions persist across app restarts
- [ ] MCP server responds to `proxy_start` and `get_openapi_spec`
- [ ] Clean, atomic git history with meaningful commits
