# Commands and scripts

## Root project scripts

From `/Users/jordan/Desktop/homerun`:

- `bun run dev`: start desktop app in dev mode
- `bun run build`: build production app
- `bun run start`: run production build
- `bun test`: run tests
- `bun run typecheck`: TypeScript check
- `bun run check`: Biome check
- `bun run check:fix`: Biome autofix

## Worker scripts

From `/Users/jordan/Desktop/homerun/worker`:

- `bun run dev`: run relay worker locally via Wrangler
- `bun run deploy`: deploy relay to Cloudflare
- `bun run tail`: stream worker logs
- `bun run typecheck`: TypeScript check

## Typical local verification flow

```bash
cd /Users/jordan/Desktop/homerun
bunx electrobun
bun run dev
```

In another terminal:

```bash
curl -x http://127.0.0.1:8080 http://httpbin.org/get
```
