import React, { useState, useMemo } from 'react'

const PAGE_SIZE = 10
const COL_MAP = {
  '@timestamp': { label: 'Time', field: 'time' },
  'timestamp': { label: 'Time', field: 'time' },
  'time': { label: 'Time', field: 'time' },
  'rule.description': { label: 'Description', field: 'desc' },
  'description': { label: 'Description', field: 'desc' },
  'rule.id': { label: 'Rule', field: 'rule' },
  'ruleid': { label: 'Rule', field: 'rule' },
  'rule.level': { label: 'Sev', field: 'sev' },
  'level': { label: 'Sev', field: 'sev' },
  'severity': { label: 'Sev', field: 'sev' },
  'agent.name': { label: 'Agent', field: 'agent' },
  'agent': { label: 'Agent', field: 'agent' },
  'agent.id': { label: 'Agent ID', field: 'agent' },
  'agentid': { label: 'Agent ID', field: 'agent' },
  'location': { label: 'Event', field: 'event' },
  'event': { label: 'Event', field: 'event' },
  'full_log': { label: 'Log', field: 'desc' },
  'fullLog': { label: 'Log', field: 'desc' },
  'decoder.name': { label: 'Source', field: 'event' },
  'decoderName': { label: 'Source', field: 'event' },
  'rule.groups': { label: 'Groups', field: 'groups' },
  'groups': { label: 'Groups', field: 'groups' },
  'rule.pci_dss': { label: 'PCI DSS', field: 'ctrl' },
  'rule.hipaa': { label: 'HIPAA', field: 'ctrl' },
  'rule.gdpr': { label: 'GDPR', field: 'ctrl' },
  'rule.tsc': { label: 'SOC 2', field: 'ctrl' },
  'data.srcip': { label: 'Source IP', field: 'agent' },
  'data.dstip': { label: 'Dest IP', field: 'agent' },
  'control': { label: 'Control', field: 'ctrl' },
  'ctrl': { label: 'Control', field: 'ctrl' },
  'key': { label: 'Key', field: 'rule' },
  'doc_count': { label: 'Count', field: 'count' },
  'count': { label: 'Count', field: 'count' },
  'pct': { label: '%', field: 'pct' },
  'ingest': { label: 'Ingest', field: 'ingest' },
  'eps': { label: 'EPS', field: 'eps' },
  'lastEvent': { label: 'Last Event', field: 'lastEvent' },
  'status': { label: 'Status', field: 'status' },
}

function sevBadge(sev) {
  const s = String(sev || '').toLowerCase()
  const cls = s === 'critical' ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
    : s === 'high' ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
    : s === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
    : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>{sev || 'Low'}</span>
}

