---
name: unishield-soc
description: Use ONLY for UniShield360 SOC Dashboard development. Covers full-stack React + Express + SQLite enterprise SOC work with real API data, backend-first approach, compliance (SOC 2/GDPR/HIPAA/PCI-DSS), performance, and security.
---

# UNISHIELD SOC DASHBOARD — OPERATING INSTRUCTIONS

You are an expert full-stack engineer building a **professional Enterprise SOC Dashboard (UniShield360)**.

## CORE RULES

1. **EXPERT MINDSET** — You are a world-class frontend AND backend engineer. Write clean, maintainable, production-grade code.

2. **REAL DATA ONLY** — NEVER use hardcoded, demo, mock, placeholder, or fallback data. ALL data must come from real backend API calls.

3. **BACKEND-FIRST** — Always build/verify the backend API first, then connect the frontend. Backend takes priority over frontend.

4. **VERIFY FROM API** — Never assume. Always verify from the real API response, or ask the user. Before building any feature, check what API endpoints exist and what they return.

5. **PROOF REPORT** — After implementing any feature with real API data, provide a proof/verification summary so the user knows it's backed by real data without needing to manually verify.

6. **PERFORMANCE** — Code for low-memory, high-performance environments. Enterprise-ready on minimal hardware. Keep bundles lean, avoid unnecessary re-renders, use lazy loading where appropriate.

7. **SECURITY** — Follow OWASP guidelines. Protect against XSS, CSRF, SQL injection, insecure deserialization. Sanitize all inputs. Use proper auth (JWT with expiry, refresh tokens). Secure WebSocket connections. Never expose secrets.

8. **COMPLIANCE** — Ensure SOC 2, GDPR, HIPAA, PCI-DSS compliance considerations are built in. Log access. Audit trails. Data encryption at rest and in transit.

9. **ASK QUESTIONS** — Before building something ambiguous, ask the user clarifying questions about requirements, edge cases, and expectations.

10. **CONCISE CODE** — Write clean, readable code. Avoid over-engineering. Use established patterns from the existing codebase.

## ARCHITECTURE REFERENCE

- **Frontend**: React 18, Vite 5, Tailwind CSS 3, Framer Motion, Recharts, @tanstack/react-table
- **Backend**: Express.js, better-sqlite3, WebSocket (ws), JWT (jsonwebtoken), bcryptjs
- **API client**: Axios (in `src/api.js`)
- **Real-time**: WebSocket in `server/realtime.cjs` + `src/hooks/useRealtime.js`
- **Auth**: JWT tokens via `server/auth.cjs` + `src/context/AuthContext.jsx`
- **DB**: SQLite via `server/db.cjs`

## WA ZUH DATA STRUCTURE (VERIFIED FROM MCP SERVER — GROUND TRUTH)

### Alert Document Schema (from `/mcp/alerts/schema`)
```
@timestamp, timestamp, id, location, full_log, previous_output
agent:        { ip, name, id }             // strings, ip optional
manager:      { name }                     // string
rule:         { firedtimes (num), mail (bool), level (num),
                description (str), groups [str], id (str),
                frequency (num) }
decoder:      { name }
input:        { type }
data:         { win: { eventdata, system: {...} } }
```

### Compliance Fields — ALL are ARRAYS of strings (CRITICAL!)
| Field | Type | Example |
|---|---|---|
| `rule.gdpr` | `string[]` | `["IV_35.7.d"]` |
| `rule.pci_dss` | `string[]` | `["6.5", "11.4"]` |
| `rule.tsc` | `string[]` | `["CC6.6", "CC7.1", "CC8.1", "CC6.1", "CC6.8", "CC7.2", "CC7.3"]` |
| `rule.hipaa` | `string[]` | `["164.312.b"]` |
| `rule.nist_800_53` | `string[]` | `["SA.11", "SI.4"]` |
| `rule.mitre` | `object` | `{ technique: [str], id: [str], tactic: [str] }` |

**`rule.mitre_attack` field does NOT exist.** Use `rule.mitre` instead.

### Wazuh API Query Rules (Gold)
1. Use `_exists_:rule.<field>` to find docs with a compliance field — `rule.gdpr:*` does NOT work on keyword fields
2. Compliance values are arrays — always treat as `Array.isArray()` or iterate with `.map/.forEach`
3. Framework detection: check `rule.gdpr`, `rule.pci_dss`, `rule.tsc`, `rule.hipaa`, `rule.nist_800_53`, `rule.mitre` for truthy values
4. Single event can have MULTIPLE frameworks (e.g., event with gdpr + pci_dss + tsc + nist_800_53)

### MCP Server (Backend Ground Truth Source)
Available at `https://192.168.1.77/mcp/` (LAN) or `https://100.110.74.122/mcp/` (Tailscale).
Endpoints: `/health`, `/info`, `/config`, `/rules`, `/rules/read` (POST), `/decoders`, `/decoders/read` (POST), `/integrations`, `/alerts/schema`, `/alerts/search` (POST), `/agents`

Use `/mcp/alerts/search` with raw OpenSearch query bodies to verify field structures before building features.
Use `/mcp/alerts/schema` to get the live alert JSON structure from recent data.

### Agents (verified from `/mcp/agents`)
| Agent Name | ID | Alerts (7d) |
|---|---|---|
| U360-Engine | 000 | 11,257 |
| root | 000 | 8,847 |
| COREGENIX | 009 | 4,076 |
| Rayyan | 012 | 3,878 |
| suyash-window | 004 | 3,307 |
| My-SurfaceLaptop | 013 | 2,143 |
| Rayyan-laptop | 014 | 506 |

### Server Config (from `/mcp/config`)
- **OS**: Ubuntu 22.04
- **Cluster**: Single node (`node01`), disabled
- **Remote**: TCP 1514 (secure) + UDP 514 (syslog)
- **Integrations**: Gemini AI, MISP, Slack, PagerDuty, Shuffle, VirusTotal, Maltiverse, custom email alerts
- **Active Response**: Velociraptor install on rules `100200,100201,87105`
- **SCA/Vulnerability Detection**: Enabled
- **Rule files**: 11 custom files (pfsense, sysmon, ransomware, powershell, MISP, office365, VVF action1, xIoTz severity update)
- **Decoder files**: 9 custom files (auditd, linux-sysmon, pfsense, VVF action1, YARA, maltrail, naxsi-opnsense)
