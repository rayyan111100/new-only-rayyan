# UniShield360 SOC Dashboard — Agent Memory

## Project
Enterprise Security Operations Center (SOC) Dashboard built with React + Vite + Express + SQLite.

## Core Rules
- ALL data must come from real backend API calls — no mock/demo/fallback data ever
- Backend-first: implement API layer before frontend
- Verify from real API responses before building features
- After implementing any feature backed by real API data, provide a verification summary
- Ask clarifying questions before building ambiguous features
- Code for performance (low-memory environments) and security (OWASP, SOC 2, GDPR, HIPAA, PCI-DSS)
- Write clean, readable code. Avoid over-engineering. Follow existing codebase patterns.

## Stack
- Frontend: React 18, Vite 5, Tailwind CSS 3, Framer Motion, Recharts, @tanstack/react-table
- Backend: Express.js, better-sqlite3, ws, JWT, bcryptjs
- API: Axios (src/api.js)
- Auth: JWT (server/auth.cjs + src/context/AuthContext.jsx)
- Real-time: WebSocket (server/realtime.cjs + src/hooks/useRealtime.js)
- DB: SQLite (server/db.cjs)

## Development Guidelines

### Security
- Never hardcode secrets, API keys, or credentials. Use environment variables (.env).
- Validate and sanitize all user/API inputs.
- Avoid dangerous patterns like `eval()`, innerHTML with unsanitized data, or raw SQL concatenation.
- Use parameterized queries or ORM-safe patterns for database access.
- Follow OWASP top 10 guidelines (XSS, CSRF, injection prevention).

### Scalability
- Make environment-specific configuration injectable via env vars (e.g., API base URLs, feature flags, index names).
- Avoid hardcoded domain-specific values (URLs, ports, region-specific constants).
- Use dependency injection or context for cross-cutting concerns (auth, config).
- Components should be self-contained and reusable; avoid implicit coupling.

### Performance
- Use `useMemo` / `useCallback` / `React.memo` to avoid unnecessary re-renders.
- Memoize expensive computations (filtered lists, derived data).
- Use lazy loading (`React.lazy`, dynamic imports) for route-level code splitting.
- Avoid inline function/object creation in JSX props where it causes cascading re-renders.
- Use `useRef` for intervals/timeouts to avoid stale closures.
- Batch state updates where possible.
- Prefer native Array methods over libraries for simple operations.
- Avoid re-filtering/re-mapping the same data multiple times — derive once.
- Use efficient data structures (Set for lookups, Map for keyed access).

## Compliance Frameworks Supported
- PCI-DSS (rule.pci_dss field — array of strings)
- HIPAA (rule.hipaa field — array of strings)
- GDPR (rule.gdpr field — array of strings)
- TSC (SOC 2) (rule.tsc field — array of strings)
- MITRE ATT&CK (rule.mitre object — NOT rule.mitre_attack)
- NIST 800-53 (rule.nist_800_53 field — array of strings)

## CRITICAL: Real Data Structure (VERIFIED from MCP `/mcp/alerts/search`)
**ALL compliance fields are ARRAYS of strings** (e.g., `rule.gdpr: ["IV_35.7.d"]`), NOT scalars.
`rule.mitre_attack` does NOT exist — use `rule.mitre` which is an object: `{ technique: [str], id: [str], tactic: [str] }`.

## MCP Server (Backend Ground Truth)
Available at `https://192.168.1.77/mcp/` — use `/mcp/alerts/search` with raw OpenSearch queries to verify field structures before building features.
Endpoints: `/health`, `/info`, `/config`, `/rules`, `/decoders`, `/integrations`, `/agents`, `/alerts/schema`, `/alerts/search`

---

## Tab Implementation — Complete Documentation

### 1. Architecture Overview

Backend-first architecture: Express.js middleware between React frontend and Wazuh SIEM API.

```
React Frontend → Express Middleware → Wazuh SIEM API (192.168.1.77:9999)
```

**Data flow:**
1. Tab component mounts → calls `api('<framework>-compliance', params)`
2. Express receives request → authenticates with Wazuh API via JWT
3. Express fires **8 parallel requests** to Wazuh (count, aggregate, search)
4. Wazuh returns real SIEM data filtered by compliance framework field
5. Express transforms response (severity mapping, article mapping)
6. Frontend renders all sections using API data — **zero hardcoded fallbacks**

### 2. Backend Endpoint Pattern: `GET /api/<framework>-compliance`

**Parameters:**
- `index` (string, default `unishield360-alerts-4.x-*`) — Elasticsearch index pattern
- `start_date` (string, default `now-24h`)
- `end_date` (string, default `now`)

