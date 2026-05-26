import { readFileSync } from 'fs'

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
    fieldValue: String(resolveField(doc, c.field)).substring(0, 40)
  }))
  const matched = rule.conditionLogic === 'AND' ? results.every(r => r.matched) : results.some(r => r.matched)
  return { matched, details: results }
}

function interpolate(tmpl, doc) {
  if (!tmpl) return ''
  return tmpl.replace(/\{\{([^}]+)\}\}/g, (_, f) => resolveField(doc, f.trim()) || `{{${f.trim()}}}`)
}

const seed = JSON.parse(readFileSync('rules_seed.json', 'utf-8'))
const rules = seed.rules
const groups = seed.groups
const apiBase = 'http://localhost:3000/api'

console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║         RULE ENGINE — LIVE WAZUH DATA TEST                  ║')
console.log('╚══════════════════════════════════════════════════════════════╝\n')

// Fetch data for each rule individually using direct API queries
const ruleTests = [
  { id: 'r_pfsense_block', name: 'pfSense Firewall Block', q: 'rule.description:"Multiple pfSense firewall blocks events from same source."' },
  { id: 'r_critical_logon', name: 'Critical Logon Detection', q: 'rule.level:12' },
  { id: 'r_auth_fail', name: 'Postfix Auth Failure', q: 'rule.description:"Postfix SASL authentication failure."' },
  { id: 'r_sysmon_proc', name: 'Sysmon Process Create', q: 'rule.description:"Sysmon - Event 1: Process creation."' },
  { id: 'r_threat_intel', name: 'MISP Threat Match', q: 'rule.description:"MISP - IoC found in Threat Intel"' },
  { id: 'r_virustotal', name: 'VirusTotal Alert', q: 'rule.description:"VirusTotal: Error"' },
  { id: 'r_sysmon_net', name: 'Sysmon Network Connection', q: 'rule.description:"Sysmon - Event 3: Network connection."' },
  { id: 'r_service_fail', name: 'Systemd Service Failure', q: 'rule.description:"Systemd: Service exited due to a failure."' }
]

for (const rt of ruleTests) {
  const rule = rules.find(r => r.id === rt.id)
  const group = groups.find(g => g.id === rule?.groupId)
  if (!rule) { console.log(`⚠️  Rule ${rt.id} not found in seed\n`); continue }

  console.log(`╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌`)
  console.log(`🔍 ${rt.name}`)
  console.log(`   Group: ${group?.name} | Priority: ${rule.priority} | ${rule.conditionLogic} | Overwrite: ${rule.overwrite}`)
  for (const c of rule.conditions) {
    console.log(`   ${c.negate ? '🚫 NOT' : '     '} ${c.field} ${c.operator} "${c.value}"`)
  }
  console.log(`   Action: ${rule.actions[0].type} → ${rule.actions[0].params?.severity || rule.actions[0].params?.tag || '-'}`)

  // Fetch matching alerts
  let alerts = []
  try {
    const url = `${apiBase}/search?limit=15&sort=@timestamp&order=desc&q=${encodeURIComponent(rt.q)}`
    const res = await fetch(url)
    const data = await res.json()
    alerts = data.results || []
    console.log(`   📊 Dataset: ${data.total || 0} matching alerts total (fetched ${alerts.length})`)
  } catch (e) {
    console.log(`   ⚠️  API error: ${e.message}`)
  }

  // Evaluate rule against fetched alerts
  if (alerts.length === 0) {
    console.log(`   ⚠️  No matching data in sample — rule may work with different time range`)
    console.log()
    continue
  }

  let matches = 0
  const examples = []
  for (const alert of alerts) {
    const result = evalRule(rule, alert)
    if (result.matched) {
      matches++
      if (examples.length < 3) {
        const ts = String(resolveField(alert, '@timestamp')).substring(0, 19).replace('T', ' ')
        const desc = String(resolveField(alert, 'rule.description')).substring(0, 55)
        const agent = resolveField(alert, 'agent.name')
        const level = resolveField(alert, 'rule.level')
        const msg = rule.actions[0]?.params?.message ? interpolate(rule.actions[0].params.message, alert) : ''
        examples.push({ ts, desc, agent, level, msg: msg.substring(0, 90) })
      }
    }
  }

  const pct = alerts.length ? ((matches / alerts.length) * 100).toFixed(0) : '0'
  if (matches > 0) {
    console.log(`   ✅ ${matches}/${alerts.length} (${pct}%) matched this rule`)
    for (const ex of examples) {
      console.log(`      L${ex.level} | ${ex.ts} | ${ex.desc}`)
      console.log(`        ${ex.agent}${ex.msg ? ' → ' + ex.msg : ''}`)
    }
  } else {
    console.log(`   ❌ 0/${alerts.length} matched — conditions too strict?`)
    // Show why first alert didn't match
    const first = alerts[0]
    const result = evalRule(rule, first)
    console.log(`      Failed conditions on: L${resolveField(first, 'rule.level')} | ${String(resolveField(first, 'rule.description')).substring(0, 50)}`)
    for (const d of result.details) {
      console.log(`      ${d.matched ? '✅' : '❌'} ${d.text}  (actual: "${d.fieldValue}")`)
    }
  }
  console.log()
}

console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║         DONE — 8 RULES TESTED                               ║')
console.log('╚══════════════════════════════════════════════════════════════╝')
console.log(`\n👉 To load rules in browser:`)
console.log(`   http://localhost:5173/ → F12 → paste:`)
console.log(`   fetch('/rules_seed.json').then(r=>r.json()).then(d=>{localStorage.setItem('soc_rules',JSON.stringify(d));alert('Loaded! Refresh')})`)
