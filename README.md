# Wazuh SOC Dashboard

A professional Security Operations Center (SOC) dashboard built with React + Vite + Tailwind CSS, connecting to Wazuh API for security event monitoring and analysis.

![Dashboard](output/Screenshot%202026-05-25%20224822.png)

---

## Features

### Tabs
- **Discover** — Full OpenSearch-style log exploration with DQL search, filter bar, histogram, sortable results table, row expansion (Table/JSON views), field sidebar with stats, column toggle/reorder. Includes **Apply Rules** toggle to evaluate enabled rules against live results.
- **Dashboard** — Full SOC security dashboard with summary cards (24h/7d/30d counts, alert rate), severity distribution bars, alert timeline area chart, top rules/agents, categories donut chart, recent alerts feed — all auto-refreshing every 60s
- **Scan** — Security scan against IP/hostname/URL targets
- **Analytics** — Top rules, top agents, severity distribution charts (recharts)
- **Geo** — Geo-location cards by source IP
- **Health** — Wazuh cluster health, indices list, index stats
- **Indices** — Index management overview
- **Rules** — Rule Engine for creating and testing custom Wazuh-style rules

### Rule Engine
- **Create rules** with multiple conditions (AND/OR logic), field selectors with autocomplete (50+ Wazuh fields), operators (equals/contains/regex/startsWith/endsWith/gt/lt/inList/exists), and NOT negation
- **Actions**: alert (severity + custom level 0-15 + interpolated message), tag, ignore
- **Overwrite mode** — when enabled, rule overrides `rule.level` and `rule.description` in Discover tab
- **Ignore IPs** — CIDR-based IP exclusion per rule
- **Test panel** — Run Test against live data with per-condition match/fail indicators
- **Batch Test All Rules** — Test all enabled rules against latest 50 alerts with match percentage
- **Apply Rules in Discover** — Toggle ⚙ Rules in Discover tab to see rule-matched alerts with:
  - Severity-colored Rule column with rule name badge
  - Overridden `rule.level` (new badge + original strikethrough)
  - Overridden `rule.description`
  - Row highlighting by severity (red/orange/yellow/green)
  - Purple stats bar with per-rule match counts
- **Import/Export** — JSON-based rule sharing between instances
- **Dashboard** — Stats overview (total/enabled/disabled rules, by group, by priority, overwrite count)

### UI/UX
- **Inter font** with professional color palette (`#3b82f6` accent blue)
- **Dark/Light mode** with smooth transitions
- **EUI-style components**: Refresh Interval (number + unit select + Start/Stop), Date Range Picker with quick selects
- **Responsive sidebar** with collapse toggle (SVG chevron icons)
- **Field type tokens** — T (string), # (number), ✓ (boolean), D (date), IP, {} (object), [] (array)
- **Hover-reveal action buttons** — filter for, filter out, toggle column, filter exists on every table cell and doc viewer row
- **Custom scrollbar** styling (8px, border-clipping gap, Firefox `scrollbar-width: thin`)
- **Copy JSON** button in Doc Viewer JSON tab
- **Auto-refresh** timer with configurable interval (seconds/minutes/hours)

### Backend
- **Express.js proxy** server forwarding all requests to Wazuh API
- **Endpoints**: `/api/search`, `/api/count`, `/api/aggregate`, `/api/fields`, `/api/health`, `/api/indices`, `/api/index-stats`, `/api/scan`, `/api/geo`, `/api/dashboard` (parallel 9-call aggregate)
- **JWT Authentication** — automatic token acquisition via `WAZUH_USER`/`WAZUH_PASSWORD` with 5-min refresh; falls back to no auth if credentials not set
- **120s timeout** for large result sets (7.9M+ events)
- **SPA fallback** — serves built React app from `dist/`

---

## Screenshots

| Discover Tab | Dashboard Tab (SOC) |
|:---:|:---:|
| ![Discover](output/Screenshot%202026-05-25%20224822.png) | ![SOC Dashboard](output/Screenshot%202026-05-25%20225706.png) |

| Doc Viewer | Dashboard Tab (previous) |
|:---:|:---:|
| ![DocViewer](output/Screenshot%202026-05-25%20171900.png) | ![Dashboard old](output/Screenshot%202026-05-25%20142122.png) |

---

## Setup

### Prerequisites

