# UniShield360 SOC Dashboard — Agent Memory

## Project
Enterprise Security Operations Center (SOC) Dashboard built with React + Vite + Express + SQLite.

## Operating Instructions (11 Rules)

1. **EXPERT MINDSET** — You are a world-class frontend AND backend engineer. Write clean, maintainable, production-grade code.

2. **REAL DATA ONLY** — NEVER use hardcoded, demo, mock, placeholder, or fallback data. ALL data must come from real backend API calls.

3. **BACKEND-FIRST** — Always build/verify the backend API first, then connect the frontend. Backend takes priority over frontend.

4. **VERIFY FROM API** — Never assume. Always verify from the real API response, or ask the user. Before building any feature, check what API endpoints exist and what they return.

5. **PROOF REPORT** — After implementing any feature with real API data, provide a proof/verification summary so the user knows it's backed by real data without needing to manually verify.

6. **PERFORMANCE** — Code for low-memory, high-performance environments. Enterprise-ready on minimal hardware. Keep bundles lean, avoid unnecessary re-renders, use lazy loading where appropriate.

7. **SECURITY** — Follow OWASP guidelines. Protect against XSS, CSRF, SQL injection, insecure deserialization. Sanitize all inputs. Use proper auth (JWT with expiry, refresh tokens). Secure WebSocket connections. Never expose secrets.

8. **COMPLIANCE** — Ensure SOC 2, GDPR, HIPAA, PCI-DSS compliance considerations are built in. Log access. Audit trails. Data encryption at rest and in transit.

9. **ASK QUESTIONS** — Before building something ambiguous, ask the user clarifying questions about requirements, edge cases, and expectations.

10. **CONCISE CODE** — Write clean, readable code. Avoid over-engineering. Use established patterns from the existing codebase. Enterprise-ready on less RAM.

11. **NO DUPLICATE RULE 5** — There is no rule 11 duplicate. Rule 5 above is the data rule. This is just a reminder that all rules apply equally.

## Conventions
- All data must come from real backend API calls — no mock/demo/fallback data ever
- Backend-first: implement API layer before frontend
- Ask clarifying questions before building ambiguous features
- Code for performance (low-memory environments) and security (OWASP, SOC 2, GDPR, HIPAA, PCI-DSS)
- After implementing any feature backed by real API data, provide a verification summary

## Stack
- Frontend: React 18, Vite 5, Tailwind CSS 3, Framer Motion, Recharts, @tanstack/react-table
- Backend: Express.js, better-sqlite3, ws, JWT, bcryptjs
- API: Axios
- Auth: JWT (server/auth.cjs + AuthContext.jsx)
- Real-time: WebSocket (server/realtime.cjs + hooks/useRealtime.js)
- DB: SQLite (server/db.cjs)

---

# Wazuh/UniShield360 API & Dashboard Knowledge Base

## 1. API Reference

### Backend
- **Upstream API:** `http://100.110.74.122:9999` (Wazuh/UniShield360)
- **Express Proxy:** Port 3099
- **Vite Dev Server:** Port 5173 (proxy `/api` → `localhost:3099`)
- **Index mapping:** Frontend uses `unishield360-*` → Express rewrites to `wazuh-*` → Response rewrites back

### Proxy Chain
```
Browser → Vite (:5173) → Express (:3099) → UniShield360 API (:9999)
```

### Auth
- POST `/security/user/authenticate` returns **501** (Unsupported method)
- Express runs in **no-auth mode** — no token needed
- Credentials in `.env` are present but auth is non-functional

### Supported Endpoints

| Endpoint | Method | Purpose | Widget Mapping |
|---|---|---|---|
| `/api/health` | GET | Cluster health status | — |
| `/api/count` | GET | Document count | Metric, Gauge, KPI, Alert Counter |
| `/api/aggregate` | GET | Field aggregations | Bar, Line, Area, Pie, Table, Heatmap, Timeline, Tag Cloud, Top N |
| `/api/search` | GET | Raw event search | Log Stream, Event Logs |
| `/api/indices` | GET | List indices | Health tab |
| `/api/fields` | GET | Field mapping | Discover tab |
| `/api/eps-stats` | GET | EPS + ingestion stats | EPS widgets, ingestion metrics |
| `/api/dashboard` | GET | Aggregated dashboard data | Main SOC Dashboard |
| `/api/wazuh-rules` | GET/POST | Wazuh manager rules | Rules tab |
| `/api/scan` | GET/POST | Deep pagination (no 10k limit) | Scan tab |
| `/api/geo` | GET | GeoIP aggregation | Geo tab |

