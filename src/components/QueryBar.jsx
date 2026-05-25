import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import DateRangePicker from './DateRangePicker'
import RefreshInterval from './RefreshInterval'

const COMMON = [
  { label: 'Today', start: 'now/d', end: 'now' },
  { label: 'This week', start: 'now/w', end: 'now' },
  { label: 'Last 15 min', start: 'now-15m', end: 'now' },
  { label: 'Last 30 min', start: 'now-30m', end: 'now' },
  { label: 'Last 1 hour', start: 'now-1h', end: 'now' },
  { label: 'Last 24 hours', start: 'now-24h', end: 'now' },
  { label: 'Last 7 days', start: 'now-7d', end: 'now' },
  { label: 'Last 30 days', start: 'now-30d', end: 'now' },
  { label: 'Last 90 days', start: 'now-90d', end: 'now' },
  { label: 'Last 1 year', start: 'now-1y', end: 'now' }
]

export default function QueryBar() {
  const { dql, setDql, filters, removeFilter, addFilter, doSearch, loading, fields, index, setIndex, limit, setLimit, startDate, setStartDate, endDate, setEndDate, isDark } = useApp()
  const [showAddFilter, setShowAddFilter] = useState(false)
  const [showQuick, setShowQuick] = useState(false)
  const [afield, setAfield] = useState('')
  const [aval, setAval] = useState('')
  const [aneg, setAneg] = useState(false)

  const handleKeyDown = e => { if (e.key === 'Enter') doSearch() }

  const doAddFilter = () => {
    if (!afield || !aval) return
    addFilter(afield, aval, aneg)
    setShowAddFilter(false)
    setAfield(''); setAval(''); setAneg(false)
    doSearch()
  }

  const applyQuick = (c) => {
    setStartDate(c.start); setEndDate(c.end); setShowQuick(false); doSearch()
  }

  const bg = isDark ? 'bg-soc-darkpanel border-soc-darkborder' : 'bg-white border-soc-border'

  return (
    <div className="space-y-1.5">
      <div className={`flex items-center gap-1.5 px-2 py-1 border rounded ${bg}`}>
        <button className="text-xs text-soc-stext dark:text-soc-darkstext p-0.5 hover:opacity-70 shrink-0" title="Saved queries">{'\uD83D\uDCC2'}</button>
        <input
          type="text"
          value={dql}
          onChange={e => setDql(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search — rule.level:>=12 OR agent.name:*"
          className={`flex-1 min-w-[80px] px-1.5 py-1 text-xs border-none outline-none rounded ginput`}
        />
        <span className="text-[10px] font-semibold text-soc-stext dark:text-soc-darkstext uppercase px-1.5 py-0.5 rounded border border-soc-border dark:border-soc-darkborder shrink-0">DQL</span>

        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowQuick(!showQuick) }}
            className="px-1 py-1 text-xs rounded text-soc-stext dark:text-soc-darkstext hover:bg-soc-border/30 dark:hover:bg-soc-darkborder/30 shrink-0"
            title="Quick date select"
          >{'\uD83D\uDCC5'}</button>
          <AnimatePresence>
            {showQuick && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className={`gcard absolute top-full right-0 mt-1 z-30 w-48 p-2 shadow-lg`}
              >
                <div className="text-xs font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wide mb-1">Commonly used</div>
                {COMMON.map((c, i) => (
                  <button key={i} onClick={() => applyQuick(c)}
                    className="block w-full text-left px-2 py-1 text-xs rounded text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-soc-border/30 dark:hover:bg-soc-darkborder/30"
                  >{c.label}</button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DateRangePicker />
        <RefreshInterval />
        <select value={limit} onChange={e => setLimit(parseInt(e.target.value))} className={`ginput px-1.5 py-1 text-xs w-14`}>
          <option>20</option><option>50</option><option>100</option><option>200</option><option>500</option>
        </select>
        <select value={index} onChange={e => setIndex(e.target.value)} className={`ginput px-1.5 py-1 text-xs max-w-[140px] hidden md:block`} title="Index pattern">
          <option value="wazuh-alerts-4.x-*">wazuh-alerts-4.x-*</option>
          <option value="wazuh-alerts-*">wazuh-alerts-*</option>
          <option value="*">* (all)</option>
        </select>
        <button
          onClick={() => doSearch()}
          disabled={loading}
          className={`px-2.5 py-1 text-xs font-semibold rounded transition-all whitespace-nowrap shrink-0 ${
            loading ? 'bg-soc-stext/30 text-white cursor-not-allowed' : 'gbtn-primary'
          }`}
        >{loading ? '\u23F3' : '\u27F3'}</button>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setShowAddFilter(!showAddFilter)}
            className={`px-1.5 py-0.5 text-[10px] border rounded ${bg} ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}
          >{'\uD83D\uDD3D'}</button>
          <AnimatePresence>
            {showAddFilter && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className={`gcard absolute top-full left-0 mt-1 z-30 p-2 shadow-lg`} style={{ width: 260 }}
              >
                <select value={afield} onChange={e => setAfield(e.target.value)} className={`ginput w-full px-2 py-1 text-xs mb-1`}>
                  <option value="">Select field...</option>
                  {fields.slice(0, 50).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                </select>
                <input type="text" value={aval} onChange={e => setAval(e.target.value)} placeholder="Value" className={`ginput w-full px-2 py-1 text-xs mb-1`} onKeyDown={e => e.key === 'Enter' && doAddFilter()} />
                <label className={`flex items-center gap-1 text-xs mb-1 ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}>
                  <input type="checkbox" checked={aneg} onChange={e => setAneg(e.target.checked)} /> Negate (NOT)
                </label>
                <div className="flex gap-1">
                  <button onClick={() => setShowAddFilter(false)} className={`px-2 py-0.5 text-xs border rounded ${isDark ? 'border-soc-darkborder text-soc-darkstext' : 'border-soc-border text-soc-stext'}`}>Cancel</button>
                  <button onClick={doAddFilter} className="gbtn-primary px-2 py-0.5 text-xs font-semibold rounded">Add</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {filters.map(f => (
            <motion.span
              key={f.id} layout
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xxs font-medium border ${
                f.negate
                  ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
                  : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
              }`}
            >
              {f.negate && <span className="font-bold text-[9px] uppercase">NOT</span>}
              <span>{f.field}</span>
              <span className="opacity-50">:</span>
              <span className="max-w-[80px] truncate">{f.value}</span>
              <button onClick={() => { removeFilter(f.id); doSearch() }} className="ml-0.5 hover:opacity-70 font-bold leading-none">&times;</button>
            </motion.span>
          ))}
        </AnimatePresence>
        <button onClick={() => setShowAddFilter(true)} className="text-[10px] text-[#1a73e8] dark:text-[#8ab4f8] hover:underline px-1">+ Add filter</button>
      </div>
    </div>
  )
}
