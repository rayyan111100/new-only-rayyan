import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import DateRangePicker from './DateRangePicker'
import RefreshInterval from './RefreshInterval'
import FilterEditor from './FilterEditor'
import { parseDql } from '../utils'

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

const OP_LABELS = {
  'is': ':',
  'is not': '\u2260',
  'is one of': 'in',
  'is not one of': 'not in',
  'contains': '\u007E',
  'does not contain': '!\u007E',
  'starts with': '^',
  'ends with': '$',
  'matches regex': '/regex/',
  'wildcard': '*?',
  'last N': 'last',
  'exists': 'exists',
  'does not exist': '!exists',
  'is greater than': '>',
  'is greater than or equal': '\u2265',
  'is less than': '<',
  'is less than or equal': '\u2264',
  'is between': 'between',
  'is not between': '!between'
}

function FilterChip({ filter, onEdit, onRemove, onToggle, onToggleDisabled, onTogglePin, onInvert, onCopyDql, onSaveFilter }) {
  const opLabel = OP_LABELS[filter.operator] || ':'
  const isNeg = filter.negate
  const isExists = filter.operator === 'exists' || filter.operator === 'does not exist'
  const isRange = filter.operator === 'is between' || filter.operator === 'is not between'
  const isList = filter.operator === 'is one of' || filter.operator === 'is not one of'
  const disabled = filter.disabled
  const pinned = filter.pinned
  const [showMenu, setShowMenu] = useState(false)

  let displayVal = filter.value
  if (isExists) displayVal = ''
  else if (isRange) {
    const to = filter.secondValue?.to || filter.params?.to || ''
    displayVal = `${filter.value} to ${to}`
  }
  else if (isList) displayVal = filter.value

  const getDqlText = () => {
    const neg = isNeg ? 'NOT ' : ''
    return `${neg}${filter.field}${opLabel}${displayVal || ''}`
  }

  const handleCopyDql = (e) => {
    e.stopPropagation()
    navigator.clipboard?.writeText(getDqlText())
    setShowMenu(false)
  }

  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: disabled ? 0.4 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`relative inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border-2 group transition-all shadow-md ${
        disabled
          ? 'bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800/50 dark:border-gray-600 dark:text-gray-500 line-through'
          : isNeg
            ? 'bg-red-100 border-red-400 text-red-800 dark:bg-red-900/40 dark:border-red-600 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/60'
            : 'bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/60'
      } ${pinned ? 'ring-2 ring-purple-500 dark:ring-purple-400' : ''}`}
      title={`${disabled ? '[Disabled] ' : ''}${pinned ? '[Pinned] ' : ''}${isNeg ? 'NOT ' : ''}${filter.field} ${opLabel} ${displayVal || ''}`}
    >
      {pinned && <span className="text-[8px] mr-0.5" title="Pinned"><svg className="w-2.5 h-2.5 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/></svg></span>}
      <span className="flex items-center gap-1 cursor-pointer" onClick={() => onEdit?.(filter)}>
        {isNeg && <span className="font-black text-[10px] uppercase mr-0.5 px-1 py-0.5 rounded bg-red-200 dark:bg-red-800">NOT</span>}
        <span className="max-w-[100px] truncate font-bold">{filter.customLabel || filter.field}</span>
        <span className="opacity-70 mx-0.5">{opLabel}</span>
        {displayVal && <span className="max-w-[90px] truncate font-semibold">{displayVal}</span>}
      </span>

      <span className="ml-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isNeg && !disabled && (
          <button onClick={e => { e.stopPropagation(); onToggle?.(filter.id, false) }}
            className="w-6 h-6 flex items-center justify-center rounded-lg font-black leading-none text-sm transition-all bg-blue-500 text-white hover:bg-blue-600 hover:scale-125 hover:shadow-lg shadow-sm"
            title="Filter for (include)">+</button>
        )}
        {!isNeg && !disabled && (
          <button onClick={e => { e.stopPropagation(); onToggle?.(filter.id, true) }}
            className="w-6 h-6 flex items-center justify-center rounded-lg font-black leading-none text-sm transition-all bg-red-500 text-white hover:bg-red-600 hover:scale-125 hover:shadow-lg shadow-sm"
            title="Filter out (exclude)">&ndash;</button>
        )}
        <button onClick={e => { e.stopPropagation(); onToggleDisabled?.(filter.id) }}
          className={`w-5 h-5 flex items-center justify-center rounded-md hover:bg-black/20 dark:hover:bg-white/20 font-bold leading-none text-[11px] transition-all ${disabled ? 'text-green-500 hover:text-green-600' : 'text-soc-stext dark:text-soc-darkstext'}`}
          title={disabled ? 'Enable' : 'Disable'}>{disabled ? <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> : <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>}</button>
        <button onClick={e => { e.stopPropagation(); onTogglePin?.(filter.id) }}
          className={`w-5 h-5 flex items-center justify-center rounded-md hover:bg-black/20 dark:hover:bg-white/20 text-[11px] transition-all ${pinned ? 'text-purple-500' : 'text-soc-stext dark:text-soc-darkstext'}`}
          title={pinned ? 'Unpin' : 'Pin'}><svg className="w-3 h-3 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/></svg></button>
        <button onClick={e => { e.stopPropagation(); onInvert?.(filter.id) }}
          className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-black/20 dark:hover:bg-white/20 text-[11px] transition-all"
          title="Invert"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg></button>
        <div className="relative">
          <button onClick={e => { e.stopPropagation(); setShowMenu(!showMenu) }}
            className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-black/20 dark:hover:bg-white/20 text-xs font-bold transition-all"
            title="More">...</button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded shadow-lg py-1 min-w-[130px]">
                <button onClick={handleCopyDql} className="w-full text-left px-2.5 py-1 text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext transition-colors whitespace-nowrap"><svg className="w-3 h-3 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> Copy DQL</button>
                <button onClick={e => { e.stopPropagation(); onSaveFilter?.(filter); setShowMenu(false) }} className="w-full text-left px-2.5 py-1 text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext transition-colors whitespace-nowrap"><svg className="w-3 h-3 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg> Save as filter</button>
                <button onClick={e => { e.stopPropagation(); onRemove(filter.id); setShowMenu(false) }} className="w-full text-left px-2.5 py-1 text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-red-500 transition-colors whitespace-nowrap"><svg className="w-3 h-3 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg> Remove</button>
              </div>
            </>
          )}
        </div>
      </span>
    </motion.span>
  )
}