---

## 2. Query Languages

### Lucene Syntax (used by search/count/aggregate endpoints)

| Syntax | Works? | Example | Result |
|---|---|---|---|
| `field:value` | ✅ | `agent.name:root` | Exact match |
| `field:[x TO y]` | ✅ | `rule.level:[12 TO 15]` | Range (Critical) |
| `AND` | ✅ | `rule.groups:windows AND rule.level:[12 TO 15]` | Conjunction |
| `-field:value` | ❌ | `-agent.name:root` | Returns 0 — BROKEN |
| `NOT field:value` | ❌ | `NOT rule.level:[12 TO 15]` | Returns same as positive — BROKEN |
| `field:>value` | ❌ | `rule.level:>11` | Returns 0 — BROKEN |
| `field:<=value` | ❌ | `rule.level:<=11` | Returns 0 — BROKEN |
| `field!=value` | ❌ | `rule.level!=12` | Returns 0 — BROKEN |
| `field=value` | ❌ | `rule.level=12` | Returns 0 — BROKEN |

**Conclusion:** Only `:value` exact match and `:[x TO y]` range work. The `buildQ()` function's `-` prefix exclude logic is **non-functional**.

### WQL — Wazuh Query Language (used by server API endpoints)

Used for `/agents`, `/rules`, `/decoders`, etc. — **NOT** for search/count/aggregate.

| Operator | Meaning | Example |
|---|---|---|
| `=` | Equality | `os.name=ubuntu` |
| `!=` | Not equality | `id!=0` |
| `<` | Less than | `os.version<18` |
| `>` | Greater than | `id>4` |
| `~` | Like/contains | `name~waz` |
| `;` | AND | `os.name=ubuntu;os.version>18` |
| `,` | OR | `os.major=16,os.major=18` |
| `()` | Grouping | `(os.major=16,os.major=18)` |

---

## 3. Aggregation Types

Supported by `/api/aggregate` endpoint:

| Type | Works? | Notes |
|---|---|---|
| `terms` | ✅ | Field value buckets |
| `date_histogram` | ✅ | Time-based buckets (interval: 1h, 6h, 12h, 1d, 7d, 1M) |
| `cardinality` | ❌ | "Unknown type" |
| `avg` | ❌ | "Unknown type" |
| `sum` | ❌ | "Unknown type" |
| `min` | ❌ | "Unknown type" |
| `max` | ❌ | "Unknown type" |

Only `terms` and `date_histogram` work with this API.

---

## 4. Global Filter Flow

### Adding Filters (CustomDashboardTab.jsx)
- **Key:Value pair** with field autocomplete (46 FIELD_PRESETS) + exclude/include toggle
- **Text query** (Lucene style) + exclude/include toggle
- Dedup by key (last added wins)

### Data Flow
```
addFilter() → dispatch ADD_FILTER + TRIGGER_REFRESH
  → Reducer: dedup by key, skip internal fields (#, key, doc_count, etc.)
  → refreshCounter++
  → DashboardPanel useEffect fires
  → loadData() → fetchPanelData(panel, globalFilters)
  → buildQ() merges panel query + global filters into API query
  → API call (/count, /aggregate, or /search)
```

### buildQ() Logic (DashboardPanel.jsx:24-54)
1. Start with panel's own query string
2. Merge all global filters with `AND` logic
3. For exclude: prepend `-` (BUG — this returns 0)
4. Set as `base.q` param

### Chart Click → Filter
- Bar/Line/Area click → `rule.level = value` (or field from aggregation)
- Pie click → field = value
- Table cell click → field = value (include or exclude)
- Horizontal bar → use `point.y` not `point.x`

