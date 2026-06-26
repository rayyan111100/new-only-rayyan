import React, { useMemo } from 'react'

const PALETTE = ['#54b399', '#6092c0', '#d36086', '#9170b8', '#ca8eae', '#d6bf57', '#b9a888', '#da8b45', '#aa6556', '#e7664c', '#58a6ff', '#3fb950', '#d29922', '#f85149', '#a371f7', '#e8681a', '#06b6d4', '#f97316', '#ec4899', '#14b8a6']

export default function TagCloudPanel({ panel, data, loading, error }) {
  const minFont = panel.vizConfig?.minFont || 18
  const maxFont = panel.vizConfig?.maxFont || 60

  const items = useMemo(() => {
    if (!data?.length) return []
    const vals = data.map(d => d.y || 0)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = max - min || 1
    const sorted = [...data].sort((a, b) => (b.y || 0) - (a.y || 0))
    return sorted.map((d, i) => {
      const ratio = ((d.y || 0) - min) / range
      const size = Math.round(minFont + ratio * (maxFont - minFont))
      return {
        label: String(d.x || d.name || ''),
        count: d.y || 0,
        size: Math.max(minFont, Math.min(maxFont, size)),
        color: PALETTE[i % PALETTE.length],
      }
    })
  }, [data, minFont, maxFont])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 rounded-full border-2 border-zinc-200 dark:border-zinc-700" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#a855f7] animate-spin" />
      </div>
    </div>
  )

  if (error) return <div className="flex items-center justify-center h-full text-[10px] text-red-400">{error}</div>
  if (!items.length) return <div className="flex items-center justify-center h-full text-[10px] text-zinc-400">No data</div>

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-3 h-full overflow-hidden content-center">
      {items.map((item, i) => (
        <span key={i}
          className="inline-block leading-tight transition-transform hover:scale-110 cursor-default"
          style={{ fontSize: item.size + 'px', color: item.color, fontWeight: item.size > 40 ? 'bold' : item.size > 28 ? '600' : '500' }}
          title={`${item.label} — ${item.count}`}>
          {item.label}
        </span>
      ))}
    </div>
  )
}
