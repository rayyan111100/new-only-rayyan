# Custom Dashboard — Complete Documentation

## Overview

The Custom Dashboard is a full-featured drag-and-drop dashboard builder that allows users to create, save, and share custom SOC monitoring dashboards. All data is persisted in `localStorage` — no backend API calls for CRUD operations. Widget panels fetch real-time data from the UniShield360 backend API.

---

## File Structure

```
src/
├── tabs/
│   └── CustomDashboardTab.jsx       # Main tab entry point + all UI logic
├── components/dashboard/
│   ├── dashboardStore.jsx           # State management (useReducer + Context)
│   ├── dashboardService.js          # Dashboard CRUD (localStorage)
│   ├── dashboardFolderService.js    # Folder/Tab CRUD (localStorage)
│   ├── dashboardTemplates.js        # Built-in + user templates (localStorage)
│   ├── DashboardToolbar.jsx         # Folder/tab toolbar with menus
│   ├── DashboardTabs.jsx            # Tab switcher UI
│   ├── DashboardGrid.jsx            # react-grid-layout wrapper
│   ├── DashboardPanel.jsx           # Individual widget panel (data fetching)
│   ├── DashboardFolderSelector.jsx  # Folder dropdown selector
│   ├── PanelSettingsModal.jsx       # Widget configuration modal
│   ├── WidgetLibraryModal.jsx       # Widget picker library
│   ├── TemplateLibraryModal.jsx     # Template browser modal
│   ├── TimeRangeSelector.jsx        # Time range picker
│   ├── GlobalFilters.jsx            # Global filter display
│   ├── ContextMenu.jsx              # Right-click context menu
│   ├── SeverityPiePanel.jsx         # Pie chart panel (severity)
│   ├── TimelineAreaPanel.jsx        # Area chart panel (timeline)
│   ├── TopNPanel.jsx                # Top N bar chart panel
│   ├── TopAgentsPanel.jsx           # Top agents table panel
│   ├── TagCloudPanel.jsx            # Tag cloud panel
│   ├── EventLogsPanel.jsx           # Event log stream panel
│   ├── FrameworkDistPanel.jsx       # Compliance framework distribution
│   └── PanelSettingsModal.jsx       # Settings modal (reused)
```

---

## API Endpoints Used

All API calls go through the Vite proxy (`/api → localhost:3099`) then Express proxy → UniShield360 API.

| Endpoint | Method | Called From | Purpose |
|---|---|---|---|
| `/api/count` | GET | `DashboardPanel.jsx` | Total document count for a query |
| `/api/aggregate` | GET | `DashboardPanel.jsx`, `PanelSettingsModal.jsx`, `TemplateLibraryModal.jsx` | Field aggregations, terms, date_histogram, cardinality |
| `/api/search` | GET | `DashboardPanel.jsx` | Recent events / log stream |
| `/api/eps-stats` | GET | `DashboardPanel.jsx` | EPS metrics, ingestion stats, event rate trends |

All calls include query params: `index`, `q`, `start_date`, `end_date`, and aggregation-specific params.

---

## State Management (`dashboardStore.jsx`)

Uses `useReducer` + React Context. Initial state:

```js
{
  dashboards: [],          // All saved dashboards (legacy)
  activeDashboard: null,   // Currently active dashboard object
  panels: [],              // Panels of active dashboard
  editingPanel: null,      // Panel currently in settings modal
  gridLayout: [],          // react-grid-layout layout array
  timeRange: { from: 'now-24h', to: 'now' },
  globalFilters: [],       // Array of { type, key, value, query, exclude }
  applyFiltersToAll: true,
  applyTimeToAll: true,
  fullScreen: false,
  darkMode: false,
  refreshCounter: 0,       // Incremented on refresh to trigger re-fetch
  showReportWindow: false,
}
```

### Reducer Actions

