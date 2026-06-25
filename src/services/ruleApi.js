import { api, apiPost, apiPut, apiDelete } from '../api'

// ─── Rules ───

export async function getAllRules() {
  try { return await api('rules') } catch { return [] }
}

export async function getRule(id) {
  try { return await api(`rules/${id}`) } catch { return null }
}

export async function createRule(data) {
  const r = await apiPost('rules', data)
  return r
}

export async function updateRule(id, data) {
  return await apiPut(`rules/${id}`, data)
}

export async function deleteRule(id) {
  return await apiDelete(`rules/${id}`)
}

export async function toggleRuleEnabled(id) {
  return await apiPost(`rules/${id}/toggle`)
}

// ─── Versions ───

export async function getVersionHistory(ruleId) {
  try { return await api(`rules/${ruleId}/versions`) } catch { return [] }
}

export async function saveVersion(ruleId, comment = '') {
  return await apiPost(`rules/${ruleId}/versions`, { comment })
}

export async function rollbackToVersion(ruleId, versionNumber) {
  return await apiPost(`rules/${ruleId}/rollback/${versionNumber}`)
}

// ─── Groups ───

export async function getAllGroups() {
  try { return await api('rules/groups') } catch { return [] }
}

export async function createGroup(data) {
  return await apiPost('rules/groups', data)
}

export async function updateGroup(id, data) {
  return await apiPut(`rules/groups/${id}`, data)
}

export async function deleteGroup(id) {
  return await apiDelete(`rules/groups/${id}`)
}

// ─── Evaluation ───

export async function evaluateRule(ruleId, doc) {
  return await apiPost(`rules/${ruleId}/evaluate`, { doc })
}

export async function evaluateAllRules(doc) {
  return await apiPost('rules/evaluate-all', { doc })
}

export async function batchEvaluateRules(docs) {
  return await apiPost('rules/batch-evaluate', { docs })
}

// ─── Decoders ───

export async function getAllDecoders() {
  try { return await api('decoders') } catch { return [] }
}

export async function getDecoder(id) {
  try { return await api(`decoders/${id}`) } catch { return null }
}

export async function createDecoder(data) {
  return await apiPost('decoders', data)
}

export async function updateDecoder(id, data) {
  return await apiPut(`decoders/${id}`, data)
}

export async function deleteDecoder(id) {
  return await apiDelete(`decoders/${id}`)
}
