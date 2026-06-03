# Wazuh SOC Dashboard

Enterprise-grade Security Operations Center dashboard for Wazuh SIEM. Real-time alert monitoring, rule management, geo-tracking, and comprehensive analytics.

![Dashboard Screenshot](output/Screenshot%202026-06-03%20170552.png)

## Features

### 🔍 Discover (SIEM Search)
- Full-text search with DQL (Dashboard Query Language)
- Field filters with AND/OR match modes
- Date range picker (relative, absolute, presets)
- Auto-refresh with configurable intervals
- **Server-side pagination** with `offset`/`limit` (no 10k max_result_window limit — uses `/scan` for deep pages)
- Live clock display
- Go-to page input for direct navigation
- Column drag-and-drop reorder

### 📊 Dashboard
- Alert timeline histogram with brush selection
- Rule-level distribution (pie chart)
- Top rules, agents, and categories
- Recent alerts table with drill-down

### ⚙️ Rules Engine
- Visual rule builder with nested conditions
- Rule evaluation engine with priority/overwrite
- Rule groups with color-coded badges
- Version history with diff/rollback
- Test lab with sample event simulation
- Bulk operations (move, copy, delete, export)

### 🛡️ Security Hub
- Multi-tab security overview
- Alert level distribution over time
- Drill-down to specific time ranges
- MITRE ATT&CK mapping support

### 🌍 Geo Tracking
- GeoIP data visualization
- Location-based alert aggregation

### 📋 Additional Tools
- Index browser and health monitoring
- Log decoder/parser with format detection
- Scan results viewer
- Raw search endpoint access

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Wazuh API credentials:
#   WAZUH_API_URL=https://your-wazuh-manager:55000
#   WAZUH_USER=your-username
#   WAZUH_PASSWORD=your-password

# Start development server (frontend + API proxy)
npm start

# Or run separately:
npm run dev     # Vite dev server on :5173
npm run server  # Express proxy on :3000
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   React     │────▶│  Express.js  │────▶│  Wazuh API  │
│   (Vite)    │◀────│   Proxy (:3000)│◀────│  (:55000)   │
└─────────────┘     └──────────────┘     └─────────────┘
       │                                        │
       │                                        │
       ▼                                        ▼
  localStorage                           OpenSearch
  (rules, groups,                          (alerts)
   saved searches)
```

### Key Technologies
- **Frontend:** React 18 + Vite 5, Tailwind CSS 3, Framer Motion
- **Visualization:** Recharts (bar, pie, area, line charts)
- **PDF Export:** jsPDF + jspdf-autotable
- **Backend:** Express.js proxy with JWT auth
- **Data Storage:** localStorage (rules/groups), OpenSearch (alerts via Wazuh API)

## UI Components

| Component | Location | Description |
|---|---|---|
| `Navbar` | `src/components/Navbar.jsx` | Top bar with New/Save/Open/Share/Reporting/Inspect |
| `Sidebar` | `src/components/Sidebar.jsx` | Left navigation with tab switching |
| `QueryBar` | `src/components/QueryBar.jsx` | DQL input, filter chips, date picker, saved filters |
| `ResultsTable` | `src/components/ResultsTable.jsx` | Paginated data table with column drag-drop |
| `FieldSidebar` | `src/components/FieldSidebar.jsx` | Field explorer with type/color indicators |
| `Histogram` | `src/components/Histogram.jsx` | Time-based bar chart with time range selection |
| `DateRangePicker` | `src/components/DateRangePicker.jsx` | Relative/absolute date selection |
| `RefreshInterval` | `src/components/RefreshInterval.jsx` | Auto-refresh controls |

## Pages / Tabs

| Tab | File | Purpose |
|---|---|---|
| Discover | `DiscoverTab.jsx` | Main SIEM search with resizable splitter |
| Dashboard | `SocDashboard.jsx` | Alert overview and statistics |
| Security Hub | `SecurityHub.jsx` | Multi-view security analysis |
| Rules | `RulesTab.jsx` | Rule CRUD and management |
| Rule Groups | `RuleGroupsTab.jsx` | Group management |
| Group Rules | `GroupRulesTab.jsx` | Group-rule assignments |
| Rule View | `RuleViewTab.jsx` | Rule application on search results |
| Analytics | `AnalyticsTab.jsx` | Alert level distribution |
| Geo | `GeoTab.jsx` | GeoIP data |
| Search | `SearchTab.jsx` | Raw API search |
| Indices | `IndicesTab.jsx` | Index listing & stats |
| Health | `HealthTab.jsx` | API health monitoring |
| Decoder | `DecoderTab.jsx` | Log parsing |
| Scan | `ScanTab.jsx` | Security scan results |

## API Endpoints

All proxied through Express to Wazuh API:

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/search` | GET | Event search with pagination |
| `/api/scan` | GET/POST | Deep pagination (no 10k limit) |
| `/api/count` | GET | Document count |
| `/api/aggregate` | GET | Field aggregations & histograms |
| `/api/fields` | GET | Index field mapping |
| `/api/indices` | GET | Index listing |
| `/api/health` | GET | API health check |
| `/api/dashboard` | GET | Aggregated dashboard data |

## Roadmap

- [x] Discover tab with DQL search & filters
- [x] Pagination with deep page support (scan API)
- [x] Column drag-and-drop reorder
- [x] Save/Open/Share search configurations
- [x] CSV & PDF reporting
- [x] Resizable splitter panels
- [x] Live clock & auto-refresh
- [ ] Alert notifications & webhooks
- [ ] Custom dashboard widgets
- [ ] User role-based access control
- [ ] Advanced MITRE ATT&CK mapping
- [ ] Real-time WebSocket updates
- [ ] Multi-index search comparison
- [ ] Saved search tagging & categories

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
```

## License

MIT
