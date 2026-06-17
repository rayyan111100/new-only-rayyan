import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { getAllRules } from '../services/ruleStorage'
import { evalRule } from '../services/ruleEngine'
import { addTestResult, clearTestResults, deleteTestResult, getTestResults } from '../services/testResultStorage'
import { useToast } from '../context/ToastContext'

const DEFAULT_EVENT = JSON.stringify({
  '@timestamp': new Date().toISOString(),
  rule: { description: 'Test Event', level: 5 },
  agent: { name: 'agent-01', id: '001' },
  full_log: 'Test log entry'
}, null, 2)


function flattenDetails(items) {
  const result = []
  for (const item of items || []) {
    if (item.details) result.push(...flattenDetails(item.details))
    else result.push(item)
  }
  return result
}

function DetailList({ details }) {
  const flat = flattenDetails(details)
  if (!flat.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {flat.map((d, idx) => (
        <span key={idx} className={`text-[9px] px-1.5 py-0.5 rounded-full ${
          d.matched
            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
            : d.condition?.missing
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
        }`}>
          {d.condition?.field || 'group'} {d.condition?.operator || ''} {d.condition?.value ? `"${d.condition.value}"` : ''} - {d.reason || (d.matched ? 'matched' : 'not matched')}
        </span>
      ))}
    </div>
  )
}