| Action | Payload | Effect |
|---|---|---|
| `SET_DASHBOARDS` | `Dashboard[]` | Replace all dashboards |
| `SET_ACTIVE` | `Dashboard` | Set active dashboard + populate panels/gridLayout/timeRange |
| `ADD_DASHBOARD` | `Dashboard` | Append to dashboards list |
| `UPDATE_DASHBOARD` | `Partial<Dashboard>` | Update by id, auto-set updatedAt |
| `DELETE_DASHBOARD` | `id` | Remove by id, clear if active |
| `ADD_PANEL` | `Panel` | Append panel, auto-calculate y position |
| `UPDATE_PANEL` | `Partial<Panel>` | Update panel by id, auto-set w/h based on type |
| `REMOVE_PANEL` | `panelId` | Remove panel + layout entry |
| `SET_LAYOUT` | `GridLayout[]` | Update grid positions + panel x/y |
| `SET_TIME_RANGE` | `{ from, to }` | Update time range |
| `ADD_FILTER` | `Filter` | Add global filter (dedup by key for pair type) |
| `REMOVE_FILTER` | `index` | Remove by index |
| `SET_FILTERS` | `Filter[]` | Replace all filters with dedup |
| `TOGGLE_FULLSCREEN` | — | Toggle fullScreen |
| `SET_EDITING` | `Panel\|null` | Set panel being edited |
| `TRIGGER_REFRESH` | — | Increment refreshCounter |
| `TOGGLE_REPORT_WINDOW` | — | Toggle showReportWindow |

### Context Exports

```js
const {
  // State
  dashboards, activeDashboard, panels, editingPanel, gridLayout,
  timeRange, globalFilters, applyFiltersToAll, applyTimeToAll,
  fullScreen, darkMode, refreshCounter, showReportWindow,
  // Actions
  setDashboards, setActiveDashboard, addDashboard, updateDashboard, deleteDashboard,
  addPanel, updatePanel, removePanel, setLayout,
  setTimeRange, addFilter, removeFilter, setFilters,
  toggleFullScreen, setEditingPanel, toggleApplyFilters, toggleApplyTime,
  triggerRefresh, toggleReportWindow,
} = useDashboard()
```

---

## Data Flow

### Persistence Layer

All dashboard data is stored in `localStorage` with three storage keys:

| Key | Service | Content |
|---|---|---|
| `unishield_folders` | `dashboardFolderService.js` | Folder → Tab → Dashboard tree |
| `unishield_dashboards` | `dashboardService.js` | Legacy flat dashboard list |
| `unishield_user_templates` | `dashboardTemplates.js` | User-saved templates |

### Folder/Tab Structure

```
Folders (folderService)
├── Folder A
│   ├── Tab 1 (Overview)
│   │   └── Dashboard { name, panels[], timeRange, globalFilters }
│   └── Tab 2 (Windows Events)
│       └── Dashboard { ... }
└── Folder B
    └── Tab 1 (Network)
        └── Dashboard { ... }
```

### Panel Data Fetching (`DashboardPanel.jsx`)

Each panel type fetches data independently on mount and when `refreshCounter` changes:

**Metric panels** (`type: 'metric'`, `'gauge'`, `'kpi'`):
- `dataSource: 'eps-stats'` → calls `/api/eps-stats`, extracts `metricKey`
- aggregation `count` → calls `/api/count` with query params
- aggregation `cardinality` → calls `/api/aggregate` with `type: 'cardinality'`

**Table panels** (`type: 'table'`, `'clusterbubble'`, `'heatmap'`, `'log-stream'`):
- aggregation `terms` → calls `/api/aggregate` with `type: 'terms'`
- `'log-stream'` → calls `/api/search` with limit, sort

**Chart panels** (`type: 'area'`, `'line'`, `'bar'`, `'pie'`, `'timeline'`, `'tagcloud'`):
- `dataSource: 'eps-stats'` → calls `/api/eps-stats`, extracts `chartKey`
- aggregation `terms` → calls `/api/aggregate` with `type: 'terms'`
- date_histogram → calls `/api/aggregate` with `type: 'date_histogram'`

Panels pass these base params to every API call:
```js
{
  index: 'unishield360-alerts-4.x-*',
  q: combinedQuery,       // globalFilters applied
  start_date: timeRange.from,
  end_date: timeRange.to,
}
```

---

## Template System (`dashboardTemplates.js`)

### Built-in Templates

| ID | Name | Category | Panels |
|---|---|---|---|
| `soc-overview-v2` | SOC Overview | soc | 18 panels (metrics, tables, charts) |

### Template Categories

| ID | Label | Description |
|---|---|---|
| `soc` | SOC | Security Operations Center views |
| `executive` | Executive | Executive summary and KPIs |
| `security` | Security | Security monitoring dashboards |
| `platform` | Platform | Platform-specific monitoring |
| `network` | Network | Network security dashboards |
| `user` | My Templates | User-saved custom templates |

### Functions

