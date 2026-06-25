import React, { useState } from 'react'
import axios from 'axios'

const FIELD_OPTIONS = [
  { value: 'rule.level', label: 'Rule Level', type: 'number' },
  { value: 'rule.id', label: 'Rule ID', type: 'string' },
  { value: 'rule.description', label: 'Rule Description', type: 'string' },
  { value: 'rule.groups', label: 'Rule Groups', type: 'string' },
  { value: 'agent.name', label: 'Agent Name', type: 'string' },
  { value: 'agent.id', label: 'Agent ID', type: 'string' },
  { value: 'agent.ip', label: 'Agent IP', type: 'string' },
  { value: 'data.action', label: 'Action', type: 'string' },
  { value: 'data.srcip', label: 'Source IP', type: 'ip' },
  { value: 'data.dstip', label: 'Dest IP', type: 'ip' },
  { value: 'data.srcport', label: 'Source Port', type: 'number' },
  { value: 'data.dstport', label: 'Dest Port', type: 'number' },
  { value: 'data.protocol', label: 'Protocol', type: 'string' },
  { value: 'data.url', label: 'URL', type: 'string' },
  { value: 'full_log', label: 'Full Log', type: 'text' },
  { value: 'syscheck.event', label: 'Syscheck Event', type: 'string' },
  { value: 'syscheck.path', label: 'Syscheck Path', type: 'string' },
  { value: 'location', label: 'Location', type: 'string' },
  { value: 'decoder.name', label: 'Decoder', type: 'string' },
]

const OPERATORS = [
  { value: 'equals', label: 'equals', description: 'Exact case-sensitive match' },
  { value: 'not_equals', label: 'not equals', description: 'Inverse exact match' },
  { value: 'contains', label: 'contains', description: 'Substring match' },
  { value: 'not_contains', label: 'not contains', description: 'Inverse substring' },
  { value: 'regex', label: 'regex', description: 'Regular expression match' },
  { value: 'gt', label: '>', description: 'Greater than (numeric)' },
  { value: 'gte', label: '>=', description: 'Greater than or equal' },
  { value: 'lt', label: '<', description: 'Less than (numeric)' },
  { value: 'lte', label: '<=', description: 'Less than or equal' },
  { value: 'exists', label: 'exists', description: 'Field exists (not null)' },
  { value: 'not_exists', label: 'not exists', description: 'Field is missing/null' },
  { value: 'prefix', label: 'prefix', description: 'Starts with value' },
]