export default function TestLab() {
  const [rules, setRules] = useState([])
  const [selectedRuleIds, setSelectedRuleIds] = useState([])
  const [testJson, setTestJson] = useState(DEFAULT_EVENT)
  const [results, setResults] = useState(null)
  const [history, setHistory] = useState([])
  const [activeView, setActiveView] = useState('run')
  const [savedName, setSavedName] = useState('')
  const toast = useToast()

  const refresh = useCallback(() => { setRules(getAllRules()); setHistory(getTestResults()) }, [])

  useEffect(() => { refresh() }, [refresh])

  function toggleRule(id) {
    setSelectedRuleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleSelectAll() {
    setSelectedRuleIds(prev => prev.length === rules.length ? [] : rules.map(r => r.id))
  }

  function handleRunTest() {
    if (!testJson.trim()) { toast.error('Enter a test event JSON'); return }
    let doc
    try { doc = JSON.parse(testJson) } catch (e) { toast.error(`Invalid JSON: ${e.message}`); return }
    const ids = selectedRuleIds.length > 0 ? selectedRuleIds : rules.map(r => r.id)
    if (ids.length === 0) { toast.warning('No rules to test'); return }
    const testRules = rules.filter(r => ids.includes(r.id))
    const output = testRules.map(r => {
      const { matched, details } = evalRule(r, doc)
      const flatDetails = flattenDetails(details)
      return { id: r.id, name: r.name, matched, detailCount: flatDetails.length, matchCount: flatDetails.filter(d => d.matched).length, enabled: r.enabled, details }
    })
    const matchedCount = output.filter(r => r.matched).length
    const entry = {
      id: 'test_' + Date.now(),
      timestamp: new Date().toISOString(),
      event: doc,
      ruleCount: output.length,
      matchedCount,
      results: output,
      name: savedName || `Test run ${history.length + 1}`
    }
    const updated = addTestResult(entry)
    setHistory(updated)
    setResults(output)
    setActiveView('results')
    toast.success(`${matchedCount}/${output.length} rules matched`)
    setSavedName('')
  }

  function clearHistory() {
    setHistory(clearTestResults())
    setResults(null)
    toast.success('Test history cleared')
  }

  function loadHistoryEntry(entry) {
    setTestJson(JSON.stringify(entry.event, null, 2))
    setResults(entry.results)
    setActiveView('results')
  }

  function deleteHistoryEntry(id) {
    setHistory(deleteTestResult(id))
  }

  const selectedCount = selectedRuleIds.length

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc] dark:bg-[#0e0f14]">
      <header className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-[#e5e7eb] dark:border-[#2d3140] bg-white dark:bg-[#16181f]">
        <svg className="w-4 h-4 text-[#EF843C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
        <span className="font-semibold text-soc-stext dark:text-soc-darkstext">Test Lab</span>
        <span className="text-[10px] text-[#9ca3af]">{rules.length} rules</span>
      </header>

      <div className="flex items-center gap-1 px-3 sm:px-4 py-1.5 border-b border-[#e5e7eb] dark:border-[#2d3140] bg-white dark:bg-[#16181f]">
        {['run', 'results', 'history'].map(v => (
          <button key={v} onClick={() => setActiveView(v)}
            className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-all uppercase tracking-wider ${
              activeView === v ? 'bg-[#EF843C]/10 text-[#EF843C]' : 'text-[#9ca3af] hover:text-[#6b7280] dark:hover:text-[#e4e6eb]'
            }`}>{v}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 max-w-4xl mx-auto w-full">
        {activeView === 'run' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                  <span className="text-[11px] uppercase font-semibold text-[#9ca3af] tracking-wider">Select Rules</span>
                </div>
                <button onClick={toggleSelectAll} className="text-[10px] text-[#EF843C] hover:underline">
                  {selectedRuleIds.length === rules.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-[#e5e7eb] dark:divide-[#2d3140]">
                {rules.length === 0 && <div className="text-xs text-[#9ca3af] py-6 text-center italic">No rules defined</div>}
                {rules.map(r => (
                  <label key={r.id} className={`flex items-center gap-2.5 px-3 sm:px-4 py-2 text-xs cursor-pointer hover:bg-[#f9fafb] dark:hover:bg-[#0f1117] transition-colors ${selectedRuleIds.includes(r.id) ? 'bg-[#EF843C]/5 dark:bg-[#EF843C]/10' : ''}`}>
                    <input type="checkbox" checked={selectedRuleIds.includes(r.id)} onChange={() => toggleRule(r.id)}
                      className="w-3.5 h-3.5 rounded border-[#d1d5db] dark:border-[#4b5563] text-[#EF843C] focus:ring-[#EF843C]/30" />
                    <span className={`w-2 h-2 rounded-full shrink-0 ${r.enabled ? 'bg-green-500' : 'bg-[#d1d5db] dark:bg-[#4b5563]'}`} />
                    <span className="flex-1 truncate text-soc-stext dark:text-soc-darkstext">{r.name}</span>
                    {selectedRuleIds.includes(r.id) && <span className="text-[9px] text-[#EF843C] font-medium">selected</span>}
                  </label>
                ))}
              </div>
              <div className="px-3 sm:px-4 py-2 border-t border-[#e5e7eb] dark:border-[#2d3140] text-[9px] text-[#9ca3af]">
                {selectedCount > 0 ? `${selectedCount} rule${selectedCount !== 1 ? 's' : ''} selected` : 'All rules will be tested if none selected'}
              </div>
            </div>

            <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8m0 4h8m-8-8h5"/></svg>
                  <span className="text-[11px] uppercase font-semibold text-[#9ca3af] tracking-wider">Test Event</span>
                </div>
                <div className="flex items-center gap-2">
                  <input className="ginput text-[10px] py-1 px-2 w-32" placeholder="Test name (optional)" value={savedName} onChange={e => setSavedName(e.target.value)} />
                  <button onClick={handleRunTest}
                    className="gbtn text-xs flex items-center gap-1 px-3 py-1.5 bg-[#EF843C] text-white hover:bg-[#e0752a] shadow-sm transition-all">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 3l14 9-14 9V3z"/></svg>
                    Run Test
                  </button>
                </div>
              </div>
              <div className="p-3 sm:p-4">
                <textarea className="ginput w-full p-2.5 text-[10px] font-mono leading-relaxed resize-none" rows={6}
                  value={testJson} onChange={e => setTestJson(e.target.value)} spellCheck={false} />
              </div>
            </div>
          </motion.div>
        )}

        {activeView === 'results' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {results === null ? (
              <div className="text-xs text-[#9ca3af] py-10 text-center italic">Run a test to see results</div>
            ) : (
              <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                    <span className="text-[11px] uppercase font-semibold text-[#9ca3af] tracking-wider">Results</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{results.filter(r => r.matched).length}/{results.length}</span>
                    <div className="w-20 h-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(results.filter(r => r.matched).length / results.length) * 100}%` }} />
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-[#e5e7eb] dark:divide-[#2d3140] max-h-96 overflow-y-auto">
                  {results.map(r => (
                    <div key={r.id} className={`px-3 sm:px-4 py-2.5 text-xs ${r.matched ? 'bg-green-50/50 dark:bg-green-900/8' : ''}`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${r.matched ? 'bg-green-500 shadow-sm shadow-green-500/30' : 'bg-[#d1d5db] dark:bg-[#4b5563]'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-soc-stext dark:text-soc-darkstext truncate">{r.name}</span>
                            {!r.enabled && <span className="text-[8px] px-1 py-0.5 rounded-full bg-[#f3f4f6] dark:bg-[#2d3140] text-[#9ca3af]">DISABLED</span>}
                          </div>
                          <div className="text-[9px] text-[#9ca3af] mt-0.5">{r.matchCount}/{r.detailCount} conditions matched</div>
                        </div>
                        {r.matched ? (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-[9px] font-medium">MATCH</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-[#f3f4f6] dark:bg-[#2d3140] text-[#9ca3af] text-[9px] font-medium">NO MATCH</span>
                        )}
                      </div>
                      <DetailList details={r.details} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeView === 'history' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span className="text-[11px] uppercase font-semibold text-[#9ca3af] tracking-wider">Test History</span>
                <span className="text-[10px] text-[#9ca3af]">({history.length})</span>
              </div>
              {history.length > 0 && (
                <button onClick={clearHistory} className="text-[10px] text-red-500 hover:underline">Clear All</button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="text-xs text-[#9ca3af] py-10 text-center italic">No test history yet</div>
            ) : (
              <div className="space-y-1.5">
                {history.map(h => (
                  <div key={h.id}
                    className="flex items-center gap-3 px-3 sm:px-4 py-2.5 bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-sm cursor-pointer hover:border-[#EF843C]/50 dark:hover:border-[#EF843C]/30 transition-colors"
                    onClick={() => loadHistoryEntry(h)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-soc-stext dark:text-soc-darkstext truncate">{h.name}</span>
                        <span className="text-[9px] text-[#9ca3af]">{new Date(h.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-[9px] text-[#9ca3af] mt-0.5">
                        {h.ruleCount} rules · {h.matchedCount} matched
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteHistoryEntry(h.id) }}
                      className="p-1 text-[#9ca3af] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all shrink-0">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
