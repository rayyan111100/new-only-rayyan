import { createId, getAllRules } from './ruleStorage'

export const VERSIONS_KEY = 'soc_rule_versions'
const MAX_VERSIONS = 10
const RULES_KEY = 'soc_rules'

function loadRules() {
  try {
    const raw = localStorage.getItem(RULES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : (parsed.rules || [])
  } catch {
    return []
  }
}

function saveRules(rules) {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules))
}

function loadVersions() {
  try {
    const raw = localStorage.getItem(VERSIONS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function saveVersions(map) {
  localStorage.setItem(VERSIONS_KEY, JSON.stringify(map))
}

function appendVersion(ruleId, snapshot, comment, map = loadVersions()) {
  const list = map[ruleId] || []
  list.push({
    id: 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    ruleId,
    snapshot: JSON.parse(JSON.stringify(snapshot)),
    comment,
    timestamp: new Date().toISOString(),
    versionNumber: list.length + 1
  })
  if (list.length > MAX_VERSIONS) list.splice(0, list.length - MAX_VERSIONS)
  map[ruleId] = list
  saveVersions(map)
}

export function getVersionHistory(ruleId) {
  const map = loadVersions()
  return (map[ruleId] || []).slice().reverse()
}

export function getVersion(ruleId, versionIndex) {
  const map = loadVersions()
  const list = map[ruleId]
  if (!list || versionIndex < 0 || versionIndex >= list.length) return null
  return list[versionIndex]
}

export function saveRuleWithVersion(rule, comment = '') {
  const rules = loadRules()
  const idx = rules.findIndex(r => r.id === rule.id)
  if (idx === -1) return null
  const previous = { ...rules[idx] }
  const updated = { ...rule, updatedAt: new Date().toISOString() }
  rules[idx] = updated
  saveRules(rules)
  appendVersion(rule.id, previous, comment)
  return updated
}

export function updateRuleWithVersion(id, patch, comment = '') {
  const rule = getAllRules().find(r => r.id === id)
  if (!rule) return null
  return saveRuleWithVersion({ ...rule, ...patch }, comment)
}

export function rollbackToVersion(ruleId, versionIndex, comment = 'Rollback') {
  const map = loadVersions()
  const list = map[ruleId]
  if (!list || versionIndex < 0 || versionIndex >= list.length) return null
  const rules = loadRules()
  const idx = rules.findIndex(r => r.id === ruleId)
  if (idx === -1) return null
  const previous = { ...rules[idx] }
  const restored = { ...JSON.parse(JSON.stringify(list[versionIndex].snapshot)), updatedAt: new Date().toISOString() }
  rules[idx] = restored
  saveRules(rules)
  appendVersion(ruleId, previous, comment, map)
  return restored
}

export function exportVersionAsRule(ruleId, versionIndex) {
  const version = getVersion(ruleId, versionIndex)
  if (!version) return null
  const snapshot = JSON.parse(JSON.stringify(version.snapshot))
  const exported = {
    ...snapshot,
    id: createId(),
    name: `${snapshot.name} (v${version.versionNumber})`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  const rules = loadRules()
  rules.push(exported)
  saveRules(rules)
  return exported
}
