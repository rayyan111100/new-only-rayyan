import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api'
import MetricsCards from '../components/MetricsCards'

const SEV_COLORS = {
  critical: { bg: '#fef2f2', text: '#dc2626', dot: '#dc2626' },
  high: { bg: '#fff7ed', text: '#ea580c', dot: '#ea580c' },
  medium: { bg: '#fefce8', text: '#ca8a04', dot: '#ca8a04' },
  low: { bg: '#f0fdf4', text: '#16a34a', dot: '#16a34a' }
}

function getSeverity(level) {
  if (level >= 15) return 'critical'
  if (level >= 12) return 'high'
  if (level >= 7) return 'medium'
  return 'low'
}

function SevBadge({ level }) {
  const sev = getSeverity(level)
  const c = SEV_COLORS[sev]
  return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: c.bg, color: c.text }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />{sev}</span>
}

export default function DtmTab() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [q, setQ] = useState('')
  const [total, setTotal] = useState(0)
  const [timeRange, setTimeRange] = useState('now-7d')
  const [metrics, setMetrics] = useState({ critical: 0, high: 0, medium: 0, low: 0, agents: 0 })

  const fetchEvents = useCallback(async (searchQ) => {
    setLoading(true)
    setError(null)
    try {
      const base = { index: 'unishield360-alerts-4.x-*', start_date: timeRange, end_date: 'now' }
      let query
      if (searchQ) {
        query = `(rule.groups:*availability* OR rule.groups:*monitoring* OR rule.groups:*downtime* OR rule.description:*down* OR rule.description:*offline* OR rule.description:*unreachable*) AND (${searchQ})`
      } else {
        query = 'rule.groups:*availability* OR rule.groups:*monitoring* OR rule.groups:*downtime* OR rule.description:*down* OR rule.description:*offline* OR rule.description:*unreachable*'
      }
      const [d, sevAgg, agentAgg] = await Promise.all([
        api('search', { ...base, q: query, limit: 100, sort: '@timestamp', order: 'desc' }),
        api('aggregate', { ...base, q: query, field: 'rule.level', type: 'terms', limit: 20 }).catch(() => ({ buckets: [] })),
        api('aggregate', { ...base, q: query, field: 'agent.name', type: 'terms', limit: 100 }).catch(() => ({ buckets: [] }))
      ])
      setEvents(d.results || [])
      setTotal(d.total || d.results?.length || 0)
      const sevBuckets = sevAgg.buckets || []
      let c = 0, h = 0, m = 0, l = 0
      for (const b of sevBuckets) {
        const s = getSeverity(b.key); const cnt = b.doc_count || 0
        if (s === 'critical') c += cnt; else if (s === 'high') h += cnt; else if (s === 'medium') m += cnt; else l += cnt
      }
      setMetrics({ critical: c, high: h, medium: m, low: l, agents: (agentAgg.buckets || []).length })
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [timeRange])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  function handleSearch(e) { e.preventDefault(); fetchEvents(q) }

  return (
    <div className="p-4 h-full flex flex-col bg-[#f8f9fc] dark:bg-[#0e0f14] gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Down Time Monitoring</h1>
          {!loading && <span className="text-[10px] text-[#9ca3af] bg-[#f3f4f6] dark:bg-[#2d3140] px-1.5 py-0.5 rounded-full">{total} events</span>}
        </div>
        <div className="flex items-center gap-2">
          <select value={timeRange} onChange={e => setTimeRange(e.target.value)} className="ginput text-[10px] px-1.5 py-1">
            <option value="now-24h">24h</option>
            <option value="now-7d">7 days</option>
            <option value="now-30d">30 days</option>
            <option value="now-90d">90 days</option>
          </select>
          <form onSubmit={handleSearch} className="flex gap-1">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter downtime..." className="ginput text-[11px] px-2 py-1 w-48" />
            <button type="submit" className="gbtn text-[11px] px-2 py-1 bg-[#EF843C] text-white">Search</button>
          </form>
        </div>
      </div>

      <MetricsCards total={total} critical={metrics.critical} high={metrics.high} medium={metrics.medium} low={metrics.low} agents={metrics.agents} loading={loading} />

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[#9ca3af] text-xs">Loading...</div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-red-500 text-xs">{error}</div>
      ) : events.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[#9ca3af] text-xs gap-2">
          <svg className="w-8 h-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          No downtime events found
        </div>
      ) : (
        <div className="flex-1 flex gap-3 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-[#9ca3af] border-b border-[#e5e7eb] dark:border-[#2d3140]">
                  <th className="py-1.5 px-2 font-medium">Timestamp</th>
                  <th className="py-1.5 px-2 font-medium">Agent</th>
                  <th className="py-1.5 px-2 font-medium">Severity</th>
                  <th className="py-1.5 px-2 font-medium">Rule</th>
                  <th className="py-1.5 px-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]/50 dark:divide-[#2d3140]/50">
                {events.map((ev, i) => (
                  <tr key={ev._id || i} onClick={() => setSelected(selected === i ? null : i)}
                    className={`hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] cursor-pointer transition-colors ${selected === i ? 'bg-[#f3f4f6] dark:bg-[#2d3140]' : ''}`}>
                    <td className="py-1 px-2 text-[10px] text-[#9ca3af] font-mono whitespace-nowrap">{(ev['@timestamp'] || '').slice(0, 19).replace('T', ' ')}</td>
                    <td className="py-1 px-2 text-soc-stext dark:text-soc-darkstext">{ev.agent?.name || '-'}</td>
                    <td className="py-1 px-2"><SevBadge level={ev.rule?.level || 0} /></td>
                    <td className="py-1 px-2 text-[#EF843C] font-mono text-[10px]">{ev.rule?.id || '-'}</td>
                    <td className="py-1 px-2 text-soc-stext dark:text-soc-darkstext truncate max-w-[300px]">{ev.rule?.description || ev.full_log?.slice(0, 80) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AnimatePresence>
            {selected !== null && events[selected] && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="w-80 shrink-0 overflow-y-auto bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase text-[#9ca3af] tracking-wider">Event Details</span>
                  <button onClick={() => setSelected(null)} className="text-[#9ca3af] hover:text-soc-stext text-xs">&times;</button>
                </div>
                <pre className="text-[10px] font-mono text-soc-stext dark:text-soc-darkstext whitespace-pre-wrap break-all leading-relaxed">{JSON.stringify(events[selected], null, 2)}</pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
