import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useApp } from '../context/AppContext'
import * as gdprApi from '../services/gdprApi'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import DateRangePicker from '../components/DateRangePicker'

const INNER_TABS = [
  { key: 'overview', label: 'Overview', icon: 'chart' },
  { key: 'agents', label: 'Agents', icon: 'monitor' },
  { key: 'events', label: 'GDPR Events', icon: 'shield' },
  { key: 'controls', label: 'GDPR Controls', icon: 'wrench' }
]

const SEV_COLORS = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a' }
const SEV_ORDER = ['critical', 'high', 'medium', 'low']

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

  const handleOpen = () => {
    const now = !open
    setOpen(now)
    if (now) setSidebarOpen(false)
  }

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

export default function GdprTab() {
  const { isDark } = useApp()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [severityBuckets, setSeverityBuckets] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [articles, setArticles] = useState([])
  const [events, setEvents] = useState([])
  const [gdprAlerts, setGdprAlerts] = useState([])
  const [agents, setAgents] = useState([])
  const [trend, setTrend] = useState([])
  const [articleBands, setArticleBands] = useState([])
  const [controlStats, setControlStats] = useState(null)
  const [hiddenSeries, setHiddenSeries] = useState(new Set())
  const [hiddenDonut, setHiddenDonut] = useState(new Set())
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [eventSort, setEventSort] = useState({ key: 'alertTime', dir: 'desc' })
  const [eventFilters, setEventFilters] = useState({ q: '', severity: '', article: '' })
  const [agentFilters, setAgentFilters] = useState({ q: '', os: '' })
  const [agentPage, setAgentPage] = useState(1)
  const [eventPage, setEventPage] = useState(1)
  const [showReport, setShowReport] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [agentView, setAgentView] = useState(null)
  const [reportForm, setReportForm] = useState({ assets: 312, os: 'All', severity: { critical: true, high: true, medium: false, low: false }, format: 'PDF' })
  const [detailsModalAgent, setDetailsModalAgent] = useState(null)
  const [eventDetailTab, setEventDetailTab] = useState('description')
  const [globalFilters, setGlobalFilters] = useState([])
  const [gdprStartDate, setGdprStartDate] = useState('now-1y')
  const [gdprEndDate, setGdprEndDate] = useState('now')
  const [totalCount, setTotalCount] = useState(0)
  const startRef = useRef('now-1y')
  const endRef = useRef('now')
  useEffect(() => { startRef.current = gdprStartDate }, [gdprStartDate])
  useEffect(() => { endRef.current = gdprEndDate }, [gdprEndDate])
  const AGENT_PER_PAGE = 12
  const { setSidebarOpen, setTab } = useApp()

  const toggleFilter = useCallback((field, value, type) => {
    setGlobalFilters(prev => {
      const id = `${field}-${value}-${type}`
      if (prev.some(f => f.id === id)) return prev.filter(f => f.id !== id)
      return [...prev, { id, field, value, type }]
    })
  }, [])
  const removeFilter = useCallback(id => setGlobalFilters(prev => prev.filter(f => f.id !== id)), [])
  const hasFilter = useCallback((field, value, type) => globalFilters.some(f => f.field === field && f.value === value && f.type === type), [globalFilters])
  const filterCount = globalFilters.length

  useEffect(() => {
    if (selectedEvent || agentView || detailsModalAgent) setSidebarOpen(false)
  }, [selectedEvent, agentView, detailsModalAgent, setSidebarOpen])

  const fetchAll = useCallback(async (sd, ed) => {
    try {
      setError(null)
      const start = sd !== undefined ? sd : startRef.current
      const end = ed !== undefined ? ed : endRef.current
      const data = await gdprApi.fetchAllGdprData({ startDate: start, endDate: end })
      setStats(data.stats)
      setSeverityBuckets(data.severityBuckets)
      setPlatforms(data.platforms)
      setArticles(data.articles)
      setEvents(data.events)
      setGdprAlerts(data.vulnAlerts || [])
      setAgents(data.agents)
      setTrend(data.trend)
      setArticleBands(data.articleBands)
      setControlStats(data.controlStats)
      setTotalCount(data.stats?.total || data.events.length)
    } catch (err) {
      setError(err.message || 'Failed to load GDPR data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { setLoading(true); fetchAll() }, [fetchAll])

  const filteredEvents = useMemo(() => {
    if (!globalFilters.length) return events
    return events.filter(e => {
      for (const f of globalFilters) {
        let match = false
        if (f.field === 'severity') match = e.severity === f.value
        else if (f.field === 'os') match = e.os === f.value
        else if (f.field === 'article') match = e.article === f.value
        else if (f.field === 'agentName') match = e.agentName === f.value
        else if (f.field === 'agentIP') match = e.agentIP === f.value
        if (f.type === 'exclude' && match) return false
        if (f.type === 'include' && !match) return false
      }
      return true
    })
  }, [events, globalFilters])

  const filteredAgents = useMemo(() => {
    if (!globalFilters.length) return agents
    return agents.filter(a => {
      for (const f of globalFilters) {
        let match = false
        if (f.field === 'os') match = a.os === f.value
        else if (f.field === 'agentName') match = a.name === f.value
        else if (f.field === 'severity') {
          const key = f.value[0].toLowerCase()
          match = (a.vulns[key] || 0) > 0
        }
        if (f.type === 'exclude' && match) return false
        if (f.type === 'include' && !match) return false
      }
      return true
    })
  }, [agents, globalFilters])

  const filteredTrend = useMemo(() => {
    if (!globalFilters.length) return trend
    return trend.map(t => {
      const pt = { date: t.date }
      let total = 0
      SEV_ORDER.forEach(s => {
        const sevLabel = s.charAt(0).toUpperCase() + s.slice(1)
        const hasInc = globalFilters.some(f => f.field === 'severity' && f.value === sevLabel && f.type === 'include')
        const hasExc = globalFilters.some(f => f.field === 'severity' && f.value === sevLabel && f.type === 'exclude')
        if (hasInc) { pt[sevLabel] = t[sevLabel] || 0; total += pt[sevLabel] }
        else if (globalFilters.some(f => f.field === 'severity' && f.type === 'include')) { pt[sevLabel] = 0 }
        else if (hasExc) { pt[sevLabel] = 0 }
        else { pt[sevLabel] = t[sevLabel] || 0; total += pt[sevLabel] }
      })
      pt.total = total
      return pt
    })
  }, [trend, globalFilters])

  const filteredArticles = useMemo(() => {
    if (!globalFilters.length) return articles
    return articles.filter(a => {
      for (const f of globalFilters) {
        let match = false
        if (f.field === 'severity') match = a.severity === f.value
        else if (f.field === 'article') match = a.article === f.value
        if (f.type === 'exclude' && match) return false
        if (f.type === 'include' && !match) return false
      }
      return true
    })
  }, [articles, globalFilters])

  function FilterWrapper({ children, field, value, className = '' }) {
    const incActive = hasFilter(field, value, 'include')
    const excActive = hasFilter(field, value, 'exclude')
    return (
      <div className={`relative group ${className}`}>
        {children}
        <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex gap-0.5 z-10">
          <button onClick={e => { e.stopPropagation(); toggleFilter(field, value, 'include') }}
            className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold transition-colors shadow-sm ${incActive ? 'bg-[#e8681a] text-white' : 'bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#1d2432] text-[#e8681a] hover:bg-[#e8681a] hover:text-white'}`}>+</button>
          <button onClick={e => { e.stopPropagation(); toggleFilter(field, value, 'exclude') }}
            className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold transition-colors shadow-sm ${excActive ? 'bg-[#f85149] text-white' : 'bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#1d2432] text-[#f85149] hover:bg-[#f85149] hover:text-white'}`}>-</button>
        </div>
      </div>
    )
  }

  const renderFilterBar = () => {
    if (!globalFilters.length) return null
    return (
      <div className="flex flex-wrap items-center gap-1.5 mb-3 px-3 py-2 bg-[#f6f8fa] dark:bg-[#161b22] rounded-md border border-[#d0d7de] dark:border-[#30363d]">
        <span className="text-[10px] font-semibold text-[#656d76] dark:text-[#8b949e] mr-0.5">Filters:</span>
        {globalFilters.map(f => (
          <span key={f.id} className={`inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-md text-[11px] font-medium border ${
            f.type === 'include'
              ? 'bg-[#ddf4e8] dark:bg-[#1b3a2d] text-[#1f2328] dark:text-[#f0f6fc] border-[#b8e4cb] dark:border-[#2e6e44]'
              : 'bg-[#ffe9e9] dark:bg-[#3d1f1f] text-[#1f2328] dark:text-[#f0f6fc] border-[#f7c5c5] dark:border-[#6e3030]'
          }`}>
            <span className="leading-none">{f.value}</span>
            <button onClick={() => removeFilter(f.id)}
              className="ml-0.5 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors leading-none"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>
            </button>
          </span>
        ))}
        <button onClick={() => setGlobalFilters([])}
          className="ml-auto text-[10px] text-[#656d76] dark:text-[#8b949e] hover:text-[#cf222e] dark:hover:text-[#f85149] font-medium transition-colors"
        >Clear all</button>
      </div>
    )
  }

  const donutData = useMemo(() => {
    if (globalFilters.length) {
      const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 }
      const colors = { Critical: '#dc2626', High: '#ea580c', Medium: '#d97706', Low: '#16a34a' }
      filteredEvents.forEach(e => { if (counts[e.severity] !== undefined) counts[e.severity]++ })
      return Object.entries(counts).map(([name, value]) => ({ name, value, fill: colors[name] })).filter(d => d.value > 0)
    }
    return severityBuckets.map((b, i) => ({ ...b, value: b.count, fill: b.color }))
  }, [severityBuckets, filteredEvents, globalFilters.length])

  const totAgents = useMemo(() => filteredAgents.length, [filteredAgents])
  const invTotalPages = Math.max(1, Math.ceil(totAgents / AGENT_PER_PAGE))
  const pagedAgents = useMemo(() => filteredAgents.slice((agentPage - 1) * AGENT_PER_PAGE, agentPage * AGENT_PER_PAGE), [filteredAgents, agentPage])

  const topAgents = useMemo(() => [...filteredAgents].sort((a, b) => (b.vulns.c + b.vulns.h + b.vulns.m + b.vulns.l) - (a.vulns.c + a.vulns.h + a.vulns.m + a.vulns.l)).slice(0, 5), [filteredAgents])
  const maxAgentEvents = useMemo(() => topAgents.length > 0 ? topAgents[0].vulns.c + topAgents[0].vulns.h + topAgents[0].vulns.m + topAgents[0].vulns.l : 1, [topAgents])
  const topArticles = useMemo(() => [...articles].sort((a, b) => b.eventCount - a.eventCount).slice(0, 5), [articles])
  const maxArticleEvents = useMemo(() => topArticles.length > 0 ? topArticles[0].eventCount : 1, [topArticles])

  useEffect(() => { setAgentPage(1) }, [agentFilters])

  const invSearchTimer = useRef(null)

  useEffect(() => {
    if (invSearchTimer.current) clearTimeout(invSearchTimer.current)
    invSearchTimer.current = setTimeout(() => { applyAgentFilters() }, 300)
    return () => { if (invSearchTimer.current) clearTimeout(invSearchTimer.current) }
  }, [agentFilters.q, agentFilters.os])

  useEffect(() => { setEventPage(1) }, [eventFilters.q, eventFilters.severity, eventFilters.article])

  const toggleSeries = (name) => {
    setHiddenSeries(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  const toggleDonut = (label) => {
    setHiddenDonut(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label); else next.add(label)
      return next
    })
  }

  const handleEventFilter = (key, val) => setEventFilters(prev => ({ ...prev, [key]: val }))
  const handleAgentFilter = (key, val) => { setAgentFilters(prev => ({ ...prev, [key]: val })) }

  const applyAgentFilters = async () => { try { setAgentPage(1); const res = await gdprApi.fetchAgents(agentFilters); setAgents(res) } catch (e) { setError(e.message) } }

  const handleGenerateReport = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      doc.setFontSize(16)
      doc.text('GDPR Compliance Report', pageW / 2, 15, { align: 'center' })
      doc.setFontSize(9)
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageW / 2, 21, { align: 'center' })
      const sortedForExport = [...filteredGdprAlerts].sort((a, b) => a.alertTime < b.alertTime ? 1 : -1)
      doc.text(`Total Events: ${events.length} | Critical: ${totalCritical} | High: ${totalHigh} | Medium: ${stats?.medium || 0} | Low: ${stats?.low || 0}`, pageW / 2, 26, { align: 'center' })
      const rows = sortedForExport.map(v => [v.alertTime, v.agentName, v.ruleId, v.severity, v.description, v.article, v.os, v.agentIP])
      doc.autoTable({
        startY: 30, head: [['Alert Time', 'Agent Name', 'Rule ID', 'Severity', 'Description', 'Article', 'OS', 'IP']],
        body: rows,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [232, 104, 26], fontSize: 7, halign: 'center' },
        columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 26 }, 2: { cellWidth: 18 }, 3: { cellWidth: 14, halign: 'center' }, 4: { cellWidth: 56 }, 5: { cellWidth: 28 }, 6: { cellWidth: 16 }, 7: { cellWidth: 24 } }
      })
      const dateStr = new Date().toISOString().substring(0, 10)
      doc.save(`gdpr-report-${dateStr}.pdf`)
    } catch (e) {
      setError('Failed to generate PDF: ' + e.message)
    }
  }

  const EVENT_PER_PAGE = 15

  const filteredGdprAlerts = useMemo(() => {
    let result = gdprAlerts
    if (eventFilters.q) {
      const q = eventFilters.q.toLowerCase()
      result = result.filter(v =>
        v.agentName.toLowerCase().includes(q) ||
        v.ruleId.toLowerCase().includes(q) ||
        v.article.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.agentIP.includes(q)
      )
    }
    if (eventFilters.severity) result = result.filter(v => v.severity === eventFilters.severity)
    if (eventFilters.article) result = result.filter(v => v.article === eventFilters.article)
    if (globalFilters.length) {
      result = result.filter(v => {
        for (const f of globalFilters) {
          let match = false
          if (f.field === 'severity') match = v.severity === f.value
          else if (f.field === 'article') match = v.article === f.value
          else if (f.field === 'agentName') match = v.agentName === f.value
          else if (f.field === 'agentIP') match = v.agentIP === f.value
          if (f.type === 'exclude' && match) return false
          if (f.type === 'include' && !match) return false
        }
        return true
      })
    }
    return result
  }, [gdprAlerts, eventFilters, globalFilters])

  const sortedGdprAlerts = useMemo(() => {
    const rows = [...filteredGdprAlerts]
    rows.sort((a, b) => {
      let va = a[eventSort.key], vb = b[eventSort.key]
      if (va === undefined || va === null) va = ''
      if (vb === undefined || vb === null) vb = ''
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return eventSort.dir === 'asc' ? -1 : 1
      if (va > vb) return eventSort.dir === 'asc' ? 1 : -1
      return 0
    })
    return rows
  }, [filteredGdprAlerts, eventSort])

  const gdprAlertTotalPages = Math.max(1, Math.ceil(sortedGdprAlerts.length / 15))
  const pagedGdprAlerts = useMemo(() => sortedGdprAlerts.slice((eventPage - 1) * 15, eventPage * 15), [sortedGdprAlerts, eventPage])

  const totalVulns = stats?.total || 0
  const totalCritical = stats?.critical || 0
  const totalHigh = stats?.high || 0
  const totalMedium = stats?.medium || 0
  const totalLow = stats?.low || 0

  if (loading) return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-xs text-[#3b4049] dark:text-[#e5e7eb]">Loading GDPR data...</motion.div>
  if (error) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-center">
      <div className="text-xs text-[#f85149] mb-3">Error: {error}</div>
      <button onClick={() => { setLoading(true); fetchAll() }} className="px-4 py-1.5 bg-[#e8681a] text-white text-[11px] font-semibold rounded-md hover:bg-[#ff7b2e] transition-colors">Retry</button>
    </motion.div>
  )

  const renderStatCards = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mb-3">
      {[
        { key: 'm-events', label: 'Total GDPR Events', val: totalVulns, icon: 'shield', iconBg: '#a371f71a', iconColor: '#a371f7' },
        { key: 'm-crit', label: 'Critical', val: totalCritical, icon: 'alert-triangle', iconBg: '#e0525218', iconColor: '#ff6b6b', valColor: '#ff6b6b' },
        { key: 'm-high', label: 'High', val: totalHigh, icon: 'alert-circle', iconBg: '#e8893a18', iconColor: '#e8893a', valColor: '#e8893a' },
        { key: 'm-med', label: 'Medium', val: totalMedium, icon: 'alert-circle', iconBg: '#d9770618', iconColor: '#d97706', valColor: '#d97706' },
        { key: 'm-low', label: 'Low', val: totalLow, icon: 'alert-circle', iconBg: '#16a34a18', iconColor: '#16a34a', valColor: '#16a34a' },
        { key: 'm-agents', label: 'Monitored Agents', val: totAgents, icon: 'monitor', iconBg: '#58a6ff1a', iconColor: '#58a6ff' }
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

  const renderSeverityDonut = () => (
    <div className={`${CARD} flex flex-col`}>
      <div className={SECTION_TITLE}>Severity Distribution</div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        {donutData.length > 0 && (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" nameKey="label"
                stroke={isDark ? '#0d1117' : '#ffffff'} strokeWidth={3}
                onClick={(data) => toggleDonut(data.label)} style={{ cursor: 'pointer' }}
                activeIndex={-1} isAnimationActive={false}
              >
                {donutData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} opacity={hiddenDonut.has(entry.label) ? 0.25 : 1} />
                ))}
              </Pie>
              <Tooltip content={<CustomTip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 justify-center mt-2 text-[10px]">
        {donutData.map((b, i) => (
          <button key={i} onClick={() => toggleDonut(b.label)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium transition-all ${
              hiddenDonut.has(b.label) ? 'opacity-40 text-[#3b4049] dark:text-[#e5e7eb]' : 'text-[#1f2937] dark:text-white hover:bg-[#f0f2f4] dark:hover:bg-[#161b22]'
            }`}
          >
            <span className="w-[7px] h-[7px] rounded-sm" style={{ backgroundColor: b.color }} />
            {b.label}
          </button>
        ))}
      </div>
    </div>
  )

  const renderTrendChart = () => (
    <div className={`${CARD} flex flex-col`}>
      <div className={SECTION_TITLE}>GDPR Events Trend</div>
      <div className="flex gap-3 mb-1.5 text-[11px]">
        {['Critical', 'High', 'Medium'].map(ser => {
          const colors = { Critical: '#dc2626', High: '#ea580c', Medium: '#d97706' }
          return (
            <button key={ser} onClick={() => toggleSeries(ser)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-medium transition-all ${
                hiddenSeries.has(ser) ? 'opacity-40 text-[#3b4049] dark:text-[#e5e7eb]' : 'text-[#1f2937] dark:text-white hover:bg-[#f0f2f4] dark:hover:bg-[#161b22]'
              }`}
            >
              <span className="w-[10px] h-[10px] rounded-sm" style={{ backgroundColor: colors[ser] }} />
              {ser}
            </button>
          )
        })}
      </div>
      <div className="flex-1 min-h-0">
        {trend.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gdprTrendCrit" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#dc2626" stopOpacity={0.12} /><stop offset="95%" stopColor="#dc2626" stopOpacity={0} /></linearGradient>
                <linearGradient id="gdprTrendHigh" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ea580c" stopOpacity={0.12} /><stop offset="95%" stopColor="#ea580c" stopOpacity={0} /></linearGradient>
                <linearGradient id="gdprTrendMed" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d97706" stopOpacity={0.12} /><stop offset="95%" stopColor="#d97706" stopOpacity={0} /></linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: isDark ? '#e5e7eb' : '#8b949e' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: isDark ? '#e5e7eb' : '#8b949e' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTip />} />
              {!hiddenSeries.has('Critical') && <Area type="monotone" dataKey="critical" stroke="#dc2626" fill="url(#gdprTrendCrit)" strokeWidth={2.5} dot={{ r: 2.5, fill: '#dc2626', stroke: isDark ? '#0d1117' : '#ffffff', strokeWidth: 2 }} name="Critical" />}
              {!hiddenSeries.has('High') && <Area type="monotone" dataKey="high" stroke="#ea580c" fill="url(#gdprTrendHigh)" strokeWidth={2.5} dot={{ r: 2.5, fill: '#ea580c', stroke: isDark ? '#0d1117' : '#ffffff', strokeWidth: 2 }} name="High" />}
              {!hiddenSeries.has('Medium') && <Area type="monotone" dataKey="medium" stroke="#d97706" fill="url(#gdprTrendMed)" strokeWidth={2.5} dot={{ r: 2.5, fill: '#d97706', stroke: isDark ? '#0d1117' : '#ffffff', strokeWidth: 2 }} name="Medium" />}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )

  const renderPlatformChart = () => (
    <div className={`${CARD} flex flex-col`}>
      <div className={SECTION_TITLE}>Agent Platform Breakdown</div>
      <div className="flex-1 min-h-0">
        {platforms.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={platforms} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1d2432" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTip />} cursor={false} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} barSize={20} cursor={false} isAnimationActive={false}>
                {platforms.map((p, i) => <Cell key={i} fill={p.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )

  const renderArticleRings = () => (
    <div className={CARD}>
      <div className={SECTION_TITLE}>Article Distribution</div>
      <div className="grid grid-cols-4 gap-3">
        {articleBands.map((b, i) => {
          const svgSize = 100
          const sw = 8
          const r = (svgSize - sw) / 2
          const circ = 2 * Math.PI * r
          const off = circ - (b.pct / 100) * circ
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <svg width={svgSize} height={svgSize} className="transform -rotate-90">
                <circle cx={svgSize / 2} cy={svgSize / 2} r={r} fill="none" stroke="#d0d7de" strokeWidth={sw} className="dark:stroke-[#1d2432]" />
                <circle cx={svgSize / 2} cy={svgSize / 2} r={r} fill="none" stroke={b.color} strokeWidth={sw} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" />
              </svg>
              <span className="text-[11px] font-semibold text-[#1f2328] dark:text-[#f0f6fc] text-center">{b.label}</span>
              <span className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb]"><AnimatedCounter val={b.count} /> events</span>
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderTopAgents = () => (
    <div className={`${CARD} flex flex-col`}>
      <div className={SECTION_TITLE}>Top Agents by GDPR Events</div>
      <div className="flex-1 min-h-0 overflow-y-auto max-h-[220px]">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] font-bold uppercase tracking-wide">
            <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">#</th>
            <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Agent</th>
            <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">OS</th>
            <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Events</th>
            <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Critical</th>
          </tr>
        </thead>
        <tbody>
          {topAgents.map((a, i) => {
            const totE = a.vulns.c + a.vulns.h + a.vulns.m + a.vulns.l
            const isSelected = selectedAgent === a.name
            return (
              <tr key={a.name} onClick={() => setSelectedAgent(prev => prev === a.name ? null : a.name)}
                className={`cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#e8681a]/10 dark:bg-[#e8681a]/10 border-l-2 border-[#e8681a]' : 'hover:bg-[#f0f2f4] dark:hover:bg-[#161b22]'
                }`}>
                <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#3b4049] dark:text-[#e5e7eb]">{i + 1}</td>
                <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{a.name}</td>
                <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#1f2937] dark:text-[#e5e7eb]">{a.os}</td>
                <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-[60px] h-[6px] bg-[#d0d7de] dark:bg-[#1d2432] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(totE / maxAgentEvents) * 100}%`, background: 'linear-gradient(90deg,#e8681a,#ff7b2e)' }} />
                    </div>
                    <span className="font-bold text-[#1f2328] dark:text-[#f0f6fc]"><AnimatedCounter val={totE} /></span>
                  </div>
                </td>
                <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#dc2626]/20 text-[#1f2328] dark:text-[#f0f6fc]"><AnimatedCounter val={a.vulns.c} /></span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
      {topAgents.length > 0 && (
      <div className="text-[#e8681a] text-[11px] font-semibold mt-2 cursor-pointer inline-flex items-center gap-1 hover:text-[#ff7b2e] flex-shrink-0"
        onClick={() => setActiveTab('agents')}>View all agents <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
      )}
    </div>
  )

  const renderTopArticles = () => (
    <div className={`${CARD} flex flex-col`}>
      <div className={SECTION_TITLE}>Top GDPR Articles</div>
      <div className="flex-1 min-h-0 overflow-y-auto max-h-[220px]">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] font-bold uppercase tracking-wide">
            <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">#</th>
            <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Article</th>
            <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Title</th>
            <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Events</th>
            <th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Critical</th>
          </tr>
        </thead>
        <tbody>
          {topArticles.map((art, i) => {
            const isSelected = selectedArticle === art.article
            return (
            <tr key={art.code} onClick={() => setSelectedArticle(prev => prev === art.article ? null : art.article)}
              className={`cursor-pointer transition-colors ${
                isSelected ? 'bg-[#e8681a]/10 dark:bg-[#e8681a]/10 border-l-2 border-[#e8681a]' : 'hover:bg-[#f0f2f4] dark:hover:bg-[#161b22]'
              }`}>
              <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#3b4049] dark:text-[#e5e7eb]">{i + 1}</td>
              <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] font-semibold text-[#e8681a]">{art.article}</td>
              <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#1f2937] dark:text-[#e5e7eb] truncate max-w-[120px]">{art.title}</td>
              <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                <div className="flex items-center gap-1.5">
                  <div className="w-[60px] h-[6px] bg-[#d0d7de] dark:bg-[#1d2432] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(art.eventCount / maxArticleEvents) * 100}%`, background: 'linear-gradient(90deg,#e8681a,#ff7b2e)' }} />
                  </div>
                  <span className="font-bold text-[#1f2328] dark:text-[#f0f6fc]"><AnimatedCounter val={art.eventCount} /></span>
                </div>
              </td>
              <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#dc2626]/20 text-[#1f2328] dark:text-[#f0f6fc]"><AnimatedCounter val={art.criticalCount} /></span>
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
      </div>
      {topArticles.length > 0 && (
      <div className="text-[#e8681a] text-[11px] font-semibold mt-2 cursor-pointer inline-flex items-center gap-1 hover:text-[#ff7b2e] flex-shrink-0"
        onClick={() => setActiveTab('events')}>View all events <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
      )}
    </div>
  )

  const renderOverview = () => (
    <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {renderFilterBar()}
      {renderStatCards()}
      <div className="grid grid-cols-[0.55fr_1.45fr] gap-2.5 mb-3 items-stretch">
        {renderSeverityDonut()}
        {renderTrendChart()}
      </div>
      <div className="grid grid-cols-3 gap-2.5 mb-3 items-stretch">
        {renderTopAgents()}
        {renderTopArticles()}
        {renderPlatformChart()}
      </div>
      {renderArticleRings()}
    </motion.div>
  )

  const renderAgentInventory = () => (
    <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {renderFilterBar()}
      <div className={`${CARD} mb-3 relative z-10`}>
        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <input type="text" placeholder="Search hostname or IP..." value={agentFilters.q}
              onChange={e => handleAgentFilter('q', e.target.value)}
              className="w-full bg-[#f0f2f4] dark:bg-[#161b22] text-[#1f2328] dark:text-[#f0f6fc] text-[11px] border border-[#d0d7de] dark:border-[#1d2432] rounded-md px-3 py-1.5 pl-8 focus:outline-none focus:border-[#e8681a]/50 transition-colors placeholder:text-[#3b4049] dark:text-[#e5e7eb]"
            />
            <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[#3b4049] dark:text-[#e5e7eb]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <FilterDropdown value={agentFilters.os} onChange={v => handleAgentFilter('os', v)}
            options={[
              { value: '', label: 'All OS' },
              { value: 'Windows', label: 'Windows' },
              { value: 'Linux', label: 'Linux' },
              { value: 'macOS', label: 'macOS' },
              { value: 'Network', label: 'Network' }
            ]}
            placeholder="All OS" />
          <span className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] ml-auto"><AnimatedCounter val={totAgents} /> agents found</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {pagedAgents.map((agent, idx) => {
          const totE = agent.vulns.c + agent.vulns.h + agent.vulns.m + agent.vulns.l
          return (
            <motion.div key={agent.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
              className={`${CARD} cursor-pointer`} onClick={() => setDetailsModalAgent(agent)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FilterWrapper field="agentName" value={agent.name} className="pr-5">
                    <span className="text-[11px] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{agent.name}</span>
                  </FilterWrapper>
                </div>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                  agent.os === 'Windows' ? 'bg-[#2563eb]/15 text-[#1f2328] dark:text-[#f0f6fc]' :
                  agent.os === 'Linux' ? 'bg-[#ea580c]/15 text-[#1f2328] dark:text-[#f0f6fc]' :
                  agent.os === 'macOS' ? 'bg-[#d97706]/15 text-[#1f2328] dark:text-[#f0f6fc]' :
                  agent.os === 'Network' ? 'bg-[#7c3aed]/15 text-[#1f2328] dark:text-[#f0f6fc]' :
                  'bg-[#16a34a]/15 text-[#1f2328] dark:text-[#f0f6fc]'
                }`}>{agent.os}</span>
              </div>
              <div className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] mb-1.5">{agent.ip}</div>
              <div className="grid grid-cols-4 gap-1 pt-2 border-t border-[#f0f2f4] dark:border-[#1d2432]">
                {SEV_ORDER.map(sev => {
                  const count = agent.vulns[sev[0]]
                  const pct = totE > 0 ? Math.round(count / totE * 100) : 0
                  return (
                  <div key={sev} onClick={e => { e.stopPropagation(); setAgentView({ name: agent.name, os: agent.os, severity: sev === 'critical' ? 'Critical' : sev === 'high' ? 'High' : sev === 'medium' ? 'Medium' : 'Low' }) }}
                    className="text-center cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] rounded transition-colors p-1">
                    <div className="text-[9px] text-[#3b4049] dark:text-[#e5e7eb] capitalize">{sev}</div>
                    <span className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc]" style={{ color: SEV_COLORS[sev] }}><AnimatedCounter val={count} /></span>
                    <div className="w-full h-1 bg-[#d0d7de] dark:bg-[#1d2432] rounded-full mt-0.5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: SEV_COLORS[sev] }} />
                    </div>
                  </div>
                  )
                })}
              </div>
            </motion.div>
          )
        })}
      </div>
      {totAgents === 0 && (
        <div className="text-center text-[#3b4049] dark:text-[#e5e7eb] py-16 text-[11px]">No agents match your filters.</div>
      )}
      {invTotalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setAgentPage(p => Math.max(1, p - 1))} disabled={agentPage === 1}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-[#d0d7de] dark:border-[#1d2432] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >Previous</button>
          <div className="flex gap-1">
            {Array.from({ length: invTotalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setAgentPage(p)}
                className={`w-7 h-7 text-[11px] font-medium rounded-md transition-colors ${
                  agentPage === p
                    ? 'bg-[#e8681a] text-white'
                    : 'text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f0f2f4] dark:hover:bg-[#161b22]'
                }`}
              >{p}</button>
            ))}
          </div>
          <button onClick={() => setAgentPage(p => Math.min(invTotalPages, p + 1))} disabled={agentPage === invTotalPages}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-[#d0d7de] dark:border-[#1d2432] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >Next</button>
        </div>
      )}
    </motion.div>
  )

  const renderEventDetailPanel = () => {
    if (!selectedEvent) return null
    const e = selectedEvent
    const severityColor = e.severity === 'Critical' ? '#dc2626' : e.severity === 'High' ? '#ea580c' : '#2563eb'
    const detailTabs = [
      { key: 'description', label: 'Description' },
      { key: 'agents', label: 'Agent Info' },
      { key: 'articles', label: 'Articles' }
    ]
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => { setSelectedEvent(null); setEventDetailTab('description') }} />
        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 z-50 h-full w-[420px] max-w-[90vw] bg-white dark:bg-[#0d1117] border-l border-[#d0d7de] dark:border-[#1d2432] shadow-2xl p-5 overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-sm font-bold text-[#e8681a]">Rule {e.ruleId}</span>
            <button onClick={() => { setSelectedEvent(null); setEventDetailTab('description') }} className="text-[#3b4049] dark:text-[#e5e7eb] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="flex gap-0.5 mb-4 border-b border-[#d0d7de] dark:border-[#1d2432]">
            {detailTabs.map(t => (
              <button key={t.key} onClick={() => setEventDetailTab(t.key)}
                className={`text-[10px] font-semibold px-3 py-1.5 rounded-t-md transition-colors ${
                  eventDetailTab === t.key
                    ? 'bg-[#f0f2f4] dark:bg-[#161b22] text-[#1f2328] dark:text-[#f0f6fc] border border-b-0 border-[#d0d7de] dark:border-[#1d2432] -mb-px'
                    : 'text-[#3b4049] dark:text-[#e5e7eb] hover:text-[#1f2328] dark:hover:text-[#f0f6fc]'
                }`}
              >{t.label}</button>
            ))}
          </div>
          {eventDetailTab === 'description' && (
            <div className="space-y-4">
              <div className="border border-[#d0d7de] dark:border-[#1d2432] rounded-lg p-4">
                <div className="text-[10px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1.5">Severity</div>
                <div className="text-xl font-bold" style={{ color: severityColor }}>{e.severity}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1.5">Description</div>
                <div className="text-[12px] text-[#1f2937] dark:text-[#e5e7eb] leading-relaxed">{e.description}</div>
              </div>
              <div className="border-t border-[#f0f2f4] dark:border-[#1d2432] pt-3">
                <div className="text-[10px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1.5">Event Details</div>
                <div className="text-[12px] text-[#1f2937] dark:text-[#e5e7eb] leading-relaxed">
                  GDPR Article {e.article} triggered by rule {e.ruleId} on agent {e.agentName}. Severity: {e.severity}.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-[#f0f2f4] dark:border-[#1d2432] pt-3">
                <div>
                  <div className="text-[9px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1">Agent</div>
                  <div className="text-[11px] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{e.agentName}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1">IP</div>
                  <div className="text-[11px] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{e.agentIP || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1">OS</div>
                  <div className="text-[11px] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{e.os}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1">Alert Time</div>
                  <div className="text-[11px] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{e.alertTime}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1">Rule ID</div>
                  <div className="text-[11px] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{e.ruleId}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1">Level</div>
                  <div className="text-[11px] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{e.ruleLevel}</div>
                </div>
              </div>
            </div>
          )}
          {eventDetailTab === 'agents' && (
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1.5">Agent Name</div>
                <div className="text-[12px] text-[#1f2937] dark:text-[#e5e7eb]">{e.agentName}</div>
              </div>
              {e.agentIP && (
                <div>
                  <div className="text-[10px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1.5">IP Address</div>
                  <div className="text-[12px] text-[#1f2937] dark:text-[#e5e7eb]">{e.agentIP}</div>
                </div>
              )}
              <div>
                <div className="text-[10px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1.5">Operating System</div>
                <div className="text-[12px] text-[#1f2937] dark:text-[#e5e7eb]">{e.os}</div>
              </div>
            </div>
          )}
          {eventDetailTab === 'articles' && (
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1.5">GDPR Articles</div>
                <div className="text-[12px] text-[#1f2937] dark:text-[#e5e7eb]">{e.article}</div>
              </div>
              {(e.gdprCodes || []).length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1.5">All GDPR Codes</div>
                  <div className="flex flex-wrap gap-1">
                    {e.gdprCodes.map((code, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-[#e8681a]/10 text-[#e8681a] text-[10px] font-medium">{code}</span>
                    ))}
                  </div>
                </div>
              )}
              {e.groups && e.groups.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide mb-1.5">Groups</div>
                  <div className="flex flex-wrap gap-1">
                    {e.groups.map((g, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-[#f0f2f4] dark:bg-[#161b22] text-[#1f2328] dark:text-[#e5e7eb] text-[10px] font-medium">{g}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </>
    )
  }

  const renderEvents = () => (
    <motion.div key="events" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {renderFilterBar()}
      <div className={`${CARD} mb-3`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[180px]">
            <input type="text" placeholder="Search by agent, rule, article, IP..." value={eventFilters.q}
              onChange={e => handleEventFilter('q', e.target.value)}
              className="w-full bg-[#f0f2f4] dark:bg-[#161b22] text-[#1f2328] dark:text-[#f0f6fc] text-[11px] border border-[#d0d7de] dark:border-[#1d2432] rounded-md px-3 py-1.5 pl-8 focus:outline-none focus:border-[#e8681a]/50 transition-colors placeholder:text-[#3b4049] dark:text-[#e5e7eb]"
            />
            <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[#3b4049] dark:text-[#e5e7eb]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <FilterDropdown value={eventFilters.severity} onChange={v => handleEventFilter('severity', v)}
            options={[
              { value: '', label: 'All Severities' },
              { value: 'Critical', label: 'Critical' },
              { value: 'High', label: 'High' },
              { value: 'Medium', label: 'Medium' },
              { value: 'Low', label: 'Low' }
            ]}
            placeholder="All Severities" />
          <FilterDropdown value={eventFilters.article} onChange={v => handleEventFilter('article', v)}
            options={[
              { value: '', label: 'All Articles' },
              ...articles.slice(0, 20).map(a => ({ value: a.article, label: a.article }))
            ]}
            placeholder="All Articles" />
          <span className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] ml-auto"><AnimatedCounter val={sortedGdprAlerts.length} /> events</span>
        </div>
      </div>
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] font-bold uppercase tracking-wide">
              {[
                { key: 'alertTime', label: 'Alert Time', sortable: true },
                { key: 'agentName', label: 'Agent', sortable: true },
                { key: 'ruleId', label: 'Rule', sortable: true },
                { key: 'severity', label: 'Severity', sortable: true },
                { key: 'article', label: 'Article', sortable: true },
                { key: 'description', label: 'Description', sortable: false }
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
            {pagedGdprAlerts.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-[11px] text-[#3b4049] dark:text-[#e5e7eb]">No events match your filters.</td></tr>
            )}
            {pagedGdprAlerts.map((v, i) => (
              <tr key={v.id || i} onClick={() => setSelectedEvent(v)}
                className="cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors"
              >
                <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#1f2328] dark:text-[#f0f6fc] whitespace-nowrap">{v.alertTime}</td>
                <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{v.agentName}</td>
                <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#e8681a] font-bold">{v.ruleId}</td>
                <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432]">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                    v.severity === 'Critical' ? 'bg-[#dc2626]/20 text-[#1f2328] dark:text-[#f0f6fc]' :
                    v.severity === 'High' ? 'bg-[#ea580c]/20 text-[#1f2328] dark:text-[#f0f6fc]' :
                    v.severity === 'Medium' ? 'bg-[#d97706]/20 text-[#1f2328] dark:text-[#f0f6fc]' :
                    'bg-[#16a34a]/20 text-[#1f2328] dark:text-[#f0f6fc]'
                  }`}>{v.severity}</span>
                </td>
                <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#e8681a] font-medium">{v.article}</td>
                <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#1f2937] dark:text-[#e5e7eb] overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">{v.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {gdprAlertTotalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <button onClick={() => setEventPage(p => Math.max(1, p - 1))} disabled={eventPage === 1}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-[#d0d7de] dark:border-[#1d2432] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >Previous</button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(gdprAlertTotalPages, 7) }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setEventPage(p)}
                className={`w-7 h-7 text-[11px] font-medium rounded-md transition-colors ${
                  eventPage === p
                    ? 'bg-[#e8681a] text-white'
                    : 'text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f0f2f4] dark:hover:bg-[#161b22]'
                }`}
              >{p}</button>
            ))}
          </div>
          <button onClick={() => setEventPage(p => Math.min(gdprAlertTotalPages, p + 1))} disabled={eventPage === gdprAlertTotalPages}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-[#d0d7de] dark:border-[#1d2432] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >Next</button>
        </div>
      )}
      {renderEventDetailPanel()}
    </motion.div>
  )

  const renderControls = () => (
    <motion.div key="controls" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {renderFilterBar()}
      <div className="grid grid-cols-3 gap-2.5 mb-3">
        <div className={CARD}>
          <div className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide font-semibold mb-1">Total Agents</div>
          <div className="text-2xl font-bold text-[#1f2328] dark:text-[#f0f6fc]"><AnimatedCounter val={controlStats?.totalAssets || 0} /></div>
        </div>
        <div className={CARD}>
          <div className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide font-semibold mb-1">Fully Compliant</div>
          <div className="text-2xl font-bold text-[#3fb950]"><AnimatedCounter val={controlStats?.fullyCompliant || 0} /></div>
        </div>
        <div className={CARD}>
          <div className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] uppercase tracking-wide font-semibold mb-1">Non-Compliant</div>
          <div className="text-2xl font-bold text-[#f85149]"><AnimatedCounter val={controlStats?.nonCompliant || 0} /></div>
        </div>
      </div>
      <div className={CARD}>
        <div className={SECTION_TITLE}>Article Compliance Status</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb] font-bold uppercase tracking-wide">
                <th className="text-left py-2 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Article</th>
                <th className="text-left py-2 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Title</th>
                <th className="text-right py-2 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Events</th>
                <th className="text-right py-2 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Critical</th>
                <th className="text-right py-2 px-2 border-b border-[#d0d7de] dark:border-[#1d2432]">Agents</th>
              </tr>
            </thead>
            <tbody>
              {articles.slice(0, 20).map((art, i) => (
                <tr key={art.code} className="hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] font-semibold text-[#e8681a]">{art.article}</td>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-[#1f2937] dark:text-[#e5e7eb]">{art.title}</td>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-right font-bold text-[#1f2328] dark:text-[#f0f6fc]">{art.eventCount}</td>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-right">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#dc2626]/20 text-[#1f2328] dark:text-[#f0f6fc]">{art.criticalCount}</span>
                  </td>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#1d2432] text-right text-[#1f2328] dark:text-[#f0f6fc]">{art.agents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="p-2 sm:p-3 max-w-[1600px] mx-auto">
      <div className="flex justify-end mb-3">
        <DateRangePicker
          startDate={gdprStartDate}
          onStartChange={(v) => { startRef.current = v; setGdprStartDate(v) }}
          endDate={gdprEndDate}
          onEndChange={(v) => { endRef.current = v; setGdprEndDate(v) }}
          onSearch={() => { setLoading(true); fetchAll(startRef.current, endRef.current) }}
        />
      </div>

      {/* Inner Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
        <div className="flex gap-0.5 bg-[#f0f2f4] dark:bg-[#161b22] rounded-lg p-0.5 overflow-x-auto">
          {INNER_TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-[#0d1117] text-[#1f2328] dark:text-[#f0f6fc] shadow-sm border border-[#d0d7de] dark:border-[#1d2432]'
                  : 'text-[#3b4049] dark:text-[#e5e7eb] hover:text-[#1f2328] dark:hover:text-[#f0f6fc]'
              }`}
            >
              <TabIcon icon={tab.icon} className={activeTab === tab.key ? 'text-[#e8681a]' : ''} />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'events' && (
            <span className="text-[10px] text-[#3b4049] dark:text-[#e5e7eb]"><AnimatedCounter val={sortedGdprAlerts.length} /> events</span>
          )}
          <button onClick={handleGenerateReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md bg-[#e8681a] text-white hover:bg-[#ff7b2e] transition-colors shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Export PDF
          </button>
        </div>
      </div>

      {/* Active Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'agents' && renderAgentInventory()}
      {activeTab === 'events' && renderEvents()}
      {activeTab === 'controls' && renderControls()}
    </motion.div>
  )
}
