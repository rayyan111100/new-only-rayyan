import {
  getAllRules, getRule, updateRule, createRule,
  getAllGroups, getGroup, updateGroup, createGroup
} from './ruleStorage'
import { STORAGE_KEY, GROUPS_KEY } from './ruleStorage'

function rawLoad(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function rawSave(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

function rawRemove(key) {
  localStorage.removeItem(key)
}

export function migrateRules() {
  const rules = getAllRules()
  let migrated = 0
  const updated = rules.map(r => {
    if (!r.groupIds) { migrated++; return { ...r, groupIds: [] } }
    return r
  })
  if (migrated > 0) {
    rawSave(STORAGE_KEY, updated)
  }
  return migrated
}

export function backupGroups() {
  return { data: getAllGroups(), exportedAt: new Date().toISOString(), version: 1 }
}

export function backupRules() {
  return { data: getAllRules(), exportedAt: new Date().toISOString(), version: 1 }
}

export function fullBackup() {
  return {
    groups: backupGroups(),
    rules: backupRules(),
    exportedAt: new Date().toISOString(),
    version: 1
  }
}

export function restoreGroups(data) {
  const groups = data?.data || data
  if (!Array.isArray(groups)) return 0
  const existing = getAllGroups()
  const existingIds = new Set(existing.map(g => g.id))
  let restored = 0
  for (const g of groups) {
    if (!g.id || !g.name) continue
    if (existingIds.has(g.id)) {
      updateGroup(g.id, {
        name: g.name, description: g.description || '',
        color: g.color, createdAt: g.createdAt
      })
    } else {
      createGroup({ ...g, id: g.id })
    }
    restored++
  }
  return restored
}

export function restoreRules(data) {
  const rules = data?.data || data
  if (!Array.isArray(rules)) return 0
  const existing = getAllRules()
  const existingMap = new Map(existing.map(r => [r.id, r]))
  let restored = 0
  for (const r of rules) {
    if (!r.id || !r.name) continue
    const safe = { ...r, groupIds: r.groupIds || [] }
    if (existingMap.has(r.id)) {
      updateRule(r.id, safe)
    } else {
      const created = createRule({ ...safe, id: r.id })
      Object.assign(created, safe)
    }
    restored++
  }
  return restored
}

export function fullRestore(data) {
  if (!data || !data.groups || !data.rules) return { groups: 0, rules: 0 }
  const gCount = restoreGroups(data.groups)
  const rCount = restoreRules(data.rules)
  return { groups: gCount, rules: rCount }
}

const AUTOSAVE_DEBOUNCE_MS = 300
let autoSaveTimers = {}

export function debouncedAutoSave(key, data, onSave) {
  if (autoSaveTimers[key]) clearTimeout(autoSaveTimers[key])
  autoSaveTimers[key] = setTimeout(() => {
    onSave(data)
    delete autoSaveTimers[key]
  }, AUTOSAVE_DEBOUNCE_MS)
}

export function flushAutoSaves() {
  for (const key of Object.keys(autoSaveTimers)) {
    clearTimeout(autoSaveTimers[key])
    delete autoSaveTimers[key]
  }
}

export function resolveConflicts(localRules, remoteRules, strategy = 'timestamp') {
  const localMap = new Map(localRules.map(r => [r.id, r]))
  const remoteMap = new Map(remoteRules.map(r => [r.id, r]))
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])
  const resolved = []

  for (const id of allIds) {
    const local = localMap.get(id)
    const remote = remoteMap.get(id)

    if (!local && remote) {
      resolved.push(remote)
    } else if (local && !remote) {
      resolved.push(local)
    } else if (local && remote) {
      switch (strategy) {
        case 'timestamp': {
          const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime()
          const remoteTime = new Date(remote.updatedAt || remote.createdAt || 0).getTime()
          resolved.push(localTime >= remoteTime ? local : remote)
          break
        }
        case 'local': {
          resolved.push(local)
          break
        }
        case 'remote': {
          resolved.push(remote)
          break
        }
        case 'merge': {
          resolved.push({
            ...remote,
            groupIds: [...new Set([...(local.groupIds || []), ...(remote.groupIds || [])])],
            conditions: remote.conditions || local.conditions || [],
            actions: remote.actions || local.actions || [],
            updatedAt: new Date().toISOString()
          })
          break
        }
        default:
          resolved.push(local)
      }
    }
  }

  return resolved
}

export function resolveGroupConflicts(localGroups, remoteGroups, strategy = 'timestamp') {
  const localMap = new Map(localGroups.map(g => [g.id, g]))
  const remoteMap = new Map(remoteGroups.map(g => [g.id, g]))
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])
  const resolved = []

  for (const id of allIds) {
    const local = localMap.get(id)
    const remote = remoteMap.get(id)

    if (!local && remote) {
      resolved.push(remote)
    } else if (local && !remote) {
      resolved.push(local)
    } else if (local && remote) {
      switch (strategy) {
        case 'timestamp': {
          const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime()
          const remoteTime = new Date(remote.updatedAt || remote.createdAt || 0).getTime()
          resolved.push(localTime >= remoteTime ? local : remote)
          break
        }
        case 'local':
          resolved.push(local)
          break
        case 'remote':
          resolved.push(remote)
          break
        case 'merge':
          resolved.push({
            ...remote,
            name: local.name || remote.name,
            description: local.description || remote.description,
            color: local.color || remote.color,
            updatedAt: new Date().toISOString()
          })
          break
        default:
          resolved.push(local)
      }
    }
  }

  return resolved
}

export function getStorageInfo() {
  const rulesRaw = rawLoad(STORAGE_KEY)
  const groupsRaw = rawLoad(GROUPS_KEY)
  const rules = Array.isArray(rulesRaw) ? rulesRaw : (rulesRaw?.rules || [])
  const groups = Array.isArray(groupsRaw) ? groupsRaw : []
  return {
    ruleCount: rules.length,
    groupCount: groups.length,
    rulesSize: new Blob([JSON.stringify(rulesRaw)]).size,
    groupsSize: new Blob([JSON.stringify(groupsRaw)]).size,
    rulesWithGroups: rules.filter(r => r.groupIds && r.groupIds.length > 0).length,
    orphanGroupIds: findOrphanGroupIds(rules, groups)
  }
}

function findOrphanGroupIds(rules, groups) {
  const validGroupIds = new Set(groups.map(g => g.id))
  const referencedIds = new Set()
  for (const r of rules) {
    for (const gid of (r.groupIds || [])) referencedIds.add(gid)
  }
  const orphans = [...referencedIds].filter(id => !validGroupIds.has(id))
  return orphans
}

export function cleanOrphanGroupIds() {
  const rules = getAllRules()
  const groups = getAllGroups()
  const validIds = new Set(groups.map(g => g.id))
  let cleaned = 0
  const updated = rules.map(r => {
    const original = r.groupIds || []
    const filtered = original.filter(gid => validIds.has(gid))
    if (filtered.length !== original.length) {
      cleaned++
      return { ...r, groupIds: filtered }
    }
    return r
  })
  if (cleaned > 0) rawSave(STORAGE_KEY, updated)
  return cleaned
}
