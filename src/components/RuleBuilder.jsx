import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getGroups, getRulesForGroup, getAllRules,
  createGroup, updateGroup, deleteGroup,
  createRule, updateRule, deleteRule, toggleRuleEnabled,
  createId
} from '../services/ruleStorage'
import { evalRule, interpolateMessage } from '../services/ruleEngine'
import { resolveField } from '../utils'
import { api } from '../api'

const FIELDS = [
  { value: 'rule.description', label: 'rule.description' },
  { value: 'rule.id', label: 'rule.id' },
  { value: 'rule.level', label: 'rule.level' },
  { value: 'rule.category', label: 'rule.category' },
  { value: 'agent.name', label: 'agent.name' },
  { value: 'agent.id', label: 'agent.id' },
  { value: 'data.srcip', label: 'data.srcip' },
  { value: 'data.dstip', label: 'data.dstip' },
  { value: 'data.url', label: 'data.url' },
  { value: 'location', label: 'location' }
]

const OPERATORS = ['equals', 'contains', 'regex', 'startsWith', 'endsWith', 'gt', 'lt', 'inList', 'exists']
const ACTIONS = ['alert', 'tag', 'ignore']
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info']

function cleanRule(r) {
  return {
    ...r,
    name: r.name || '',
    description: r.description || '',
    conditions: (r.conditions || []).map(c => ({
      ...c,
      field: c.field || 'rule.description',
      operator: c.operator || 'contains',
      value: c.value || '',
      negate: !!c.negate
    })),
    ignoreIps: r.ignoreIps || [],
    actions: (r.actions || []).map(a => ({
      ...a,
      type: a.type || 'alert',
      params: a.params || { severity: 'high', message: '' }
    })),
    conditionLogic: r.conditionLogic === 'OR' ? 'OR' : 'AND',
    priority: r.priority ?? 100,
    overwrite: !!r.overwrite,
    enabled: r.enabled !== false
  }
}

