import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { formatPretty } from '../utils'
import DateRangePicker from '../components/DateRangePicker'
import AssetSidebar from '../components/AssetSidebar'
import LogDetailModal from '../components/LogDetailModal'
import useCompliance from '../hooks/useCompliance'
import { exportExcel, exportPDFReport, prepareRows } from '../utils/exportLogs'
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import { parseDateStr } from '../utils'

const FRAMEWORKS = ['PCI-DSS', 'HIPAA', 'GDPR', 'TSC (SOC 2)', 'NIST 800-53', 'MITRE ATT&CK']
const SEV_COLORS = { Critical: '#f85149', High: '#e8681a', Medium: '#d29922', Low: '#3fb950' }
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low']
const QUICK_TIMES = [
  { label: '24h', value: 'now-24h' },
  { label: '7d', value: 'now-7d' },
  { label: '30d', value: 'now-30d' },
  { label: '90d', value: 'now-90d' }
]

const COMPLIANCE_EXPORT_COLS = [
  { header: 'Time', accessor: r => r['@timestamp'] || r.timestamp || '--' },
  { header: 'Agent', accessor: r => r.agent?.name || r.agent || '--' },
  { header: 'Rule', accessor: r => r.rule?.id || r.rule || '--' },
  { header: 'Level', accessor: r => r.rule?.level || r.level || 0 },
  { header: 'Severity', accessor: r => { const lv = parseInt(r.rule?.level || r.level || 0); return lv >= 12 ? 'Critical' : lv >= 7 ? 'High' : lv >= 4 ? 'Medium' : 'Low' } },
  { header: 'Description', accessor: r => r.rule?.description || r.description || '--' },
  { header: 'Event', accessor: r => r.rule?.groups?.[0] || r.event_type || '--' },
  { header: 'Frameworks', accessor: r => (r._frameworks || []).join(', ') || '--' },
  { header: 'Control', accessor: r => r.rule?.gdpr || r.rule?.tsc || r.rule?.hipaa || r.rule?.pci_dss || r.rule?.nist_800_53 || r.control || '--' },
  { header: 'File', accessor: r => r.data?.file || r.file || '--' },
]

const FRAMEWORK_TO_FIELD = {
  'PCI-DSS': 'rule.pci_dss',
  'HIPAA': 'rule.hipaa',
  'GDPR': 'rule.gdpr',
  'TSC (SOC 2)': 'rule.tsc',
  'NIST 800-53': 'rule.nist_800_53',
  'MITRE ATT&CK': 'rule.mitre_attack'
}

