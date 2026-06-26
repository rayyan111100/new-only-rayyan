import React, { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import useCompliance from '../../../hooks/useCompliance'

const FRAMEWORK_ACCENT = {
  'PCI-DSS': '#e8681a', 'HIPAA': '#3fb950', 'GDPR': '#a371f7',
  'TSC (SOC 2)': '#58a6ff', 'NIST 800-53': '#f97316',
}
const SEV_COLORS = { Critical: '#f85149', High: '#e8681a', Medium: '#d29922', Low: '#3fb950' }
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low']

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

export default function ComplianceSeverityPanel({ panel }) {
  const framework = panel.vizConfig?.framework || 'PCI-DSS'
  const accent = FRAMEWORK_ACCENT[framework] || '#e8681a'
  const { data, loading, error } = useCompliance(framework)
  const isDark = document.documentElement.classList.contains('dark')

  const sevDonut = useMemo(() => {
    const sev = data?.severity || {}
    return SEV_ORDER.filter(s => sev[s] > 0).map(s => ({
      name: s, value: sev[s] || 0, color: SEV_COLORS[s]
    }))
  }, [data])

  const totalEvents = data?.count24 || 0

  if (loading) return (
    <div className="bg-white dark:bg-[#16181f] rounded-xl p-3 h-full flex flex-col">
      <div className="h-3 w-32 bg-[#d0d7de] dark:bg-[#30363d] rounded mb-3 animate-pulse" />
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-zinc-200 dark:border-zinc-700" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#e8681a] animate-spin" />
        </div>
      </div>
    </div>
  )
  if (error) return <div className="flex items-center justify-center h-full text-[10px] text-red-400">{error}</div>
  if (!data || sevDonut.length === 0) return <div className="flex items-center justify-center h-full text-[10px] text-zinc-400">No severity data</div>

  return (
    <div className="bg-white dark:bg-[#16181f] rounded-xl p-3 h-full flex flex-col">
      <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2" style={{ color: accent }}>Severity Distribution</div>
      <div className="grid grid-cols-2 gap-1 mb-2">
        {sevDonut.filter(s => s.value > 0).map(s => (
          <span key={s.name} className="flex items-center gap-1.5 text-[11px] px-1 py-0.5 rounded">
            <span className="w-[10px] h-[10px] rounded shrink-0" style={{ background: s.color }} />
            {s.name} <span className="text-[#8b949e]">{s.value} ({Math.round((s.value / (totalEvents || 1)) * 100)}%)</span>
          </span>
        ))}
      </div>
      <div className="flex-1 min-h-[80px]">
        {sevDonut.length > 0 && (
          <ResponsiveContainer width="100%" height={100}>
            <PieChart>
              <Pie data={sevDonut} cx="50%" cy="50%" innerRadius={30} outerRadius={45} dataKey="value" stroke={isDark ? '#161b22' : '#ffffff'} strokeWidth={2}>
                {sevDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip content={<CustomTip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="text-center mt-1 text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">{totalEvents.toLocaleString()} <span className="text-[10px] font-normal text-[#8b949e]">Total</span></div>
    </div>
  )
}
