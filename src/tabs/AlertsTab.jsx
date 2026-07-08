import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import AlertList from '../components/alerts/AlertList'
import AlertDetails from '../components/alerts/AlertDetails'
import AlertFilter from '../components/alerts/AlertFilter'
import AlertActions from '../components/alerts/AlertActions'

export default function AlertsTab() {
  const [alerts, setAlerts] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({})
  const [stats, setStats] = useState(null)

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 50, sort: '@timestamp', order: 'desc', start_date: filters.timeRange || 'now-24h', end_date: 'now' }
      if (filters.severity) params.q = `rule.level:${filters.severity === 'critical' ? 15 : filters.severity === 'high' ? 13 : filters.severity === 'medium' ? 9 : 4}`
      if (filters.search) params.q = params.q ? `(${params.q}) AND ${filters.search}` : filters.search
      const res = await axios.get('/api/realtime/alerts', { params, timeout: 15000 })
      const items = (res.data.results || []).map(d => ({
        id: d._id || d.id || Math.random().toString(36),
        timestamp: d.timestamp || d['@timestamp'] || new Date().toISOString(),
        title: d.title || d.rule?.description || 'Alert',
        severity: d.severity || (d.level >= 15 ? 'critical' : d.level >= 12 ? 'high' : d.level >= 7 ? 'medium' : 'low'),
        level: d.level || 0,
        source: d.source || d.decoder?.name || d.location || 'unknown',
        ruleId: d.ruleId || d.rule?.id || '',
        agentName: d.agent || d.agentName || '',
        agentId: d.agentId || '',
        description: d.description || d.full_log || '',
        status: d.status || 'new',
        data: d,
      }))
      setAlerts(items)
      const s = { total: res.data.total || 0, new: items.filter(a => a.status === 'new').length, critical: items.filter(a => a.severity === 'critical').length, high: items.filter(a => a.severity === 'high').length, medium: items.filter(a => a.severity === 'medium').length, low: items.filter(a => a.severity === 'low').length }
      setStats(s)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  const selected = alerts.find(a => a.id === selectedId) || null
  const sources = [...new Set(alerts.map(a => a.source).filter(Boolean))]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full gap-3">
      {/* Left: Alert List + Filter */}
      <div className="w-80 shrink-0 flex flex-col bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Alerts</span>
            <button onClick={fetchAlerts} disabled={loading} className="text-[9px] px-2 py-1 rounded-md bg-[#EF843C] text-white hover:bg-[#e0752a] transition-colors disabled:opacity-50">
              {loading ? '...' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
          <AlertFilter filters={filters} onChange={setFilters} sources={sources} stats={stats} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center h-32"><svg className="animate-spin w-5 h-5 text-[#EF843C]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>
          ) : (
            <AlertList alerts={alerts} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </div>
        <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-700">
          <AlertActions selectedAlerts={[selectedId].filter(Boolean)} onAction={(action) => { if (action === 'refresh') fetchAlerts() }} />
        </div>
      </div>

      {/* Right: Alert Details */}
      <div className="flex-1 bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {selected ? (
          <AlertDetails alert={selected} onClose={() => setSelectedId(null)} onRefresh={fetchAlerts} />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-400">
            <div className="text-center">
              <svg className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              <p className="text-sm font-semibold text-zinc-500">Select an alert</p>
              <p className="text-[10px] mt-1">Choose an alert from the list to view details</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
