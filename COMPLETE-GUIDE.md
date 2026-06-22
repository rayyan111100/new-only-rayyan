# UniShield360 SOC Dashboard - Complete Setup & Fix Guide

## Table of Contents
1. [Project Structure](#1-project-structure)
2. [Dashboard Features Added](#2-dashboard-features-added)
3. [Wazuh API Server Fix](#3-wazuh-api-server-fix)
4. [Systemd Service Setup](#4-systemd-service-setup)
5. [Email Alerts Setup](#5-email-alerts-setup)
6. [Full Stack Run](#6-full-stack-run)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Project Structure

```
U360-PROD/
├── .env                    # Wazuh API config
├── package.json            # Dependencies
├── vite.config.js          # Frontend config (port 5181)
├── server/
│   ├── server.cjs          # Express backend (port 3099)
│   ├── unishield360Api.js  # Wazuh API client
│   ├── services/
│   │   ├── queryRoutes.cjs    # 35 API endpoints
│   │   ├── dataQueryService.cjs
│   │   ├── sseService.cjs     # Server-Sent Events
│   │   └── realtimeRoutes.cjs
│   ├── realtimeManager.cjs
│   ├── wazuh_api_server_fixed.py  # v3.1 fixed script
│   ├── wazuh-custom-api.service    # systemd service file
│   ├── wazuh-api-failed.sh         # Email alert script
│   └── wazuh-api-watchdog.sh       # Watchdog script
└── src/
    ├── App.jsx             # Routes for all tabs
    ├── components/
    │   ├── Sidebar.jsx     # Navigation (all tabs)
    │   └── dashboard/
    │       ├── DashboardPanel.jsx    # Panel rendering + EPS/Logstop
    │       ├── DashboardGrid.jsx     # Grid layout
    │       ├── dashboardStore.jsx    # State + position save fix
    │       ├── dashboardTemplates.js # "EPS & Ingestion Monitor" template
    │       ├── TemplateLibraryModal.jsx # Agent filter on apply
    │       ├── PanelSettingsModal.jsx
    │       ├── WidgetLibraryModal.jsx
    │       └── ...
    ├── tabs/
    │   ├── CustomDashboardTab.jsx
    │   ├── ApiConsoleTab.jsx
    │   ├── ApiGuideTab.jsx
    │   ├── AlertsTab.jsx
    │   └── MitreAttackTab.jsx
    └── services/
        ├── VizService.js
        ├── reportService.js
        └── emailService.js
```

---

## 2. Dashboard Features Added

### 2.1 EPS & Ingestion Monitor Template
**File:** `src/components/dashboard/dashboardTemplates.js`

10 panels in template:

| Panel | Type | API Used |
|-------|------|----------|
| EPS (60s avg) | metric | `/api/count` with `now-60s` ÷ 60 |
| EPS (5m avg) | metric | `/api/count` with `now-300s` ÷ 300 |
| Active Agents | metric | cardinality on `agent.name` |
| EPS per Asset | table | `/api/aggregate` + EPS calculation |
| Event Rate | area chart | `@timestamp` date_histogram |
| Top Nodes by EPS | bar chart | `agent.name` terms aggregation |
| Internal Event Types | bar chart | `rule.groups:(windows OR linux OR sysmon)` |
| External Event Types | bar chart | `rule.groups:(pfsense OR firewall OR network)` |
| Reporting Devices | table | `agent.name` aggregation |
| Log Stop Alert | table | Compares recent vs all agents |

### 2.2 EPS Calculation
**File:** `src/components/dashboard/DashboardPanel.jsx`

When `aggregation.type === 'eps'`:
- Calls `/api/count` with short time window (`now-{interval}`)
- Divides count by seconds → events/second
- Returns as metric card

### 2.3 EPS per Asset (Table with Calculation)
When `aggregation.field` AND `aggregation.eps` is set:
- Fetches `/api/aggregate` with `now-60s` window
- Calculates EPS per bucket (count ÷ seconds)
- Adds `eps` column + `status` (ACTIVE/IDLE)

### 2.4 Log Stop Detection
When `aggregation.type === 'logstop'`:
- Queries recent agents (last N minutes) via `/api/aggregate`
- Compares with all known agents (wider time range)
- Returns agents with no recent activity as STOPPED

### 2.5 Auto-Sizing by Data Volume
**File:** `src/components/dashboard/DashboardPanel.jsx`

After data loads, calculates optimal height:
- Table: row count → height (7-20 rows)
- Metric/Gauge: fixed 6 rows
- Charts: data point count → height (10-16 rows)
- Runs once per panel (`autoSizedRef` flag)

### 2.6 Position Save Fix
**File:** `src/components/dashboard/dashboardStore.jsx`

**Bug:** `SET_LAYOUT` only updated `gridLayout`, not `panels[]`. Drag/reposition saved to gridLayout but auto-save saved `panels` (old positions).

**Fix:** `SET_LAYOUT` now maps layout x/y/w/h back to each panel in `state.panels` and `activeDashboard.panels`.

### 2.7 Agent Filter on Template Apply
**File:** `src/components/dashboard/TemplateLibraryModal.jsx`

When "Use" clicked on any template:
1. Dialog shows available agents (fetched from API)
2. Select one or more agents
3. Selected agents become global filters on dashboard
4. Dashboard name shows `[agent1, agent2]` suffix

### 2.8 API Console & Guide Tabs
**Files:** `src/tabs/ApiConsoleTab.jsx`, `src/tabs/ApiGuideTab.jsx`
- Added to `Sidebar.jsx` navigation
- Added to `App.jsx` TABS map

---

## 3. Wazuh API Server Fix

### 3.1 Problem
`wazuh_api_server.py` v3.0 crashes after ~4 hours due to:
- `ConnectionResetError: [Errno 104]` when client disconnects
- Single-threaded `HTTPServer` blocks on slow requests
- No error handling in `do_GET()`

### 3.2 Fix Applied (v3.1)

**File:** `server/wazuh_api_server_fixed.py`

Changes from v3.0 → v3.1:

| Fix | Description |
|-----|-------------|
| **ThreadedHTTPServer** | `ThreadingMixIn` — handles multiple concurrent requests |
| **Crash-proof send** | `self.wfile.write()` wrapped in try/except `(BrokenPipeError, ConnectionResetError)` |
| **Crash-proof headers** | `self.end_headers()` wrapped in try/except |
| **Auto-restart monitor** | `start_with_monitor()` — auto-restarts on any crash |
| **Port reuse** | `allow_reuse_address = True` — faster restart |

### 3.3 Deployment
```bash
# Copy to Wazuh server
curl -o /home/wazuh/wazuh_api_server.py http://192.168.1.117:8000/wazuh_api_server_fixed.py
```

---

## 4. Systemd Service Setup

### 4.1 Service File
**File:** `server/wazuh-custom-api.service`

```ini
[Unit]
Description=Wazuh Custom SOC API Server v3.1
After=network.target opensearch.service

[Service]
Type=simple
User=root
WorkingDirectory=/home/wazuh
ExecStart=/usr/bin/python3 /home/wazuh/wazuh_api_server.py
ExecStopPost=/usr/local/bin/wazuh-api-failed.sh
Restart=always
RestartSec=10
StandardOutput=append:/home/wazuh/api_server.log
StandardError=append:/home/wazuh/api_server.log

[Install]
WantedBy=multi-user.target
```

### 4.2 Installation
```bash
sudo cp wazuh-custom-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable wazuh-custom-api
sudo systemctl start wazuh-custom-api
```

### 4.3 Management Commands
```bash
sudo systemctl status wazuh-custom-api     # Check status
sudo systemctl restart wazuh-custom-api    # Restart
sudo systemctl stop wazuh-custom-api       # Stop
sudo journalctl -u wazuh-custom-api -f     # Live logs
```

---

## 5. Email Alerts Setup

### 5.1 Alert Script
**File:** `server/wazuh-api-failed.sh`

Called by systemd `ExecStopPost` when API stops. Sends email to `gopal@cgcein.com` with:
- Server name
- Timestamp
- Service status
- Last error from log
- Restart action info

### 5.2 Setup
```bash
curl -o /usr/local/bin/wazuh-api-failed.sh http://192.168.1.117:8000/wazuh-api-failed.sh
chmod +x /usr/local/bin/wazuh-api-failed.sh
```

### 5.3 Email Flow
```
API Crash → Systemd detects → ExecStopPost triggers
→ wazuh-api-failed.sh runs → Reads last error from log
→ mail -s "Wazuh API Stopped" gopal@cgcein.com
→ Systemd auto-restarts service (RestartSec=10)
```

### 5.4 Mail System
- Postfix + Zoho SMTP relay configured
- Port 587 (TLS)
- SPF/DKIM may need configuration for Zoho inbox delivery

---

## 6. Full Stack Run

### 6.1 Start Backend (Express)
```bash
cd U360-PROD
node server/server.cjs
```
Runs on: `http://localhost:3099`

### 6.2 Start Frontend (Vite)
```bash
cd U360-PROD
npm run dev
```
Runs on: `http://localhost:5181`

### 6.3 Start Both
```bash
cd U360-PROD
npm start
```

### 6.4 Verify All Services
```bash
# Wazuh API
curl http://192.168.1.77:9999/health

# UniShield Backend
curl http://localhost:3099/api/health

# UniShield Frontend
Open http://localhost:5181 in browser
```

---

## 7. Troubleshooting

| Issue | Fix |
|-------|------|
| `Address already in use` | `pkill -f wazuh_api_server.py` then restart |
| `ConnectionResetError` | Use v3.1 script (has error handling) |
| API stops after hours | Use systemd (auto-restart) |
| Email not delivered | Check spam folder |
| | Verify: `grep gopal /var/log/mail.log` |
| | Install: `sudo apt install mailutils -y` |
| Port 9999 blocked | `sudo ufw allow 9999` |
| Can't reach Wazuh from Windows | Check `hostname -I` on Wazuh, update `.env` |
| Template not loading | Open Custom Dashboard → Templates |
| Panel position not saving | Fixed in `SET_LAYOUT` reducer |
| EPS shows 0 | Ensure Wazuh API reachable and has data |
| Frontend blank page | Check browser console for errors |

### Quick Commands
```bash
# Kill all API processes
pkill -f wazuh_api_server.py

# Check API health
curl http://localhost:9999/health

# Check systemd status
sudo systemctl status wazuh-custom-api

# View API logs
tail -f /home/wazuh/api_server.log

# View systemd logs
sudo journalctl -u wazuh-custom-api -f

# Test email
echo "Test" | mail -s "Test" gopal@cgcein.com
```

---

## Environment Details

| Component | Value |
|-----------|-------|
| Wazuh Server IP | `192.168.1.77` |
| Wazuh API Port | `9999` |
| UniShield Backend Port | `3099` |
| UniShield Frontend Port | `5181` |
| OpenSearch URL | `https://localhost:9200` |
| OS | Windows (Dev) + Ubuntu 22.04 (Wazuh) |
| Node Version | v24.16.0 |
| Python Version | 3.10.12 |