**Query filter:** `_exists_:rule.<framework>` — uses Elasticsearch `_exists_` query to return all events with the compliance field populated.

**8 parallel requests to Wazuh API:**
| Endpoint | Purpose | Field |
|---|---|---|
| `/count` | Total events (24h) | `_exists_:rule.<framework>` |
| `/count` | Total events (7d) | `_exists_:rule.<framework>` |
| `/aggregate` | Severity distribution | `rule.level` |
| `/aggregate` | Control/article distribution | `rule.<framework>` |
| `/aggregate` | Top rule IDs | `rule.id` |
| `/aggregate` | Top agent names | `agent.name` |
| `/aggregate` | Timeline (hourly) | `@timestamp` |
| `/search` | Recent events | `_exists_:rule.<framework>` |

**Response structure:**
```json
{
  "count24": 63130,
  "count7d": 63130,
  "severity": { "High": 37771, "Medium": 22906, "Low": 2453 },
  "topArticles": [
    { "code": "II_5.1.f", "article": "Art. 5(1)(f)", "title": "Integrity & Confidentiality", "count": 47795 }
  ],
  "topAgents": [ { "key": "suyash-window", "doc_count": 42474 } ],
  "topRules": [ { "key": "553", "doc_count": 36758 } ],
  "timeline": [ { "time": 1779249600000, "count": 1320 } ],
  "recent": [ /* full event documents */ ],
  "recentTotal": 10000
}
```

### 3. Critical Wazuh API Rules (Gold)

1. **Never use `:*` wildcard** on keyword fields — Wazuh keyword fields do NOT support `rule.gdpr:*`. Use `_exists_:rule.gdpr` instead.
2. **Always verify field existence** via `/api/fields?index=...` before building an endpoint.
3. **Always discover actual field values** via `/api/aggregate?field=rule.<framework>&type=terms&limit=50` — never hardcode article lists without verification.
4. **Map Wazuh codes to human-readable names** using Wazuh official source at `plugins/main/common/compliance-requirements/<framework>-requirements.ts` as the source of truth.

### 4. Wazuh Compliance Field Format Convention

The format is `[CHAPTER]_[ARTICLE].[PARAGRAPH].[POINT]`:
- `II_5.1.f` → Chapter II, Art. 5(1)(f)
- `IV_32.2` → Chapter IV, Art. 32(2)

### 5. How to Build Any New Compliance Tab (Reusable Logic)

#### Step 1: Identify the Wazuh Field
Check what field Wazuh uses for that framework:
- HIPAA: `rule.hipaa`
- PCI-DSS: `rule.pci_dss`
- GDPR: `rule.gdpr`
- TSC/SOC 2: `rule.tsc`
- MITRE ATT&CK: `rule.mitre_attack`
- NIST 800-53: `rule.nist_800_53`

#### Step 2: Verify via `/api/fields` endpoint

#### Step 3: Discover actual field values via `/api/aggregate`

#### Step 4: Create backend endpoint
Copy the GDPR endpoint template — all 8 parallel requests are **framework-agnostic**. Only the `q` parameter and article mapping change.

#### Step 5: Create frontend component
Copy `GdprTab.jsx` and modify: component name, title, `api('<framework>-compliance')` call, color scheme, metric labels, article bindings.

#### Step 6: Register in `src/App.jsx`

### 6. Data Validation — Chain of Trust
```
Wazuh SIEM (source of truth) → Wazuh REST API → Express Middleware → React Frontend
```
No point in this chain injects fake, mocked, or fallback data.

### 7. GDPR Reference (Working Example)
- **Wazuh field:** `rule.gdpr` (keyword type)
- **Query:** `_exists_:rule.gdpr` → 63,130 events (7d)
- **Known codes:** `II_5.1.f` (Art. 5(1)(f) — Integrity & Confidentiality), `IV_35.7.d` (Art. 35(7)(d) — DPIA), `IV_32.2` (Art. 32(2) — Access Control), `IV_30.1.g` (Art. 30(1)(g) — Records of Processing)
- **Endpoint:** `server/server.cjs` (after line 371)
- **Frontend:** `src/tabs/GdprTab.jsx` (502 lines)
- **Registered in:** `src/App.jsx`

### 8. Files Reference
| File | Purpose |
|---|---|
| `server/server.cjs` | Backend endpoints (incl. compliance) |
| `src/tabs/GdprTab.jsx` | GDPR UI component |
| `src/App.jsx` | Tab registry |
| `src/components/Sidebar.jsx` | Navigation |
| `src/api.js` | Axios API client |
