# Architecture and product intent

## Why this exists

Most cloud agents run from datacenter IPs, which can be blocked or treated differently.

`homerun` is designed to let you:

- keep agent execution in the cloud
- keep network identity on your laptop/home network

That is the "cloud brains, local network identity" model.

## Current architecture (v0)

- **Desktop app (Electrobun + Bun)**
  - Runs local proxy on `:8080`
  - Captures request/response traffic
  - Hosts dashboard UI
  - Maintains optional tunnel WebSocket connection

- **Relay worker (Cloudflare Worker + Durable Object)**
  - Authenticates tunnel connection using `API_KEY`
  - Accepts remote HTTP requests
  - Forwards requests to connected laptop tunnel client

## Data flow

1. Cloud request reaches relay (`/:tunnelId/...`)
2. Relay forwards as binary frame over tunnel WebSocket
3. Laptop executes outbound request
4. Response is framed back to relay
5. Relay returns HTTP response to cloud caller

## Why docs are split this way

- Tutorial gets first success fast
- How-to pages solve concrete tasks (deploy relay, debug failures)
- Reference pages are exact facts (ports, endpoints, scripts)
- Explanation captures intent and tradeoffs

## Known limitations in this phase

- Proxy focus is HTTP-first; HTTPS proxying is not production-ready
- Auth and failure UX is minimal
- MCP/session/forms paths are not fully integrated in runtime

This is intentional for pre-beta velocity: stabilize core proxy+tunnel path before broadening scope.
