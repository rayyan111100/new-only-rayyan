import { readFileSync, writeFileSync } from 'fs'

// ============================================================
// RULE ENGINE — 20 RULE COMPREHENSIVE TEST
// ============================================================

const apiBase = 'http://localhost:3000/api'

function resolveField(obj, path) {
  try { return path.split('.').reduce((o, p) => o?.[p], obj) ?? '' }
  catch { return '' }
}

function evalOperator(fv, op, cv) {
  switch (op) {
    case 'equals': return String(fv) === String(cv)
    case 'contains': return String(fv).toLowerCase().includes(String(cv).toLowerCase())
    case 'regex': try { return new RegExp(cv, 'i').test(String(fv)) } catch { return false }
    case 'startsWith': return String(fv).toLowerCase().startsWith(String(cv).toLowerCase())
    case 'endsWith': return String(fv).toLowerCase().endsWith(String(cv).toLowerCase())
    case 'gt': return Number(fv) > Number(cv)
    case 'gte': return Number(fv) >= Number(cv)
    case 'lt': return Number(fv) < Number(cv)
    case 'inList': return String(cv).split(',').map(s=>s.trim()).includes(String(fv))
    case 'exists': return fv !== null && fv !== undefined && fv !== ''
    default: return false
  }
}

function evalRule(rule, doc) {
  if (!rule.conditions?.length) return { matched: true }
  const results = rule.conditions.map(c => ({
    text: `${c.negate ? 'NOT ' : ''}${c.field} ${c.operator} "${c.value}"`,
    matched: c.negate ? !evalOperator(resolveField(doc, c.field), c.operator, c.value) : evalOperator(resolveField(doc, c.field), c.operator, c.value),
    fieldValue: String(resolveField(doc, c.field)).substring(0, 50)
  }))
  const matched = rule.conditionLogic === 'AND' ? results.every(r => r.matched) : results.some(r => r.matched)
  return { matched, details: results }
}

function interpolate(tmpl, doc) {
  if (!tmpl) return ''
  return tmpl.replace(/\{\{([^}]+)\}\}/g, (_, f) => resolveField(doc, f.trim()) || `{{${f.trim()}}}`)
}

// ============================================================
// 20 RULES — Covering all data categories
// ============================================================

