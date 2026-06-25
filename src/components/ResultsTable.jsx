import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { resolveField } from '../utils'
import { createRule, updateRule } from '../services/ruleStorage'

function LevelBadge({ level }) {
  const lv = parseInt(level) || 0
  const cls = lv >= 15 ? 'badge-critical' : lv >= 12 ? 'badge-high' : lv >= 7 ? 'badge-medium' : lv >= 1 ? 'badge-low' : 'badge-info'
  return <span className={`badge ${cls}`}>{level || 0}</span>
}

function FilterBtns({ field, value }) {
  const { addFilter, doSearch } = useApp()
  const h = (negate) => { addFilter(field, value, negate); doSearch() }
  return (
    <span className="cell-filters">
      <button onClick={e => { e.stopPropagation(); h(false) }} className="p-0.5 hover:text-[#EF843C] dark:hover:text-[#EF843C]" title="Filter for">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 7h3.5a.5.5 0 1 1 0 1H8v3.5a.5.5 0 1 1-1 0V8H3.5a.5.5 0 0 1 0-1H7V3.5a.5.5 0 0 1 1 0V7Z"/></svg>
      </button>
      <button onClick={e => { e.stopPropagation(); h(true) }} className="p-0.5 hover:text-red-500" title="Filter out">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 7h8a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1Z"/></svg>
      </button>
    </span>
  )
}

function getFieldType(v) {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'number') return 'number'
  if (typeof v === 'string') {
    if (/^\d{4}[-\/]\d{2}[-\/]\d{2}[T ]\d{2}:\d{2}/.test(v)) return 'date'
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) return 'ip'
    return 'string'
  }
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'object') return 'object'
  return 'string'
}

const TYPE_TOKENS = {
  string:  { icon: 'T',   color: '#7b7b7b' },
  number:  { icon: '#',   color: '#e5830e' },
  boolean: { icon: '✓', color: '#1ea59a' },
  date:    { icon: 'D',   color: '#b77c4f' },
  ip:      { icon: 'IP',  color: '#8b5cf6' },
  object:  { icon: '{}',  color: '#7b7b7b' },
  array:   { icon: '[]',  color: '#7b7b7b' },
  null:    { icon: '-',   color: '#7b7b7b' }
}

function extractFieldPaths(obj, prefix = '') {
  const paths = []
  for (const key of Object.keys(obj)) {
    const p = prefix ? `${prefix}.${key}` : key
    paths.push(p)
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      paths.push(...extractFieldPaths(obj[key], p))
    }
  }
  return paths
}