### Known: Exclude chip visual missing
Filter chips in CustomDashboardTab don't show exclude indicator (no red/blue styling like QueryBar).

---

## 5. Custom Dashboard Architecture

### File Structure (21 dashboard files)

| File | Lines | Purpose |
|---|---|---|
| `src/tabs/CustomDashboardTab.jsx` | 467 | Main tab — orchestrator, toolbar, filters, grid |
| `src/components/dashboard/dashboardStore.jsx` | 187 | State management (useReducer + Context) |
| `src/components/dashboard/DashboardGrid.jsx` | 194 | react-grid-layout wrapper (12 cols, drag, resize) |
| `src/components/dashboard/DashboardPanel.jsx` | 793 | Panel renderer (all 21 chart types, data fetching) |
| `src/components/dashboard/DashboardToolbar.jsx` | 154 | Save, clone, import/export, widget lib button |
| `src/components/dashboard/DashboardFolderSelector.jsx` | 109 | Folder dropdown |
| `src/components/dashboard/DashboardTabs.jsx` | 104 | Tab bar with rename, scroll arrows |
| `src/components/dashboard/WidgetLibraryModal.jsx` | ~120 | Single-click widget picker (21 types) |
| `src/components/dashboard/TemplateLibraryModal.jsx` | 244 | Pre-built SOC template picker |
| `src/components/dashboard/PanelSettingsModal.jsx` | ~920 | Panel configuration (buckets, axes, style, CSS) |
| `src/components/dashboard/ContextMenu.jsx` | 117 | 11-item right-click menu |
| `src/components/dashboard/GlobalFilters.jsx` | 81 | Inline filter UI (deprecated) |
| `src/components/dashboard/dashboardService.js` | 144 | Dashboard CRUD (localStorage) |
| `src/components/dashboard/dashboardFolderService.js` | 138 | Folder/tab CRUD (localStorage, versioned) |
| `src/components/dashboard/dashboardTemplates.js` | 115 | SOC template definitions + user templates |

Plus specialized panels: SeverityPiePanel, TimelineAreaPanel, TopNPanel, EventLogsPanel, FrameworkDistPanel, TopAgentsPanel, TagCloudPanel.

### State Management (dashboardStore.jsx)
```
useReducer with 16 actions:
  SET_DASHBOARDS, SET_ACTIVE, ADD_DASHBOARD, UPDATE_DASHBOARD, DELETE_DASHBOARD,
  ADD_PANEL, UPDATE_PANEL, REMOVE_PANEL, SET_LAYOUT,
  SET_TIME_RANGE, ADD_FILTER, REMOVE_FILTER, SET_FILTERS,
  TOGGLE_FULLSCREEN, SET_EDITING, TRIGGER_REFRESH
```

### Persistence (localStorage)

| Key | Service | Content |
|---|---|---|
| `unishield_folders` | dashboardFolderService.js | Folder → Tab → Dashboard tree |
| `unishield_dashboards` | dashboardService.js | Legacy flat dashboard list |
| `unishield_user_templates` | dashboardTemplates.js | User-saved templates |
| `unishield_folders_v` | folderService | Schema version (current: v2) |

### Widget Types (21 + compliance panels)

| Type | API Endpoint | Aggregation |
|---|---|---|
| metric, gauge, kpi, alert-counter | `/api/count` | count |
| bar, line, area, pie, timeline, tagcloud | `/api/aggregate?type=terms` | field + terms |
| heatmap | `/api/aggregate?type=terms` | rule.mitre.tactic |
| table, log-stream | `/api/aggregate?type=terms` or `/api/search` | field + terms or search |
| event-logs | `/api/search` | search with sort |
| clusterbubble | `/api/aggregate?type=terms` | agent.name |
| markdown | — | No API call (static content) |
| EPS widgets | `/api/eps-stats` | EPS/ingestion |

### Panel Settings (PanelSettingsModal.jsx — ~920 lines)
Configure: title, dimensions, bucket field/type/size, query filter, X-Axis (labels, grid, angle), Y-Axis (title, min, max, threshold), legend position, tooltip, bar orientation, color palette, data labels, threshold colors, value styling, text styling, custom CSS.

