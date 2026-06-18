import { api } from '../api'

const GDPR_INDEX = 'wazuh-alerts-4.x-*'
const GDPR_Q = '_exists_:rule.gdpr'

const SEV_COLORS = { Critical: '#dc2626', High: '#ea580c', Medium: '#d97706', Low: '#16a34a' }

const OS_MAP = {
  'COREGENIX': 'Windows',
  'chat-bot': 'Linux',
  'chatbot': 'Linux',
  'Rayyan': 'Windows',
  'Gopal-Laptop': 'Windows',
  'Aditya_Laptop': 'Windows',
  'My-SurfaceLaptop': 'Windows',
  'Rayyan-laptop': 'Windows',
  'BSS-B5FPFV2': 'Windows',
  'CGCE': 'Linux',
  'root': 'Linux',
  'suyash-window': 'Windows',
  'windows-endpoint': 'Windows',
  'U360-Correlation-Engine': 'Linux',
  'U360-Engine': 'Linux',
  'U360-UEBA-Engine': 'Linux',
  'U360-Universal-Engine': 'Linux',
  'U360-v2-Engine': 'Linux'
}

const GDPR_ARTICLE_MAP = {
  'II_5.1.f': { article: 'Art. 5(1)(f)', title: 'Integrity & Confidentiality' },
  'IV_30.1.g': { article: 'Art. 30(1)(g)', title: 'Records of Processing' },
  'IV_32.1.b': { article: 'Art. 32(1)(b)', title: 'Confidentiality & Integrity' },
  'IV_32.1.c': { article: 'Art. 32(1)(c)', title: 'Data Loss Prevention' },
  'IV_32.1.d': { article: 'Art. 32(1)(d)', title: 'Testing Security Measures' },
  'IV_32.2': { article: 'Art. 32(2)', title: 'Access Control & Risk Assessment' },
  'IV_33.1': { article: 'Art. 33(1)', title: 'Breach Notification' },
  'IV_33.2': { article: 'Art. 33(2)', title: 'Breach Notification to DPA' },
  'IV_34.1': { article: 'Art. 34(1)', title: 'Communication to Data Subjects' },
  'IV_35.1': { article: 'Art. 35(1)', title: 'DPIA Requirement' },
  'IV_35.7.d': { article: 'Art. 35(7)(d)', title: 'DPIA Requirements' },
  'III_14.2.c': { article: 'Art. 14(2)(c)', title: 'Data Subject Rights' },
  'III_17': { article: 'Art. 17', title: 'Right to Erasure' },
  'IV_24.2': { article: 'Art. 24(2)', title: 'Demonstrate Compliance' },
  'IV_25.1': { article: 'Art. 25(1)', title: 'Data Protection by Design' },
  'IV_28': { article: 'Art. 28', title: 'Data Processor' }
}

const ARTICLE_BANDS = [
  { label: 'Art. 5', min: 0, max: 5, color: '#dc2626', tip: 'Core data protection principles' },
  { label: 'Art. 30-32', min: 30, max: 32, color: '#ea580c', tip: 'Security & processing records' },
  { label: 'Art. 33-34', min: 33, max: 34, color: '#d97706', tip: 'Breach notification' },
  { label: 'Art. 35', min: 35, max: 35, color: '#16a34a', tip: 'DPIA requirements' }
]

function detectOS(name) {
  if (!name) return 'Unknown'
  const exact = OS_MAP[name]
  if (exact) return exact
  const s = name
  if (/^WIN/i.test(s)) return 'Windows'
  if (/^LNX/i.test(s)) return 'Linux'
  if (/^MAC/i.test(s)) return 'macOS'
  if (/^NET/i.test(s)) return 'Network'
  if (/^UBUNTU/i.test(s)) return 'Linux'
  if (/^DEBIAN/i.test(s)) return 'Linux'
  if (/^RHEL/i.test(s)) return 'Linux'
  if (/^CENTOS/i.test(s)) return 'Linux'
  if (/^FEDORA/i.test(s)) return 'Linux'
  if (/windows|microsoft|win/i.test(s)) return 'Windows'
  if (/linux|ubuntu|debian|rhel|centos|suse|fedora|kali|red.?hat/i.test(s)) return 'Linux'
  if (/mac|osx|darwin|apple|macbook|imac/i.test(s)) return 'macOS'
  if (/laptop|desktop|workstation|endpoint/i.test(s)) return 'Windows'
  if (/engine|vm|container|docker|kube|node|proxy|nginx|apache|mysql|postgres|mongodb/i.test(s)) return 'Linux'
  if (/server|sql|exchange|sharepoint|adfs|azure|hyper-v|iis|domain|controller|gateway/i.test(s)) return 'Windows'
  return 'Unknown'
}

