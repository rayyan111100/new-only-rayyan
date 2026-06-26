import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api'

const STATUS_COLORS = {
  healthy: { bg: '#f0fdf4', text: '#16a34a', dot: '#16a34a', label: 'Healthy' },
  warning: { bg: '#fefce8', text: '#ca8a04', dot: '#ca8a04', label: 'Warning' },
  critical: { bg: '#fef2f2', text: '#dc2626', dot: '#dc2626', label: 'Critical' },
  unknown: { bg: '#f3f4f6', text: '#9ca3af', dot: '#9ca3af', label: 'Unknown' }
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.unknown
  return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: c.bg, color: c.text }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />{c.label}</span>
}

export default function InfrastructureHealthTab() {
  const [health, setHealth] = useState(null)
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [h, d] = await Promise.all([
        api('health', {}).catch(() => null),
        api('search', {
          index: 'unishield360-alerts-4.x-*',
          limit: 100,
          sort: '@timestamp',
          order: 'desc',
          start_date: 'now-24h',
          end_date: 'now'
        }).catch(() => null)
      ])
      setHealth(h)
      const map = new Map()
      for (const hit of d?.results || []) {
        const name = hit.agent?.name
        if (!name || map.has(name)) continue
        const level = parseInt(hit.rule?.level) || 0
        map.set(name, {
          name,
          ip: hit.agent?.ip || '-',
          os: hit.agent?.os?.name || '-',
          lastSeen: hit['@timestamp'] || '',
          status: level >= 12 ? 'critical' : level >= 7 ? 'warning' : 'healthy',
          events: 1
        })
      }
      setAgents([...map.values()])
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const healthy = agents.filter(a => a.status === 'healthy').length
  const warning = agents.filter(a => a.status === 'warning').length
  const critical = agents.filter(a => a.status === 'critical').length

  return (
    <div className="p-4 h-full flex flex-col bg-[#f8f9fc] dark:bg-[#0e0f14]">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-sm font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Infrastructure Health</h1>
        {!loading && <span className="text-[10px] text-[#9ca3af] bg-[#f3f4f6] dark:bg-[#2d3140] px-1.5 py-0.5 rounded-full">{agents.length} agents</span>}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[#9ca3af] text-xs">Loading...</div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-red-500 text-xs">{error}</div>
      ) : (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider">Healthy</span>
              </div>
              <span className="text-xl font-bold text-green-600 dark:text-green-400">{healthy}</span>
            </div>
            <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider">Warning</span>
              </div>
              <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{warning}</span>
            </div>
            <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider">Critical</span>
              </div>
              <span className="text-xl font-bold text-red-600 dark:text-red-400">{critical}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {health && (
              <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] p-3 mb-3">
                <div className="text-[10px] font-semibold uppercase text-[#9ca3af] tracking-wider mb-2">API Health</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(health).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${v === 'ok' || v === true || v === 'green' ? 'bg-green-500' : v === 'yellow' || v === 'degraded' ? 'bg-amber-500' : v === 'red' || v === 'error' ? 'bg-red-500' : 'bg-[#9ca3af]'}`} />
                      <span className="text-[10px] text-soc-stext dark:text-soc-darkstext capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-[#9ca3af]">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-[#9ca3af] border-b border-[#e5e7eb] dark:border-[#2d3140]">
                  <th className="py-1.5 px-2 font-medium">Status</th>
                  <th className="py-1.5 px-2 font-medium">Agent</th>
                  <th className="py-1.5 px-2 font-medium">IP</th>
                  <th className="py-1.5 px-2 font-medium">OS</th>
                  <th className="py-1.5 px-2 font-medium">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]/50 dark:divide-[#2d3140]/50">
                {agents.map(a => (
                  <tr key={a.name} className="hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors">
                    <td className="py-1.5 px-2"><StatusBadge status={a.status} /></td>
                    <td className="py-1.5 px-2 font-medium text-soc-stext dark:text-soc-darkstext">{a.name}</td>
                    <td className="py-1.5 px-2 text-[10px] text-[#9ca3af] font-mono">{a.ip}</td>
                    <td className="py-1.5 px-2 text-soc-stext dark:text-soc-darkstext">{a.os}</td>
                    <td className="py-1.5 px-2 text-[10px] text-[#9ca3af] font-mono">{(a.lastSeen || '').slice(0, 19).replace('T', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
