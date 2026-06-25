import React, { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const SEV_COLORS = { Critical: '#f85149', High: '#e8681a', Medium: '#d29922', Low: '#3fb950' }
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low']

function toSeverity(level) {
  const n = parseInt(level) || 0
  if (n >= 12) return 'Critical'
  if (n >= 7) return 'High'
  if (n >= 4) return 'Medium'
  return 'Low'
}

const CustomTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg px-3 py-2 text-xs shadow-xl">
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-semibold">{p.value?.toLocaleString() || p.value}</span></p>
      ))}
    </div>
  )
}

export default function SeverityPiePanel({ panel, data, loading, error }) {
  const accent = panel.vizConfig?.accent || '#EF843C'
  const isDark = document.documentElement.classList.contains('dark')

  const sevData = useMemo(() => {
    if (!data) return []
    let buckets = data?.buckets || data || []
    if (!Array.isArray(buckets)) return []
    if (buckets.length > 0 && 'x' in buckets[0] && 'y' in buckets[0]) {
      buckets = buckets.map(b => ({ key: b.x, doc_count: b.y }))
    }
    const map = { Critical: 0, High: 0, Medium: 0, Low: 0 }
    for (const b of buckets) {
      const s = toSeverity(b.key)
      map[s] = (map[s] || 0) + (b.doc_count || b.count || b.value || 0)
    }
    return SEV_ORDER.filter(s => map[s] > 0).map(s => ({ name: s, value: map[s], color: SEV_COLORS[s] }))
  }, [data])

  const total = sevData.reduce((a, b) => a + b.value, 0)

  if (loading) return (
    <div className="p-3 h-full flex flex-col">
      <div className="h-3 w-28 bg-[#d0d7de] dark:bg-[#30363d] rounded mb-3 animate-pulse" />
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-full border-2 border-zinc-200 dark:border-zinc-700" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#EF843C] animate-spin" />
        </div>
      </div>
    </div>
  )
  if (error) return <div className="flex items-center justify-center h-full text-[10px] text-red-400">{error}</div>
  if (!sevData.length) return <div className="flex items-center justify-center h-full text-[10px] text-zinc-400">No severity data</div>

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2" style={{ color: accent }}>Severity Distribution</div>
      <div className="grid grid-cols-2 gap-1 mb-2">
        {sevData.map(s => (
          <span key={s.name} className="flex items-center gap-1.5 text-[11px] text-[#36454f] dark:text-[#c9d1d9] font-medium">
            <span className="w-[10px] h-[10px] rounded shrink-0" style={{ background: s.color }} />
            {s.name} <span className="text-[#8b949e]">{s.value} ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)</span>
          </span>
        ))}
      </div>
      <div className="flex-1 min-h-[80px] relative">
        <ResponsiveContainer width="100%" height={100}>
          <PieChart>
            <Pie data={sevData} cx="50%" cy="50%" innerRadius={30} outerRadius={45} dataKey="value" stroke={isDark ? '#161b22' : '#ffffff'} strokeWidth={2}>
              {sevData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip content={<CustomTip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center mt-1 text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">{total.toLocaleString()} <span className="text-[10px] font-normal text-[#8b949e]">Total</span></div>
    </div>
  )
}
