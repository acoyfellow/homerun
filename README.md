# homerun

Turn your laptop into a local HTTP proxy for web automation.

homerun is a desktop app that runs a proxy on `localhost:8080`, captures API traffic, infers OpenAPI specs, records and replays form submissions, and exposes everything through an MCP server for AI-powered automation.

## Features

- **HTTP Proxy** — Forward proxy on localhost:8080. Point your browser or scripts at it.
- **API Discovery** — Captures traffic, infers schemas, generates OpenAPI 3.1 specs automatically.
- **Form Automation** — Record form submissions, replay them with variable substitution.
- **Session Persistence** — Save and restore sessions with cookies, traffic history, and generated specs.
- **MCP Server** — Expose proxy controls, captured APIs, and form replay as MCP tools for AI agents.
- **System Tray** — Start/stop proxy, switch sessions, and access the dashboard from your menu bar.

## How It Works

```
Browser/Script ──► homerun (localhost:8080) ──► Target Website
                         │
                    Captures traffic
                    Infers schemas
                    Records forms
                         │
                    Generates OpenAPI spec
                    Persists sessions
                    Serves MCP tools
```

1. **Configure your proxy** — Set `localhost:8080` as your HTTP proxy
2. **Browse normally** — homerun captures every request/response
3. **Get your API** — homerun infers the schema and generates an OpenAPI spec
4. **Automate** — Replay forms, use MCP tools, or export the spec

## Quick Start

```bash
# Install dependencies
bun install

# Development mode
bun run dev

# Run tests
bun test

# Type check
bun run typecheck

# Lint & format
bun run check
```

## Architecture

```
src/
├── bun/                # Main process (Bun runtime)
│   ├── proxy/          # HTTP/HTTPS proxy engine
│   ├── capture/        # Traffic recording (HAR format)
│   ├── discovery/      # Schema inference → OpenAPI
│   ├── forms/          # Form record & replay
│   ├── session/        # SQLite persistence
│   ├── mcp/            # MCP server (tools + resources)
│   └── tray/           # System tray controls
├── views/              # Desktop UI (webviews)
│   ├── dashboard/      # Main dashboard
│   └── traffic/        # Traffic inspector
└── shared/             # Types shared between processes
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `proxy_start` | Start the proxy server |
| `proxy_stop` | Stop the proxy server |
| `capture_start` | Begin traffic capture for a domain |
| `capture_stop` | End capture, return summary |
| `get_openapi_spec` | Generate OpenAPI from captured traffic |
| `replay_form` | Replay a recorded form sequence |
| `list_sessions` | List all saved sessions |
| `export_har` | Export traffic as HAR file |

## MCP Resources

| URI | Description |
|-----|-------------|
| `session://{id}` | Session details |
| `traffic://{session_id}` | Traffic entries for a session |
| `spec://{domain}` | Generated OpenAPI spec |

## Stack

- [Electrobun](https://electrobun.dev) — Desktop framework (Bun-native)
- [Bun](https://bun.sh) — Runtime, bundler, test runner, SQLite
- TypeScript — End-to-end type safety
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) — AI agent integration

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.1+
- macOS (Electrobun v1 primary target)

### Project Structure

The app runs two processes:

1. **Main process** (`src/bun/`) — Runs in Bun. Manages proxy, capture, storage, MCP server, and system tray.
2. **Renderer** (`src/views/`) — Runs in native WebView. Dashboard and traffic inspector UI.

Communication between processes uses Electrobun's type-safe RPC system.

### Scripts

```bash
bun run dev          # Start in development mode
bun run build        # Production build
bun run start        # Run production build
bun test             # Run all tests
bun test --watch     # Watch mode
bun run typecheck    # TypeScript check
bun run check        # Biome lint + format
bun run check:fix    # Auto-fix lint issues
```

## License

MIT
