import React, { useMemo } from 'react'
import useCompliance from '../../hooks/useCompliance'

const FRAMEWORK_COLORS = {
  'PCI-DSS': '#e8681a', 'HIPAA': '#3fb950', 'GDPR': '#a371f7',
  'TSC (SOC 2)': '#58a6ff', 'MITRE ATT&CK': '#ef4444', 'NIST 800-53': '#f97316',
}

export default function FrameworkDistPanel({ panel }) {
  const accent = panel.vizConfig?.accent || '#e8681a'
  const { data, loading, error } = useCompliance()

  const items = useMemo(() => {
    if (!data?.frameworkCounts) return []
    const counts = data.frameworkCounts
    const maxCount = Math.max(...counts.map(c => c.doc_count || c.count || 0), 1)
    return counts.map(c => ({
      label: c.key || 'Unknown',
      count: c.doc_count || c.count || 0,
      pct: ((c.doc_count || c.count || 0) / maxCount) * 100,
      color: FRAMEWORK_COLORS[c.key] || accent,
    }))
  }, [data, accent])

  const maxVal = Math.max(...items.map(i => i.count), 1)

  if (loading) return (
    <div className="p-3 h-full flex flex-col">
      <div className="h-3 w-32 bg-[#d0d7de] dark:bg-[#30363d] rounded mb-3 animate-pulse" />
      {[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-[#d0d7de] dark:bg-[#30363d] rounded mb-1.5 animate-pulse" />)}
    </div>
  )
  if (error) return <div className="flex items-center justify-center h-full text-[10px] text-red-400">{error}</div>
  if (!items.length) return <div className="flex items-center justify-center h-full text-[10px] text-zinc-400">No data</div>

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5" style={{ color: accent }}>Framework Event Distribution</div>
      <div className="flex-1 space-y-1">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] cursor-pointer text-[11px]">
            <span className="w-[90px] text-[#36454f] dark:text-[#c9d1d9] font-medium truncate shrink-0">{item.label}</span>
            <div className="flex-1 h-2 bg-[#d0d7de] dark:bg-[#1d2432] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.pct}%`, background: `linear-gradient(90deg,${item.color},${item.color}cc)` }} />
            </div>
            <span className="w-7 text-right text-[#1f2328] dark:text-[#f0f6fc] font-bold">{item.count}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-[#8b949e] mt-1.5 px-1">
        <span>0</span>
        {[Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75)].map(v => <span key={v}>{v}</span>)}
        <span>{maxVal}</span>
      </div>
      <div className="text-center text-[10px] text-[#8b949e] mt-0.5">Events</div>
    </div>
  )
}
