# formwing

**Local-first web automation. You are the proxy.**

Turn your laptop into a local automation server. Browse websites through your own residential IP, capture APIs, automate forms, and never get blocked again.

```bash
# Install
brew install formwing

# Start your local proxy
formwing

# Now browse through localhost:8080
# All traffic is captured, all forms are automatable
```

---

## The Problem

**Cloud automation doesn't work anymore.**

- Datacenter IPs are blacklisted
- CAPTCHAs everywhere
- Rate limited into oblivion
- Session cookies don't persist
- File uploads? Good luck.

You've tried Puppeteer, Playwright, Selenium. They work... until they don't.

**formwing is different.**

Instead of running automation from a cloud server, formwing turns **your laptop** into the automation infrastructure. Your residential IP. Your browser session. Your cookies.

Websites see a real human on a real computer. Because that's exactly what you are.

---

## How It Works

### 1. Start the Local Proxy

```bash
$ formwing
🚀 Local proxy running on http://localhost:8080
📁 Config directory: ~/.config/formwing
🔐 Session storage: encrypted
```

### 2. Browse Through Your Proxy

Configure your browser to use `localhost:8080` as HTTP proxy, or visit:

```
http://localhost:8080/proxy/https://formwing.com
```

Browse normally. Every request goes through your residential IP.

### 3. Capture APIs Automatically

While you browse, formwing captures:
- XHR/fetch requests
- GraphQL queries
- WebSocket traffic
- Form submissions

```bash
$ formwing apis --site formwing.com

GET /api/users          → 200 OK (captured)
POST /api/submit        → 201 Created (captured)
GET /graphql            → 200 OK (introspected)

OpenAPI spec generated: ~/.config/formwing/specs/formwing.com.yaml
```

### 4. Automate Forms

Every form you fill is recorded. Replay with one command:

```bash
$ formwing submit --site formwing.com --form signup --data '{"email": "test@example.com"}'
✓ Navigated to https://formwing.com/signup
✓ Filled 5 fields
✓ Uploaded avatar.jpg
✓ Submitted form
✓ Success: redirect to /welcome
```

Or use the visual recorder:

```bash
$ formwing record --output signup.json
# Browser opens, you fill the form once
# formwing saves the recipe
```

---

## Use Cases

### **unsurf: API Discovery**

```bash
# Scout any website through your residential IP
$ formwing scout https://api.example.com

✓ Discovered 12 endpoints
✓ Generated OpenAPI spec
✓ Saved to ~/.config/formwing/specs/api.example.com.yaml

# Use the captured API
$ curl http://localhost:8080/api/proxy/api.example.com/users
# Returns: {"users": [...]}
```

**88% → 98% success rate** because you're using a residential IP.

### **formwing: Form Automation**

```bash
# Automate repetitive form submissions
$ formwing batch --recipe application.json --data candidates.csv

Processing 50 applications...
[████████████████████] 100%
✓ 48 successful
✗ 2 failed (logged for review)
```

### **Session Persistence**

```bash
# Login once, automate forever
$ formwing session --site formwing.com --save

# Later, automation uses your logged-in session
$ formwing submit --site formwing.com --form dashboard
✓ Using saved session (expires: 7 days)
✓ Form submitted successfully
```

### **File Uploads That Actually Work**

```bash
# Upload files through your local browser session
$ formwing upload --site formwing.com --form "resume-upload" --files ./resume.pdf

✓ File uploaded via browser
✓ Progress: 100%
✓ Server confirmed: file accepted
```

---

## Features

### 🏠 **Residential IP by Default**
All traffic goes through your home internet. No datacenter IP blocks. No CAPTCHAs.

### 🔍 **Automatic API Discovery**
Browse normally. formwing captures internal APIs and generates OpenAPI specs.

### 📝 **Form Recording & Replay**
Fill a form once. Replay it a thousand times with different data.

### 🍪 **Session Persistence**
Cookies, localStorage, sessionStorage all persist locally. Stay logged in between automations.

### 🔐 **Credential Vault**
Securely store passwords, API keys, tokens. Inject them when needed.

### 📊 **Traffic Inspector**
```bash
$ formwing inspect --site formwing.com

Recent requests:
GET  /api/users        200  45ms
POST /api/submit       201  120ms
GET  /graphql          200  30ms  ← GraphQL introspection available
```

### 🎭 **Multiple Personas**
```bash
# Different sessions for different accounts
$ formwing persona --create work --site formwing.com
$ formwing persona --create personal --site formwing.com

$ formwing submit --persona work --form report
$ formwing submit --persona personal --form post
```

