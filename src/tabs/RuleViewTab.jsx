import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import ResultsTable from '../components/ResultsTable'
import Histogram from '../components/Histogram'
import ResizableSplitter from '../components/ResizableSplitter'
import { getAllRules } from '../services/ruleStorage'
import { evaluateAllRules, interpolateMessage } from '../services/ruleEngine'

const INDEX_OPTIONS = [
  { label: 'Alerts', value: 'unishield360-alerts-4.x-*' },
  { label: 'Archives', value: 'unishield360-archives-4.x-*' }
]

function RuleJsonModal({ rule, onClose }) {
  if (!rule) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-xl shadow-2xl border border-[#e5e7eb] dark:border-[#2d3140] p-4 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-soc-stext/40">{rule.name || 'Rule'}</span>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext/50 hover:text-soc-text transition-colors">&times;</button>
        </div>
        <pre className="flex-1 overflow-auto text-[10px] font-mono bg-[#f8f9fa] dark:bg-[#252832] p-3 rounded-lg text-soc-text dark:text-soc-darktext whitespace-pre-wrap">{JSON.stringify(rule, null, 2)}</pre>
        <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(rule, null, 2)) }}
          className="mt-2 self-end px-2.5 py-1 text-[10px] font-medium rounded-md bg-[#EF843C] text-white hover:bg-[#d4661e] dark:bg-[#EF843C] dark:text-[#1a1d27] transition-all">Copy JSON</button>
      </div>
    </div>
  )
}

