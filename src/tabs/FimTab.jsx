import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useApp } from '../context/AppContext'
import * as fimApi from '../services/fimApi'
import DateRangePicker from '../components/DateRangePicker'



function sC(v) { return v > 0 ? `+${v}` : v < 0 ? v : '0' }

function AnimatedCounter({ val, suffix, className }) {
  const [display, setDisplay] = useState(0)
  const frameRef = useRef(null)
  const startRef = useRef(0)
  const dur = 600
  useEffect(() => {
    startRef.current = 0; setDisplay(0)
    const step = (ts) => {
      if (!startRef.current) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / dur, 1)
      setDisplay(Math.round(progress * val))
      if (progress < 1) frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [val])
  return <span className={className}>{display}{suffix}</span>
}

function FilterDropdown({ value, onChange, options, placeholder, className }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { setSidebarOpen } = useApp()
  const selected = options.find(o => o.value === value)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const handleOpen = () => { const now = !open; setOpen(now); if (now) setSidebarOpen(false) }
  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <button onClick={handleOpen}
        className="flex items-center gap-1.5 bg-[#f0f2f4] dark:bg-[#161b22] text-[#1f2328] dark:text-[#f0f6fc] text-[11px] border border-[#d0d7de] dark:border-[#1d2432] rounded-md pl-3 pr-2 py-1.5 focus:outline-none focus:border-[#e8681a]/50 focus:shadow-[0_0_0_3px_rgba(232,104,26,0.1)] transition-all cursor-pointer whitespace-nowrap"
      >
        <span className={value ? 'font-medium' : 'text-[#3b4049] dark:text-[#e5e7eb]'}>{selected ? selected.label : placeholder}</span>
        <svg className={`w-3 h-3 text-[#3b4049] dark:text-[#e5e7eb] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.12 }}
          className="absolute top-full left-0 mt-1 z-[200] min-w-[140px] bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-lg shadow-lg dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)] py-1 overflow-hidden"
        >
          {options.map(opt => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                value === opt.value
                  ? 'bg-[#e8681a]/10 text-[#e8681a] font-semibold'
                  : 'text-[#1f2328] dark:text-[#e5e7eb] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d]'
              }`}
            >{opt.label}</button>
          ))}
        </motion.div>
      )}
    </div>
  )
}

function TabIcon({ icon, className }) {
  const cls = `w-3.5 h-3.5 ${className || ''}`
  const map = {
    chart: <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    monitor: <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
    shield: <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>,
    wrench: <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
  }
  return map[icon] || null
}

const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#9ca3af] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-[#1a1c23] font-semibold">{p.name}: {p.value?.toLocaleString() || p.value}</p>
      ))}
    </div>
  )
}

const CARD = 'bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#1d2432] rounded-xl p-3 shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40'
const SECTION_TITLE = 'text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5'

const AGENT_COLORS = { 'Debian': '#e8681a', 'Amazon': '#ff7b2e', 'RHEL7': '#d97706', 'ip-10-0-0-180.us-west-1.compute.internal': '#0891b2', 'Ubuntu': '#f59e0b', 'Windows': '#dc2626', 'Centos': '#7c3aed' }
const AGENT_COLOR_LIST = ['#e8681a', '#ff7b2e', '#d97706', '#0891b2', '#f59e0b', '#7c3aed', '#dc2626', '#16a34a', '#0d9488', '#db2777']
const GROUP_COLORS = { 'syscheck': '#e8681a', 'syscheck_file': '#dc2626', 'syscheck_registry': '#0891b2', 'syscheck_entry_added': '#16a34a', 'syscheck_entry_deleted': '#dc2626', 'syscheck_entry_modified': '#d97706' }
const TYPE_LABELS = { 'syscheck': 'Syscheck', 'syscheck_file': 'File', 'syscheck_registry': 'Registry', 'syscheck_entry_added': 'Added', 'syscheck_entry_deleted': 'Deleted', 'syscheck_entry_modified': 'Modified' }
function rt(g) { return TYPE_LABELS[g] || g }
function gc(g) { return GROUP_COLORS[g] || '#6b7280' }
function ac(name, i) { return AGENT_COLORS[name] || AGENT_COLOR_LIST[i % AGENT_COLOR_LIST.length] }