---

## 6. Feature Comparison: Our Dashboard vs Wazuh OpenSearch Dashboards

### We Have That Wazuh Doesn't
| Feature | File:Line |
|---|---|
| Folder→Tab two-level hierarchy | `dashboardFolderService.js` |
| 21 SOC-specific widget types | `WidgetLibraryModal.jsx:3-25` |
| Auto-layout button | `CustomDashboardTab.jsx:218-234` |
| Copy/Paste panel design | `ContextMenu.jsx:39-48, 75-89` |
| Inline filter on every chart click | `DashboardPanel.jsx:306-335` |
| Inline filter on every table cell | `DashboardPanel.jsx:519-534` |
| Per-panel Custom CSS | `PanelSettingsModal.jsx:768-773` |
| Threshold colors per metric | `DashboardPanel.jsx:403-408` |
| Expandable table rows (Table/JSON) | `DashboardPanel.jsx:543-577` |
| Pagination in tables | `DashboardPanel.jsx:585-605` |
| Event-driven architecture (CustomEvents) | `CustomDashboardTab.jsx:236-311` |
| WebSocket live alerts | `DashboardGrid.jsx:46-73` |
| EPS/Ingestion dashboard data | `DashboardPanel.jsx:63-116` |
| Multiple color palettes (warm/cool/qualitative) | `PanelSettingsModal.jsx` |
| Gauge with threshold colors | `DashboardPanel.jsx:445-462` |
| Alert Counter 4-quadrant | `DashboardPanel.jsx:638-648` |
| Compliance framework panels | `DashboardPanel.jsx:657-661` |
| Bar orientation (vertical/horizontal) | `PanelSettingsModal.jsx` + `DashboardPanel.jsx:711` |
| Data labels on bars | `DashboardPanel.jsx:712-714` |
| Field value filter with checkboxes | `PanelSettingsModal.jsx:180-215` |

### Wazuh Has That We Don't
| Feature | Impact |
|---|---|
| Server-side persistence (OpenSearch index) | Data survives browser clear, multi-user |
| Multi-tenancy / RBAC | No multi-user support |
| Saved Objects REST API | No programmatic dashboard management |
| Maps (Coordinate & Region) | No geospatial panels |
| TSVB / Vega visualizations | No advanced viz grammar |
| VisBuilder (drag-and-drop viz) | No visual builder |
| Dashboard Variables (templated) | No variable system |
| Cross-dashboard filter pinning | Filters reset on tab switch |
| Index Pattern management | Fixed to alerts index |
| Scheduled reports | Not implemented |
| Dashboard sharing via URLs | Single-user only |

---

## 7. Known Bugs & Issues

### Critical
| Bug | File:Line | Status |
|---|---|---|
| Range query `[x TO y]` breaks `/api/aggregate` & `/api/search` | `DashboardPanel.jsx:24-54` | **Fixed** — added `sanitizeQ()` strips `[x TO y]` for aggregate/search, keeps for count |
| Values with colons (`:`) break queries | `DashboardPanel.jsx:43` | **Fixed** — added `\|\| String(f.value).includes(':')` to wrap in quotes |
| Exclude filter `-` prefix returns 0 | `DashboardPanel.jsx:48,51` | API doesn't support Lucene negation |
| Comparison operators `>`, `<`, `<=`, `>=` return 0 | `DashboardPanel.jsx:34` | API doesn't support them |
| Filter values not showing on first field select | `PanelSettingsModal.jsx:85-98` | Fixed — removed prevFieldRef |