const RULES = [
  // ─── CATEGORY 1: LEVEL-BASED (4 rules) ───
  {
    id: 'r_crit_level', groupId: 'g_levels', name: 'Critical Level Events (≥12)',
    description: 'Any alert with rule.level 12 or higher',
    priority: 300, overwrite: true, conditionLogic: 'AND',
    conditions: [{ id: 'c1', field: 'rule.level', operator: 'gte', value: '12', negate: false }],
    actions: [{ type: 'alert', params: { useEventLevel: true, severity: 'critical', message: 'CRITICAL event: {{rule.description}} (level {{rule.level}})' } }],
    category: 'Level-Based', explanation: 'Catches ALL critical-severity alerts (level 12+). Uses dynamic severity so highest-level alerts get critical badge. Overwrite=true ensures this rule takes priority.'
  },
  {
    id: 'r_high_level', groupId: 'g_levels', name: 'High Level Events (8-11)',
    description: 'Alerts with rule.level 8-11 (high severity)',
    priority: 200, overwrite: false, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.level', operator: 'gte', value: '8', negate: false },
      { id: 'c2', field: 'rule.level', operator: 'lt', value: '12', negate: false }
    ],
    actions: [{ type: 'alert', params: { severity: 'high', message: 'High severity alert: {{rule.description}} on {{agent.name}}' } }],
    category: 'Level-Based', explanation: 'Catches high-severity alerts (level 8-11) like pfSense blocks, critical logons, elevated Windows events.'
  },
  {
    id: 'r_med_level', groupId: 'g_levels', name: 'Medium Level Events (5-7)',
    description: 'Alerts with rule.level 5-7 (medium severity)',
    priority: 100, overwrite: false, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.level', operator: 'gte', value: '5', negate: false },
      { id: 'c2', field: 'rule.level', operator: 'lt', value: '8', negate: false }
    ],
    actions: [{ type: 'alert', params: { severity: 'medium', message: 'Medium alert on {{agent.name}}: {{rule.description}}' } }],
    category: 'Level-Based', explanation: 'Catches medium-severity alerts (level 5-7). This is the largest group — 7.5M events. Sysmon, systemd failures, postfix auth failures all fall here.'
  },
  {
    id: 'r_low_level', groupId: 'g_levels', name: 'Low Level Events (3-4)',
    description: 'Low severity alerts like logoffs, info events',
    priority: 50, overwrite: false, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.level', operator: 'gte', value: '3', negate: false },
      { id: 'c2', field: 'rule.level', operator: 'lt', value: '5', negate: false }
    ],
    actions: [{ type: 'tag', params: { tag: 'low-severity' } }],
    category: 'Level-Based', explanation: 'Low-severity alerts (level 3-4) like logoffs, info events. Uses "tag" action instead of alert to reduce noise.'
  },

  // ─── CATEGORY 2: SYSMON (7 rules) ───
  {
    id: 'r_sysmon_proc', groupId: 'g_sysmon', name: 'Sysmon Process Creation (E1)',
    description: 'New process created on Windows (Sysmon Event 1)',
    priority: 100, overwrite: false, conditionLogic: 'OR',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'Sysmon - Event 1: Process creation', negate: false },
      { id: 'c2', field: 'rule.description', operator: 'contains', value: 'A process was created', negate: false }
    ],
    actions: [{ type: 'tag', params: { tag: 'process-creation' } }],
    category: 'Sysmon', explanation: 'Uses OR to match both Sysmon E1 AND generic process creation. Tag action instead of alert — useful for monitoring but too noisy for alerts.'
  },
  {
    id: 'r_sysmon_net', groupId: 'g_sysmon', name: 'Sysmon Network Connection (E3)',
    description: 'Outbound network connections detected by Sysmon',
    priority: 110, overwrite: false, conditionLogic: 'OR',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'Sysmon - Event 3: Network connection', negate: false },
      { id: 'c2', field: 'rule.description', operator: 'contains', value: 'Sysmon - Event 22: DNS Query', negate: false }
    ],
    ignoreIps: ['127.0.0.0/8'],
    actions: [{ type: 'tag', params: { tag: 'network-activity' } }],
    category: 'Sysmon', explanation: 'Tracks network connections (E3) and DNS queries (E22). Uses ignore IPs to skip loopback traffic. Tag-only — useful for incident response.'
  },
  {
    id: 'r_sysmon_img', groupId: 'g_sysmon', name: 'Sysmon Image Loaded (E7)',
    description: 'DLL/module loaded into processes',
    priority: 80, overwrite: false, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'equals', value: 'Sysmon - Event 7: Image loaded.', negate: false }
    ],
    actions: [{ type: 'tag', params: { tag: 'dll-load' } }],
    category: 'Sysmon', explanation: 'Tracks DLL/module loading (Sysmon E7). Useful for detecting DLL injection or unusual module loads.'
  },
  {
    id: 'r_sysmon_procaccess', groupId: 'g_sysmon', name: 'Sysmon ProcessAccess (E10)',
    description: 'Process handle opened for access (potential injection)',
    priority: 150, overwrite: false, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'Sysmon - Event 10: ProcessAccess', negate: false }
    ],
    actions: [{ type: 'alert', params: { severity: 'high', message: 'Process access on {{agent.name}}: {{rule.description}}' } }],
    category: 'Sysmon', explanation: 'ProcessAccess events can indicate process injection or credential dumping. Set to ALERT (high) because this is suspicious behavior.'
  },
  {
    id: 'r_sysmon_filecreate', groupId: 'g_sysmon', name: 'Sysmon FileCreate (E11)',
    description: 'New files created (Sysmon E11)',
    priority: 80, overwrite: false, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'Sysmon - Event 11: FileCreate', negate: false }
    ],
    actions: [{ type: 'tag', params: { tag: 'file-create' } }],
    category: 'Sysmon', explanation: 'Tracks file creation events. Tag-only — high volume but useful for forensics.'
  },
  {
    id: 'r_sysmon_registry', groupId: 'g_sysmon', name: 'Sysmon RegistryEvent (E13)',
    description: 'Registry value modifications (Sysmon E13)',
    priority: 130, overwrite: false, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'Sysmon - Event 13: RegistryEvent', negate: false }
    ],
    actions: [{ type: 'alert', params: { severity: 'medium', message: 'Registry change on {{agent.name}}' } }],
    category: 'Sysmon', explanation: 'Registry changes are high-signal — malware often modifies registry for persistence. Alert (medium) since this is suspicious.'
  },

  // ─── CATEGORY 3: THREAT INTELLIGENCE (2 rules) ───
  {
    id: 'r_misp_ioc', groupId: 'g_threat', name: 'MISP Threat Intelligence Match',
    description: 'Real MISP IoC hits (excluding connection errors)',
    priority: 500, overwrite: true, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'MISP - IoC found', negate: false },
      { id: 'c2', field: 'rule.description', operator: 'contains', value: 'MISP - Error', negate: true }
    ],
    actions: [{ type: 'alert', params: { severity: 'critical', message: 'THREAT INTEL HIT: {{rule.description}}' } }],
    category: 'Threat Intel', explanation: 'MISP IoC match = confirmed threat indicator. Uses AND to require "IoC found" AND exclude "Error" messages. Overwrite=true — this is highest priority, overrides all other rules.'
  },
  {
    id: 'r_virustotal', groupId: 'g_threat', name: 'VirusTotal Alert',
    description: 'VT rate limit OR hash match alerts',
    priority: 400, overwrite: false, conditionLogic: 'OR',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'VirusTotal: Error', negate: false },
      { id: 'c2', field: 'rule.description', operator: 'startsWith', value: 'MISP:', negate: false }
    ],
    actions: [{ type: 'alert', params: { severity: 'high', message: 'VT/MISP hit: {{rule.description}}' } }],
    category: 'Threat Intel', explanation: 'Catches VirusTotal rate-limit errors and MISP hash matches. Lower priority than MISP IoC rule.'
  },

  // ─── CATEGORY 4: FILE INTEGRITY (2 rules) ───
  {
    id: 'r_file_added', groupId: 'g_files', name: 'File Added Monitor',
    description: 'New files created on monitored systems',
    priority: 60, overwrite: false, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'File added to the system', negate: false },
      { id: 'c2', field: 'agent.name', operator: 'inList', value: 'Gopal-Laptop', negate: true }
    ],
    actions: [{ type: 'tag', params: { tag: 'file-added' } }],
    category: 'File Integrity', explanation: 'Tracks new files from syscheck. Excludes Gopal-Laptop (personal machine generates too many events). Tag-only — this is high volume (2.7M events).'
  },
  {
    id: 'r_file_deleted', groupId: 'g_files', name: 'File Deleted Monitor',
    description: 'Files deleted from monitored paths',
    priority: 70, overwrite: false, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'File deleted', negate: false },
      { id: 'c2', field: 'rule.description', operator: 'contains', value: 'File added', negate: true }
    ],
    actions: [{ type: 'tag', params: { tag: 'file-deleted' } }],
    category: 'File Integrity', explanation: 'Specific to file deletions. Uses AND with NOT "File added" to ensure we only match deletion events, not addition events.'
  },

  // ─── CATEGORY 5: AUTHENTICATION (3 rules) ───
  {
    id: 'r_postfix_auth', groupId: 'g_auth', name: 'Postfix Authentication Failure',
    description: 'Postfix SASL authentication failures (brute force)',
    priority: 150, overwrite: false, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'Postfix SASL authentication failure', negate: false },
      { id: 'c2', field: 'rule.level', operator: 'gt', value: '4', negate: false }
    ],
    actions: [{ type: 'alert', params: { severity: 'medium', message: 'Auth failure on {{agent.name}} from {{location}}' } }],
    category: 'Authentication', explanation: 'Postfix SASL failures = possible brute force. Filters level > 4 to skip noise. Could be combined with rate-limiting logic in production.'
  },
  {
    id: 'r_critical_logon', groupId: 'g_auth', name: 'Critical Logon Detection',
    description: 'CRITICAL successful logon events (level 12)',
    priority: 300, overwrite: true, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'CRITICAL: Successful logon', negate: false },
      { id: 'c2', field: 'rule.level', operator: 'gt', value: '11', negate: false }
    ],
    actions: [{ type: 'alert', params: { useEventLevel: true, severity: 'critical', message: 'LOGON from {{agent.name}} ({{agent.ip}})!' } }],
    category: 'Authentication', explanation: 'Critical logon detection. Level 12+ only. Uses dynamic severity + overwrite=true — highest priority auth rule.'
  },
  {
    id: 'r_mssql_logon', groupId: 'g_auth', name: 'MS SQL Server Logon',
    description: 'MS SQL Server successful and failed logons',
    priority: 120, overwrite: false, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'MS SQL Server Logon', negate: false },
      { id: 'c2', field: 'rule.level', operator: 'gt', value: '4', negate: false }
    ],
    actions: [{ type: 'alert', params: { severity: 'medium', message: 'MS SQL logon on {{agent.name}}' } }],
    category: 'Authentication', explanation: 'MS SQL logons — both success and failure. Important for database monitoring. Filters level > 4.'
  },

  // ─── CATEGORY 6: FIREWALL (1 rule) ───
  {
    id: 'r_pfsense', groupId: 'g_firewall', name: 'pfSense Firewall Block',
    description: 'pfSense firewall blocked traffic from internal IPs',
    priority: 200, overwrite: false, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'Multiple pfSense firewall blocks', negate: false },
      { id: 'c2', field: 'data.action', operator: 'equals', value: 'block', negate: false },
      { id: 'c3', field: 'rule.level', operator: 'gt', value: '8', negate: false }
    ],
    ignoreIps: ['10.0.0.0/8', '172.16.0.0/12'],
    actions: [{ type: 'alert', params: { severity: 'high', message: 'BLOCKED: {{data.srcip}} -> {{data.dstip}}:{{data.dstport}}' } }],
    category: 'Firewall', explanation: 'pfSense block events from firewall. Three conditions: description match + action=block + level>8. Ignore IPs skips private ranges. Interpolated message shows src→dst.'
  },

  // ─── CATEGORY 7: SYSTEM HEALTH (2 rules) ───
  {
    id: 'r_systemd_fail', groupId: 'g_system', name: 'Systemd Service Failure (Non-Chatbot)',
    description: 'Systemd service failures excluding chat-bot noise',
    priority: 80, overwrite: false, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'equals', value: 'Systemd: Service exited due to a failure.', negate: false },
      { id: 'c2', field: 'agent.name', operator: 'equals', value: 'chat-bot', negate: true },
      { id: 'c3', field: 'agent.name', operator: 'equals', value: 'chatbot', negate: true }
    ],
    actions: [{ type: 'alert', params: { severity: 'low', message: 'Service failed on {{agent.name}}: {{full_log}}' } }],
    category: 'System Health', explanation: 'Systemd service failures from agents OTHER than chat-bot/chatbot (which generate 500K+ events). Uses double NOT to exclude both name variants. Includes full_log in message for troubleshooting.'
  },
  {
    id: 'r_integrity', groupId: 'g_system', name: 'File Integrity Changed',
    description: 'Integrity checksum changes on monitored files',
    priority: 90, overwrite: false, conditionLogic: 'AND',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'Integrity checksum changed', negate: false }
    ],
    actions: [{ type: 'alert', params: { severity: 'low', message: 'Integrity change on {{agent.name}}: {{rule.description}}' } }],
    category: 'System Health', explanation: 'File integrity monitoring — detects unauthorized file modifications. Low severity since syscheck can be noisy.'
  },

  // ─── CATEGORY 8: REGISTRY (1 rule) ───
  {
    id: 'r_registry_changes', groupId: 'g_system', name: 'Registry Changes Monitor',
    description: 'Registry value deletions and key changes',
    priority: 110, overwrite: false, conditionLogic: 'OR',
    conditions: [
      { id: 'c1', field: 'rule.description', operator: 'contains', value: 'Registry Value Entry Deleted', negate: false },
      { id: 'c2', field: 'rule.description', operator: 'contains', value: 'Registry Key Entry Deleted', negate: false },
      { id: 'c3', field: 'rule.description', operator: 'startsWith', value: 'Registry Value Integrity', negate: false },
      { id: 'c4', field: 'rule.description', operator: 'startsWith', value: 'Registry Key Integrity', negate: false }
    ],
    actions: [{ type: 'alert', params: { severity: 'medium', message: 'Registry change on {{agent.name}}: {{rule.description}}' } }],
    category: 'Registry', explanation: 'Monitors registry deletions and integrity changes. Uses OR with 4 conditions to cover all registry event types. Registry changes are high-signal for compromise detection.'
  }
]

