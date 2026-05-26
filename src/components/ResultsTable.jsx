import React from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { resolveField } from '../utils'

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

function DocViewer({ doc }) {
  const { addFilter, doSearch, isDark, toggleColumn } = useApp()
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

export default function ResultsTable({ ruleMatches = null }) {
  const { results, total, columns, toggleColumn, moveColumn, doSort, sortField, sortOrder, loading, error, isDark } = useApp()
  const [expanded, setExpanded] = React.useState({})
  const toggleRow = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  if (error) return <div className="p-3 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">{'\u274C'} {error}</div>
  if (loading && !results.length) return <div className="p-4 text-xs text-center text-soc-stext dark:text-soc-darkstext">{'\u23F3'} Searching...</div>
  if (!results.length) return <div className="p-4 text-xs text-center text-soc-stext dark:text-soc-darkstext">{'\u2705'} No results</div>

  return (
    <div>
      <div className="text-xs text-soc-stext dark:text-soc-darkstext mb-1 px-0.5">
        <b className="text-soc-text dark:text-soc-darktext">{total.toLocaleString()}</b> results ({results.length} shown)
      </div>
      <div className="gcard overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="bg-soc-bg dark:bg-soc-darkbg">
              <th className="p-0 w-7"></th>
              {ruleMatches !== null && (
                <th className="p-0 border-b border-soc-border dark:border-soc-darkborder w-[130px]">
                  <div className="th-wrap flex items-center gap-1 px-1.5 py-1">
                    <span className="font-semibold text-purple-600 dark:text-purple-400 text-xxs">Rule</span>
                  </div>
                </th>
              )}
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
                      let v = resolveField(row, c)
                      const raw = String(v ?? '')
                      let disp
                      if (c === 'rule.level') {
                        const ov = match?.level
                        disp = <span className="inline-flex items-center gap-1">{ov ? <><span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" title={`Rule override: ${ov}`} /><LevelBadge level={ov} /></> : null}<LevelBadge level={v} />
                          {match?.level ? <span className="text-[9px] text-soc-stext/40 dark:text-soc-darkstext/40 line-through">{v}</span> : null}</span>
                      } else if (c === 'rule.description' && match?.message) {
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
                    {ruleMatches !== null && (
                      <td className="px-1.5 py-1">
                        {match ? <RuleBadge severity={match.severity} name={match.ruleName} /> : <span className="text-soc-stext/40 dark:text-soc-darkstext/40">{'\u2014'}</span>}
                      </td>
                    )}
                  </tr>
                  {isExp && (
                    <tr>
                      <td colSpan={columns.length + 1 + (ruleMatches !== null ? 1 : 0)} className="p-0">
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