```js
// List all templates (built-in + user)
getTemplateList() → [{ id, name, description, category, icon, panelCount }]

// Get single template by id
getTemplate(id) → template | null

// Create dashboard from template
createFromTemplate(templateId) → Dashboard | null

// Save current dashboard as user template
saveUserTemplate(name, dashboard) → templateId

// Delete user template
deleteUserTemplate(id) → void

// Get all user templates
getUserTemplates() → { [id]: template }
```

---

## Folder Service (`dashboardFolderService.js`)

### Functions

```js
folderService.init()                    → Folder[]    // Reset version, return all folders
folderService.list()                    → Folder[]    // Get all folders
folderService.getFolder(id)             → Folder|null
folderService.createFolder(name)        → Folder      // Creates with default 'Overview' tab
folderService.updateFolder(id, data)    → Folder|null
folderService.deleteFolder(id)          → boolean     // false if system folder
folderService.createTab(folderId, name) → Tab|null
folderService.updateTab(folderId, tabId, data) → Tab|null
folderService.deleteTab(folderId, tabId) → boolean    // false if last tab
folderService.saveDashboardToTab(folderId, tabId, dashboard) → Tab  // Capped panel heights
folderService.getTabAsDashboard(folderId, tabId) → Dashboard|null
```

---

## Dashboard Service (`dashboardService.js`) — Legacy

Still available for backward compatibility:

```js
dashboardService.create(name)         → Dashboard
dashboardService.save(dashboard)      → Dashboard    // upsert + auto version
dashboardService.load(id)             → Dashboard|null
dashboardService.delete(id)           → void
dashboardService.list()               → Dashboard[]  // sorted by updatedAt desc
dashboardService.search(query)        → Dashboard[]
dashboardService.favorite(id)         → Dashboard
dashboardService.clone(id)            → Dashboard|null
dashboardService.export(id)           → JSON string
dashboardService.import(jsonStr)      → Dashboard
dashboardService.addPanel(dashId, panel) → Dashboard
dashboardService.updatePanel(dashId, panelId, updates) → Dashboard
dashboardService.removePanel(dashId, panelId) → Dashboard
```

---

## CustomDashboardTab.jsx — Functions Map

### State Variables

| Variable | Type | Default | Purpose |
|---|---|---|---|
| `saveTrigger` | `number` | 0 | Triggers auto-save on panel changes |
| `showFilterDropdown` | `boolean` | false | Toggle add-filter popover |
| `filterKey` | `string` | '' | Key input for pair filter |
| `filterValue` | `string` | '' | Value input for pair filter |
| `filterText` | `string` | '' | Text query input |
| `filterExclude` | `boolean` | false | Toggle exclude for pair filter |
| `filterTextExclude` | `boolean` | false | Toggle exclude for text filter |
| `showKeySuggestions` | `boolean` | false | Field autocomplete dropdown |
| `showWidgetLib` | `boolean` | false | Widget library modal |
| `showTemplates` | `boolean` | false | Template library modal |
| `showSaveTpl` | `boolean` | false | Save-as-template dialog |
| `saveTplName` | `string` | '' | Template name input |
| `folders` | `Folder[]` | [] | All folders |
| `activeFolderId` | `string` | null | Currently selected folder |
| `activeTabId` | `string` | null | Currently selected tab |
| `autoLoad` | `boolean` | localStorage | Auto-create SOC Overview on first load |

### Key Functions

| Function | Called By | Purpose |
|---|---|---|
| `loadTab(folderId, tabId)` | folder change, tab change, init | Load dashboard from folder storage into state |
| `saveCurrentToTab()` | auto-save effect | Persist current state to folder storage |
| `handleFolderChange(id)` | toolbar | Change folder + reset tab selection |
| `handleTabChange(id)` | toolbar | Save current tab, load new tab |
| `handleNewFolder(name)` | toolbar | Create folder + refresh |
| `handleEditFolder(folder)` | toolbar | Rename folder |
| `handleDeleteFolder(id)` | toolbar | Delete folder + switch if needed |
| `handleNewTab(name)` | toolbar | Create tab in current folder |
| `handleDeleteTab(id)` | toolbar | Delete tab + switch to next |
| `handleRenameTab(id, name)` | toolbar | Rename tab |
| `handleUseTemplate(dash)` | template modal | Create tab from template |
| `handleAddWidget(panel)` | widget modal | Add panel + persist |
| `handleRefresh()` | refresh button | Trigger all panel re-fetch + save |
| `handleAutoLayout()` | toolbar action | Auto-arrange panels in grid |

