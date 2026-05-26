const STORAGE_KEY = 'soc_rules'
const EMPTY = { groups: [], rules: [] }

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { groups: [], rules: [] }
  } catch {
    return { groups: [], rules: [] }
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function createId() {
  return 'rule_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

export function getGroups() {
  return load().groups
}

export function getRulesForGroup(groupId) {
  const d = load()
  return d.rules.filter(r => r.groupId === groupId).sort((a, b) => b.priority - a.priority)
}

export function getAllRules() {
  return load().rules
}

export function getRule(id) {
  return load().rules.find(r => r.id === id)
}

export function createGroup(name) {
  const d = load()
  const g = {
    id: createId(),
    name,
    description: '',
    order: d.groups.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  d.groups.push(g)
  save(d)
  return g
}

export function updateGroup(id, patch) {
  const d = load()
  const g = d.groups.find(x => x.id === id)
  if (!g) return null
  Object.assign(g, patch, { updatedAt: new Date().toISOString() })
  save(d)
  return g
}

export function deleteGroup(id) {
  const d = load()
  d.groups = d.groups.filter(g => g.id !== id)
  d.rules = d.rules.filter(r => r.groupId !== id)
  save(d)
}

export function createRule(groupId, defaults = {}) {
  const d = load()
  const r = {
    id: createId(),
    groupId,
    name: defaults.name || 'New Rule',
    description: defaults.description || '',
    enabled: true,
    priority: 100,
    overwrite: false,
    conditionLogic: 'AND',
    conditions: [],
    ignoreIps: [],
    actions: [{ type: 'alert', params: { severity: 'high', message: '' } }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  d.rules.push(r)
  save(d)
  return r
}

export function updateRule(id, patch) {
  const d = load()
  const r = d.rules.find(x => x.id === id)
  if (!r) return null
  Object.assign(r, patch, { updatedAt: new Date().toISOString() })
  save(d)
  return r
}

export function deleteRule(id) {
  const d = load()
  d.rules = d.rules.filter(r => r.id !== id)
  save(d)
}

export function toggleRuleEnabled(id) {
  const d = load()
  const r = d.rules.find(x => x.id === id)
  if (!r) return null
  r.enabled = !r.enabled
  r.updatedAt = new Date().toISOString()
  save(d)
  return r
}
