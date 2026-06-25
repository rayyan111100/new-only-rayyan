import React, { useMemo } from 'react'

export default function TopNPanel({ panel, data, loading, error }) {
  const accent = panel.vizConfig?.accent || '#EF843C'
  const itemLabel = panel.vizConfig?.itemLabel || 'Items'
  const countLabel = panel.vizConfig?.countLabel || 'Count'
  const maxItems = panel.vizConfig?.maxItems || 8

  const items = useMemo(() => {
    if (!data) return []
    let buckets = data?.buckets || data || []
    if (!Array.isArray(buckets)) return []
    if (buckets.length > 0 && 'x' in buckets[0] && 'y' in buckets[0]) {
      buckets = buckets.map(b => ({ key: b.x, doc_count: b.y }))
    }
    return buckets.slice(0, maxItems).map(b => ({
      label: b.key || b.name || '--',
      count: b.doc_count || b.count || b.value || 0,
    }))
  }, [data, maxItems])

  const maxCount = Math.max(...items.map(i => i.count), 1)

  if (loading) return (
    <div className="p-3 h-full flex flex-col">
      <div className="h-3 w-24 bg-[#d0d7de] dark:bg-[#30363d] rounded mb-3 animate-pulse" />
      {[1,2,3,4].map(i => <div key={i} className="h-5 bg-[#d0d7de] dark:bg-[#30363d] rounded mb-1.5 animate-pulse" />)}
    </div>
  )
  if (error) return <div className="flex items-center justify-center h-full text-[10px] text-red-400">{error}</div>
  if (!items.length) return <div className="flex items-center justify-center h-full text-[10px] text-zinc-400">No data</div>

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5" style={{ color: accent }}>Top {itemLabel}</div>
      <div className="flex-1 space-y-1.5">
        {items.map((item, i) => {
          const pct = (item.count / maxCount) * 100
          return (
            <div key={item.label + i} className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] cursor-pointer text-[11px] group">
              <span className="w-[90px] text-[#36454f] dark:text-[#c9d1d9] font-medium truncate shrink-0" title={item.label}>{item.label}</span>
              <div className="flex-1 h-2 bg-[#d0d7de] dark:bg-[#30363d] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg,${accent},${accent}cc)` }} />
              </div>
              <span className="w-7 text-right text-[#1f2328] dark:text-[#f0f6fc] font-bold text-[11px]">{item.count}</span>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] text-[#8b949e] mt-1.5 px-1">
        <span>0</span>
        <span>{Math.round(maxCount / 2)}</span>
        <span>{maxCount}</span>
      </div>
      <div className="text-center text-[10px] text-[#8b949e] mt-0.5">{countLabel}</div>
    </div>
  )
}
