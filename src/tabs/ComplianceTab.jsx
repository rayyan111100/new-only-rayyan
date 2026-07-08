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
import InlineFilter from '../components/InlineFilter'
import { api } from '../api'
import { parseDateStr } from '../utils'

const FRAMEWORKS = ['PCI-DSS', 'HIPAA', 'GDPR', 'TSC (SOC 2)', 'NIST 800-53']
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
  { header: 'Severity', accessor: r => { const lv = parseInt(r.rule?.level || r.level || 0); return lv >= 15 ? 'Critical' : lv >= 12 ? 'High' : lv >= 7 ? 'Medium' : 'Low' } },
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
  'MITRE ATT&CK': 'rule.mitre'
}

function buildFilterQuery(filters, excludes) {
  const parts = []
  if (filters.framework?.length && FRAMEWORK_TO_FIELD[filters.framework[0]]) {
    parts.push('_exists_:' + FRAMEWORK_TO_FIELD[filters.framework[0]])
  }
  const sevRanges = { Critical: 'rule.level:[15 TO *]', High: '(rule.level:[12 TO 14])', Medium: '(rule.level:[7 TO 11])', Low: '(rule.level:[0 TO 6])' }
  for (const s of (filters.severity || [])) {
    if (sevRanges[s]) parts.push(sevRanges[s])
  }
  for (const s of (excludes.severity || [])) {
    if (sevRanges[s]) parts.push('NOT ' + sevRanges[s])
  }
  for (const a of (filters.agent || [])) {
    parts.push('agent.name:"' + a.replace(/"/g, '\\"') + '"')
  }
  for (const r of (filters.rule || [])) {
    parts.push('rule.id:"' + r.replace(/"/g, '\\"') + '"')
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
  if (n >= 15) return 'Critical'
  if (n >= 12) return 'High'
  if (n >= 7) return 'Medium'
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
  const [excludes, setExcludes] = useState({})
  const [timelineFilter, setTimelineFilter] = useState(null)
  const [timeRange, setTimeRange] = useState('now-7d')
  const [expandedRow, setExpandedRow] = useState({})
  const [jsonView, setJsonView] = useState({})
  const containerRef = useRef(null)
  const [logPage, setLogPage] = useState(1)
  const LOG_PAGE_SIZE = 50
  const MAX_LOG_PAGES = 10
  const fwFilter = Array.isArray(filters.framework) ? filters.framework[0] : filters.framework
  const { data, loading, error, refresh } = useCompliance(fwFilter)
  const [evExtraLogs, setEvExtraLogs] = useState([])
  const evExtraOffsetRef = useRef(0)
  const [evLoadingMore, setEvLoadingMore] = useState(false)
  const evFilterQuery = buildFilterQuery(filters, excludes)
  const evFilterOffsetRef = useRef(0)

  const handleRefresh = useCallback(() => {
    setFilters({})
    setExcludes({})
    setTimelineFilter(null)
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
      const res = await api('search', { index: 'unishield360-alerts-*', start_date: sd, end_date: ed, q: evFilterQuery, limit: 10000, offset, sort: '@timestamp', order: 'desc' })
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
      const res = await api('search', { index: 'unishield360-alerts-*', start_date: sd, end_date: ed, q, limit: 10000, offset: evExtraOffsetRef.current, sort: '@timestamp', order: 'desc' })
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
      const arr = prev[key] || []
      const next = { ...prev }
      if (arr.includes(value)) {
        const filtered = arr.filter(v => v !== value)
        if (filtered.length) next[key] = filtered
        else delete next[key]
      } else {
        next[key] = [...arr, value]
      }
      return next
    })
    setExcludes(prev => {
      const next = { ...prev }
      const arr = next[key]
      if (arr?.includes(value)) {
        const filtered = arr.filter(v => v !== value)
        if (filtered.length) next[key] = filtered
        else delete next[key]
      }
      return next
    })
  }

  const setInclude = (field, value) => {
    setFilters(prev => {
      const arr = prev[field] || []
      const next = { ...prev }
      if (arr.includes(value)) {
        const filtered = arr.filter(v => v !== value)
        if (filtered.length) next[field] = filtered
        else delete next[field]
      } else {
        next[field] = [...arr, value]
      }
      return next
    })
    setExcludes(prev => {
      const next = { ...prev }
      const arr = next[field]
      if (arr?.includes(value)) {
        const filtered = arr.filter(v => v !== value)
        if (filtered.length) next[field] = filtered
        else delete next[field]
      }
      return next
    })
  }

  const setExclude = (field, value) => {
    setExcludes(prev => {
      const arr = prev[field] || []
      const next = { ...prev }
      if (arr.includes(value)) {
        const filtered = arr.filter(v => v !== value)
        if (filtered.length) next[field] = filtered
        else delete next[field]
      } else {
        next[field] = [...arr, value]
      }
      return next
    })
    setFilters(prev => {
      const next = { ...prev }
      const arr = next[field]
      if (arr?.includes(value)) {
        const filtered = arr.filter(v => v !== value)
        if (filtered.length) next[field] = filtered
        else delete next[field]
      }
      return next
    })
  }

  const clearFilter = (key, value) => { setFilters(prev => { const next = { ...prev }; const arr = next[key]; if (arr) { const f = arr.filter(v => v !== value); if (f.length) next[key] = f; else delete next[key] } return next }); setExcludes(prev => { const next = { ...prev }; const arr = next[key]; if (arr) { const f = arr.filter(v => v !== value); if (f.length) next[key] = f; else delete next[key] } return next }) }

  const clearAllFilters = () => { setFilters({}); setExcludes({}); setTimelineFilter(null) }

  const activeFilters = Object.keys(filters)
  const activeExcludes = Object.keys(excludes)

  const filteredRecent = useMemo(() => {
    const all = [...(data?.recent || []), ...evExtraLogs]
    return all.filter(r => {
      const level = parseInt(r.rule?.level || r.level || 0)
      const sev = toSev(level)
      const agentName = r.agent?.name || r.agent || ''
      const ruleId = r.rule?.id || r.rule || ''
      const desc = r.rule?.description || r.description || '--'
      const event = r.rule?.groups?.[0] || r.event_type || '--'
      const frameworks = (r._frameworks || []).join(', ') || '--'
      const control = r.rule?.gdpr || r.rule?.tsc || r.rule?.hipaa || r.rule?.pci_dss || r.rule?.nist_800_53 || r.control || '--'
      const file = r.data?.file || r.file || '--'
      if (filters.severity?.length && !filters.severity.includes(sev)) return false
      if (excludes.severity?.length && excludes.severity.includes(sev)) return false
      if (filters.agent?.length && !filters.agent.includes(agentName)) return false
      if (excludes.agent?.length && excludes.agent.includes(agentName)) return false
      if (filters.rule?.length && !filters.rule.includes(ruleId)) return false
      if (excludes.rule?.length && excludes.rule.includes(ruleId)) return false
      if (filters.desc?.length && !filters.desc.includes(desc)) return false
      if (excludes.desc?.length && excludes.desc.includes(desc)) return false
      if (filters.event?.length && !filters.event.includes(event)) return false
      if (excludes.event?.length && excludes.event.includes(event)) return false
      if (filters.frameworks?.length && !filters.frameworks.includes(frameworks)) return false
      if (excludes.frameworks?.length && excludes.frameworks.includes(frameworks)) return false
      if (filters.control?.length && !filters.control.includes(control)) return false
      if (excludes.control?.length && excludes.control.includes(control)) return false
      if (filters.file?.length && !filters.file.includes(file)) return false
      if (excludes.file?.length && excludes.file.includes(file)) return false
      if (filters.framework?.length) {
        const fws = r._frameworks || []
        const fw = filters.framework[0]
        if (fws.includes(fw)) return true
        const field = FRAMEWORK_TO_FIELD[fw]
        if (field) {
          const parts = field.split('.')
          let val = r
          for (const p of parts) { if (val) val = val[p] }
          if (val && val.toString().trim()) return true
        }
        return false
      }
      if (timelineFilter) {
        const t = new Date(r['@timestamp'] || r.timestamp).getTime()
        if (t < timelineFilter || t >= timelineFilter + 86400000) return false
      }
      return true
    })
  }, [data?.recent, evExtraLogs, filters, excludes, timelineFilter])

  const totalLogPages = Math.max(1, Math.ceil(filteredRecent.length / LOG_PAGE_SIZE))

  const hasFilters = activeFilters.length > 0 || activeExcludes.length > 0 || timelineFilter

  const filteredSummary = useMemo(() => {
    const sevCounts = {}
    const fwCountsMap = {}
    const ctrlCounts = {}
    const agentCounts = {}
    const catCounts = {}
    for (const r of filteredRecent) {
      const level = parseInt(r.rule?.level || r.level || 0)
      const sev = level >= 15 ? 'Critical' : level >= 12 ? 'High' : level >= 7 ? 'Medium' : 'Low'
      sevCounts[sev] = (sevCounts[sev] || 0) + 1
      const fws = r._frameworks || []
      for (const fw of fws) {
        if (fw !== 'MITRE ATT&CK') fwCountsMap[fw] = (fwCountsMap[fw] || 0) + 1
      }
      const agentName = r.agent?.name || r.agent || '--'
      agentCounts[agentName] = (agentCounts[agentName] || 0) + 1
      const ctrl = r.rule?.gdpr || r.rule?.tsc || r.rule?.hipaa || r.rule?.pci_dss || r.rule?.nist_800_53 || r.control || '--'
      ctrlCounts[ctrl] = (ctrlCounts[ctrl] || 0) + 1
      const groups = r.rule?.groups || []
      for (const g of groups) {
        catCounts[g] = (catCounts[g] || 0) + 1
      }
    }
    const ruleCounts = {}
    for (const r of filteredRecent) {
      const rid = r.rule?.id || r.rule || '--'
      ruleCounts[rid] = (ruleCounts[rid] || 0) + 1
    }
    return { sevCounts, fwCountsMap, ctrlCounts, agentCounts, catCounts, ruleCounts }
  }, [filteredRecent])

  const totalEvents = data
    ? (hasFilters ? (data.count24 || 0) : Object.values(data.severity).reduce((a, b) => a + b, 0))
    : 0
  const logTotal = hasFilters ? (data?.count24 || 0) : (data?.recentTotal || 0)

  const fwCounts = hasFilters
    ? Object.entries(filteredSummary.fwCountsMap).map(([framework, count]) => ({ framework, count })).sort((a, b) => b.count - a.count)
    : (data?.frameworkCounts || []).filter(f => f.framework !== 'MITRE ATT&CK')

  const maxFw = fwCounts.length > 0 ? Math.max(...fwCounts.map(f => f.count), 1) : 1

  const agentsData = hasFilters
    ? Object.entries(filteredSummary.agentCounts).map(([key, doc_count]) => ({ key, doc_count })).sort((a, b) => b.doc_count - a.doc_count)
    : (data?.topAgents || [])

  const maxAgent = agentsData.length > 0 ? Math.max(...agentsData.map(a => a.doc_count || 0), 1) : 1

  const sevData = hasFilters ? filteredSummary.sevCounts : (data?.severity || {})
  const sevDonut = SEV_ORDER.filter(s => (sevData[s] || 0) > 0).map(s => ({
    name: s, value: sevData[s] || 0, color: SEV_COLORS[s]
  }))

  const categoriesData = hasFilters
    ? Object.entries(filteredSummary.catCounts).map(([key, doc_count]) => ({ key, doc_count })).sort((a, b) => b.doc_count - a.doc_count)
    : (data?.categories || [])

  const topRulesData = hasFilters
    ? Object.entries(filteredSummary.ruleCounts).map(([rule, count]) => ({ key: rule, doc_count: count, ruleId: rule, control: '', description: '' })).sort((a, b) => (b.doc_count || 0) - (a.doc_count || 0))
    : (data?.topRules || [])

  const FILTER_STYLES = {
    severity: (v) => ({
      bg: v === 'Critical' ? '#e0525218' : v === 'High' ? '#e8893a18' : v === 'Medium' ? '#d2992218' : '#3fb95018',
      color: v === 'Critical' ? '#ff6b6b' : v === 'High' ? '#e8893a' : v === 'Medium' ? '#d29922' : '#3fb950'
    }),
    framework: () => ({ bg: '#a371f71a', color: '#a371f7' }),
    agent: () => ({ bg: '#58a6ff1a', color: '#58a6ff' }),
    rule: () => ({ bg: '#e8681a18', color: '#e8681a' }),
    desc: () => ({ bg: '#3fb95018', color: '#3fb950' }),
    control: () => ({ bg: '#e8681a18', color: '#e8681a' }),
    event: () => ({ bg: '#d2992218', color: '#d29922' }),
    frameworks: () => ({ bg: '#a371f71a', color: '#a371f7' }),
    file: () => ({ bg: '#8b949e18', color: '#8b949e' }),
    level: () => ({ bg: '#d2992218', color: '#d29922' }),
    time: () => ({ bg: '#8b949e18', color: '#8b949e' })
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

      {(activeFilters.length > 0 || activeExcludes.length > 0 || timelineFilter) && (
        <div className="flex items-center gap-2 mb-2.5 px-1 flex-wrap">
          <span className="text-xs text-[#8b949e]">Filters:</span>
          {Object.entries(filters).flatMap(([key, vals]) =>
            vals.map(val => {
              const st = FILTER_STYLES[key]?.(val) || { bg: '#3fb95018', color: '#3fb950' }
              return (
                <span key={key + val} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: st.bg, color: st.color }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  {key === 'severity' ? '' : key + ': '}{val}
                  <button onClick={() => clearFilter(key, val)} className="hover:opacity-70">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
              )
            })
          )}
          {Object.entries(excludes).flatMap(([key, vals]) =>
            vals.map(val => (
              <span key={'ex-' + key + val} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#f8514918', color: '#f85149' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                Exclude {key === 'severity' ? '' : key + ': '}{val}
                <button onClick={() => clearFilter(key, val)} className="hover:opacity-70">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </span>
            ))
          )}
          {timelineFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#e8681a18', color: '#e8681a' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              Time: {data?.timeline?.find(t => t.rawTime === timelineFilter)?.time || 'Selected'}
              <button onClick={() => setTimelineFilter(null)} className="hover:opacity-70">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </span>
          )}
          {((activeFilters.length + activeExcludes.length) > 0 || timelineFilter) && (
            <button onClick={clearAllFilters} className="text-[10px] px-2 py-0.5 rounded border border-[#e5e7eb] dark:border-[#2d3140] text-[#8b949e] hover:text-[#f85149] hover:border-[#f85149] transition-all">
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-6 gap-2.5 mb-3">
        {[
          { key: 'm-events', label: 'Compliance Events', val: totalEvents.toLocaleString(), icon: 'certificate', iconBg: '#a371f71a', iconColor: '#a371f7' },
          { key: 'm-crit', label: 'Critical Violations', val: (sevData.Critical || 0).toLocaleString(), icon: 'alert-triangle', iconBg: '#e0525218', iconColor: '#ff6b6b', valColor: '#ff6b6b' },
          { key: 'm-high', label: 'High Severity Violations', val: (sevData.High || 0).toLocaleString(), icon: 'alert-circle', iconBg: '#e8893a18', iconColor: '#e8893a', valColor: '#e8893a' },
          { key: 'm-med', label: 'Medium Severity Violations', val: (sevData.Medium || 0).toLocaleString(), icon: 'alert-circle', iconBg: '#d2992218', iconColor: '#d29922', valColor: '#d29922' },
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
            <div key={fw.framework} className="flex items-center gap-2 mb-1.5 py-1 px-1 rounded hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] text-[11px]">
              <InlineFilter field="framework" value={fw.framework}
                onInclude={() => setInclude('framework', fw.framework)}
                onExclude={() => setExclude('framework', fw.framework)}
                isIncluded={filters.framework?.includes(fw.framework)}
                isExcluded={excludes.framework?.includes(fw.framework)}
                className="w-[90px] text-[#36454f] dark:text-[#c9d1d9] font-medium shrink-0">
                <span className="w-[90px] text-[#36454f] dark:text-[#c9d1d9] font-medium shrink-0">{fw.framework}</span>
              </InlineFilter>
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
              <InlineFilter key={s} field="severity" value={s}
                onInclude={() => setInclude('severity', s)}
                onExclude={() => setExclude('severity', s)}
                isIncluded={filters.severity?.includes(s)}
                isExcluded={excludes.severity?.includes(s)}
                className={`flex items-center gap-1.5 text-[11px] rounded px-1 py-0.5 ${filters.severity?.includes(s) ? 'ring-1 ring-[#e8681a]/30 bg-[#e8681a]/5' : ''} ${filters.severity?.length && !filters.severity.includes(s) ? 'opacity-40' : ''}`}>
                <span className="w-[10px] h-[10px] rounded flex-shrink-0" style={{ background: SEV_COLORS[s] }} />
                {s} <span className="text-[#8b949e]">{sevData[s] || 0} ({Math.round(((sevData[s] || 0) / (totalEvents || 1)) * 100)}%)</span>
              </InlineFilter>
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

          </div>
          <div className="h-[150px]">
            {data?.timeline?.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={data.timeline}>
                  <defs><linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e8681a" stopOpacity={0.12} /><stop offset="95%" stopColor="#e8681a" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
                  <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <Area type="monotone" dataKey="count" stroke="#e8681a" fill="url(#compGrad)" strokeWidth={2.5} dot={{ r: 3, fill: '#e8681a', stroke: isDark ? '#161b22' : '#ffffff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <svg width="200" height="120" viewBox="0 0 200 120" className="opacity-40">
                  <polyline points="10,90 30,75 50,78 70,60 90,50 110,40 130,45 150,30 170,35 190,20" fill="none" stroke="#e8681a" strokeWidth="2.5" />
                  <rect x="10" y="90" width="180" height="40" fill="url(#compGrad)" opacity="0.1" />
                </svg>
              </div>
            )}
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
              {topRulesData.slice(0, 5).map((r, i) => {
                const ruleId = r.ruleId || r.key || r.rule || r.id || ''
                return (
                  <tr key={r.key || i} className="hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] text-[#8b949e]">{i + 1}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140]">
                      <InlineFilter field="rule" value={ruleId}
                        onInclude={() => setInclude('rule', ruleId)}
                        onExclude={() => setExclude('rule', ruleId)}
                        isIncluded={filters.rule?.includes(ruleId)}
                        isExcluded={excludes.rule?.includes(ruleId)}
                        className="font-bold text-left">
                        <span style={{ color: '#e8681a' }}>{ruleId}</span>
                      </InlineFilter>
                    </td>
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
                  <tr key={a.key || i} className="hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] text-[#8b949e]">{i + 1}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140]">
                      <InlineFilter field="agent" value={agentName}
                        onInclude={() => setInclude('agent', agentName)}
                        onExclude={() => setExclude('agent', agentName)}
                        isIncluded={filters.agent?.includes(agentName)}
                        isExcluded={excludes.agent?.includes(agentName)}
                        className={`font-semibold text-left ${filters.agent?.includes(agentName) ? 'text-[#58a6ff]' : excludes.agent?.includes(agentName) ? 'text-[#f85149]' : 'text-[#1f2328] dark:text-[#f0f6fc]'}`}>
                        {agentName}
                      </InlineFilter>
                    </td>
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
              {categoriesData.slice(0, 7).map((c, i) => (
                <tr key={c.key || i} className="hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] text-[#8b949e]">{i + 1}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9]">{c.key || '--'}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] text-right font-bold text-[#1f2328] dark:text-[#f0f6fc]">{(c.doc_count || 0).toLocaleString()}</td>
                </tr>
              ))}
              {categoriesData.length === 0 && (
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
                <tr key={fw.framework} className="hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] transition-colors">
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">
                    <InlineFilter field="framework" value={fw.framework}
                      onInclude={() => setInclude('framework', fw.framework)}
                      onExclude={() => setExclude('framework', fw.framework)}
                      isIncluded={filters.framework?.includes(fw.framework)}
                      isExcluded={excludes.framework?.includes(fw.framework)}
                      className="font-semibold text-left">
                      <span className="font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{fw.framework}</span>
                    </InlineFilter>
                  </td>
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
                          <span className="text-[10px] w-3 shrink-0">{isExp ? '\u25BE' : '\u25B8'}</span>
                          <InlineFilter field="time" value={r['@timestamp'] || r.timestamp || ''}
                            onInclude={() => setInclude('time', r['@timestamp'] || r.timestamp || '')}
                            onExclude={() => setExclude('time', r['@timestamp'] || r.timestamp || '')}
                            isIncluded={filters.time?.includes(r['@timestamp'] || r.timestamp || '')}
                            isExcluded={excludes.time?.includes(r['@timestamp'] || r.timestamp || '')}>
                            <span className="truncate">{(r['@timestamp'] || r.timestamp) ? new Date(r['@timestamp'] || r.timestamp).toLocaleString() : '--'}</span>
                          </InlineFilter>
                        </span>
                      </td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] overflow-hidden text-ellipsis whitespace-nowrap">
                        <InlineFilter field="agent" value={agentName}
                          onInclude={() => setInclude('agent', agentName)}
                          onExclude={() => setExclude('agent', agentName)}
                          isIncluded={filters.agent?.includes(agentName)}
                          isExcluded={excludes.agent?.includes(agentName)}
                          className={`font-semibold text-left truncate max-w-full ${filters.agent?.includes(agentName) ? 'text-[#58a6ff]' : excludes.agent?.includes(agentName) ? 'text-[#f85149]' : 'text-[#1f2328] dark:text-[#f0f6fc]'}`}>
                          {agentName}
                        </InlineFilter>
                      </td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] overflow-hidden text-ellipsis whitespace-nowrap">
                        <InlineFilter field="rule" value={ruleId}
                          onInclude={() => setInclude('rule', ruleId)}
                          onExclude={() => setExclude('rule', ruleId)}
                          isIncluded={filters.rule?.includes(ruleId)}
                          isExcluded={excludes.rule?.includes(ruleId)}
                          className={`font-bold text-left truncate max-w-full ${filters.rule?.includes(ruleId) ? 'text-[#e8681a] underline' : excludes.rule?.includes(ruleId) ? 'text-[#f85149]' : 'text-[#e8681a]'}`}>
                          {ruleId}
                        </InlineFilter>
                      </td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140]">{
                        (() => { const lv = parseInt(r.rule?.level || r.level || 0); return <InlineFilter field="level" value={String(lv)}
                          onInclude={() => setInclude('level', String(lv))}
                          onExclude={() => setExclude('level', String(lv))}
                          isIncluded={filters.level?.includes(String(lv))}
                          isExcluded={excludes.level?.includes(String(lv))}
                          className="inline-flex items-center justify-center w-[22px] h-[18px] rounded text-[10px] font-semibold"
                          style={{ background: lv >= 15 ? '#450a0a' : lv >= 12 ? '#3d1a00' : lv >= 7 ? '#0d1117' : '#0d1117', color: lv >= 15 ? '#fca5a5' : lv >= 12 ? '#fdba74' : lv >= 7 ? '#8b949e' : '#8b949e' }}>
                          {lv}
                        </InlineFilter> })()
                      }</td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] overflow-hidden text-ellipsis whitespace-nowrap text-[#36454f] dark:text-[#c9d1d9] max-w-0">
                        <InlineFilter field="desc" value={r.rule?.description || r.description || '--'}
                          onInclude={() => setInclude('desc', r.rule?.description || r.description || '--')}
                          onExclude={() => setExclude('desc', r.rule?.description || r.description || '--')}
                          isIncluded={filters.desc?.includes(r.rule?.description || r.description || '--')}
                          isExcluded={excludes.desc?.includes(r.rule?.description || r.description || '--')}
                          className="text-[#36454f] dark:text-[#c9d1d9]">
                          {r.rule?.description || r.description || '--'}
                        </InlineFilter>
                      </td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] overflow-hidden text-ellipsis whitespace-nowrap">
                        <InlineFilter field="event" value={r.rule?.groups?.[0] || r.event_type || '--'}
                          onInclude={() => setInclude('event', r.rule?.groups?.[0] || r.event_type || '--')}
                          onExclude={() => setExclude('event', r.rule?.groups?.[0] || r.event_type || '--')}
                          isIncluded={filters.event?.includes(r.rule?.groups?.[0] || r.event_type || '--')}
                          isExcluded={excludes.event?.includes(r.rule?.groups?.[0] || r.event_type || '--')}
                          className="text-[#e8681a] font-medium">
                          {r.rule?.groups?.[0] || r.event_type || '--'}
                        </InlineFilter>
                      </td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] overflow-hidden text-ellipsis whitespace-nowrap">
                        <InlineFilter field="frameworks" value={(r._frameworks || []).join(', ') || '--'}
                          onInclude={() => setInclude('frameworks', (r._frameworks || []).join(', ') || '--')}
                          onExclude={() => setExclude('frameworks', (r._frameworks || []).join(', ') || '--')}
                          isIncluded={filters.frameworks?.includes((r._frameworks || []).join(', ') || '--')}
                          isExcluded={excludes.frameworks?.includes((r._frameworks || []).join(', ') || '--')}
                          className="text-[#8b949e] font-medium">
                          {(r._frameworks || []).join(', ') || '--'}
                        </InlineFilter>
                      </td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] overflow-hidden text-ellipsis whitespace-nowrap">
                        <InlineFilter field="control" value={r.rule?.gdpr || r.rule?.tsc || r.rule?.hipaa || r.rule?.pci_dss || r.rule?.nist_800_53 || r.control || '--'}
                          onInclude={() => setInclude('control', r.rule?.gdpr || r.rule?.tsc || r.rule?.hipaa || r.rule?.pci_dss || r.rule?.nist_800_53 || r.control || '--')}
                          onExclude={() => setExclude('control', r.rule?.gdpr || r.rule?.tsc || r.rule?.hipaa || r.rule?.pci_dss || r.rule?.nist_800_53 || r.control || '--')}
                          isIncluded={filters.control?.includes(r.rule?.gdpr || r.rule?.tsc || r.rule?.hipaa || r.rule?.pci_dss || r.rule?.nist_800_53 || r.control || '--')}
                          isExcluded={excludes.control?.includes(r.rule?.gdpr || r.rule?.tsc || r.rule?.hipaa || r.rule?.pci_dss || r.rule?.nist_800_53 || r.control || '--')}
                          className="text-[#8b949e]">
                          {r.rule?.gdpr || r.rule?.tsc || r.rule?.hipaa || r.rule?.pci_dss || r.rule?.nist_800_53 || r.control || '--'}
                        </InlineFilter>
                      </td>
                      <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#2d3140] overflow-hidden text-ellipsis whitespace-nowrap">
                        <InlineFilter field="file" value={r.data?.file || r.file || '--'}
                          onInclude={() => setInclude('file', r.data?.file || r.file || '--')}
                          onExclude={() => setExclude('file', r.data?.file || r.file || '--')}
                          isIncluded={filters.file?.includes(r.data?.file || r.file || '--')}
                          isExcluded={excludes.file?.includes(r.data?.file || r.file || '--')}
                          className="text-[#8b949e]">
                          {r.data?.file || r.file || '--'}
                        </InlineFilter>
                      </td>
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
                <tr><td colSpan={9} className="text-center py-4 text-xs text-[#8b949e]">No {(activeFilters.length > 0 || activeExcludes.length > 0) ? 'matching' : ''} logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalLogPages > 1 && (
          <div className="flex items-center justify-end mt-2.5 border-t border-[#e5e7eb] dark:border-[#2d3140] pt-2.5">
            <div className="flex items-center gap-1 text-[11px] text-[#8b949e]">
              <span className="mr-1.5 text-[#8b949e]">{(logPage - 1) * LOG_PAGE_SIZE + 1}-{Math.min(logPage * LOG_PAGE_SIZE, filteredRecent.length)} of {filteredRecent.length}</span>
              <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}
                className="p-1 rounded hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] disabled:opacity-30 transition-all">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.843 13.069 6.232 8.384a.546.546 0 0 1 0-.768l4.61-4.685"/></svg>
              </button>
              <div className="flex items-center gap-0.5">
                {(() => {
                  const pages = []
                  const addPage = (n) => { if (n >= 1 && n <= totalLogPages) pages.push({ type: 'page', n }) }
                  const addEllipsis = () => { const last = pages[pages.length-1]; if (last && last.type !== 'ellipsis') pages.push({ type: 'ellipsis' }) }
                  addPage(1)
                  if (logPage > 3) addEllipsis()
                  for (let i = Math.max(2, logPage - 1); i <= Math.min(totalLogPages - 1, logPage + 1); i++) addPage(i)
                  if (logPage < totalLogPages - 2) addEllipsis()
                  if (totalLogPages > 1) addPage(totalLogPages)
                  return pages.map((p, i) =>
                    p.type === 'ellipsis'
                      ? <span key={`e${i}`} className="px-1 text-[#8b949e]">...</span>
                      : <button key={p.n} onClick={() => setLogPage(p.n)}
                          className={`min-w-[24px] h-6 px-1 rounded text-[11px] font-medium transition-all ${
                            p.n === logPage ? 'bg-[#e8681a] text-white' : 'text-[#36454f] dark:text-[#c9d1d9] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d]'
                          }`}>{p.n}</button>
                  )
                })()}
              </div>
              <button onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))} disabled={logPage === totalLogPages}
                className="p-1 rounded hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] disabled:opacity-30 transition-all">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5.157 13.069 4.611-4.685a.546.546 0 0 0 0-.768L5.158 2.93"/></svg>
              </button>
              {logPage === totalLogPages && (evFilterQuery ? evFilterOffsetRef.current < 10000 : evExtraOffsetRef.current < logTotal) && (
                <button onClick={loadMoreLogs} disabled={evLoadingMore}
                  className="ml-auto px-3 py-1 text-xs font-bold bg-[#e8681a]/10 text-[#e8681a] border border-[#e8681a]/30 rounded-lg hover:bg-[#e8681a]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2">
                  {evLoadingMore ? (
                    <><svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32" strokeLinecap="round"/></svg> Loading...</>
                  ) : (
                    <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg> Load 500 more ({Math.min(10000, Math.max(0, logTotal - (evFilterQuery ? evFilterOffsetRef.current : evExtraOffsetRef.current)))} remaining)</>
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