// Build groups from rule categories
const GROUP_NAMES = [...new Set(RULES.map(r => r.category))]
const GROUPS = GROUP_NAMES.map((name, i) => ({
  id: 'g_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
  name, description: name + ' rules', order: i,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
}))

// Assign groupIds
for (const r of RULES) {
  const g = GROUPS.find(x => x.name === r.category)
  r.groupId = g.id
  delete r.category
  delete r.explanation
}

// ============================================================
// TEST ALL 20 RULES AGAINST LIVE DATA
// ============================================================

console.log('╔══════════════════════════════════════════════════════════════════════╗')
console.log('║          COMPREHENSIVE RULE ENGINE TEST — 20 RULES                   ║')
console.log('╚══════════════════════════════════════════════════════════════════════╝\n')

console.log(`📋 ${GROUPS.length} groups, ${RULES.length} rules\n`)

// Fetch diverse data
const queries = [
  'rule.level:15&limit=5',
  'rule.level:12&limit=10',
  'rule.level:10&limit=10',
  'rule.level:7&limit=10',
  'rule.level:5&limit=10',
  'rule.level:3&limit=5',
  'rule.description:"Sysmon - Event 1: Process creation."&limit=5',
  'rule.description:"Sysmon - Event 3: Network connection."&limit=5',
  'rule.description:"Sysmon - Event 7: Image loaded."&limit=5',
  'rule.description:"Sysmon - Event 10: ProcessAccess."&limit=5',
  'rule.description:"Sysmon - Event 11: FileCreate."&limit=5',
  'rule.description:"Sysmon - Event 13: RegistryEvent (Value Set)."&limit=5',
  'rule.description:"Sysmon - Event 22: DNS Query."&limit=5',
  'rule.description:"Systemd: Service exited due to a failure."&limit=5',
  'rule.description:"Postfix SASL authentication failure."&limit=5',
  'rule.description:"File added to the system."&limit=5',
  'rule.description:"File deleted."&limit=5',
  'rule.description:"Integrity checksum changed."&limit=3',
  'rule.description:"Registry Value Entry Deleted."&limit=3',
  'rule.description:"Registry Key Entry Deleted."&limit=3',
  'rule.description:"A process was created."&limit=5',
  '&limit=20',
]

