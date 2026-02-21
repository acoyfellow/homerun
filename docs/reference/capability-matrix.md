# Capability matrix (v0)

| Area | Status | Notes |
|---|---|---|
| Local HTTP proxy | Working | Verified via `curl -x http://127.0.0.1:8080 ...` |
| Live traffic list in dashboard | Working | Updates with proxied HTTP responses |
| Reverse tunnel client | Working with valid relay/auth | Requires deployed worker + correct `API_KEY` |
| Tunnel auth UX | Basic | Raw key input; reconnect loop on failures |
| HTTPS proxying (`CONNECT`) | Incomplete | Not production-ready in current implementation |
| MCP integration | Partial/scaffolded | MCP server code exists, not started in desktop runtime |
| Sessions in desktop app RPC | Stubbed | `listSessions`/`getSession` return placeholder values |
| Form replay | Partial/scaffolded | Core code exists; full flow not wired in app |
