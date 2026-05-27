import React from 'react'
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
      <button onClick={e => { e.stopPropagation(); h(false) }} className="p-0.5 hover:text-[#1a73e8] dark:hover:text-[#8ab4f8]" title="Filter for">
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
  boolean: { icon: '\u2713', color: '#1ea59a' },
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
  const { addFilter, doSearch, isDark, toggleColumn, setTab } = useApp()
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
    const paths = extractFieldPaths(doc).filter(p => !p.startsWith('_') && p !== 'id' && !p.startsWith('@'))
    const valFields = paths.slice(0, 10)
    const conditions = valFields.map(p => ({
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      field: p,
      operator: 'equals',
      value: String(p.split('.').reduce((o, k) => o?.[k], doc) ?? '')
    }))
    try {
      const stored = JSON.parse(sessionStorage.getItem('ruleFields') || '[]')
      const merged = [...new Set([...stored, ...paths])].sort((a, b) => a.localeCompare(b))
      sessionStorage.setItem('ruleFields', JSON.stringify(merged))
    } catch {}
    try {
      const rule = createRule({ name: 'From event' })
      const patched = { ...rule, conditions }
      updateRule(rule.id, patched)
    } catch {}
    setTab('rules')
  }

  const actionBtn = (onClick, title, svg, color = 'text-soc-stext dark:text-soc-darkstext') => (
    <button onClick={onClick} className={`p-0.5 rounded hover:bg-[#1a73e8]/15 ${color} hover:text-[#1a73e8] dark:hover:text-[#8ab4f8] transition-colors`} title={title}>
      {svg}
    </button>
  )

  return (
    <div className={`border-t ${isDark ? 'border-soc-darkborder' : 'border-soc-border'}`}>
      <div className="flex border-b border-soc-border/50 dark:border-soc-darkborder/50">
        <button onClick={() => setView('table')} className={`px-3 py-1 text-xs font-medium border-b-2 transition-colors ${view === 'table' ? 'border-[#1a73e8] text-[#1a73e8] dark:border-[#8ab4f8] dark:text-[#8ab4f8]' : 'border-transparent text-soc-stext dark:text-soc-darkstext'}`}>Table</button>
        <button onClick={() => setView('json')} className={`px-3 py-1 text-xs font-medium border-b-2 transition-colors ${view === 'json' ? 'border-[#1a73e8] text-[#1a73e8] dark:border-[#8ab4f8] dark:text-[#8ab4f8]' : 'border-transparent text-soc-stext dark:text-soc-darkstext'}`}>JSON</button>
        <span className="ml-auto flex items-center pr-1">
          <button onClick={handleCreateRule} className="px-2 py-0.5 text-[10px] font-medium rounded bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-all" title="Create rule from this event">{'\u2795'} Rule</button>
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
                        <span className="flex items-center justify-center shrink-0" style={{ width: 18, height: 18, borderRadius: 3, border: `1px solid ${tok.color}40`, color: tok.color, fontSize: 9, fontWeight: 700, lineHeight: 1 }}>{tok.icon}</span>
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

function RuleBadge({ severity, name }) {
  const cls = ({
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 ring-1 ring-red-400/30',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 ring-1 ring-orange-400/30',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 ring-1 ring-yellow-400/30',
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 ring-1 ring-green-400/30',
    info: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400 ring-1 ring-gray-400/20'
  })[severity] || ''
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${cls}`}><span className="shrink-0">{'\u2699'}</span><span className="truncate max-w-[120px]">{name}</span></span>
}

export default function ResultsTable({ ruleMatches = null, results: propResults = null, total: propTotal = null, loading: propLoading = null, error: propError = null }) {
  const { results: ctxResults, total: ctxTotal, columns, toggleColumn, moveColumn, doSort, sortField, sortOrder, loading: ctxLoading, error: ctxError, isDark, fields, loadFields } = useApp()
  const results = propResults ?? ctxResults
  const total = propTotal ?? ctxTotal
  const loading = propLoading ?? ctxLoading
  const error = propError ?? ctxError
  const [expanded, setExpanded] = React.useState({})
  const [fieldsOpen, setFieldsOpen] = React.useState(false)
  const [fieldSearch, setFieldSearch] = React.useState('')
  const toggleRow = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  React.useEffect(() => { loadFields() }, [])
  React.useEffect(() => {
    function handleClick(e) { if (!e.target.closest('.fields-dropdown')) setFieldsOpen(false) }
    document.addEventListener('mousedown', handleClick); return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (error) return <div className="p-3 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">{'\u274C'} {error}</div>
  if (loading && !results.length) return <div className="p-4 text-xs text-center text-soc-stext dark:text-soc-darkstext">{'\u23F3'} Searching...</div>
  if (!results.length) return <div className="p-4 text-xs text-center text-soc-stext dark:text-soc-darkstext">{'\u2705'} No results</div>

  return (
    <div>
      <div className="text-xs text-soc-stext dark:text-soc-darkstext mb-1 px-0.5 flex items-center gap-3">
        <span><b className="text-soc-text dark:text-soc-darktext">{total.toLocaleString()}</b> results ({results.length} shown)</span>
        <div className="fields-dropdown relative">
          <button onClick={() => { setFieldsOpen(o => !o); loadFields() }}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-[#1a73e8] dark:text-[#8ab4f8] hover:underline">
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

              {columns.map(c => (
                <th key={c} className="p-0 border-b border-soc-border dark:border-soc-darkborder">
                  <div className="th-wrap flex items-center gap-1 px-1.5 py-1">
                    <span className="font-semibold text-[#1a73e8] dark:text-[#8ab4f8] cursor-pointer text-xxs" onClick={() => toggleColumn(c)}>{c}</span>
                    <span className="th-actions flex items-center gap-0.5 ml-auto">
                      <span className="th-act text-[9px]" onClick={() => doSort(c)} title="Sort">
                        {sortField === c ? (sortOrder === 'asc' ? '\u25B2' : '\u25BC') : '\u25B4\u25BE'}
                      </span>
                      <span className="th-act text-[9px]" onClick={() => moveColumn(c, -1)} title="Left">{'\u25C0'}</span>
                      <span className="th-act text-[9px]" onClick={() => moveColumn(c, 1)} title="Right">{'\u25B6'}</span>
                      <span className="th-act th-act-danger text-[9px]" onClick={() => toggleColumn(c)} title="Remove">{'\u2715'}</span>
                    </span>
                  </div>
                </th>
              ))}
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
                      {match ? <span className="text-purple-500 mr-0.5" title={`Rule: ${match.ruleName}`}>{'\u2699'}</span> : null}
                      {isExp ? '\u25BC' : '\u25B6'}
                    </td>
                    {columns.map(c => {
                      if (c === 'Rule') {
                        return (
                          <td key="Rule" className="px-1.5 py-1">
                            {match ? <RuleBadge severity={match.severity} name={match.ruleName} /> : <span className="text-soc-stext/40 dark:text-soc-darkstext/40">{'\u2014'}</span>}
                          </td>
                        )
                      }
                      let v = resolveField(row, c)
                      const raw = String(v ?? '')
                      let disp
                      if (c === 'rule.description' && match?.message) {
                        disp = <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" title="Rule override" />{match.message}</span>
                      } else if (c === '@timestamp' || c === 'timestamp') disp = <span className="text-soc-stext dark:text-soc-darkstext text-xxs">{raw.slice(0, 19)}</span>
                      else { let x = raw; if (x.length > 100) x = x.slice(0, 100) + '\u2026'; disp = x || '\u2014' }
                      return (
                        <td key={c} className="px-1.5 py-1 relative max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
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
    </div>
  )
}
