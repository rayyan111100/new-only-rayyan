import { resolveField } from '../utils'

function ipToInt(ip) {
  try {
    const parts = ip.trim().split('.')
    if (parts.length !== 4) return null
    return ((+parts[0] << 24) + (+parts[1] << 16) + (+parts[2] << 8) + +parts[3]) >>> 0
  } catch { return null }
}

function cidrMatch(ip, cidrList) {
  if (!ip || !cidrList.length) return false
  const ips = Array.isArray(ip) ? ip : [ip]
  return cidrList.some(cidr => {
    try {
      const [rangeIp, bits] = cidr.trim().split('/')
      const mask = bits ? ~0 << (32 - +bits) : ~0
      const rangeInt = ipToInt(rangeIp)
      if (rangeInt === null) return false
      const network = rangeInt & mask
      return ips.some(i => {
        const ipInt = ipToInt(i)
        return ipInt !== null && (ipInt & mask) === network
      })
    } catch { return false }
  })
}

function evalOperator(fieldVal, operator, condVal) {
  const fv = fieldVal ?? ''
  switch (operator) {
    case 'equals':
      return String(fv) === String(condVal)
    case 'contains':
      return String(fv).toLowerCase().includes(String(condVal).toLowerCase())
    case 'regex': {
      try { return new RegExp(condVal, 'i').test(String(fv)) }
      catch { return false }
    }
    case 'startsWith':
      return String(fv).toLowerCase().startsWith(String(condVal).toLowerCase())
    case 'endsWith':
      return String(fv).toLowerCase().endsWith(String(condVal).toLowerCase())
    case 'gt':
      return Number(fv) > Number(condVal)
    case 'lt':
      return Number(fv) < Number(condVal)
    case 'inList': {
      const list = String(condVal).split(',').map(s => s.trim())
      return list.includes(String(fv))
    }
    case 'exists':
      return fv !== null && fv !== undefined && fv !== ''
    default:
      return false
  }
}

export function evalCondition(condition, doc) {
  const { field, operator, value, negate } = condition
  const fieldVal = resolveField(doc, field)
  const matched = evalOperator(fieldVal, operator, value)
  return negate ? !matched : matched
}

export function evalRule(rule, doc) {
  const { conditions, conditionLogic, ignoreIps, actions } = rule

  if (ignoreIps && ignoreIps.length > 0) {
    const srcip = resolveField(doc, 'data.srcip')
    const dstip = resolveField(doc, 'data.dstip')
    if (cidrMatch(srcip || dstip, ignoreIps)) return { matched: false, skipped: 'ignoreIp', details: [] }
  }

  if (!conditions || conditions.length === 0) {
    return { matched: true, details: [], actions: actions || [] }
  }

  const results = conditions.map(c => ({
    condition: c,
    matched: evalCondition(c, doc)
  }))

  const matched = conditionLogic === 'AND'
    ? results.every(r => r.matched)
    : results.some(r => r.matched)

  return { matched, details: results, actions: matched ? (actions || []) : [] }
}

export function evaluateAllRules(rules, doc) {
  const enabled = rules.filter(r => r.enabled)

  const matches = enabled
    .map(rule => ({ rule, result: evalRule(rule, doc) }))
    .filter(m => m.result.matched && !m.result.skipped)

  if (matches.length === 0) return { matched: false, matches: [] }

  const sorted = [...matches].sort((a, b) => b.rule.priority - a.rule.priority)

  const overwriteRule = sorted.find(m => m.rule.overwrite)

  const finalMatches = overwriteRule ? [overwriteRule] : sorted

  const allActions = []
  const seen = new Set()
  for (const m of finalMatches) {
    for (const a of (m.result.actions || [])) {
      const key = JSON.stringify(a)
      if (!seen.has(key)) {
        seen.add(key)
        allActions.push({ action: a, rule: m.rule })
      }
    }
  }

  const highestPriority = sorted[0].rule.priority

  return {
    matched: true,
    matches: finalMatches.map(m => ({
      rule: m.rule,
      details: m.result.details,
      actions: m.result.actions
    })),
    actions: allActions,
    overwritten: !!overwriteRule,
    highestPriority
  }
}

export function interpolateMessage(template, doc) {
  if (!template) return ''
  return template.replace(/\{\{([^}]+)\}\}/g, (_, field) => {
    return resolveField(doc, field.trim()) || `{{${field.trim()}}}`
  })
}
