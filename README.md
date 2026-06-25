# UniShield360 SOC Dashboard

Enterprise-grade Security Operations Center dashboard for UniShield360 SIEM. Real-time alert monitoring, rule management, geo-tracking, comprehensive analytics, and a fully customizable SOC dashboard builder.

---

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start development server (frontend + API proxy)
npm start

# Or run separately:
npm run dev     # Vite dev server on :5173
npm run server  # Express proxy on :3099
```

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│   React     │────▶│  Express.js  │────▶│  UniShield360    │
│   (Vite)    │◀────│   Proxy      │◀────│  API (:9999)     │
└─────────────┘     └──────────────┘     └──────────────────┘
       │                                        │
       │                                        ▼
       ▼                                   OpenSearch
  localStorage                           (alerts index)
```

### Key Technologies
- **Frontend:** React 18 + Vite 8, Tailwind CSS 3, Framer Motion
- **Charts:** Plotly.js (bar, pie, area, line, scatter, heatmap), Recharts (timeline area)
- **Tables:** @tanstack/react-table
- **PDF Export:** jsPDF + jspdf-autotable
- **Backend:** Express.js proxy + SQLite (rules/groups)
- **Real-time:** WebSocket-based alert streaming
- **Data Storage:** OpenSearch (alerts), localStorage (dashboards/templates/folders), SQLite (rules/groups)

---

## Custom Dashboard System

The custom dashboard system is the core visualization layer — a drag-and-drop, widget-based SOC dashboard builder with 21+ widget types, global filtering, and folder/tab organization.

### 📁 Folder → Tab → Dashboard Hierarchy

```
Folder (e.g. "SOC Overview")
  └── Tab (e.g. "Network Security")
        └── Dashboard
              ├── Metric Card (Total Events)
              ├── Severity Pie Chart
              ├── Timeline Area Chart
              ├── Data Table
              └── ...
```

- **Folders** group related dashboards
- **Tabs** within folders switch between different dashboard views
- **Dashboard state** persisted to localStorage (`unishield_folders`, `unishield_dashboards`)

### 🧩 Widget Types (21+)

| Type | API Endpoint | Description |
|------|-------------|-------------|
| **metric** | `/api/count` | Single numeric KPI with threshold colors |
| **gauge** | `/api/count` | Circular gauge with percentage |
| **kpi** | `/api/count` | Key Performance Indicator |
| **alert-counter** | `/api/count` | 4-quadrant alert severity matrix |
| **bar** | `/api/aggregate?type=terms` | Vertical/horizontal bar chart with palettes |
| **pie** | `/api/aggregate?type=terms` | Donut chart with custom labels |
| **severity-pie** | `/api/aggregate?type=terms` | Severity-level pie chart |
| **line** | `/api/aggregate?type=date_histogram` | Time-series line chart |
| **area** | `/api/aggregate?type=date_histogram` | Filled area time-series |
| **timeline** | `/api/aggregate?type=date_histogram` | Gradient-filled timeline |
| **timeline-area** | Custom component | Timelines with area fill |
| **heatmap** | `/api/aggregate` | MITRE tactic heatmap |
| **table** | `/api/aggregate` or `/api/search` | Aggregation or raw data table |
| **data-table** | `/api/search` | Raw event log table with expandable rows |
| **log-stream** | `/api/search` | Real-time event log stream |
| **event-logs** | `/api/search` | Event log viewer with sort/pagination |
| **tagcloud** | `/api/aggregate` | Rule description tag cloud |
| **top-n** | Custom component | Top-N items with horizontal bars |
| **clusterbubble** | `/api/aggregate` | Agent cluster visualization |
| **markdown** | — | Static markdown content |
| **EPS widgets** | `/api/eps-stats` | EPS rate, ingestion stats, trends |

### 🔧 Widget Configuration (Panel Settings)

Each widget has configurable settings accessible via right-click → Settings:

