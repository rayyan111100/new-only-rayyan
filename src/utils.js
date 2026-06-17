import dayjs from 'dayjs'

export function parseDateStr(s) {
  if (!s || s === 'now') return dayjs()
  s = s.trim()
  if (s === 'now/d') return dayjs().startOf('day')
  if (s === 'now/w') return dayjs().startOf('week')
  const m = s.match(/^now[+-](\d+)([smhdwMy])(?:\/([hdwMy]))?$/)
  if (m) {
    const n = parseInt(m[1]), unit = m[2]
    let d = dayjs()
    if (unit === 's') d = d.subtract(n, 'second')
    else if (unit === 'm') d = d.subtract(n, 'minute')
    else if (unit === 'h') d = d.subtract(n, 'hour')
    else if (unit === 'd') d = d.subtract(n, 'day')
    else if (unit === 'w') d = d.subtract(n, 'week')
    else if (unit === 'M') d = d.subtract(n, 'month')
    else if (unit === 'y') d = d.subtract(n, 'year')
    if (m[3] === 'd') d = d.startOf('day')
    else if (m[3] === 'h') d = d.startOf('hour')
    return d
  }
  const p = dayjs(s)
  return p.isValid() ? p : dayjs()
}

export function formatPretty(start, end) {
  if (start === 'now' && end === 'now') return 'Now'
  const m = start.match(/^now-(\d+)([smhdwMy])$/)
  if (m && end === 'now') {
    const n = Number(m[1]), unit = m[2]
    const names = {
      s: 'second' + (n > 1 ? 's' : ''),
      m: 'minute' + (n > 1 ? 's' : ''),
      h: 'hour' + (n > 1 ? 's' : ''),
      d: 'day' + (n > 1 ? 's' : ''),
      w: 'week' + (n > 1 ? 's' : ''),
      M: 'month' + (n > 1 ? 's' : ''),
      y: 'year' + (n > 1 ? 's' : '')
    }
    return 'Last ' + n + ' ' + names[unit]
  }
  if (end === 'now') {
    const dayStart = { 'now/d': 'Today', 'now/w': 'This week', 'now/M': 'This month', 'now/y': 'This year' }
    if (dayStart[start]) return dayStart[start]
  }
  const sd = dayjs(start), ed = dayjs(end)
  if (sd.isValid() && ed.isValid()) return sd.format('MMM D, h:mm A') + ' to ' + ed.format('MMM D, h:mm A')
  return start + ' to ' + end
}