function resolveArticle(code) {
  return GDPR_ARTICLE_MAP[code] || { article: code, title: 'GDPR Requirement' }
}

function mapSev(level) {
  return level >= 12 ? 'Critical'
    : level >= 7 ? 'High'
    : level >= 4 ? 'Medium'
    : 'Low'
}

function normalizeDoc(doc) {
  const agent = doc.agent || {}
  const rule = doc.rule || {}
  const ts = doc['@timestamp'] || ''
  const gdprCodes = rule.gdpr
    ? (Array.isArray(rule.gdpr) ? rule.gdpr : [rule.gdpr])
    : []
  const severity = mapSev(rule.level || 0)
  return {
    timestamp: ts,
    agentName: agent.name || '',
    agentIP: agent.ip || '',
    os: detectOS(agent.name),
    ruleId: String(rule.id || ''),
    ruleDescription: rule.description || '',
    ruleLevel: rule.level || 0,
    severity,
    gdprCodes,
    groups: rule.groups || [],
    fullLog: doc.full_log || '',
    id: doc._id || doc.id || ''
  }
}

function buildEventQ(filters) {
  const parts = [GDPR_Q]
  if (filters.severity) {
    const sevMap = { Critical: 'level>=12', High: 'level:[7 TO 11]', Medium: 'level:[4 TO 6]', Low: 'level:[1 TO 3]' }
    if (sevMap[filters.severity]) parts.push(sevMap[filters.severity])
  }
  if (filters.q) {
    const q = filters.q.replace(/[^a-zA-Z0-9_.\- ]/g, '')
    parts.push(`agent.name:*${q}* OR rule.id:${q} OR rule.description:*${q}* OR agent.ip:*${q}*`)
  }
  return '(' + parts.join(') AND (') + ')'
}

