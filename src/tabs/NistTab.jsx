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
  { header: 'Control', accessor: 'ctrl' }, { header: 'Description', accessor: 'desc' },
  { header: 'Level', accessor: 'level' }, { header: 'Rule ID', accessor: 'rule' },
]

const NIST_CONTROLS = [
  { id: 'AC-6', desc: 'Least Privilege' },
  { id: 'AU-6', desc: 'Audit Review, Analysis & Reporting' },
  { id: 'CM-8', desc: 'System Component Inventory' },
  { id: 'SI-4', desc: 'System Monitoring' },
  { id: 'RA-5', desc: 'Vulnerability Scanning' }
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

export default function NistTab() {
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
  const { data, loading, error, toLogEntry, toSev, refresh } = useCompliance('NIST 800-53', filters)
  const [evExtraLogs, setEvExtraLogs] = useState([])
  const [evLoadingMore, setEvLoadingMore] = useState(false)
  const loadedCount = (data?.recent?.length || 0) + evExtraLogs.length
  const loadMoreLogs = useCallback(async () => {
    setEvLoadingMore(true)
    try {
      const sd = parseDateStr(startDate).toISOString()
      const ed = parseDateStr(endDate).toISOString()
      const offset = (data?.recent?.length || 0) + evExtraLogs.length
      const res = await api('search', { index: 'unishield360-alerts-4.x-*', start_date: sd, end_date: ed, q: '_exists_:rule.nist_800_53', limit: 500, offset, sort: '@timestamp', order: 'desc' })
      const results = res.results || []
      const mapped = results.map(r => {
        const entry = toLogEntry(r)
        const nist = r.rule?.nist_800_53
        entry.ctrl = Array.isArray(nist) ? nist.join(', ') : (nist || entry.ctrl || '--')
        entry.level = String(r.rule?.level ?? r.level ?? '--')
        return { ...entry, raw: r }
      })
      setEvExtraLogs(prev => [...prev, ...mapped])
    } catch (e) {
      console.error('loadMoreLogs error:', e)
    } finally {
      setEvLoadingMore(false)
    }
  }, [startDate, endDate, data, evExtraLogs, toLogEntry])
  useEffect(() => {
    setEvExtraLogs([])
  }, [filters.severity, startDate, endDate])
  const handleRefresh = useCallback(() => {
    setFilters({})
    setExcludes({})
    setTimelineFilter(null)
    setLogPage(1)
    setExpandedRow({})
    setJsonView({})
    setEvExtraLogs([])
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
    const initial = (data?.recent || []).map(r => {
      const entry = toLogEntry(r)
      const nist = r.rule?.nist_800_53
      entry.ctrl = Array.isArray(nist) ? nist.join(', ') : (nist || entry.ctrl || '--')
      entry.level = String(r.rule?.level ?? r.level ?? '--')
      return { ...entry, raw: r }
    })
    return [...initial, ...evExtraLogs]
  }, [data, toLogEntry, evExtraLogs])

  const DAY_MS = 86400000
  const filteredLogs = logEntries.filter(l => {
    if (timelineFilter) {
      const t = new Date(l.time).getTime()
      if (t < timelineFilter || t >= timelineFilter + DAY_MS) return false
    }
    if (filters.time?.length && !filters.time.includes(l.time)) return false
    if (filters.agent?.length && !filters.agent.includes(l.agent)) return false
    if (filters.control?.length && !filters.control.includes(l.ctrl)) return false
    if (filters.desc?.length && !filters.desc.includes(l.desc)) return false
    if (filters.level?.length && !filters.level.includes(l.level)) return false
    if (filters.rule?.length && !filters.rule.includes(l.rule)) return false
    if (excludes.time?.length && excludes.time.includes(l.time)) return false
    if (excludes.agent?.length && excludes.agent.includes(l.agent)) return false
    if (excludes.control?.length && excludes.control.includes(l.ctrl)) return false
    if (excludes.desc?.length && excludes.desc.includes(l.desc)) return false
    if (excludes.level?.length && excludes.level.includes(l.level)) return false
    if (excludes.rule?.length && excludes.rule.includes(l.rule)) return false
    return true
  })

  const totalLogPages = Math.ceil(filteredLogs.length / LOG_PAGE_SIZE)

  useEffect(() => { setLogPage(1) }, [activeFilters.join(), activeExcludes.join()])

  const severitySource = data?.severity || {}

  const totalEvents = data ? Object.values(data.severity).reduce((a, b) => a + b, 0) : 0
  const maxAgent = data ? Math.max(...data.topAgents.map(a => a.doc_count || 0), 1) : 1

  const controlEvents = useMemo(() => {
    const map = {}
    for (const c of (data?.topControls || [])) {
      map[c.control || c.key] = c.count
    }
    return map
  }, [data])

  const maxControl = Math.max(...Object.values(controlEvents), 1)
  const topControlsByCount = useMemo(() =>
    Object.entries(controlEvents)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count),
    [controlEvents]
  )

  const sevDonut = SEV_ORDER.filter(s => (severitySource[s] || 0) > 0).map(s => ({
    name: s, value: severitySource[s], color: SEV_COLORS[s]
  }))

  const FILTER_STYLES = {
    agent: () => ({ bg: '#58a6ff1a', color: '#58a6ff' }),
    control: () => ({ bg: '#e8681a18', color: '#e8681a' }),
    desc: () => ({ bg: '#3fb95018', color: '#3fb950' }),
    level: () => ({ bg: '#d2992218', color: '#d29922' }),
    rule: () => ({ bg: '#e8681a18', color: '#e8681a' }),
    time: () => ({ bg: '#8b949e18', color: '#8b949e' })
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

  const controlsViolated = topControlsByCount.filter(c => c.count > 0).length
  const topControl = topControlsByCount[0]
  const topControlVal = topControl?.count > 0 ? topControl.id : '--'
  const topControlSub = topControl?.count > 0 ? topControl.id + ' · ' + topControl.count + ' Events' : ''
  const getControlEvents = (id) => controlEvents[id] || 0

  const modalContent = () => {
    if (!modal) return null
    const mKey = modal

    if (mKey.startsWith('log-')) {
      const idx = parseInt(mKey.replace('log-', ''))
      const l = filteredLogs[idx]
      if (!l) return null
      return <LogDetailModal log={l} onClose={closeModal} label="NIST 800-53 Log" />
    }

    if (mKey.startsWith('ctrl-')) {
      const ctrlId = mKey.replace('ctrl-', '')
      const entry = NIST_CONTROLS.find(c => c.id === ctrlId)
      const ev = getControlEvents(ctrlId)
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={closeModal}>
          <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 w-[500px] max-h-[72vh] overflow-y-auto shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">NIST SP 800-53 Control {ctrlId}</span>
              <button onClick={closeModal} className="text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] text-lg leading-none">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">Control</div><div className="text-sm font-bold text-[#e8681a]">{ctrlId}</div></div>
              <div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">Events</div><div className="text-2xl font-bold text-[#f0f6fc]">{ev}</div></div>
            </div>
            <p className="text-xs text-[#36454f] dark:text-[#c9d1d9] leading-relaxed mb-3">{entry?.desc || ctrlId} &mdash; {ev} events detected in this period. Review flagged resources and assess whether compensating controls are required.</p>
            <div className="p-3 rounded-lg text-xs leading-relaxed" style={{ background: '#e8893a18', border: '1px solid #e8893a44', color: '#fdba74' }}>
              <strong>Recommendation:</strong> Investigate all {ev} events tied to {ctrlId}. If this indicates a control failure, update the POA&M and implement corrective actions per NIST SP 800-53.
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
          <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 w-[500px] max-h-[72vh] overflow-y-auto shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">Rule {rid}</span>
              <button onClick={closeModal} className="text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] text-lg leading-none">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">Rule ID</div><div className="text-xl font-bold text-[#e8681a]">{rid}</div></div>
              <div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">Times Fired</div><div className="text-xl font-bold text-[#f0f6fc]">{count}</div></div>
            </div>
            <p className="text-xs text-[#36454f] dark:text-[#c9d1d9] leading-relaxed">{desc} Rule {rid} is among the top triggered rules for NIST 800-53 compliance. High frequency may indicate systemic issues requiring policy or configuration changes.</p>
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
          <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 w-[500px] max-h-[72vh] overflow-y-auto shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">Agent: {aname}</span>
              <button onClick={closeModal} className="text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] text-lg leading-none">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">Agent</div><div className="text-sm font-bold text-[#e8681a]">{aname}</div></div>
              <div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">Total Events</div><div className="text-2xl font-bold text-[#f0f6fc]">{cnt}</div></div>
            </div>
            <p className="text-xs text-[#36454f] dark:text-[#c9d1d9] leading-relaxed">This endpoint generated {cnt} NIST 800-53-relevant events this period. Review event details to determine if they constitute control failures requiring POA&M updates.</p>
          </div>
        </div>
      )
    }

    const md = {
      'm-events': { t: 'NIST 800-53 Events', b: `Total NIST 800-53 events: ${totalEvents.toLocaleString()} across ${data?.topAgents?.length || 0} active agents. Top control: ${topControl?.id || 'N/A'} with ${topControl?.count || 0} events.` },
      'm-crit': { t: 'Critical Violations', b: `Critical violations: ${data?.severity?.Critical || 0}. Immediate action required if any constitute control failures under NIST SP 800-53.` },
      'm-high': { t: 'High Severity Violations', b: `High severity violations: ${data?.severity?.High || 0}. These require prompt investigation to determine if controls were bypassed.` },
      'm-med': { t: 'Medium Severity Violations', b: `Medium severity violations: ${data?.severity?.Medium || 0}. Review and address according to incident response procedures.` },
      'm-assets': { t: 'Monitored Assets', b: `${data?.topAgents?.length || 0} active agents generating NIST 800-53 compliance events.` },
      'm-controls': { t: 'Controls Violated', b: `${controlsViolated} unique NIST 800-53 controls were violated this period: ${topControlsByCount.filter(c => c.count > 0).map(c => c.id).join(', ')}. Each maps to specific requirements under NIST SP 800-53.` },
      'm-top-ctrl': { t: 'Most Active Control', b: topControl ? `Control ${topControl.id} is the most frequently violated control with ${topControl.count} events.` : 'No control violation data available.' }
    }

    const d = md[mKey]
    if (!d) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={closeModal}>
        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 w-[500px] max-h-[72vh] overflow-y-auto shadow-lg" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">{d.t}</span>
            <button onClick={closeModal} className="text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] text-lg leading-none">&times;</button>
          </div>
          <p className="text-xs text-[#36454f] dark:text-[#c9d1d9] leading-relaxed">{d.b}</p>
        </div>
      </div>
    )
  }

  if (loading) return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-xs text-[#8b949e]">Loading NIST 800-53 data...</motion.div>
  if (error) return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-xs text-[#f85149]">Error: {error}</motion.div>

  return (
    <motion.div ref={containerRef} data-export-container initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="p-3">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[11px] text-[#8b949e]">Home / <span className="text-[#e8681a] cursor-pointer">Compliance Management</span> / NIST 800-53</div>
          <div className="text-xl font-bold text-[#1f2328] dark:text-[#f0f6fc] tracking-tight">NIST SP 800-53 Compliance</div>
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
            <button onClick={clearAllFilters} className="text-[10px] px-2 py-0.5 rounded border border-[#d0d7de] dark:border-[#30363d] text-[#8b949e] hover:text-[#f85149] hover:border-[#f85149] transition-all">
              Clear all
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-6 gap-2.5 mb-3">
        {(() => {
          const cards = [
            { key: 'm-events', label: 'NIST 800-53 Events', val: totalEvents.toLocaleString(), icon: 'certificate', iconBg: '#a371f71a', iconColor: '#a371f7' },
            { key: 'm-crit', label: 'Critical Violations', val: (severitySource?.Critical || 0).toLocaleString(), icon: 'alert-triangle', iconBg: '#e0525218', iconColor: '#ff6b6b', valColor: '#ff6b6b', filterField: 'severity', filterValue: 'Critical' },
            { key: 'm-high', label: 'High Severity Violations', val: (severitySource?.High || 0).toLocaleString(), icon: 'alert-circle', iconBg: '#e8893a18', iconColor: '#e8893a', valColor: '#e8893a', filterField: 'severity', filterValue: 'High' },
            { key: 'm-assets', label: 'Monitored Assets', val: data?.topAgents?.length || 0, sub: 'Active agents', icon: 'device-desktop', iconBg: '#58a6ff1a', iconColor: '#58a6ff' },
            { key: 'm-controls', label: 'Controls Violated', val: controlsViolated, sub: 'Unique NIST controls', icon: 'list-check', iconBg: '#3fb95018', iconColor: '#3fb950' },
            { key: 'm-top-ctrl', label: 'Most Active Control', val: topControlVal, sub: topControlSub, icon: 'award', iconBg: '#e8681a18', iconColor: '#e8681a', valColor: '#e8681a', valSize: 'text-base', filterField: 'control', filterValue: topControl?.id || '' },
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

      <div className="grid grid-cols-[1.1fr_0.85fr_1.05fr] gap-2.5 mb-2.5">
        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Events by NIST Control (Top 5)</div>
          {topControlsByCount.slice(0, 5).map(c => {
            const pct = maxControl > 0 ? (c.count / maxControl) * 100 : 0
            return (
              <div key={c.id} className="flex items-center gap-2 mb-1.5 py-1 px-1 rounded hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] text-[11px]">
                <InlineFilter field="control" value={c.id}
                  onInclude={() => setInclude('control', c.id)}
                  onExclude={() => setExclude('control', c.id)}
                  isIncluded={filters.control?.includes(c.id)}
                  isExcluded={excludes.control?.includes(c.id)}
                  className="w-[90px] text-[#36454f] dark:text-[#c9d1d9] font-medium shrink-0">
                  <span className="w-[90px] text-[#36454f] dark:text-[#c9d1d9] font-medium shrink-0">{c.id}</span>
                </InlineFilter>
                <div className="flex-1 h-2 bg-[#d0d7de] dark:bg-[#30363d] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#e8681a,#ff7b2e)' }} />
                </div>
                <span className="w-7 text-right text-[#1f2328] dark:text-[#f0f6fc] font-bold">{c.count}</span>
              </div>
            )
          })}
          {topControlsByCount.slice(0, 5).length === 0 && (
            <div className="text-[10px] text-[#8b949e] text-center py-4">No NIST control data</div>
          )}
          <div className="flex justify-between text-[9px] text-[#8b949e] mt-1.5 px-1">
            <span>0</span><span>{Math.round(maxControl / 4)}</span><span>{Math.round(maxControl / 2)}</span><span>{Math.round(maxControl * 3 / 4)}</span><span>{maxControl}</span>
          </div>
          <div className="text-center text-[10px] text-[#8b949e] mt-0.5">Events</div>
        </div>

        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 flex flex-col shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2">Severity Distribution</div>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {SEV_ORDER.filter(s => sevDonut.find(x => x.name === s)?.value > 0).map(s => {
              const v = sevDonut.find(x => x.name === s)?.value || 0
              return (
                <InlineFilter key={s} field="severity" value={s}
                  onInclude={() => setInclude('severity', s)}
                  onExclude={() => setExclude('severity', s)}
                  isIncluded={filters.severity?.includes(s)}
                  isExcluded={excludes.severity?.includes(s)}
                  className={`flex items-center gap-1.5 text-[11px] rounded px-1 py-0.5 ${filters.severity?.includes(s) ? 'ring-1 ring-[#e8681a]/30 bg-[#e8681a]/5' : ''} ${filters.severity?.length && !filters.severity.includes(s) ? 'opacity-40' : ''}`}>
                  <span className="w-[10px] h-[10px] rounded flex-shrink-0" style={{ background: SEV_COLORS[s] }} />
                  {s} <span className="text-[#8b949e]">{v} ({Math.round((v / (totalEvents || 1)) * 100)}%)</span>
                </InlineFilter>
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

        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2 flex items-center justify-between">
            <span>NIST 800-53 Events Trend</span>

          </div>
          <div className="h-[150px]">
            {data?.timeline?.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={data.timeline}
                  onClick={(e) => {
                    const rt = e?.activePayload?.[0]?.payload?.rawTime
                    if (rt) setTimelineFilter(timelineFilter === rt ? null : rt)
                  }}>
                  <defs><linearGradient id="nistGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e8681a" stopOpacity={0.12} /><stop offset="95%" stopColor="#e8681a" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
                  <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <Area type="monotone" dataKey="count" stroke="#e8681a" fill="url(#nistGrad)" strokeWidth={2.5} dot={{ r: 3, fill: '#e8681a', stroke: isDark ? '#161b22' : '#ffffff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <svg width="200" height="120" viewBox="0 0 200 120" className="opacity-40">
                  <polyline points="10,90 30,75 50,78 70,60 90,50 110,40 130,45 150,30 170,35 190,20" fill="none" stroke="#e8681a" strokeWidth="2.5" />
                  <rect x="10" y="90" width="180" height="40" fill="url(#nistGrad)" opacity="0.1" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Violated Controls</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">#</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Control</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Description</th><th className="text-right py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Events</th></tr></thead>
            <tbody>
              {topControlsByCount.slice(0, 5).map((c, i) => {
                const entry = NIST_CONTROLS.find(r => r.id === c.id)
                return (
                  <tr key={c.id} className="hover:bg-[#f0f2f4] dark:hover:bg-[#21262d]">
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#8b949e]">{i + 1}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                      <InlineFilter field="control" value={c.id}
                        onInclude={() => setInclude('control', c.id)}
                        onExclude={() => setExclude('control', c.id)}
                        isIncluded={filters.control?.includes(c.id)}
                        isExcluded={excludes.control?.includes(c.id)}
                        className="font-semibold text-left">
                        <span className="text-[#e8681a]">{c.id}</span>
                      </InlineFilter>
                    </td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#36454f] dark:text-[#c9d1d9]">{entry?.desc || c.id}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-right font-bold text-[#1f2328] dark:text-[#f0f6fc]">{c.count}</td>
                  </tr>
                )
              })}
              {topControlsByCount.slice(0, 5).length === 0 && (
                <tr><td colSpan={4} className="text-center py-3 text-[10px] text-[#8b949e]">No control data</td></tr>
              )}
            </tbody>
          </table>
          <div className="text-[#e8681a] text-[11px] font-semibold mt-2 cursor-pointer inline-flex items-center gap-1 hover:text-[#ff7b2e]"
            onClick={() => openModal('all-controls')}>View all controls <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
        </div>

        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Agents</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">#</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Agent</th><th className="text-right py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Events</th></tr></thead>
            <tbody>
              {(data?.topAgents || []).slice(0, 5).map((a, i) => {
                const name = a.key || a.agent || a.name || 'Unknown'
                const cnt = a.doc_count || a.events || 0
                const pct = (cnt / maxAgent) * 100
                return (
                  <tr key={name} className="hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] transition-colors">
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#8b949e]">{i + 1}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                      <InlineFilter field="agent" value={name}
                        onInclude={() => setInclude('agent', name)}
                        onExclude={() => setExclude('agent', name)}
                        isIncluded={filters.agent?.includes(name)}
                        isExcluded={excludes.agent?.includes(name)}
                        className={`font-semibold text-left ${filters.agent?.includes(name) ? 'text-[#58a6ff]' : excludes.agent?.includes(name) ? 'text-[#f85149]' : 'text-[#1f2328] dark:text-[#f0f6fc]'}`}>
                        {name}
                      </InlineFilter>
                    </td>
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

        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Rule IDs</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">#</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Rule ID</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Description</th><th className="text-right py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Fired</th></tr></thead>
            <tbody>
              {(data?.topRules || []).slice(0, 5).map((r, i) => {
                const ruleId = r.ruleId || r.key || r.id || ''
                return (
                  <tr key={ruleId || i} className="hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] transition-colors">
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#8b949e]">{i + 1}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                      <InlineFilter field="rule" value={ruleId}
                        onInclude={() => setInclude('rule', ruleId)}
                        onExclude={() => setExclude('rule', ruleId)}
                        isIncluded={filters.rule?.includes(ruleId)}
                        isExcluded={excludes.rule?.includes(ruleId)}
                        className={`font-bold text-left ${filters.rule?.includes(ruleId) ? 'text-[#e8681a] underline' : excludes.rule?.includes(ruleId) ? 'text-[#f85149]' : 'text-[#e8681a]'}`}>
                        {ruleId || '--'}
                      </InlineFilter>
                    </td>
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

      <div className="mb-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc] tracking-tight">NIST 800-53 Event Logs</div>
          <div className="flex items-center gap-1.5">
            <button data-ignore-export onClick={() => { const ts = new Date().toISOString().slice(0,10); exportExcel(filteredLogs, EXPORT_COLS, `nist-logs-${ts}.xlsx`) }}
              className="text-[10px] px-2 py-1 rounded font-medium bg-[#e8eaed] dark:bg-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-all flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Excel
            </button>
            <button data-ignore-export onClick={() => { const ts = new Date().toISOString().slice(0,10); exportPDFReport({ filename: `nist-report-${ts}.pdf`, title: 'NIST 800-53 Event Report', dateRange: `${startDate || 'now-24h'} to ${endDate || 'now'}`, metrics: [{ label: 'Events (24h)', value: (data?.count24 || 0).toLocaleString() }, { label: 'Events (7d)', value: (data?.count7d || 0).toLocaleString() }, { label: 'Active Agents', value: data?.topAgents?.length || 0 }, { label: 'Total Logs', value: filteredLogs.length }], severity: Object.entries(data?.severity || {}).map(([l, c]) => ({ level: l, count: c })), topRules: (data?.topRules || []).map(r => ({ key: r.key || r.ruleId || r.id || '--', count: r.doc_count || r.count || 0 })), topAgents: (data?.topAgents || []).map(a => ({ key: a.key || a.agent || a.name || '--', count: a.doc_count || a.events || 0 })), topArticles: (data?.topControls || []).map(c => ({ key: c.key || c.code || '--', count: c.doc_count || c.count || 0 })), timeline: (data?.timeline || []).map(t => ({ time: t.time, count: t.count })), recentEvents: data?.recent || [], logHeaders: EXPORT_COLS.map(c => c.header.toLowerCase()), logRows: prepareRows(filteredLogs, EXPORT_COLS) }) }}
              className="text-[10px] px-2 py-1 rounded font-medium bg-[#e8eaed] dark:bg-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-all flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              PDF Report
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-[11px] text-[#8b949e]">
            Showing <span className="font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{filteredLogs.length.toLocaleString()}</span> of <span className="font-semibold text-[#1f2328] dark:text-[#f0f6fc]">{(data?.recentTotal || 0).toLocaleString()}</span> logs
            {loadedCount < (data?.recentTotal || 0) && (
              <span className="ml-1.5 text-[#e8681a]">({((data?.recentTotal || 0) - loadedCount).toLocaleString()} remaining)</span>
            )}
          </div>
          <div className="text-[10px] text-[#8b949e]">{logPage} of {totalLogPages} pages</div>
        </div>
        <table className="w-full text-[10px] border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '130px' }} /><col style={{ width: '100px' }} />
            <col style={{ width: '90px' }} /><col style={{ width: '170px' }} />
            <col style={{ width: '50px' }} /><col style={{ width: '60px' }} />
          </colgroup>
          <thead>
            <tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide bg-[#f0f2f4] dark:bg-[#21262d]">
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">Time</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">Agent</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">Control</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">Description</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">Level</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">Rule ID</th>
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
                    className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] ${isExp ? 'bg-[#f6f8fa] dark:bg-[#161b22]' : ''}`}>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                      <InlineFilter field="time" value={l.time}
                        onInclude={() => setInclude('time', l.time)}
                        onExclude={() => setExclude('time', l.time)}
                        isIncluded={filters.time?.includes(l.time)}
                        isExcluded={excludes.time?.includes(l.time)}
                        className={`inline-flex items-center gap-1 text-[#8b949e] ${filters.time?.includes(l.time) ? 'text-[#58a6ff]' : excludes.time?.includes(l.time) ? 'text-[#f85149]' : ''}`}>
                        <span className="text-[10px] w-3">{isExp ? '▾' : '▸'}</span>
                        {l.time}
                      </InlineFilter>
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
                      <InlineFilter field="control" value={l.ctrl}
                        onInclude={() => setInclude('control', l.ctrl)}
                        onExclude={() => setExclude('control', l.ctrl)}
                        isIncluded={filters.control?.includes(l.ctrl)}
                        isExcluded={excludes.control?.includes(l.ctrl)}
                        className={`font-semibold text-left ${filters.control?.includes(l.ctrl) ? 'text-[#58a6ff]' : excludes.control?.includes(l.ctrl) ? 'text-[#f85149]' : 'text-[#e8681a]'}`}>
                        {l.ctrl}
                      </InlineFilter>
                    </td>
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
                      <InlineFilter field="level" value={l.level}
                        onInclude={() => setInclude('level', l.level)}
                        onExclude={() => setExclude('level', l.level)}
                        isIncluded={filters.level?.includes(l.level)}
                        isExcluded={excludes.level?.includes(l.level)}
                        className={`font-semibold text-center ${filters.level?.includes(l.level) ? 'text-[#58a6ff]' : excludes.level?.includes(l.level) ? 'text-[#f85149]' : 'text-[#1f2328] dark:text-[#f0f6fc]'}`}>
                        {l.level}
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
                  </tr>
                  {isExp && l.raw && (
                    <tr>
                      <td colSpan={6} className="p-0 border-b border-[#f0f2f4] dark:border-[#21262d]">
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ duration: 0.15 }}>
                          <div className="bg-[#f6f8fa] dark:bg-[#0d1117] border-t border-[#d0d7de] dark:border-[#30363d]">
                            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#d0d7de] dark:border-[#30363d]">
                              <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); setJsonView(prev => ({ ...prev, [rowId]: false })) }}
                                  className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${!jsonView[rowId] ? 'bg-[#e8681a] text-white' : 'text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]'}`}>Table</button>
                                <button onClick={(e) => { e.stopPropagation(); setJsonView(prev => ({ ...prev, [rowId]: true })) }}
                                  className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${jsonView[rowId] ? 'bg-[#e8681a] text-white' : 'text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]'}`}>JSON</button>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(JSON.stringify(l.raw, null, 2)) }}
                                className="text-[10px] px-2 py-0.5 rounded font-medium bg-[#e8eaed] dark:bg-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-all flex items-center gap-1">
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
                                      <tr key={fi} className="border-b border-[#d0d7de]/30 dark:border-[#30363d]/30 hover:bg-[#f0f2f4] dark:hover:bg-[#161b22]">
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
              <tr><td colSpan={6} className="text-center py-4 text-xs text-[#8b949e]">No matching logs found</td></tr>
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
            {Array.from({ length: Math.min(totalLogPages, 3) }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setLogPage(p)}
                className={`bg-transparent border px-2 py-0.5 rounded text-[11px] min-w-[28px] transition-all ${
                  p === logPage ? 'bg-[#e8681a] text-white border-[#e8681a]' : 'border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a]'
                }`}>{p}</button>
            ))}
            {totalLogPages > 3 && <span className="px-0.5 text-[#8b949e]">...</span>}
            {totalLogPages > 3 && (
              <button onClick={() => setLogPage(totalLogPages)}
                className="bg-transparent border border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[11px] min-w-[28px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a] transition-all">{totalLogPages}</button>
            )}
            <button onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))} disabled={logPage === totalLogPages}
              className="bg-transparent border border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[11px] min-w-[28px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a] disabled:opacity-35 disabled:cursor-default transition-all">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
        {logPage === totalLogPages && loadedCount < (data?.recentTotal || 0) && (
          <div className="flex justify-center py-3 border-t border-[#e5e7eb] dark:border-[#2d3140]">
            <button onClick={loadMoreLogs} disabled={evLoadingMore}
              className="px-4 py-1.5 text-xs font-bold bg-[#e8681a]/10 text-[#e8681a] border border-[#e8681a]/30 rounded-lg hover:bg-[#e8681a]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2">
              {evLoadingMore ? (
                <><svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32" strokeLinecap="round"/></svg> Loading 500 more...</>
              ) : (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg> Load 500 more ({Math.max(0, (data?.recentTotal || 0) - loadedCount)} remaining)</>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="text-center text-[10px] text-[#8b949e] py-3 border-t border-[#d0d7de] dark:border-[#30363d]">&copy; 2025 UniShield 360. All rights reserved.</div>

      <DetailSidebar
        open={sidebar === 'agents'}
        onClose={() => setSidebar(null)}
        onSelectItem={(name) => setInclude('agent', name)}
        items={data?.topAgents || []}
        title="All Agents"
        icon="agent"
        itemLabel="agents"
        accentColor="#58a6ff"
      />
      <DetailSidebar
        open={sidebar === 'controls'}
        onClose={() => setSidebar(null)}
        onSelectItem={(name) => setInclude('control', name)}
        items={Object.keys(controlEvents).map(id => {
          const entry = NIST_CONTROLS.find(r => r.id === id)
          return { key: id, description: entry?.desc || id, doc_count: controlEvents[id] || 0 }
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
        items={data?.topRules || []}
        title="All Rule IDs"
        icon="rule"
        itemLabel="rules"
        accentColor="#d29922"
      />
      {modalContent()}
    </motion.div>
  )
}