function buildFilterQuery(filters) {
  const parts = []
  if (filters.framework && FRAMEWORK_TO_FIELD[filters.framework]) {
    parts.push('_exists_:' + FRAMEWORK_TO_FIELD[filters.framework])
  }
  if (filters.severity) {
    const sevRanges = { Critical: 'rule.level:>=12', High: '(rule.level:[7 TO 11])', Medium: '(rule.level:[4 TO 6])', Low: '(rule.level:[1 TO 3])' }
    if (sevRanges[filters.severity]) parts.push(sevRanges[filters.severity])
  }
  if (filters.agent) {
    parts.push('agent.name:"' + filters.agent.replace(/"/g, '\\"') + '"')
  }
  if (filters.rule) {
    parts.push('rule.id:"' + filters.rule.replace(/"/g, '\\"') + '"')
  }
  return parts.join(' AND ')
}

const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg px-3 py-2 text-xs shadow-xl">
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

function groupSev(buckets) {
  const map = {}
  for (const b of buckets) {
    const s = toSev(b.key)
    map[s] = (map[s] || 0) + b.doc_count
  }
  return map
}

export default function ComplianceTab() {
  const { isDark, startDate, endDate } = useApp()
  const [modal, setModal] = useState(null)
  const [assetSidebarOpen, setAssetSidebarOpen] = useState(false)
  const [filters, setFilters] = useState({})
  const [timeRange, setTimeRange] = useState('now-7d')
  const [expandedRow, setExpandedRow] = useState({})
  const [jsonView, setJsonView] = useState({})
  const containerRef = useRef(null)
  const [logPage, setLogPage] = useState(1)
  const LOG_PAGE_SIZE = 50
  const MAX_LOG_PAGES = 10
  const { data, loading, error, refresh } = useCompliance()
  const [evExtraLogs, setEvExtraLogs] = useState([])
  const evExtraOffsetRef = useRef(0)
  const [evLoadingMore, setEvLoadingMore] = useState(false)
  const evFilterQuery = buildFilterQuery(filters)
  const evFilterOffsetRef = useRef(0)

  const handleRefresh = useCallback(() => {
    setFilters({})
    setLogPage(1)
    setExpandedRow({})
    setJsonView({})
    setEvExtraLogs([])
    evExtraOffsetRef.current = 0
    evFilterOffsetRef.current = 0
    refresh()
  }, [refresh])

  const fetchFilteredLogs = useCallback(async (append) => {
    if (!evFilterQuery) return
    setEvLoadingMore(true)
    try {
      const sd = parseDateStr(startDate).toISOString()
      const ed = parseDateStr(endDate).toISOString()
      const offset = append ? evFilterOffsetRef.current : 0
      const res = await api('search', { index: 'unishield360-alerts-4.x-*', start_date: sd, end_date: ed, q: evFilterQuery, limit: 500, offset, sort: '@timestamp', order: 'desc' })
      const results = res.results || []
      if (append) {
        setEvExtraLogs(prev => [...prev, ...results])
      } else {
        setEvExtraLogs(results)
      }
      evFilterOffsetRef.current = append ? evFilterOffsetRef.current + results.length : results.length
    } catch (e) {
      console.error('fetchFilteredLogs error:', e)
      if (!append) setEvExtraLogs([])
    } finally {
      setEvLoadingMore(false)
    }
  }, [startDate, endDate, evFilterQuery])

  const loadMoreLogs = useCallback(async () => {
    if (evFilterQuery) {
      return fetchFilteredLogs(true)
    }
    setEvLoadingMore(true)
    try {
      const sd = parseDateStr(startDate).toISOString()
      const ed = parseDateStr(endDate).toISOString()
      const q = ''
      const res = await api('search', { index: 'unishield360-alerts-4.x-*', start_date: sd, end_date: ed, q, limit: 500, offset: evExtraOffsetRef.current, sort: '@timestamp', order: 'desc' })
      const results = res.results || []
      setEvExtraLogs(prev => [...prev, ...results])
      evExtraOffsetRef.current += results.length
    } catch (e) {
      console.error('loadMoreLogs error:', e)
    } finally {
      setEvLoadingMore(false)
    }
  }, [startDate, endDate, evFilterQuery, fetchFilteredLogs])

  useEffect(() => {
    if (evFilterQuery) {
      setEvExtraLogs([])
      evFilterOffsetRef.current = 0
      fetchFilteredLogs(false)
    } else {
      setEvExtraLogs([])
      evExtraOffsetRef.current = 0
    }
  }, [evFilterQuery, fetchFilteredLogs])
  const toggleRow = useCallback((id) => {
    setExpandedRow(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])
  const flattenDoc = useCallback((obj, prefix) => {
    prefix = prefix || ''
    if (obj === null || obj === undefined) return [{ path: prefix || 'value', value: null }]
    if (typeof obj !== 'object') return [{ path: prefix || 'value', value: obj }]
    if (Array.isArray(obj)) {
      if (!obj.length) return [{ path: prefix || 'value', value: '' }]
      if (obj.every(v => v === null || v === undefined || typeof v !== 'object'))
        return [{ path: prefix || 'value', value: obj.join(', ') }]
      return [{ path: prefix || 'value', value: JSON.stringify(obj) }]
    }
    let result = []
    for (const k of Object.keys(obj)) {
      if (k.startsWith('_') && k !== '_frameworks') continue
      const p = prefix ? prefix + '.' + k : k
      result = result.concat(flattenDoc(obj[k], p))
    }
    return result
  }, [])

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

  const filteredRecent = useMemo(() => {
    const all = [...(data?.recent || []), ...evExtraLogs]
    return all.filter(r => {
      const level = parseInt(r.rule?.level || r.level || 0)
      const sev = toSev(level)
      if (filters.severity && sev !== filters.severity) return false
      if (filters.agent) {
        const agentName = r.agent?.name || r.agent || ''
        if (agentName !== filters.agent) return false
      }
      if (filters.rule) {
        const ruleId = r.rule?.id || r.rule || ''
        if (ruleId !== filters.rule) return false
      }
      if (filters.framework) {
        const fws = r._frameworks || []
        if (fws.includes(filters.framework)) return true
        const field = FRAMEWORK_TO_FIELD[filters.framework]
        if (field) {
          const parts = field.split('.')
          let val = r
          for (const p of parts) { if (val) val = val[p] }
          if (val && val.toString().trim()) return true
        }
        return false
      }
      return true
    })
  }, [data?.recent, evExtraLogs, filters])

  const totalLogPages = Math.max(1, Math.ceil(filteredRecent.length / LOG_PAGE_SIZE))

  const hasActiveFilter = activeFilters.length > 0

  const chartData = useMemo(() => {
    if (!hasActiveFilter) return null
    const sev = {}
    SEV_ORDER.forEach(s => sev[s] = 0)
    const ctrlMap = {}
    const agMap = {}
    const ruleMap = {}
    const fwMap = {}
    for (const r of filteredRecent) {
      const level = parseInt(r.rule?.level || r.level || 0)
      const s = level >= 12 ? 'Critical' : level >= 7 ? 'High' : level >= 4 ? 'Medium' : 'Low'
      sev[s] = (sev[s] || 0) + 1
      const agentName = r.agent?.name || r.agent || ''
      if (agentName) agMap[agentName] = (agMap[agentName] || 0) + 1
      const ruleId = r.rule?.id || r.rule || ''
      if (ruleId) ruleMap[ruleId] = (ruleMap[ruleId] || 0) + 1
      const ctrl = r.rule?.gdpr || r.rule?.tsc || r.rule?.hipaa || r.rule?.pci_dss || r.rule?.nist_800_53 || r.control || ''
      if (ctrl) ctrlMap[ctrl] = (ctrlMap[ctrl] || 0) + 1
      const frameworks = r._frameworks || []
      if (frameworks.length === 0) {
        for (const [fwName, fwField] of Object.entries(FRAMEWORK_TO_FIELD)) {
          const parts = fwField.split('.')
          let val = r
          for (const p of parts) { if (val) val = val[p] }
          if (val && val.toString().trim()) frameworks.push(fwName)
        }
      }
      for (const fw of frameworks) fwMap[fw] = (fwMap[fw] || 0) + 1
    }
    return {
      severity: sev,
      controls: ctrlMap,
      topAgents: Object.entries(agMap).map(([key, doc_count]) => ({ key, doc_count })).sort((a, b) => b.doc_count - a.doc_count).slice(0, 8),
      topRules: Object.entries(ruleMap).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 8),
      frameworkCounts: Object.entries(fwMap).map(([framework, count]) => ({ framework, count })).sort((a, b) => b.count - a.count)
    }
  }, [filteredRecent, hasActiveFilter])
  const totalEvents = hasActiveFilter && chartData
    ? Object.values(chartData.severity).reduce((a, b) => a + b, 0)
    : data ? Object.values(data.severity).reduce((a, b) => a + b, 0) : 0
  const fwCounts = hasActiveFilter && chartData ? chartData.frameworkCounts : data?.frameworkCounts || []
  const maxFw = fwCounts.length > 0 ? Math.max(...fwCounts.map(f => f.count), 1) : 1
  const agentsData = hasActiveFilter && chartData ? chartData.topAgents : data?.topAgents || []
  const maxAgent = agentsData.length > 0 ? Math.max(...agentsData.map(a => a.doc_count || 0), 1) : 1
  const sevData = hasActiveFilter && chartData ? chartData.severity : data?.severity || {}
  const sevDonut = SEV_ORDER.filter(s => (sevData[s] || 0) > 0).map(s => ({
    name: s, value: sevData[s], color: SEV_COLORS[s]
  }))

  const FILTER_STYLES = {
    severity: (v) => ({
      bg: v === 'Critical' ? '#e0525218' : v === 'High' ? '#e8893a18' : v === 'Medium' ? '#d2992218' : '#3fb95018',
      color: v === 'Critical' ? '#ff6b6b' : v === 'High' ? '#e8893a' : v === 'Medium' ? '#d29922' : '#3fb950'
    }),
    framework: () => ({ bg: '#a371f71a', color: '#a371f7' }),
    agent: () => ({ bg: '#58a6ff1a', color: '#58a6ff' }),
    rule: () => ({ bg: '#e8681a18', color: '#e8681a' })
  }
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

  const modalContent = () => {
    if (!modal) return null
    const mKey = modal
    const md = {
      'm-events': { t: 'Compliance Events', b: `Total compliance events across all frameworks: ${totalEvents.toLocaleString()}. Top framework: ${data?.frameworkCounts?.[0]?.framework || 'N/A'} with ${data?.frameworkCounts?.[0]?.count || 0} events.` },
      'm-crit': { t: 'Critical Violations', b: `Critical violations: ${data?.severity?.Critical || 0}. These require immediate remediation.` },
      'm-high': { t: 'High Severity Violations', b: `High severity violations: ${data?.severity?.High || 0}.` },
      'm-med': { t: 'Medium Severity Violations', b: `Medium severity violations: ${data?.severity?.Medium || 0}.` },
      'm-assets': { t: 'Monitored Assets', b: `${data?.topAgents?.length || 0} active agents generating compliance events.` },
      'm-frameworks': { t: 'Active Frameworks', b: `${FRAMEWORKS.length} active frameworks: ${FRAMEWORKS.join(', ')}` }
    }
    const d = md[mKey]
    if (!d) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={closeModal}>
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-5 w-[500px] max-h-[72vh] overflow-y-auto shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)]" onClick={e => e.stopPropagation()}>
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
    <motion.div ref={containerRef} data-export-container initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="p-3">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[11px] text-[#8b949e]">Home / <span className="text-[#e8681a]">Compliance Management / Frameworks</span></div>
          <div className="text-xl font-bold text-[#1f2328] dark:text-[#f0f6fc] tracking-tight">Compliance Overview</div>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="-mr-1.5"><DateRangePicker /></div>
          <button onClick={handleRefresh} className="p-1.5 rounded border border-transparent hover:bg-[#161b22] text-[#8b949e] hover:text-[#e8681a] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-6 gap-2.5 mb-3">
        {[
          { key: 'm-events', label: 'Compliance Events', val: totalEvents.toLocaleString(), sub: `24h: ${(data?.count24 || 0).toLocaleString()} · 7d: ${(data?.count7d || 0).toLocaleString()}`, icon: 'certificate', iconBg: '#a371f71a', iconColor: '#a371f7' },
          { key: 'm-crit', label: 'Critical Violations', val: (data?.severity?.Critical || 0).toLocaleString(), icon: 'alert-triangle', iconBg: '#e0525218', iconColor: '#ff6b6b', valColor: '#ff6b6b' },
          { key: 'm-high', label: 'High Severity Violations', val: (data?.severity?.High || 0).toLocaleString(), icon: 'alert-circle', iconBg: '#e8893a18', iconColor: '#e8893a', valColor: '#e8893a' },
          { key: 'm-med', label: 'Medium Severity Violations', val: (data?.severity?.Medium || 0).toLocaleString(), icon: 'alert-circle', iconBg: '#d2992218', iconColor: '#d29922', valColor: '#d29922' },
          { key: 'm-assets', label: 'Monitored Assets', val: data?.topAgents?.length || 0, sub: 'Active agents', icon: 'device-desktop', iconBg: '#58a6ff1a', iconColor: '#58a6ff' },
          { key: 'm-frameworks', label: 'Active Frameworks', val: FRAMEWORKS.length, sub: FRAMEWORKS.join(', '), icon: 'layout-grid', iconBg: '#7c3aed1a', iconColor: '#7c3aed' },
        ].map(card => (
          <div key={card.key} onClick={() => openModal(card.key)}
              className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 cursor-pointer hover:border-[#e8681a]/50 dark:hover:border-[#e8681a]/60 transition-all duration-300 hover:-translate-y-[3px] shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)]"
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
            {card.sub && <div className="text-[10px] text-[#8b949e] mt-0.5">{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* Tri Row */}
      <div className="grid grid-cols-[1.1fr_0.85fr_1.05fr] gap-2.5 mb-2.5">
        {/* Framework Event Distribution */}
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Framework Event Distribution</div>
          {fwCounts.map(fw => (
            <div key={fw.framework} onClick={() => setFilter('framework', fw.framework)}
              className={`flex items-center gap-2 mb-1.5 py-1 px-1 rounded hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] cursor-pointer text-[11px] ${filters.framework === fw.framework ? 'bg-[#a371f7]/5 ring-1 ring-inset ring-[#a371f7]/30' : ''}`}>
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
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 flex flex-col shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2">Severity Distribution</div>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {SEV_ORDER.filter(s => (sevData[s] || 0) > 0).map(s => (
              <span key={s} onClick={() => setFilter('severity', s)}
                className={`flex items-center gap-1.5 text-[11px] cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] ${filters.severity === s ? 'ring-1 ring-[#e8681a]/30 bg-[#e8681a]/5' : ''} ${filters.severity && filters.severity !== s ? 'opacity-40' : ''}`}>
                <span className="w-[10px] h-[10px] rounded flex-shrink-0" style={{ background: SEV_COLORS[s] }} />
                {s} <span className="text-[#8b949e]">{sevData[s] || 0} ({Math.round(((sevData[s] || 0) / (totalEvents || 1)) * 100)}%)</span>
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
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2 flex items-center justify-between">
            <span>Compliance Trend</span>
            <span onClick={() => setTimeRange(t => t === 'now-24h' ? 'now-7d' : t === 'now-7d' ? 'now-30d' : t === 'now-30d' ? 'now-90d' : 'now-24h')} className="text-[10px] text-[#8b949e] bg-[#f0f2f4] dark:bg-[#2d3140] px-2 py-0.5 rounded font-medium normal-case cursor-pointer hover:bg-[#e5e7eb] dark:hover:bg-[#2d3140]">
              {timeRange === 'now-24h' ? 'Last 24 Hours' : timeRange === 'now-7d' ? 'Last 7 Days' : timeRange === 'now-30d' ? 'Last 30 Days' : 'Last 90 Days'} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline ml-0.5"><polyline points="6 9 12 15 18 9"/></svg>
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
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Violated Controls</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">#</th><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Framework</th><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Control</th><th className="text-right py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Events</th></tr></thead>
            <tbody>
              {(hasActiveFilter && chartData ? chartData.topRules : data?.topRules || []).slice(0, 5).map((r, i) => {
                const ruleId = r.ruleId || r.key || r.rule || r.id || ''
                return (
                  <tr key={r.key || i} onClick={() => setFilter('rule', ruleId)}
                    className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors ${filters.rule === ruleId ? 'bg-[#e8681a]/5 ring-1 ring-inset ring-[#e8681a]/30' : ''}`}>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] text-[#8b949e]">{i + 1}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] text-[#e8681a] font-semibold">{ruleId}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9]">{r.control || r.description?.substring(0, 30) || 'Control violation'}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] text-right font-bold text-[#1f2328] dark:text-[#f0f6fc]">{r.doc_count || r.count || 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="text-[#e8681a] text-[11px] font-semibold mt-2 cursor-pointer inline-flex items-center gap-1 hover:text-[#ff7b2e]"
            onClick={() => openModal('all-controls')}>View all controls <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
        </div>

        {/* Top Agents */}
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Agents</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">#</th><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Agent</th><th className="text-right py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Events</th></tr></thead>
            <tbody>
              {agentsData.slice(0, 5).map((a, i) => {
                const agentName = a.key || a.agent || 'Unknown'
                return (
                  <tr key={a.key || i} onClick={() => setFilter('agent', agentName)}
                    className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors ${filters.agent === agentName ? 'bg-[#58a6ff]/5 ring-1 ring-inset ring-[#58a6ff]/30' : ''}`}>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] text-[#8b949e]">{i + 1}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{agentName}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140]">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-[70px] h-[6px] bg-[#d0d7de] dark:bg-[#1d2432] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${((a.doc_count || 0) / maxAgent) * 100}%`, background: 'linear-gradient(90deg,#e8681a,#ff7b2e)' }} />
                        </div>
                        <span className="font-bold text-[#1f2328] dark:text-[#f0f6fc]">{a.doc_count || 0}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="text-[#e8681a] text-[11px] font-semibold mt-2 cursor-pointer inline-flex items-center gap-1 hover:text-[#ff7b2e]"
            onClick={() => openModal('all-agents')}>View all agents <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
        </div>

        {/* Event Categories */}
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Event Categories</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">#</th><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Category</th><th className="text-right py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Events</th></tr></thead>
            <tbody>
              {(data?.categories || []).slice(0, 7).map((c, i) => (
                <tr key={c.key || i} className="hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] text-[#8b949e]">{i + 1}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9]">{c.key || '--'}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] text-right font-bold text-[#1f2328] dark:text-[#f0f6fc]">{(c.doc_count || 0).toLocaleString()}</td>
                </tr>
              ))}
              {(!data?.categories || data.categories.length === 0) && (
                <tr><td colSpan={3} className="text-center py-4 text-xs text-[#8b949e]">No categories data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Heatmap */}
      <div className="mb-3">
        <div className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc] mb-2.5 tracking-tight">Framework Event Distribution</div>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide bg-[#f0f2f4] dark:bg-[#16181f]">
              <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Framework</th>
              <th className="text-center py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Events</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Distribution</th>
            </tr>
          </thead>
          <tbody>
            {fwCounts.map(fw => {
              const pct = maxFw ? (fw.count / maxFw) * 100 : 0
              return (
                <tr key={fw.framework} onClick={() => setFilter('framework', fw.framework)}
                  className={`hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] cursor-pointer transition-colors ${filters.framework === fw.framework ? 'bg-[#a371f7]/5 ring-1 ring-inset ring-[#a371f7]/30' : ''}`}>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{fw.framework}</td>
                  <td className="text-center py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] font-bold text-[#1f2328] dark:text-[#f0f6fc]">{fw.count}</td>
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140]">
                    <div className="h-2 bg-[#d0d7de] dark:bg-[#1d2432] rounded-full overflow-hidden w-32">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#e8681a,#ff7b2e)' }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold text-[#1f2328] dark:text-[#f0f6fc] bg-[#f0f2f4] dark:bg-[#16181f]">
              <td className="py-1.5 px-2 border-t border-[#e5e7eb] dark:border-[#2d3140]">Total</td>
              <td className="text-center py-1.5 px-2 border-t border-[#e5e7eb] dark:border-[#2d3140]">
                {fwCounts.reduce((sum, fw) => sum + fw.count, 0) || 0}
              </td>
              <td className="py-1.5 px-2 border-t border-[#e5e7eb] dark:border-[#2d3140]"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Compliance Logs */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc] tracking-tight">Compliance Logs</div>
          <div className="flex items-center gap-1.5">
            <button data-ignore-export onClick={() => { const ts = new Date().toISOString().slice(0,10); exportExcel(filteredRecent, COMPLIANCE_EXPORT_COLS, `compliance-logs-${ts}.xlsx`) }}
              className="text-[10px] px-2 py-1 rounded font-medium bg-[#e8eaed] dark:bg-[#2d3140] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-all flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Excel
            </button>
            <button data-ignore-export onClick={() => { const ts = new Date().toISOString().slice(0,10); exportPDFReport({ filename: `compliance-report-${ts}.pdf`, title: 'Compliance Report', dateRange: `${startDate || 'now-24h'} to ${endDate || 'now'}`, metrics: [{ label: 'Events (24h)', value: (data?.count24 || 0).toLocaleString() }, { label: 'Events (7d)', value: (data?.count7d || 0).toLocaleString() }, { label: 'Alert Sources', value: data?.topAgents?.length || 0 }, { label: 'Total Logs', value: filteredRecent.length }], severity: Object.entries(data?.severity || {}).map(([level, count]) => ({ level, count })), topRules: (data?.topRules || []).map(r => ({ key: r.key || r.ruleId || r.id || '--', count: r.doc_count || r.count || 0 })), topAgents: (data?.topAgents || []).map(a => ({ key: a.key || a.agent || a.name || '--', count: a.doc_count || a.events || 0 })), frameworkCounts: (data?.frameworkCounts || []).map(f => ({ framework: f.framework || f.key || '--', count: f.count || f.doc_count || 0 })), timeline: (data?.timeline || []).map(t => ({ time: t.time, count: t.count })), logHeaders: COMPLIANCE_EXPORT_COLS.map(c => c.header.toLowerCase()), logRows: prepareRows(filteredRecent, COMPLIANCE_EXPORT_COLS) }) }}
              className="text-[10px] px-2 py-1 rounded font-medium bg-[#e8eaed] dark:bg-[#2d3140] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-all flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <colgroup>
              <col style={{ minWidth: '120px', width: '16%' }} /><col style={{ minWidth: '90px', width: '12%' }} /><col style={{ minWidth: '45px', width: '6%' }} />
              <col style={{ minWidth: '32px', width: '4%' }} /><col style={{ minWidth: '120px', width: '22%' }} /><col style={{ minWidth: '75px', width: '10%' }} />
              <col style={{ minWidth: '100px', width: '12%' }} /><col style={{ minWidth: '85px', width: '10%' }} /><col style={{ minWidth: '70px', width: '8%' }} />
            </colgroup>
            <thead>
              <tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide bg-[#f0f2f4] dark:bg-[#16181f]">
                <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Time</th>
                <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Agent</th>
                <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Rule</th>
                <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Lvl</th>
                <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Description</th>
                <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Event</th>
                <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Frameworks</th>
                <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Control</th>
                <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">File</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecent.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE).map((r, i) => {
                const rowId = r._id || String(i)
                const isExp = expandedRow[rowId]
                const level = parseInt(r.rule?.level || r.level || 0)
                const agentName = r.agent?.name || r.agent || '--'
                const ruleId = r.rule?.id || r.rule || '--'
                return (
                  <React.Fragment key={rowId}>
                    <tr onClick={() => toggleRow(rowId)}
                      className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors ${isExp ? 'bg-[#f6f8fa] dark:bg-[#16181f]' : ''}`}>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] text-[#8b949e] overflow-hidden text-ellipsis whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[10px] w-3 shrink-0">{isExp ? '▾' : '▸'}</span>
                          <span className="truncate">{(r['@timestamp'] || r.timestamp) ? new Date(r['@timestamp'] || r.timestamp).toLocaleString() : '--'}</span>
                        </span>
                      </td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] overflow-hidden text-ellipsis whitespace-nowrap">
                        <button onClick={(e) => { e.stopPropagation(); setFilter('agent', agentName) }}
                          className={`font-semibold text-left hover:underline truncate max-w-full ${filters.agent === agentName ? 'text-[#58a6ff]' : 'text-[#1f2328] dark:text-[#f0f6fc]'}`}>
                          {agentName}
                        </button>
                      </td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] overflow-hidden text-ellipsis whitespace-nowrap">
                        <button onClick={(e) => { e.stopPropagation(); setFilter('rule', ruleId) }}
                          className={`font-bold text-left hover:underline truncate max-w-full ${filters.rule === ruleId ? 'text-[#e8681a] underline' : 'text-[#e8681a]'}`}>
                          {ruleId}
                        </button>
                      </td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140]">{
                        (() => { const lv = parseInt(r.rule?.level || r.level || 0); return <span className="inline-flex items-center justify-center w-[22px] h-[18px] rounded text-[10px] font-semibold" style={{ background: lv >= 7 ? '#450a0a' : lv >= 4 ? '#3d1a00' : '#0d1117', color: lv >= 7 ? '#fca5a5' : lv >= 4 ? '#fdba74' : '#8b949e' }}>{lv}</span> })()
                      }</td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] overflow-hidden text-ellipsis whitespace-nowrap text-[#36454f] dark:text-[#c9d1d9] max-w-0">
                        {r.rule?.description || r.description || '--'}
                      </td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] overflow-hidden text-ellipsis whitespace-nowrap text-[#e8681a] font-medium">
                        {r.rule?.groups?.[0] || r.event_type || '--'}
                      </td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] overflow-hidden text-ellipsis whitespace-nowrap text-[#8b949e] font-medium">{(r._frameworks || []).join(', ') || '--'}</td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] overflow-hidden text-ellipsis whitespace-nowrap text-[#8b949e]">{r.rule?.gdpr || r.rule?.tsc || r.rule?.hipaa || r.rule?.pci_dss || r.rule?.nist_800_53 || r.control || '--'}</td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] overflow-hidden text-ellipsis whitespace-nowrap text-[#8b949e]">{r.data?.file || r.file || '--'}</td>
                    </tr>
                    {isExp && (
                      <tr>
                        <td colSpan={9} className="p-0 border-b border-[#f0f2f4] dark:border-[#2d3140]">
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ duration: 0.15 }}>
                            <div className="bg-[#f6f8fa] dark:bg-[#16181f] border-t border-[#e5e7eb] dark:border-[#2d3140]">
                              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                                <div className="flex items-center gap-2">
                                  <button onClick={(e) => { e.stopPropagation(); setJsonView(prev => ({ ...prev, [rowId]: false })) }}
                                    className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${!jsonView[rowId] ? 'bg-[#e8681a] text-white' : 'text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]'}`}>Table</button>
                                  <button onClick={(e) => { e.stopPropagation(); setJsonView(prev => ({ ...prev, [rowId]: true })) }}
                                    className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${jsonView[rowId] ? 'bg-[#e8681a] text-white' : 'text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]'}`}>JSON</button>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(JSON.stringify(r, null, 2)) }}
                                  className="text-[10px] px-2 py-0.5 rounded font-medium bg-[#e8eaed] dark:bg-[#2d3140] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-all flex items-center gap-1">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                  Copy
                                </button>
                              </div>
                              <div className="max-h-56 overflow-y-auto">
                                {jsonView[rowId] ? (
                                  <pre className="text-xs text-[#c9d1d9] bg-[#0d1117] p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed m-0">{JSON.stringify(r, null, 2)}</pre>
                                ) : (
                                  <table className="w-full text-[11px]">
                                    <tbody>
                                      {flattenDoc(r).map((fld, fi) => (
                                        <tr key={fi} className="border-b border-[#e5e7eb]/30 dark:border-[#2d3140]/30 hover:bg-[#f0f2f4] dark:hover:bg-[#161b22]">
                                          <td className="px-3 py-1 font-medium text-[#1f2328] dark:text-[#f0f6fc] whitespace-nowrap w-1/3 align-top text-[10px]">{fld.path}</td>
                                          <td className="px-3 py-1 text-[#36454f] dark:text-[#c9d1d9] break-all text-[11px]">{String(fld.value ?? '')}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
              {filteredRecent.length === 0 && (
                <tr><td colSpan={9} className="text-center py-4 text-xs text-[#8b949e]">No {activeFilters.length > 0 ? 'matching' : ''} logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalLogPages > 1 && (
          <div className="flex items-center justify-between mt-2.5 flex-wrap gap-2">
            <div className="flex items-center gap-1 text-[11px] text-[#8b949e]">
              <span className="mr-1 text-[10px]">{(logPage - 1) * LOG_PAGE_SIZE + 1}-{Math.min(logPage * LOG_PAGE_SIZE, filteredRecent.length)} of {filteredRecent.length}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}
                  className="bg-transparent border border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[10px] min-w-[26px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a] disabled:opacity-35 disabled:cursor-default transition-all">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                {Array.from({ length: Math.min(totalLogPages, 5) }, (_, i) => {
                  const pn = totalLogPages <= 5 ? i + 1 : Math.max(1, Math.min(logPage - 2, totalLogPages - 4)) + i
                  if (pn > totalLogPages) return null
                  return (
                    <button key={pn} onClick={() => setLogPage(pn)}
                      className={`bg-transparent border px-2 py-0.5 rounded text-[10px] min-w-[26px] transition-all ${pn === logPage ? 'bg-[#e8681a] text-white border-[#e8681a]' : 'border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a]'}`}>{pn}</button>
                  )
                })}
                {totalLogPages > 5 && logPage < totalLogPages - 2 && <span className="px-0.5 text-[#8b949e]">...</span>}
                {totalLogPages > 5 && (
                  <button onClick={() => setLogPage(totalLogPages)}
                    className="bg-transparent border border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[10px] min-w-[26px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a] transition-all">{totalLogPages}</button>
                )}
                <button onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))} disabled={logPage === totalLogPages}
                  className="bg-transparent border border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[10px] min-w-[26px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a] disabled:opacity-35 disabled:cursor-default transition-all">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
              {logPage === totalLogPages && (evFilterQuery ? evFilterOffsetRef.current < 10000 : evExtraOffsetRef.current < (data?.recentTotal || 0)) && (
                <button onClick={loadMoreLogs} disabled={evLoadingMore}
                  className="ml-auto px-3 py-1 text-xs font-bold bg-[#e8681a]/10 text-[#e8681a] border border-[#e8681a]/30 rounded-lg hover:bg-[#e8681a]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2">
                  {evLoadingMore ? (
                    <><svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32" strokeLinecap="round"/></svg> Loading...</>
                  ) : (
                    <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg> Load 500 more ({evFilterQuery ? Math.min(10000 - evFilterOffsetRef.current, 10000 - evFilterOffsetRef.current) : Math.min((data?.recentTotal || 0) - evExtraOffsetRef.current, 10000 - evExtraOffsetRef.current)} remaining)</>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-[10px] text-[#8b949e] py-3 border-t border-[#e5e7eb] dark:border-[#2d3140]">&copy; 2025 UniShield 360. All rights reserved.</div>

      {modalContent()}
    </motion.div>
  )
}