let allAlerts = []
for (const q of queries) {
  try {
    const res = await fetch(`${apiBase}/search?${q}&sort=@timestamp&order=desc`)
    const data = await res.json()
    if (data.results?.length) allAlerts.push(...data.results)
  } catch {}
}
const seen = new Set()
allAlerts = allAlerts.filter(a => { const id = a._id || a.id; if (seen.has(id)) return false; seen.add(id); return true })
console.log(`📊 Fetched ${allAlerts.length} unique alerts for testing\n`)

// Explanation docs
const EXPLANATIONS = {
  'r_crit_level': 'Catches critical+ alerts. Uses dynamic severity so level-15 event gets "critical" badge. Overwrite=true — this rule takes priority over all others when matched. Message shows both description and level.',
  'r_high_level': 'Catches high-severity alerts (levels 8-11) with static "high" severity. Range condition uses gte+lt (>=8 AND <12).',
  'r_med_level': 'Catches medium alerts (levels 5-7) — the largest group with 7.5M+ events. Uses "medium" severity. Shows agent name in message.',
  'r_low_level': 'Low-severity alerts (levels 3-4) use "tag" action instead of "alert" to reduce noise. Tags them as "low-severity" for filtering.',
  'r_sysmon_proc': 'Sysmon E1 process creation. Uses OR to match both "Sysmon - Event 1" AND generic "A process was created". Tag-only — high volume (290K events) but useful for process tracking.',
  'r_sysmon_net': 'Network connections (E3) + DNS queries (E22). Uses ignore IPs (127.0.0.0/8) to skip loopback. Tag-only — network activity is high volume.',
  'r_sysmon_img': 'DLL/module image loading (E7). Uses "equals" with exact description string including trailing period. Can detect suspicious DLL loads.',
  'r_sysmon_procaccess': 'ProcessAccess (E10) — potential process injection or credential dumping. ALERT (high severity) because this is suspicious.',
  'r_sysmon_filecreate': 'File creation (E11). Tag-only — high volume (147K events) but useful for forensic investigation.',
  'r_sysmon_registry': 'Registry modifications (E13). ALERT (medium) — registry changes by unknown processes can indicate malware.',
  'r_misp_ioc': 'Confirmed MISP threat intelligence IoC hit. Uses AND logic: must contain "IoC found" AND NOT "MISP - Error". Overwrite=true — highest priority (500). Critical severity.',
  'r_virustotal': 'VT rate-limit errors and MISP hash matches. Lower priority than MISP IoC rule. Uses OR to catch both types.',
  'r_file_added': 'New files detected by syscheck. Excludes Gopal-Laptop (13M+ events — too noisy). Tag-only — 2.7M events is too many for alerts.',
  'r_file_deleted': 'File deletions only. Uses NOT "File added" to avoid matching the similar "File added" description. Tag-only.',
  'r_postfix_auth': 'Postfix SASL auth failures = possible brute force. Filters level > 4 to skip low-severity noise. Uses {{location}} interpolation.',
  'r_critical_logon': 'Level 12+ logon events. Dynamic severity (From Event). Overwrite=true — highest priority auth rule. Interpolated message shows agent name + IP.',
  'r_mssql_logon': 'MS SQL logon monitoring. Uses "contains" instead of "equals" to handle both "Success" and "Failed" variations.',
  'r_pfsense': 'pfSense firewall block events. Triple condition: description + action=block + level>8. Ignore IPs skips private ranges. Message shows src→dst:port.',
  'r_systemd_fail': 'Systemd failures excluding chat-bot (which generates 500K events). Double NOT for both "chat-bot" and "chatbot" variants. Shows full_log for debugging.',
  'r_integrity': 'File integrity checksum changes — detects unauthorized modifications. Low severity since syscheck is often noisy.',
  'r_registry_changes': 'Covers 4 registry event types via OR: value deleted, key deleted, value integrity, key integrity. Alert (medium) — registry changes are high-signal.'
}