export default function EventLogsPanel({ panel, data, loading, error, onFilter }) {
  const accent = panel.vizConfig?.accent || '#EF843C'
  const title = panel.title || 'Event Logs'
  const savedCols = panel.vizConfig?.tableColumns || []
  const DISPLAY_COLS = savedCols.length ? savedCols : ['@timestamp', 'agent.name', 'rule.id', 'rule.description', 'rule.level', 'location', 'full_log', 'rule.groups']
  const EXPORT_COLS = DISPLAY_COLS.map(c => COL_MAP[c]?.label || c)
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState({})
  const [jsonView, setJsonView] = useState({})
  const [filterDropdown, setFilterDropdown] = useState(null)

  React.useEffect(() => {
    const close = (e) => { if (!e.target.closest('.filter-dropdown')) setFilterDropdown(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  function fmt(v) {
    if (v === null || v === undefined) return '--'
    if (Array.isArray(v)) return v.filter(Boolean).join(', ') || '--'
    if (typeof v === 'string' && v.startsWith('[') && v.endsWith(']')) {
      try { const p = JSON.parse(v); return Array.isArray(p) ? p.filter(Boolean).join(', ') : v } catch { return v }
    }
    return String(v)
  }
  function getField(r, flatPath, nestedPath) {
    const flat = r[flatPath]
    if (flat !== undefined && flat !== null) return fmt(flat)
    const parts = nestedPath.split('.')
    let val = r
    for (const p of parts) { if (val && typeof val === 'object') val = val[p]; else return '--' }
    return fmt(val)
  }

  const rows = useMemo(() => {
    if (!data) return []
    const raw = data?.results || data?.hits || data || []
    if (!Array.isArray(raw)) return []
    const isFlat = raw.length > 0 && Object.keys(raw[0]).some(k => k.includes('.'))
    return raw.map(r => {
      if (isFlat) {
        const level = parseInt(r['rule.level'] || r.level || 0)
        const sev = level >= 12 ? 'Critical' : level >= 7 ? 'High' : level >= 4 ? 'Medium' : 'Low'
        const g = fmt(r['rule.groups'])
        return {
          time: fmt(r['@timestamp'] || r.timestamp),
          agent: fmt(r['agent.name'] || r.agent),
          rule: fmt(r['rule.id'] || r.rule),
          sev,
          desc: fmt(r['rule.description'] || r.description),
          event: g ? g.split(', ')[0] || '--' : '--',
          groups: g,
          ctrl: fmt(r['rule.pci_dss']) || fmt(r['rule.gdpr']) || fmt(r['rule.hipaa']) || fmt(r['rule.tsc']) || fmt(r['rule.nist_800_53']) || fmt(r.control),
          raw: r,
        }
      }
      return {
        time: r['@timestamp'] || r.timestamp || '--',
        agent: getField(r, 'agent.name', 'agent.name') || '--',
        rule: getField(r, 'rule.id', 'rule.id') || '--',
        sev: (() => { const l = parseInt(getField(r, 'rule.level', 'rule.level') || 0); if (l >= 12) return 'Critical'; if (l >= 7) return 'High'; if (l >= 4) return 'Medium'; return 'Low' })(),
        desc: getField(r, 'rule.description', 'rule.description') || '--',
        event: getField(r, 'rule.groups', 'rule.groups') || '--',
        groups: (Array.isArray(r.rule?.groups) ? r.rule.groups.join(', ') : r.rule?.groups) || '--',
        ctrl: getField(r, 'rule.pci_dss', 'rule.pci_dss') || getField(r, 'rule.gdpr', 'rule.gdpr') || getField(r, 'rule.hipaa', 'rule.hipaa') || getField(r, 'rule.tsc', 'rule.tsc') || getField(r, 'rule.nist_800_53', 'rule.nist_800_53') || r.control || '--',
        raw: r,
      }
    })
  }, [data])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleRow = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  if (loading) return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="h-3 w-20 bg-[#d0d7de] dark:bg-[#30363d] rounded animate-pulse" />
        <div className="h-3 w-16 bg-[#d0d7de] dark:bg-[#30363d] rounded animate-pulse" />
      </div>
      <div className="space-y-1 flex-1">{[1,2,3,4,5].map(i => <div key={i} className="h-5 bg-[#d0d7de] dark:bg-[#30363d] rounded animate-pulse" />)}</div>
    </div>
  )
  if (error) return <div className="flex items-center justify-center h-full text-[10px] text-red-400">{error}</div>
  if (!rows.length) return <div className="flex items-center justify-center h-full text-[10px] text-zinc-400">No data</div>

  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, rows.length)

  return (
    <div className="p-2 h-full flex flex-col">
      {panel.vizConfig?.showTitle !== false && (
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]" style={{ color: accent }}>{title}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => {
            const csv = [EXPORT_COLS.join(',')].concat(rows.map(r => EXPORT_COLS.map(c => `"${String(r[c.toLowerCase()] || '').replace(/"/g, '""')}"`).join(','))).join('\n')
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${title.replace(/\s+/g, '_')}.csv`; a.click()
          }} className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-[#e8eaed] dark:bg-[#2d3140] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-all flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>CSV
          </button>
        </div>
      </div>
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="text-[9px] text-[#8b949e] font-bold uppercase tracking-wide bg-[#f0f2f4] dark:bg-[#2d3140] sticky top-0">
              <th className="text-left py-1 px-1.5 border-b-2 border-[#e5e7eb] dark:border-[#2d3140] w-4"></th>
              {DISPLAY_COLS.map(col => (
                <th key={col} className="text-left py-1 px-1.5 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">{COL_MAP[col]?.label || col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((l, i) => {
              const idx = (page - 1) * PAGE_SIZE + i
              const rowId = l.raw?._id || String(idx)
              const isExp = expanded[rowId]
              return (
                <React.Fragment key={rowId}>
                  <tr onClick={() => toggleRow(rowId)} className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] ${isExp ? 'bg-[#f6f8fa] dark:bg-[#16181f]' : ''}`}>
                    <td className="py-1 px-1.5 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#8b949e]">
                      <span className="text-[9px]">{isExp ? '▾' : '▸'}</span>
                    </td>
                    {DISPLAY_COLS.map(col => {
                      const info = COL_MAP[col]
                      const field = info?.field || 'desc'
                      let val = l[field] ?? '--'
                      let cellContent = val
                      let isSev = field === 'sev'
                      if (isSev) cellContent = sevBadge(val)
                      if (field === 'time' && val !== '--' && val !== null) cellContent = new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      const isNum = field === 'count' || field === 'eps' || field === 'pct'
                      const cls = field === 'agent' || field === 'rule' || field === 'event' ? 'font-medium' : isNum ? 'font-medium text-right' : ''
                      return (
                        <td key={col} className={'py-1 px-1.5 border-b border-[#f0f2f4] dark:border-[#21262d] relative ' + cls} style={field === 'rule' || field === 'ctrl' || field === 'event' ? {color: accent} : {}}>
                          <span className="relative inline-flex">
                            <span onClick={(e) => { e.stopPropagation(); setFilterDropdown(filterDropdown === idx+'-'+col ? null : idx+'-'+col) }} className="cursor-pointer">{cellContent}</span>
                            {filterDropdown === idx+'-'+col && onFilter && (
                              <div className="filter-dropdown absolute top-full left-0 mt-1 z-[100] bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-[#30363d] rounded-lg shadow-xl p-1 min-w-[120px]" onClick={e => e.stopPropagation()}>
                                <button onClick={() => { onFilter({ type: 'pair', key: col, value: String(val ?? ''), exclude: false }); setFilterDropdown(null) }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] rounded transition-colors hover:bg-green-500/10 text-green-600 dark:text-green-400">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Include
                                </button>
                                <button onClick={() => { onFilter({ type: 'pair', key: col, value: String(val ?? ''), exclude: true }); setFilterDropdown(null) }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] rounded transition-colors hover:bg-red-500/10 text-red-600 dark:text-red-400">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Exclude
                                </button>
                              </div>
                            )}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                  {isExp && (
                    <tr>
                      <td colSpan={DISPLAY_COLS.length + 1} className="p-0 bg-[#f6f8fa] dark:bg-[#16181f] border-b border-[#f0f2f4] dark:border-[#21262d]">
                        <div className="border-t border-[#e5e7eb] dark:border-[#2d3140]">
                          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                            <div className="flex items-center gap-2">
                              <button onClick={(e) => { e.stopPropagation(); setJsonView(prev => ({ ...prev, [rowId]: false })) }}
                                className={'text-[10px] px-2 py-0.5 rounded font-medium transition-colors ' + (!jsonView[rowId] ? 'bg-[#EF843C] text-white' : 'text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]')}>Table</button>
                              <button onClick={(e) => { e.stopPropagation(); setJsonView(prev => ({ ...prev, [rowId]: true })) }}
                                className={'text-[10px] px-2 py-0.5 rounded font-medium transition-colors ' + (jsonView[rowId] ? 'bg-[#EF843C] text-white' : 'text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]')}>JSON</button>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(JSON.stringify(l.raw || l, null, 2)) }}
                              className="text-[10px] px-2 py-0.5 rounded font-medium bg-[#e8eaed] dark:bg-[#2d3140] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-all flex items-center gap-1">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {jsonView[rowId] ? (
                              <pre className="p-3 text-[10px] font-mono text-[#36454f] dark:text-[#c9d1d9] whitespace-pre-wrap max-h-48 overflow-y-auto">{JSON.stringify(l.raw || l, null, 2)}</pre>
                            ) : (
                              <table className="w-full text-[11px]">
                                <tbody>
                                  {Object.entries(l.raw || l).filter(([k]) => k !== 'raw').map(([k, v]) => {
                                    const expKey = rowId + '-' + k
                                    return (
                                    <tr key={k} className="border-b border-[#e5e7eb]/30 dark:border-[#2d3140]/30 hover:bg-[#f0f2f4] dark:hover:bg-[#161b22]">
                                      <td className="px-3 py-1 font-medium text-[#1f2328] dark:text-[#f0f6fc] whitespace-nowrap w-1/3 align-top text-[10px]">{k}</td>
                                      <td className="relative px-3 py-1 text-[#36454f] dark:text-[#c9d1d9] break-all text-[11px] cursor-pointer">
                                        <span className="relative inline-flex items-center gap-1">
                                          <span onClick={(e) => { e.stopPropagation(); setFilterDropdown(filterDropdown === expKey ? null : expKey) }}
                                            className="truncate max-w-[200px] inline-block font-medium">
                                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                          </span>
                                          {filterDropdown === expKey && onFilter && (
                                            <div className="filter-dropdown absolute top-full left-0 mt-1 z-[100] bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-[#30363d] rounded-lg shadow-xl p-1 min-w-[120px] whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                              <button onClick={() => { onFilter({ type: 'pair', key: k, value: String(v ?? ''), exclude: false }); setFilterDropdown(null) }}
                                                className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] rounded transition-colors hover:bg-green-500/10 text-green-600 dark:text-green-400">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Include
                                              </button>
                                              <button onClick={() => { onFilter({ type: 'pair', key: k, value: String(v ?? ''), exclude: true }); setFilterDropdown(null) }}
                                                className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] rounded transition-colors hover:bg-red-500/10 text-red-600 dark:text-red-400">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Exclude
                                              </button>
                                            </div>
                                          )}
                                        </span>
                                      </td>
                                    </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
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
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
          <span className="text-[10px] text-[#8b949e]">{from}-{to} of {rows.length}</span>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
              className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 disabled:opacity-30 transition-all">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let p = page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i
              if (p < 1 || p > totalPages) return null
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`px-1.5 py-0.5 rounded text-[10px] min-w-[22px] transition-all ${page === p ? 'text-white' : 'text-zinc-400 hover:text-zinc-600'}`}
                  style={page === p ? { background: accent } : {}}>
                  {p}
                </button>
              )
            })}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
              className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 disabled:opacity-30 transition-all">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
