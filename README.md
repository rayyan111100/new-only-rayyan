# Wazuh SOC Dashboard

A professional Security Operations Center (SOC) dashboard built with React + Vite + Tailwind CSS, connecting to Wazuh API for security event monitoring and analysis.

![Dashboard](output/Screenshot%202026-05-25%20224822.png)

---

## Features

### Tabs
- **Discover** — Full OpenSearch-style log exploration with DQL search, filter bar, histogram, sortable results table, row expansion (Table/JSON views), field sidebar with stats, column toggle/reorder
- **Dashboard** — Security overview with event counts and severity distribution
- **Scan** — Security scan against IP/hostname/URL targets
- **Analytics** — Top rules, top agents, severity distribution charts (recharts)
- **Geo** — Geo-location cards by source IP
- **Health** — Wazuh cluster health, indices list, index stats
- **Indices** — Index management overview

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
- **Endpoints**: `/api/search`, `/api/count`, `/api/aggregate`, `/api/fields`, `/api/health`, `/api/indices`, `/api/index-stats`, `/api/scan`, `/api/geo`
- **120s timeout** for large result sets (7.9M+ events)
- **SPA fallback** — serves built React app from `dist/`

---

## Screenshots

| Discover Tab | Dashboard Tab |
|:---:|:---:|
| ![Discover](output/Screenshot%202026-05-25%20224822.png) | ![Dashboard](output/Screenshot%202026-05-25%20142122.png) |

| Doc Viewer | Refresh Interval |
|:---:|:---:|
| ![DocViewer](output/Screenshot%202026-05-25%20171900.png) | _(auto-refresh controls in QueryBar)_ |

---

## Setup

### Prerequisites

- Node.js (v18+)
- Wazuh API endpoint (default: `http://192.168.1.77:9999`)

### Environment

Create `.env` in project root:

```
WAZUH_API_URL=http://192.168.1.77:9999
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
    DashboardStats.jsx
  tabs/
    DiscoverTab.jsx
    DashboardTab.jsx
    ScanTab.jsx
    AnalyticsTab.jsx
    GeoTab.jsx
    HealthTab.jsx
    IndicesTab.jsx
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

---

## GitHub

Repository: https://github.com/Gopal-DevSecOps/wazuh-discover.git
