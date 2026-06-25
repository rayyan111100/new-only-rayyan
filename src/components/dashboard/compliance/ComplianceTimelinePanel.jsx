import React from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import useCompliance from '../../../hooks/useCompliance'

const FRAMEWORK_ACCENT = {
  'PCI-DSS': '#e8681a', 'HIPAA': '#3fb950', 'GDPR': '#a371f7',
  'TSC (SOC 2)': '#58a6ff', 'NIST 800-53': '#f97316',
}

const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#9ca3af] dark:text-[#6b7280] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-semibold text-[#1a1c23] dark:text-white">{p.value?.toLocaleString() || p.value}</span></p>
      ))}
    </div>
  )
}

export default function ComplianceTimelinePanel({ panel }) {
  const framework = panel.vizConfig?.framework || 'PCI-DSS'
  const accent = FRAMEWORK_ACCENT[framework] || '#e8681a'
  const { data, loading, error } = useCompliance(framework)
  const isDark = document.documentElement.classList.contains('dark')

  if (loading) return (
    <div className="bg-white dark:bg-[#16181f] rounded-xl p-3 h-full flex flex-col">
      <div className="h-3 w-40 bg-[#d0d7de] dark:bg-[#30363d] rounded mb-3 animate-pulse" />
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-zinc-200 dark:border-zinc-700" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#e8681a] animate-spin" />
        </div>
      </div>
    </div>
  )
  if (error) return <div className="flex items-center justify-center h-full text-[10px] text-red-400">{error}</div>
  if (!data) return <div className="flex items-center justify-center h-full text-[10px] text-zinc-400">No data</div>

  const gradientId = `${framework.replace(/\s+/g, '')}Grad`

  return (
    <div className="bg-white dark:bg-[#16181f] rounded-xl p-3 h-full flex flex-col">
      <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2 flex items-center justify-between">
        <span style={{ color: accent }}>{framework} Events Trend</span>
        <span className="text-[10px] text-[#8b949e] bg-[#f0f2f4] dark:bg-[#2d3140] px-2 py-0.5 rounded font-medium normal-case">
          {panel.vizConfig?.timeLabel || 'Last 24 Hours'}
        </span>
      </div>
      <div className="flex-1 min-h-0" style={{ minHeight: 80 }}>
        {data?.timeline?.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.timeline} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accent} stopOpacity={0.12} />
                  <stop offset="95%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#8b949e' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 8, fill: '#8b949e' }} axisLine={false} tickLine={false} width={25} />
              <Tooltip content={<CustomTip />} />
              <Area type="monotone" dataKey="count" stroke={accent} fill={`url(#${gradientId})`} strokeWidth={2} dot={{ r: 2, fill: accent, stroke: isDark ? '#161b22' : '#ffffff', strokeWidth: 1.5 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[10px] text-zinc-400">No timeline data</div>
        )}
      </div>
    </div>
  )
}
