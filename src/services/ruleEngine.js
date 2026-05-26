import { resolveField } from '../utils'

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
  const { conditions, conditionLogic, actions } = rule

  if (!conditions || conditions.length === 0) {
    return { matched: true, details: [], actions: actions || [] }
  }

  const results = conditions.map(c => ({
    condition: c,
    matched: evalCondition(c, doc)
  }))

  const matched = results.reduce((acc, r, idx) => {
    if (idx === 0) return r.matched
    const logic = r.condition.logic || conditionLogic || 'AND'
    return logic === 'OR' ? acc || r.matched : acc && r.matched
  }, false)

  return { matched, details: results, actions: matched ? (actions || []) : [] }
}

export function evaluateAllRules(rules, doc) {
  const enabled = rules.filter(r => r.enabled)

  const matches = enabled
    .map(rule => ({ rule, result: evalRule(rule, doc) }))
    .filter(m => m.result.matched)

  if (matches.length === 0) return { matched: false, matches: [] }

  const allActions = []
  const seen = new Set()
  for (const m of matches) {
    for (const a of (m.result.actions || [])) {
      const key = JSON.stringify(a)
      if (!seen.has(key)) {
        seen.add(key)
        allActions.push({ action: a, rule: m.rule })
      }
    }
  }

  return {
    matched: true,
    matches: matches.map(m => ({
      rule: m.rule,
      details: m.result.details,
      actions: m.result.actions
    })),
    actions: allActions
  }
}

export function interpolateMessage(template, doc) {
  if (!template) return ''
  return template.replace(/\{\{([^}]+)\}\}/g, (_, field) => {
    return resolveField(doc, field.trim()) || `{{${field.trim()}}}`
  })
}
