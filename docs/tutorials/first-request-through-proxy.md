# First request through local proxy

This tutorial gets you to one successful proxied request visible in the desktop app.

## Goal

Route a request through `homerun` and confirm it appears in `Recent Traffic`.

## Prerequisites

- macOS
- Bun installed
- Repository cloned

## Steps

1. Install dependencies.

```bash
bun install
```

2. Build the app bundle once.

```bash
bunx electrobun
```

3. Start the app.

```bash
bun run dev
```

4. Send a request through the local proxy from another terminal.

```bash
curl -x http://127.0.0.1:8080 http://httpbin.org/get
```

5. Verify in the app UI.

- `Requests` increments by at least 1
- A new row appears under `Recent Traffic`

## What you just proved

- The proxy is listening on `:8080`
- Requests are forwarded successfully
- Traffic capture is wired to the dashboard

## Next

- Task-oriented setup: [Use cloud agents with your residential IP](../how-to/use-cloud-agents-with-residential-ip.md)
- Troubleshooting: [Troubleshoot common issues](../how-to/troubleshoot.md)
