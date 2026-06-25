import React, { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#9ca3af] dark:text-[#6b7280] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-semibold">{p.value?.toLocaleString() || p.value}</span></p>
      ))}
    </div>
  )
}

export default function TimelineAreaPanel({ panel, data, loading, error }) {
  const accent = panel.vizConfig?.accent || '#EF843C'
  const isDark = document.documentElement.classList.contains('dark')

  function fmtDate(v) {
    if (!v) return '--'
    try {
      const d = new Date(v)
      if (!isNaN(d.getTime())) return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    } catch {}
    const s = String(v)
    if (s.length >= 10) return s.slice(5, 10).replace('-', ' ')
    return s.slice(0, 6)
  }

  const chartData = useMemo(() => {
    if (!data) return []
    let buckets = data?.buckets || data || []
    if (!Array.isArray(buckets)) return []
    if (buckets.length > 0 && 'x' in buckets[0] && 'y' in buckets[0]) {
      buckets = buckets.map(b => ({ key: b.x, key_as_string: b.x, doc_count: b.y }))
    }
    return buckets.slice(-48).map(b => ({
      time: fmtDate(b.key_as_string || b.key || b.time),
      count: b.doc_count || b.count || b.value || 0,
    }))
  }, [data])

  const gradId = `timelineGrad_${panel.id?.replace(/[^a-zA-Z0-9]/g, '') || 'default'}`

  if (loading) return (
    <div className="p-3 h-full flex flex-col">
      <div className="h-3 w-32 bg-[#d0d7de] dark:bg-[#30363d] rounded mb-3 animate-pulse" />
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-full border-2 border-zinc-200 dark:border-zinc-700" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#EF843C] animate-spin" />
        </div>
      </div>
    </div>
  )
  if (error) return <div className="flex items-center justify-center h-full text-[10px] text-red-400">{error}</div>
  if (!chartData.length) return <div className="flex items-center justify-center h-full text-[10px] text-zinc-400">No timeline data</div>

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2">
        <span style={{ color: accent }}>Events Trend</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={accent} stopOpacity={0.12} />
                <stop offset="95%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<CustomTip />} />
            <Area type="monotone" dataKey="count" stroke={accent} fill={`url(#${gradId})`} strokeWidth={2.5} dot={{ r: 3, fill: accent, stroke: isDark ? '#161b22' : '#ffffff', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[9px] text-[#8b949e] mt-1 px-0.5">
        {chartData.filter((_, i) => i % Math.max(1, Math.floor(chartData.length / 7)) === 0).slice(0, 7).map((t, i) => <span key={i}>{t.time}</span>)}
      </div>
    </div>
  )
}
