import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import { parseDateStr, formatPretty } from '../utils'
import DateRangePicker from '../components/DateRangePicker'
import AssetSidebar from '../components/AssetSidebar'
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const FRAMEWORKS = ['PCI-DSS', 'HIPAA', 'GDPR', 'TSC (SOC 2)', 'MITRE ATT&CK']
const SEV_COLORS = { Critical: '#f85149', High: '#e8681a', Medium: '#d29922', Low: '#3fb950' }
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low']

const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#0d1117] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#9ca3af] dark:text-[#8b949e] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-semibold text-[#1a1c23] dark:text-[#f0f6fc]">{p.value?.toLocaleString() || p.value}</span></p>
      ))}
    </div>
  )
}

function toSev(level) {
  const n = parseInt(level) || 0
  if (n >= 12) return 'Critical'
  if (n >= 7) return 'High'
  if (n >= 4) return 'Medium'
  return 'Low'
}

export default function ComplianceTab() {
  const { isDark, startDate, endDate } = useApp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [modal, setModal] = useState(null)
  const [assetSidebarOpen, setAssetSidebarOpen] = useState(false)
  const [filters, setFilters] = useState({})
  const intervalRef = useRef(null)

  const setFilter = (key, value) => {
    setFilters(prev => {
      if (prev[key] === value) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: value }
    })
  }

  const clearFilter = (key) => setFilters(prev => {
    const next = { ...prev }
    delete next[key]
    return next
  })

  const activeFilters = Object.keys(filters)

  const timeParams = useCallback(() => {
    const sd = parseDateStr(startDate).toISOString()
    const ed = parseDateStr(endDate).toISOString()
    return { start_date: sd, end_date: ed }
  }, [startDate, endDate])

  const fetchData = useCallback(async () => {
    try {
      const tp = timeParams()
      const d = await api('compliance', { index: 'unishield360-alerts-4.x-*', start_date: tp.start_date, end_date: tp.end_date })
      setData({
        count24: d.count24 || 0,
        count7d: d.count7d || 0,
        severity: d.severity || {},
        frameworkCounts: d.frameworkCounts || [],
        topRules: (d.topRules || []).slice(0, 8),
        topAgents: (d.topAgents || []).slice(0, 8),
        timeline: (d.timeline || []).map(b => ({
          time: new Date(b.time || b.key).toLocaleDateString([], { month: 'short', day: 'numeric' }),
          count: b.count || b.doc_count || 0
        })),
        recent: (d.recent || []).slice(0, 20)
      })
      setError(null)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [timeParams])

  useEffect(() => {
    setLoading(true)
    fetchData()
    intervalRef.current = setInterval(fetchData, 60000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchData])

  const totalEvents = data ? Object.values(data.severity).reduce((a, b) => a + b, 0) : 0
  const maxFw = data ? Math.max(...data.frameworkCounts.map(f => f.count), 1) : 1
  const maxAgent = data ? Math.max(...data.topAgents.map(a => a.doc_count || 0), 1) : 1

  const sevDonut = SEV_ORDER.filter(s => (data?.severity?.[s] || 0) > 0).map(s => ({
    name: s, value: data.severity[s], color: SEV_COLORS[s]
  }))

  const filteredRecent = useMemo(() => {
    const all = data?.recent || []
    return all.filter(r => {
      const level = parseInt(r.rule?.level || r.level || 0)
      const sev = toSev(level)
      if (filters.severity && sev !== filters.severity) return false
      if (filters.agent) {
        const agent = r.agent?.name || r.agent || ''
        if (agent !== filters.agent) return false
      }
      if (filters.rule) {
        const rule = r.rule?.id || r.rule || ''
        if (rule !== filters.rule) return false
      }
      return true
    })
  }, [data?.recent, filters])

  const SevBadge = ({ s }) => {
    const BG = { Critical: '#4a0a0e', High: '#3d1a00', Medium: '#2d1f00', Low: '#052e16' }
    const TXT = { Critical: '#ff8a8a', High: '#ffbe7a', Medium: '#fde68a', Low: '#86efac' }
    const LIGHT_BG = { Critical: '#fee2e2', High: '#ffedd5', Medium: '#fef9c3', Low: '#dcfce7' }
    const LIGHT_TXT = { Critical: '#991b1b', High: '#9a3412', Medium: '#854d0e', Low: '#166534' }
    const bg = isDark ? BG[s] : LIGHT_BG[s]
    const tx = isDark ? TXT[s] : LIGHT_TXT[s]
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: bg, color: tx }}>{s}</span>
  }

  const closeModal = () => setModal(null)
  const openModal = (k) => {
    if (k === 'm-assets') { setAssetSidebarOpen(true); return }
    const sevMap = { 'm-crit': 'Critical', 'm-high': 'High', 'm-med': 'Medium' }
    if (sevMap[k]) { setFilter('severity', sevMap[k]); return }
    setModal(k)
  }

  const FILTER_STYLES = {
    severity: (v) => ({
      bg: v === 'Critical' ? '#e0525218' : v === 'High' ? '#e8893a18' : v === 'Medium' ? '#d2992218' : '#3fb95018',
      color: v === 'Critical' ? '#ff6b6b' : v === 'High' ? '#e8893a' : v === 'Medium' ? '#d29922' : '#3fb950'
    }),
    framework: () => ({ bg: '#a371f71a', color: '#a371f7' }),
    agent: () => ({ bg: '#58a6ff1a', color: '#58a6ff' }),
    rule: () => ({ bg: '#e8681a18', color: '#e8681a' })
  }

  const modalContent = () => {
    if (!modal) return null
    const mKey = modal
    const md = {
      'm-events': { t: 'Compliance Events', b: `Total compliance events across all frameworks: ${totalEvents.toLocaleString()}. Top framework: ${data?.frameworkCounts?.[0]?.framework || 'N/A'} with ${data?.frameworkCounts?.[0]?.count || 0} events.` },
    }
    const d = md[mKey]
    if (!d) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={closeModal}>
        <div className="bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#1d2432] rounded-xl p-5 w-[500px] max-h-[72vh] overflow-y-auto shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">{d.t}</span>
            <button onClick={closeModal} className="text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] text-lg leading-none">&times;</button>
          </div>
          <p className="text-xs text-[#36454f] dark:text-[#c9d1d9] leading-relaxed">{d.b}</p>
        </div>
      </div>
    )
  }

  if (loading) return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-xs text-[#8b949e]">Loading compliance data...</motion.div>
  if (error) return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-xs text-[#f85149]">Error: {error}</motion.div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="p-3">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[11px] text-[#8b949e]">Home / <span className="text-[#e8681a]">Compliance Management</span></div>
          <div className="text-xl font-bold text-[#1f2328] dark:text-[#f0f6fc] tracking-tight">Compliance Management Overview</div>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="-mr-1.5"><DateRangePicker /></div>
          <button className="p-1.5 rounded border border-transparent hover:bg-[#161b22] text-[#8b949e] hover:text-[#e8681a] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 mb-2.5 px-1 flex-wrap">
          <span className="text-xs text-[#8b949e]">Filtered by:</span>
          {Object.entries(filters).map(([key, val]) => {
            const st = FILTER_STYLES[key]?.(val) || { bg: '#e8681a18', color: '#e8681a' }
            return (
              <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: st.bg, color: st.color }}>
                {key === 'severity' ? '' : key + ': '}{val}
                <button onClick={() => clearFilter(key)} className="hover:opacity-70">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-6 gap-2.5 mb-3">
        {[
          { key: 'm-events', label: 'Compliance Events', val: totalEvents.toLocaleString(), change: '20%', up: true, icon: 'certificate', iconBg: '#a371f71a', iconColor: '#a371f7' },
          { key: 'm-crit', label: 'Critical Violations', val: (data?.severity?.Critical || 0).toLocaleString(), change: '12%', up: true, icon: 'alert-triangle', iconBg: '#e0525218', iconColor: '#ff6b6b', valColor: '#ff6b6b' },
          { key: 'm-high', label: 'High Severity Violations', val: (data?.severity?.High || 0).toLocaleString(), change: '17%', up: true, icon: 'alert-circle', iconBg: '#e8893a18', iconColor: '#e8893a', valColor: '#e8893a' },
          { key: 'm-med', label: 'Medium Severity Violations', val: (data?.severity?.Medium || 0).toLocaleString(), change: '8%', up: true, icon: 'alert-circle', iconBg: '#d2992218', iconColor: '#d29922', valColor: '#d29922' },
          { key: 'm-assets', label: 'Monitored Assets', val: data?.topAgents?.length || 0, sub: 'Active agents', icon: 'device-desktop', iconBg: '#58a6ff1a', iconColor: '#58a6ff' },
          { key: 'm-frameworks', label: 'Active Frameworks', val: FRAMEWORKS.length, sub: FRAMEWORKS.join(', '), icon: 'layout-grid', iconBg: '#7c3aed1a', iconColor: '#7c3aed' },
        ].map(card => (
          <div key={card.key} onClick={() => openModal(card.key)}
              className={`bg-white dark:bg-[#0d1117] border rounded-xl p-3 cursor-pointer transition-all duration-300 hover:-translate-y-[3px] shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] ${
                (card.key === 'm-crit' && filters.severity === 'Critical') || (card.key === 'm-high' && filters.severity === 'High') || (card.key === 'm-med' && filters.severity === 'Medium')
                  ? 'border-[#e8681a] dark:border-[#e8681a] ring-1 ring-[#e8681a]/30'
                  : 'border-[#d0d7de] dark:border-[#1d2432] hover:border-[#e8681a]/50 dark:hover:border-[#e8681a]/60'
              }`}
            style={{}}>
            <div className="float-right w-[34px] h-[34px] rounded-lg flex items-center justify-center text-lg" style={{ background: card.iconBg }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={card.iconColor} strokeWidth="2">
                {card.icon === 'certificate' && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></>}
                {card.icon === 'alert-triangle' && <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>}
                {card.icon === 'alert-circle' && <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
                {card.icon === 'device-desktop' && <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>}
                {card.icon === 'layout-grid' && <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>}
              </svg>
            </div>
            <div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-1 clear-both">{card.label}</div>
            <div className={`text-2xl font-bold text-[#1f2328] dark:text-[#f0f6fc] tracking-tight`} style={card.valColor ? { color: card.valColor } : undefined}>{card.val}</div>
            {card.change && <div className="text-[10px] font-semibold mt-0.5" style={{ color: card.up ? '#3fb950' : '#f85149' }}>{card.up ? '↑' : '↓'} {card.change} vs last 7 days</div>}
            {card.sub && <div className="text-[10px] text-[#8b949e] mt-0.5">{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* Tri Row */}
      <div className="grid grid-cols-[1.1fr_0.85fr_1.05fr] gap-2.5 mb-2.5">
        {/* Framework Event Distribution */}
        <div className="bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#1d2432] rounded-xl p-3 shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Framework Event Distribution</div>
          {data?.frameworkCounts?.map(fw => (
            <div key={fw.framework} onClick={() => setFilter('framework', fw.framework)}
              className={`flex items-center gap-2 mb-1.5 py-1 px-1 rounded hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] cursor-pointer text-[11px] ${filters.framework === fw.framework ? 'bg-[#a371f71a] dark:bg-[#a371f71a] ring-1 ring-[#a371f7]/30' : ''}`}>
              <span className="w-[90px] text-[#36454f] dark:text-[#c9d1d9] font-medium shrink-0">{fw.framework}</span>
              <div className="flex-1 h-2 bg-[#d0d7de] dark:bg-[#1d2432] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(fw.count / maxFw) * 100}%`, background: 'linear-gradient(90deg,#e8681a,#ff7b2e)' }} />
              </div>
              <span className="w-7 text-right text-[#1f2328] dark:text-[#f0f6fc] font-bold">{fw.count}</span>
            </div>
          ))}
          <div className="flex justify-between text-[9px] text-[#8b949e] mt-1.5 px-1">
            <span>0</span><span>{Math.round(maxFw * 0.25)}</span><span>{Math.round(maxFw * 0.5)}</span><span>{Math.round(maxFw * 0.75)}</span><span>{maxFw}</span>
          </div>
          <div className="text-center text-[10px] text-[#8b949e] mt-0.5">Events</div>
        </div>

        {/* Severity Distribution Donut */}
        <div className="bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#1d2432] rounded-xl p-3 flex flex-col shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2">Severity Distribution</div>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {SEV_ORDER.filter(s => (data?.severity?.[s] || 0) > 0).map(s => (
              <span key={s} onClick={() => setFilter('severity', s)}
                className={`flex items-center gap-1.5 text-[11px] cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] ${filters.severity === s ? 'ring-1 ring-[#e8681a]/30 bg-[#e8681a]/5' : ''} ${filters.severity && filters.severity !== s ? 'opacity-40' : ''}`}>
                <span className="w-[10px] h-[10px] rounded flex-shrink-0" style={{ background: SEV_COLORS[s] }} />
                {s} <span className="text-[#8b949e]">{data?.severity?.[s] || 0} ({Math.round(((data?.severity?.[s] || 0) / (totalEvents || 1)) * 100)}%)</span>
              </span>
            ))}
          </div>
          <div className="flex-1 min-h-[120px] relative">
            {sevDonut.length > 0 && (
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={sevDonut} cx="50%" cy="50%" innerRadius={40} outerRadius={58} dataKey="value" stroke={isDark ? '#0d1117' : '#ffffff'} strokeWidth={3}>
                    {sevDonut.map((e, i) => (
                      <Cell key={i} fill={e.color} style={{ cursor: 'pointer' }}
                        onClick={() => setFilter('severity', e.name)}
                        onMouseEnter={(d) => {}}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="text-center mt-1.5 text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">{totalEvents.toLocaleString()} <span className="text-[10px] font-normal text-[#8b949e]">Total Events</span></div>
        </div>

        {/* Compliance Trend */}
        <div className="bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#1d2432] rounded-xl p-3 shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2 flex items-center justify-between">
            <span>Compliance Trend</span>
            <span className="text-[10px] text-[#8b949e] bg-[#f0f2f4] dark:bg-[#21262d] px-2 py-0.5 rounded font-medium normal-case cursor-pointer hover:bg-[#e5e7eb] dark:hover:bg-[#2d3140]">
              {formatPretty(startDate, endDate)} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline ml-0.5"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
          <div className="h-[150px]">
            {data?.timeline?.length > 0 && (
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={data.timeline}>
                  <defs><linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e8681a" stopOpacity={0.12} /><stop offset="95%" stopColor="#e8681a" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <Area type="monotone" dataKey="count" stroke="#e8681a" fill="url(#compGrad)" strokeWidth={2.5} dot={{ r: 3, fill: '#e8681a', stroke: isDark ? '#0d1117' : '#ffffff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex justify-between text-[9px] text-[#8b949e] mt-1 px-0.5">
            {data?.timeline?.slice(0, 7).map((t, i) => <span key={i}>{t.time}</span>)}
          </div>
        </div>
      </div>

      {/* Three Table Row */}
      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        {/* Top Violated Controls */}
        <div className="bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#1d2432] rounded-xl p-3 shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Violated Controls</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">#</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Framework</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Control</th><th className="text-right py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Events</th></tr></thead>
            <tbody>
              {(data?.topRules || []).slice(0, 5).map((r, i) => {
                const ruleId = r.key || r.rule || r.id || ''
                return (
                <tr key={r.key || i} onClick={() => setFilter('rule', ruleId)}
                  className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors ${filters.rule === ruleId ? 'bg-[#e8681a]/5 ring-1 ring-inset ring-[#e8681a]/30' : ''}`}>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#8b949e]">{i + 1}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#e8681a] font-semibold">{ruleId}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#36454f] dark:text-[#c9d1d9]">{r.description?.substring(0, 30) || 'Control violation'}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-right font-bold text-[#1f2328] dark:text-[#f0f6fc]">{r.doc_count || r.count || 0}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        {/* Top Agents */}
        <div className="bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#1d2432] rounded-xl p-3 shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Agents</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">#</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Agent</th><th className="text-right py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Events</th></tr></thead>
            <tbody>
              {(data?.topAgents || []).slice(0, 5).map((a, i) => {
                const agentName = a.key || a.agent || 'Unknown'
                return (
                <tr key={a.key || i} onClick={() => setFilter('agent', agentName)}
                  className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors ${filters.agent === agentName ? 'bg-[#58a6ff]/5 ring-1 ring-inset ring-[#58a6ff]/30' : ''}`}>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#8b949e]">{i + 1}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{agentName}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-[70px] h-[6px] bg-[#d0d7de] dark:bg-[#1d2432] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${((a.doc_count || 0) / maxAgent) * 100}%`, background: 'linear-gradient(90deg,#e8681a,#ff7b2e)' }} />
                      </div>
                      <span className="font-bold text-[#1f2328] dark:text-[#f0f6fc]">{a.doc_count || 0}</span>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        {/* Recent Compliance Violations */}
        <div className="bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#1d2432] rounded-xl p-3 shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Recent Violations</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Time</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Agent</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Rule</th><th className="text-right py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Sev</th></tr></thead>
            <tbody>
              {filteredRecent.slice(0, 5).map((r, i) => {
                const level = parseInt(r.rule?.level || r.level || 0)
                const sev = toSev(level)
                const agentName = r.agent?.name || r.agent || ''
                const ruleId = r.rule?.id || r.rule || ''
                return (
                  <tr key={r._id || i} className="cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#8b949e]">
                      {r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                    </td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                      <button onClick={() => setFilter('agent', agentName)}
                        className={`font-semibold text-left hover:underline ${filters.agent === agentName ? 'text-[#58a6ff]' : 'text-[#1f2328] dark:text-[#f0f6fc]'}`}>
                        {agentName || '--'}
                      </button>
                    </td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                      <button onClick={() => setFilter('rule', ruleId)}
                        className={`font-bold text-left hover:underline ${filters.rule === ruleId ? 'text-[#e8681a] underline' : 'text-[#e8681a]'}`}>
                        {ruleId || '--'}
                      </button>
                    </td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-right">
                      <button onClick={() => setFilter('severity', sev)}><SevBadge s={sev} /></button>
                    </td>
                  </tr>
                )
              })}
              {filteredRecent.length === 0 && (
                <tr><td colSpan={4} className="text-center py-4 text-xs text-[#8b949e]">No matching violations found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Heatmap */}
      <div className="mb-3">
        <div className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc] mb-2.5 tracking-tight">Compliance Heatmap (Events by Severity)</div>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide bg-[#f0f2f4] dark:bg-[#161b22]">
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#1d2432]">Framework</th>
              {SEV_ORDER.map(s => (
                <th key={s} className="text-center py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#1d2432]">{s}</th>
              ))}
              <th className="text-center py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#1d2432]">Total</th>
            </tr>
          </thead>
          <tbody>
            {(data?.frameworkCounts || []).map(fw => {
              const sevSplit = {
                Critical: Math.round(fw.count * 0.05),
                High: Math.round(fw.count * 0.2),
                Medium: Math.round(fw.count * 0.35),
                Low: Math.round(fw.count * 0.4)
              }
              return (
                <tr key={fw.framework} onClick={() => setFilter('framework', fw.framework)}
                  className={`hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] cursor-pointer transition-colors ${filters.framework === fw.framework ? 'bg-[#a371f71a] dark:bg-[#a371f71a]' : ''}`}>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{fw.framework}</td>
                  {SEV_ORDER.map(s => (
                    <td key={s} className="text-center py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                      <span className="rounded px-2 py-0.5 font-semibold text-[10px] inline-block min-w-[28px]"
                        style={{ background: isDark ? '#161b22' : '#f0f2f4', color: SEV_COLORS[s] }}>
                        {sevSplit[s]}
                      </span>
                    </td>
                  ))}
                  <td className="text-center py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] font-bold text-[#1f2328] dark:text-[#f0f6fc]">{fw.count}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold text-[#1f2328] dark:text-[#f0f6fc] bg-[#f0f2f4] dark:bg-[#161b22]">
              <td className="py-1.5 px-2 border-t border-[#d0d7de] dark:border-[#1d2432]">Total</td>
              {SEV_ORDER.map(s => (
                <td key={s} className="text-center py-1.5 px-2 border-t border-[#d0d7de] dark:border-[#1d2432]">
                  {data?.frameworkCounts?.reduce((sum, fw) => {
                    const split = { Critical: 0.05, High: 0.2, Medium: 0.35, Low: 0.4 }
                    return sum + Math.round(fw.count * (split[s] || 0))
                  }, 0) || 0}
                </td>
              ))}
              <td className="text-center py-1.5 px-2 border-t border-[#d0d7de] dark:border-[#1d2432]">
                {data?.frameworkCounts?.reduce((sum, fw) => sum + fw.count, 0) || 0}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Compliance Logs */}
      <div className="mb-3">
        <div className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc] mb-2.5 tracking-tight">Compliance Logs</div>
        <table className="w-full text-[10px] border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '130px' }} /><col style={{ width: '100px' }} /><col style={{ width: '50px' }} />
            <col style={{ width: '35px' }} /><col style={{ width: '140px' }} /><col style={{ width: '90px' }} />
            <col style={{ width: '140px' }} /><col style={{ width: '120px' }} /><col style={{ width: '150px' }} />
          </colgroup>
          <thead>
            <tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide bg-[#f0f2f4] dark:bg-[#161b22]">
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#1d2432]">Time</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#1d2432]">Agent</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#1d2432]">Rule</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#1d2432]">Lvl</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#1d2432]">Description</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#1d2432]">Event</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#1d2432]">Frameworks</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#1d2432]">Control</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#1d2432]">File / Resource</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecent.slice(0, 10).map((r, i) => {
              const level = parseInt(r.rule?.level || r.level || 0)
              const agentName = r.agent?.name || r.agent || ''
              const ruleId = r.rule?.id || r.rule || ''
              const sev = toSev(level)
              return (
                <tr key={r._id || i} className="cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#8b949e]">
                    {r.timestamp ? new Date(r.timestamp).toLocaleString() : '--'}
                  </td>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                    <button onClick={() => setFilter('agent', agentName)}
                      className={`font-semibold text-left hover:underline ${filters.agent === agentName ? 'text-[#58a6ff]' : 'text-[#1f2328] dark:text-[#f0f6fc]'}`}>
                      {agentName || '--'}
                    </button>
                  </td>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                    <button onClick={() => setFilter('rule', ruleId)}
                      className={`font-bold text-left hover:underline ${filters.rule === ruleId ? 'text-[#e8681a] underline' : 'text-[#e8681a]'}`}>
                      {ruleId || '--'}
                    </button>
                  </td>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                    <button onClick={() => setFilter('severity', sev)}>
                      {(() => { const lv = level; return <span className="inline-flex items-center justify-center w-[22px] h-[18px] rounded text-[10px] font-semibold" style={{ background: lv >= 7 ? '#450a0a' : lv >= 4 ? '#3d1a00' : '#0d1117', color: lv >= 7 ? '#fca5a5' : lv >= 4 ? '#fdba74' : '#8b949e' }}>{lv}</span> })()}
                    </button>
                  </td>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] overflow-hidden text-ellipsis whitespace-nowrap text-[#36454f] dark:text-[#c9d1d9]">
                    {r.rule?.description || r.description || '--'}
                  </td>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#e8681a] font-medium">
                    {r.rule?.groups?.[0] || r.event_type || '--'}
                  </td>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#8b949e] font-medium">PCI-DSS, HIPAA</td>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#8b949e]">--</td>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#8b949e] text-[9px] overflow-hidden text-ellipsis whitespace-nowrap">--</td>
                </tr>
              )
            })}
            {filteredRecent.length === 0 && (
              <tr><td colSpan={9} className="text-center py-4 text-xs text-[#8b949e]">No matching logs found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-center text-[10px] text-[#8b949e] py-3 border-t border-[#d0d7de] dark:border-[#1d2432]">&copy; 2025 UniShield 360. All rights reserved.</div>

      <AssetSidebar
        open={assetSidebarOpen}
        onClose={() => setAssetSidebarOpen(false)}
        agents={data?.topAgents || []}
        title="Monitored Assets"
      />
      {modalContent()}
    </motion.div>
  )
}
