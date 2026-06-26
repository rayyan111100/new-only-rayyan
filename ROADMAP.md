# UniShield360 SOC Dashboard — Roadmap

## Purpose
This file tracks the development roadmap, active tasks, and progress for the SOC Dashboard. Updated by agent after each session.

---

## Current Status

| Area | Status | Notes |
|---|---|---|
| Core Backend | ✅ Stable | All proxy endpoints, dashboards, CRUD, real-time |
| Auth | ✅ Stable | JWT login, role middleware |
| Rules Engine | ✅ Stable | CRUD, versioning, evaluation, groups |
| Decoders | ✅ Stable | CRUD, testing, log decoding |
| Custom Dashboard | ✅ Stable | 21 widget types, drag/resize, filters |
| Discover | ✅ Stable | Search, filtering, field sidebar |
| Compliance | ✅ Stable | 6 frameworks, overview + single-framework |
| GDPR Tab | ✅ Stable | Specialized GDPR dashboard |
| Malware Detection | ✅ Stable | Dashboard + paginated events |
| FIM Dashboard | ✅ Stable | File integrity monitoring |
| EPS/Ingestion | ✅ Stable | EPS stats, per-asset metrics |
| Grafana Proxy | ✅ Stable | OpenSearch proxy for Grafana |
| Reporting | ✅ Stable | PDF/Excel export |
| Notifications | ✅ Stable | Webhook channels |
| Incident Management | ✅ Implemented | Incident tracking |
| Infrastructure Health | ✅ Implemented | Agent health monitoring |
| Asset Inventory | 🆕 New | `/api/asset-inventory` backend + DashboardNewTab (Jun 26) |

---

## Active Tasks

_Updated after each session. Current tasks are listed below._

### Current Sprint

| # | Task | Priority | Status | Notes |
|---|---|---|---|---|
| 1 | Asset Inventory Dashboard | High | ✅ Done | Backend endpoint + frontend tab + sidebar integration |

### Backlog / Planned

| # | Task | Priority | Notes |
|---|---|---|---|
| — | TBD based on user instructions | — | User provides tasks in chat |

---

## Progress Log

| Date | Task | Status | Details |
|---|---|---|---|
| Jun 26 | Initial architecture documentation | ✅ | ARCHITECTURE.md, ROADMAP.md, PROGRESS.md created |
| Jun 26 | Asset Inventory Dashboard | ✅ | New `/api/asset-inventory` endpoint + DashboardNewTab + Dashboard-New sidebar entry |

---

## How to Use This Roadmap

1. **User provides instructions** → agent updates this file with new tasks
2. **Agent starts work** → moves task to "In Progress"
3. **Agent completes work** → moves to "Done" with proof report
4. **Every change** → agent provides verification summary per Rule 5

---

## Notes

- All data must come from real backend API — no mock/fallback data
- Backend-first approach: API layer before frontend
- Every feature must include a proof/verification summary
- Performance: code for low-memory, high-performance environments
- Security: OWASP, SOC 2, GDPR, HIPAA, PCI-DSS compliance
