# Network and tunnel protocol

## Local proxy

- Address: `http://127.0.0.1:8080`
- Type: forward HTTP proxy

## Relay worker endpoints

- Health: `GET /health`
- Tunnel WebSocket: `GET /ws/:tunnelId?token=...` with `Upgrade: websocket`
- Tunnel ingress: `/:tunnelId/...`

## Authentication

- Worker expects query param `token`
- `token` must equal worker secret `API_KEY`
- On mismatch, worker responds `401 Unauthorized`

## Target selection rules

When relay receives `/:tunnelId/...`:

1. If tunnel connected with `upstream`, request is forwarded to `upstream + path + query`
2. Otherwise, request must include header `X-Tunnel-Target` with full destination URL

## Key defaults in code

From `/Users/jordan/Desktop/homerun/src/shared/constants.ts`:

- `PROXY_PORT = 8080`
- `DEFAULT_RELAY_URL = "wss://homerun-relay.workers.dev"`
- `TUNNEL_PING_INTERVAL = 30000`
- `TUNNEL_PONG_TIMEOUT = 10000`
- `TUNNEL_REQUEST_TIMEOUT = 30000`
