import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useApp } from '../context/AppContext'

export default function Histogram() {
  const { histogram, loading, isDark } = useApp()
  if (!histogram.length) return null
  const data = histogram.slice(-48).map(b => ({
    time: new Date(b.key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    count: b.doc_count
  }))
  const max = Math.max(...data.map(d => d.count))
  const stroke = isDark ? '#2a3648' : '#d3dae6'
  const fill = isDark ? '#3b82f6' : '#006BB4'
  return (
    <div className="gcard h-20 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: stroke }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis hide domain={[0, max]} />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              background: isDark ? '#1a2332' : '#fff',
              border: `1px solid ${stroke}`,
              borderRadius: 4,
              color: isDark ? '#e0e4ea' : '#343741'
            }}
            formatter={(v) => [v, 'Events']}
          />
          <Bar dataKey="count" fill={fill} radius={[1, 1, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
