import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import ResultsTable from '../components/ResultsTable'
import Histogram from '../components/Histogram'
import { getAllRules } from '../services/ruleStorage'
import { evaluateAllRules, interpolateMessage } from '../services/ruleEngine'

const INDEX_OPTIONS = [
  { label: 'Alerts', value: 'wazuh-alerts-4.x-*' },
  { label: 'Archives', value: 'wazuh-archives-4.x-*' }
]

export default function RuleViewTab() {
  const { total, results, loading, dql, filters, isDark, doSearch, setIndex } = useApp()
  const [searchIndex, setSearchIndex] = useState('wazuh-alerts-4.x-*')
  const [applyRules, setApplyRules] = useState(true)
  const [transformed, setTransformed] = useState([])
  const [ruleMatches, setRuleMatches] = useState({})
  const [matchedCount, setMatchedCount] = useState(0)
  const [ruleBreakdown, setRuleBreakdown] = useState({})
  const [ruleSevMap, setRuleSevMap] = useState({})

  useEffect(() => {
    setIndex(searchIndex)
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
      } else {
        out.push(doc)
      }
    })
    setTransformed(out); setRuleMatches(mm); setMatchedCount(mc); setRuleBreakdown(breakdown); setRuleSevMap(sevMap)
  }, [results, applyRules])

  const sevBadgeStyle = (sev) => ({
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 ring-1 ring-red-400/30',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 ring-1 ring-orange-400/30',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 ring-1 ring-yellow-400/30',
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 ring-1 ring-green-400/30',
    info: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400 ring-1 ring-gray-400/20'
  })[sev] || ''

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} className="space-y-2">
      <div className="flex items-center gap-3 px-1 py-1 text-xs">
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
        {loading && <span className="text-soc-stext dark:text-soc-darkstext">{'\u23F3'} searching...</span>}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setApplyRules(prev => !prev)}
            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded transition-colors ${
              applyRules
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 ring-1 ring-purple-400/50'
                : 'bg-soc-bg dark:bg-soc-darkbg text-soc-stext dark:text-soc-darkstext hover:text-purple-600 dark:hover:text-purple-400'
            }`}
          >
            {'\u2699'} Rules
          </button>
        </div>
      </div>
      {applyRules && matchedCount > 0 && (
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs flex-wrap ${isDark ? 'bg-purple-900/10 ring-1 ring-purple-800/30' : 'bg-purple-50 ring-1 ring-purple-200/50'}`}>
          <span className="font-semibold text-purple-700 dark:text-purple-300">{'\u2699'} Rules:</span>
          <span className="text-soc-text dark:text-soc-darktext"><b>{matchedCount}</b>/{results.length} matched</span>
          {Object.entries(ruleBreakdown).map(([name, cnt]) => (
            <span key={name} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${sevBadgeStyle(ruleSevMap[name] || 'info')}`}>
              {name}: {cnt}
            </span>
          ))}
        </div>
      )}
      {applyRules && matchedCount === 0 && results.length > 0 && (
        <div className="px-2 py-1.5 text-xs text-soc-stext dark:text-soc-darkstext">No rules matched — showing original data</div>
      )}
      <Histogram />
      <div className="flex gap-3 flex-col lg:flex-row">
        <div className="flex-1 min-w-0">
          <ResultsTable results={applyRules ? transformed : results} total={total} loading={loading} ruleMatches={applyRules ? ruleMatches : null} />
        </div>
      </div>
    </motion.div>
  )
}