export default function RuleBuilder() {
  const [groups, setGroups] = useState([])
  const [openGroupId, setOpenGroupId] = useState(null)
  const [selectedRuleId, setSelectedRuleId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [testData, setTestData] = useState(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testResults, setTestResults] = useState(null)
  const [showTest, setShowTest] = useState(false)
  const [showOverview, setShowOverview] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [batchTestResults, setBatchTestResults] = useState(null)
  const [batchTestLoading, setBatchTestLoading] = useState(false)

  const refresh = useCallback(() => {
    setGroups(getGroups())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  function handleSelectRule(id) {
    if (dirty && editing) {
      updateRule(editing.id, editing)
    }
    setSelectedRuleId(id)
    const r = getRulesForGroup(openGroupId).find(x => x.id === id)
    setEditing(r ? cleanRule(JSON.parse(JSON.stringify(r))) : null)
    setDirty(false)
  }

  function handleNewRule() {
    if (!openGroupId) return
    const r = createRule(openGroupId, { name: 'New Rule' })
    refresh()
    const rules = getRulesForGroup(openGroupId)
    setSelectedRuleId(r.id)
    setEditing(cleanRule(JSON.parse(JSON.stringify(r))))
    setDirty(false)
  }

  function handleSave() {
    if (!editing || !editing.id) return
    updateRule(editing.id, editing)
    setDirty(false)
    refresh()
  }

  function handleDelete() {
    if (!editing || !editing.id) return
    deleteRule(editing.id)
    setSelectedRuleId(null)
    setEditing(null)
    setDirty(false)
    refresh()
  }

  function patchEditing(patch) {
    setEditing(prev => prev ? { ...prev, ...patch } : null)
    setDirty(true)
  }

  function addCondition() {
    setEditing(prev => {
      if (!prev) return prev
      return {
        ...prev,
        conditions: [...prev.conditions, { id: 'c_' + Date.now(), field: 'rule.description', operator: 'contains', value: '', negate: false }]
      }
    })
    setDirty(true)
  }

  function updateCondition(idx, patch) {
    setEditing(prev => {
      if (!prev) return prev
      const conds = [...prev.conditions]
      conds[idx] = { ...conds[idx], ...patch }
      return { ...prev, conditions: conds }
    })
    setDirty(true)
  }

  function removeCondition(idx) {
    setEditing(prev => {
      if (!prev) return prev
      return { ...prev, conditions: prev.conditions.filter((_, i) => i !== idx) }
    })
    setDirty(true)
  }

  function addIgnoreIp(ip) {
    if (!editing || !ip.trim()) return
    setEditing(prev => ({
      ...prev,
      ignoreIps: [...(prev?.ignoreIps || []), ip.trim()]
    }))
    setDirty(true)
  }

  function removeIgnoreIp(idx) {
    setEditing(prev => ({
      ...prev,
      ignoreIps: (prev?.ignoreIps || []).filter((_, i) => i !== idx)
    }))
    setDirty(true)
  }

  function addAction() {
    setEditing(prev => {
      if (!prev) return prev
      return {
        ...prev,
        actions: [...prev.actions, { type: 'alert', params: { severity: 'high', message: '' } }]
      }
    })
    setDirty(true)
  }

  function updateAction(idx, patch) {
    setEditing(prev => {
      if (!prev) return prev
      const acts = [...prev.actions]
      acts[idx] = { ...acts[idx], ...patch }
      return { ...prev, actions: acts }
    })
    setDirty(true)
  }

  function removeAction(idx) {
    setEditing(prev => {
      if (!prev) return prev
      return { ...prev, actions: prev.actions.filter((_, i) => i !== idx) }
    })
    setDirty(true)
  }

  function computeSeverity(act, doc) {
    if (!act.useEventLevel) return act.params?.severity || 'high'
    const lvl = parseInt(resolveField(doc, 'rule.level'))
    if (isNaN(lvl)) return act.params?.severity || 'high'
    if (lvl >= 12) return 'critical'
    if (lvl >= 8) return 'high'
    if (lvl >= 5) return 'medium'
    if (lvl >= 3) return 'low'
    return 'info'
  }

  async function runTest() {
    if (!editing) return
    setTestLoading(true)
    setTestResults(null)
    try {
      const d = await api('search', { limit: 50, sort: '@timestamp', order: 'desc' })
      setTestData(d.results || [])
      const results = (d.results || []).map(doc => {
        const result = evalRule(editing, doc)
        const eventLevel = resolveField(doc, 'rule.level')
        const actions = result.matched ? (editing.actions || []).map(a => ({
          ...a,
          computedSeverity: a.type === 'alert' ? computeSeverity(a, doc) : null,
          interpolated: a.type === 'alert' ? interpolateMessage(a.params?.message || '', doc) : null
        })) : []
        return {
          timestamp: resolveField(doc, '@timestamp'),
          ruleDesc: resolveField(doc, 'rule.description'),
          ruleLevel: resolveField(doc, 'rule.level'),
          agentName: resolveField(doc, 'agent.name'),
          ...result,
          actions
        }
      })
      setTestResults(results)
      setShowTest(true)
    } catch (e) {
      setTestResults({ error: e.message })
    } finally {
      setTestLoading(false)
    }
  }

  function handleDuplicate() {
    if (!editing) return
    const copy = JSON.parse(JSON.stringify(editing))
    copy.id = createId()
    copy.name = editing.name + ' (copy)'
    copy.enabled = false
    updateRule(copy.id, copy)
    refresh()
    setSelectedRuleId(copy.id)
    setEditing(cleanRule(copy))
    setDirty(false)
  }

  function handleExport() {
    const data = { groups: getGroups(), rules: getAllRules() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'soc_rules_export.json'; a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (!data.groups || !data.rules) throw new Error('Invalid format')
        localStorage.setItem('soc_rules', JSON.stringify(data))
        refresh()
        alert(`Imported ${data.rules.length} rules in ${data.groups.length} groups`)
      } catch (err) { alert('Import failed: ' + err.message) }
    }
    reader.readAsText(file)
  }

  async function runBatchTest() {
    setBatchTestLoading(true)
    setBatchTestResults(null)
    try {
      const enabledRules = getAllRules().filter(r => r.enabled)
      if (!enabledRules.length) { setBatchTestResults({ error: 'No enabled rules to test' }); setBatchTestLoading(false); return }
      const d = await api('search', { limit: 50, sort: '@timestamp', order: 'desc' })
      const alerts = d.results || []
      const perRule = enabledRules.map(rule => {
        const matched = alerts.filter(a => evalRule(rule, a).matched).length
        return { id: rule.id, name: rule.name, groupId: rule.groupId, matched, total: alerts.length, pct: alerts.length ? ((matched / alerts.length) * 100).toFixed(0) : '0', overwrite: rule.overwrite, priority: rule.priority }
      })
      perRule.sort((a, b) => b.matched - a.matched)

      const totalMatches = new Set()
      const overwriteMap = {}
      for (const alert of alerts) {
        const matching = enabledRules.filter(r => { const result = evalRule(r, alert); totalMatches.add(r.id); return result.matched })
        const sorted = matching.sort((a, b) => b.priority - a.priority)
        const winner = sorted.find(r => r.overwrite) || sorted[0]
        if (winner) overwriteMap[winner.id] = (overwriteMap[winner.id] || 0) + 1
      }

      setBatchTestResults({ perRule, alertsCount: alerts.length, totalRules: enabledRules.length, overwriteMap })
    } catch (e) { setBatchTestResults({ error: e.message }) }
    setBatchTestLoading(false)
  }

  function getDashboardStats() {
    const a = getAllRules()
    const g = getGroups()
    const enabled = a.filter(r => r.enabled)
    const byGroup = g.map(gr => ({ name: gr.name, count: a.filter(r => r.groupId === gr.id).length, enabled: enabled.filter(r => r.groupId === gr.id).length })).filter(x => x.count > 0)
    const byPriority = { low: a.filter(r => r.priority < 50).length, medium: a.filter(r => r.priority >= 50 && r.priority <= 200).length, high: a.filter(r => r.priority > 200).length }
    const byAction = {}
    for (const r of a) { const t = r.actions?.[0]?.type || '-'; byAction[t] = (byAction[t] || 0) + 1 }
    const overwriteCount = a.filter(r => r.overwrite).length
    return { total: a.length, enabled: enabled.length, disabled: a.length - enabled.length, groups: g.length, byGroup, byPriority, byAction, overwriteCount }
  }

  const selectedGroup = groups.find(g => g.id === openGroupId)
  const rulesList = openGroupId ? getRulesForGroup(openGroupId) : []
  const allRules = getAllRules()

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-1 py-2 text-xs border-b border-[#e5e7eb] dark:border-[#2d3140]">
        <span className="font-semibold text-soc-stext dark:text-soc-darkstext">Rules Engine</span>
        <span className="text-[#9ca3af] dark:text-[#6b7280]">{allRules.length} rules, {allRules.filter(r => r.enabled).length} enabled</span>
        <button
          onClick={() => setShowOverview(!showOverview)}
          className={`gbtn text-xs ${showOverview ? 'gbtn-primary' : ''}`}
        >
          {showOverview ? '\u270E Editor' : '\uD83D\uDCCB'}
        </button>
        <button onClick={() => setShowDashboard(true)} className="gbtn text-xs">📊 Stats</button>
        <button onClick={handleExport} className="gbtn text-xs">📤 Export</button>
        <label className="gbtn text-xs cursor-pointer">
          📥 Import
          <input type="file" accept=".json" onChange={e => handleImport(e.target.files?.[0])} className="hidden" />
        </label>
      </div>
      {showDashboard && (
        <div className="border-b border-[#e5e7eb] dark:border-[#2d3140] p-3 bg-[#f9fafb] dark:bg-[#1a1c23]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-semibold text-[#9ca3af] dark:text-[#6b7280]">Rules Dashboard</span>
            <button onClick={() => setShowDashboard(false)} className="text-[#9ca3af] hover:text-soc-blue text-xs">✕</button>
          </div>
          {(() => {
            const s = getDashboardStats()
            return (
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="gcard p-2 text-center">
                  <div className="text-lg font-bold text-soc-stext dark:text-soc-darkstext">{s.total}</div>
                  <div className="text-[10px] text-[#9ca3af]">Total Rules</div>
                </div>
                <div className="gcard p-2 text-center">
                  <div className="text-lg font-bold text-green-600">{s.enabled}</div>
                  <div className="text-[10px] text-[#9ca3af]">Enabled</div>
                </div>
                <div className="gcard p-2 text-center">
                  <div className="text-lg font-bold text-[#9ca3af]">{s.disabled}</div>
                  <div className="text-[10px] text-[#9ca3af]">Disabled</div>
                </div>
                <div className="gcard p-2 text-center">
                  <div className="text-lg font-bold text-amber-500">{s.overwriteCount}</div>
                  <div className="text-[10px] text-[#9ca3af]">Overwrite</div>
                </div>
                <div className="gcard p-2 col-span-2">
                  <div className="text-[10px] font-semibold text-[#9ca3af] mb-1">By Group</div>
                  {s.byGroup.map(g => (
                    <div key={g.name} className="flex items-center gap-2 text-[11px]">
                      <span className="flex-1 truncate">{g.name}</span>
                      <span className="text-green-600">{g.enabled}</span>
                      <span className="text-[#9ca3af]">/ {g.count}</span>
                    </div>
                  ))}
                </div>
                <div className="gcard p-2 col-span-2">
                  <div className="text-[10px] font-semibold text-[#9ca3af] mb-1">By Priority</div>
                  <div className="flex items-center gap-2 text-[11px]">{'Low (<50):'} <span className="font-bold">{s.byPriority.low}</span></div>
                  <div className="flex items-center gap-2 text-[11px]">{'Medium (50-200):'} <span className="font-bold">{s.byPriority.medium}</span></div>
                  <div className="flex items-center gap-2 text-[11px]">{'High (>200):'} <span className="font-bold">{s.byPriority.high}</span></div>
                </div>
              </div>
            )
          })()}
        </div>
      )}
      {showOverview && (
        <div className="border-b border-[#e5e7eb] dark:border-[#2d3140] p-2 bg-[#f9fafb] dark:bg-[#1a1c23]">
          <div className="max-h-48 overflow-y-auto space-y-0.5 text-xs">
            {allRules.length === 0 && <div className="text-[#9ca3af] text-center py-4">No rules yet</div>}
            {allRules.map(r => {
              const g = groups.find(x => x.id === r.groupId)
              return (
                <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white dark:hover:bg-[#2d3140]">
                  <button
                    onClick={() => { toggleRuleEnabled(r.id); refresh(); if (editing?.id === r.id) patchEditing({ enabled: !r.enabled }) }}
                    className={`w-2 h-2 rounded-full shrink-0 ${r.enabled ? 'bg-green-500' : 'bg-[#9ca3af]'}`}
                    title={r.enabled ? 'Disable' : 'Enable'}
                  />
                  <span className="w-14 text-[10px] text-[#6b7280] truncate">{g?.name || '?'}</span>
                  <button
                    onClick={() => { setOpenGroupId(r.groupId); setSelectedRuleId(r.id); setEditing(cleanRule(JSON.parse(JSON.stringify(r)))); setShowOverview(false); setDirty(false) }}
                    className="flex-1 text-left truncate text-soc-stext dark:text-soc-darkstext hover:text-soc-blue"
                  >
                    {r.name}
                  </button>
                  <span className="text-[#9ca3af] shrink-0 text-[10px]">P:{r.priority}</span>
                  {r.overwrite && <span className="text-[9px] text-amber-500 font-bold uppercase shrink-0">OV</span>}
                  <span className="shrink-0 text-[10px]">{r.conditions?.length || 0} cond</span>
                  <span className="shrink-0 text-[10px] uppercase">{r.actions?.[0]?.type || '-'}</span>
                  <button onClick={() => { deleteRule(r.id); refresh(); if (selectedRuleId === r.id) { setSelectedRuleId(null); setEditing(null) } }} className="text-[#9ca3af] hover:text-red-500 shrink-0" title="Delete">✕</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 shrink-0 border-r border-[#e5e7eb] dark:border-[#2d3140] overflow-y-auto">
          <div className="p-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">
            <button onClick={() => {
              const name = prompt('Group name:')
              if (name) { createGroup(name); refresh() }
            }} className="gbtn text-xs w-full text-center">
              + New Group
            </button>
          </div>
          {groups.map(g => (
            <div key={g.id}>
              <button
                onClick={() => {
                  const rules = getRulesForGroup(g.id)
                  if (openGroupId === g.id && !rules.length) return
                  setOpenGroupId(openGroupId === g.id ? null : g.id)
                  setSelectedRuleId(null)
                  setEditing(null)
                  setDirty(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                  openGroupId === g.id
                    ? 'bg-soc-blue/10 dark:bg-blue-500/10 text-soc-blue dark:text-blue-400'
                    : 'text-soc-stext dark:text-soc-darkstext hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'
                }`}
              >
                <span className="text-[10px]">{openGroupId === g.id ? '\u25BC' : '\u25B6'}</span>
                <span className="flex-1 truncate">{g.name}</span>
                <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">
                  {getRulesForGroup(g.id).length}
                </span>
              </button>
              {openGroupId === g.id && (
                <div>
                  {rulesList.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handleSelectRule(r.id)}
                      className={`w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-xs text-left transition-colors ${
                        selectedRuleId === r.id
                          ? 'bg-soc-blue/10 dark:bg-blue-500/10 text-soc-blue dark:text-blue-400'
                          : 'text-soc-stext dark:text-soc-darkstext hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.enabled ? 'bg-green-500' : 'bg-[#9ca3af]'}`} />
                      <span className="flex-1 truncate">{r.name}</span>
                      {r.overwrite && <span className="text-[9px] uppercase text-amber-500 font-bold">OV</span>}
                    </button>
                  ))}
                  <button
                    onClick={handleNewRule}
                    className="w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-xs text-left text-[#9ca3af] dark:text-[#6b7280] hover:text-soc-blue dark:hover:text-blue-400 transition-colors"
                  >
                    + New Rule
                  </button>
                </div>
              )}
            </div>
          ))}
        </aside>

        <div className="flex-1 overflow-y-auto p-4">
          {!editing ? (
            <div className="flex items-center justify-center h-full text-sm text-[#9ca3af] dark:text-[#6b7280]">
              {openGroupId ? 'Select or create a rule' : 'Select a group from the sidebar'}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              <div className="flex items-center justify-between">
                <input
                  className="ginput text-base font-semibold flex-1 mr-3"
                  value={editing.name}
                  onChange={e => patchEditing({ name: e.target.value })}
                  placeholder="Rule name"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={editing.enabled} onChange={e => patchEditing({ enabled: e.target.checked })} className="accent-soc-blue" />
                    Enabled
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[#9ca3af] dark:text-[#6b7280] mb-1">Priority</label>
                  <input type="number" className="ginput w-full" value={editing.priority} onChange={e => patchEditing({ priority: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[#9ca3af] dark:text-[#6b7280] mb-1">Condition Logic</label>
                  <select className="ginput w-full" value={editing.conditionLogic} onChange={e => patchEditing({ conditionLogic: e.target.value })}>
                    <option value="AND">AND (all must match)</option>
                    <option value="OR">OR (any must match)</option>
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={editing.overwrite} onChange={e => patchEditing({ overwrite: e.target.checked })} className="accent-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">Overwrite mode</span>
                  </label>
                </div>
              </div>

              <div className="gcard p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-semibold text-[#9ca3af] dark:text-[#6b7280]">Conditions</span>
                  <button onClick={addCondition} className="gbtn text-xs">+ Add Condition</button>
                </div>
                {editing.conditions.length === 0 && (
                  <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] py-4 text-center">No conditions — rule matches all events</div>
                )}
                <div className="space-y-1.5">
                  {editing.conditions.map((cond, idx) => (
                    <div key={cond.id} className="flex items-center gap-2 text-xs">
                      {idx > 0 && (
                        <span className="text-[10px] font-bold text-soc-blue dark:text-blue-400 w-8 shrink-0 text-center">{editing.conditionLogic}</span>
                      )}
                      {idx === 0 && <span className="w-8 shrink-0" />}
                      <select className="ginput flex-1 min-w-0" value={cond.field} onChange={e => updateCondition(idx, { field: e.target.value })}>
                        {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      <select className="ginput w-24 shrink-0" value={cond.operator} onChange={e => updateCondition(idx, { operator: e.target.value })}>
                        {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <input
                        className="ginput flex-1 min-w-0"
                        placeholder="value"
                        value={cond.value}
                        onChange={e => updateCondition(idx, { value: e.target.value })}
                      />
                      <label className="flex items-center gap-1 cursor-pointer shrink-0" title="NOT">
                        <input type="checkbox" checked={cond.negate} onChange={e => updateCondition(idx, { negate: e.target.checked })} className="accent-soc-blue" />
                        <span className={`text-[10px] font-semibold ${cond.negate ? 'text-red-500' : 'text-[#9ca3af]'}`}>NOT</span>
                      </label>
                      <button onClick={() => removeCondition(idx)} className="p-1 text-[#9ca3af] hover:text-red-500 transition-colors shrink-0" title="Remove condition">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="gcard p-3">
                <span className="text-[10px] uppercase font-semibold text-[#9ca3af] dark:text-[#6b7280] mb-2 block">Ignore IPs</span>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editing.ignoreIps.map((ip, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-[#f3f4f6] dark:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext">
                      {ip}
                      <button onClick={() => removeIgnoreIp(idx)} className="text-[#9ca3af] hover:text-red-500">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  className="ginput w-full text-xs"
                  placeholder="Add IP or CIDR (e.g. 10.0.0.0/8) and press Enter"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      addIgnoreIp(e.target.value)
                      e.target.value = ''
                    }
                  }}
                />
              </div>

              <div className="gcard p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-semibold text-[#9ca3af] dark:text-[#6b7280]">Actions</span>
                  <button onClick={addAction} className="gbtn text-xs">+ Add Action</button>
                </div>
                <div className="space-y-2">
                  {editing.actions.map((act, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-[#f9fafb] dark:bg-[#1a1c23] p-2.5 rounded-lg">
                      <div className="flex items-center gap-2 text-xs flex-1 flex-wrap">
                        <select className="ginput w-20" value={act.type} onChange={e => {
                          const updated = { type: e.target.value }
                          if (e.target.value === 'alert') updated.params = { severity: 'high', message: act.params?.message || '' }
                          else if (e.target.value === 'tag') updated.params = { tag: act.params?.tag || '' }
                          else updated.params = {}
                          updateAction(idx, updated)
                        }}>
                          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        {act.type === 'alert' && (
                          <>
                            <select className="ginput w-24" value={act.useEventLevel ? 'event-level' : (act.params?.severity || 'high')} onChange={e => {
                              if (e.target.value === 'event-level') updateAction(idx, { useEventLevel: true, params: { ...act.params, severity: 'high' } })
                              else { updateAction(idx, { useEventLevel: false, params: { ...act.params, severity: e.target.value } }) }
                            }}>
                              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                              <option value="event-level">{'From Event ({{rule.level}})'}</option>
                            </select>
                            {act.useEventLevel && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                Level {`\u2192`} {act.params?.severity || 'high'} (dynamic)
                              </span>
                            )}
                            <input type="number" className="ginput w-16" placeholder="Lvl" min="0" max="15" value={act.params?.level ?? ''} onChange={e => updateAction(idx, { params: { ...act.params, level: e.target.value ? parseInt(e.target.value) : undefined } })} title="Override Wazuh level (0-15)" />
                            <input className="ginput flex-1 min-w-0" placeholder='Alert message ({{field}} for interpolation)' value={act.params?.message || ''} onChange={e => updateAction(idx, { params: { ...act.params, message: e.target.value } })} />
                          </>
                        )}
                        {act.type === 'tag' && (
                          <input className="ginput flex-1 min-w-0" placeholder="Tag name" value={act.params?.tag || ''} onChange={e => updateAction(idx, { params: { ...act.params, tag: e.target.value } })} />
                        )}
                        {act.type === 'ignore' && (
                          <span className="text-[#9ca3af] text-[11px]">Events matching this rule will be silently ignored</span>
                        )}
                      </div>
                      {editing.actions.length > 1 && (
                        <button onClick={() => removeAction(idx)} className="p-1 text-[#9ca3af] hover:text-red-500 mt-0.5" title="Remove action">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="gcard p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-semibold text-[#9ca3af] dark:text-[#6b7280]">Test Against Live Data</span>
                  <div className="flex items-center gap-2">
                    <button onClick={runBatchTest} disabled={batchTestLoading} className="gbtn text-xs">
                      {batchTestLoading ? 'Testing...' : '\u26A1 Test All Rules'}
                    </button>
                    <button onClick={runTest} disabled={testLoading} className="gbtn text-xs">
                      {testLoading ? 'Testing...' : '\u25B6 Run Test'}
                    </button>
                  </div>
                </div>
                {batchTestResults && !batchTestResults.error && (
                  <div className="mb-2 p-2 bg-[#f9fafb] dark:bg-[#1a1c23] rounded-lg text-xs">
                    <div className="text-[10px] text-[#9ca3af] mb-1">Tested {batchTestResults.totalRules} rules against {batchTestResults.alertsCount} alerts</div>
                    {batchTestResults.perRule.slice(0, 10).map(r => {
                      const grp = groups.find(g => g.id === r.groupId)
                      return (
                        <div key={r.id} className="flex items-center gap-2 py-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${r.matched > 0 ? 'bg-green-500' : 'bg-[#9ca3af]'}`} />
                          <span className="text-[10px] text-[#6b7280] w-12 truncate">{grp?.name}</span>
                          <span className="flex-1 truncate">{r.name}</span>
                          <span className="font-mono text-[10px]">{r.matched}/{r.total} ({r.pct}%)</span>
                          {r.overwrite && <span className="text-[9px] text-amber-500 font-bold">OV</span>}
                        </div>
                      )
                    })}
                    {batchTestResults.perRule.length > 10 && <div className="text-[10px] text-[#9ca3af] pt-1">...and {batchTestResults.perRule.length - 10} more</div>}
                  </div>
                )}
                {batchTestResults?.error && <div className="text-xs text-red-500 mb-2">{batchTestResults.error}</div>}
                {showTest && testResults && !Array.isArray(testResults) && (
                  <div className="text-xs text-red-500">{(testResults).error || 'Test failed'}</div>
                )}
                {showTest && testResults && Array.isArray(testResults) && (
                  <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                    <div className="text-[10px] text-[#9ca3af] dark:text-[#6b7280] mb-1">
                      {testResults.filter(r => r.matched).length} / {testResults.length} alerts matched
                    </div>
                    {testResults.slice(0, 30).map((r, idx) => (
                      <div key={idx} className={`flex items-start gap-2 p-1.5 rounded ${
                        r.matched ? 'bg-green-50 dark:bg-green-900/10' : 'bg-transparent'
                      }`}>
                        <span className={`mt-0.5 text-[10px] font-bold shrink-0 ${r.matched ? 'text-green-600' : 'text-[#9ca3af]'}`}>
                          {r.matched ? '\u2713' : '\u2717'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-[#9ca3af]">{r.timestamp ? String(r.timestamp).slice(0, 19).replace('T', ' ') : ''}</span>
                            <span className={`badge badge-${r.ruleLevel > 10 ? 'critical' : r.ruleLevel > 7 ? 'high' : r.ruleLevel > 4 ? 'medium' : 'low'}`}>{r.ruleLevel}</span>
                          </div>
                          <div className="truncate text-soc-stext dark:text-soc-darkstext">{r.ruleDesc}</div>
                          {r.matched && r.actions.length > 0 && r.actions.map((a, ai) => (
                            <div key={ai} className="flex items-center gap-1.5 mt-0.5">
                              <span className={`badge badge-${a.type === 'alert' ? a.computedSeverity || a.params?.severity || 'high' : a.type === 'tag' ? 'medium' : 'low'} text-[9px]`}>
                                {a.type.toUpperCase()}
                              </span>
                              <span className="text-[10px] text-soc-stext dark:text-soc-darkstext truncate">
                                {a.type === 'alert' && (a.computedSeverity || a.params?.severity || 'high')}
                                {a.type === 'alert' && a.interpolated ? ': ' + a.interpolated : ''}
                                {a.type === 'tag' && (a.params?.tag || '')}
                                {a.type === 'ignore' && 'silent ignore'}
                              </span>
                            </div>
                          ))}
                          {!r.matched && r.details && r.details.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {r.details.map((d, di) => (
                                <span key={di} className={`text-[9px] px-1 py-0.5 rounded ${
                                  d.matched
                                    ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                    : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-300'
                                }`}>
                                  {d.condition.negate ? 'NOT ' : ''}{d.condition.field} {d.condition.operator} "{d.condition.value}" → {d.matched ? 'OK' : 'FAIL'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-[#e5e7eb] dark:border-[#2d3140] flex-wrap">
                <button onClick={handleSave} className="gbtn-primary text-xs">Save Rule</button>
                <button onClick={handleDuplicate} className="gbtn text-xs">Duplicate</button>
                <button onClick={handleDelete} className="gbtn text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">Delete Rule</button>
                <button onClick={() => {
                  toggleRuleEnabled(editing.id)
                  patchEditing({ enabled: !editing.enabled })
                }} className="gbtn text-xs">
                  {editing.enabled ? 'Disable' : 'Enable'}
                </button>
                {dirty && <span className="text-[10px] text-amber-500 font-medium">Unsaved changes</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