export default function QueryBar() {
  const { dql, setDql, filters, removeFilter, addFilter, editFilter, doSearch, loading, index, setIndex, limit, setLimit, startDate, setStartDate, endDate, setEndDate, filterMatch, setFilterMatch, isDark, clearAllFilters } = useApp()
  const [showAddFilter, setShowAddFilter] = useState(false)
  const [showQuick, setShowQuick] = useState(false)
  const [editingFilter, setEditingFilter] = useState(null)
  const [showSavedFilters, setShowSavedFilters] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const dqlRef = useRef(dql)
  dqlRef.current = dql

  const savedFilters = JSON.parse(localStorage.getItem('savedFilters') || '[]')

  const handleKeyDown = e => {
    if (e.key === 'Enter') {
      submitSearch(e.target.value)
    }
  }

  const handleSearchClick = () => {
    submitSearch(dqlRef.current)
  }

  function submitSearch(val) {
    if (!val) { setDql(''); doSearch({ q: '' }); return }

    // Try to split complex DQL (AND/OR) into multiple filters
    const parts = splitDql(val)
    if (parts.length > 0) {
      parts.forEach(p => addFilter(p.field, p.value, false, p.operator))
      setDql('')
      doSearch({ q: '' })
      return
    }

    // Simple field:value → single filter chip
    const parsed = parseDql(val)
    if (parsed) {
      addFilter(parsed.field, parsed.value, false, parsed.operator)
      setDql('')
      doSearch({ q: '' })
    } else {
      setDql(val)
      doSearch({ q: val })
    }
  }

  // Split "rule.level:>=12 OR agent.name:*" into multiple filters
  // Split on AND/OR, parse each part individually
  function splitDql(input) {
    if (!input) return []
    const trimmed = input.trim()
    let matchMode = ''
    let rawParts = []

    if (/\bOR\b/i.test(trimmed)) {
      matchMode = 'or'
      rawParts = trimmed.split(/\s+OR\s+/i)
    } else if (/\bAND\b/i.test(trimmed)) {
      matchMode = 'and'
      rawParts = trimmed.split(/\s+AND\s+/i)
    } else {
      return [] // not a complex query
    }

    const filters = rawParts.map(p => parseDql(p)).filter(Boolean)
    if (filters.length < 2) return [] // failed to parse, fall back to raw

    // Set filter match mode
    setFilterMatch(matchMode)

    return filters
  }

  const handleEdit = (filter) => {
    setEditingFilter(filter)
    setShowAddFilter(true)
  }

  const handleEditorSave = (updated) => {
    editFilter(updated.id, updated)
    doSearch()
  }

  const handleEditorClose = () => {
    setShowAddFilter(false)
    setEditingFilter(null)
  }

  const applyQuick = (c) => {
    setStartDate(c.start); setEndDate(c.end); setShowQuick(false); doSearch()
  }

  const handleToggleFilter = (id, negate) => {
    const f = filters.find(fi => fi.id === id)
    if (f) { editFilter(id, { negate, disabled: false, operator: negate ? 'is not' : 'is' }); doSearch() }
  }

  const handleToggleDisabled = (id) => {
    const f = filters.find(fi => fi.id === id)
    if (f) { editFilter(id, { disabled: !f.disabled }); doSearch() }
  }

  const handleTogglePin = (id) => {
    const f = filters.find(fi => fi.id === id)
    if (f) { editFilter(id, { pinned: !f.pinned }); doSearch() }
  }

  const handleInvert = (id) => {
    const f = filters.find(fi => fi.id === id)
    if (f) { editFilter(id, { negate: !f.negate, operator: !f.negate ? 'is not' : 'is' }); doSearch() }
  }

  const handleSaveFilter = (filter) => {
    setEditingFilter({ ...filter, id: null })
    setShowAddFilter(true)
  }

  const toggleMatchMode = () => {
    const next = filterMatch === 'and' ? 'or' : 'and'
    setFilterMatch(next)
    doSearch({ filterMatch: next })
  }

  const handleSaveFilterSet = () => {
    if (!saveName.trim()) return
    const list = JSON.parse(localStorage.getItem('savedFilters') || '[]')
    list.push({ name: saveName.trim(), filters: JSON.parse(JSON.stringify(filters)), dql, filterMatch, date: new Date().toISOString() })
    localStorage.setItem('savedFilters', JSON.stringify(list))
    setSaveDialogOpen(false)
    setSaveName('')
  }

  const handleLoadFilterSet = (sf) => {
    if (!sf.filters || !sf.filters.length) return
    const pinned = filters.filter(f => f.pinned)
    const restored = JSON.parse(JSON.stringify(sf.filters))
    const allFilters = [...pinned, ...restored]
    filters.length = 0
    allFilters.forEach(f => addFilter(f.field, f.value, f.negate, f.operator, f.params))
    if (sf.dql) setDql(sf.dql)
    if (sf.filterMatch) setFilterMatch(sf.filterMatch)
    doSearch()
    setShowSavedFilters(false)
  }

  const handleDeleteSaved = (idx) => {
    const list = JSON.parse(localStorage.getItem('savedFilters') || '[]')
    list.splice(idx, 1)
    localStorage.setItem('savedFilters', JSON.stringify(list))
  }

  const handleExport = () => {
    const list = JSON.parse(localStorage.getItem('savedFilters') || '[]')
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'saved-filters.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result)
          if (Array.isArray(imported)) {
            const existing = JSON.parse(localStorage.getItem('savedFilters') || '[]')
            localStorage.setItem('savedFilters', JSON.stringify([...existing, ...imported]))
          }
        } catch {}
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const bg = isDark ? 'bg-soc-darkpanel border-soc-darkborder' : 'bg-white border-soc-border'

  return (
    <div className="space-y-1.5">
      <div className={`flex items-center gap-1.5 px-2 py-1 border rounded ${bg}`}>
        <div className="relative">
          <button
            onClick={() => setShowSavedFilters(!showSavedFilters)}
            className="text-xs text-soc-stext dark:text-soc-darkstext p-0.5 hover:opacity-70 shrink-0"
            title="Saved queries"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></button>
          <AnimatePresence>
            {showSavedFilters && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="gcard absolute top-full left-0 mt-1 z-50 w-64 p-2 shadow-xl"
              >
                <div className="text-[10px] font-semibold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wide mb-1.5">Saved Filters</div>
                {savedFilters.length === 0 ? (
                  <div className="text-[10px] text-[#9ca3af] py-2 text-center">No saved filters yet</div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {savedFilters.map((sf, i) => (
                      <div key={i} className="flex items-center gap-1 group">
                        <button onClick={() => handleLoadFilterSet(sf)}
                          className="flex-1 text-left px-2 py-1 text-[10px] rounded hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext truncate transition-colors">
                          <span className="font-medium">{sf.name}</span>
                          <span className="text-[8px] text-[#9ca3af] ml-1">({sf.filters?.length || 0} filters)</span>
                        </button>
                        <button onClick={() => { const n = prompt('Rename to:', sf.name); if (n && n.trim()) { const list = JSON.parse(localStorage.getItem('savedFilters') || '[]'); list[i].name = n.trim(); localStorage.setItem('savedFilters', JSON.stringify(list)) } }}
                          className="opacity-0 group-hover:opacity-100 px-1 text-[9px] text-soc-stext dark:text-soc-darkstext hover:text-blue-500 transition-all"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button onClick={() => { if (confirm('Delete saved filter?')) handleDeleteSaved(i) }}
                          className="opacity-0 group-hover:opacity-100 px-1 text-[9px] text-soc-stext dark:text-soc-darkstext hover:text-red-500 transition-all"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-[#e5e7eb] dark:border-[#2d3140] mt-1.5 pt-1.5 flex gap-1">
                  <button onClick={() => { setSaveDialogOpen(true); setShowSavedFilters(false) }}
                    className="flex-1 text-[9px] py-1 rounded text-[#EF843C] dark:text-[#EF843C] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors"><svg className="w-3 h-3 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Save current</button>
                  <button onClick={handleExport}
                    className="text-[9px] px-2 py-1 rounded text-[#EF843C] dark:text-[#EF843C] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors" title="Export"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button>
                  <button onClick={handleImport}
                    className="text-[9px] px-2 py-1 rounded text-[#EF843C] dark:text-[#EF843C] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors" title="Import"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <input
            type="text"
            value={dql}
            onChange={e => setDql(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search — rule.level:>=12 OR agent.name:*"
            className="flex-1 min-w-[60px] px-1.5 py-1 text-xs border-none outline-none rounded ginput"
          />
          <span className="text-[10px] font-semibold text-soc-stext dark:text-soc-darkstext uppercase px-1.5 py-0.5 rounded border border-soc-border dark:border-soc-darkborder shrink-0">DQL</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowQuick(!showQuick) }}
              className="px-1 py-1 text-xs rounded text-soc-stext dark:text-soc-darkstext hover:bg-soc-border/30 dark:hover:bg-soc-darkborder/30"
              title="Quick date select"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></button>
            <AnimatePresence>
              {showQuick && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className={'gcard absolute top-full right-0 mt-1 z-30 w-48 p-2 shadow-lg'}
                >
                  <div className="text-xs font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wide mb-1">Commonly used</div>
                  {COMMON.map((c, i) => (
                    <button key={i} onClick={() => applyQuick(c)}
                      className="block w-full text-left px-2 py-1 text-xs rounded text-[#EF843C] dark:text-[#EF843C] hover:bg-soc-border/30 dark:hover:bg-soc-darkborder/30"
                    >{c.label}</button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <DateRangePicker />
          <RefreshInterval />
          <select value={limit} onChange={e => setLimit(parseInt(e.target.value))} className={'ginput px-1.5 py-1 text-xs w-12'}>
            <option>20</option><option>50</option><option>100</option><option>200</option><option>500</option>
          </select>
          <select value={index} onChange={e => setIndex(e.target.value)} className="ginput text-[10px] py-0.5 px-1 w-auto font-mono">
            <option value="unishield360-alerts-4.x-*">Alerts</option>
            <option value="unishield360-archives-4.x-*">Archives</option>
          </select>
          <button
            onClick={handleSearchClick}
            disabled={loading}
            className={`px-2 py-1 text-xs font-semibold rounded transition-all whitespace-nowrap ${loading ? 'bg-soc-stext/30 text-white cursor-not-allowed' : 'gbtn-primary'}`}
          >{loading ? <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>}</button>
        </div>
      </div>

      <div className={`flex items-center gap-1.5 flex-wrap px-3 py-2 rounded-xl border-2 ${bg} ${isDark ? 'border-soc-darkborder' : 'border-soc-border'} shadow-lg`}>
        <div className="relative">
          <button
            onClick={() => { setShowAddFilter(!showAddFilter); setEditingFilter(null) }}
            className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-[#EF843C] text-white hover:bg-[#e0752a] active:bg-[#d4661e] transition-all shadow-md hover:shadow-lg"
            title="Add filter"><svg className="w-4 h-4 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg> Filter</button>
          <AnimatePresence>
            {showAddFilter && (
              <FilterEditor
                filter={editingFilter}
                onClose={handleEditorClose}
                onSave={editingFilter ? handleEditorSave : undefined}
                anchorEl={null}
              />
            )}
          </AnimatePresence>
        </div>

        {filters.length > 1 && (
          <button
            onClick={toggleMatchMode}
            className={`text-[11px] font-black uppercase px-2.5 py-1.5 rounded-xl border-2 transition-all shadow-md hover:shadow-lg hover:scale-105 ${
              filterMatch === 'and'
                ? 'bg-indigo-200 border-indigo-500 text-indigo-800 dark:bg-indigo-900/50 dark:border-indigo-400 dark:text-indigo-200 hover:bg-indigo-300 dark:hover:bg-indigo-900/70'
                : 'bg-amber-200 border-amber-500 text-amber-800 dark:bg-amber-900/50 dark:border-amber-400 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-900/70'
            }`}
            title={`Filters match mode: ${filterMatch === 'and' ? 'ALL (AND)' : 'ANY (OR)'}. Click to toggle.`}
          >
            {filterMatch === 'and' ? 'ALL' : 'ANY'}
          </button>
        )}

        <AnimatePresence>
          {filters.filter(f => !f.pinned).map(f => (
            <React.Fragment key={f.id}>
              <FilterChip
                filter={f}
                onEdit={handleEdit}
                onRemove={(id) => { removeFilter(id); doSearch() }}
                onToggle={handleToggleFilter}
                onToggleDisabled={handleToggleDisabled}
                onTogglePin={handleTogglePin}
                onInvert={handleInvert}
                onCopyDql={() => {}}
                onSaveFilter={handleSaveFilter}
              />
            </React.Fragment>
          ))}
        </AnimatePresence>

        {filters.some(f => f.pinned) && filters.some(f => !f.pinned) && (
          <span className="text-[9px] text-[#9ca3af] mx-0.5">|</span>
        )}

        <AnimatePresence>
          {filters.filter(f => f.pinned).map(f => (
            <React.Fragment key={f.id}>
              <FilterChip
                filter={f}
                onEdit={handleEdit}
                onRemove={(id) => { removeFilter(id); doSearch() }}
                onToggle={handleToggleFilter}
                onToggleDisabled={handleToggleDisabled}
                onTogglePin={handleTogglePin}
                onInvert={handleInvert}
                onCopyDql={() => {}}
                onSaveFilter={handleSaveFilter}
              />
            </React.Fragment>
          ))}
        </AnimatePresence>

        <button onClick={() => { setShowAddFilter(true); setEditingFilter(null) }} className="text-xs font-bold text-white bg-[#EF843C] hover:bg-[#e0752a] active:bg-[#d4661e] px-3 py-1.5 rounded-xl transition-all shadow-md hover:shadow-lg hover:scale-105">+ Add filter</button>

        {filters.length > 0 && (
          <button onClick={() => {
            const unpinned = filters.filter(f => !f.pinned)
            unpinned.forEach(f => removeFilter(f.id))
            if (unpinned.length > 0) doSearch()
          }} className="text-xs font-bold text-red-500 hover:text-white hover:bg-red-500 dark:text-red-400 dark:hover:text-white dark:hover:bg-red-500 px-2.5 py-1.5 rounded-xl border-2 border-red-300 dark:border-red-700 transition-all shadow-sm hover:shadow-md hover:scale-105" title="Clear all (pinned filters stay)">
            Clear
          </button>
        )}

      </div>

      <AnimatePresence>
        {saveDialogOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setSaveDialogOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ type: 'spring', duration: 0.25, bounce: 0.15 }}
              className="gcard w-[420px] shadow-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden"
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140] bg-gradient-to-r from-[#f9fafb] to-white dark:from-[#111318] dark:to-[#1a1d27]">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-[#EF843C] flex items-center justify-center text-white text-xs"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg></span>
                  <span className="text-xs font-semibold text-[#202124] dark:text-[#e8eaed]">Saved Filters</span>
                  <span className="text-[9px] text-[#9ca3af] bg-[#f3f4f6] dark:bg-[#2d3140] px-1.5 py-0.5 rounded-full">{savedFilters.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={handleExport} className="w-6 h-6 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#EF843C] dark:hover:text-[#EF843C] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-all text-[11px]" title="Export as JSON"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button>
                  <button onClick={handleImport} className="w-6 h-6 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#EF843C] dark:hover:text-[#EF843C] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-all text-[11px]" title="Import from JSON"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg></button>
                  <button onClick={() => setSaveDialogOpen(false)} className="w-6 h-6 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#202124] dark:hover:text-[#e8eaed] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-all text-xs font-bold">&times;</button>
                </div>
              </div>

              <div className="px-4 py-3">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input value={saveName} onChange={e => setSaveName(e.target.value)}
                      placeholder="Name your filter set..."
                      className="ginput w-full pl-7 pr-2 py-1.5 text-xs"
                      onKeyDown={e => e.key === 'Enter' && handleSaveFilterSet()} />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#9ca3af] text-[11px]"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
                  </div>
                  <button onClick={handleSaveFilterSet}
                    disabled={!saveName.trim()}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#EF843C] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shrink-0 flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Save
                  </button>
                </div>
              </div>

              <div className="px-4 pb-3">
                {savedFilters.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-[#9ca3af]">
                    <span className="text-2xl mb-2 opacity-50"><svg className="w-8 h-8 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></span>
                    <span className="text-[11px] font-medium">No saved filters yet</span>
                    <span className="text-[10px] mt-0.5">Create your first filter set above</span>
                  </div>
                ) : (
                  <div className="border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-[#f9fafb] dark:bg-[#111318] text-left border-b border-[#e5e7eb] dark:border-[#2d3140]">
                          <th className="px-3 py-2 font-medium text-[#5f6368] dark:text-[#9aa0a6]">Name</th>
                          <th className="px-3 py-2 font-medium text-[#5f6368] dark:text-[#9aa0a6] w-16 text-center">Filters</th>
                          <th className="px-3 py-2 font-medium text-[#5f6368] dark:text-[#9aa0a6] w-20 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e7eb]/50 dark:divide-[#2d3140]/50">
                        {savedFilters.map((sf, i) => (
                          <tr key={i} className="group hover:bg-[#f9fafb] dark:hover:bg-[#111318]/80 transition-colors">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded bg-[#e8f0fe] dark:bg-[#2d3140] flex items-center justify-center text-[9px] text-[#EF843C] dark:text-[#EF843C] shrink-0"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
                                <button onClick={() => handleLoadFilterSet(sf)}
                                  className="text-left text-[#EF843C] dark:text-[#EF843C] hover:underline font-medium truncate max-w-[160px] block leading-tight">
                                  {sf.name}
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#9ca3af] bg-[#f3f4f6] dark:bg-[#2d3140] px-1.5 py-0.5 rounded-full">
                                {sf.filters?.length || 0}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-0.5">
                                <button onClick={() => { const n = prompt('Rename:', sf.name); if (n && n.trim()) { const list = JSON.parse(localStorage.getItem('savedFilters') || '[]'); list[i].name = n.trim(); localStorage.setItem('savedFilters', JSON.stringify(list)); setSaveDialogOpen(false); setTimeout(() => setSaveDialogOpen(true), 50) } }}
                                  className="w-6 h-6 flex items-center justify-center rounded text-[#9ca3af] hover:text-blue-500 hover:bg-[#e8f0fe] dark:hover:bg-[#2d3140] transition-all text-[11px]" title="Rename"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                <button onClick={() => { if (confirm('Delete this saved filter set?')) { handleDeleteSaved(i); setSaveDialogOpen(false); setTimeout(() => setSaveDialogOpen(true), 50) } }}
                                  className="w-6 h-6 flex items-center justify-center rounded text-[#9ca3af] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-[11px]" title="Delete">Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#e5e7eb] dark:border-[#2d3140] bg-[#f9fafb] dark:bg-[#111318]">
                <span className="text-[9px] text-[#9ca3af]">Save & manage filter sets</span>
                <button onClick={() => setSaveDialogOpen(false)}
                  className="px-3 py-1 text-[11px] font-medium rounded-lg text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#e5e7eb] dark:hover:bg-[#2d3140] transition-colors">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