### 📡 **MCP Server Built-in**
```bash
# Connect Claude/Cursor directly to your local proxy
$ formwing mcp --port 3000

# Now your AI agent can browse as you
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Your Laptop (Residential IP)                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  formwing                                             │  │
│  │  ┌──────────────┐  ┌──────────────────────────────┐  │  │
│  │  │  Axum Server │  │  Browser (Chromium/Chrome)   │  │  │
│  │  │  :8080       │  │                              │  │  │
│  │  └──────┬───────┘  └──────────────┬───────────────┘  │  │
│  │         │                         │                  │  │
│  │  ┌──────▼─────────────────────────▼──────────────┐  │  │
│  │  │  Proxy Layer                                    │  │  │
│  │  │  - Request/response interception               │  │  │
│  │  │  - Session injection                           │  │  │
│  │  │  - Traffic logging (for API discovery)         │  │  │
│  │  │  - Form detection & automation                 │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Storage (SQLite + Files)                      │  │  │
│  │  │  - Sessions, cookies, credentials              │  │  │
│  │  │  - Captured APIs (OpenAPI specs)               │  │  │
│  │  │  - Form recipes                                │  │  │
│  │  │  - Traffic logs                                │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                   │
│                         ▼ (Your Home Internet)              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  External Websites                                   │    │
│  │  - They see your residential IP                      │    │
│  │  - They see a real browser                           │    │
│  │  - No blocks, no CAPTCHAs                            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Built with:**
- **Tauri** - Desktop app framework
- **Axum** - HTTP server
- **Playwright** - Browser automation
- **SQLite** - Local storage
- **Rust** - Performance & safety

---

## Installation

### macOS
```bash
brew tap formwing/formwing
brew install formwing
```

### Linux
```bash
curl -fsSL https://formwing.dev/install.sh | sh
```

### Windows
```powershell
winget install formwing
```

### From Source
```bash
git clone https://github.com/acoyfellow/formwing.git
cd formwing
cargo build --release
```

---

## Quick Start

### 1. Initialize
```bash
$ formwing init
Creating config directory: ~/.config/formwing
Setting up local CA certificate for HTTPS proxy...
Done! Ready to browse.
```

### 2. Start Proxy
```bash
$ formwing proxy
🚀 Proxy running on http://localhost:8080
📱 Mobile proxy: http://192.168.1.5:8080

Browse through the proxy:
  - System settings → Network → Proxy → localhost:8080
  - Or visit: http://localhost:8080/proxy/https://example.com
```

### 3. Capture Your First API
```bash
# In another terminal, while browsing
$ formwing apis --watch

Capturing traffic from localhost:8080...
[2024-02-17 10:30:15] GET https://api.example.com/users
[2024-02-17 10:30:16] POST https://api.example.com/login

^C

Captured 2 endpoints. Save? [Y/n] Y
Saved to: ~/.config/formwing/specs/api.example.com.yaml
```

### 4. Automate a Form
```bash
# Record a form submission
$ formwing record --site https://formwing.com/contact --output contact.json
Browser opening... fill the form and submit
✓ Recorded 4 fields, 1 submit action
✓ Saved recipe to contact.json

# Replay with different data
$ formwing submit --recipe contact.json --data '{"name": "Alice", "email": "alice@example.com"}'
✓ Submitted successfully
```

---

## Configuration

### `~/.config/formwing/config.toml`

```toml
[proxy]
port = 8080
host = "127.0.0.1"
# Optional: expose on local network
# host = "0.0.0.0"

[browser]
# Use system Chrome or bundled Chromium
executable = "system"
# executable = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

headless = false  # Show browser window for debugging

[storage]
# Encrypt sensitive data (sessions, passwords)
encryption = true

[apis]
# Auto-generate OpenAPI specs
auto_discover = true
save_path = "~/.config/formwing/specs"

[forms]
# Auto-detect forms while browsing
auto_detect = true
# Suggest automation for frequently-used forms
suggest_recipes = true
```

---

## Recipes

### Automatically Fill Job Applications

```json
// ~/.config/formwing/recipes/job-application.json
{
  "site": "boards.greenhouse.io",
  "name": "Job Application",
  "steps": [
    {
      "action": "fill",
      "selector": "#first_name",
      "value": "{{first_name}}"
    },
    {
      "action": "fill",
      "selector": "#last_name",
      "value": "{{last_name}}"
    },
    {
      "action": "fill",
      "selector": "#email",
      "value": "{{email}}"
    },
    {
      "action": "upload",
      "selector": "#resume",
      "file": "{{resume_path}}"
    },
    {
      "action": "click",
      "selector": "#submit_application"
    },
    {
      "action": "wait",
      "condition": "urlChange",
      "timeout": 10000
    }
  ]
}
```

```bash
# Apply to 20 jobs
$ formwing batch \
  --recipe job-application.json \
  --data jobs.csv \
  --delay 5s

[████████████████████] 100% (20/20)
✓ 18 successful applications
✗ 2 already applied (skipped)
```

---

## Integration with unsurf

formwing is the evolution of unsurf. All unsurf features are included:

```bash
# Use formwing as drop-in replacement for unsurf
$ formwing scout https://api.github.com

✓ Discovered 47 endpoints
✓ Generated OpenAPI spec
✓ Available at: http://localhost:8080/directory/github

# All unsurf APIs work through formwing
$ curl http://localhost:8080/tools/scout \
  -d '{"url": "https://api.github.com", "task": "find users API"}'
```

**Why both?**
- **unsurf** - Cloud-hosted, quick start
- **formwing** - Local proxy, higher success rate, form automation

---

## Security

- **Local-only** - Your data never leaves your laptop
- **Encrypted storage** - Sessions, passwords stored with your OS keychain
- **Certificate pinning** - Local CA for HTTPS proxy
- **No telemetry** - We don't track anything

---

## Roadmap

- [x] Local HTTP proxy
- [x] API discovery & OpenAPI generation
- [x] Form recording & replay
- [x] Session persistence
- [x] MCP server
- [ ] Visual recipe editor
- [ ] Scheduling (cron-like)
- [ ] Team sharing (end-to-end encrypted)
- [ ] Mobile app companion
- [ ] AI-powered form detection

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT © Jordan Coeyman

---

**Built by humans, for humans.** 🤖➡️👤

Stop fighting CAPTCHAs. Start automating.