export async function fetchAllGdprData({ startDate, endDate } = {}) {
  const sd = startDate || 'now-1y'
  const ed = endDate || 'now'

  const baseParams = {
    index: GDPR_INDEX, q: GDPR_Q,
    start_date: sd, end_date: ed
  }

  const [
    countRes,
    sevAggRes,
    articleAggRes,
    agentAggRes,
    trendAggRes,
    recentRes
  ] = await Promise.all([
    api('count', baseParams),
    api('aggregate', { ...baseParams, field: 'rule.level', type: 'terms', limit: 20 }),
    api('aggregate', { ...baseParams, field: 'rule.gdpr', type: 'terms', limit: 50 }),
    api('aggregate', { ...baseParams, field: 'agent.name', type: 'terms', limit: 100 }),
    api('aggregate', { ...baseParams, field: '@timestamp', type: 'date_histogram', interval: '1d', limit: 365 }),
    api('search', { ...baseParams, limit: 500, sort: '@timestamp', order: 'desc' })
  ])

  const total = countRes.count || 0
  const sevBuckets = sevAggRes.buckets || []
  const articleBuckets = articleAggRes.buckets || []
  const agentBuckets = agentAggRes.buckets || []
  const trendBuckets = trendAggRes.buckets || []
  const recentDocs = (recentRes.results || []).map(normalizeDoc)

  let sevCritical = 0, sevHigh = 0, sevMedium = 0, sevLow = 0
  for (const b of sevBuckets) {
    const lvl = parseInt(b.key) || 0
    const cnt = b.doc_count || 0
    if (lvl >= 12) sevCritical += cnt
    else if (lvl >= 7) sevHigh += cnt
    else if (lvl >= 4) sevMedium += cnt
    else sevLow += cnt
  }

  const stats = { total, critical: sevCritical, high: sevHigh, medium: sevMedium, low: sevLow }
  const denominator = total || 1

  const severityBuckets = Object.entries(SEV_COLORS).map(([sev, color]) => {
    const key = sev.toLowerCase()
    const cnt = stats[key] || 0
    return { label: sev, pct: +((cnt / denominator) * 100).toFixed(1), count: cnt, color }
  })

  const articles = articleBuckets
    .filter(b => b.key && b.doc_count > 0)
    .map(b => {
      const art = resolveArticle(b.key)
      return {
        code: b.key,
        article: art.article,
        title: art.title,
        eventCount: b.doc_count || 0,
        criticalCount: 0,
        agents: 0
      }
    })
    .sort((a, b) => b.eventCount - a.eventCount)
    .map((a, i) => ({ ...a, rank: i + 1 }))

  const agentNameMap = new Map()
  for (const b of agentBuckets) {
    const name = b.key
    if (name) {
      agentNameMap.set(name, { totalEvents: b.doc_count || 0, name, ip: '', os: detectOS(name), vulns: { c: 0, h: 0, m: 0, l: 0 } })
    }
  }

  for (const doc of recentDocs) {
    if (doc.agentName && agentNameMap.has(doc.agentName)) {
      const a = agentNameMap.get(doc.agentName)
      if (doc.severity === 'Critical') a.vulns.c++
      else if (doc.severity === 'High') a.vulns.h++
      else if (doc.severity === 'Medium') a.vulns.m++
      else if (doc.severity === 'Low') a.vulns.l++
      if (doc.agentIP && !a.ip) a.ip = doc.agentIP
    }
  }

  const agents = [...agentNameMap.values()].map(a => ({
    name: a.name,
    ip: a.ip,
    os: a.os,
    events: a.totalEvents,
    vulns: { ...a.vulns }
  }))

  const osCounts = new Map()
  for (const name of agentNameMap.keys()) {
    const os = detectOS(name)
    osCounts.set(os, (osCounts.get(os) || 0) + 1)
  }
  const osColors = { Windows: '#2563eb', Linux: '#ea580c', macOS: '#d97706', Network: '#7c3aed', Unknown: '#6b7280' }
  const platforms = [...osCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, cnt]) => ({ name, count: cnt, criticalCount: 0, color: osColors[name] || '#6b7280' }))

  const sortedDays = trendBuckets
    .filter(b => b.key)
    .map(b => ({ key: b.key_as_string || String(b.key), doc_count: b.doc_count || 0 }))
  sortedDays.sort((a, b) => a.key.localeCompare(b.key))

  const totalEvents = sevCritical + sevHigh + sevMedium + sevLow || 1
  const critRatio = sevCritical / totalEvents
  const highRatio = sevHigh / totalEvents
  const medRatio = sevMedium / totalEvents

  const trend = sortedDays.map(b => {
    const d = new Date(b.key + 'T00:00:00Z')
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const dayTotal = b.doc_count || 0
    return {
      date: label,
      critical: Math.round(dayTotal * critRatio),
      high: Math.round(dayTotal * highRatio),
      medium: Math.round(dayTotal * medRatio)
    }
  })

  const articleBands = ARTICLE_BANDS.map(b => {
    const cnt = articles
      .filter(a => {
        const num = parseInt(a.article.replace(/\D/g, '')) || 0
        return num >= b.min && num <= b.max
      })
      .reduce((sum, a) => sum + a.eventCount, 0)
    return { ...b, pct: +((cnt / denominator) * 100).toFixed(1), count: cnt }
  })

  const events = recentDocs.map(d => {
    const primaryArticle = d.gdprCodes.length > 0 ? resolveArticle(d.gdprCodes[0]).article : 'N/A'
    return {
      id: d.id,
      alertTime: d.timestamp ? d.timestamp.substring(0, 16).replace('T', ' ') : d.timestamp,
      agentName: d.agentName,
      agentIP: d.agentIP,
      ruleId: d.ruleId,
      severity: d.severity,
      description: d.ruleDescription,
      article: primaryArticle,
      gdprCodes: d.gdprCodes,
      groups: d.groups,
      fullLog: d.fullLog,
      os: d.os,
      ruleLevel: d.ruleLevel
    }
  })

  const controlStats = {
    totalAssets: agents.length,
    fullyCompliant: agents.filter(a => a.events > 0 && a.vulns.c + a.vulns.h === 0).length,
    partiallyCompliant: agents.filter(a => a.events > 0 && (a.vulns.c + a.vulns.h) > 0 && (a.vulns.c + a.vulns.h) < a.events).length,
    nonCompliant: agents.filter(a => a.events > 0 && (a.vulns.c + a.vulns.h) === a.events).length,
    gaugeData: ['Critical', 'High', 'Medium', 'Low'].map(sev => {
      const key = sev.toLowerCase()
      const cnt = stats[key] || 0
      return { label: sev, pct: 0, color: '#3fb950', totalCount: cnt }
    })
  }

  return { stats, severityBuckets, platforms, articles, events, vulnAlerts: events, agents, trend, articleBands, controlStats, total }
}

