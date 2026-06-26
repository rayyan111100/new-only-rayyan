# UniShield360 SOC Dashboard — Architecture

## 1. System Overview

Enterprise Security Operations Center (SOC) Dashboard for real-time security monitoring, alert management, compliance tracking, and custom dashboarding. Integrates with Wazuh/UniShield360 API.

```
Browser ──Vite(:5173)──proxy──Express(:3099)──proxy──UniShield360 API(:9999)
                                    │
                                    ├──SQLite Dashboard DB
                                    ├──WebSocket Server(/ws)
                                    └──OpenSearch Dashboards Proxy(:8443)
```

---

## 2. Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend Framework | React 18 | UI components |
| Build Tool | Vite 5 | Dev server + bundling |
| Styling | Tailwind CSS 3 | Utility-first CSS |
| Charts | Recharts + react-plotly.js | SOC visualizations |
| Table | @tanstack/react-table | Data tables |
| Animation | Framer Motion | Transitions |
| Layout | react-grid-layout | Drag/resize panels |
| Backend | Express.js | API server + proxy |
| Database | better-sqlite3 | Local persistence |
| Real-time | ws (WebSocket) | Live alerts |
| Auth | jsonwebtoken + bcryptjs | JWT authentication |
| HTTP Client | Axios | API calls |
| Reporting | jspdf + jspdf-autotable + xlsx | PDF/Excel exports |

---

## 3. Directory Structure

