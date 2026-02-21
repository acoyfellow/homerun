# homerun

Run cloud agents in the cloud, but route their web requests through your laptop so they use your residential IP.

`homerun` is a desktop app with a local proxy (`localhost:8080`), live traffic capture UI, and an optional reverse tunnel.

## Status (v0 / pre-beta)

### Works today

- Local HTTP proxy on `127.0.0.1:8080`
- Live dashboard updates for request count + recent traffic
- Reverse tunnel client (when connected to a valid relay + API key)

### Not complete yet

- HTTPS `CONNECT` proxying is not production-ready yet
- MCP server code exists, but is not wired into the desktop app runtime
- Session/form automation flows are scaffolded but not fully wired in UI

## 5-minute quick start

```bash
bun install
bunx electrobun
bun run dev
```

In another terminal, send one request through the proxy:

```bash
curl -x http://127.0.0.1:8080 http://httpbin.org/get
```

You should see `Requests` increment and a row appear in `Recent Traffic`.

## Documentation (Diataxis)

- Tutorial: [/docs/tutorials/first-request-through-proxy.md](docs/tutorials/first-request-through-proxy.md)
- How-to guides: [/docs/how-to/](docs/how-to/)
- Reference: [/docs/reference/](docs/reference/)
- Explanation: [/docs/explanation/](docs/explanation/)

Start from [/docs/README.md](docs/README.md).

## License

MIT