export default function FimTab() {
  const { isDark } = useApp()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [severityBuckets, setSeverityBuckets] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [detectionTypes, setDetectionTypes] = useState([])
  const [groupBuckets, setGroupBuckets] = useState([])
  const [agents, setAgents] = useState([])
  const [fimAlerts, setFimAlerts] = useState([])
  const [filePaths, setFilePaths] = useState([])
  const [registryPaths, setRegistryPaths] = useState([])
  const [ruleDescriptions, setRuleDescriptions] = useState([])
  const [agentsByEvent, setAgentsByEvent] = useState([])
  const [added, setAdded] = useState(0)
  const [deleted, setDeleted] = useState(0)
  const [modified, setModified] = useState(0)
  const [registry, setRegistry] = useState(0)
  const [eventSort, setEventSort] = useState({ key: 'alertTime', dir: 'desc' })
  const [eventFilters, setEventFilters] = useState({ q: '', severity: '', type: '' })
  const [searchText, setSearchText] = useState('')
  const searchTimer = useRef(null)
  const [eventPage, setEventPage] = useState(1)
  const [eventTotalCount, setEventTotalCount] = useState(0)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [saCache, setSaCache] = useState({})
  const saCacheRef = useRef({})
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [jumpPage, setJumpPage] = useState('')
  const [jumpMsg, setJumpMsg] = useState('')
  const autoRef = useRef(null)
  const searchReqId = useRef(0)
  const [fimStartDate, setFimStartDate] = useState('now-24h')
  const [fimEndDate, setFimEndDate] = useState('now')
  const [totalCount, setTotalCount] = useState(0)
  const startRef = useRef('now-24h')
  const endRef = useRef('now')
  useEffect(() => { startRef.current = fimStartDate }, [fimStartDate])
  useEffect(() => { endRef.current = fimEndDate }, [fimEndDate])
  const { setSidebarOpen } = useApp()

  const fetchAll = useCallback(async (sd, ed) => {
    try {
      setError(null)
      const start = sd !== undefined ? sd : startRef.current
      const end = ed !== undefined ? ed : endRef.current
      const data = await fimApi.fetchAllFimData({ startDate: start, endDate: end })
      setStats(data.stats)
      setSeverityBuckets(data.severityBuckets)
      setPlatforms(data.platforms)
      setDetectionTypes(data.detectionTypes)
      setGroupBuckets(data.groupBuckets)
      setAgents(data.agents || [])
      setFilePaths(data.filePaths)
      setRegistryPaths(data.registryPaths)
      setRuleDescriptions(data.ruleDescriptions)
      setAgentsByEvent(data.agentsByEvent)
      setAdded(data.added)
      setDeleted(data.deleted)
      setModified(data.modified)
      setRegistry(data.registry)
      setTotalCount(data.stats?.total || 0)
    } catch (err) {
      setError(err.message || 'Failed to load FIM data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { setLoading(true); fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!autoRefresh) { if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null } return }
    if (autoRef.current) clearInterval(autoRef.current)
    autoRef.current = setInterval(() => { fetchAll() }, 30000)
    return () => { if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null } }
  }, [autoRefresh, fetchAll])

  const loadEvents = useCallback(async () => {
    if (activeTab !== 'overview') return
    setEventsLoading(true)
    const myReqId = ++searchReqId.current
    try {
      const params = { startDate: fimStartDate, endDate: fimEndDate, limit: 20, offset: (eventPage - 1) * 20 }
      if (eventPage > 500) params.search_after = saCacheRef.current[eventPage - 1]
      const res = await fimApi.fetchEvents(eventFilters, params)
      if (myReqId !== searchReqId.current) return
      setFimAlerts(res.results)
      setEventTotalCount(res.total)
      if (res.sort) { saCacheRef.current = { ...saCacheRef.current, [eventPage]: res.sort }; setSaCache(saCacheRef.current) }
    } catch (e) {
      if (myReqId === searchReqId.current) setError(e.message)
    } finally {
      if (myReqId === searchReqId.current) setEventsLoading(false)
    }
  }, [activeTab, eventFilters, eventPage, fimStartDate, fimEndDate])

  useEffect(() => { loadEvents() }, [loadEvents])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setEventFilters(prev => ({ ...prev, q: searchText })) }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [searchText])

  useEffect(() => { setEventPage(1) }, [eventFilters.q, eventFilters.severity, eventFilters.type])

  const handleEventFilter = (key, val) => setEventFilters(prev => ({ ...prev, [key]: val }))

  const filteredFimAlerts = useMemo(() => fimAlerts, [fimAlerts])

  const sortedFimAlerts = useMemo(() => {
    const rows = [...filteredFimAlerts]
    rows.sort((a, b) => {
      let va = a[eventSort.key], vb = b[eventSort.key]
      if (va === undefined || va === null) va = ''; if (vb === undefined || vb === null) vb = ''
      if (typeof va === 'string') va = va.toLowerCase(); if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return eventSort.dir === 'asc' ? -1 : 1
      if (va > vb) return eventSort.dir === 'asc' ? 1 : -1
      return 0
    })
    return rows
  }, [filteredFimAlerts, eventSort])

  const fimAlertTotalPages = Math.max(1, Math.ceil(eventTotalCount / 20))
  const pagedFimAlerts = sortedFimAlerts

  const totalVulns = stats?.total || 0
  const totalCritical = stats?.critical || 0
  const totalHigh = stats?.high || 0
  const totalMedium = stats?.medium || 0
  const totalLow = stats?.low || 0

  if (loading) return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-xs text-[#3b4049] dark:text-[#e5e7eb]">Loading FIM data...</motion.div>
  if (error) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-center">
      <div className="text-xs text-[#f85149] mb-3">Error: {error}</div>
      <button onClick={() => { setLoading(true); fetchAll() }} className="px-4 py-1.5 bg-[#e8681a] text-white text-[11px] font-semibold rounded-md hover:bg-[#ff7b2e] transition-colors">Retry</button>
    </motion.div>
  )

  const renderStatCards = () => (
    <div className="grid grid-cols-5 gap-2.5 mb-3">
      {[
        { key: 'f-events', label: 'Total FIM Events', val: totalVulns, icon: 'shield', iconBg: '#a371f71a', iconColor: '#a371f7' },
        { key: 'f-critical', label: 'Critical', val: totalCritical, icon: 'alert-circle', iconBg: '#dc262618', iconColor: '#dc2626', valColor: '#dc2626' },
        { key: 'f-high', label: 'High', val: totalHigh, icon: 'alert-circle', iconBg: '#e8893a18', iconColor: '#e8893a', valColor: '#e8893a' },
        { key: 'f-med', label: 'Medium', val: totalMedium, icon: 'alert-circle', iconBg: '#d9770618', iconColor: '#d97706', valColor: '#d97706' },
        { key: 'f-low', label: 'Low', val: totalLow, icon: 'alert-circle', iconBg: '#16a34a18', iconColor: '#16a34a', valColor: '#16a34a' }
      ].map(card => (
        <div key={card.key} className={CARD}>
          <div className="float-right w-[34px] h-[34px] rounded-lg flex items-center justify-center text-lg" style={{ background: card.iconBg }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={card.iconColor} strokeWidth="2">
              {card.icon === 'shield' && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></>}
              {card.icon === 'alert-triangle' && <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>}
              {card.icon === 'alert-circle' && <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
              {card.icon === 'monitor' && <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>}
            </svg>
          </div>
          <div className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide font-semibold mb-1 clear-both">{card.label}</div>
          <div className="text-2xl font-bold text-[#1f2328] dark:text-[#f0f6fc] tracking-tight" style={card.valColor ? { color: card.valColor } : undefined}>
            <AnimatedCounter val={card.val} />
          </div>
        </div>
      ))}
    </div>
  )

  const renderActionCards = () => (
    <div className="grid grid-cols-4 gap-2.5 mb-3">
      {[
        { key: 'f-add', label: 'Added', val: added, color: '#16a34a' },
        { key: 'f-del', label: 'Deleted', val: deleted, color: '#dc2626' },
        { key: 'f-mod', label: 'Modified', val: modified, color: '#d97706' },
        { key: 'f-reg', label: 'Registry', val: registry, color: '#0891b2' }
      ].map(card => (
        <div key={card.key} className={CARD}>
          <div className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide font-semibold mb-1">{card.label}</div>
          <div className="text-2xl font-bold tracking-tight" style={{ color: card.color }}>
            <AnimatedCounter val={card.val} />
          </div>
          <div className="w-full h-1 mt-2 rounded-full bg-[#1d2432] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (card.val / (added || 1)) * 100)}%`, backgroundColor: card.color }} />
          </div>
        </div>
      ))}
    </div>
  )

  const renderAgentsByEvent = () => {
    const eventTypes = ['added', 'deleted', 'modified']
    const eventColors = { added: '#16a34a', deleted: '#dc2626', modified: '#d97706' }
    return (
      <div className={`${CARD} flex flex-col`}>
        <div className={SECTION_TITLE}>Alerts by Action</div>
        <div className="flex-1 min-h-0" style={{ minHeight: 260 }}>
          {agentsByEvent.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={(() => {
                const buckets = {}
                for (const a of agentsByEvent) {
                  for (const t of eventTypes) {
                    if (a[t]) { if (!buckets[t]) buckets[t] = []; buckets[t].push(a[t]) }
                  }
                }
                const maxLen = Math.max(...Object.values(buckets).map(b => b.length), 0)
                const result = []
                for (let i = 0; i < maxLen; i++) {
                  const row = { index: i }
                  for (const t of eventTypes) row[t] = (buckets[t] || [])[i] || 0
                  result.push(row)
                }
                return result
              })()} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2432" vertical={false} strokeOpacity={0.25} />
                <XAxis dataKey="index" tick={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: isDark ? '#e5e7eb' : '#8b949e' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<CustomTip />} />
                {eventTypes.map(t => (
                  <Area key={t} type="monotone" dataKey={t} stackId="1" stroke={eventColors[t]} fill={eventColors[t] + '33'} strokeWidth={1.5} dot={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5 text-[9px]">
          {eventTypes.map(t => (
            <span key={t} className="flex items-center gap-1 px-1 py-0.5 rounded font-medium">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: eventColors[t] }} />
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </span>
          ))}
        </div>
      </div>
    )
  }

  const renderEventsByType = () => {
    const eventTypes = ['added', 'deleted', 'modified']
    const eventColors = { added: '#16a34a', deleted: '#dc2626', modified: '#d97706' }
    const data = eventTypes.map(t => ({
      key: t.charAt(0).toUpperCase() + t.slice(1),
      count: groupBuckets.filter(b => b.key === 'syscheck_entry_' + t).reduce((s, b) => s + b.doc_count, 0)
    })).filter(d => d.count > 0)
    const hasReg = groupBuckets.filter(b => b.key === 'syscheck_registry').reduce((s, b) => s + b.doc_count, 0)
    if (hasReg > 0) data.push({ key: 'Registry', count: hasReg })
    const maxCount = Math.max(...data.map(d => d.count), 1)
    return (
      <div className={`${CARD} flex flex-col`}>
        <div className={SECTION_TITLE}>Events by FIM Type</div>
        <div className="flex-1 min-h-0" style={{ minHeight: 260 }}>
          {data.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2432" horizontal={false} strokeOpacity={0.25} />
                <XAxis type="number" tick={{ fontSize: 9, fill: isDark ? '#e5e7eb' : '#8b949e' }} axisLine={false} tickLine={false} domain={[0, maxCount]} />
                <YAxis type="category" dataKey="key" tick={{ fontSize: 9, fill: isDark ? '#e5e7eb' : '#8b949e' }} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={<CustomTip />} cursor={false} />
                <Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={16} isAnimationActive={false}>
                  {data.map((d, i) => <Cell key={i} fill={d.key === 'Registry' ? '#0891b2' : eventColors[d.key.toLowerCase()] || '#6b7280'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    )
  }

  const renderFilePaths = () => (
    <div className={`${CARD} flex flex-col`}>
      <div className={SECTION_TITLE}>Top File Paths</div>
      <div className="overflow-y-auto">
        {filePaths.length > 0 ? (
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] font-bold uppercase tracking-wide">
              <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">#</th>
              <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Path</th>
              <th className="text-right py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Count</th>
            </tr></thead>
            <tbody>
              {filePaths.slice(0, 5).map((f, i) => (
                <tr key={f.key} className="hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#3b4049] dark:text-[#e5e7eb]">{i + 1}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#1f2937] dark:text-[#e5e7eb] truncate max-w-[180px]">{f.key}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-right font-bold text-[#1f2328] dark:text-[#f0f6fc]">{f.doc_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] text-center py-4">No file paths</div>}
      </div>
    </div>
  )

  const renderRegistryPaths = () => (
    <div className={`${CARD} flex flex-col`}>
      <div className={SECTION_TITLE}>Registry Changes</div>
      <div className="overflow-y-auto">
        {registryPaths.length > 0 ? (
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] font-bold uppercase tracking-wide">
              <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">#</th>
              <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Key</th>
              <th className="text-right py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Count</th>
            </tr></thead>
            <tbody>
              {registryPaths.slice(0, 5).map((f, i) => (
                <tr key={f.key} className="hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#3b4049] dark:text-[#e5e7eb]">{i + 1}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#1f2937] dark:text-[#e5e7eb] truncate max-w-[180px]">{f.key}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-right font-bold text-[#1f2328] dark:text-[#f0f6fc]">{f.doc_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] text-center py-4">No registry changes</div>}
      </div>
    </div>
  )

  const renderRuleDescriptions = () => (
    <div className={`${CARD} flex flex-col`}>
      <div className={SECTION_TITLE}>Rule Description</div>
      <div className="overflow-y-auto">
        {ruleDescriptions.length > 0 ? (
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] font-bold uppercase tracking-wide">
              <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">#</th>
              <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Description</th>
              <th className="text-right py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Count</th>
            </tr></thead>
            <tbody>
              {ruleDescriptions.slice(0, 5).map((d, i) => (
                <tr key={d.key} className="hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#3b4049] dark:text-[#e5e7eb]">{i + 1}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#1f2937] dark:text-[#e5e7eb] truncate max-w-[200px]">{d.key}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-right font-bold text-[#1f2328] dark:text-[#f0f6fc]">{d.doc_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] text-center py-4">No rule descriptions</div>}
      </div>
    </div>
  )

  const renderOverview = () => (
    <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {renderStatCards()}
      {renderActionCards()}
      <div className="grid grid-cols-2 gap-3 mb-3 items-stretch">
        {renderAgentsByEvent()}
        {renderEventsByType()}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3 items-stretch">
        {renderFilePaths()}
        {renderRegistryPaths()}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3 items-stretch">
        <div className={`${CARD} flex flex-col`}>
          <div className={SECTION_TITLE}>Top Agents by Event</div>
          <div className="flex-1 min-h-0" style={{ minHeight: 260 }}>
            {agentsByEvent.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentsByEvent} layout="vertical" margin={{ top: 5, right: 5, left: 80, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d2432" horizontal={false} strokeOpacity={0.25} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: isDark ? '#e5e7eb' : '#8b949e' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="agent" tick={{ fontSize: 8, fill: isDark ? '#e5e7eb' : '#8b949e' }} axisLine={false} tickLine={false} width={70} tickFormatter={v => v.length > 12 ? v.substring(0, 10) + '..' : v} />
                  <Tooltip content={<CustomTip />} />
                  {['added', 'deleted', 'modified'].map((t, i) => (
                    <Bar key={t} dataKey={t} stackId="a" fill={{ 'added': '#16a34a', 'deleted': '#dc2626', 'modified': '#d97706' }[t]} radius={[0, 3, 3, 0]} barSize={16} isAnimationActive={false} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5 text-[9px]">
            {['added', 'deleted', 'modified'].map(t => (
              <span key={t} className="flex items-center gap-1 px-1 py-0.5 rounded font-medium">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: { 'added': '#16a34a', 'deleted': '#dc2626', 'modified': '#d97706' }[t] }} />
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </span>
            ))}
          </div>
        </div>
        {renderRuleDescriptions()}
      </div>
      <div className="mb-3">{renderEvents()}</div>
    </motion.div>
  )

  const renderEvents = () => (
    <motion.div key="events" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className={`${CARD} mb-3`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[180px]">
            <input type="text" placeholder="Search by agent, path, rule, event type..." value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="w-full bg-[#f0f2f4] dark:bg-[#161b22] text-[#1f2328] dark:text-[#f0f6fc] text-[11px] border border-[#d0d7de] dark:border-[#1d2432] rounded-md px-3 py-1.5 pl-8 focus:outline-none focus:border-[#e8681a]/50 transition-colors placeholder:text-[#3b4049] dark:text-[#e5e7eb]"
            />
            <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[#3b4049] dark:text-[#e5e7eb]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <FilterDropdown value={eventFilters.severity} onChange={v => handleEventFilter('severity', v)}
            options={[
              { value: '', label: 'All Severities' },
              { value: 'Critical', label: 'Critical' }, { value: 'High', label: 'High' },
              { value: 'Medium', label: 'Medium' }, { value: 'Low', label: 'Low' }
            ]}
            placeholder="All Severities" />
          <FilterDropdown value={eventFilters.type} onChange={v => handleEventFilter('type', v)}
            options={[
              { value: '', label: 'All Types' },
              ...detectionTypes.slice(0, 20).map(a => ({ value: a.code, label: a.type }))
            ]}
            placeholder="All Types" />
        </div>
      </div>
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] font-bold uppercase tracking-wide">
              {[
                { key: 'alertTime', label: 'Time', sortable: true },
                { key: 'agentName', label: 'Agent', sortable: true },
                { key: 'syscheckPath', label: 'File Path', sortable: false },
                { key: 'syscheckEvent', label: 'Event', sortable: true },
                { key: 'syscheckUser', label: 'User', sortable: true },
                { key: 'ruleLevel', label: 'Level', sortable: true }
              ].map(col => (
                <th key={col.key} className={`text-left py-2 px-2 border-b border-[#d0d7de] dark:border-[#1d2432] ${col.sortable ? 'cursor-pointer hover:text-[#e8681a] select-none' : ''}`}
                  onClick={() => { if (!col.sortable) return; setEventSort(prev => ({ key: col.key, dir: prev.key === col.key && prev.dir === 'asc' ? 'desc' : 'asc' })) }}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && eventSort.key === col.key && (
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {eventSort.dir === 'asc' ? <polyline points="6 15 12 9 18 15" /> : <polyline points="6 9 12 15 18 9" />}
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedFimAlerts.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-[11px] text-[#3b4049] dark:text-[#e5e7eb]">
                {eventsLoading ? 'Searching...' : 'No events match your filters.'}
              </td></tr>
            )}
            {pagedFimAlerts.map((v, i) => (
              <tr key={v.id || i} className="hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">
                <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#1f2328] dark:text-[#f0f6fc] whitespace-nowrap">{v.alertTime}</td>
                <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{v.agentName}</td>
                <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#e8681a] font-mono text-[10px] truncate max-w-[180px]">{v.syscheckPath}</td>
                <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                    v.syscheckEvent === 'added' ? 'bg-[#16a34a]/20 text-[#1f2328] dark:text-[#f0f6fc]' :
                    v.syscheckEvent === 'deleted' ? 'bg-[#dc2626]/20 text-[#1f2328] dark:text-[#f0f6fc]' :
                    v.syscheckEvent === 'modified' ? 'bg-[#d97706]/20 text-[#1f2328] dark:text-[#f0f6fc]' :
                    'bg-[#0891b2]/20 text-[#1f2328] dark:text-[#f0f6fc]'
                  }`}>{v.syscheckEvent || v.detectionTypeLabel}</span>
                </td>
                <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#1f2937] dark:text-[#e5e7eb]">{v.syscheckUser}</td>
                <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                    v.severity === 'Critical' ? 'bg-[#dc2626]/20 text-[#1f2328] dark:text-[#f0f6fc]' :
                    v.severity === 'High' ? 'bg-[#ea580c]/20 text-[#1f2328] dark:text-[#f0f6fc]' :
                    v.severity === 'Medium' ? 'bg-[#d97706]/20 text-[#1f2328] dark:text-[#f0f6fc]' :
                    'bg-[#16a34a]/20 text-[#1f2328] dark:text-[#f0f6fc]'
                  }`}>{v.ruleLevel}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {fimAlertTotalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
          <button onClick={() => setEventPage(p => Math.max(1, p - 1))} disabled={eventPage === 1}
            className="px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-[#d0d7de] dark:border-[#1d2432] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >Previous</button>
          <div className="flex gap-1 items-center">
            {(() => {
              const total = fimAlertTotalPages, curr = eventPage, maxVis = 500, pages = []
              if (total <= maxVis) {
                const showAll = total <= 7
                if (showAll) { for (let i = 1; i <= total; i++) pages.push(i) }
                else {
                  pages.push(1); let s = Math.max(2, curr - 2), e = Math.min(total - 1, curr + 2)
                  if (s > 2) pages.push('...')
                  for (let i = s; i <= e; i++) pages.push(i)
                  if (e < total - 1) pages.push('...')
                  pages.push(total)
                }
              } else {
                pages.push(1)
                if (curr <= maxVis) {
                  let s = Math.max(2, curr - 2), e = Math.min(maxVis, curr + 2)
                  if (s > 2) pages.push('...')
                  for (let i = s; i <= e; i++) pages.push(i)
                  if (e < maxVis) pages.push('...')
                  pages.push({ label: '500+', disabled: true })
                } else {
                  if (curr > maxVis + 3) pages.push('...')
                  for (let i = Math.max(maxVis + 1, curr - 2); i <= Math.min(total, curr + 2); i++) pages.push(i)
                  if (curr + 2 < total) pages.push('...')
                }
                if (curr > maxVis) pages.push({ label: '500+', disabled: true })
              }
              return pages.map((p, i) =>
                p === '...' ? <span key={'e' + i} className="px-1 text-[10px] text-[#3b4049] dark:text-[#e5e7eb] select-none">•••</span>
                : p.disabled ? <span key="gt" className="px-2 py-1 text-[10px] text-[#e8681a] font-semibold italic select-none">beyond 500</span>
                : <button key={p} onClick={() => setEventPage(p)}
                    className={`min-w-[26px] h-7 px-1 text-[11px] font-medium rounded-md transition-colors ${curr === p ? 'bg-[#e8681a] text-white shadow-sm' : 'text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f0f2f4] dark:hover:bg-[#161b22]'}`}>{p}</button>
              )
            })()}
          </div>
          <button onClick={() => setEventPage(p => { const n = p + 1; if (n <= 500) return n; if (p < 500) return 501; return Math.min(fimAlertTotalPages, n) })} disabled={eventPage === fimAlertTotalPages}
            className="px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-[#d0d7de] dark:border-[#1d2432] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >Next</button>
          <div className="flex items-center gap-1 ml-1">
            <input type="text" value={jumpPage} onChange={e => setJumpPage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && jumpPage) { const p = parseInt(jumpPage); if (p > 0 && p <= fimAlertTotalPages) { if (p > 500 && !saCache[p - 1]) { setJumpMsg('Navigate from page 500'); setJumpPage(''); return }; setEventPage(p); setJumpPage(''); setJumpMsg('') } } }}
              placeholder="Pg" className="w-12 h-7 px-1 text-[10px] text-center border border-[#d0d7de] dark:border-[#1d2432] rounded-md bg-transparent text-[#1f2328] dark:text-[#f0f6fc] focus:outline-none focus:border-[#e8681a]/50 placeholder:text-[#3b4049] dark:placeholder:text-[#e5e7eb]" />
            <button onClick={() => { if (jumpPage) { const p = parseInt(jumpPage); if (p > 0 && p <= fimAlertTotalPages) { if (p > 500 && !saCache[p - 1]) { setJumpMsg('Navigate from page 500'); setJumpPage(''); return }; setEventPage(p); setJumpPage(''); setJumpMsg('') } } }}
              className="px-2 h-7 text-[10px] font-medium rounded-md border border-[#d0d7de] dark:border-[#1d2432] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">Go</button>
            <button onClick={() => { if (fimAlertTotalPages > 500 && !saCache[fimAlertTotalPages - 1]) { setJumpMsg('Navigate from page 500'); return }; setEventPage(fimAlertTotalPages) }}
              className="px-2 h-7 text-[10px] font-medium rounded-md border border-[#d0d7de] dark:border-[#1d2432] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">Last</button>
            {jumpMsg && <span className="text-[10px] text-[#e8681a] font-medium animate-pulse">{jumpMsg}</span>}
          </div>
        </div>
      )}
    </motion.div>
  )

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="p-2 sm:p-3 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
        <div className="flex gap-0.5 bg-[#f0f2f4] dark:bg-[#161b22] rounded-lg p-0.5 overflow-x-auto">
          <button key="overview" onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-[#0d1117] text-[#1f2328] dark:text-[#f0f6fc] shadow-sm border border-[#d0d7de] dark:border-[#1d2432]'
                : 'text-[#3b4049] dark:text-[#e5e7eb] hover:text-[#1f2328] dark:hover:text-[#f0f6fc]'
            }`}
          >
            Overview
          </button>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker startDate={fimStartDate} onStartChange={(v) => { startRef.current = v; setFimStartDate(v) }}
            endDate={fimEndDate} onEndChange={(v) => { endRef.current = v; setFimEndDate(v) }}
            onSearch={() => { setLoading(true); fetchAll(startRef.current, endRef.current) }} />
          <button onClick={() => { setLoading(true); fetchAll() }}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#d0d7de] dark:border-[#1d2432] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors" title="Refresh all data">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Refresh
          </button>
          <button onClick={() => setAutoRefresh(p => !p)}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
              autoRefresh ? 'bg-[#e8681a]/10 border-[#e8681a]/40 text-[#e8681a]' : 'border-[#d0d7de] dark:border-[#1d2432] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f0f2f4] dark:hover:bg-[#161b22]'
            }`} title={autoRefresh ? 'Auto-refresh every 30s — click to stop' : 'Enable auto-refresh every 30s'}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {autoRefresh && <span className="w-1.5 h-1.5 rounded-full bg-[#e8681a] animate-pulse" />}
          </button>
        </div>
      </div>
      {activeTab === 'overview' && renderOverview()}
    </motion.div>
  )
}