export async function fetchEvents(filters = {}, opts = {}) {
  const { startDate, endDate, offset = 0, limit = 500, sortField = '@timestamp', sortOrder = 'desc' } = opts
  const sd = startDate || 'now-30d'
  const ed = endDate || 'now'
  const q = buildEventQ(filters)

  const res = await api('search', {
    index: GDPR_INDEX, q, limit, offset,
    sort: sortField, order: sortOrder,
    start_date: sd, end_date: ed
  }).catch(() => ({ results: [], total: 0 }))

  const total = res.total || 0
  const results = (res.results || []).map(normalizeDoc).map(d => {
    const primaryArticle = d.gdprCodes.length > 0 ? resolveArticle(d.gdprCodes[0]).article : 'N/A'
    return {
      id: d.id,
      alertTime: d.timestamp ? d.timestamp.substring(0, 16).replace('T', ' ') : d.timestamp,
      agentName: d.agentName,
      agentIP: d.agentIP,
      ruleId: d.ruleId,
      severity: d.severity,
      description: d.ruleDescription,
      article: primaryArticle,
      gdprCodes: d.gdprCodes,
      groups: d.groups,
      fullLog: d.fullLog,
      os: d.os,
      ruleLevel: d.ruleLevel
    }
  })

  return { results, total }
}

export async function fetchAgents(filters = {}, opts = {}) {
  const { startDate, endDate } = opts
  const sd = startDate || 'now-1y'
  const ed = endDate || 'now'

  const qParts = [GDPR_Q]
  if (filters.q) {
    const q = filters.q.replace(/[^a-zA-Z0-9_.\- ]/g, '')
    qParts.push(`agent.name:*${q}* OR agent.ip:*${q}*`)
  }
  if (filters.os) {
    const osAgents = Object.entries(OS_MAP).filter(([, v]) => v === filters.os).map(([k]) => k)
    if (osAgents.length > 0) {
      qParts.push(`(${osAgents.map(n => `agent.name:${n}`).join(' OR ')})`)
    }
  }
  const q = '(' + qParts.join(') AND (') + ')'

  const [agentAggRes, sampleRes] = await Promise.all([
    api('aggregate', {
      index: GDPR_INDEX, q, field: 'agent.name', type: 'terms', limit: 100,
      start_date: sd, end_date: ed
    }).catch(() => ({ buckets: [] })),
    api('search', {
      index: GDPR_INDEX, q, limit: 500, sort: '@timestamp', order: 'desc',
      start_date: sd, end_date: ed
    }).catch(() => ({ results: [], total: 0 }))
  ])

  const agentBuckets = agentAggRes.buckets || []
  const sampleDocs = (sampleRes.results || []).map(normalizeDoc)

  const agentSev = new Map()
  for (const doc of sampleDocs) {
    if (!doc.agentName) continue
    if (!agentSev.has(doc.agentName)) {
      agentSev.set(doc.agentName, { c: 0, h: 0, m: 0, l: 0, ip: '' })
    }
    const a = agentSev.get(doc.agentName)
    if (doc.severity === 'Critical') a.c++
    else if (doc.severity === 'High') a.h++
    else if (doc.severity === 'Medium') a.m++
    else if (doc.severity === 'Low') a.l++
    if (doc.agentIP && !a.ip) a.ip = doc.agentIP
  }

  const agents = agentBuckets
    .filter(b => b.key)
    .map(b => {
      const sev = agentSev.get(b.key) || { c: 0, h: 0, m: 0, l: 0, ip: '' }
      return {
        name: b.key,
        ip: sev.ip,
        os: detectOS(b.key),
        events: b.doc_count || 0,
        vulns: { ...sev }
      }
    })
    .filter(a => a.events > 0)

  return agents
}

export async function fetchGdprStats(opts = {}) {
  const { startDate, endDate } = opts
  const sd = startDate || 'now-1y'
  const ed = endDate || 'now'

  const [countRes, sevAggRes] = await Promise.all([
    api('count', { index: GDPR_INDEX, q: GDPR_Q, start_date: sd, end_date: ed }),
    api('aggregate', { index: GDPR_INDEX, q: GDPR_Q, field: 'rule.level', type: 'terms', limit: 20, start_date: sd, end_date: ed })
  ])

  const total = countRes.count || 0
  const sevBuckets = sevAggRes.buckets || []

  let critical = 0, high = 0, medium = 0, low = 0
  for (const b of sevBuckets) {
    const lvl = parseInt(b.key) || 0
    const cnt = b.doc_count || 0
    if (lvl >= 12) critical += cnt
    else if (lvl >= 7) high += cnt
    else if (lvl >= 4) medium += cnt
    else low += cnt
  }

  return { total, critical, high, medium, low }
}
