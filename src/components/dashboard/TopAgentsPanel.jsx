import React, { useMemo } from 'react'
import useCompliance from '../../hooks/useCompliance'

export default function TopAgentsPanel({ panel }) {
  const accent = panel.vizConfig?.accent || '#e8681a'
  const maxAgents = panel.vizConfig?.maxItems || 8
  const { data, loading, error } = useCompliance()

  const agents = useMemo(() => {
    if (!data?.topAgents) return []
    const list = data.topAgents.slice(0, maxAgents)
    const maxCnt = Math.max(...list.map(a => a.doc_count || a.count || a.events || 0), 1)
    return list.map(a => ({
      name: a.key || a.agent || a.name || 'Unknown',
      count: a.doc_count || a.count || a.events || 0,
      pct: ((a.doc_count || a.count || a.events || 0) / maxCnt) * 100,
    }))
  }, [data, maxAgents])

  if (loading) return (
    <div className="p-3 h-full flex flex-col">
      <div className="h-3 w-24 bg-[#d0d7de] dark:bg-[#30363d] rounded mb-3 animate-pulse" />
      {[1,2,3,4].map(i => <div key={i} className="h-5 bg-[#d0d7de] dark:bg-[#30363d] rounded mb-1.5 animate-pulse" />)}
    </div>
  )
  if (error) return <div className="flex items-center justify-center h-full text-[10px] text-red-400">{error}</div>
  if (!agents.length) return <div className="flex items-center justify-center h-full text-[10px] text-zinc-400">No data</div>

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5" style={{ color: accent }}>Top Agents</div>
      <div className="flex-1">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide">
              <th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">#</th>
              <th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Agent</th>
              <th className="text-right py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Events</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a, i) => (
              <tr key={a.name} className="cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">
                <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#8b949e]">{i + 1}</td>
                <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{a.name}</td>
                <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="w-[70px] h-[6px] bg-[#d0d7de] dark:bg-[#1d2432] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${a.pct}%`, background: `linear-gradient(90deg,${accent},${accent}cc)` }} />
                    </div>
                    <span className="font-bold text-[#1f2328] dark:text-[#f0f6fc]">{a.count}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] font-semibold mt-2 cursor-pointer inline-flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: accent }}>
        View all agents <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </div>
    </div>
  )
}