- **Data Source:** Security Alerts, Agent Status, MITRE ATT&CK
- **Metric Type:** Total Events, Critical/High/Medium/Low, Total Agents, EPS, Ingestion
- **Aggregation:** Terms (field), Date Histogram (interval), Cardinality
- **Buckets:** Field select, order by (count/term/key), size, include/exclude values
- **X-Axis:** Label display, grid lines, rotation angle
- **Y-Axis:** Title, min/max range, threshold line
- **Legend:** Position (top/bottom/left/right/none)
- **Colors:** Qualitative/Warm/Cool palettes
- **Data Labels:** Show/hide, font size, bar orientation (vertical/horizontal)
- **Thresholds:** Comma-separated value=color rules
- **Custom CSS:** Per-panel CSS overrides

---

## 🌐 Global Filter System

The global filter system allows cross-widget filtering — any filter applied from one widget affects ALL widgets on the dashboard.

### Filter Types

| Type | UI | API Format | Endpoints Supported |
|------|-----|-----------|-------------------|
| **Pair (Key:Value)** | Field autocomplete + value input | `field:value` | count, aggregate, search ✅ |
| **Text Query** | Raw Lucene query input | As-is | count, aggregate, search ⚠️ |
| **Range (is between)** | Generated by Metric card Include/Exclude | `field:[x TO y]` | count ✅, aggregate/search ❌ |

### Filter Flow

```
User clicks Include/Exclude → addFilter() → ADD_FILTER + TRIGGER_REFRESH
  → Reducer: dedup by key, skip internal fields
  → refreshCounter++
  → DashboardPanel useEffect fires
  → loadData() → fetchPanelData(panel, globalFilters)
  → buildQ() merges panel query + global filters
  → API call (/count, /aggregate, or /search)
```

### Include vs Exclude

| Action | Filter Created | In API Query | Handling |
|--------|---------------|-------------|----------|
| **Include** (Metric card) | `{type: 'pair', key, value}` (simple equality) | `field:value` | Works on ALL endpoints ✅ |
| **Exclude** (Metric card) | `{type: 'pair', key, value, operator:'is between', secondValue}` | Skipped from query | Client-side: `applyExcludeToCount()`, `applyExcludeToBuckets()`, `applyExcludeToRows()` ✅ |
| **Include** (Data Table cell) | `{type: 'pair', key, value}` (simple equality) | `field:value` | Works on ALL endpoints ✅ |
| **Exclude** (Data Table cell) | `{type: 'pair', key, value}` (client-side filtered) | Skipped from query | Client-side: filtered from results ✅ |

### Known API Limitation: Range Queries

The upstream UniShield360 API (port 9999) does NOT support Lucene range syntax `[x TO y]` on `/api/aggregate` or `/api/search` endpoints (returns 0 results). It only works on `/api/count`.

**Workaround applied:**
- **Metric card Include** uses simple equality (`rule.level:12`) instead of range (`rule.level:[12 TO 15]`). This works on ALL endpoints.
- **Metric card Exclude** preserves the range — handled client-side via `applyExcludeToBuckets()` and `applyExcludeToRows()`.
- **Count-based panels** still receive the full range query via `addRangeToQuery()` (because `/api/count` supports ranges).

### Filter Match Mode

- **ALL (AND)** — default. All filters must match.
- **ANY (OR)** — Toggle button appears when 2+ filters exist.

### Filter Chips

Each active filter shows as a chip with:
- Label (field + operator + value)
- Toggle Include/Exclude (negate)
- Disable/Enable toggle
- Pin/Unpin (pinned filters survive "Clear")
- Invert button
- Copy DQL
- Save as preset
- Remove

---

## 🎯 Metric Card Include/Exclude (Severity Filtering)

When clicking on a Metric card value (e.g., "Critical: 33"), a dropdown appears with **Include** and **Exclude** options.

### How Include Works

The Metric card uses `FILTER_MAP` for severity-based metrics:

```js
const FILTER_MAP = {
  critical: { key: 'rule.level', value: '12', operator: 'is between', secondValue: '15' },
  high:     { key: 'rule.level', value: '7',  operator: 'is between', secondValue: '11' },
  medium:   { key: 'rule.level', value: '4',  operator: 'is between', secondValue: '6' },
  low:      { key: 'rule.level', value: '1',  operator: 'is between', secondValue: '3' },
}
```

- **Include:** Creates `{type:'pair', key:'rule.level', value:'12'}`
  - `buildQ()` generates `rule.level:12` (simple equality)
  - Works on count (11698), aggregate (5 buckets), search (10000+) ✅