let matchCounts = {}
for (const r of RULES) {
  const g = GROUPS.find(x => x.id === r.groupId)
  console.log(`╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌`)

  let matches = 0
  const examples = []
  for (const alert of allAlerts) {
    const result = evalRule(r, alert)
    if (result.matched) {
      matches++
      if (examples.length < 2) {
        const ts = String(resolveField(alert, '@timestamp')).substring(0, 19).replace('T', ' ')
        const desc = String(resolveField(alert, 'rule.description')).substring(0, 55)
        const agent = resolveField(alert, 'agent.name')
        const level = resolveField(alert, 'rule.level')
        const msg = r.actions[0]?.params?.useEventLevel
          ? `[dynamic: lvl ${level}] ${interpolate(r.actions[0]?.params?.message || '', alert)}`
          : interpolate(r.actions[0]?.params?.message || '', alert)
        examples.push({ level, ts, desc, agent, msg: msg.substring(0, 80) })
      }
    }
  }

  const pct = allAlerts.length ? ((matches / allAlerts.length) * 100).toFixed(1) : '0'
  const barLen = 25
  const filled = Math.round((matches / allAlerts.length) * barLen) || 0
  const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled)

  const matchLabel = `${r.name} [${g?.name || '?'}]`
  const condStr = r.conditions.map(c => `${c.negate ? '¬' : ''}${c.field}:${c.operator}(${c.value})`).join(r.conditionLogic === 'AND' ? ' ∧ ' : ' ∨ ')
  console.log(`  ${matchLabel}`)
  console.log(`  P:${r.priority} OV:${r.overwrite} | ${condStr}`)
  console.log(`  ${bar} ${matches}/${allAlerts.length} (${pct}%) → ${r.actions[0].type} ${r.actions[0].params?.severity || r.actions[0].params?.tag || ''}`)

  if (examples.length) {
    for (const ex of examples) {
      console.log(`    ✅ L${ex.level} | ${ex.ts} | ${ex.desc}`)
      if (ex.msg) console.log(`       ${ex.agent} → ${ex.msg}`)
    }
  } else {
    const first = allAlerts[0]
    if (first) {
      const result = evalRule(r, first)
      const fails = result.details?.filter(d => !d.matched).slice(0, 2)
      console.log(`    ❌ No match — sample: L${resolveField(first, 'rule.level')} | ${String(resolveField(first, 'rule.description')).substring(0, 40)}`)
      if (fails?.length) for (const f of fails) console.log(`       ✗ ${f.text}  (actual: "${f.fieldValue}")`)
    }
  }
  console.log()

  matchCounts[r.id] = matches
}