function escapeDql(v) {
  return String(v).replace(/[\\"'(){}[\]^~:]/g, '\\$&')
}

function quoteVal(v) {
  return `"${escapeDql(String(v))}"`
}

export function buildDqlText(filters, matchMode = 'and') {
  if (!filters || !filters.length) return ''
  const parts = []
  for (const f of filters) {
    if (f.disabled) continue
    const op = f.operator || (f.type === 'exists' ? 'exists' : f.negate ? 'is not' : 'is')
    const field = f.field
    const neg = f.negate ? 'NOT ' : ''
    const v = f.value
    if (!v && !['exists', 'does not exist'].includes(op)) continue
    switch (op) {
      case 'is':
        if (v === '') continue
        parts.push(`${field}:${quoteVal(v)}`)
        break
      case 'is not':
        if (v === '') continue
        parts.push(`NOT ${field}:${quoteVal(v)}`)
        break
      case 'is one of': {
        if (!v) continue
        const items = v.split(',').map(s => s.trim()).filter(Boolean)
        if (!items.length) continue
        parts.push(`${field}:(${items.map(x => quoteVal(x)).join(' ')})`)
        break
      }
      case 'is not one of': {
        if (!v) continue
        const items = v.split(',').map(s => s.trim()).filter(Boolean)
        if (!items.length) continue
        parts.push(`NOT ${field}:(${items.map(x => quoteVal(x)).join(' ')})`)
        break
      }
      case 'exists':
        parts.push(`_exists_:${field}`)
        break
      case 'does not exist':
        parts.push(`NOT _exists_:${field}`)
        break
      case 'is greater than':
        if (v === '') continue
        parts.push(`${field}:{${escapeDql(v)} TO *}`)
        break
      case 'is greater than or equal':
        if (v === '') continue
        parts.push(`${field}:[${escapeDql(v)} TO *]`)
        break
      case 'is less than':
        if (v === '') continue
        parts.push(`${field}:{* TO ${escapeDql(v)}}`)
        break
      case 'is less than or equal':
        if (v === '') continue
        parts.push(`${field}:[* TO ${escapeDql(v)}]`)
        break
      case 'contains':
        if (v === '') continue
        parts.push(`${neg}${field}:*${escapeDql(v)}*`)
        break
      case 'does not contain':
        if (v === '') continue
        parts.push(`NOT ${field}:*${escapeDql(v)}*`)
        break
      case 'starts with':
        if (v === '') continue
        parts.push(`${neg}${field}:${escapeDql(v)}*`)
        break
      case 'ends with':
        if (v === '') continue
        parts.push(`${neg}${field}:*${escapeDql(v)}`)
        break
      case 'matches regex': {
        if (v === '') continue
        const regex = v.startsWith('/') && v.endsWith('/') ? v.slice(1, -1) : v
        parts.push(`${field}:/${escapeDql(regex)}/`)
        break
      }
      case 'wildcard': {
        if (v === '') continue
        parts.push(`${neg}${field}:${escapeDql(v)}`)
        break
      }
      case 'last N': {
        if (!v || isNaN(parseInt(v))) continue
        const unit = f.params?.unit || 'h'
        const now = dayjs()
        const from = now.subtract(parseInt(v), unit)
        if (from.isValid()) {
          parts.push(`${field}:[${from.toISOString()} TO ${now.toISOString()}]`)
        }
        break
      }
      case 'is between':
        if (!f.secondValue && !f.params) continue
        {
          const from = escapeDql(f.secondValue?.from || f.params?.from || '')
          const to = escapeDql(f.secondValue?.to || f.params?.to || '')
          if (!from || !to) continue
          parts.push(`${field}:[${from} TO ${to}]`)
        }
        break
      case 'is not between':
        if (!f.secondValue && !f.params) continue
        {
          const from = escapeDql(f.secondValue?.from || f.params?.from || '')
          const to = escapeDql(f.secondValue?.to || f.params?.to || '')
          if (!from || !to) continue
          parts.push(`NOT ${field}:[${from} TO ${to}]`)
        }
        break
      default:
        if (v === '') continue
        parts.push(`${field}:${quoteVal(v)}`)
    }
  }
  const joiner = matchMode === 'or' ? ' OR ' : ' AND '
  return parts.join(joiner)
}

function evalClientFilter(r, f) {
  const v = resolveField(r, f.field)
  const exists = v !== null && v !== undefined && v !== ''
  const fv = String(v ?? '')
  const cv = String(f.value ?? '')
  const op = f.operator || (f.type === 'exists' ? 'exists' : f.negate ? 'is not' : 'is')
  const parts = Array.isArray(v) ? v.map(x => String(x)) : [fv]

  if (op === 'exists') return exists
  if (op === 'does not exist') return !exists
  if (!exists) return false

  switch (op) {
    case 'is':
    case undefined:
      return parts.some(p => p === cv)
    case 'is not':
      return !parts.some(p => p === cv)
    case 'is one of': {
      const list = cv.split(',').map(s => s.trim()).filter(Boolean)
      return list.some(l => parts.some(p => p === l))
    }
    case 'is not one of': {
      const list = cv.split(',').map(s => s.trim()).filter(Boolean)
      return !list.some(l => parts.some(p => p === l))
    }
    case 'is greater than': return Number(fv) > Number(cv)
    case 'is greater than or equal': return Number(fv) >= Number(cv)
    case 'is less than': return Number(fv) < Number(cv)
    case 'is less than or equal': return Number(fv) <= Number(cv)
    case 'contains': {
      const m = parts.some(p => p.toLowerCase().includes(cv.toLowerCase()))
      return f.negate ? !m : m
    }
    case 'does not contain': return !parts.some(p => p.toLowerCase().includes(cv.toLowerCase()))
    case 'starts with': {
      const m = parts.some(p => p.toLowerCase().startsWith(cv.toLowerCase()))
      return f.negate ? !m : m
    }
    case 'ends with': {
      const m = parts.some(p => p.toLowerCase().endsWith(cv.toLowerCase()))
      return f.negate ? !m : m
    }
    case 'matches regex': {
      try {
        const regex = new RegExp(cv)
        return parts.some(p => regex.test(p))
      } catch { return false }
    }
    case 'wildcard': {
      const pattern = cv.replace(/\*/g, '.*').replace(/\?/g, '.')
      try {
        const re = new RegExp('^' + pattern + '$', 'i')
        return parts.some(p => re.test(p))
      } catch { return false }
    }
    case 'last N': {
      if (!cv || isNaN(parseInt(cv))) return false
      const unit = f.params?.unit || 'h'
      const limit = dayjs().subtract(parseInt(cv), unit)
      try {
        const ts = dayjs(fv)
        return ts.isValid() && ts.isAfter(limit)
      } catch { return false }
    }
    case 'is between': {
      const from = f.secondValue?.from || f.params?.from || ''
      const to = f.secondValue?.to || f.params?.to || ''
      return Number(fv) >= Number(from) && Number(fv) <= Number(to)
    }
    case 'is not between': {
      const from = f.secondValue?.from || f.params?.from || ''
      const to = f.secondValue?.to || f.params?.to || ''
      return Number(fv) < Number(from) || Number(fv) > Number(to)
    }
    default:
      return parts.some(p => p === cv)
  }
}

export function applyClientFilters(results, filters, matchMode = 'and') {
  if (!filters || !filters.length) return results
  const active = filters.filter(f => !f.disabled)
  if (!active.length) return results
  return results.filter(r => {
    for (const f of active) {
      const matches = evalClientFilter(r, f)
      if (matchMode === 'or' && matches) return true
      if (matchMode === 'and' && !matches) return false
    }
    return matchMode !== 'or'
  })
}

export function extractTotal(resp) {
  if (!resp) return 0
  if (typeof resp.count === 'number') return resp.count
  if (resp.data?.count) return resp.data.count
  if (resp.total) return resp.total
  if (resp.data?.total_affected_items) return resp.data.total_affected_items
  if (resp.hits?.total) {
    const t = resp.hits.total
    return typeof t === 'object' ? (t.value ?? 0) : t
  }
  if (resp.data?.hits?.total) {
    const t = resp.data.hits.total
    return typeof t === 'object' ? (t.value ?? 0) : t
  }
  return 0
}

export function extractResults(resp) {
  if (!resp) return []
  if (Array.isArray(resp.results)) return resp.results
  if (resp.data?.items) return resp.data.items
  if (resp.hits?.hits) return resp.hits.hits.map(h => h._source ?? h)
  if (resp.data?.hits?.hits) return resp.data.hits.hits.map(h => h._source ?? h)
  return []
}

export function parseDql(input) {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()
  // Complex queries with AND/OR → send raw to server
  if (/\b(AND|OR)\b/i.test(trimmed)) return null
  // Match simple field:value or field:>value etc.
  // Supports field names with dots (rule.id), underscores, hyphens
  const m = trimmed.match(/^([\w][\w.\-]*):(.+)$/)
  if (!m) return null
  const field = m[1]
  let rawVal = m[2].trim()

  // Handle quoted values: field:"value with spaces"
  if (rawVal.startsWith('"') && rawVal.endsWith('"')) {
    rawVal = rawVal.slice(1, -1)
  }

  // Detect operator prefix in value
  const opMatch = rawVal.match(/^(>=|<=|>|<)(.+)$/)
  if (opMatch) {
    const opMap = { '>=': 'is greater than or equal', '<=': 'is less than or equal', '>': 'is greater than', '<': 'is less than' }
    return { field, value: opMatch[2].trim(), operator: opMap[opMatch[1]] }
  }

  // Handle wildcard/regex patterns
  if (rawVal.includes('*') || rawVal.includes('?')) {
    return { field, value: rawVal, operator: 'wildcard' }
  }

  // Simple equality
  return { field, value: rawVal, operator: 'is' }
}

export function resolveField(obj, path) {
  try { return path.split('.').reduce((o, p) => o?.[p], obj) ?? '' }
  catch { return '' }
}

export function extractFieldPaths(obj, prefix) {
  prefix = prefix || ''
  const paths = []
  for (const key of Object.keys(obj)) {
    const p = prefix ? `${prefix}.${key}` : key
    paths.push(p)
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      paths.push(...extractFieldPaths(obj[key], p))
    }
  }
  return paths
}

export const COMMON_FIELDS = [
  '@timestamp', 'timestamp', 'id', '_id', '_index',
  'rule.description', 'rule.id', 'rule.level', 'rule.category', 'rule.groups', 'rule.firedtimes',
  'agent.name', 'agent.id', 'agent.ip',
  'decoder.name', 'full_log', 'location', 'input.type',
  'predecoder.program_name', 'predecoder.hostname', 'manager.name',
  'data.srcip', 'data.dstip', 'data.srcport', 'data.dstport', 'data.protocol', 'data.url',
  'data.action', 'data.user', 'data.system_name', 'data.host',
  'data.win.system.eventID', 'data.win.system.severity', 'data.win.system.message',
  'data.win.eventdata.ipAddress', 'data.win.eventdata.logonType', 'data.win.eventdata.logonProcessName',
  'data.win.eventdata.alertSeverity', 'data.win.eventdata.processName',
  'decoded.format', 'decoded.src_ip', 'decoded.dst_ip', 'decoded.src_port', 'decoded.dst_port',
  'decoded.protocol', 'decoded.action', 'decoded.direction', 'decoded.interface',
  'decoded.timestamp', 'decoded.hostname', 'decoded.appName', 'decoded.pid',
  'decoded.user', 'decoded.method', 'decoded.status_code', 'decoded.url', 'decoded.referrer',
  'decoded.user_agent', 'decoded.message', 'decoded.logon_type', 'decoded.account',
  'decoded.srcip', 'decoded.dstip', 'decoded.srcport', 'decoded.dstport'
]

function getFieldTypeFromValue(v) {
  if (v === null || v === undefined) return 'keyword'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'number') return Number.isInteger(v) ? 'long' : 'float'
  if (typeof v === 'string') {
    if (/^\d{4}[-\/]\d{2}[-\/]\d{2}[T ]\d{2}:\d{2}/.test(v)) return 'date'
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) return 'ip'
    return 'keyword'
  }
  if (Array.isArray(v)) return 'array'
  return 'keyword'
}

