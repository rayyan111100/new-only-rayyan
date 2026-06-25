import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { api } from '../api'
import ResultsTable from '../components/ResultsTable'
import Histogram from '../components/Histogram'
import { getAllRules, getAllGroups } from '../services/ruleStorage'
import { evaluateAllRules, interpolateMessage } from '../services/ruleEngine'

export default function DiscoverTab() {
  const { total, results, loading, dql, filters, isDark, warning, setWarning, clearAllFilters, addFilter, doSearch, index, setIndex, startDate, endDate, tab } = useApp()
  const [applyRules, setApplyRules] = useState(false)
  const [ruleMatches, setRuleMatches] = useState({})
  const [matchedCount, setMatchedCount] = useState(0)
  const [ruleBreakdown, setRuleBreakdown] = useState({})
  const [ruleSevMap, setRuleSevMap] = useState({})
  const [groupBreakdown, setGroupBreakdown] = useState({})
  const [groupFilter, setGroupFilter] = useState([])
  const [showGroupFilter, setShowGroupFilter] = useState(false)

  const allGroups = getAllGroups()
  const groupMap = Object.fromEntries(allGroups.map(g => [g.id, g]))

  useEffect(() => {
    if (!applyRules || results.length === 0) {
      setRuleMatches({}); setMatchedCount(0); setRuleBreakdown({}); setRuleSevMap({}); setGroupBreakdown({})
      return
    }
    try {
      const rules = getAllRules().filter(r => r.enabled)
      if (!rules.length) { setRuleMatches({}); setMatchedCount(0); setRuleBreakdown({}); setRuleSevMap({}); setGroupBreakdown({}); return }
      const matchMap = {}; const breakdown = {}; const sevMap = {}; const gBreakdown = {}; let mCount = 0
      results.forEach((doc, idx) => {
        const evalResult = evaluateAllRules(rules, doc)
        if (evalResult.matched) {
          const top = evalResult.matches[0]; const action = top.actions?.[0]
          const rName = top.rule.name; const sev = action?.params?.severity || 'info'
          const msg = interpolateMessage(action?.params?.message || '', doc)
          const gids = top.rule.groupIds || []
          const groupNames = gids.map(gid => groupMap[gid]?.name || '').filter(Boolean)
          matchMap[idx] = {
            ruleName: rName, severity: sev, level: action?.params?.level || null,
            message: msg, priority: top.rule.priority, overwritten: evalResult.overwritten,
            groupIds: gids, groupNames
          }
          breakdown[rName] = (breakdown[rName] || 0) + 1; sevMap[rName] = sev; mCount++
          for (const gid of gids) {
            gBreakdown[gid] = (gBreakdown[gid] || 0) + 1
          }
        }
      })
      setRuleMatches(matchMap); setMatchedCount(mCount); setRuleBreakdown(breakdown); setRuleSevMap(sevMap)
      setGroupBreakdown(gBreakdown)
    } catch {}
  }, [results, applyRules])

  useEffect(() => {
    const handleKeyDown = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && tab === 'discover') {
        e.preventDefault()
        try {
          const sd = typeof startDate === 'string' && startDate.startsWith('now') ? startDate : 'now-30d'
          const ed = typeof endDate === 'string' && endDate === 'now' ? endDate : 'now'
          const res = await api('aggregate', { index, field: 'rule.id', type: 'terms', limit: 10, start_date: sd, end_date: ed })
          if (res.buckets?.length > 0) {
            const idsList = res.buckets.map(b => `rule.id:${b.key} \u2192 ${b.count || b.doc_count} alerts`).join('\n')
            const useRule = window.confirm(
              `Top 10 Rule IDs (${index}):\n\n${idsList}\n\nClick OK to use the most active rule ID as filter`
            )
            if (useRule && res.buckets[0]) {
              addFilter('rule.id', String(res.buckets[0].key), false, 'is')
              doSearch()
            }
          } else {
            window.alert('No rule.id data found in current index/date range')
          }
        } catch (e) {
          console.error('Failed to fetch rule IDs:', e)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [index, startDate, endDate, tab, addFilter, doSearch])

  const sevBadgeStyle = () => 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#6b7280] dark:text-[#9ca3af]'

  const filteredIds = Object.entries(ruleMatches).filter(([idx, m]) => {
    if (groupFilter.length === 0) return true
    return m.groupIds.some(gid => groupFilter.includes(gid))
  }).map(([idx]) => parseInt(idx))

  const handleShowRuleIds = useCallback(async () => {
    try {
      const res = await api('aggregate', { index, field: 'rule.id', type: 'terms', limit: 15, start_date: 'now-1y', end_date: 'now' })
      const ids = res.buckets?.map(b => `${b.key} (${b.count || b.doc_count} alerts)`).join('\n')
      window.alert(`Top 15 Rule IDs in ${index}:\n\n${ids || 'No rule.id data found'}`)
    } catch {
      window.alert('Failed to fetch rule IDs. Check API connection.')
    }
  }, [index])

  const handleCheckStats = useCallback(async () => {
    try {
      const res = await api('count', { index, q: '*' })
      const filterQ = filters.map(f => `${f.field}:${f.value}`).join(' AND ')
      const withFilter = await api('count', { index, q: filterQ || '*' })
      window.alert(
        `Index Statistics for ${index}:\n\n` +
        `Total documents: ${(res.count || res.total || 0).toLocaleString()}\n` +
        `Matching filter: ${(withFilter.count || withFilter.total || 0).toLocaleString()}\n\n` +
        `${(withFilter.count || withFilter.total || 0) === 0 ? 'No documents match this filter in the current index.' : ''}`
      )
    } catch {
      window.alert('Failed to get index statistics')
    }
  }, [index, filters])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} className="space-y-2">
      <div className="flex items-center gap-3 px-1 py-1 text-xs flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}>Query</span>
          <span className="text-soc-blue dark:text-blue-400 font-mono">{dql || filters.length ? 'Filtered' : '*'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}>Total</span>
          <span className="font-bold text-soc-text dark:text-soc-darktext">{total.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}>Fetched</span>
          <span className="text-soc-text dark:text-soc-darktext">{results.length}</span>
        </div>
        {loading && <span className="text-soc-stext dark:text-soc-darkstext">searching...</span>}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setApplyRules(prev => !prev)}
            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded transition-colors ${
              applyRules
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 ring-1 ring-purple-400/50'
                : 'bg-soc-bg dark:bg-soc-darkbg text-soc-stext dark:text-soc-darkstext hover:text-purple-600 dark:hover:text-purple-400'
            }`}
          >
            Rules
          </button>
        </div>
      </div>

      {warning && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          <div className="flex-1 text-sm text-blue-700 dark:text-blue-300">{warning}</div>
          <button onClick={() => setWarning(null)} className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 font-bold">&times;</button>
        </div>
      )}

      {total > 0 && <Histogram />}

      {applyRules && results.length > 0 && (
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs flex-wrap ${isDark ? 'bg-purple-900/10 ring-1 ring-purple-800/30' : 'bg-purple-50 ring-1 ring-purple-200/50'}`}>
          <span className="font-semibold text-purple-700 dark:text-purple-300">Rules:</span>
          {matchedCount > 0 ? (
            <>
              <span className="text-soc-text dark:text-soc-darktext">
                <b>{matchedCount}</b>/{results.length} matched
                {groupFilter.length > 0 && <span className="ml-1 text-[#EF843C]">(filtered)</span>}
              </span>
              {Object.entries(ruleBreakdown).map(([name, cnt]) => (
                  <span key={name} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#f3f4f6] dark:bg-[#2d3140] text-[#6b7280] dark:text-[#9ca3af]">
                  {name}: {cnt}
                </span>
              ))}
              {Object.entries(groupBreakdown).length > 0 && (
                <div className="relative inline-flex items-center gap-1">
                  <button onClick={() => setShowGroupFilter(!showGroupFilter)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/60 dark:bg-black/20 text-[#6b7280] hover:bg-white dark:hover:bg-black/30 ring-1 ring-[#e5e7eb] dark:ring-[#2d3140] transition-colors">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    Groups
                    {groupFilter.length > 0 && <span className="ml-0.5 text-[#EF843C]">({groupFilter.length})</span>}
                  </button>
                  {showGroupFilter && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowGroupFilter(false)} />
                      <div className="absolute left-0 top-full mt-1 z-40 bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg shadow-xl py-1 min-w-[160px]">
                        {allGroups.map(g => {
                          const active = groupFilter.includes(g.id)
                          return (
                            <label key={g.id} className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext flex items-center gap-2 cursor-pointer transition-colors">
                              <input type="checkbox" checked={active} onChange={() => setGroupFilter(prev => active ? prev.filter(id => id !== g.id) : [...prev, g.id])}
                                className="w-3 h-3 rounded border-[#d1d5db] text-[#EF843C] focus:ring-[#EF843C]/30" />
                              <span className="flex-1 truncate">{g.name}</span>
                              <span className="text-[#9ca3af]">{groupBreakdown[g.id] || 0}</span>
                            </label>
                          )
                        })}
                        {groupFilter.length > 0 && (
                          <div className="border-t border-[#e5e7eb] dark:border-[#2d3140] px-2 py-1">
                            <button onClick={() => setGroupFilter([])} className="w-full text-center text-[9px] py-1 rounded text-[#6b7280] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors">Clear filter</button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {Object.entries(groupBreakdown).map(([gid, cnt]) => {
                    const g = groupMap[gid]
                    if (!g) return null
                    return (
                      <span key={gid} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-[#f3f4f6] dark:bg-[#2d3140] text-[#6b7280] dark:text-[#9ca3af]">
                        {g.name}: {cnt}
                      </span>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <span className="text-soc-stext dark:text-soc-darkstext">No rules matched</span>
          )}
        </div>
      )}

      {total === 0 && !loading ? (
        <div className="p-8">
          {filters.length > 0 || dql ? (
            <div className="max-w-2xl mx-auto">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-6 mb-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-amber-800 dark:text-amber-200 mb-2">
                      No results for current filters
                    </h3>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mb-4">
                      The filter <code className="bg-amber-100 dark:bg-amber-800 px-1.5 py-0.5 rounded text-xs font-mono">
                        {filters.map(f => `${f.field}:${f.value}`).join(', ') || dql}
                      </code> returned 0 results. Try these quick fixes:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <button onClick={handleShowRuleIds}
                        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-[#EF843C] transition-colors text-sm">
                        <span className="text-left">
                          <strong>Show available rule IDs</strong>
                          <br />
                          <small className="text-gray-500">See which rule IDs exist in current index</small>
                        </span>
                      </button>

                      <button onClick={() => { clearAllFilters(); doSearch() }}
                        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-[#EF843C] transition-colors text-sm">
                        <span className="text-left">
                          <strong>Clear filters &amp; show all</strong>
                          <br />
                          <small className="text-gray-500">Remove all filters and browse all data</small>
                        </span>
                      </button>

                      {index.includes('4.x') && (
                        <button onClick={() => doSearch({ index: 'unishield360-alerts-*' })}
                          className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-[#EF843C] transition-colors text-sm">
                          <span className="text-left">
                            <strong>Try unishield360-alerts-*</strong>
                            <br />
                            <small className="text-gray-500">Search across all alert indices</small>
                          </span>
                        </button>
                      )}

                      <button onClick={handleCheckStats}
                        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-[#EF843C] transition-colors text-sm">
                        <span className="text-left">
                          <strong>Check index statistics</strong>
                          <br />
                          <small className="text-gray-500">Compare total vs filtered document counts</small>
                        </span>
                      </button>

                      <button onClick={() => doSearch({ index: '*' })}
                        className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-[#EF843C] transition-colors text-sm">
                        <span className="text-left">
                          <strong>Try all indices (*)</strong>
                          <br />
                          <small className="text-gray-500">Search across all available indices</small>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
                <strong>Pro tip:</strong> Press <kbd className="bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs border">Ctrl</kbd> + <kbd className="bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs border">R</kbd> to quickly see top 10 rule IDs in current view
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-12">
              <svg className="w-10 h-10 mx-auto mb-3 text-soc-stext/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
              <h3 className="text-lg font-medium mb-2">No data found</h3>
              <p className="text-sm mb-4">
                No alerts in <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">{index}</code>
                <br />for the selected time range
              </p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => doSearch({ index: 'unishield360-alerts-*' })} className="gbtn gbtn-ghost text-sm">Try unishield360-alerts-*</button>
                <button onClick={() => doSearch({ index: '*' })} className="gbtn gbtn-ghost text-sm">Try all indices</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <ResultsTable
            ruleMatches={applyRules ? (groupFilter.length > 0
              ? Object.fromEntries(Object.entries(ruleMatches).filter(([idx]) => filteredIds.includes(parseInt(idx))))
              : ruleMatches
            ) : null}
            groupMap={groupMap}
          />
        </div>
      )}
    </motion.div>
  )
}