### Window Event Listeners

| Event | Trigger | Action |
|---|---|---|
| `open-widget-lib` | Toolbar button | Show widget library modal |
| `open-templates` | Toolbar button | Show template library modal |
| `refresh-dashboard` | Toolbar button | Refresh all panels |
| `auto-layout` | Toolbar button | Auto-arrange panels |
| `open-global-filters` | Toolbar button | (no-op placeholder) |
| `save-dashboard` | Auto-save / toolbar | Save current to localStorage |
| `open-panel-settings` | Panel header click | Open settings modal for panel |
| `open-vizbuilder` | Panel header click | Open visualization builder tab |
| `clone-tab` | Tab context menu | Clone current tab |
| `import-dashboard` | External import | Import dashboard JSON into folder |
| `save-template` | Toolbar button | Show save-as-template dialog |
| `toggle-autoload` | Settings | Toggle auto-load SOC template |

### UI Components Rendered

```
├── DashboardToolbar
│   ├── FolderSelector (dropdown)
│   ├── Tabs (tab bar + context menu)
│   ├── New Tab / Delete Tab / Rename Tab
│   └── Folder CRUD (new folder, rename, delete)
├── Controls Bar
│   ├── TimeRangeSelector
│   ├── Global Filter Chips (with remove)
│   ├── Add Filter popover
│   │   ├── Key:Value pair input (with field autocomplete)
│   │   └── Text query input
│   ├── Refresh button
│   └── Panel count indicator
├── DashboardGrid (react-grid-layout)
│   └── DashboardPanel[] (widgets)
├── TemplateLibraryModal
├── WidgetLibraryModal
└── Save Template Dialog
```

### Field Presets (Autocomplete)

46 predefined field keys for filter autocomplete covering:
- Rule fields: `rule.level`, `rule.id`, `rule.description`, `rule.category`, `rule.groups`, `rule.pci_dss`, `rule.hipaa`, `rule.gdpr`, `rule.nist_800_53`, `rule.tsc`, `rule.mitre.*`
- Agent fields: `agent.name`, `agent.id`, `agent.ip`
- Data fields: `data.srcip`, `data.dstip`, `data.srcport`, `data.dstport`, `data.srcCountry`, `data.dstCountry`, `data.hostname`, `data.username`, `data.win.*`, `data.vulnerability.*`
- Other: `@timestamp`, `location`, `decoder.name`, `decoder.parent`, `full_log`, `data.action`, `data.protocol`

---

## Widget Types Supported

| Type | Panel Component | Description |
|---|---|---|
| `metric` | `DashboardPanel.jsx` | Single metric value with label |
| `gauge` | `DashboardPanel.jsx` | Gauge visualization |
| `kpi` | `DashboardPanel.jsx` | KPI indicator |
| `bar` | `DashboardPanel.jsx` | Bar chart |
| `area` | `DashboardPanel.jsx` | Area chart (also eps-stats) |
| `line` | `DashboardPanel.jsx` | Line chart |
| `pie` | `SeverityPiePanel.jsx` | Pie chart |
| `timeline` | `TimelineAreaPanel.jsx` | Histogram timeline |
| `tagcloud` | `TagCloudPanel.jsx` | Tag cloud |
| `table` | `DashboardPanel.jsx` | Data table |
| `clusterbubble` | `DashboardPanel.jsx` | Bubble chart |
| `heatmap` | `DashboardPanel.jsx` | Heatmap |
| `log-stream` | `DashboardPanel.jsx` | Live event log |
| `alert-counter` | `DashboardPanel.jsx` | Alert count widget |
| `top-n` | `TopNPanel.jsx` | Top N bar chart |
| `top-agents` | `TopAgentsPanel.jsx` | Top agents table |
| `event-logs` | `EventLogsPanel.jsx` | Filterable event logs |
| `framework-dist` | `FrameworkDistPanel.jsx` | Compliance framework distribution |

---

## Data Sources for Panels

| dataSource | API Endpoint | Response Keys |
|---|---|---|
| (default) | `/api/count`, `/api/aggregate`, `/api/search` | Based on aggregation type |
| `eps-stats` | `/api/eps-stats` | `eps.60s`, `eps.5m`, `eps.1h`, `ingestion.total_size_gb`, `ingestion.min_rate`, `ingestion.max_rate`, `event_rate[]`, `eps_trend[]` |
