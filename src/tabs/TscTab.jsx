import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api'

const SEV_COLORS = { Critical: '#f85149', High: '#e8681a', Medium: '#d29922', Low: '#3fb950' }
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low']
const QUICK_TIMES = [
  { label: '24h', value: 'now-24h' },
  { label: '7d', value: 'now-7d' },
  { label: '30d', value: 'now-30d' },
  { label: '90d', value: 'now-90d' }
]

function toSev(level) {
  const n = parseInt(level) || 0
  if (n >= 12) return 'Critical'
  if (n >= 7) return 'High'
  if (n >= 4) return 'Medium'
  return 'Low'
}

const TSC_CONTROLS = [
  { req: 'CC6.1', desc: 'Logical & Physical Access' },
  { req: 'CC6.6', desc: 'Security Incidents' },
  { req: 'CC7.2', desc: 'Monitor & Detect' },
  { req: 'CC7.3', desc: 'Incident Response' },
  { req: 'A1.2', desc: 'Availability Monitoring' }
]

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

export default function TscTab() {
  const [timeRange, setTimeRange] = useState('now-7d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        index: 'unishield360-alerts-4.x-*',
        q: 'rule.groups:*soc2* OR rule.groups:*tsc* OR rule.groups:*audit*',
        limit: 0,
        sort: '@timestamp',
        order: 'desc',
        start_date: timeRange === 'now-24h' ? new Date(Date.now() - 86400000).toISOString() : timeRange === 'now-7d' ? new Date(Date.now() - 604800000).toISOString() : timeRange === 'now-30d' ? new Date(Date.now() - 2592000000).toISOString() : new Date(Date.now() - 7776000000).toISOString(),
        end_date: new Date().toISOString()
      }
      const d = await api('search', params)
      setData({ total: d.total || d.results?.length || 0, results: d.results || [] })
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [timeRange])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="p-4 h-full flex flex-col bg-[#f8f9fc] dark:bg-[#0e0f14] gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">TSC (SOC 2)</h1>
        <select value={timeRange} onChange={e => setTimeRange(e.target.value)} className="ginput text-[10px] px-1.5 py-1">
          {QUICK_TIMES.map(qt => <option key={qt.value} value={qt.value}>{qt.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[#9ca3af] text-xs">Loading...</div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-red-500 text-xs">{error}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {TSC_CONTROLS.map(ctrl => (
            <div key={ctrl.req} className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] p-3">
              <div className="text-[10px] text-[#EF843C] font-mono font-bold mb-1">{ctrl.req}</div>
              <div className="text-[11px] text-soc-stext dark:text-soc-darkstext mb-2">{ctrl.desc}</div>
              <div className="text-[18px] font-bold text-soc-stext dark:text-soc-darkstext">{data?.total || 0}</div>
              <div className="text-[9px] text-[#9ca3af]">events</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