export default function RuleViewTab() {
  const { total, results, loading, dql, filters, isDark, doSearch } = useApp()
  const [searchIndex, setSearchIndex] = useState('unishield360-alerts-4.x-*')
  const [applyRules, setApplyRules] = useState(true)
  const [transformed, setTransformed] = useState([])
  const [ruleMatches, setRuleMatches] = useState({})
  const [matchedCount, setMatchedCount] = useState(0)
  const [ruleBreakdown, setRuleBreakdown] = useState({})
  const [ruleSevMap, setRuleSevMap] = useState({})
  const [viewRule, setViewRule] = useState(null)
  const [showWazuhRules, setShowWazuhRules] = useState(false)
  const [unishield360Rules, setUnishield360Rules] = useState([])
  const [unishield360Loading, setUnishield360Loading] = useState(false)

  useEffect(() => {
    doSearch({ index: searchIndex })
  }, [searchIndex])

  useEffect(() => {
    if (!applyRules || !results.length) {
      setTransformed(results); setRuleMatches({}); setMatchedCount(0); setRuleBreakdown({}); setRuleSevMap({})
      return
    }
    const rules = getAllRules().filter(r => r.enabled)
    if (!rules.length) {
      setTransformed(results); setRuleMatches({}); setMatchedCount(0); setRuleBreakdown({}); setRuleSevMap({})
      return
    }
    const out = []; const mm = {}; let mc = 0; const breakdown = {}; const sevMap = {}
    results.forEach((doc, idx) => {
      const er = evaluateAllRules(rules, doc)
      if (er.matched) {
        const top = er.matches[0]; const act = top.actions?.[0]
        const sev = act?.params?.severity || 'info'
        const msg = interpolateMessage(act?.params?.message || '', doc)
        const lvl = act?.params?.level
        const d = JSON.parse(JSON.stringify(doc))
        if (top.rule.overwrite) {
          if (lvl != null) d.rule = { ...d.rule, level: lvl }
          if (msg) d.rule = { ...d.rule, description: msg }
        }
        out.push(d)
        const rName = top.rule.name
        mm[idx] = { ruleName: rName, severity: sev, level: lvl, message: msg, priority: top.rule.priority }
        breakdown[rName] = (breakdown[rName] || 0) + 1; sevMap[rName] = sev; mc++
      } else { out.push(doc) }
    })
    setTransformed(out); setRuleMatches(mm); setMatchedCount(mc); setRuleBreakdown(breakdown); setRuleSevMap(sevMap)
  }, [results, applyRules])

  const loadUnishield360Rules = async () => {
    setUnishield360Loading(true)
    setShowWazuhRules(true)
    try {
      const res = await fetch('/api/wazuh-rules').then(r => r.json())
      setUnishield360Rules(Array.isArray(res) ? res : res?.data?.items || [])
    } catch { setUnishield360Rules([]) }
    setUnishield360Loading(false)
  }

  const sevBadgeStyle = () => 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#6b7280] dark:text-[#9ca3af]'

  const customRules = getAllRules().filter(r => r.enabled)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} className="space-y-2">
      <div className="flex items-center gap-3 px-1 py-1 text-xs flex-wrap">
        <div className="flex items-center gap-1.5">
            <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}>Index</span>
          <select value={searchIndex} onChange={e => setSearchIndex(e.target.value)}
            className="ginput text-[10px] py-0.5 px-1 w-auto font-mono">
            {INDEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}>Query</span>
          <span className="text-soc-blue dark:text-blue-400 font-mono">{dql || filters.length ? 'Filtered' : '*'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}>Total</span>
          <span className="font-bold text-soc-text dark:text-soc-darktext">{total.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}>Showing</span>
          <span className="text-soc-text dark:text-soc-darktext">{results.length}</span>
        </div>
        {loading && <span className="text-soc-stext dark:text-soc-darkstext">searching...</span>}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setApplyRules(prev => !prev)}
            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded transition-colors ${applyRules ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 ring-1 ring-purple-400/50' : 'bg-soc-bg dark:bg-soc-darkbg text-soc-stext dark:text-soc-darkstext hover:text-purple-600 dark:hover:text-purple-400'}`}>
            Rules
          </button>
          <button onClick={loadUnishield360Rules}
            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded transition-colors ${showWazuhRules ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-400/50' : 'bg-soc-bg dark:bg-soc-darkbg text-soc-stext dark:text-soc-darkstext hover:text-blue-600 dark:hover:text-blue-400'}`}>
            UniShield360
          </button>
        </div>
      </div>

      {/* Custom rules breakdown */}
      {applyRules && matchedCount > 0 && (
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs flex-wrap ${isDark ? 'bg-purple-900/10 ring-1 ring-purple-800/30' : 'bg-purple-50 ring-1 ring-purple-200/50'}`}>
          <span className="font-semibold text-purple-700 dark:text-purple-300">Custom Rules:</span>
          <span className="text-soc-text dark:text-soc-darktext"><b>{matchedCount}</b>/{results.length} matched</span>
          {Object.entries(ruleBreakdown).map(([name, cnt]) => (
            <span key={name} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer bg-[#f3f4f6] dark:bg-[#2d3140] text-[#6b7280] dark:text-[#9ca3af]"
              onClick={() => {
                const r = customRules.find(x => x.name === name)
                if (r) setViewRule(r)
              }}>
              {name}: {cnt}
              <span className="text-[9px] opacity-60 ml-0.5">{'{ }'}</span>
            </span>
          ))}
        </div>
      )}
      {applyRules && matchedCount === 0 && results.length > 0 && (
        <div className="px-2 py-1.5 text-xs text-soc-stext dark:text-soc-darkstext">No rules matched — showing original data</div>
      )}

      {/* UniShield360 rules panel */}
      {showWazuhRules && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${isDark ? 'bg-blue-900/5 border-blue-800/30' : 'bg-blue-50 border-blue-200/50'}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-blue-700 dark:text-blue-300">UniShield360 Manager Rules</span>
            <button onClick={() => setShowWazuhRules(false)} className="text-soc-stext/40 hover:text-soc-text">&times;</button>
          </div>
          {unishield360Loading ? (
            <div className="text-soc-stext/50 italic">Loading...</div>
          ) : unishield360Rules.length === 0 ? (
            <div className="text-soc-stext/50 italic">No UniShield360 rules available or API unreachable</div>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {unishield360Rules.slice(0, 50).map((wr, i) => (
                <div key={wr.id || i} className="flex items-center gap-2 text-[10px] py-0.5 cursor-pointer hover:bg-white/50 dark:hover:bg-black/20 rounded px-1 transition-colors"
                  onClick={() => setViewRule(wr)}>
                  <span className={`text-[9px] font-mono text-soc-stext/50 ${isDark ? 'text-soc-darkstext/50' : ''}`}>#{wr.id || i}</span>
                  <span className="flex-1 truncate text-soc-stext dark:text-soc-darkstext">{wr.description || wr.name || 'UniShield360 rule'}</span>
                  <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">L{wr.level || '?'}</span>
                  <span className="text-soc-stext/30 dark:text-soc-darkstext/30">{'{ }'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0">
        <ResizableSplitter
          defaultRatio={0.35}
          minRatio={0.15}
          maxRatio={0.6}
          direction="vertical"
          storageKey="unishield_ruleview_split"
        >
          <div className="overflow-y-auto pr-1">
            <Histogram />
          </div>
          <div className="flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              <ResultsTable results={applyRules ? transformed : results} total={total} loading={loading} ruleMatches={applyRules ? ruleMatches : null} />
            </div>
          </div>
        </ResizableSplitter>
      </div>

      {/* JSON viewer modal */}
      <RuleJsonModal rule={viewRule} onClose={() => setViewRule(null)} />
    </motion.div>
  )
}
