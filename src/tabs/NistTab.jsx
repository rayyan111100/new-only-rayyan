import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import DateRangePicker from '../components/DateRangePicker'
import AssetSidebar from '../components/AssetSidebar'
import LogDetailModal from '../components/LogDetailModal'
import useCompliance from '../hooks/useCompliance'
import { exportExcel, exportPDFReport, prepareRows } from '../utils/exportLogs'
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const SEV_COLORS = { Critical: '#f85149', High: '#e8681a', Medium: '#d29922', Low: '#3fb950' }
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low']

const EXPORT_COLS = [
  { header: 'Time', accessor: 'time' }, { header: 'Agent', accessor: 'agent' },
  { header: 'Rule', accessor: 'rule' }, { header: 'Severity', accessor: 'sev' },
  { header: 'Description', accessor: 'desc' }, { header: 'Event', accessor: 'event' },
  { header: 'Control', accessor: 'ctrl' }, { header: 'File', accessor: 'file' },
  { header: 'Groups', accessor: 'groups' },
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
  const { isDark, startDate } = useApp()
  const [modal, setModal] = useState(null)
  const [assetSidebarOpen, setAssetSidebarOpen] = useState(false)
  const [filters, setFilters] = useState({})
  const [logPage, setLogPage] = useState(1)
  const [expandedRow, setExpandedRow] = useState({})
  const [jsonView, setJsonView] = useState({})
  const containerRef = useRef(null)
  const LOG_PAGE_SIZE = 5
  const { data, loading, error, toLogEntry, toSev, refresh } = useCompliance('NIST 800-53')
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

  const logEntries = useMemo(() => {
    return (data?.recent || []).map(r => ({ ...toLogEntry(r), raw: r }))
  }, [data, toLogEntry])

  const filteredLogs = logEntries.filter(l => {
    if (filters.severity && l.sev !== filters.severity) return false
    if (filters.agent && l.agent !== filters.agent) return false
    if (filters.rule && l.rule !== filters.rule) return false
    return true
  })

  const totalLogPages = Math.ceil(filteredLogs.length / LOG_PAGE_SIZE)

  useEffect(() => { setLogPage(1) }, [activeFilters.join()])

  const totalEvents = data ? Object.values(data.severity).reduce((a, b) => a + b, 0) : 0
  const maxAgent = data ? Math.max(...data.topAgents.map(a => a.doc_count || 0), 1) : 1

  const controlEvents = useMemo(() => {
    const map = {}
    if (data?.topRules) {
      data.topRules.forEach(r => {
        const ctrl = r.control || ''
        if (ctrl && NIST_CONTROLS.some(c => c.id === ctrl)) {
          map[ctrl] = (map[ctrl] || 0) + (r.count || 0)
        }
      })
    }
    if (Object.keys(map).length === 0 && data?.recent) {
      data.recent.forEach(r => {
        const entry = toLogEntry(r)
        if (entry.ctrl && NIST_CONTROLS.some(c => c.id === entry.ctrl)) {
          map[entry.ctrl] = (map[entry.ctrl] || 0) + 1
        }
      })
    }
    NIST_CONTROLS.forEach(c => { if (!map[c.id]) map[c.id] = 0 })
    return map
  }, [data, toLogEntry])

  const maxControl = Math.max(...Object.values(controlEvents), 1)

  const sevDonut = SEV_ORDER.filter(s => (data?.severity?.[s] || 0) > 0).map(s => ({
    name: s, value: data.severity[s], color: SEV_COLORS[s]
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
    if (k === 'm-assets') { setAssetSidebarOpen(true); return }
    const sevMap = { 'm-crit': 'Critical', 'm-high': 'High' }
    if (sevMap[k]) { setFilter('severity', sevMap[k]); return }
    setModal(k)
  }

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
      const control = NIST_CONTROLS.find(c => c.id === ctrlId)
      if (!control) return null
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
            <p className="text-xs text-[#36454f] dark:text-[#c9d1d9] leading-relaxed mb-3">{control.desc} &mdash; {ev} events detected in this period. Review flagged resources and assess whether compensating controls are required.</p>
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

    const topControl = NIST_CONTROLS.map(c => ({ ...c, ev: getControlEvents(c.id) })).sort((a, b) => b.ev - a.ev)[0]
    const md = {
      'm-events': { t: 'NIST 800-53 Events', b: `Total NIST 800-53 events: ${totalEvents.toLocaleString()} across ${data?.topAgents?.length || 0} active agents. Top control: ${topControl?.id || 'N/A'} with ${topControl?.ev || 0} events.` },
      'm-crit': { t: 'Critical Violations', b: `Critical violations: ${data?.severity?.Critical || 0}. Immediate action required if any constitute control failures under NIST SP 800-53.` },
      'm-high': { t: 'High Severity Violations', b: `High severity violations: ${data?.severity?.High || 0}. These require prompt investigation to determine if controls were bypassed.` },
      'm-med': { t: 'Medium Severity Violations', b: `Medium severity violations: ${data?.severity?.Medium || 0}. Review and address according to incident response procedures.` },
      'm-assets': { t: 'Monitored Assets', b: `${data?.topAgents?.length || 0} active agents generating NIST 800-53 compliance events.` },
      'm-controls': { t: 'Controls Violated', b: `${NIST_CONTROLS.filter(c => getControlEvents(c.id) > 0).length} unique NIST 800-53 controls were violated this period: ${NIST_CONTROLS.filter(c => getControlEvents(c.id) > 0).map(c => c.id).join(', ')}. Each maps to specific requirements under NIST SP 800-53.` },
      'm-top-ctrl': { t: 'Most Active Control', b: topControl ? `Control ${topControl.id} (${topControl.desc}) is the most frequently violated control with ${topControl.ev} events.` : 'No control violation data available.' }
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
          <button onClick={() => refresh()} className="p-1.5 rounded border border-transparent hover:bg-[#21262d] text-[#8b949e] hover:text-[#e8681a] transition-colors">
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

      <div className="grid grid-cols-6 gap-2.5 mb-3">
        {[
          { key: 'm-events', label: 'NIST 800-53 Events', val: totalEvents.toLocaleString(), icon: 'certificate', iconBg: '#a371f71a', iconColor: '#a371f7' },
          { key: 'm-crit', label: 'Critical Violations', val: (data?.severity?.Critical || 0).toLocaleString(), icon: 'alert-triangle', iconBg: '#e0525218', iconColor: '#ff6b6b', valColor: '#ff6b6b' },
          { key: 'm-high', label: 'High Severity Violations', val: (data?.severity?.High || 0).toLocaleString(), icon: 'alert-circle', iconBg: '#e8893a18', iconColor: '#e8893a', valColor: '#e8893a' },
          { key: 'm-assets', label: 'Monitored Assets', val: data?.topAgents?.length || 0, sub: 'Active agents', icon: 'device-desktop', iconBg: '#58a6ff1a', iconColor: '#58a6ff' },
          { key: 'm-controls', label: 'Controls Violated', val: NIST_CONTROLS.length, sub: 'Unique NIST controls', icon: 'list-check', iconBg: '#3fb95018', iconColor: '#3fb950' },
          { key: 'm-top-ctrl', label: 'Most Active Control', val: (() => { const top = NIST_CONTROLS.map(c => ({ ...c, ev: getControlEvents(c.id) })).sort((a, b) => b.ev - a.ev)[0]; return top ? top.id : '--' })(), sub: (() => { const top = NIST_CONTROLS.map(c => ({ ...c, ev: getControlEvents(c.id) })).sort((a, b) => b.ev - a.ev)[0]; return top ? top.desc + ' · ' + top.ev + ' Events' : '' })(), icon: 'award', iconBg: '#e8681a18', iconColor: '#e8681a', valColor: '#e8681a', valSize: 'text-base' },
        ].map(card => (
          <div key={card.key} onClick={() => openModal(card.key)}
            className={`bg-white dark:bg-[#161b22] border rounded-xl p-3 cursor-pointer transition-all duration-300 hover:-translate-y-[3px] shadow-lg hover:shadow-[0_8px_25px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] ${
              (card.key === 'm-crit' && filters.severity === 'Critical') || (card.key === 'm-high' && filters.severity === 'High')
                ? 'border-[#e8681a] dark:border-[#e8681a] ring-1 ring-[#e8681a]/30'
                : 'border-[#d0d7de] dark:border-[#30363d] hover:border-[#e8681a]/50 dark:hover:border-[#e8681a]/60'
            }`}>
            <div className="float-right w-[34px] h-[34px] rounded-lg flex items-center justify-center text-lg" style={{ background: card.iconBg }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={card.iconColor} strokeWidth="2">
                {card.icon === 'certificate' && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></>}
                {card.icon === 'alert-triangle' && <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>}
                {card.icon === 'alert-circle' && <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
                {card.icon === 'device-desktop' && <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>}
                {card.icon === 'list-check' && <><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/></>}
                {card.icon === 'award' && <><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></>}
              </svg>
            </div>
            <div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-1 clear-both">{card.label}</div>
            <div className={`text-2xl font-bold text-[#1f2328] dark:text-[#f0f6fc] ${card.valSize || ''} tracking-tight`} style={card.valColor ? { color: card.valColor } : undefined}>{card.val}</div>
            {card.sub && <div className="text-[10px] text-[#8b949e] mt-0.5">{card.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1.1fr_0.85fr_1.05fr] gap-2.5 mb-2.5">
        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Events by NIST Control (Top 5)</div>
          {NIST_CONTROLS.map(c => {
            const ev = getControlEvents(c.id)
            const pct = (ev / maxControl) * 100
            return (
              <div key={c.id} onClick={() => openModal('ctrl-' + c.id)}
                className="flex items-center gap-2 mb-1.5 py-1 px-1 rounded hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] cursor-pointer text-[11px]">
                <span className="w-[90px] text-[#36454f] dark:text-[#c9d1d9] font-medium shrink-0">{c.id}</span>
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

        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 flex flex-col shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2">Severity Distribution</div>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {SEV_ORDER.filter(s => sevDonut.find(x => x.name === s)?.value > 0).map(s => {
              const v = sevDonut.find(x => x.name === s)?.value || 0
              return (
                <span key={s} onClick={() => setFilter('severity', s)}
                  className={`flex items-center gap-1.5 text-[11px] cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] ${filters.severity === s ? 'ring-1 ring-[#e8681a]/30 bg-[#e8681a]/5' : ''} ${filters.severity && filters.severity !== s ? 'opacity-40' : ''}`}>
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

        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2 flex items-center justify-between">
            <span>NIST 800-53 Events Trend</span>
            <span className="text-[10px] text-[#8b949e] bg-[#f0f2f4] dark:bg-[#21262d] px-2 py-0.5 rounded font-medium normal-case">
              {startDate === 'now-24h' ? 'Last 24 Hours' : startDate === 'now-7d' ? 'Last 7 Days' : startDate === 'now-30d' ? 'Last 30 Days' : startDate === 'now-90d' ? 'Last 90 Days' : startDate || 'Last 7 Days'}
            </span>
          </div>
          <div className="h-[150px]">
            {data?.timeline?.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={data.timeline}>
                  <defs><linearGradient id="nistGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e8681a" stopOpacity={0.12} /><stop offset="95%" stopColor="#e8681a" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
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
          <div className="flex justify-between text-[9px] text-[#8b949e] mt-1 px-0.5">
            {(data?.timeline || []).slice(0, 7).map((t, i) => <span key={i}>{t.time}</span>)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Violated Controls</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">#</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Control</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Description</th><th className="text-right py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Events</th></tr></thead>
            <tbody>
              {NIST_CONTROLS.map((c, i) => {
                const ev = getControlEvents(c.id)
                return (
                  <tr key={c.id} onClick={() => openModal('ctrl-' + c.id)} className="cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#21262d]">
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#8b949e]">{i + 1}</td>
                    <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#e8681a] font-semibold">{c.id}</td>
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
                  <tr key={name} onClick={() => setFilter('agent', name)}
                    className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] transition-colors ${filters.agent === name ? 'bg-[#58a6ff]/5 ring-1 ring-inset ring-[#58a6ff]/30' : ''}`}>
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

        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Rule IDs</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">#</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Rule ID</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Description</th><th className="text-right py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Fired</th></tr></thead>
            <tbody>
              {(data?.topRules || []).slice(0, 5).map((r, i) => {
                const ruleId = r.ruleId || r.key || r.id || ''
                return (
                  <tr key={ruleId || i} onClick={() => setFilter('rule', ruleId)}
                    className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] transition-colors ${filters.rule === ruleId ? 'bg-[#e8681a]/5 ring-1 ring-inset ring-[#e8681a]/30' : ''}`}>
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

      <div className="mb-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc] tracking-tight">NIST 800-53 Event Logs</div>
          <div className="flex items-center gap-1.5">
            <button data-ignore-export onClick={() => { const ts = new Date().toISOString().slice(0,10); exportExcel(filteredLogs, EXPORT_COLS, `nist-logs-${ts}.xlsx`) }}
              className="text-[10px] px-2 py-1 rounded font-medium bg-[#e8eaed] dark:bg-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-all flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Excel
            </button>
            <button data-ignore-export onClick={() => { const ts = new Date().toISOString().slice(0,10); exportPDFReport({ filename: `nist-report-${ts}.pdf`, title: 'NIST 800-53 Event Report', dateRange: `${startDate || 'now-24h'} to ${endDate || 'now'}`, metrics: [{ label: 'Events (24h)', value: (data?.count24 || 0).toLocaleString() }, { label: 'Events (7d)', value: (data?.count7d || 0).toLocaleString() }, { label: 'Alert Sources', value: data?.topAgents?.length || 0 }, { label: 'Total Logs', value: filteredLogs.length }], severity: Object.entries(data?.severity || {}).map(([l, c]) => ({ level: l, count: c })), topRules: (data?.topRules || []).map(r => ({ key: r.key || r.ruleId || r.id || '--', count: r.doc_count || r.count || 0 })), topAgents: (data?.topAgents || []).map(a => ({ key: a.key || a.agent || a.name || '--', count: a.doc_count || a.events || 0 })), topArticles: (data?.topControls || []).map(c => ({ key: c.key || c.code || '--', count: c.doc_count || c.count || 0 })), timeline: (data?.timeline || []).map(t => ({ time: t.time, count: t.count })), logHeaders: EXPORT_COLS.map(c => c.header.toLowerCase()), logRows: prepareRows(filteredLogs, EXPORT_COLS) }) }}
              className="text-[10px] px-2 py-1 rounded font-medium bg-[#e8eaed] dark:bg-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-all flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              PDF Report
            </button>
          </div>
        </div>
        <table className="w-full text-[10px] border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '110px' }} /><col style={{ width: '100px' }} /><col style={{ width: '55px' }} />
            <col style={{ width: '75px' }} /><col style={{ width: '145px' }} /><col style={{ width: '90px' }} />
            <col style={{ width: '100px' }} /><col style={{ width: '150px' }} /><col style={{ width: '165px' }} />
          </colgroup>
          <thead>
            <tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide bg-[#f0f2f4] dark:bg-[#21262d]">
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">Time</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">Agent</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">Rule</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">Control</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">Description</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">Severity</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">Event</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">File / Resource</th>
              <th className="text-left py-1.5 px-2 border-b-2 border-[#d0d7de] dark:border-[#30363d]">Groups</th>
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
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#8b949e]">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[10px] w-3">{isExp ? '▾' : '▸'}</span>
                        {l.time}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                      <button onClick={(e) => { e.stopPropagation(); setFilter('agent', l.agent) }}
                        className={`font-semibold text-left hover:underline ${filters.agent === l.agent ? 'text-[#58a6ff]' : 'text-[#1f2328] dark:text-[#f0f6fc]'}`}>
                        {l.agent}
                      </button>
                    </td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                      <button onClick={(e) => { e.stopPropagation(); setFilter('rule', l.rule) }}
                        className={`font-bold text-left hover:underline ${filters.rule === l.rule ? 'text-[#e8681a] underline' : 'text-[#e8681a]'}`}>
                        {l.rule}
                      </button>
                    </td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] font-semibold text-[#e8681a]">{l.ctrl}</td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#36454f] dark:text-[#c9d1d9] overflow-hidden text-ellipsis whitespace-nowrap">{l.desc}</td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                      <button onClick={(e) => { e.stopPropagation(); setFilter('severity', l.sev) }}><SevBadge s={l.sev} /></button>
                    </td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#e8681a] font-medium">{l.event}</td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#8b949e] text-[9px] overflow-hidden text-ellipsis whitespace-nowrap">{l.file}</td>
                    <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#e8681a] text-[9px] font-medium overflow-hidden text-ellipsis whitespace-nowrap">{l.groups}</td>
                  </tr>
                  {isExp && l.raw && (
                    <tr>
                      <td colSpan={9} className="p-0 border-b border-[#f0f2f4] dark:border-[#21262d]">
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
              <tr><td colSpan={9} className="text-center py-4 text-xs text-[#8b949e]">No matching logs found</td></tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between mt-2.5 flex-wrap gap-2">
          <div className="text-[#e8681a] text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 hover:text-[#ff7b2e]"
            onClick={() => openModal('all-logs')}>View all logs <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
          <div className="flex items-center gap-1 text-[11px] text-[#8b949e]">
            <span className="mr-1">{(logPage - 1) * LOG_PAGE_SIZE + 1}-{Math.min(logPage * LOG_PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length}</span>
            <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}
              className="bg-transparent border border-[#d0d7de] dark:border-[#30363d] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[11px] min-w-[28px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a] disabled:opacity-35 disabled:cursor-default transition-all">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            {Array.from({ length: Math.min(totalLogPages, 3) }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setLogPage(p)}
                className={`bg-transparent border px-2 py-0.5 rounded text-[11px] min-w-[28px] transition-all ${
                  p === logPage ? 'bg-[#e8681a] text-white border-[#e8681a]' : 'border-[#d0d7de] dark:border-[#30363d] text-[#36454f] dark:text-[#c9d1d9] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a]'
                }`}>{p}</button>
            ))}
            {totalLogPages > 3 && <span className="px-0.5 text-[#8b949e]">...</span>}
            {totalLogPages > 3 && (
              <button onClick={() => setLogPage(totalLogPages)}
                className="bg-transparent border border-[#d0d7de] dark:border-[#30363d] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[11px] min-w-[28px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a] transition-all">{totalLogPages}</button>
            )}
            <button onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))} disabled={logPage === totalLogPages}
              className="bg-transparent border border-[#d0d7de] dark:border-[#30363d] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[11px] min-w-[28px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a] disabled:opacity-35 disabled:cursor-default transition-all">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="text-center text-[10px] text-[#8b949e] py-3 border-t border-[#d0d7de] dark:border-[#30363d]">&copy; 2025 UniShield 360. All rights reserved.</div>

      <AssetSidebar
        open={assetSidebarOpen}
        onClose={() => setAssetSidebarOpen(false)}
        onSelectAgent={(name) => setFilter('agent', name)}
        agents={data?.topAgents || []}
        title="Monitored Assets"
      />
      {modalContent()}
    </motion.div>
  )
}