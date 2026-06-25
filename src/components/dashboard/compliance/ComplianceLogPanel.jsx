import React, { useState, useMemo } from 'react'
import useCompliance from '../../../hooks/useCompliance'

const FRAMEWORK_ACCENT = {
  'PCI-DSS': '#e8681a', 'HIPAA': '#3fb950', 'GDPR': '#a371f7',
  'TSC (SOC 2)': '#58a6ff', 'NIST 800-53': '#f97316',
}

const LOG_PAGE_SIZE = 10

export default function ComplianceLogPanel({ panel }) {
  const framework = panel.vizConfig?.framework || 'PCI-DSS'
  const accent = FRAMEWORK_ACCENT[framework] || '#e8681a'
  const { data, loading, error, toLogEntry } = useCompliance(framework)
  const [logPage, setLogPage] = useState(1)
  const [expandedRow, setExpandedRow] = useState({})
  const [jsonView, setJsonView] = useState({})

  const logEntries = useMemo(() => {
    return (data?.recent || []).map(r => ({ ...toLogEntry(r), raw: r }))
  }, [data, toLogEntry])

  const toggleRow = (id) => setExpandedRow(prev => ({ ...prev, [id]: !prev[id] }))
  const totalPages = Math.max(1, Math.ceil(logEntries.length / LOG_PAGE_SIZE))

  if (loading) return (
    <div className="bg-white dark:bg-[#16181f] rounded-xl p-2 h-full flex flex-col">
      <div className="h-3 w-24 bg-[#d0d7de] dark:bg-[#30363d] rounded mb-2 animate-pulse" />
      <div className="space-y-1 flex-1">{[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-[#d0d7de] dark:bg-[#30363d] rounded animate-pulse" />)}</div>
    </div>
  )
  if (error) return <div className="flex items-center justify-center h-full text-[10px] text-red-400">{error}</div>
  if (!data) return null

  const sevBadge = (sev) => {
    const cls = sev === 'Critical' ? 'bg-red-500/20 text-red-400' : sev === 'High' ? 'bg-orange-500/20 text-orange-400' : sev === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
    return <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${cls}`}>{sev}</span>
  }

  return (
    <div className="bg-white dark:bg-[#16181f] rounded-xl p-2 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc]" style={{ color: accent }}>{framework} Event Logs</span>
        <span className="text-[9px] text-zinc-400">{logEntries.length} total</span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[9px] border-collapse">
          <thead>
            <tr className="text-[8px] text-[#8b949e] font-bold uppercase tracking-wide bg-[#f0f2f4] dark:bg-[#2d3140] sticky top-0">
              <th className="text-left py-1 px-1.5 w-16">Time</th>
              <th className="text-left py-1 px-1.5 w-14">Agent</th>
              <th className="text-left py-1 px-1.5 w-10">Rule</th>
              <th className="text-left py-1 px-1.5 w-12">Sev</th>
              <th className="text-left py-1 px-1.5">Desc</th>
            </tr>
          </thead>
          <tbody>
            {logEntries.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE).map((l, i) => {
              const idx = (logPage - 1) * LOG_PAGE_SIZE + i
              const rowId = l.raw?._id || String(idx)
              const isExp = expandedRow[rowId]
              return (
                <React.Fragment key={rowId}>
                  <tr onClick={() => toggleRow(rowId)} className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] ${isExp ? 'bg-[#f6f8fa] dark:bg-[#16181f]' : ''}`}>
                    <td className="py-1 px-1.5 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#8b949e]">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[9px]">{isExp ? '▾' : '▸'}</span>
                        {l.time ? new Date(l.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </span>
                    </td>
                    <td className="py-1 px-1.5 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] truncate max-w-[80px]">{l.agent}</td>
                    <td className="py-1 px-1.5 border-b border-[#f0f2f4] dark:border-[#21262d]" style={{ color: accent }}>{l.rule}</td>
                    <td className="py-1 px-1.5 border-b border-[#f0f2f4] dark:border-[#21262d]">{sevBadge(l.sev)}</td>
                    <td className="py-1 px-1.5 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#36454f] dark:text-[#c9d1d9] truncate max-w-[120px]">{l.desc}</td>
                  </tr>
                  {isExp && (
                    <tr>
                      <td colSpan={5} className="p-2 bg-[#f6f8fa] dark:bg-[#16181f] border-b border-[#f0f2f4] dark:border-[#21262d]">
                        <div className="space-y-1 text-[9px]">
                          <div className="flex gap-2 flex-wrap">
                            <span className="text-[#8b949e]">Control:</span><span className="text-[#1f2328] dark:text-[#f0f6fc]">{l.ctrl}</span>
                            <span className="text-[#8b949e]">Event:</span><span className="text-[#1f2328] dark:text-[#f0f6fc]">{l.event}</span>
                            <span className="text-[#8b949e]">Groups:</span><span className="text-[#1f2328] dark:text-[#f0f6fc]">{l.groups}</span>
                            <span className="text-[#8b949e]">File:</span><span className="text-[#1f2328] dark:text-[#f0f6fc]">{l.file}</span>
                          </div>
                          <div className="text-[#36454f] dark:text-[#c9d1d9]">{l.desc}</div>
                          <button onClick={(e) => { e.stopPropagation(); setJsonView(prev => ({ ...prev, [rowId]: !prev[rowId] })) }}
                            className="text-[10px] px-2 py-0.5 rounded bg-[#e8eaed] dark:bg-[#2d3140] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-colors">
                            {jsonView[rowId] ? 'Table View' : 'JSON View'}
                          </button>
                          {jsonView[rowId] && l.raw && (
                            <pre className="text-[8px] bg-[#f0f2f4] dark:bg-[#0d1117] p-2 rounded overflow-x-auto max-h-32">{JSON.stringify(l.raw, null, 2)}</pre>
                          )}
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
        <div className="flex items-center justify-between px-1 py-1 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
          <div className="flex items-center gap-1">
            <button onClick={() => setLogPage(Math.max(1, logPage - 1))} disabled={logPage <= 1} className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 disabled:opacity-30">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="text-[9px] text-zinc-500">{logPage}/{totalPages}</span>
            <button onClick={() => setLogPage(Math.min(totalPages, logPage + 1))} disabled={logPage >= totalPages} className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 disabled:opacity-30">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <span className="text-[8px] text-zinc-400">{logEntries.length} total</span>
        </div>
      )}
    </div>
  )
}
