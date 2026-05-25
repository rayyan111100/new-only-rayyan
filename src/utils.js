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
  const m = start.match(/^now-(\d+)([smhdwMy])$/)
  if (m && end === 'now') {
    const n = m[1], unit = m[2]
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
  if (start === 'now' && end === 'now') return 'Now'
  const sd = dayjs(start), ed = dayjs(end)
  if (sd.isValid() && ed.isValid()) return sd.format('MMM D, h:mm A') + ' to ' + ed.format('MMM D, h:mm A')
  return start + ' to ' + end
}

export function buildDqlText(filters) {
  if (!filters || !filters.length) return ''
  const parts = []
  for (const f of filters) {
    if (f.type === 'exists') continue
    if (f.value === '') continue
    const val = /^\d+(\.\d+)?$/.test(String(f.value)) ? f.value : `"${f.value}"`
    parts.push(f.negate ? 'NOT ' + f.field + ':' + val : f.field + ':' + val)
  }
  return parts.join(' AND ')
}

export function applyClientFilters(results, filters) {
  return results.filter(r => {
    for (const f of filters) {
      if (f.negate) {
        const v = resolveField(r, f.field)
        if (v !== null && v !== undefined && String(v) === String(f.value)) return false
      }
      if (f.type === 'exists') {
        const v = resolveField(r, f.field)
        if (v === null || v === undefined || v === '') return false
      }
    }
    return true
  })
}

export function resolveField(obj, path) {
  try { return path.split('.').reduce((o, p) => o?.[p], obj) ?? '' }
  catch { return '' }
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