// ============================================================
// SAVE SEED JSON
// ============================================================

const seedOutput = { groups: GROUPS, rules: RULES }
writeFileSync('rules_20_seed.json', JSON.stringify(seedOutput, null, 2))

console.log('╔══════════════════════════════════════════════════════════════════════╗')
console.log('║                     TEST COMPLETE                                   ║')
console.log('╚══════════════════════════════════════════════════════════════════════╝')
console.log(`\n✅ ${RULES.length} rules tested across ${GROUPS.length} groups`)
console.log(`✅ Results saved to rules_20_seed.json`)

// Summary table
console.log(`\n┌──────┬──────────────────────────────────────┬──────────┬────────────┐`)
console.log(`│ ${'#'.padEnd(4)} │ ${'Rule Name'.padEnd(36)} │ ${'Matches'.padEnd(8)} │ ${'Action'.padEnd(10)} │`)
console.log(`├──────┼──────────────────────────────────────┼──────────┼────────────┤`)
RULES.forEach((r, i) => {
  const m = matchCounts[r.id]
  const g = GROUPS.find(x => x.id === r.groupId)
  const action = `${r.actions[0].type}/${r.actions[0].params?.severity || r.actions[0].params?.tag || ''}`
  console.log(`│ ${String(i+1).padEnd(4)} │ ${(`${r.name} [${g.name}]`).padEnd(36)} │ ${String(m).padEnd(8)} │ ${action.padEnd(10)} │`)
})
console.log(`└──────┴──────────────────────────────────────┴──────────┴────────────┘`)

console.log(`\n=== EXPLANATIONS ===\n`)
for (const r of RULES) {
  const g = GROUPS.find(x => x.id === r.groupId)
  console.log(`[${g.name}] ${r.name}`)
  console.log(`  ${EXPLANATIONS[r.id] || '(see conditions above)'}`)
  console.log()
}

console.log(`\nLoad in browser:`)
console.log(`fetch('/rules_20_seed.json').then(r=>r.json()).then(d=>{localStorage.setItem('soc_rules',JSON.stringify(d));alert('Loaded 20 rules!')})`)
