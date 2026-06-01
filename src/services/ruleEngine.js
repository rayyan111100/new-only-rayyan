import { resolveField } from '../utils'

function fieldExists(value) {
  return value !== null && value !== undefined && value !== ''
}

function valueToText(value) {
  if (Array.isArray(value)) return value.join(', ')
  if (value && typeof value === 'object') return JSON.stringify(value)
  return String(value ?? '')
}

function valueParts(value) {
  if (Array.isArray(value)) return value.map(v => String(v))
  return [valueToText(value)]
}

function makeResult(matched, reason = '') {
  return { matched, reason }
}

function evalOperator(fieldVal, operator, condVal) {
  const exists = fieldExists(fieldVal)
  const fv = valueToText(fieldVal)
  const parts = valueParts(fieldVal)
  const cv = String(condVal ?? '')

  if (!exists && operator !== 'exists') {
    return makeResult(false, 'Field missing in alert')
  }

  if (operator !== 'exists' && operator !== 'regex' && cv === '') {
    return makeResult(false, 'Condition value is empty')
  }

  switch (operator) {
    case 'equals':
      return makeResult(parts.some(v => String(v) === cv), `Actual: ${fv}`)
    case 'contains':
      return makeResult(parts.some(v => String(v).toLowerCase().includes(cv.toLowerCase())), `Actual: ${fv}`)
    case 'regex': {
      if (!cv) return makeResult(false, 'Regex is empty')
      try {
        const re = new RegExp(cv, 'i')
        return makeResult(parts.some(v => re.test(String(v))), `Actual: ${fv}`)
      } catch (err) {
        return makeResult(false, `Invalid regex: ${err.message}`)
      }
    }
    case 'startsWith':
      return makeResult(parts.some(v => String(v).toLowerCase().startsWith(cv.toLowerCase())), `Actual: ${fv}`)
    case 'endsWith':
      return makeResult(parts.some(v => String(v).toLowerCase().endsWith(cv.toLowerCase())), `Actual: ${fv}`)
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      {
        const actual = Number(fv)
        const expected = Number(cv)
        if (Number.isNaN(actual)) return makeResult(false, `Actual value is not a number: ${fv}`)
        if (Number.isNaN(expected)) return makeResult(false, `Condition value is not a number: ${cv}`)
        const matched = operator === 'gt' ? actual > expected
          : operator === 'gte' ? actual >= expected
            : operator === 'lt' ? actual < expected
              : actual <= expected
        return makeResult(matched, `Actual: ${actual}`)
      }
    case 'inList': {
      const list = cv.split(',').map(s => s.trim()).filter(Boolean)
      if (!list.length) return makeResult(false, 'List is empty')
      return makeResult(parts.some(v => list.includes(String(v))), `Actual: ${fv}`)
    }
    case 'exists':
      return makeResult(exists, exists ? `Actual: ${fv}` : 'Field missing in alert')
    default:
      return makeResult(false, `Unknown operator: ${operator}`)
  }
}

export function evalCondition(condition, doc) {
  const { field, operator, value, negate } = condition
  const fieldVal = resolveField(doc, field)
  const missing = !fieldExists(fieldVal) && !['exists'].includes(operator)
  const result = evalOperator(fieldVal, operator, value)
  const matched = negate ? !result.matched : result.matched
  const reason = negate
    ? (matched ? `NOT passed because inner condition failed (${result.reason})` : `NOT failed because inner condition matched (${result.reason})`)
    : result.reason
  return { matched, missing, actual: fieldVal, reason }
}

export function evalRule(rule, doc) {
  const { conditions, conditionLogic, actions } = rule

  if (!conditions || conditions.length === 0) {
    return { matched: true, details: [], actions: actions || [] }
  }

  const results = conditions.map(c => {
    const ev = evalCondition(c, doc)
    return { condition: { ...c, missing: ev.missing }, matched: ev.matched, actual: ev.actual, reason: ev.reason }
  })

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