### Minor
| Issue | Details |
|---|---|
| Filter chips no exclude visual | No red/blue styling for exclude chips |
| ShowTitle was showing 'Metric' fallback | Fixed — now uses panel.type or hides |
| Metrics section non-functional | Removed (API doesn't support avg/sum/min/max) |
| Data source + chart type selectors removed | Cleaned up per user request |
| Cluster Bubble chart type removed | Cleaned up per user request |
| Layout section (padding/margin/align) removed | Cleaned up per user request |
| Bar chart outside container | Fixed — textposition: 'inside' + automargin |
| Bar click filter returned count not label | Fixed — handles horizontal orientation |

---

## 8. Workflow Rules (Always Follow)

1. **RESEARCH FIRST** — Before implementing any feature, research from:
   - Wazuh official docs (documentation.wazuh.com)
   - Wazuh GitHub (github.com/wazuh/wazuh-dashboard-plugins)
   - Google search for best practices
   - Existing codebase patterns

2. **VERIFY FROM API** — Never assume API behavior. Test with actual API calls.

3. **BACKEND-FIRST** — Check/implement backend API first, then frontend.

4. **CONCISE CODE** — Clean, readable, no over-engineering.

5. **SAVE TO AGENTS.MD** — All API behavior, bugs, and architecture decisions saved here.

---

## 9. Recent Changes Log

| Date | Change | Files |
|---|---|---|
| Jun 24 | Fix PORT to 3099, add JWT_SECRET, fix port string concat bug | `.env`, `server.cjs`, `vite.config.js` |
| Jun 24 | Widget Library: single-click add, removed data source + confirm steps | `WidgetLibraryModal.jsx` |
| Jun 24 | Title fallback: removed 'Metric' text, shows panel type or hidden | `DashboardPanel.jsx` |
| Jun 24 | Removed Chart Type selector, Data Source, Layout sections | `PanelSettingsModal.jsx` |
| Jun 24 | Added Bar Style (orientation, palette, data labels) | `PanelSettingsModal.jsx`, `DashboardPanel.jsx` |
| Jun 24 | Removed non-functional Metrics section | `PanelSettingsModal.jsx` |
| Jun 24 | Bar chart: data labels inside, automargin to prevent overflow | `DashboardPanel.jsx` |
| Jun 24 | Fixed bar click filter (handles horizontal orientation) | `DashboardPanel.jsx` |
| Jun 24 | Filter Values now auto-expand + load on mount | `PanelSettingsModal.jsx` |
| Jun 24 | Fix: sanitizeQ strips `[x TO y]` for aggregate/search endpoints | `DashboardPanel.jsx` |
| Jun 24 | Fix: quote values with colons in buildQ | `DashboardPanel.jsx:43` |
| Jun 24 | Fix: sanitizeQ strips quoted values + complex syntax for aggregate/search | `DashboardPanel.jsx:24-31` |
| Jun 24 | Fix: date_histogram click filter uses `YYYY-MM-DD` instead of `[range]` | `DashboardPanel.jsx:354-372` |
| Jun 24 | Fix: Pie Chart responsive + truncate long labels (25 chars) + click-to-filter | `DashboardPanel.jsx` |
| Jun 24 | Fix: Data Table - hide `data.vulnerability.*` columns, ALL cells clickable, clean headers | `DashboardPanel.jsx` |
| Jun 24 | Fix: Pie click missing `addFilter` call - now dispatches to all widgets | `DashboardPanel.jsx:352-356` |
| Jun 24 | Tested: Object/String/Integer/Date/Colon-value multi-filters across all 3 endpoints | API verified |
| Jun 25 | Fix: DashboardPanel onSave now calls triggerRefresh() after updatePanel() | `DashboardPanel.jsx:827` |
| Jun 25 | Fix: Removed "Last 24 Hours" badge from TimelineAreaPanel | `TimelineAreaPanel.jsx` |
| Jun 25 | Fix: Data Table auto-detects columns from API data keys — no hardcoded DEFAULT_TABLE_COLS | `DashboardPanel.jsx:512-517` |
| Jun 25 | Fix: PanelSettings tableCols uses `availableKeys` from API data (not FIELD_PRESETS) | `PanelSettingsModal.jsx`, `DashboardPanel.jsx` |
| Jun 25 | Fix: Data Table - skipFlatten for `syscheck`, `decoder`, `predecoder` (no more syscheck.* columns) | `DashboardPanel.jsx:233-241` |
| Jun 25 | Fix: Data Table - DEFAULT_TABLE_COLS fallback instead of `visibleKeys.slice(0,7)` | `DashboardPanel.jsx:510,519` |
| Jun 25 | Fix: Add `syscheck` to HIDDEN_COL_KEYS in PanelSettingsModal | `PanelSettingsModal.jsx:270` |
| Jun 24 | Add: Metric Card always clickable with Include/Exclude filter dropdown | `DashboardPanel.jsx:437-456` |
| Jun 24 | Refactor: Panel Settings accordion UI (EUI-style collapsible sections) | `PanelSettingsModal.jsx` |

---

## 10. Mandatory Manual Testing Before Every Feature

**Har feature implement karne se pehle manual API testing karna zaroori hai.**

### Testing Protocol

1. **Start servers:** Express (`:3099`) + Vite (`:5173`)
2. **Test API directly** using curl/Invoke-RestMethod before frontend code
3. **Test on ALL affected endpoints:**
   - `/api/count` — Metric Card, Gauge, KPI
   - `/api/aggregate` — Bar, Line, Area, Pie, Table, Heatmap, Timeline, Tag Cloud
   - `/api/search` — Log Stream, Event Logs
   - `/api/eps-stats` — EPS widgets
4. **Test edge cases:**
   - Range queries `[x TO y]` — work on `/count` but stripped on `/aggregate` & `/search`
   - Values with colons (`:`) — must be quoted
   - Values with spaces — must be quoted
   - Exclude `-` prefix — currently broken (returns 0)
   - `AND` combination of multiple filters
5. **Verify frontend:** Open browser at `localhost:5173`, add widget, apply filter, check data

### If API returns unexpected results:
   - Check `buildQ()` output — what `q` param is being generated
   - Check `sanitizeQ()` — are ranges being stripped correctly?
   - Check value quoting — are colons/spaces wrapped in quotes?
   - Log the actual API URL being called
   - Test the same URL directly via curl/PowerShell

## MCP Server Data Context
- **URL**: `http://192.168.1.77:9996` (Wazuh host, port 9996)
- **Endpoints**: `/info`, `/health`, `/rules`, `/rules/read`, `/decoders`, `/decoders/read`, `/integrations`, `/config`, `/alerts/schema`, `/alerts/search`, `/agents`

### Alert Schema (from `/alerts/schema`)
| Key | Type | Sub-fields |
|---|---|---|
| `predecoder` | object | `hostname: string`, `program_name: string`, `timestamp: string` |
| `agent` | object | `name: string`, `id: string` |
| `manager` | object | `name: string` |
| `rule` | object | `firedtimes: number`, `mail: boolean`, `level: number`, `description: string`, `groups: string[]`, `id: string`, `gpg13: string[]`, `gdpr: string[]` |
| `decoder` | object | `name: string` |
| `input` | object | `type: string` |
| `full_log` | string | — |
| `@timestamp` | string | — |
| `location` | string | — |
| `id` | string | — |
| `timestamp` | string | — |

### Decoders (9 files)
auditd_decoders.xml, decoder-linux-sysmon.xml, local_decoder.xml, local_decoder_activeresponse.xml, naxsi-opnsense_decoders.xml, pcre2_0510-maltrail_decoders.xml, pfsense_custom.xml, vvf_action1_decoders.xml, yara_decoders.xml

### Agents (7)
U360-Engine, root, COREGENIX, Rayyan, suyash-window, My-SurfaceLaptop, Rayyan-laptop

### Known Rule Groups (from real data + schema)
`local`, `systemd`, `syscheck`, `syscheck_file`, `syscheck_registry`, `syscheck_entry_added`, `syscheck_entry_deleted`, `syscheck_entry_modified`, `misp`, `multiple_blocks`, `reconnaissance`

### FIM-Specific Fields (verified from real API)
`syscheck.path`, `syscheck.event`, `syscheck.uname_after`, `syscheck.audit.user.name`, `syscheck.inode`, `syscheck.gid`, `syscheck.gname`, `syscheck.hard_links`, `syscheck.uid`, `syscheck.uname`, `syscheck.perm_after`, `syscheck.perm_before`, `syscheck.md5_before`, `syscheck.sha1_before`, `syscheck.sha256_before`, `syscheck.md5_after`, `syscheck.sha1_after`, `syscheck.sha256_after`
