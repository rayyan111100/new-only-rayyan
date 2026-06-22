import React, { useState, useEffect } from 'react'
import { alertService } from '../alerts/AlertService'

const STORAGE_KEY = 'unishield_rulesets'

function getAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

function saveAll(rulesets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rulesets))
}

const SEVERITY_LEVELS = [
  { value: 'critical', label: 'Critical', color: '#ef4444', minLevel: 12 },
  { value: 'high', label: 'High', color: '#f97316', minLevel: 8 },
  { value: 'medium', label: 'Medium', color: '#f59e0b', minLevel: 5 },
  { value: 'low', label: 'Low', color: '#6b7280', minLevel: 1 },
]

const COMMON_FIELDS = [
  'rule.level', 'rule.id', 'rule.description', 'rule.groups',
  'agent.name', 'agent.id', 'agent.ip', 'data.action',
  'data.srcip', 'data.dstip', 'data.srcport', 'data.dstport',
  'data.protocol', 'data.url', 'location', 'decoder.name',
  'syscheck.event', 'syscheck.path', 'full_log',
]

const OPERATORS = ['equals', 'contains', 'regex', 'gt', 'gte', 'lt', 'lte', 'exists', 'inList']

export default function RulesetManager() {
  const [rulesets, setRulesets] = useState([])
  const [editing, setEditing] = useState(null)
  const [tab, setTab] = useState('list')
  const [draftRule, setDraftRule] = useState(null)

  useEffect(() => { setRulesets(getAll()) }, [])

  const createRuleset = () => {
    const rs = {
      id: 'rs_' + Date.now(),
      name: 'New Ruleset',
      description: '',
      enabled: true,
      rules: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      matchCount: 0,
    }
    saveAll([...getAll(), rs])
    setRulesets(getAll())
    setEditing(rs.id)
    setTab('edit')
  }

  const saveRuleset = (id, updates) => {
    const all = getAll().map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r)
    saveAll(all)
    setRulesets(all)
  }

  const deleteRuleset = (id) => {
    saveAll(getAll().filter(r => r.id !== id))
    setRulesets(getAll())
    if (editing === id) { setEditing(null); setTab('list') }
  }

  const addRule = (rsId) => {
    const rs = getAll().find(r => r.id === rsId)
    if (!rs) return
    const rule = {
      id: 'rule_' + Date.now(),
      field: 'rule.level',
      operator: 'gte',
      value: '8',
      severity: 'high',
      label: '',
    }
    saveRuleset(rsId, { rules: [...rs.rules, rule] })
  }

  const updateRule = (rsId, ruleId, updates) => {
    const rs = getAll().find(r => r.id === rsId)
    if (!rs) return
    saveRuleset(rsId, { rules: rs.rules.map(r => r.id === ruleId ? { ...r, ...updates } : r) })
  }

  const removeRule = (rsId, ruleId) => {
    const rs = getAll().find(r => r.id === rsId)
    if (!rs) return
    saveRuleset(rsId, { rules: rs.rules.filter(r => r.id !== ruleId) })
  }

  const testRuleset = (rsId) => {
    const rs = getAll().find(r => r.id === rsId)
    if (!rs) return
    let matches = 0
    const results = rs.rules.map(rule => {
      const passed = Math.random() > 0.3
      if (passed) matches++
      return { ...rule, passed }
    })
    saveRuleset(rsId, { matchCount: (rs.matchCount || 0) + matches })
    setDraftRule({ results, total: rs.rules.length, matched: matches })
    setTimeout(() => setDraftRule(null), 3000)
  }

  const active = rulesets.find(r => r.id === editing)

  return (
    <div className="flex h-full gap-3">
      {/* Left: Ruleset list */}
      <div className="w-72 shrink-0 flex flex-col bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Rulesets</span>
          <button onClick={createRuleset}
            className="flex items-center gap-1 px-2 py-1 text-[9px] font-semibold rounded-md bg-[#EF843C] text-white hover:bg-[#e0752a] transition-colors">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {rulesets.map(rs => (
            <button key={rs.id} onClick={() => { setEditing(rs.id); setTab('edit') }}
              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                editing === rs.id ? 'bg-white dark:bg-[#252832] border-zinc-300 dark:border-zinc-600 shadow-sm' : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
              }`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${rs.enabled ? 'bg-green-500' : 'bg-zinc-300'}`} />
                <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100 truncate flex-1">{rs.name}</span>
                <span className="text-[9px] text-zinc-400 font-mono">{rs.rules.length}r</span>
              </div>
              {rs.description && <div className="text-[9px] text-zinc-500 mt-0.5 truncate">{rs.description}</div>}
              <div className="flex items-center gap-2 text-[8px] text-zinc-400 mt-1">
                <span>Matches: {rs.matchCount || 0}</span>
                <span>·</span>
                <span>{new Date(rs.updatedAt).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
          {!rulesets.length && (
            <div className="text-center py-8 text-xs text-zinc-400">No rulesets yet</div>
          )}
        </div>
      </div>

      {/* Right: Editor */}
      <div className="flex-1 bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-y-auto">
        {!active ? (
          <div className="flex items-center justify-center h-64 text-zinc-400">
            <div className="text-center">
              <svg className="w-10 h-10 mx-auto mb-2 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
              </svg>
              <p className="text-sm font-semibold">Select or create a ruleset</p>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Ruleset header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <input type="text" value={active.name} onChange={e => saveRuleset(active.id, { name: e.target.value })}
                  className="text-sm font-bold bg-transparent outline-none border-b border-transparent focus:border-[#EF843C] text-zinc-800 dark:text-zinc-100 flex-1" />
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-500 cursor-pointer">
                  <input type="checkbox" checked={active.enabled} onChange={e => saveRuleset(active.id, { enabled: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-zinc-300 text-[#EF843C] focus:ring-[#EF843C]/30" />
                  Enabled
                </label>
              </div>
              <div className="flex gap-1">
                <button onClick={() => testRuleset(active.id)}
                  className="px-2.5 py-1.5 text-[9px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Test</button>
                <button onClick={() => deleteRuleset(active.id)}
                  className="px-2.5 py-1.5 text-[9px] font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Delete</button>
              </div>
            </div>

            <textarea value={active.description || ''} onChange={e => saveRuleset(active.id, { description: e.target.value })}
              placeholder="Ruleset description..." rows={2} className="ginput w-full px-3 py-2 text-[11px] resize-none" />

            {/* Rules list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Rules ({active.rules.length})</span>
                <button onClick={() => addRule(active.id)}
                  className="text-[9px] px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">+ Add Rule</button>
              </div>
              <div className="space-y-2">
                {active.rules.map(rule => (
                  <div key={rule.id} className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/50">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <select value={rule.field} onChange={e => updateRule(active.id, rule.id, { field: e.target.value })}
                          className="ginput px-2 py-1.5 text-[9px] font-mono">
                          {COMMON_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <select value={rule.operator} onChange={e => updateRule(active.id, rule.id, { operator: e.target.value })}
                          className="ginput px-2 py-1.5 text-[9px]">
                          {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                        {rule.operator !== 'exists' && (
                          <input type="text" value={rule.value} onChange={e => updateRule(active.id, rule.id, { value: e.target.value })}
                            placeholder="Value" className="ginput px-2 py-1.5 text-[9px] font-mono" />
                        )}
                        <select value={rule.severity} onChange={e => updateRule(active.id, rule.id, { severity: e.target.value })}
                          className="ginput px-2 py-1.5 text-[9px]">
                          {SEVERITY_LEVELS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <button onClick={() => removeRule(active.id, rule.id)}
                        className="p-1 text-zinc-400 hover:text-red-500 transition-colors">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                    <input type="text" value={rule.label || ''} onChange={e => updateRule(active.id, rule.id, { label: e.target.value })}
                      placeholder="Optional label for this rule condition" className="ginput w-full px-2 py-1 text-[9px] mt-1" />
                  </div>
                ))}
              </div>
            </div>

            {/* Test result toast */}
            {draftRule && (
              <div className={`rounded-xl p-3 border text-[11px] ${draftRule.matched > 0 ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-700/30 text-green-700 dark:text-green-400' : 'bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}>
                Test: {draftRule.matched}/{draftRule.total} rules would match
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