- Node.js (v18+)
- Wazuh API endpoint (default: `http://192.168.1.77:9999`)

### Environment

Create `.env` in project root:

```
WAZUH_API_URL=http://192.168.1.77:9999
WAZUH_USER=admin
WAZUH_PASSWORD=your_password
PORT=3000
```

### Install & Run

```bash
npm install
npm run dev        # dev mode (Vite HMR on :5173)
# or
npm run build      # production build
npm start          # serve built app on :3000
```

- Dev: **http://localhost:5173**
- Production: **http://localhost:3000**

---

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | React 18 + Vite 5 |
| Styling | Tailwind CSS 3 + Framer Motion |
| Charts | Recharts |
| Tables | @tanstack/react-table |
| Backend | Express.js |
| HTTP | Axios |
| Date | Day.js |

---

## Project Structure

```
src/
  api.js              — Axios client (baseURL: /api, timeout: 120s)
  App.jsx             — Root layout, tab routing, sidebar + navbar
  main.jsx            — Entry point
  index.css           — Tailwind + custom component classes
  context/
    AppContext.jsx     — Global state (search, filters, columns, refresh, theme)
  components/
    Navbar.jsx        — Top bar with theme toggle + clock
    Sidebar.jsx       — Collapsible nav with 7 tabs
    QueryBar.jsx      — DQL input, quick dates, filter bar, refresh interval
    DateRangePicker.jsx
    RefreshInterval.jsx — EUI-style auto-refresh controls
    Histogram.jsx     — Time-series bar chart
    ResultsTable.jsx  — Sortable, filterable results with row expansion
    DocViewer.jsx     — Table/JSON views with field tokens + action buttons
    FieldSidebar.jsx  — Field list with stats popover
    DashboardStats.jsx  (replaced by SocDashboard)
    SocDashboard.jsx    — Full SOC dashboard: 7 widgets with live Wazuh data
    RuleBuilder.jsx  — Full rule editor: conditions, actions, ignore IPs, test panel
    ResultsTable.jsx — Sortable, filterable results with rule match badges & overrides
  services/
    ruleStorage.js   — localStorage CRUD for rules & groups
    ruleEngine.js    — Rule evaluation engine: conditions, CIDR match, message interpolation
  tabs/
    DiscoverTab.jsx
    DashboardTab.jsx
    ScanTab.jsx
    AnalyticsTab.jsx
    GeoTab.jsx
    HealthTab.jsx
    IndicesTab.jsx
    RulesTab.jsx
server/
  server.cjs          — Express proxy + static file serving
```

---

## Changelog

| Date | Change |
|------|--------|
| Initial | Project setup with Vite + React, Express proxy to Wazuh API |
| Added | Discover tab with DQL search, histogram, results table, field sidebar |
| Added | Scan, Analytics, Geo, Health, Indices tabs |
| Added | Date range picker with quick selects, column sort/move/remove |
| Added | Doc Viewer with Table/JSON tabs, field type tokens, filter action buttons |
| Added | Refresh interval component with auto-refresh timer |
| Improved | Pro design overhaul — Inter font, new color palette, dark/light mode |
| Improved | Sidebar with SVG collapse, rounded active state, hover effects |
| Improved | Scrollbar styling, badge colors, card shadows |
| Fixed | Server timeouts increased to 120s for large datasets |
| Fixed | Circular dependency in dynamic import — switched to static import |
| Added | SOC Dashboard with 7 live widgets (summary cards, severity bars, timeline area, top rules, categories donut, top agents, recent alerts) via `/api/dashboard` endpoint |
| Added | Auto-refresh every 60s on Dashboard tab |
| Added | Rule Engine — RuleBuilder with conditions, actions, overwrite mode, ignore IPs, import/export, dashboard stats, test panel, batch testing |
| Added | Apply Rules in Discover tab — client-side rule evaluation, severity-colored Rule column, overridden level/description, row highlighting, stats bar |
| Added | Custom level override (0-15) in rule action params |
| Added | Expanded field selector with 50+ Wazuh fields + free-text input with datalist autocomplete |
| Added | Wazuh API JWT authentication — auto token acquisition via WAZUH_USER/WAZUH_PASSWORD in .env |

---

## GitHub

Repository: https://github.com/Gopal-DevSecOps/wazuh-discover.git
