import {
  getAllGroups as storageGetAllGroups,
  getGroup,
  createGroup as storageCreateGroup,
  updateGroup as storageUpdateGroup,
  deleteGroup as storageDeleteGroup,
  getAllRules,
  getRule,
  updateRule
} from './ruleStorage'

export function getAllGroups() {
  return storageGetAllGroups()
}

export function createGroup(name, description, color) {
  return storageCreateGroup({ name, description, color })
}

export function updateGroup(id, updates) {
  return storageUpdateGroup(id, updates)
}

export function deleteGroup(id) {
  storageDeleteGroup(id)
}

export function getRulesByGroup(groupId) {
  return getAllRules().filter(r => (r.groupIds || []).includes(groupId))
}

export function addRulesToGroup(groupId, ruleIds) {
  const group = getGroup(groupId)
  if (!group) return []
  const updated = []
  for (const ruleId of ruleIds) {
    const rule = getRule(ruleId)
    if (!rule) continue
    const groupIds = rule.groupIds || []
    if (!groupIds.includes(groupId)) {
      updateRule(ruleId, { groupIds: [...groupIds, groupId] })
      updated.push(ruleId)
    }
  }
  return updated
}

export function removeRulesFromGroup(groupId, ruleIds) {
  const updated = []
  for (const ruleId of ruleIds) {
    const rule = getRule(ruleId)
    if (!rule) continue
    const groupIds = (rule.groupIds || []).filter(gid => gid !== groupId)
    if (groupIds.length !== (rule.groupIds || []).length) {
      updateRule(ruleId, { groupIds })
      updated.push(ruleId)
    }
  }
  return updated
}

export function moveRulesToGroup(sourceGroupId, targetGroupId, ruleIds) {
  const sourceGroup = getGroup(sourceGroupId)
  const targetGroup = getGroup(targetGroupId)
  if (!sourceGroup || !targetGroup) return []
  const updated = []
  for (const ruleId of ruleIds) {
    const rule = getRule(ruleId)
    if (!rule) continue
    const groupIds = (rule.groupIds || [])
      .filter(gid => gid !== sourceGroupId)
    if (!groupIds.includes(targetGroupId)) {
      groupIds.push(targetGroupId)
    }
    if (groupIds.length !== (rule.groupIds || []).length) {
      updateRule(ruleId, { groupIds })
      updated.push(ruleId)
    }
  }
  return updated
}

export function getGroupStats() {
  const groups = storageGetAllGroups()
  const rules = getAllRules()
  return groups.map(g => {
    const groupRules = rules.filter(r => (r.groupIds || []).includes(g.id))
    return {
      ...g,
      ruleCount: groupRules.length,
      enabledCount: groupRules.filter(r => r.enabled).length,
      disabledCount: groupRules.filter(r => !r.enabled).length
    }
  })
}