export default function RuleTestTool() {
  const [conditions, setConditions] = useState([{ field: 'rule.level', operator: 'gte', value: '10' }])
  const [testDoc, setTestDoc] = useState('{\n  "rule": {\n    "level": 10,\n    "id": "87702",\n    "description": "Multiple pfSense firewall blocks",\n    "groups": ["pfsense", "firewall"]\n  },\n  "agent": {\n    "name": "root",\n    "id": "000"\n  },\n  "data": {\n    "action": "block",\n    "srcip": "36.255.10.162",\n    "dstip": "122.179.128.186"\n  }\n}')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [liveData, setLiveData] = useState(null)
  const [liveLoading, setLiveLoading] = useState(false)

  const addCondition = () => {
    setConditions([...conditions, { field: 'rule.level', operator: 'gte', value: '' }])
  }

  const updateCondition = (idx, updates) => {
    setConditions(conditions.map((c, i) => i === idx ? { ...c, ...updates } : c))
  }

  const removeCondition = (idx) => {
    setConditions(conditions.filter((_, i) => i !== idx))
  }

  const evaluateLocal = () => {
    try {
      const doc = JSON.parse(testDoc)
      const matched = conditions.every(c => {
        const parts = c.field.split('.')
        let val = doc
        for (const p of parts) {
          if (val === null || val === undefined) return false
          val = val[p]
        }
        if (c.operator === 'exists') return val !== null && val !== undefined
        if (c.operator === 'not_exists') return val === null || val === undefined
        if (val === null || val === undefined) return false
        const strVal = String(val)
        const numVal = parseFloat(val)
        const target = c.value
        switch (c.operator) {
          case 'equals': return strVal === target
          case 'not_equals': return strVal !== target
          case 'contains': return strVal.toLowerCase().includes(target.toLowerCase())
          case 'not_contains': return !strVal.toLowerCase().includes(target.toLowerCase())
          case 'regex': return new RegExp(target).test(strVal)
          case 'gt': return numVal > parseFloat(target)
          case 'gte': return numVal >= parseFloat(target)
          case 'lt': return numVal < parseFloat(target)
          case 'lte': return numVal <= parseFloat(target)
          case 'prefix': return strVal.startsWith(target)
          default: return false
        }
      })
      setResult({ matched, doc, conditions: conditions.map(c => ({ ...c, passed: evaluateSingle(doc, c) })) })
    } catch (e) {
      setResult({ error: 'Invalid JSON: ' + e.message })
    }
  }

  const evaluateSingle = (doc, cond) => {
    const parts = cond.field.split('.')
    let val = doc
    for (const p of parts) {
      if (val === null || val === undefined) return false
      val = val[p]
    }
    if (cond.operator === 'exists') return val !== null && val !== undefined
    if (cond.operator === 'not_exists') return val === null || val === undefined
    if (val === null || val === undefined) return false
    const strVal = String(val)
    const numVal = parseFloat(val)
    const target = cond.value
    switch (cond.operator) {
      case 'equals': return strVal === target
      case 'not_equals': return strVal !== target
      case 'contains': return strVal.toLowerCase().includes(target.toLowerCase())
      case 'not_contains': return !strVal.toLowerCase().includes(target.toLowerCase())
      case 'regex': try { return new RegExp(target).test(strVal) } catch { return false }
      case 'gt': return numVal > parseFloat(target)
      case 'gte': return numVal >= parseFloat(target)
      case 'lt': return numVal < parseFloat(target)
      case 'lte': return numVal <= parseFloat(target)
      case 'prefix': return strVal.startsWith(target)
      default: return false
    }
  }

  const loadFromApi = async () => {
    setLiveLoading(true)
    try {
      const res = await axios.get('/api/search', {
        params: { index: 'unishield360-alerts-4.x-*', limit: 1, sort: '@timestamp', order: 'desc', start_date: 'now-24h', end_date: 'now' },
      })
      const doc = res.data.results?.[0] || res.data.hits?.[0] || null
      setLiveData(doc)
      if (doc) setTestDoc(JSON.stringify(doc, null, 2))
    } catch (e) {
      setLiveData({ error: e.message })
    } finally {
      setLiveLoading(false)
    }
  }

  return (
    <div className="flex h-full gap-3">
      {/* Left: Conditions */}
      <div className="w-96 shrink-0 flex flex-col bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Conditions</span>
          <button onClick={addCondition}
            className="flex items-center gap-1 px-2 py-1 text-[9px] font-semibold rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="flex items-center gap-1 text-[9px] text-zinc-400 mb-1 font-medium px-1">IF all conditions match → Alert</div>
          {conditions.map((c, i) => (
            <div key={i} className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[8px] font-semibold uppercase tracking-wider text-zinc-400">Condition {i + 1}</span>
                <button onClick={() => removeCondition(i)} className="p-0.5 text-zinc-400 hover:text-red-500">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="space-y-1.5">
                <select value={c.field} onChange={e => updateCondition(i, { field: e.target.value })}
                  className="ginput w-full px-2 py-1.5 text-[9px] font-mono">
                  {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label} ({f.value})</option>)}
                </select>
                <select value={c.operator} onChange={e => updateCondition(i, { operator: e.target.value })}
                  className="ginput w-full px-2 py-1.5 text-[9px]">
                  {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                {c.operator !== 'exists' && c.operator !== 'not_exists' && (
                  <input type="text" value={c.value} onChange={e => updateCondition(i, { value: e.target.value })}
                    placeholder="Value" className="ginput w-full px-2 py-1.5 text-[9px] font-mono" />
                )}
              </div>
              {result?.conditions?.[i] && (
                <div className={`mt-1.5 text-[9px] font-mono px-2 py-1 rounded ${result.conditions[i].passed ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                  {result.conditions[i].passed ? '✓ PASS' : '✗ FAIL'}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Score summary */}
        {result && !result.error && (
          <div className={`px-4 py-3 border-t text-xs font-semibold ${result.matched ? 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700/30' : 'bg-zinc-50 dark:bg-zinc-800/30 text-zinc-500 border-zinc-200 dark:border-zinc-700'}`}>
            {result.matched ? '✅ Rule MATCHES document' : '⛔ Rule does NOT match'}
          </div>
        )}
      </div>

      {/* Right: Test document + Result */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Test document editor */}
        <div className="flex-1 bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Test Document</span>
            <div className="flex gap-1">
              <button onClick={loadFromApi} disabled={liveLoading}
                className="flex items-center gap-1 px-2 py-1 text-[8px] font-medium rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                {liveLoading ? 'Loading...' : 'Load from API'}
              </button>
              <button onClick={evaluateLocal}
                className="px-3 py-1 text-[9px] font-semibold rounded-md bg-[#EF843C] text-white hover:bg-[#e0752a] transition-colors">Test Rule</button>
            </div>
          </div>
          <textarea value={testDoc} onChange={e => setTestDoc(e.target.value)}
            className="flex-1 w-full p-4 text-[11px] font-mono bg-transparent outline-none text-zinc-700 dark:text-zinc-300 resize-none border-0"
            spellCheck={false} />
        </div>

        {/* Result details */}
        {result?.error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-700/30 text-[10px] text-red-600 dark:text-red-400">{result.error}</div>
        )}

        {result?.conditions && (
          <div className="bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 p-3">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Condition Results</div>
            <div className="space-y-1">
              {result.conditions.map((c, i) => (
                <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-mono ${c.passed ? 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400'}`}>
                  <span className="font-semibold">{c.passed ? '✓' : '✗'}</span>
                  <span>{c.field} <span className="text-zinc-400">{c.operator}</span> {c.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live data info */}
        {liveData && !liveData.error && (
          <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/50">
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Loaded from API</div>
            <div className="text-[9px] text-zinc-500 font-mono truncate">
              {liveData._index} · {liveData._id} · {liveData.rule?.description || ''}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
