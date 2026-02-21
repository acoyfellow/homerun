# Use cloud agents with your residential IP

This guide sets up the reverse tunnel so cloud workloads can route requests through your laptop.

## What this does

- Your agent runs in the cloud
- Requests enter your relay worker
- The relay forwards over WebSocket to your laptop tunnel client
- Your laptop performs outbound HTTP requests from your local network

## Prerequisites

- Working local app (`bun run dev`)
- Cloudflare account + `wrangler` login
- A secure API key for tunnel auth

## 1) Deploy the relay worker

```bash
cd /Users/jordan/Desktop/homerun/worker
bun install
bunx wrangler login
bunx wrangler secret put API_KEY
bun run deploy
```

When `wrangler secret put API_KEY` prompts, paste your chosen token.

## 2) Point the desktop app at your relay URL

Edit `/Users/jordan/Desktop/homerun/src/shared/constants.ts`:

- Set `DEFAULT_RELAY_URL` to your deployed worker URL, for example:
  - `wss://your-worker-name.your-subdomain.workers.dev`

Then rebuild and start:

```bash
cd /Users/jordan/Desktop/homerun
bunx electrobun
bun run dev
```

## 3) Connect tunnel in UI

In the app dashboard:

1. Enter the same API key you stored as `API_KEY`
2. (Optional) Enter an upstream URL, for example `http://localhost:3000`
3. Click `Start Tunnel`

Expected: state changes to `Connected` and you get a tunnel URL.

## 4) Send traffic through the tunnel

### Option A: with upstream configured

If you set upstream to `http://localhost:3000`, call:

```bash
curl https://your-worker.workers.dev/<tunnel-id>/api/health
```

### Option B: no upstream configured

Set target per request using `X-Tunnel-Target`:

```bash
curl \
  -H "X-Tunnel-Target: https://httpbin.org/get" \
  https://your-worker.workers.dev/<tunnel-id>/
```

## Notes

- Tunnel auth is exact match against worker `API_KEY`.
- Keep the desktop app running while tunnel traffic is active.
