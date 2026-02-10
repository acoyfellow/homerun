# unsurf

**The typed internet.** A machine-readable directory of every API on the web.

```
agent: "I need to submit a contact form on acme.com"
unsurf: here's the endpoint, here's the schema, here's working code
```

## Why

Agents are blind. They can browse, but they can't *see*. Every website is a black box until someone reverse-engineers it.

unsurf fixes this. Once any agent scouts a site, every agent knows that site forever. The more agents use unsurf, the more the internet becomes typed.

**One scout. Infinite replays.**

## For Agents

### Find an API (3 tokens)

```
GET /d/stripe.com
```

Returns a **fingerprint** — a 50-token summary of what's available:

```json
{
  "domain": "stripe.com",
  "endpoints": 47,
  "capabilities": ["payments", "subscriptions", "customers", "invoices"],
  "auth": "bearer",
  "confidence": 0.94,
  "specUrl": "/d/stripe.com/spec"
}
```

No spec download. No bloat. Just enough to decide: *is this what I need?*

### Get what you need (surgical)

```
GET /d/stripe.com/payments
```

Returns only the payment-related endpoints. ~200 tokens instead of 50,000.

```
GET /d/stripe.com/POST/charges
```

Returns one endpoint. ~80 tokens. Request schema, response schema, auth requirements, example.

### Full spec (when you need it)

```
GET /d/stripe.com/spec
```

Complete OpenAPI 3.1. Use sparingly — this is the expensive path.

### Search across all APIs

```
GET /search?q=submit+contact+form
```

Semantic search across 100K+ sites. Returns fingerprints, ranked by relevance.

```json
{
  "results": [
    { "domain": "acme.com", "match": "POST /api/contact", "confidence": 0.91 },
    { "domain": "example.org", "match": "POST /forms/inquiry", "confidence": 0.87 }
  ]
}
```

[?] **Should search be free/rate-limited, or require auth?**

## For Humans

### Browse the directory

https://unsurf.dev/directory

Searchable catalog of every API unsurf knows. Filter by category, auth type, popularity. See which sites have been scouted, when, and by whom.

[?] **Is this a separate domain (unsurf.dev) or stays under coey.dev?**

### Contribute a site

```bash
npx unsurf scout https://example.com --publish
```

Scout locally, publish to the directory. Your contribution helps every agent.

[?] **Should publishing require GitHub auth for attribution, or stay anonymous?**

### Request a site

Can't scout it yourself? Request it. Community members with Browser Rendering access will pick it up.

```bash
npx unsurf request https://hard-to-scout-site.com
```

[?] **Is there a bounty/incentive system for fulfilling requests?**

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         unsurf directory                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   /d/:domain          → fingerprint (50 tokens)                 │
│   /d/:domain/:cap     → capability slice (200 tokens)           │
│   /d/:domain/:method/:path → single endpoint (80 tokens)        │
│   /d/:domain/spec     → full OpenAPI (expensive)                │
│   /search?q=          → semantic search (ranked fingerprints)   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│   │ D1 + FTS │  │ Vectorize│  │    R2    │  │    KV    │       │
│   │ metadata │  │ semantic │  │  specs   │  │  cache   │       │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Token budget by operation

| Operation | Tokens | Use case |
|-----------|--------|----------|
| Fingerprint | ~50 | "Do you have this domain?" |
| Capability slice | ~200 | "Show me payment endpoints" |
| Single endpoint | ~80 | "How do I POST /charges?" |
| Search results | ~30/result | "Find contact form APIs" |
| Full spec | 5K-50K | Code generation, full integration |

Agents should almost never need the full spec. The directory is designed for surgical reads.

## Data Model

### Fingerprint (the atomic unit)

Every domain gets a fingerprint — a compressed summary optimized for agent decision-making:

```typescript
interface Fingerprint {
  domain: string
  url: string                    // canonical URL scouted
  endpoints: number              // count
  capabilities: string[]         // auto-classified: ["auth", "payments", "crud"]
  methods: Record<string, number> // { "GET": 12, "POST": 8, "PUT": 3 }
  auth: "none" | "bearer" | "cookie" | "api-key" | "oauth" | "unknown"
  confidence: number             // 0-1, based on sample count + schema completeness
  lastScouted: string            // ISO timestamp
  version: number                // increments on re-scout
}
```

