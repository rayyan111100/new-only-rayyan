function resolveField(obj, path) {
  try { return path.split('.').reduce((o, k) => o?.[k], obj) ?? '' }
  catch { return '' }
}

function evalOperator(fieldVal, operator, condVal) {
  const fv = String(fieldVal ?? '')
  switch (operator) {
    case 'equals': return fv === String(condVal)
    case 'contains': return fv.toLowerCase().includes(String(condVal).toLowerCase())
    case 'regex': {
      try { return new RegExp(condVal).test(fv) }
      catch { return false }
    }
    case 'startsWith': return fv.toLowerCase().startsWith(String(condVal).toLowerCase())
    case 'endsWith': return fv.toLowerCase().endsWith(String(condVal).toLowerCase())
    case 'gt': return Number(fieldVal) > Number(condVal)
    case 'gte': return Number(fieldVal) >= Number(condVal)
    case 'lt': return Number(fieldVal) < Number(condVal)
    case 'lte': return Number(fieldVal) <= Number(condVal)
    case 'inList': {
      const list = String(condVal).split(',').map(s => s.trim()).filter(Boolean)
      return list.some(item => fv === item)
    }
    case 'exists': return fieldVal !== null && fieldVal !== undefined && fieldVal !== ''
    default: return fv === String(condVal)
  }
}

function evalCondition(condition, doc) {
  const { field, operator = 'equals', value, negate = false } = condition
  const actual = resolveField(doc, field)
  const missing = actual === '' || actual === null || actual === undefined
  if (operator === 'exists') {
    const matched = !missing
    return { matched: negate ? !matched : matched, missing, actual, reason: `${field} ${matched ? 'exists' : 'missing'}` }
  }
  if (missing) return { matched: false, missing, actual, reason: `${field} is missing` }
  const result = evalOperator(actual, operator, value)
  const matched = negate ? !result : result
  return { matched, missing: false, actual, reason: `${field} ${operator} "${value}" → ${actual}` }
}

function evalConditionGroup(group, doc) {
  const items = group.conditions || []
  if (!items.length) return { matched: false, details: [], reason: 'Empty group' }
  const logic = group.logic || 'AND'
  const details = []
  for (const item of items) {
    let result
    if (item.type === 'group') result = evalConditionGroup(item, doc)
    else result = evalCondition(item, doc)
    details.push(result)
    if (logic === 'AND' && !result.matched) return { matched: false, details, reason: `AND fail at ${item.field || 'group'}` }
    if (logic === 'OR' && result.matched) return { matched: true, details, reason: `OR pass at ${item.field || 'group'}` }
  }
  const matched = logic === 'AND' ? details.every(d => d.matched) : details.some(d => d.matched)
  return { matched, details, reason: `${logic}: ${matched ? 'ALL' : 'SOME'} matched` }
}

function evalRule(rule, doc) {
  const conditions = rule.conditions || []
  if (!conditions.length) return { matched: false, details: [], actions: rule.actions || [] }
  const logic = rule.conditionLogic || 'AND'
  const details = []
  for (const item of conditions) {
    let result
    if (item.type === 'group') result = evalConditionGroup(item, doc)
    else result = evalCondition(item, doc)
    details.push(result)
    if (logic === 'AND' && !result.matched) return { matched: false, details, actions: rule.actions || [] }
    if (logic === 'OR' && result.matched) return { matched: true, details, actions: rule.actions || [] }
  }
  const matched = logic === 'AND' ? details.every(d => d.matched) : details.some(d => d.matched)
  return { matched, details, actions: rule.actions || [] }
}

function evaluateAllRules(rules, doc) {
  const enabled = rules.filter(r => r.enabled)
  if (!enabled.length) return { matched: false, matches: [], actions: [] }
  const matches = []
  const seen = new Set()
  for (const rule of enabled) {
    const result = evalRule(rule, doc)
    if (result.matched) {
      const ruleActions = (rule.actions || []).map(a => ({
        ...a,
        ruleId: rule.id,
        ruleName: rule.name,
        rulePriority: rule.priority || 0,
        overwrite: rule.overwrite !== false
      }))
      matches.push({ rule, result, actions: ruleActions })
      for (const a of ruleActions) {
        const key = `${a.type}:${a.ruleId}`
        if (!seen.has(key)) seen.add(key)
      }
    }
  }
  return { matched: matches.length > 0, matches, actions: [...seen].map(k => k.split(':').pop()) }
}

function interpolateMessage(template, doc) {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => String(resolveField(doc, key.trim()) ?? ''))
}

module.exports = { evalCondition, evalConditionGroup, evalRule, evaluateAllRules, interpolateMessage, resolveField }