export function inferFieldTypes(docs) {
  const typeMap = {}
  for (const doc of docs) {
    const paths = extractFieldPaths(doc)
    for (const p of paths) {
      const v = resolveField(doc, p)
      const t = getFieldTypeFromValue(v)
      if (!typeMap[p]) { typeMap[p] = t; continue }
      if (typeMap[p] === 'keyword' && t !== 'keyword') typeMap[p] = t
    }
  }
  return Object.entries(typeMap).map(([name, type]) => ({ name, type }))
}

export function flattenObj(obj, prefix) {
  prefix = prefix || ''
  if (obj === null || obj === undefined) return [{ path: prefix || 'value', value: null }]
  if (typeof obj !== 'object') return [{ path: prefix || 'value', value: obj }]
  if (Array.isArray(obj)) {
    if (!obj.length) return [{ path: prefix || 'value', value: '' }]
    if (obj.every(v => v === null || v === undefined || typeof v !== 'object'))
      return [{ path: prefix || 'value', value: obj.join(', ') }]
    return [{ path: prefix || 'value', value: JSON.stringify(obj) }]
  }
  let result = []
  for (const k of Object.keys(obj)) {
    const p = prefix ? prefix + '.' + k : k
    result = result.concat(flattenObj(obj[k], p))
  }
  return result
}