[?] **Should fingerprints include a "popularity" score based on query volume?**

### Capability (grouping)

Endpoints are auto-grouped by capability using path patterns + response shapes:

- `/users/*`, `/auth/*`, `/login` → `auth`
- `/payments/*`, `/charges/*`, `/invoices/*` → `payments`
- `/posts/*`, `/comments/*`, `/feed` → `content`
- CRUD patterns on any resource → `crud`

[?] **Is this classification ML-based (embeddings) or rule-based (path patterns)?**

### Endpoint (the detail)

```typescript
interface EndpointSummary {
  method: string
  path: string                   // normalized pattern: /users/:id
  summary: string                // auto-generated: "Get user by ID"
  requestSchema?: JSONSchema     // only if has body
  responseSchema: JSONSchema
  auth: boolean
  example?: {                    // optional, from captured traffic
    request: unknown
    response: unknown
  }
}
```

## Templates

[?] **This is where I'm least clear on your vision. What are "templates"?**

My current interpretation:

### Option A: Code templates

Generated TypeScript/Python clients for common integrations:

```bash
npx unsurf codegen stripe.com --lang ts
```

Outputs:

```typescript
// stripe.ts - generated by unsurf
export const stripe = {
  charges: {
    create: (data: ChargeCreate) => fetch('/v1/charges', { ... }),
    get: (id: string) => fetch(`/v1/charges/${id}`, { ... }),
  },
  customers: { ... }
}
```

### Option B: Integration templates

Pre-built recipes for common tasks:

```
GET /templates/contact-form-submission
```

Returns:

```json
{
  "name": "Contact Form Submission",
  "description": "Submit a contact/inquiry form on any site",
  "steps": [
    { "action": "find", "pattern": "POST /contact|/inquiry|/message" },
    { "action": "fill", "fields": ["name", "email", "message"] },
    { "action": "submit" }
  ],
  "sites": ["acme.com", "example.org", "..."]
}
```

### Option C: Agent instruction templates

MCP-native patterns that agents can invoke:

```json
{
  "tool": "unsurf.template",
  "input": {
    "template": "oauth-login",
    "site": "github.com",
    "credentials": { "..." }
  }
}
```

[?] **Which of these resonates? Or something else entirely?**

## Scaling the Directory

| Stage | Sites | Search | Storage | Cost |
|-------|-------|--------|---------|------|
| v1 | 1K | FTS5 | D1 + R2 | Free tier |
| v2 | 10K | FTS5 + Vectorize | D1 + R2 | ~$20/mo |
| v3 | 100K | Vectorize + sharding | D1 + R2 + CDN | ~$100/mo |
| v4 | 1M+ | Dedicated search infra | Distributed | TBD |

The fingerprint-first design means reads are cheap. Most agents never hit R2.

## The Network Effect

```
More agents → more scouts → more sites in directory
     ↑                              ↓
     └──── more useful to agents ←──┘
```

unsurf gets better the more it's used. Every scout is a contribution. Every replay is free.

[?] **Is there a plan to partner with agent platforms (OpenAI, Anthropic, etc.) to make unsurf a default capability?**

## Open Questions Summary

1. **Auth/rate limiting** — Free tier vs. authenticated access?
2. **Domain** — unsurf.dev or stay under coey.dev?
3. **Attribution** — Anonymous publishing or GitHub-linked?
4. **Incentives** — Bounties for scouting requested sites?
5. **Popularity** — Track and surface query volume?
6. **Classification** — ML embeddings or rule-based path matching?
7. **Templates** — Code gen, integration recipes, or agent instructions?
8. **Partnerships** — Pitch to agent platforms as infrastructure?

## Get Started

```bash
# Install
npm install unsurf

# Scout a site locally
npx unsurf scout https://example.com

# Publish to the directory
npx unsurf scout https://example.com --publish

# Search the directory
npx unsurf search "payment processing"

# Get a fingerprint
npx unsurf lookup stripe.com

# Generate a client
npx unsurf codegen stripe.com --lang ts
```

## Links

- **Directory**: https://unsurf.dev/directory
- **API**: https://api.unsurf.dev
- **Docs**: https://unsurf.dev/docs
- **GitHub**: https://github.com/acoyfellow/unsurf
- **NPM**: https://npmjs.com/package/unsurf

---

*The web is typed. You just couldn't see it until now.*