function DocViewer({ doc }) {
  const { addFilter, doSearch, isDark, toggleColumn, setTab, setPendingRuleId } = useApp()
  const [view, setView] = React.useState('table')
  const flat = React.useMemo(() => {
    const flatten = (obj, prefix) => {
      prefix = prefix || ''
      if (obj === null || obj === undefined) return [{ path: prefix || 'value', value: null }]
      if (typeof obj !== 'object') return [{ path: prefix || 'value', value: obj }]
      if (Array.isArray(obj)) {
        if (!obj.length) return [{ path: prefix || 'value', value: '' }]
        if (obj.every(v => v === null || v === undefined || typeof v !== 'object'))
          return [{ path: prefix || 'value', value: obj.join(', ') }]
        return [{ path: prefix || 'value', value: JSON.stringify(obj) }]
      }
      let result = []
      for (const k of Object.keys(obj)) {
        const p = prefix ? prefix + '.' + k : k
        result = result.concat(flatten(obj[k], p))
      }
      return result
    }
    return flatten(doc, '')
  }, [doc])

  const hFilter = (field, value, negate) => { addFilter(field, value, negate); doSearch() }
  const hExists = (field) => { addFilter(field, '__exists__', false); doSearch() }

  const handleCreateRule = () => {
    const allPaths = extractFieldPaths(doc)
    const leafPaths = allPaths.filter(p => {
      if (p.startsWith('_') || p === 'id' || p.startsWith('@')) return false
      const resolved = p.split('.').reduce((o, k) => o?.[k], doc)
      return resolved !== null && resolved !== undefined && typeof resolved !== 'object' && !Array.isArray(resolved)
    })
    const valFields = leafPaths.slice(0, 15)
    const conditions = valFields.map(p => {
      const resolved = p.split('.').reduce((o, k) => o?.[k], doc)
      const strVal = String(resolved ?? '')
      let operator = 'equals'
      if (strVal.length > 80) operator = 'contains'
      else if (p.includes('path') || p.includes('name') || p.includes('command') || p.includes('message')) operator = 'contains'
      return { id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), field: p, operator, value: strVal, logic: 'AND' }
    })
    try {
      const stored = JSON.parse(sessionStorage.getItem('ruleFields') || '[]')
      const merged = [...new Set([...stored, ...allPaths])].sort((a, b) => a.localeCompare(b))
      sessionStorage.setItem('ruleFields', JSON.stringify(merged))
    } catch {}
    try {
      const rule = createRule({
        name: 'From event',
        actions: [{ type: 'alert', params: {
          severity: doc.rule?.level >= 12 ? 'critical' : doc.rule?.level >= 7 ? 'high' : 'medium',
          level: doc.rule?.level || 5,
          message: doc.rule?.description || 'Alert matched custom rule'
        }}]
      })
      const patched = { ...rule, conditions }
      updateRule(rule.id, patched)
      setPendingRuleId(rule.id)
    } catch {}
    setTab('rules')
  }

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(doc, null, 2))
  }

  const actionBtn = (onClick, title, svg, color = 'text-soc-stext dark:text-soc-darkstext') => (
    <button onClick={onClick} className={`p-0.5 rounded hover:bg-[#EF843C]/15 ${color} hover:text-[#EF843C] dark:hover:text-[#EF843C] transition-colors`} title={title}>
      {svg}
    </button>
  )

  return (
    <div className={`border-t ${isDark ? 'border-soc-darkborder' : 'border-soc-border'}`}>
      <div className="flex border-b border-soc-border/50 dark:border-soc-darkborder/50">
        <button onClick={() => setView('table')} className={`px-3 py-1 text-xs font-medium border-b-2 transition-colors ${view === 'table' ? 'border-[#EF843C] text-[#EF843C] dark:border-[#EF843C] dark:text-[#EF843C]' : 'border-transparent text-soc-stext dark:text-soc-darkstext'}`}>Table</button>
        <button onClick={() => setView('json')} className={`px-3 py-1 text-xs font-medium border-b-2 transition-colors ${view === 'json' ? 'border-[#EF843C] text-[#EF843C] dark:border-[#EF843C] dark:text-[#EF843C]' : 'border-transparent text-soc-stext dark:text-soc-darkstext'}`}>JSON</button>
        <span className="ml-auto flex items-center gap-1 pr-1">
          <button onClick={handleCopyJson} className="px-2 py-0.5 text-[10px] font-medium rounded bg-[#e8eaed] dark:bg-[#374151] text-soc-stext dark:text-soc-darkstext hover:bg-[#d1d5db] dark:hover:bg-[#4b5563] transition-all" title="Copy document as JSON">JSON</button>
          <button onClick={handleCreateRule} className="px-2 py-0.5 text-[10px] font-medium rounded bg-[#EF843C] text-white hover:bg-[#e0752a] transition-all" title="Create rule from this event">+ Rule</button>
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {view === 'table' ? (
          <table className="w-full text-xs">
            <tbody>
              {flat.map((fld, i) => {
                const t = getFieldType(fld.value)
                const tok = TYPE_TOKENS[t]
                return (
                  <tr key={i} className={`border-b group hover:bg-soc-bg/50 dark:hover:bg-soc-darkbg/50 ${isDark ? 'border-soc-darkborder/30' : 'border-soc-border/30'}`}>
                    <td className="px-3 py-1 font-medium text-soc-stext dark:text-soc-darkstext whitespace-nowrap w-1/3 align-top">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="flex items-center justify-center shrink-0" style={{ width: 18, height: 18, borderRadius: 3, border: `1px solid ${tok.color}40`, color: tok.color, fontSize: 9, fontWeight: 600, lineHeight: 1, fontFamily: 'monospace' }}>{tok.icon}</span>
                        <span className="truncate">{fld.path}</span>
                      </span>
                    </td>
                    <td className="px-3 py-1 text-soc-text dark:text-soc-darktext break-all">{String(fld.value ?? '')}</td>
                    <td className="px-2 py-1 w-20 text-right align-top">
                      <span className="hidden group-hover:inline-flex items-center gap-0.5">
                        {actionBtn(() => hFilter(fld.path, fld.value, false), 'Filter for value',
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 7h3.5a.5.5 0 1 1 0 1H8v3.5a.5.5 0 1 1-1 0V8H3.5a.5.5 0 0 1 0-1H7V3.5a.5.5 0 0 1 1 0V7Z"/></svg>
                        )}
                        {actionBtn(() => hFilter(fld.path, fld.value, true), 'Filter out value',
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 7h8a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1Z"/></svg>,
                          'hover:text-red-500'
                        )}
                        {actionBtn(() => toggleColumn(fld.path), 'Toggle column in table',
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm2 1v3h3V4H4zm4 0v3h3V4H8zM4 8v3h3V8H4zm4 0v3h3V8H8z"/></svg>
                        )}
                        {actionBtn(() => hExists(fld.path), 'Filter for field present',
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.2"/><circle cx="8" cy="8" r="2.5" fill="currentColor"/></svg>
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <pre className="p-3 text-xxs text-soc-text dark:text-soc-darktext overflow-x-auto">{JSON.stringify(doc, null, 2)}</pre>
        )}
      </div>
    </div>
  )
}

function RuleBadge({ severity, name, groupNames }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap bg-[#f3f4f6] dark:bg-[#2d3140] text-[#6b7280] dark:text-[#9ca3af]">
      <svg className="w-3 h-3 shrink-0 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      <span className="truncate max-w-[120px]">{name}</span>
      {groupNames?.slice(0, 1).map((gn, i) => (
        <span key={i} className="text-[8px] opacity-70 hidden sm:inline">({gn})</span>
      ))}
    </span>
  )
}

export default function ResultsTable({ ruleMatches = null, groupMap = null, results: propResults = null, total: propTotal = null, loading: propLoading = null, error: propError = null }) {
  const { results: ctxResults, total: ctxTotal, browsableTotal, columns, toggleColumn, moveColumn, doSort, sortField, sortOrder, loading: ctxLoading, error: ctxError, isDark, fields, loadFields, filters, index: ctxIndex, limit, page, setPage, doSearch } = useApp()
  const index = ctxIndex
  const results = propResults ?? ctxResults
  const total = propTotal ?? ctxTotal
  const loading = propLoading ?? ctxLoading
  const error = propError ?? ctxError
  const [expanded, setExpanded] = React.useState({})
  const [fieldsOpen, setFieldsOpen] = React.useState(false)
  const [fieldSearch, setFieldSearch] = React.useState('')
  const [liveTime, setLiveTime] = useState(new Date().toLocaleTimeString())
  const [jumpInput, setJumpInput] = useState('')
  const [dragCol, setDragCol] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)

  const pageSize = limit || 50
  const effectiveTotal = Math.min(total, browsableTotal || total)
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize))
  const shownStart = (page - 1) * pageSize + 1
  const shownEnd = shownStart + results.length - 1

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return
    setPage(p)
    doSearch({ keepPage: true })
  }

  const handleDragStart = (c) => { setDragCol(c) }
  const handleDragOver = (e, c) => { e.preventDefault(); setDragOverCol(c) }
  const handleDragEnd = () => { setDragCol(null); setDragOverCol(null) }
  const handleDrop = (c) => {
    if (dragCol && dragCol !== c) {
      const from = columns.indexOf(dragCol)
      const to = columns.indexOf(c)
      if (from >= 0 && to >= 0) {
        const dir = to > from ? 1 : -1
        let current = from
        while (current !== to) {
          moveColumn(columns[current], dir)
          current += dir
        }
      }
    }
    setDragCol(null); setDragOverCol(null)
  }

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(timer)
  }, [])
  const toggleRow = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  React.useEffect(() => { loadFields() }, [])
  React.useEffect(() => {
    function handleClick(e) { if (!e.target.closest('.fields-dropdown')) setFieldsOpen(false) }
    document.addEventListener('mousedown', handleClick); return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (error) return <div className="p-3 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">{error}</div>
  if (loading && !results.length) return <div className="p-4 text-xs text-center text-soc-stext dark:text-soc-darkstext">Searching...</div>
  if (!results.length) return (
    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
      <svg className="w-10 h-10 mx-auto mb-3 text-soc-stext/30 dark:text-soc-darkstext/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <h3 className="text-lg font-medium mb-2">
        {filters && filters.length > 0 ? 'No results match your filters' : 'No data available'}
      </h3>
      <p className="text-sm">
        {filters && filters.length > 0
          ? 'Try adjusting your filters, date range, or index pattern from the search bar above'
          : `No documents found in ${index || 'current index'} for the selected time period`
        }
      </p>
    </div>
  )

  return (
    <div>
      <div className="text-xs text-soc-stext dark:text-soc-darkstext mb-1 px-0.5 flex items-center gap-3">
        <span className="font-mono text-[10px] text-soc-stext/60 dark:text-soc-darkstext/60">{liveTime}</span>
        <span className="text-soc-stext/30 dark:text-soc-darkstext/30">|</span>
        <span><b className="text-soc-text dark:text-soc-darktext">{total.toLocaleString()}</b> results</span>
        {browsableTotal && browsableTotal < total && (
          <span className="text-[9px] text-amber-600 dark:text-amber-400">(browsing first {browsableTotal.toLocaleString()})</span>
        )}
        <span className="text-soc-stext/50 dark:text-soc-darkstext/50">({shownStart}&ndash;{shownEnd} of {total.toLocaleString()})</span>
        <div className="fields-dropdown relative">
          <button onClick={() => { setFieldsOpen(o => !o); loadFields() }}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-[#EF843C] dark:text-[#EF843C] hover:underline">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            Fields <span className="text-soc-stext/50 dark:text-soc-darkstext/50">({fields.length})</span>
          </button>
          {fieldsOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 max-h-64 overflow-y-auto bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg shadow-lg z-50 p-2">
              <input autoFocus placeholder="Search fields..." value={fieldSearch} onChange={e => setFieldSearch(e.target.value)}
                className="w-full px-2 py-1 mb-1 text-[10px] bg-[#f3f4f6] dark:bg-[#2d3140] rounded outline-none text-soc-stext dark:text-soc-darkstext" />
              {fields.filter(f => {
                if (!fieldSearch) return !columns.includes(f.name)
                const q = fieldSearch.toLowerCase()
                return f.name.toLowerCase().includes(q) && !columns.includes(f.name)
              }).slice(0, 100).map(f => (
                <button key={f.name} onClick={() => { toggleColumn(f.name); setFieldsOpen(false) }}
                  className="w-full text-left px-2 py-1 text-[10px] rounded hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext truncate transition-colors">
                  {f.name}
                </button>
              ))}
              {fields.filter(f => !columns.includes(f.name)).length === 0 && (
                <div className="px-2 py-2 text-[9px] text-soc-stext/50 dark:text-soc-darkstext/50 italic text-center">All fields added</div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="gcard overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="bg-soc-bg dark:bg-soc-darkbg">
              <th className="p-0 w-7"></th>

              {columns.map((c, ci) => {
                const isOver = dragOverCol === c && dragCol !== c
                return (
                <th key={c}
                  draggable
                  onDragStart={() => handleDragStart(c)}
                  onDragOver={e => handleDragOver(e, c)}
                  onDragEnd={handleDragEnd}
                  onDrop={() => handleDrop(c)}
                  className={`p-0 border-b border-soc-border dark:border-soc-darkborder select-none ${isOver ? 'border-t-2 border-t-[#EF843C] dark:border-t-[#EF843C]' : ''} ${dragCol === c ? 'opacity-40' : ''}`}>
                  <div className="th-wrap flex items-center gap-1 px-1.5 py-1 cursor-grab active:cursor-grabbing">
                    <span className="font-semibold text-[#EF843C] dark:text-[#EF843C] cursor-pointer text-xxs" onClick={() => toggleColumn(c)}>{c}</span>
                    <span className="th-actions flex items-center gap-0.5 ml-auto">
                      <span className="th-act text-[9px]" onClick={() => doSort(c)} title="Sort">
                        {sortField === c ? (sortOrder === 'asc' ? <svg className="w-2.5 h-2.5 inline" viewBox="0 0 24 24" fill="currentColor"><polyline points="18 15 12 9 6 15"/></svg> : <svg className="w-2.5 h-2.5 inline" viewBox="0 0 24 24" fill="currentColor"><polyline points="6 9 12 15 18 9"/></svg>) : <svg className="w-2.5 h-2.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5h10M11 9h7M11 13h4"/><path d="M3 5l3 3M3 5l3-3"/><path d="M6 19l-3 3M6 19l3 3"/></svg>}
                      </span>
                      <span className="th-act text-[9px]" onClick={() => moveColumn(c, -1)} title="Left"><svg className="w-2.5 h-2.5 inline" viewBox="0 0 24 24" fill="currentColor"><polyline points="15 18 9 12 15 6"/></svg></span>
                      <span className="th-act text-[9px]" onClick={() => moveColumn(c, 1)} title="Right"><svg className="w-2.5 h-2.5 inline" viewBox="0 0 24 24" fill="currentColor"><polyline points="9 18 15 12 9 6"/></svg></span>
                      <span className="th-act th-act-danger text-[9px]" onClick={() => toggleColumn(c)} title="Remove"><svg className="w-2.5 h-2.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></span>
                    </span>
                  </div>
                </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {results.map((row, i) => {
              const rowId = String(i)
              const isExp = expanded[rowId]
              const match = ruleMatches?.[i]
              const sev = match?.severity
              const highlightClass = sev ? ({
                critical: 'bg-red-50/40 dark:bg-red-900/10',
                high: 'bg-orange-50/40 dark:bg-orange-900/10',
                medium: 'bg-yellow-50/40 dark:bg-yellow-900/10',
                low: 'bg-green-50/40 dark:bg-green-900/10',
                info: ''
              })[sev] || '' : ''
              return (
                <React.Fragment key={rowId}>
                  <tr
                    onClick={() => toggleRow(rowId)}
                    className={`cursor-pointer border-b border-soc-border/50 dark:border-soc-darkborder/50 hover:bg-soc-bg/50 dark:hover:bg-soc-darkbg/50 transition-colors ${highlightClass}`}
                  >
                    <td className="px-1 py-1 text-center text-[10px] text-soc-stext dark:text-soc-darkstext">
                      {match ? <svg className="w-3 h-3 inline text-purple-500 mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> : null}
                      {isExp ? '▾' : '▸'}
                    </td>
                    {columns.map(c => {
                      if (c === 'Rule') {
                        return (
                          <td key="Rule" className="px-1.5 py-1">
                            {match ? <RuleBadge severity={match.severity} name={match.ruleName} groupNames={match.groupNames} /> : <span className="text-soc-stext/40 dark:text-soc-darkstext/40">-</span>}
                          </td>
                        )
                      }
                      let v = resolveField(row, c)
                      const raw = String(v ?? '')
                      let disp
                      if (c === 'rule.description' && match?.message) {
                        disp = <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" title="Rule override" />{match.message}</span>
                      } else if (c === '@timestamp' || c === 'timestamp') disp = <span className="text-soc-stext dark:text-soc-darkstext text-xxs">{raw.slice(0, 19)}</span>
                      else { let x = raw; if (x.length > 100) x = x.slice(0, 100) + '...'; disp = x || '-' }
                      return (
                        <td key={c} className={`px-1.5 py-1 relative overflow-hidden text-ellipsis whitespace-nowrap ${c === 'rule.description' || c === 'full_log' ? 'min-w-[100px] max-w-[400px]' : c === '@timestamp' || c === 'timestamp' ? 'min-w-[130px] max-w-[160px]' : 'min-w-[70px] max-w-[180px]'}`}>
                          <span className="cell-val-wrap relative">
                            {disp}
                            <FilterBtns field={c} value={v} />
                          </span>
                        </td>
                      )
                    })}

                  </tr>
                  {isExp && (
                    <tr>
                      <td colSpan={columns.length + 1} className="p-0">
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ duration: 0.15 }}>
                          <DocViewer doc={row} />
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-0.5 pt-2 pb-0.5 text-xs text-soc-stext dark:text-soc-darkstext">
          <div className="flex items-center gap-2">
            <span className="text-[10px]">Page {page} of {totalPages}</span>
            <span className="text-soc-stext/30 dark:text-soc-darkstext/30">|</span>
            <form onSubmit={e => { e.preventDefault(); const p = parseInt(jumpInput); if (p >= 1 && p <= totalPages) { goToPage(p); setJumpInput('') } }} className="flex items-center gap-1">
              <span className="text-[9px] text-soc-stext/50 dark:text-soc-darkstext/50">Go to</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpInput}
                onChange={e => setJumpInput(e.target.value)}
                className="w-10 px-1 py-0.5 text-[10px] text-center bg-soc-bg dark:bg-soc-darkbg border border-soc-border/50 dark:border-soc-darkborder/50 rounded outline-none text-soc-text dark:text-soc-darktext"
                placeholder="#"
                title="Enter a page number and press Enter"
              />
            </form>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(1)}
              disabled={page <= 1}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-soc-bg dark:hover:bg-soc-darkbg transition-colors"
              title="First page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
            </button>
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-soc-bg dark:hover:bg-soc-darkbg transition-colors"
              title="Previous page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            {(() => {
              const pages = []
              const maxVisible = 7
              let s = Math.max(1, page - Math.floor(maxVisible / 2))
              let e = Math.min(totalPages, s + maxVisible - 1)
              if (e - s + 1 < maxVisible) s = Math.max(1, e - maxVisible + 1)
              if (s > 1) { pages.push(1); if (s > 2) pages.push('...') }
              for (let p = s; p <= e; p++) pages.push(p)
              if (e < totalPages) { if (e < totalPages - 1) pages.push('...'); pages.push(totalPages) }
              return pages.map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-soc-stext/40 dark:text-soc-darkstext/40">...</span>
                ) : (
                  <button
                    key={`p-${p}`}
                    onClick={() => goToPage(p)}
                    title={`Go to page ${p}`}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      p === page
                        ? 'bg-[#EF843C] text-white dark:bg-[#EF843C] dark:text-white'
                        : 'hover:bg-soc-bg dark:hover:bg-soc-darkbg text-soc-stext dark:text-soc-darkstext'
                    }`}
                  >{p}</button>
                )
              )
            })()}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-soc-bg dark:hover:bg-soc-darkbg transition-colors"
              title="Next page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
