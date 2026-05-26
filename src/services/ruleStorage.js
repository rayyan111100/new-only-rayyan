const STORAGE_KEY = 'soc_rules'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const d = JSON.parse(raw)
    return Array.isArray(d) ? d : (d.rules || [])
  } catch {
    return []
  }
}

function save(rules) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

export function createId() {
  return 'rule_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

export function getAllRules() {
  return load()
}

export function getRule(id) {
  return load().find(r => r.id === id)
}

export function createRule(defaults = {}) {
  const rules = load()
  const r = {
    id: createId(),
    name: defaults.name || 'New Rule',
    enabled: true,
    conditionLogic: 'AND',
    conditions: [],
    ignoreIps: [],
    actions: [{ type: 'alert', params: { severity: 'high', level: null, message: '' } }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  rules.push(r)
  save(rules)
  return r
}

export function updateRule(id, patch) {
  const rules = load()
  const r = rules.find(x => x.id === id)
  if (!r) return null
  Object.assign(r, patch, { updatedAt: new Date().toISOString() })
  save(rules)
  return r
}

export function deleteRule(id) {
  save(load().filter(r => r.id !== id))
}

export function toggleRuleEnabled(id) {
  const rules = load()
  const r = rules.find(x => x.id === id)
  if (!r) return null
  r.enabled = !r.enabled
  r.updatedAt = new Date().toISOString()
  save(rules)
  return r
}
