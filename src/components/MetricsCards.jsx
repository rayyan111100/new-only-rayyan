import React from 'react'

export default function MetricsCards({ total, critical, high, medium, low, agents, loading }) {
  if (loading) return null
  const cards = [
    { label: 'Total Events', value: total, color: '', bg: '' },
    { label: 'Critical', value: critical, color: 'text-red-500', bg: 'before:bg-red-500' },
    { label: 'High', value: high, color: 'text-orange-500', bg: 'before:bg-orange-500' },
    { label: 'Medium', value: medium, color: 'text-amber-500', bg: 'before:bg-amber-500' },
    { label: 'Low', value: low, color: 'text-green-500', bg: 'before:bg-green-500' },
    { label: 'Agents', value: agents, color: '', bg: '' }
  ]
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {cards.map(c => (
        <div key={c.label} className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] p-2.5 shadow-sm">
          <div className="text-[9px] text-[#9ca3af] uppercase tracking-wider font-medium mb-0.5">{c.label}</div>
          <div className={`text-lg font-bold ${c.color || 'text-soc-stext dark:text-soc-darkstext'}`}>
            {(c.value ?? 0).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}
