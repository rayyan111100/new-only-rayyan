import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import DateRangePicker from '../components/DateRangePicker'
import DetailSidebar from '../components/DetailSidebar'
import LogDetailModal from '../components/LogDetailModal'
import useCompliance from '../hooks/useCompliance'
import { exportExcel, exportPDFReport, prepareRows } from '../utils/exportLogs'
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import FilterableMetricCard from '../components/FilterableMetricCard'
import InlineFilter from '../components/InlineFilter'
import { api } from '../api'
import { parseDateStr } from '../utils'

const SEV_COLORS = { Critical: '#f85149', High: '#e8681a', Medium: '#d29922', Low: '#3fb950' }
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low']

const EXPORT_COLS = [
  { header: 'Time', accessor: 'time' }, { header: 'Agent', accessor: 'agent' },
  { header: 'Rule', accessor: 'rule' }, { header: 'Severity', accessor: 'sev' },
  { header: 'Description', accessor: 'desc' }, { header: 'Event', accessor: 'event' },
  { header: 'Control', accessor: 'ctrl' },
  { header: 'Groups', accessor: 'groups' },
]

const TSC_CONTROLS = [
  { ctrl: 'CC6.1', desc: 'Logical Access Controls' },
  { ctrl: 'CC6.8', desc: 'Change Management' },
  { ctrl: 'CC7.2', desc: 'System Operations' },
  { ctrl: 'CC7.3', desc: 'Incident Response' },
  { ctrl: 'PI1.4', desc: 'Information Security' }
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
  const { isDark, startDate, endDate } = useApp()
  const [modal, setModal] = useState(null)
  const [sidebar, setSidebar] = useState(null)
  const [filters, setFilters] = useState({})
  const [excludes, setExcludes] = useState({})
  const [logPage, setLogPage] = useState(1)
  const [expandedRow, setExpandedRow] = useState({})
  const [jsonView, setJsonView] = useState({})
  const [timelineFilter, setTimelineFilter] = useState(null)
  const containerRef = useRef(null)
  const LOG_PAGE_SIZE = 10
  const { data, loading, error, toLogEntry, toSev, refresh } = useCompliance('TSC (SOC 2)')
  const [evExtraLogs, setEvExtraLogs] = useState([])
  const evExtraOffsetRef = useRef(0)
  const [evLoadingMore, setEvLoadingMore] = useState(false)
  const loadMoreLogs = useCallback(async () => {
    setEvLoadingMore(true)
    try {
      const sd = parseDateStr(startDate).toISOString()
      const ed = parseDateStr(endDate).toISOString()
      const res = await api('search', { index: 'unishield360-alerts-4.x-*', start_date: sd, end_date: ed, q: '_exists_:rule.tsc', limit: 500, offset: evExtraOffsetRef.current, sort: '@timestamp', order: 'desc' })
      const results = res.results || []
      const mapped = results.map(r => ({ ...toLogEntry(r), raw: r }))
      setEvExtraLogs(prev => [...prev, ...mapped])
      evExtraOffsetRef.current += mapped.length
    } catch (e) {
      console.error('loadMoreLogs error:', e)
    } finally {
      setEvLoadingMore(false)
    }
  }, [startDate, endDate, toLogEntry])
  useEffect(() => {
    setEvExtraLogs([])
    evExtraOffsetRef.current = 0
  }, [data?.recent])
  const handleRefresh = useCallback(() => {
    setFilters({})
    setExcludes({})
    setTimelineFilter(null)
    setLogPage(1)
    setExpandedRow({})
    setJsonView({})
    setEvExtraLogs([])
    evExtraOffsetRef.current = 0
    refresh()
  }, [refresh])
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

  const clearFilter = (key, value) => { setFilters(prev => { const next = { ...prev }; const arr = next[key]; if (arr) { const f = arr.filter(v => v !== value); if (f.length) next[key] = f; else delete next[key] } return next }); setExcludes(prev => { const next = { ...prev }; const arr = next[key]; if (arr) { const f = arr.filter(v => v !== value); if (f.length) next[key] = f; else delete next[key] } return next }) }

  const clearAllFilters = () => { setFilters({}); setExcludes({}); setTimelineFilter(null) }

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

  const activeFilters = Object.keys(filters)
  const activeExcludes = Object.keys(excludes)

  const logEntries = useMemo(() => {
    const initial = (data?.recent || []).map(r => ({ ...toLogEntry(r), raw: r }))
    return [...initial, ...evExtraLogs]
  }, [data, toLogEntry, evExtraLogs])

  const hasActiveFilter = activeFilters.length > 0 || activeExcludes.length > 0 || !!timelineFilter

  const DAY_MS = 86400000
  const filteredLogs = logEntries.filter(l => {
    if (timelineFilter) {
      const t = new Date(l.time).getTime()
      if (t < timelineFilter || t >= timelineFilter + DAY_MS) return false
    }
    if (filters.severity?.length && !filters.severity.includes(l.sev)) return false
    if (filters.agent?.length && !filters.agent.includes(l.agent)) return false
    if (filters.rule?.length && !filters.rule.includes(l.rule)) return false
    if (filters.control?.length && !filters.control.includes(l.ctrl)) return false
    if (filters.desc?.length && !filters.desc.includes(l.desc)) return false
    if (filters.event?.length && !filters.event.includes(l.event)) return false
    if (filters.groups?.length && !filters.groups.includes(l.groups)) return false
    if (excludes.severity?.length && excludes.severity.includes(l.sev)) return false
    if (excludes.agent?.length && excludes.agent.includes(l.agent)) return false
    if (excludes.rule?.length && excludes.rule.includes(l.rule)) return false
    if (excludes.control?.length && excludes.control.includes(l.ctrl)) return false
    if (excludes.desc?.length && excludes.desc.includes(l.desc)) return false
    if (excludes.event?.length && excludes.event.includes(l.event)) return false
    if (excludes.groups?.length && excludes.groups.includes(l.groups)) return false
    return true
  })

  const totalLogPages = Math.ceil(filteredLogs.length / LOG_PAGE_SIZE)

  useEffect(() => { setLogPage(1) }, [activeFilters.join(), activeExcludes.join()])

  const chartData = useMemo(() => {
    if (!hasActiveFilter) return null
    const logs = filteredLogs
    const sev = {}
    SEV_ORDER.forEach(s => sev[s] = 0)
    logs.forEach(l => { if (l.sev) sev[l.sev] = (sev[l.sev] || 0) + 1 })
    const ctrlMap = {}
    logs.forEach(l => { if (l.ctrl) ctrlMap[l.ctrl] = (ctrlMap[l.ctrl] || 0) + 1 })
    const agMap = {}
    logs.forEach(l => { if (l.agent) agMap[l.agent] = (agMap[l.agent] || 0) + 1 })
    const ruleMap = {}
    logs.forEach(l => { if (l.rule) ruleMap[l.rule] = (ruleMap[l.rule] || 0) + 1 })
    return {
      severity: sev,
      controls: ctrlMap,
      topAgents: Object.entries(agMap).map(([key, doc_count]) => ({ key, doc_count })).sort((a, b) => b.doc_count - a.doc_count).slice(0, 10),
      topRules: Object.entries(ruleMap).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 10)
    }
  }, [filteredLogs, hasActiveFilter])

  const severitySource = hasActiveFilter && chartData ? chartData.severity : data?.severity || {}

  const totalEvents = hasActiveFilter && chartData
    ? Object.values(chartData.severity).reduce((a, b) => a + b, 0)
    : data ? Object.values(data.severity).reduce((a, b) => a + b, 0) : 0
  const maxAgent = hasActiveFilter && chartData
    ? Math.max(...chartData.topAgents.map(a => a.doc_count || 0), 1)
    : data ? Math.max(...data.topAgents.map(a => a.doc_count || 0), 1) : 1

  const controlEvents = useMemo(() => {
    const map = {}
    if (hasActiveFilter && chartData) {
      TSC_CONTROLS.forEach(c => { map[c.ctrl] = chartData.controls[c.ctrl] || 0 })
      return map
    }
    if (data?.topRules) {
      data.topRules.forEach(r => {
        const ctrl = r.control || ''
        if (ctrl && TSC_CONTROLS.some(c => c.ctrl === ctrl)) {
          map[ctrl] = (map[ctrl] || 0) + (r.count || 0)
        }
      })
    }
    if (Object.keys(map).length === 0 && data?.recent) {
      data.recent.forEach(r => {
        const entry = toLogEntry(r)
        if (entry.ctrl && TSC_CONTROLS.some(c => c.ctrl === entry.ctrl)) {
          map[entry.ctrl] = (map[entry.ctrl] || 0) + 1
        }
      })
    }
    TSC_CONTROLS.forEach(c => { if (!map[c.ctrl]) map[c.ctrl] = 0 })
    return map
  }, [data, toLogEntry, chartData, hasActiveFilter])

  const maxControl = Math.max(...Object.values(controlEvents), 1)

  const sevDonut = SEV_ORDER.filter(s => (severitySource[s] || 0) > 0).map(s => ({
    name: s, value: severitySource[s], color: SEV_COLORS[s]
  }))

  const FILTER_STYLES = {
    severity: (v) => ({
      bg: v === 'Critical' ? '#e0525218' : v === 'High' ? '#e8893a18' : v === 'Medium' ? '#d2992218' : '#3fb95018',
      color: v === 'Critical' ? '#ff6b6b' : v === 'High' ? '#e8893a' : v === 'Medium' ? '#d29922' : '#3fb950'
    }),
    agent: () => ({ bg: '#58a6ff1a', color: '#58a6ff' }),
    rule: () => ({ bg: '#e8681a18', color: '#e8681a' })
  }

  const SevBadge = ({ s }) => {
    const BG = { Critical: '#450a0a', High: '#3d1a00', Medium: '#2d1f00', Low: '#052e16' }
    const TXT = { Critical: '#fca5a5', High: '#fdba74', Medium: '#fde68a', Low: '#86efac' }
    const LIGHT_BG = { Critical: '#fee2e2', High: '#ffedd5', Medium: '#fef9c3', Low: '#dcfce7' }
    const LIGHT_TXT = { Critical: '#991b1b', High: '#9a3412', Medium: '#854d0e', Low: '#166534' }
    const bg = isDark ? BG[s] : LIGHT_BG[s]
    const tx = isDark ? TXT[s] : LIGHT_TXT[s]
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: bg, color: tx }}>{s}</span>
  }

  const closeModal = () => setModal(null)
  const openModal = (k) => {
    if (k === 'm-assets' || k === 'all-agents') { setSidebar('agents'); return }
    if (k === 'all-controls') { setSidebar('controls'); return }
    if (k === 'all-rules') { setSidebar('rules'); return }
    setModal(k)
  }

  const getControlEvents = (ctrl) => controlEvents[ctrl] || 0

  const modalContent = () => {
    if (!modal) return null
    const mKey = modal

    if (mKey.startsWith('log-')) {
      const idx = parseInt(mKey.replace('log-', ''))
      const l = filteredLogs[idx]
      if (!l) return null
      return <LogDetailModal log={l} onClose={closeModal} label="SOC 2 Log" />
    }

    if (mKey.startsWith('ctrl-')) {
      const ctrl = mKey.replace('ctrl-', '')
      const control = TSC_CONTROLS.find(c => c.ctrl === ctrl)
      if (!control) return null
      const ev = getControlEvents(ctrl)
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={closeModal}>
          <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-5 w-[500px] max-h-[72vh] overflow-y-auto shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">SOC 2 Control {ctrl}</span>
              <button onClick={closeModal} className="text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] text-lg leading-none">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">Control</div><div className="text-sm font-bold text-[#e8681a]">{ctrl}</div></div>
              <div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">Events</div><div className="text-2xl font-bold text-[#f0f6fc]">{ev}</div></div>
            </div>
            <p className="text-xs text-[#36454f] dark:text-[#c9d1d9] leading-relaxed mb-3">{control.desc} &mdash; {ev} events detected in this period. Review flagged resources to ensure controls are operating effectively for SOC 2 audit evidence.</p>
            <div className="p-3 rounded-lg text-xs leading-relaxed" style={{ background: '#e8893a18', border: '1px solid #e8893a44', color: '#fdba74' }}>
              <strong>Recommendation:</strong> Investigate all {ev} events tied to {ctrl}. Correlate with access logs to confirm whether modifications were made by authorised principals.
            </div>
          </div>
        </div>
      )
    }

    if (mKey.startsWith('rule-')) {
      const rid = mKey.replace('rule-', '')
      const topRule = (data?.topRules || []).find(r => (r.ruleId || r.key || r.id || '') === rid)
      const desc = topRule?.description || 'Rule violation'
      const count = topRule?.count || 0
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={closeModal}>
          <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-5 w-[500px] max-h-[72vh] overflow-y-auto shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">Rule {rid}</span>
              <button onClick={closeModal} className="text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] text-lg leading-none">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">Rule ID</div><div className="text-xl font-bold text-[#e8681a]">{rid}</div></div>
              <div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">Times Fired</div><div className="text-xl font-bold text-[#f0f6fc]">{count}</div></div>
            </div>
            <p className="text-xs text-[#36454f] dark:text-[#c9d1d9] leading-relaxed">{desc} Rule {rid} is among the top triggered rules for SOC 2 compliance. Each event requires investigation and documentation for audit evidence.</p>
          </div>
        </div>
      )
    }

    if (mKey.startsWith('ag-')) {
      const aname = mKey.replace('ag-', '')
      const topAgent = (data?.topAgents || []).find(a => (a.key || a.agent || a.name || '') === aname)
      const cnt = topAgent?.doc_count || 0
      if (!cnt) return null
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={closeModal}>
          <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-5 w-[500px] max-h-[72vh] overflow-y-auto shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">Agent: {aname}</span>
              <button onClick={closeModal} className="text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] text-lg leading-none">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">Agent</div><div className="text-sm font-bold text-[#e8681a]">{aname}</div></div>
              <div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">Total Events</div><div className="text-2xl font-bold text-[#f0f6fc]">{cnt}</div></div>
            </div>
            <p className="text-xs text-[#36454f] dark:text-[#c9d1d9] leading-relaxed">This endpoint generated {cnt} SOC 2-relevant events this period. Under TSC criteria, these events may impact the audit opinion on control effectiveness.</p>
          </div>
        </div>
      )
    }

    const topCtrlEntry = TSC_CONTROLS.map(c => ({ ...c, ev: getControlEvents(c.ctrl) })).sort((a, b) => b.ev - a.ev)[0]
    const md = {
      'm-events': { t: 'SOC 2 Events', b: `Total TSC (SOC 2) events: ${totalEvents.toLocaleString()} across ${data?.topAgents?.length || 0} active agents. Top control: ${topCtrlEntry?.ctrl || 'N/A'} with ${topCtrlEntry?.ev || 0} events.` },
      'm-crit': { t: 'Critical Violations', b: `Critical violations: ${data?.severity?.Critical || 0}. Immediate action required if any affect SOC 2 control effectiveness.` },
      'm-high': { t: 'High Severity Violations', b: `High severity violations: ${data?.severity?.High || 0}. These require prompt investigation to ensure controls are operating effectively.` },
      'm-assets': { t: 'Monitored Assets', b: `${data?.topAgents?.length || 0} active agents generating SOC 2 compliance events.` },
      'm-controls': { t: 'Controls Violated', b: `${TSC_CONTROLS.filter(c => getControlEvents(c.ctrl) > 0).length} unique SOC 2 controls were violated this period: ${TSC_CONTROLS.filter(c => getControlEvents(c.ctrl) > 0).map(c => c.ctrl).join(', ')}. Each maps to specific TSC criteria under the SOC 2 framework.` },
      'm-top-ctrl': { t: 'Most Active Control', b: topCtrlEntry ? `${topCtrlEntry.ctrl} (${topCtrlEntry.desc}) is the most frequently violated control with ${topCtrlEntry.ev} events.` : 'No control violation data available.' }
    }

    const d = md[mKey]
    if (!d) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={closeModal}>
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-5 w-[500px] max-h-[72vh] overflow-y-auto shadow-lg" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">{d.t}</span>
            <button onClick={closeModal} className="text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] text-lg leading-none">&times;</button>
          </div>
          <p className="text-xs text-[#36454f] dark:text-[#c9d1d9] leading-relaxed">{d.b}</p>
        </div>
      </div>
    )
  }

  if (loading) return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-xs text-[#8b949e]">Loading TSC (SOC 2) data...</motion.div>
  if (error) return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-xs text-[#f85149]">Error: {error}</motion.div>

  return (
    <motion.div ref={containerRef} data-export-container initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="p-3">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[11px] text-[#8b949e]">Home / <span className="text-[#e8681a] cursor-pointer" onClick={() => openModal('go-overview')}>Compliance Management</span> / TSC (SOC 2)</div>
          <div className="text-xl font-bold text-[#1f2328] dark:text-[#f0f6fc] tracking-tight">TSC (SOC 2) Compliance</div>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <DateRangePicker />
          <button onClick={handleRefresh} className="p-1.5 rounded border border-transparent hover:bg-[#21262d] text-[#8b949e] hover:text-[#e8681a] transition-colors">
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
        {(() => {
          const topControl = TSC_CONTROLS.map(c => ({ ...c, ev: getControlEvents(c.ctrl) })).sort((a, b) => b.ev - a.ev)[0]
          const cards = [
            { key: 'm-events', label: 'SOC 2 Events', val: totalEvents.toLocaleString(), icon: 'certificate', iconBg: '#a371f71a', iconColor: '#a371f7' },
            { key: 'm-crit', label: 'Critical Violations', val: (severitySource?.Critical || 0).toLocaleString(), icon: 'alert-triangle', iconBg: '#e0525218', iconColor: '#ff6b6b', valColor: '#ff6b6b', filterField: 'severity', filterValue: 'Critical' },
            { key: 'm-high', label: 'High Severity Violations', val: (severitySource?.High || 0).toLocaleString(), icon: 'alert-circle', iconBg: '#e8893a18', iconColor: '#e8893a', valColor: '#e8893a', filterField: 'severity', filterValue: 'High' },
            { key: 'm-assets', label: 'Monitored Assets', val: hasActiveFilter && chartData ? chartData.topAgents.length : data?.topAgents?.length || 0, icon: 'device-desktop', iconBg: '#58a6ff1a', iconColor: '#58a6ff' },
            { key: 'm-controls', label: 'Controls Violated', val: TSC_CONTROLS.filter(c => getControlEvents(c.ctrl) > 0).length, icon: 'list-check', iconBg: '#3fb95018', iconColor: '#3fb950' },
            { key: 'm-top-ctrl', label: 'Most Active Control', val: topControl ? topControl.ctrl : '--', icon: 'award', iconBg: '#e8681a18', iconColor: '#e8681a', valColor: '#e8681a', valSize: 'text-base', filterField: 'control', filterValue: topControl?.ctrl || '' },
          ]
          return cards.map(card => (
            <FilterableMetricCard
              key={card.key}
              card={card}
              isDark={isDark}
              filterField={card.filterField}
              filterValue={card.filterValue}
              isIncluded={card.filterField && filters[card.filterField]?.includes(card.filterValue)}
              isExcluded={card.filterField && excludes[card.filterField]?.includes(card.filterValue)}
              onInclude={() => setInclude(card.filterField, card.filterValue)}
              onExclude={() => setExclude(card.filterField, card.filterValue)}
              onCustomClick={card.key === 'm-assets' ? () => setSidebar('agents') : !card.filterField ? () => openModal(card.key) : undefined}
            />
          ))
        })()}
      </div>

      {/* Tri Row */}
      <div className="grid grid-cols-[1.1fr_0.85fr_1.05fr] gap-2.5 mb-2.5">
        {/* Events by SOC 2 Control */}
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Events by SOC 2 Control (Top 5)</div>
          {TSC_CONTROLS.map(c => {
            const ev = getControlEvents(c.ctrl)
            const pct = (ev / maxControl) * 100
            return (
              <div key={c.ctrl} onClick={() => openModal('ctrl-' + c.ctrl)}
                className="flex items-center gap-2 mb-1.5 py-1 px-1 rounded hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] cursor-pointer text-[11px]">
                <span className="w-[90px] text-[#36454f] dark:text-[#c9d1d9] font-medium shrink-0">{c.ctrl}</span>
                <div className="flex-1 h-2 bg-[#d0d7de] dark:bg-[#30363d] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#e8681a,#ff7b2e)' }} />
                </div>
                <span className="w-7 text-right text-[#1f2328] dark:text-[#f0f6fc] font-bold">{ev}</span>
              </div>
            )
          })}
          <div className="flex justify-between text-[9px] text-[#8b949e] mt-1.5 px-1">
            <span>0</span><span>10</span><span>20</span><span>30</span><span>40</span>
          </div>
          <div className="text-center text-[10px] text-[#8b949e] mt-0.5">Events</div>
        </div>

        {/* Severity Donut */}
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 flex flex-col shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2">Severity Distribution</div>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {SEV_ORDER.filter(s => sevDonut.find(x => x.name === s)?.value > 0).map(s => {
              const v = sevDonut.find(x => x.name === s)?.value || 0
              return (
                <span key={s} onClick={() => setFilter('severity', s)}
                  className={`flex items-center gap-1.5 text-[11px] cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] ${filters.severity?.includes(s) ? 'ring-1 ring-[#e8681a]/30 bg-[#e8681a]/5' : ''} ${filters.severity?.length && !filters.severity.includes(s) ? 'opacity-40' : ''}`}>
                  <span className="w-[10px] h-[10px] rounded flex-shrink-0" style={{ background: SEV_COLORS[s] }} />
                  {s} <span className="text-[#8b949e]">{v} ({Math.round((v / (totalEvents || 1)) * 100)}%)</span>
                </span>
              )
            })}
          </div>
          <div className="flex-1 min-h-[120px] relative">
            {sevDonut.length > 0 && (
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={sevDonut} cx="50%" cy="50%" innerRadius={40} outerRadius={58} dataKey="value" stroke={isDark ? '#161b22' : '#ffffff'} strokeWidth={3}>
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

        {/* Trend */}
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2 flex items-center justify-between">
            <span>SOC 2 Events Trend</span>
            <span className="text-[10px] text-[#8b949e] bg-[#f0f2f4] dark:bg-[#2d3140] px-2 py-0.5 rounded font-medium normal-case">
              {startDate === 'now-24h' ? 'Last 24 Hours' : startDate === 'now-7d' ? 'Last 7 Days' : startDate === 'now-30d' ? 'Last 30 Days' : startDate === 'now-90d' ? 'Last 90 Days' : startDate || 'Last 7 Days'}
            </span>
          </div>
          <div className="h-[150px]">
            {data?.timeline?.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={data.timeline}
                  onClick={(e) => {
                    const rt = e?.activePayload?.[0]?.payload?.rawTime
                    if (rt) setTimelineFilter(timelineFilter === rt ? null : rt)
                  }}>
                  <defs><linearGradient id="tscGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e8681a" stopOpacity={0.12} /><stop offset="95%" stopColor="#e8681a" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <Area type="monotone" dataKey="count" stroke="#e8681a" fill="url(#tscGrad)" strokeWidth={2.5} dot={{ r: 3, fill: '#e8681a', stroke: isDark ? '#161b22' : '#ffffff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <svg width="200" height="120" viewBox="0 0 200 120" className="opacity-40">
                  <polyline points="10,90 30,75 50,78 70,60 90,50 110,40 130,45 150,30 170,35 190,20" fill="none" stroke="#e8681a" strokeWidth="2.5" />
                  <rect x="10" y="90" width="180" height="40" fill="url(#mockGrad)" opacity="0.1" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex justify-between text-[9px] text-[#8b949e] mt-1 px-0.5">
            {(data?.timeline || []).slice(0, 7).map((t, i) => <span key={i}>{t.time}</span>)}
          </div>
        </div>
      </div>

      {/* Three Table Row */}
      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        {/* Top Violated Controls */}
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Violated Controls</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">#</th><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Control</th><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Description</th><th className="text-right py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Events</th></tr></thead>
            <tbody>
              {TSC_CONTROLS.map((c, i) => {
                const ev = getControlEvents(c.ctrl)
                return (
                  <tr key={c.ctrl} onClick={() => openModal('ctrl-' + c.ctrl)} className="cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#21262d]">
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#8b949e]">{i + 1}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#e8681a] font-semibold">{c.ctrl}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#36454f] dark:text-[#c9d1d9]">{c.desc}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-right font-bold text-[#1f2328] dark:text-[#f0f6fc]">{ev}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="text-[#e8681a] text-[11px] font-semibold mt-2 cursor-pointer inline-flex items-center gap-1 hover:text-[#ff7b2e]"
            onClick={() => openModal('all-controls')}>View all controls <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
        </div>

        {/* Top Agents */}
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Agents</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">#</th><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Agent</th><th className="text-right py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Events</th></tr></thead>
            <tbody>
              {(hasActiveFilter && chartData ? chartData.topAgents : data?.topAgents || []).slice(0, 5).map((a, i) => {
                const name = a.key || a.agent || a.name || 'Unknown'
                const cnt = a.doc_count || a.events || 0
                const pct = (cnt / maxAgent) * 100
                return (
                  <tr key={name} onClick={() => setFilter('agent', name)}
                    className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] transition-colors ${filters.agent?.includes(name) ? 'bg-[#58a6ff]/5 ring-1 ring-inset ring-[#58a6ff]/30' : ''}`}>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#8b949e]">{i + 1}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{name}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-[70px] h-[6px] bg-[#d0d7de] dark:bg-[#30363d] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: 'linear-gradient(90deg,#e8681a,#ff7b2e)' }} />
                        </div>
                        <span className="font-bold text-[#1f2328] dark:text-[#f0f6fc]">{cnt}</span>
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

        {/* Top Rule IDs */}
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Rule IDs</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">#</th><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Rule ID</th><th className="text-left py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Description</th><th className="text-right py-1 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Fired</th></tr></thead>
            <tbody>
              {(hasActiveFilter && chartData ? chartData.topRules : data?.topRules || []).slice(0, 5).map((r, i) => {
                const ruleId = r.ruleId || r.key || r.id || ''
                return (
                  <tr key={ruleId || i} onClick={() => setFilter('rule', ruleId)}
                    className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] transition-colors ${filters.rule?.includes(ruleId) ? 'bg-[#e8681a]/5 ring-1 ring-inset ring-[#e8681a]/30' : ''}`}>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#8b949e]">{i + 1}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#e8681a] font-bold">{ruleId || '--'}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#36454f] dark:text-[#c9d1d9]">{(r.description || 'Event').substring(0, 30)}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-right font-bold text-[#1f2328] dark:text-[#f0f6fc]">{r.count || 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="text-[#e8681a] text-[11px] font-semibold mt-2 cursor-pointer inline-flex items-center gap-1 hover:text-[#ff7b2e]"
            onClick={() => openModal('all-rules')}>View all rules <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
        </div>
      </div>

      {/* SOC 2 Event Logs */}
      <div className="mb-3">
        {data?.recentTotal > 1000 && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-[#ddf4ff] dark:bg-[#0c2d6b] border border-[#54aeff66] dark:border-[#1f6feb66] text-[11px] text-[#0969da] dark:text-[#58a6ff]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span><strong>{data.recentTotal.toLocaleString()}</strong> events total. Use the <strong>Load 500 more</strong> button below to load additional logs.</span>
          </div>
        )}
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc] tracking-tight">SOC 2 Event Logs</div>
          <div className="flex items-center gap-1.5">
            <button data-ignore-export onClick={() => { const ts = new Date().toISOString().slice(0,10); exportExcel(filteredLogs, EXPORT_COLS, `tsc-logs-${ts}.xlsx`) }}
              className="text-[10px] px-2 py-1 rounded font-medium bg-[#e8eaed] dark:bg-[#2d3140] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-all flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Excel
            </button>
            <button data-ignore-export onClick={() => { const ts = new Date().toISOString().slice(0,10); exportPDFReport({ filename: `tsc-report-${ts}.pdf`, title: 'SOC 2 Event Report', dateRange: `${startDate || 'now-24h'} to ${endDate || 'now'}`, metrics: [{ label: 'Events (24h)', value: (data?.count24 || 0).toLocaleString() }, { label: 'Events (7d)', value: (data?.count7d || 0).toLocaleString() }, { label: 'Alert Sources', value: data?.topAgents?.length || 0 }, { label: 'Total Logs', value: filteredLogs.length }], severity: Object.entries(data?.severity || {}).map(([l, c]) => ({ level: l, count: c })), topRules: (data?.topRules || []).map(r => ({ key: r.key || r.ruleId || r.id || '--', count: r.doc_count || r.count || 0 })), topAgents: (data?.topAgents || []).map(a => ({ key: a.key || a.agent || a.name || '--', count: a.doc_count || a.events || 0 })), topArticles: (data?.topControls || []).map(c => ({ key: c.key || c.code || '--', count: c.doc_count || c.count || 0 })), timeline: (data?.timeline || []).map(t => ({ time: t.time, count: t.count })), logHeaders: EXPORT_COLS.map(c => c.header.toLowerCase()), logRows: prepareRows(filteredLogs, EXPORT_COLS) }) }}
              className="text-[10px] px-2 py-1 rounded font-medium bg-[#e8eaed] dark:bg-[#2d3140] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-all flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              PDF Report
            </button>
          </div>
        </div>
        <table className="w-full text-[10px] border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '110px' }} /><col style={{ width: '100px' }} /><col style={{ width: '55px' }} />
            <col style={{ width: '130px' }} /><col style={{ width: '145px' }} /><col style={{ width: '90px' }} />
            <col style={{ width: '100px' }} /><col style={{ width: '145px' }} />
          </colgroup>
          <thead>
            <tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide bg-[#f0f2f4] dark:bg-[#2d3140]">
              <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Time</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Agent</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Rule</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Control</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Description</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Severity</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Event</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#e5e7eb] dark:border-[#2d3140]">Groups</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE).map((l, i) => {
              const idx = (logPage - 1) * LOG_PAGE_SIZE + i
              const rowId = l.raw?._id || String(idx)
              const isExp = expandedRow[rowId]
              return (
                <React.Fragment key={idx}>
                  <tr onClick={() => toggleRow(rowId)}
                    className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] ${isExp ? 'bg-[#f6f8fa] dark:bg-[#16181f]' : ''}`}>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#8b949e]">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[10px] w-3">{isExp ? '▾' : '▸'}</span>
                        {l.time}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                      <InlineFilter field="agent" value={l.agent}
                        onInclude={() => setInclude('agent', l.agent)}
                        onExclude={() => setExclude('agent', l.agent)}
                        isIncluded={filters.agent?.includes(l.agent)}
                        isExcluded={excludes.agent?.includes(l.agent)}
                        className={`font-semibold text-left ${filters.agent?.includes(l.agent) ? 'text-[#58a6ff]' : excludes.agent?.includes(l.agent) ? 'text-[#f85149]' : 'text-[#1f2328] dark:text-[#f0f6fc]'}`}>
                        {l.agent}
                      </InlineFilter>
                    </td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                      <InlineFilter field="rule" value={l.rule}
                        onInclude={() => setInclude('rule', l.rule)}
                        onExclude={() => setExclude('rule', l.rule)}
                        isIncluded={filters.rule?.includes(l.rule)}
                        isExcluded={excludes.rule?.includes(l.rule)}
                        className={`font-bold text-left ${filters.rule?.includes(l.rule) ? 'text-[#e8681a] underline' : excludes.rule?.includes(l.rule) ? 'text-[#f85149]' : 'text-[#e8681a]'}`}>
                        {l.rule}
                      </InlineFilter>
                    </td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] font-semibold text-[#e8681a]">{l.ctrl}</td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                      <InlineFilter field="desc" value={l.desc}
                        onInclude={() => setInclude('desc', l.desc)}
                        onExclude={() => setExclude('desc', l.desc)}
                        isIncluded={filters.desc?.includes(l.desc)}
                        isExcluded={excludes.desc?.includes(l.desc)}
                        className={`text-left ${filters.desc?.includes(l.desc) ? 'text-[#58a6ff]' : excludes.desc?.includes(l.desc) ? 'text-[#f85149]' : 'text-[#36454f] dark:text-[#c9d1d9]'}`}>
                        {l.desc}
                      </InlineFilter>
                    </td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                      <InlineFilter field="severity" value={l.sev}
                        onInclude={() => setInclude('severity', l.sev)}
                        onExclude={() => setExclude('severity', l.sev)}
                        isIncluded={filters.severity?.includes(l.sev)}
                        isExcluded={excludes.severity?.includes(l.sev)}>
                        <SevBadge s={l.sev} />
                      </InlineFilter>
                    </td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                      <InlineFilter field="event" value={l.event}
                        onInclude={() => setInclude('event', l.event)}
                        onExclude={() => setExclude('event', l.event)}
                        isIncluded={filters.event?.includes(l.event)}
                        isExcluded={excludes.event?.includes(l.event)}
                        className={`text-left font-medium ${filters.event?.includes(l.event) ? 'text-[#58a6ff]' : excludes.event?.includes(l.event) ? 'text-[#f85149]' : 'text-[#e8681a]'}`}>
                        {l.event}
                      </InlineFilter>
                    </td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                      <InlineFilter field="groups" value={l.groups}
                        onInclude={() => setInclude('groups', l.groups)}
                        onExclude={() => setExclude('groups', l.groups)}
                        isIncluded={filters.groups?.includes(l.groups)}
                        isExcluded={excludes.groups?.includes(l.groups)}
                        className={`text-left font-medium ${filters.groups?.includes(l.groups) ? 'text-[#58a6ff]' : excludes.groups?.includes(l.groups) ? 'text-[#f85149]' : 'text-[#e8681a] text-[9px]'}`}>
                        {l.groups}
                      </InlineFilter>
                    </td>
                  </tr>
                  {isExp && l.raw && (
                    <tr>
                      <td colSpan={8} className="p-0 border-b border-[#f0f2f4] dark:border-[#21262d]">
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ duration: 0.15 }}>
                          <div className="bg-[#f6f8fa] dark:bg-[#16181f] border-t border-[#e5e7eb] dark:border-[#2d3140]">
                            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                              <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); setJsonView(prev => ({ ...prev, [rowId]: false })) }}
                                  className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${!jsonView[rowId] ? 'bg-[#e8681a] text-white' : 'text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]'}`}>Table</button>
                                <button onClick={(e) => { e.stopPropagation(); setJsonView(prev => ({ ...prev, [rowId]: true })) }}
                                  className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${jsonView[rowId] ? 'bg-[#e8681a] text-white' : 'text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]'}`}>JSON</button>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(JSON.stringify(l.raw, null, 2)) }}
                                className="text-[10px] px-2 py-0.5 rounded font-medium bg-[#e8eaed] dark:bg-[#2d3140] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-all flex items-center gap-1">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                Copy
                              </button>
                            </div>
                            <div className="max-h-56 overflow-y-auto">
                              {jsonView[rowId] ? (
                                <pre className="text-xs text-[#c9d1d9] bg-[#0d1117] p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed m-0">{JSON.stringify(l.raw, null, 2)}</pre>
                              ) : (
                                <table className="w-full text-[11px]">
                                  <tbody>
                                    {flattenDoc(l.raw).map((fld, fi) => (
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
            {filteredLogs.length === 0 && (
              <tr><td colSpan={8} className="text-center py-4 text-xs text-[#8b949e]">No matching logs found</td></tr>
            )}
          </tbody>
        </table>
                <div className="flex items-center justify-between mt-2.5 flex-wrap gap-2">
          <div className="flex items-center gap-1 text-[11px] text-[#8b949e]">
            <span className="mr-1">{(logPage - 1) * LOG_PAGE_SIZE + 1}-{Math.min(logPage * LOG_PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length}</span>
            <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}
              className="bg-transparent border border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[11px] min-w-[28px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a] disabled:opacity-35 disabled:cursor-default transition-all">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            {(() => {
              const total = totalLogPages
              const current = logPage
              const range = 5
              let start = Math.max(1, current - Math.floor(range / 2))
              let end = Math.min(total, start + range - 1)
              if (end - start + 1 < range) start = Math.max(1, end - range + 1)
              const pages = []
              if (start > 1) {
                pages.push(<button key={1} onClick={() => setLogPage(1)} className="bg-transparent border border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[11px] min-w-[28px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a] transition-all">1</button>)
                if (start > 2) pages.push(<span key="start-dots" className="px-0.5 text-[#8b949e]">...</span>)
              }
              for (let p = start; p <= end; p++) {
                pages.push(
                  <button key={p} onClick={() => setLogPage(p)}
                    className={`bg-transparent border px-2 py-0.5 rounded text-[11px] min-w-[28px] transition-all ${p === logPage ? 'bg-[#e8681a] text-white border-[#e8681a]' : 'border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a]'}`}>{p}</button>
                )
              }
              if (end < total) {
                if (end < total - 1) pages.push(<span key="end-dots" className="px-0.5 text-[#8b949e]">...</span>)
                pages.push(<button key={total} onClick={() => setLogPage(total)} className="bg-transparent border border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[11px] min-w-[28px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a] transition-all">{total}</button>)
              }
              return pages
            })()}
            <button onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))} disabled={logPage === totalLogPages}
              className="bg-transparent border border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[11px] min-w-[28px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a] disabled:opacity-35 disabled:cursor-default transition-all">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
        {logPage === totalLogPages && evExtraOffsetRef.current < (data?.recentTotal || 0) && (
          <div className="flex justify-center py-3 border-t border-[#e5e7eb] dark:border-[#2d3140]">
            <button onClick={loadMoreLogs} disabled={evLoadingMore}
              className="px-4 py-1.5 text-xs font-bold bg-[#e8681a]/10 text-[#e8681a] border border-[#e8681a]/30 rounded-lg hover:bg-[#e8681a]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2">
              {evLoadingMore ? (
                <><svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32" strokeLinecap="round"/></svg> Loading 500 more...</>
              ) : (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg> Load 500 more ({Math.min((data?.recentTotal || 0) - evExtraOffsetRef.current, 10000 - evExtraOffsetRef.current)} remaining)</>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="text-center text-[10px] text-[#8b949e] py-3 border-t border-[#e5e7eb] dark:border-[#2d3140]">&copy; 2025 UniShield 360. All rights reserved.</div>

      <DetailSidebar
        open={sidebar === 'agents'}
        onClose={() => setSidebar(null)}
        onSelectItem={(name) => setInclude('agent', name)}
        items={hasActiveFilter && chartData ? chartData.topAgents : data?.topAgents || []}
        title="All Agents"
        icon="agent"
        itemLabel="agents"
        accentColor="#58a6ff"
      />
      <DetailSidebar
        open={sidebar === 'controls'}
        onClose={() => setSidebar(null)}
        onSelectItem={(name) => setInclude('control', name)}
        items={TSC_CONTROLS.map(c => {
          const ev = getControlEvents(c.ctrl)
          return { key: c.ctrl, description: c.desc, doc_count: ev }
        })}
        title="All Controls"
        icon="control"
        itemLabel="controls"
        accentColor="#e8681a"
        labelKey="key"
      />
      <DetailSidebar
        open={sidebar === 'rules'}
        onClose={() => setSidebar(null)}
        onSelectItem={(name) => setInclude('rule', name)}
        items={hasActiveFilter && chartData ? chartData.topRules : data?.topRules || []}
        title="All Rule IDs"
        icon="rule"
        itemLabel="rules"
        accentColor="#d29922"
      />
      {modalContent()}
    </motion.div>
  )
}