- **Exclude:** Creates `{type:'pair', key:'rule.level', value:'12', operator:'is between', secondValue:'15'}`
  - `buildQ()` skips it (exclude)
  - `applyExcludeToCount()` adds `[12 TO 15]` to count query
  - `applyExcludeToBuckets()` filters bucket keys within 12-15 range
  - `applyExcludeToRows()` filters row values within range

### How Filter Values (Panel Setting) Works Together

The Panel Settings "Filter Values" checkbox feature stores selections in `query.aggregation.include[]`. When the API is called:
- `q=rule.level:12` (from global filter) — filters DOCUMENTS
- `include=[3,5,12]` (from Filter Values) — filters BUCKET KEYS
- Both use AND logic — only matching documents AND bucket keys are shown

---

## 📊 Data Table Cell Filtering

Clicking any cell in a Data Table opens an **Include/Exclude** dropdown.

### How It Works

```js
addFilter({ type: 'pair', key: filterKey, value: String(row[c] ?? ''), exclude: false })
```

- `filterKey` = column name (e.g., `rule.id`, `rule.level`, `agent.name`)
- `value` = cell value as string
- `operator` defaults to `'is'` in the store

**Auto-quoting for keyword fields:** Numeric-only values (like `rule.id:752`) are auto-quoted to `rule.id:"752"` because the API requires quoted values for keyword-type fields. Long-type fields (like `rule.level`) also accept quoted values without issue.

---

## 🥧 Pie Chart Item Filtering

Click-to-filter from the pie chart itself has been **removed**. Instead, filter options appear as **Include/Exclude buttons on each data item listed below the pie chart**.

This provides a cleaner UX — the user clicks on item labels (e.g., IP addresses) rather than on chart slices.

---

## 📈 Chart Click Filtering (Bar, Line, Area)

Bar/Line/Area charts support a click-to-filter dropdown. Clicking on any chart element shows:
- **Include** — adds `field:value` as global filter
- **Exclude** — adds `field:value` as global exclude filter

The dropdown appears at the click position. The field is determined by the chart's aggregation configuration.

---

## ⏰ Time Range Presets

| Preset | Value |
|--------|-------|
| Last 1 hour | `now-1h` |
| Last 6 hours | `now-6h` |
| Last 24 hours | `now-24h` |
| Last 3 days | `now-3d` |
| Last 7 days | `now-7d` |
| Last 30 days | `now-30d` |
| Last 90 days | `now-90d` |
| This month | `now/M` |
| Previous month | `now-1M/M` |
| This year | `now/y` |
| Custom Range | User-defined `from`/`to` |

---

## 🌙 Dark Mode

- Toggle in the top navigation bar
- Dark mode state persisted in localStorage (`theme` key)
- All chart fonts, metric values, gauge backgrounds, and UI elements adapt to dark mode
- Plotly font colors: `#9ca3af` (dark) / `#6b7280` (light)
- Metric value colors: `#e4e6eb` (dark) / `#1f2328` (light)

---

## 🧠 State Management

### Dashboard Store (useReducer + Context)

File: `src/components/dashboard/dashboardStore.jsx`

```
State:
  dashboards, activeDashboard, panels, gridLayout
  timeRange, globalFilters, filterMatch
  refreshCounter, fullScreen, darkMode

Actions (16):
  SET_DASHBOARDS, SET_ACTIVE, ADD_DASHBOARD, UPDATE_DASHBOARD, DELETE_DASHBOARD
  ADD_PANEL, UPDATE_PANEL, REMOVE_PANEL, SET_LAYOUT
  SET_TIME_RANGE, ADD_FILTER, REMOVE_FILTER, UPDATE_FILTER, SET_FILTERS
  TOGGLE_FULLSCREEN, SET_EDITING, SET_FILTER_MATCH
  CLEAR_FILTERS, TRIGGER_REFRESH, TOGGLE_APPLY_FILTERS, TOGGLE_APPLY_TIME
```

### App Context

File: `src/context/AppContext.jsx`

Global app state (theme, discovery search, auth, tabs).

---

## 🗄️ Dashboard Persistence

