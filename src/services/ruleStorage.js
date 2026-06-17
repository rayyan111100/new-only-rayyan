export const STORAGE_KEY = 'soc_rules'
export const GROUPS_KEY = 'soc_rule_groups'
export const VERSIONS_KEY = 'soc_rule_versions'
const MAX_VERSIONS = 10

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

function loadGroups() {
  try {
    const raw = localStorage.getItem(GROUPS_KEY)
    if (!raw) return []
    const d = JSON.parse(raw)
    return Array.isArray(d) ? d : []
  } catch {
    return []
  }
}

function saveGroups(groups) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
}

export function createId() {
  return 'rule_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

export function createGroupId() {
  return 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

export function getAllGroups() {
  return loadGroups()
}

export function getGroup(id) {
  return loadGroups().find(g => g.id === id)
}

export function createGroup(defaults = {}) {
  const groups = loadGroups()
  const g = {
    id: createGroupId(),
    name: defaults.name || 'New Group',
    description: defaults.description || '',
    color: defaults.color,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  groups.push(g)
  saveGroups(groups)
  return g
}

export function updateGroup(id, patch) {
  const groups = loadGroups()
  const g = groups.find(x => x.id === id)
  if (!g) return null
  Object.assign(g, patch, { updatedAt: new Date().toISOString() })
  saveGroups(groups)
  return g
}

export function deleteGroup(id) {
  const groups = loadGroups().filter(g => g.id !== id)
  saveGroups(groups)
  const rules = load().map(r => ({
    ...r,
    groupIds: (r.groupIds || []).filter(gid => gid !== id)
  }))
  save(rules)
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
    enabled: defaults.enabled !== undefined ? defaults.enabled : true,
    overwrite: defaults.overwrite !== undefined ? defaults.overwrite : true,
    conditionLogic: defaults.conditionLogic || 'AND',
    actions: defaults.actions || [{ type: 'alert', params: { severity: 'high', message: '' } }],
    conditions: defaults.conditions || [],
    groupIds: defaults.groupIds || [],
    tags: defaults.tags || [],
    frequency: defaults.frequency || 0,
    timeframe: defaults.timeframe || 0,
    timeframeUnit: defaults.timeframeUnit || 'm',
    suppression: defaults.suppression || 0,
    suppressionMax: defaults.suppressionMax || 0,
    suppressionField: defaults.suppressionField || 'agent.name',
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

// ─── Version Control ─────────────────────────────────────────

function loadVersions() {
  try {
    const raw = localStorage.getItem(VERSIONS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveVersions(map) {
  localStorage.setItem(VERSIONS_KEY, JSON.stringify(map))
}

export function getVersionHistory(ruleId) {
  const map = loadVersions()
  return (map[ruleId] || []).slice().reverse()
}

export function saveRuleWithVersion(rule, comment = '') {
  const rules = load()
  const idx = rules.findIndex(r => r.id === rule.id)
  if (idx === -1) return null
  const old = { ...rules[idx] }
  const updated = { ...rule, updatedAt: new Date().toISOString() }
  rules[idx] = updated
  save(rules)

  const map = loadVersions()
  const list = map[rule.id] || []
  const vNum = list.length + 1
  list.push({
    id: 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    ruleId: rule.id,
    snapshot: JSON.parse(JSON.stringify(old)),
    comment,
    timestamp: new Date().toISOString(),
    versionNumber: vNum
  })
  if (list.length > MAX_VERSIONS) list.splice(0, list.length - MAX_VERSIONS)
  map[rule.id] = list
  saveVersions(map)
  return updated
}

export function rollbackToVersion(ruleId, versionIndex, comment = 'Rollback') {
  const map = loadVersions()
  const list = map[ruleId]
  if (!list || versionIndex < 0 || versionIndex >= list.length) return null
  const version = list[versionIndex]
  const snapshot = JSON.parse(JSON.stringify(version.snapshot))
  const rules = load()
  const idx = rules.findIndex(r => r.id === ruleId)
  if (idx === -1) return null
  const old = { ...rules[idx] }
  const restored = { ...snapshot, updatedAt: new Date().toISOString() }
  rules[idx] = restored
  save(rules)

  const vNum = list.length + 1
  list.push({
    id: 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    ruleId,
    snapshot: JSON.parse(JSON.stringify(old)),
    comment,
    timestamp: new Date().toISOString(),
    versionNumber: vNum
  })
  if (list.length > MAX_VERSIONS) list.splice(0, list.length - MAX_VERSIONS)
  map[ruleId] = list
  saveVersions(map)
  return restored
}

export function exportVersionAsRule(ruleId, versionIndex) {
  const map = loadVersions()
  const list = map[ruleId]
  if (!list || versionIndex < 0 || versionIndex >= list.length) return null
  const snapshot = JSON.parse(JSON.stringify(list[versionIndex].snapshot))
  snapshot.id = createId()
  snapshot.name = snapshot.name + ' (v' + list[versionIndex].versionNumber + ')'
  snapshot.createdAt = new Date().toISOString()
  snapshot.updatedAt = new Date().toISOString()
  const rules = load()
  rules.push(snapshot)
  save(rules)
  return snapshot
}

export function getVersion(ruleId, versionIndex) {
  const map = loadVersions()
  const list = map[ruleId]
  if (!list || versionIndex < 0 || versionIndex >= list.length) return null
  return list[versionIndex]
}

export function updateRuleWithVersion(id, patch, comment = '') {
  const rules = load()
  const r = rules.find(x => x.id === id)
  if (!r) return null
  const old = { ...r }
  const updated = { ...r, ...patch, updatedAt: new Date().toISOString() }
  Object.assign(r, patch, { updatedAt: new Date().toISOString() })
  save(rules)

  const map = loadVersions()
  const list = map[id] || []
  const vNum = list.length + 1
  list.push({
    id: 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    ruleId: id,
    snapshot: JSON.parse(JSON.stringify(old)),
    comment,
    timestamp: new Date().toISOString(),
    versionNumber: vNum
  })
  if (list.length > MAX_VERSIONS) list.splice(0, list.length - MAX_VERSIONS)
  map[id] = list
  saveVersions(map)
  return updated
}
