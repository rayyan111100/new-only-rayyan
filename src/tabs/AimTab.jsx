import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api'

export default function AimTab() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [q, setQ] = useState('')

  const fetchAgents = useCallback(async (searchQ) => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        index: 'unishield360-alerts-4.x-*',
        limit: 100,
        sort: '@timestamp',
        order: 'desc',
        start_date: 'now-30d',
        end_date: 'now'
      }
      if (searchQ) params.q = `agent.name:*${searchQ}*`
      const d = await api('search', params)
      const map = new Map()
      for (const hit of d.results || []) {
        const name = hit.agent?.name
        if (!name || map.has(name)) continue
        map.set(name, {
          name,
          ip: hit.agent?.ip || '-',
          os: hit.agent?.os || { name: '-', version: '' },
          lastSeen: hit['@timestamp'] || '',
          events: 1,
          groups: (hit.rule?.groups || []).slice(0, 3)
        })
      }
      setAgents([...map.values()])
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  function handleSearch(e) {
    e.preventDefault()
    fetchAgents(q)
  }

  return (
    <div className="p-4 h-full flex flex-col bg-[#f8f9fc] dark:bg-[#0e0f14]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Asset Inventory Management</h1>
          {!loading && <span className="text-[10px] text-[#9ca3af] bg-[#f3f4f6] dark:bg-[#2d3140] px-1.5 py-0.5 rounded-full">{agents.length} assets</span>}
        </div>
        <form onSubmit={handleSearch} className="flex gap-1">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search assets..." className="ginput text-[11px] px-2 py-1 w-48" />
          <button type="submit" className="gbtn text-[11px] px-2 py-1 bg-[#EF843C] text-white">Search</button>
        </form>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[#9ca3af] text-xs">Loading...</div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-red-500 text-xs">{error}</div>
      ) : agents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[#9ca3af] text-xs gap-2">
          <svg className="w-8 h-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
          No assets found
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-[#9ca3af] border-b border-[#e5e7eb] dark:border-[#2d3140]">
                <th className="py-1.5 px-2 font-medium">Agent Name</th>
                <th className="py-1.5 px-2 font-medium">IP Address</th>
                <th className="py-1.5 px-2 font-medium">OS</th>
                <th className="py-1.5 px-2 font-medium">Version</th>
                <th className="py-1.5 px-2 font-medium">Last Seen</th>
                <th className="py-1.5 px-2 font-medium">Groups</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]/50 dark:divide-[#2d3140]/50">
              {agents.map((a, i) => (
                <tr key={a.name} onClick={() => setSelected(selected === i ? null : i)}
                  className={`hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] cursor-pointer transition-colors ${selected === i ? 'bg-[#f3f4f6] dark:bg-[#2d3140]' : ''}`}>
                  <td className="py-1.5 px-2 font-medium text-soc-stext dark:text-soc-darkstext">{a.name}</td>
                  <td className="py-1.5 px-2 text-[10px] text-[#9ca3af] font-mono">{a.ip}</td>
                  <td className="py-1.5 px-2 text-soc-stext dark:text-soc-darkstext">{typeof a.os === 'string' ? a.os : a.os?.name || '-'}</td>
                  <td className="py-1.5 px-2 text-[10px] text-[#9ca3af]">{typeof a.os === 'string' ? '-' : a.os?.version || '-'}</td>
                  <td className="py-1.5 px-2 text-[10px] text-[#9ca3af] font-mono">{(a.lastSeen || '').slice(0, 19).replace('T', ' ')}</td>
                  <td className="py-1.5 px-2">
                    <div className="flex gap-1 flex-wrap">
                      {a.groups.map((g, gi) => (
                        <span key={gi} className="text-[9px] px-1 py-0.5 rounded-full bg-[#f3f4f6] dark:bg-[#2d3140] text-[#9ca3af]">{g}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