| Storage | Key | Content |
|---------|-----|---------|
| localStorage | `unishield_folders` | Folder → Tab → Dashboard tree (v2 schema) |
| localStorage | `unishield_dashboards` | Legacy flat dashboard list |
| localStorage | `unishield_user_templates` | User-saved templates |
| localStorage | `unishield_saved_filters` | Saved filter presets |
| localStorage | `unishield_copied_design` | Copied panel design |

---

## 📁 Key Source Files

| File | Purpose |
|------|---------|
| `src/tabs/CustomDashboardTab.jsx` | Main custom dashboard orchestrator |
| `src/components/dashboard/DashboardPanel.jsx` | Panel renderer + data fetching + buildQ |
| `src/components/dashboard/dashboardStore.jsx` | State management (useReducer) |
| `src/components/dashboard/DashboardGrid.jsx` | react-grid-layout wrapper |
| `src/components/dashboard/DashboardToolbar.jsx` | Save, clone, import/export |
| `src/components/dashboard/TimeRangeSelector.jsx` | Time range preset selector |
| `src/components/dashboard/GlobalFilters.jsx` | Inline filter UI |
| `src/components/dashboard/PanelSettingsModal.jsx` | Panel configuration (920 lines) |
| `src/components/dashboard/WidgetLibraryModal.jsx` | Widget picker |
| `src/components/dashboard/TemplateLibraryModal.jsx` | SOC template picker |
| `src/components/dashboard/dashboardService.js` | Dashboard CRUD |
| `src/components/dashboard/dashboardFolderService.js` | Folder/tab CRUD |
| `src/components/FilterChip.jsx` | Filter chip component |
| `src/components/dashboard/DashboardFilterEditor.jsx` | Inline filter editor |
| `server/server.cjs` | Express proxy + OS integration |

---

## 🔧 Recent Fixes (June 2026)

| # | Issue | Fix | File:Line |
|---|-------|-----|-----------|
| 1 | **Metric Include not filtering all panels** | Changed Include to use simple equality instead of range. Range queries break aggregate/search APIs. | `DashboardPanel.jsx:684-688` |
| 2 | **Exclude with range operators broken** | `applyExcludeToCount()` now translates `is between` to `[x TO y]` for count endpoint. `applyExcludeToBuckets()` handles numeric range filtering. | `DashboardPanel.jsx:143-161, 164-183` |
| 3 | **Data Table filtering (rule.id) returning 0** | Auto-quote numeric-only values in `buildQ()`: `rule.id:"752"` instead of `rule.id:752` | `DashboardPanel.jsx:68-70` |
| 4 | **Chart click missing Exclude option** | Added Include/Exclude dropdown popup on chart click (all chart types) | `DashboardPanel.jsx:475-516` |
| 5 | **Pie chart click-to-filter removed** | Click-to-filter from pie chart removed. Instead, Include/Exclude buttons on item labels below chart. | `DashboardPanel.jsx:1057-1093` |
| 6 | **Night mode — numbers invisible** | Metric value color `#e4e6eb` (dark mode), Plotly fonts `#9ca3af` (dark mode), gauge background `#374151` | `DashboardPanel.jsx:683, 1026, 718` |
| 7 | **Missing time presets** | Added "Last 6 hours" (`now-6h`) and "Last 3 days" (`now-3d`) | `TimeRangeSelector.jsx:6-7` |

---

## ⚠️ Known API Limitations

| Limitation | Affected Endpoints | Workaround |
|-----------|-------------------|------------|
| Range queries `[x TO y]` not supported | `/api/aggregate`, `/api/search` | Convert to simple equality for Include; client-side filtering for Exclude |
| `OR` operator not supported | `/api/aggregate`, `/api/search` | Use multiple individual filters with `filterMatch: OR` (UI only) |
| Comparison operators `>`, `<`, `>=`, `<=` not supported | All endpoints | N/A — cannot be represented |
| `NOT` / `-` prefix not supported | All endpoints | Use Exclude via client-side filtering |
| Auth endpoint returns 501 | `/security/user/authenticate` | Server runs in no-auth mode |

---

## Development

```bash
# Run with hot-reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Start API proxy only
npm run server

# Build with error checking
npx vite build
```

---

## License

MIT