```
Dashboard/
├── server/                    # Express.js backend (1323 lines in server.cjs)
│   ├── server.cjs            # Main server: proxy, auth, dashboards, compliance, etc.
│   ├── db.cjs                # SQLite schema + CRUD (7 tables)
│   ├── auth.cjs              # JWT login/verify/middleware
│   ├── realtime.cjs          # WebSocket realtime engine
│   ├── ruleEngine.cjs        # Server-side rule evaluation
│   ├── decoderEngine.cjs     # Log decoding engine
│   ├── unishield360Xml.cjs   # Wazuh XML ↔ JSON conversion
│   ├── notifier.cjs          # Webhook notification dispatch
│   └── services/             # 6 service modules
│       ├── aggregationBuilder.cjs
│       ├── dataQueryService.cjs
│       ├── openSearchClient.cjs
│       ├── queryRoutes.cjs
│       ├── realtimeRoutes.cjs
│       └── sseService.cjs
│
├── src/                      # React frontend
│   ├── App.jsx               # Shell: 30+ tabs, sidebar, navbar
│   ├── main.jsx              # Entry point
│   ├── api.js                # Axios client (api/apiPost/apiPut/apiDelete)
│   ├── utils.js              # Date parsing, DQL builder, filters
│   ├── index.css             # Tailwind directives
│   ├── context/              # 3 context providers
│   │   ├── AppContext.jsx    # Global state (filters, results, fields, etc.)
│   │   ├── AuthContext.jsx   # JWT auth state
│   │   └── ToastContext.jsx  # Toast notifications
│   ├── hooks/                # Custom hooks
│   │   ├── useRealtime.js    # WebSocket client
│   │   └── useCompliance.js  # Compliance data fetching
│   ├── services/             # 18 service modules
│   │   ├── ruleApi.js        # Rule CRUD API client
│   │   ├── ruleEngine.js     # Client-side rule evaluation
│   │   ├── ruleStorage.js    # Rule persistence helpers
│   │   ├── rulePersistence.js
│   │   ├── ruleGroupManager.js
│   │   ├── ruleVersionStorage.js
│   │   ├── ruleTemplates.js
│   │   ├── decoderEngine.js
│   │   ├── fimApi.js
│   │   ├── gdprApi.js
│   │   ├── malwareApi.js
│   │   ├── vulnerabilityApi.js
│   │   ├── emailService.js
│   │   ├── reportService.js
│   │   ├── seedData.js
│   │   ├── demoLogs.js
│   │   ├── testResultStorage.js
│   │   └── undoManager.js
│   ├── components/           # 37+ components
│   │   ├── dashboard/        # 24 files — custom dashboard system
│   │   │   ├── DashboardPanel.jsx  (793 lines — 21 chart types)
│   │   │   ├── PanelSettingsModal.jsx (~920 lines)
│   │   │   ├── DashboardGrid.jsx   (194 lines)
│   │   │   ├── DashboardStore.jsx  (187 lines — state management)
│   │   │   ├── DashboardToolbar.jsx (154 lines)
│   │   │   ├── WidgetLibraryModal.jsx
│   │   │   ├── TemplateLibraryModal.jsx
│   │   │   ├── ContextMenu.jsx
│   │   │   ├── DashboardTabs.jsx
│   │   │   ├── DashboardFolderSelector.jsx
│   │   │   ├── ... (other panel types)
│   │   │   └── dashboardService.js / dashboardFolderService.js
│   │   ├── rules/            # Rule management components
│   │   ├── visualizations/   # Visualization components
│   │   ├── reporting/        # PDF/Excel report components
│   │   ├── share/            # Sharing components
│   │   ├── alerts/           # Alert components
│   │   ├── inspect/          # Inspection components
│   │   ├── Navbar.jsx
│   │   ├── Sidebar.jsx
│   │   ├── QueryBar.jsx
│   │   ├── FieldSidebar.jsx
│   │   ├── ... (others)
│   │   └── dashboard/        # Dashboard system
│   ├── tabs/                 # 38 tab views
│   │   ├── DiscoverTab.jsx
│   │   ├── DashboardTab.jsx
│   │   ├── CustomDashboardTab.jsx  (467 lines)
│   │   ├── SecurityHub.jsx
│   │   ├── SearchTab.jsx / AnalyticsTab.jsx
│   │   ├── RulesTab.jsx / CreateRuleTab.jsx / RuleViewTab.jsx
│   │   ├── ComplianceTab.jsx / GdprTab.jsx / PcidssTab.jsx / HipaaTab.jsx
│   │   ├── MalwareDetectionTab.jsx / FimTab.jsx
│   │   ├── VulnerabilityTab.jsx / VulnerabilityDetectionTab.jsx
│   │   ├── WindowsEventTab.jsx / SecurityEventsTab.jsx
│   │   ├── GeoTab.jsx / HealthTab.jsx / IndicesTab.jsx
│   │   ├── MitreAttackTab.jsx / NistTab.jsx / CspmTab.jsx
│   │   ├── TscTab.jsx / DtmTab.jsx / AimTab.jsx
│   │   ├── IncidentManagementTab.jsx / InfrastructureHealthTab.jsx
│   │   ├── DecoderTab.jsx / RuleGroupsTab.jsx / GroupRulesTab.jsx
│   │   ├── RuleGuideTab.jsx / ApiGuideTab.jsx / ApiConsoleTab.jsx
│   │   └── ScanTab.jsx / AlertsTab.jsx
│   └── data/                 # Static data files
├── data/                     # SQLite database file location
├── dist/                     # Production build output
├── public/                   # Static assets
└── .env                      # Environment variables
```

---

## 4. Backend Architecture

### 4.1 API Proxy Chain
Vite dev server proxies `/api/*` → Express (`:3099`) → UniShield360 API (`:9999`).

Express adds:
- JWT auth header for upstream API
- Index name mapping (`unishield360-*` ↔ `wazuh-*`)
- Response field rewriting (`wazuh` → `unishield360` in index names)
- 120s timeout on all requests

### 4.2 Endpoints

