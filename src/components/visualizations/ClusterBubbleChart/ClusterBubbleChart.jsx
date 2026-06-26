import React, { useMemo } from 'react'

const COLORS = ['#EF843C', '#8b5cf6', '#10b981', '#06b6d4', '#ef4444', '#f59e0b', '#ec4899', '#14b8a6', '#84cc16', '#a855f7', '#f97316', '#0ea5e9', '#d97706', '#6366f1']

export default function ClusterBubbleChart({ data, width = 464, height = 340 }) {
  const clusters = useMemo(() => {
    if (!data || !data.length) return []
    const total = data.reduce((s, d) => s + (d.y || d.value || d.count || 0), 0)
    if (!total) return []
    const maxR = Math.min(width, height) * 0.35
    return data.map((d, i) => {
      const val = d.y || d.value || d.count || 0
      const r = Math.max(10, Math.sqrt(val / total) * maxR * 2)
      return {
        label: d.x || d.key || d.name || '',
        value: val,
        r: Math.min(r, maxR),
        color: COLORS[i % COLORS.length],
        x: width / 2,
        y: height / 2 + 20,
      }
    })
  }, [data, width, height])

  if (!clusters.length) return <div className="flex items-center justify-center h-full text-zinc-400 text-[10px]">No data</div>

  return (
    <svg width={width} height={height} className="cluster-bubble-chart">
      <g transform={`translate(0,20)`}>
        {clusters.map((c, i) => (
          <g key={i} className="cluster-node" transform={`translate(${c.x},${c.y})`}>
            <circle r={c.r} className="ao-chart-color-0" fill={c.color} fillOpacity={0.15} stroke={c.color} strokeWidth={1.5} />
            <foreignObject x={-Math.min(c.r, 160)} y={-10} width={Math.min(c.r * 2, 320)} height={20}
              style={{ textAnchor: 'middle', textAlign: 'center', overflow: 'hidden', lineHeight: 'normal' }}>
              <div className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-200 text-center truncate">{c.label}</div>
            </foreignObject>
            <foreignObject x={-Math.min(c.r, 160)} y={10} width={Math.min(c.r * 2, 320)} height={15}
              style={{ textAnchor: 'middle', textAlign: 'center', overflow: 'hidden' }}>
              <div className="text-[9px] text-zinc-500 text-center">{c.value.toLocaleString()}</div>
            </foreignObject>
            <title>{c.label}: {c.value.toLocaleString()}</title>
          </g>
        ))}
      </g>
    </svg>
  )
}