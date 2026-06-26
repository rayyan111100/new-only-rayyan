# Changelog — UniShield360 SOC Dashboard

## 1. MITRE ATT&CK Tab — Time Histogram (Events View)

### Kya kiya?
Events view (`view === 'events'`) mai **MITRE Events Over Time** ka BarChart add kiya.

### Kiu?
Jab user MITRE ATT&CK tab ke events view mai aata hai, toh usko events ka timeline dekhne ko nahi milta tha. Dashboard view mai toh timeline tha, lekin events view mai sirf table thi. Ab events view ke table ke upar ek 140px height ka BarChart dikhta hai jo har 1-hour bucket mai event count dikhata hai.

### Kaise?
- `fetchEvents()` function mai `_exists_:rule.mitre.id` query ke saath ek `date_histogram` aggregation bhi parallel fetch karte hain
- Response 48 hourly buckets mai aata hai, `evTimeline` state mai store hota hai
- Orange (`#EF843C`) bars ke saath Recharts `<BarChart>` render hota hai
- Custom tooltip (`CustomTip`) component reuse kiya gaya

---

## 2. Compliance Overview — Filtered API Log Loading

### Kya kiya?
Jab user Framework Event Distribution mai koi filter click karta hai (e.g., PCI-DSS ka bar), toh ab server se **filtered data fetch** hota hai, sirf locally filter nahi hota.

### Kiu?
Pehle sirf `data?.recent` (~500 events) mai se locally filter hota tha, jisse sirf ~200 matching logs milte the. Isse user ko lagta tha ki saara data nahi aa raha. Ab filter lagte hi `_exists_:rule.pci_dss` query ke saath server se matching events fetch hote hain.

### Kaise?
- `buildFilterQuery(filters)` function — Elasticsearch query string banata hai filter ke hisaab se
  - `framework` → `_exists_:rule.pci_dss` / `rule.hipaa` / etc.
  - `severity` → `rule.level:[7 TO 11]` etc.
  - `agent` → `agent.name:"xyz"`
  - `rule` → `rule.id:"xyz"`
- `fetchFilteredLogs()` — API se filtered search results laata hai (500 per page)
- `useEffect` — jab filter change hota hai, `evExtraLogs` reset hoti hai aur naya fetch hota hai
- "Load 500 more" bhi ab filter query istemal karta hai

---

## 3. Compliance Overview — `_frameworks` Fallback for Search Results

### Kya kiya?
`api('search', ...)` se aane wale events ke liye `_frameworks` field nahi hoti (sirf `/api/compliance` endpoint ye field compute karta hai). Isliye `filteredRecent` aur `chartData` mai fallback logic add kiya.

### Kiu?
Pehle `fetchFilteredLogs` se aaye events `filteredRecent` mai filter hote waqt reject ho jaate the kyunki `_frameworks` missing tha. Ab agar `_frameworks` nahi hai toh direct `rule.pci_dss`/`rule.hipaa` etc. fields check kiye jaate hain.

### Changes:
- `ComplianceTab.jsx:220-231` — `filteredRecent` useMemo mai framework filter fallback
- `ComplianceTab.jsx:258-267` — `chartData` useMemo mai `fwMap` computation fallback

---

## 4. Refresh Button — Full Reset Across All 6 Compliance Tabs

### Kya kiya?
Har compliance tab ke refresh button (DateRangePicker ke paas) ko ab **full reset** function call karta hai.

### Kiu?
Pehle refresh button sirf `refresh()` call karta tha (API se naya data laana), lekin **local UI state reset nahi hota tha**:
- Filters, excludes, timeline filter stale rehte the
- Log page number wahi rehta tha
- Extra loaded logs (`evExtraLogs`) clear nahi hote the

### Tabs affected (sabmai same `handleRefresh` add kiya):
| Tab | File |
|---|---|
| Compliance Overview | `ComplianceTab.jsx` |
| GDPR | `GdprTab.jsx` |
| PCI-DSS | `PcidssTab.jsx` |
| HIPAA | `HipaaTab.jsx` |
| SOC 2 (TSC) | `TscTab.jsx` |
| NIST 800-53 | `NistTab.jsx` |

### `handleRefresh` kya karta hai:
1. `setFilters({})` — saare filters clear
2. `setExcludes({})` — saare excludes clear
3. `setTimelineFilter(null)` — timeline filter clear
4. `setLogPage(1)` — page 1 pe reset
5. `setExpandedRow({})` — expanded rows collapse
6. `setJsonView({})` — JSON views reset
7. `setEvExtraLogs([])` — extra logs clear
8. `evExtraOffsetRef.current = 0` — offset reset
9. `refresh()` — API se fresh data fetch (noCache=true)

---

## 5. MCP Server Context — Agent Memory Updated

### Kya kiya?
Wazuh MCP Server (`https://192.168.1.77/mcp/`) se real data structure verify karke `AGENTS.md` aur skill file update kiya.

### Kiu?
Pehle codebase mai compliance fields ko scalar treat kiya gaya tha, jabki actually woh **arrays** hain. Is wajah se bugs aa sakte hain. Ab agent memory mai ground truth save hai.

### Key findings (verified from live MCP server):
| Field | Actual Type | Example |
|---|---|---|
| `rule.gdpr` | `string[]` | `["IV_35.7.d"]` |
| `rule.pci_dss` | `string[]` | `["6.5", "11.4"]` |
| `rule.tsc` | `string[]` | `["CC6.6", "CC7.1", ...]` |
| `rule.hipaa` | `string[]` | `["164.312.b"]` |
| `rule.nist_800_53` | `string[]` | `["SA.11", "SI.4"]` |
| `rule.mitre` | `object` | `{ technique: [str], id: [str], tactic: [str] }` |

**`rule.mitre_attack` field exists nahi karti** — `rule.mitre` use karo.

### Files updated:
- `AGENTS.md` — MCP server info, correct field types, array verification notes
- `.opencode/skills/unishield-soc/SKILL.md` — full data structure reference, agent list, server config, query rules

---

## Files Changed (Source Only)

| File | What Changed |
|---|---|
| `src/tabs/MitreAttackTab.jsx` | Time histogram chart in events view |
| `src/tabs/ComplianceTab.jsx` | Filter-based API log loading, _frameworks fallback, handleRefresh |
| `src/tabs/GdprTab.jsx` | handleRefresh for full reset |
| `src/tabs/PcidssTab.jsx` | handleRefresh for full reset |
| `src/tabs/HipaaTab.jsx` | handleRefresh for full reset |
| `src/tabs/TscTab.jsx` | handleRefresh for full reset |
| `src/tabs/NistTab.jsx` | handleRefresh for full reset |
| `AGENTS.md` | MCP server info, corrected field types |
| `.opencode/skills/unishield-soc/SKILL.md` | Full data structure reference |
