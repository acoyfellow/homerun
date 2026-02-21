# Troubleshoot common issues

## Tunnel stuck on Connecting/Reconnecting

Check these first:

1. **Bad API key**
   - The value in UI must exactly match the worker secret `API_KEY`.
2. **Wrong relay URL**
   - Verify `DEFAULT_RELAY_URL` in `/Users/jordan/Desktop/homerun/src/shared/constants.ts`.
3. **Relay unreachable**
   - Test health endpoint:

```bash
curl -I https://your-worker.workers.dev/health
```

4. **App not running**
   - Tunnel requires the desktop app process to stay alive.

## Request counter stays at 0

1. Confirm proxy is running in UI.
2. Test with plain HTTP first:

```bash
curl -x http://127.0.0.1:8080 http://httpbin.org/get
```

3. If that works, the dashboard should increment `Requests` and append a traffic row.

## `Failed to start server. Is port 8080 in use?`

Find what is listening:

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN
```

Stop or reconfigure the conflicting process, then start proxy again.

## `bun run dev` fails with missing launcher/app bundle files

Run a fresh build once:

```bash
bunx electrobun
```

Then retry:

```bash
bun run dev
```
