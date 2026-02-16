# Directory Roadmap

## Vision

**The typed internet.** A community-maintained registry of APIs for sites that never had them.

unsurf captures the *structure*. For authenticated endpoints, pair with [inbox.dog](https://inbox.dog) for session management.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      The Typed Web                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   🔓 Public APIs          │   🔐 Authenticated APIs         │
│   ─────────────           │   ──────────────────            │
│   unsurf alone            │   unsurf + inbox.dog            │
│                           │                                 │
│   • Search pages          │   • Account dashboards          │
│   • Product listings      │   • User profiles               │
│   • Public forms          │   • Protected actions           │
│   • Info pages            │   • Session-based flows         │
│                           │                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Sprint 1: Foundation (Current)

### ✅ Completed
- [x] Fingerprint data model (~50 tokens per domain)
- [x] Capability classification (12 categories)
- [x] Directory API routes (`/d/:domain`, `/search`, etc.)
- [x] Vectorize semantic search
- [x] Directory browser UI
- [x] Contribute flow (CLI, API, self-host)
- [x] MCP `directory` tool
- [x] Scout `--publish` flag

### 🔲 Remaining
- [ ] Auth badge distinction in UI (🔓 Public / 🔐 Requires Auth)
- [ ] inbox.dog integration callout
- [ ] Seed gallery with 5-10 public APIs

---

## Sprint 2: Seed the Gallery

### Target: 10 High-Value Public APIs

| Site | Category | Why |
|------|----------|-----|
| Craigslist | classifieds | No API exists, universal utility |
| AllRecipes | recipes | Strip SEO bloat, just the recipe |
| Hacker News | community | Read API exists, but no write |
| Weather.gov | government | Public data, bad UX |
| USPS Tracking | shipping | No unified API |
| Wikipedia | reference | Infobox extraction |
| IMDb | entertainment | No public API |
| Yelp | local | API is deprecated/limited |
| GitHub Jobs | jobs | Simple, proves the concept |
| Product Hunt | launches | Limited API |

### Process
1. Scout each site with `bun run scout <url>`
2. Review captured endpoints
3. Publish to directory with `--publish`
4. Verify fingerprint displays correctly
5. Test search finds it

---

## Sprint 3: Auth Integration

### inbox.dog Handoff

When a scouted site requires authentication:

1. **Detection**: Check for login redirects, 401s, session cookies
2. **Badge**: Mark fingerprint as `🔐 Requires Auth`
3. **Callout**: Show inbox.dog integration prompt
4. **Docs**: Guide for connecting inbox.dog sessions

### UI Changes

```typescript
interface Fingerprint {
  // ... existing fields
  authRequired: boolean;        // true if any endpoint needs auth
  publicEndpoints: number;      // count of public endpoints
  protectedEndpoints: number;   // count of auth-required endpoints
}
```

Directory card shows:
```
┌─────────────────────────────────┐
│ craigslist.org          🔓 Public │
│ 12 endpoints • search, forms    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ linkedin.com      🔐 Requires Auth │
│ 47 endpoints • pair with inbox.dog │
└─────────────────────────────────┘
```

---

## Sprint 4: Community & Federation

### Contribution Flow
- GitHub OAuth for attribution
- Upvote/downvote quality signals
- "Request an API" queue
- Bounties for high-demand sites

### Federation
- Other instances can sync from this directory
- Or run completely independent
- Protocol for sharing discoveries

---

## Sprint 5: Consolidate Sites

### Current State
- `unsurf-api.coey.dev` → API + Directory UI
- `unsurf.coey.dev` → Docs (Astro)

### Target State
- `unsurf.coey.dev` → Everything
  - `/` → Directory + marketing
  - `/docs` → Documentation
  - `/d/*` → API
  - `/tools/*` → API
  - `/mcp` → MCP endpoint

### Approach
Move to single worker serving both UI and API. Docs become pages in the same app.

---

## Success Metrics

| Metric | Sprint 1 | Sprint 2 | Sprint 3 |
|--------|----------|----------|----------|
| APIs indexed | 0 | 10 | 25 |
| Weekly searches | - | 100 | 500 |
| Contributors | 1 | 5 | 20 |
| GitHub stars | - | 50 | 200 |

---

## Open Questions

1. **Monetization**: Free tier vs. paid for high-volume?
2. **Curation**: Who approves new APIs? Quality control?
3. **Legal**: Terms of service for scouted sites?
4. **Rate limits**: How to prevent abuse?

---

## Links

- **Live**: https://unsurf-api.coey.dev
- **Docs**: https://unsurf.coey.dev
- **GitHub**: https://github.com/acoyfellow/unsurf
- **inbox.dog**: https://inbox.dog