#### Universal Proxy (passthrough to upstream)
| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/health` | GET | Cluster health |
| `/api/indices` | GET | List indices |
| `/api/index-stats` | GET | Index statistics |
| `/api/fields` | GET | Field mapping |
| `/api/search` | GET/POST | Raw search |
| `/api/count` | GET | Document count |
| `/api/scan` | GET/POST | Deep pagination |
| `/api/aggregate` | GET | Field aggregations |
| `/api/geo` | GET | GeoIP aggregation |
| `/api/wazuh-rules` | GET/POST/PUT/DELETE | Manager rules proxy |
| `/api/wazuh-decoders` | GET/POST/PUT/DELETE | Manager decoders proxy |

#### Aggregated Dashboards
| Endpoint | Purpose |
|---|---|
| `/api/dashboard` | Main SOC dashboard (counts, levels, rules, agents, timeline) |
| `/api/windows-dashboard` | Windows event dashboard |
| `/api/compliance` | Multi-framework compliance dashboard (PCI-DSS, HIPAA, GDPR, SOC 2, MITRE, NIST 800-53) |
| `/api/gdpr-dashboard` | GDPR-specific dashboard |
| `/api/gdpr-events` | GDPR paginated events (OpenSearch query) |
| `/api/eps-stats` | EPS + ingestion stats |
| `/api/malware-dashboard` | Malware detection dashboard |
| `/api/malware-events` | Malware paginated events |
| `/api/fim-dashboard` | File integrity monitoring dashboard |
| `/api/fim-events` | FIM paginated events |
| `/api/search/enriched` | Search + decode + rule evaluation |

#### Local CRUD
| Endpoint | Purpose |
|---|---|
| `/api/auth/*` | Login/me/logout (JWT) |
| `/api/users/*` | User management (admin) |
| `/api/rules/*` | Rules CRUD + versioning + evaluation + groups |
| `/api/decoders/*` | Decoders CRUD + tests |
| `/api/notifications/*` | Notification channels CRUD + logs |
| `/api/settings` | App settings |
| `/api/realtime/stats` | WebSocket stats |

#### Grafana OpenSearch Proxy
- `POST /grafana-proxy/*` — Maps Grafana OpenSearch queries to the OpenSearch Dashboards proxy, supporting `_search`, `_mapping`, `_field_caps`, `_msearch`, `_cluster/health`

### 4.3 Database Schema (SQLite)

| Table | Key Columns | Purpose |
|---|---|---|
| `rules` | id, name, enabled, conditions, actions, groupIds, frequency, suppression | Custom detection rules |
| `rule_groups` | id, name, description, color | Rule grouping |
| `rule_versions` | id, ruleId, versionNumber, snapshot, comment | Rule version history |
| `decoders` | id, name, format, regex, fields, order, parentId | Log format decoders |
| `decoder_tests` | id, decoderId, input, expected | Decoder test cases |
| `users` | id, username, password(bcrypt), role | User accounts |
| `notifications` | id, name, type, config | Notification channels |
| `notification_logs` | id, notificationId, status, result | Delivery logs |
| `settings` | key, value | Key-value settings |

### 4.4 Database Location
`data/dashboard.db` (auto-created, WAL mode, foreign keys enabled)

### 4.5 Real-time Engine (WebSocket)
- Polls upstream API for new alerts every 15s (configurable)
- Decodes logs via decoder engine
- Evaluates rules via rule engine
- Broadcasts matches, alerts via WebSocket
- Integrates with notifier for webhook dispatch
- Tracks frequency/suppression for alert dedup

---

## 5. Frontend Architecture

### 5.1 State Management
- **AppContext** (useReducer) — Global search state: filters, results, fields, pagination, theme, tabs
- **AuthContext** — JWT token, user info, login/logout
- **DashboardContext** (useReducer) — Custom dashboard state: panels, layout, filters, tabs, folders
- **ToastContext** — Toast notification queue

### 5.2 Data Flow
```
User Action → Component → api.js (Axios) → Vite Proxy → Express → Upstream API
                                                              ↓
                                                         Response
                                                              ↓
Component ← setState/Reducer ← data ← api.js ← Express ← Upstream
```

### 5.3 Custom Dashboard System (21 widget types)
```
DashboardTab
└── CustomDashboardTab (467 lines)
    ├── DashboardToolbar (save, clone, import/export)
    ├── DashboardTabs (tab bar with rename)
    ├── DashboardFolderSelector (folder dropdown)
    ├── WidgetLibraryModal (single-click widget picker)
    ├── TemplateLibraryModal (SOC template picker)
    ├── GlobalFilters (filter chips bar)
    ├── DashboardGrid (react-grid-layout, 12 cols)
    │   └── DashboardPanel (793 lines, 21 chart types)
    │       ├── Metric / Gauge / KPI / Alert Counter
    │       ├── Bar / Line / Area / Pie / Heatmap / Timeline
    │       ├── Table / Log Stream / Event Logs
    │       ├── Tag Cloud / Top N / Cluster Bubble
    │       └── Compliance frameworks
    ├── PanelSettingsModal (~920 lines, accordion UI)
    └── ContextMenu (11-item right-click menu)
```

### 5.4 Widget Types & API Mapping

| Widget Type | API Endpoint | Aggregation |
|---|---|---|
| metric, gauge, kpi, alert-counter | `/api/count` | count |
| bar, line, area, pie, heatmap, timeline, tagcloud | `/api/aggregate?type=terms` | terms |
| table, log-stream | `/api/aggregate?type=terms` or `/api/search` | terms/search |
| event-logs | `/api/search` | search with sort |
| EPS widgets | `/api/eps-stats` | EPS/ingestion |
| markdown | — | Static content |

### 5.5 Global Filter System
- Key:Value pair filters with field autocomplete (46 FIELD_PRESETS)
- Text query filters (Lucene DQL)
- Include/exclude toggle
- Dedup by key
- Filters propagate via `buildQ()` → API `q` parameter
- Chart click → inline filter (bar, line, area, pie, table cell)
- Date range selector applies to all panels

---

## 6. Security Architecture

- JWT authentication with bcrypt password hashing
- Role-based access control (admin/analyst/viewer)
- Auth middleware on sensitive routes (users, notifications, settings)
- SQLite parameterized queries (no SQL injection)
- Input sanitization (regex stripping of special chars)
- 120s API timeout
- Token expiry (configurable via JWT_EXPIRY)
- CORS enabled
- No-auth fallback mode when upstream doesn't support auth

---

## 7. Compliance Frameworks Supported

| Framework | Field | Controls |
|---|---|---|
| PCI-DSS | `rule.pci_dss` | 11.5, 6.4.2, 10.5.5, 8.2.3, 3.4.1 |
| HIPAA | `rule.hipaa` | 164.312(a)(1), 164.312(c)(1), etc. |
| GDPR | `rule.gdpr` | II_5.1.f, IV_35.7.d, etc. |
| SOC 2 (TSC) | `rule.tsc` | CC6.1, CC6.8, CC7.2, etc. |
| MITRE ATT&CK | `rule.mitre_attack` | T1078, T1136, T1098, etc. |
| NIST 800-53 | `rule.nist_800_53` | AC-6, AU-6, CM-8, SI-4, RA-5 |

All compliance dashboards support: overview + single-framework views, severity distribution, trend analysis, agent breakdown, control mapping, recent events.

---

## 8. Key Configuration Files

| File | Purpose |
|---|---|
| `.env` | API_URL, PORT, JWT_SECRET |
| `vite.config.js` | Dev proxy: `/api` → `:3099` |
| `tailwind.config.js` | SOC color scheme, dark mode |
| `package.json` | Dependencies + 5 npm scripts |
| `opencode.json` | AI agent config → AGENTS.md |
| `postcss.config.js` | PostCSS plugins |

---

## 9. Data Flow for Common Operations

### Loading a Dashboard Widget
```
1. User adds widget → WidgetLibraryModal
2. DashboardPanel mounts → useEffect triggers loadData()
3. fetchPanelData() calls buildQ() with panel.query + globalFilters
4. API call based on widget type:
   - Count widgets → GET /api/count?q=...&index=...
   - Agg widgets → GET /api/aggregate?q=...&field=...&type=terms
   - Search widgets → POST /api/search
5. Response processed → Recharts data format
6. Panel renders chart
```

### Real-time Alert Flow
```
1. Upstream API polled every 15s
2. New alerts detected via @timestamp cursor
3. Logs decoded via decoder engine
4. Rules evaluated against decoded data
5. Matches broadcast via WebSocket to all clients
6. Notifier sends webhooks for matched rules
7. Dashboard panels with realtime subscriptions updated
```

---

## 10. Development & Build

```bash
# Development (Vite + Express concurrently)
npm start            # Runs both dev server + backend

# Or separately:
npm run dev          # Vite dev server on :5173
npm run server       # Express on :3099

# Production build
npm run build        # Vite build → dist/
npm run preview      # Preview production build
```

### Server auto-port-fallback
If port 3099 is in use, server auto-increments until it finds a free port.
