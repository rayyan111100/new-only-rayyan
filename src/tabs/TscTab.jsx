import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import DateRangePicker from '../components/DateRangePicker'
import AssetSidebar from '../components/AssetSidebar'
import LogDetailModal from '../components/LogDetailModal'
import useCompliance from '../hooks/useCompliance'
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const SEV_COLORS = { Critical: '#f85149', High: '#e8681a', Medium: '#d29922', Low: '#3fb950' }
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low']

const TSC_CONTROLS = [
  { ctrl: 'CC6.1', desc: 'Logical Access Controls' },
  { ctrl: 'CC6.8', desc: 'Change Management' },
  { ctrl: 'CC7.2', desc: 'System Operations' },
  { ctrl: 'CC7.3', desc: 'Incident Response' },
  { ctrl: 'PI1.4', desc: 'Information Security' }
]

const LOG_DATA = [
  { time: '2025-05-24 12:15:34', agent: 'suyash-window', rule: '550', ctrl: 'CC6.1', desc: 'Integrity checksum changed.', sev: 'High', event: 'modified', file: 'c:\\users\\smart resource\\...\\vulndetectionlab.jsx', groups: 'syscheck, syscheck_entry_modified' },
  { time: '2025-05-24 12:13:22', agent: 'WIN-DC01', rule: '554', ctrl: 'CC6.8', desc: 'File added to system.', sev: 'Medium', event: 'added', file: 'c:\\windows\\system32\\drivers\\etc\\hosts', groups: 'syscheck, syscheck_file' },
  { time: '2025-05-24 12:11:09', agent: 'SRV-DB01', rule: '553', ctrl: 'CC7.2', desc: 'File deleted from system.', sev: 'Medium', event: 'deleted', file: 'c:\\users\\smart resource\\...\\config.js', groups: 'syscheck, syscheck_file' },
  { time: '2025-05-24 12:10:02', agent: 'linux-server01', rule: '571', ctrl: 'CC7.3', desc: 'User login failed.', sev: 'High', event: 'authentication_failed', file: 'sshd', groups: 'syslog, authentication_failed' },
  { time: '2025-05-24 12:08:47', agent: 'web-server02', rule: '562', ctrl: 'PI1.4', desc: 'User authentication success.', sev: 'Low', event: 'authentication_success', file: 'nginx', groups: 'syslog, authentication_success' },
  { time: '2025-05-24 12:06:22', agent: 'suyash-window', rule: '550', ctrl: 'CC6.1', desc: 'Integrity checksum changed.', sev: 'Critical', event: 'modified', file: 'c:\\program files\\soc2app\\bin\\agent.exe', groups: 'syscheck, syscheck_entry_modified' },
  { time: '2025-05-24 12:04:10', agent: 'WIN-DC01', rule: '554', ctrl: 'CC6.8', desc: 'Unapproved change deployed.', sev: 'Critical', event: 'added', file: 'c:\\deploy\\release\\v2.1.0\\patch.dll', groups: 'syscheck, syscheck_file' },
  { time: '2025-05-24 12:02:44', agent: 'SRV-DB01', rule: '550', ctrl: 'CC6.1', desc: 'Integrity checksum changed.', sev: 'High', event: 'modified', file: '/etc/soc2/access_policy.json', groups: 'syscheck, syscheck_entry_modified' },
  { time: '2025-05-24 12:00:05', agent: 'linux-server01', rule: '571', ctrl: 'CC7.3', desc: 'Multiple login failures.', sev: 'High', event: 'authentication_failed', file: 'sshd', groups: 'syslog, authentication_failed' },
  { time: '2025-05-24 11:58:30', agent: 'web-server02', rule: '553', ctrl: 'CC7.2', desc: 'System log deleted.', sev: 'Critical', event: 'deleted', file: '/var/log/soc2_ops.log', groups: 'syscheck, syscheck_file' },
  { time: '2025-05-24 11:55:12', agent: 'suyash-window', rule: '550', ctrl: 'CC6.1', desc: 'Integrity checksum changed.', sev: 'High', event: 'modified', file: 'c:\\users\\smart resource\\...\\config.xml', groups: 'syscheck, syscheck_entry_modified' },
  { time: '2025-05-24 11:50:33', agent: 'WIN-DC01', rule: '571', ctrl: 'CC7.3', desc: 'User login failed.', sev: 'Medium', event: 'authentication_failed', file: 'Security.evtx', groups: 'syslog, authentication_failed' },
  { time: '2025-05-24 11:45:08', agent: 'linux-server01', rule: '562', ctrl: 'PI1.4', desc: 'Cron job execution.', sev: 'Low', event: 'authentication_success', file: 'cron', groups: 'syslog, authentication_success' },
  { time: '2025-05-24 11:40:22', agent: 'SRV-DB01', rule: '554', ctrl: 'CC6.8', desc: 'Configuration file added.', sev: 'Low', event: 'added', file: '/etc/soc2/monitoring.conf', groups: 'syscheck, syscheck_file' },
  { time: '2025-05-24 11:35:17', agent: 'web-server02', rule: '550', ctrl: 'CC6.1', desc: 'Integrity checksum changed.', sev: 'Medium', event: 'modified', file: '/var/www/html/config.php', groups: 'syscheck, syscheck_entry_modified' },
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

const TSC_TOP_AGENTS = [
  { name: 'suyash-window', events: 91 },
  { name: 'WIN-DC01', events: 61 },
  { name: 'SRV-DB01', events: 37 },
  { name: 'linux-server01', events: 21 },
  { name: 'web-server02', events: 15 }
]

export default function TscTab() {
  const { isDark } = useApp()
  const [modal, setModal] = useState(null)
  const [assetSidebarOpen, setAssetSidebarOpen] = useState(false)
  const [filters, setFilters] = useState({})
  const [logPage, setLogPage] = useState(1)
  const LOG_PAGE_SIZE = 5
  const { data, loading, error, toLogEntry, toSev, refresh } = useCompliance('TSC (SOC 2)')

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
    if (data?.recent?.length) {
      return data.recent.map(toLogEntry)
    }
    return LOG_DATA
  }, [data, toLogEntry])

  const filteredLogs = logEntries.filter(l => {
    if (filters.severity && l.sev !== filters.severity) return false
    if (filters.agent && l.agent !== filters.agent) return false
    if (filters.rule && l.rule !== filters.rule) return false
    return true
  })

  const totalLogPages = Math.ceil(filteredLogs.length / LOG_PAGE_SIZE)

  useEffect(() => { setLogPage(1) }, [activeFilters.join()])

  const totalEvents = data ? Object.values(data.severity).reduce((a, b) => a + b, 0) : 225
  const maxAgent = data ? Math.max(...data.topAgents.map(a => a.doc_count || 0), 1) : 91
  const maxControl = Math.max(...TSC_CONTROLS.map(c => c.ctrl === 'CC6.1' ? 42 : c.ctrl === 'CC6.8' ? 28 : c.ctrl === 'CC7.2' ? 18 : c.ctrl === 'CC7.3' ? 14 : 11), 1)

  const sevDonut = [
    { name: 'Critical', value: data?.severity?.Critical || 10, color: SEV_COLORS.Critical },
    { name: 'High', value: data?.severity?.High || 36, color: SEV_COLORS.High },
    { name: 'Medium', value: data?.severity?.Medium || 81, color: SEV_COLORS.Medium },
    { name: 'Low', value: data?.severity?.Low || 98, color: SEV_COLORS.Low }
  ].filter(s => s.value > 0)

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

  const getControlEvents = (ctrl) => {
    const map = { 'CC6.1': 42, 'CC6.8': 28, 'CC7.2': 18, 'CC7.3': 14, 'PI1.4': 11 }
    return map[ctrl] || 0
  }

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
          <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 w-[500px] max-h-[72vh] overflow-y-auto shadow-lg" onClick={e => e.stopPropagation()}>
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
      const rules = { '550': { desc: 'Integrity checksum changed.', count: 34 }, '554': { desc: 'File added to system.', count: 22 }, '553': { desc: 'File deleted from system.', count: 18 }, '571': { desc: 'User login failed.', count: 16 }, '562': { desc: 'User authentication success.', count: 12 } }
      const rid = mKey.replace('rule-', '')
      const r = rules[rid]
      if (!r) return null
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={closeModal}>
          <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 w-[500px] max-h-[72vh] overflow-y-auto shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">Rule {rid}</span>
              <button onClick={closeModal} className="text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] text-lg leading-none">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">Rule ID</div><div className="text-xl font-bold text-[#e8681a]">{rid}</div></div>
              <div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">Times Fired</div><div className="text-xl font-bold text-[#f0f6fc]">{r.count}</div></div>
            </div>
            <p className="text-xs text-[#36454f] dark:text-[#c9d1d9] leading-relaxed">{r.desc} Rule {rid} is among the top triggered rules for SOC 2 compliance. Each event requires investigation and documentation for audit evidence.</p>
          </div>
        </div>
      )
    }

    if (mKey.startsWith('ag-')) {
      const agents = { 'suyash-window': 91, 'WIN-DC01': 61, 'SRV-DB01': 37, 'linux-server01': 21, 'web-server02': 15 }
      const aname = mKey.replace('ag-', '')
      const cnt = agents[aname]
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
            <p className="text-xs text-[#36454f] dark:text-[#c9d1d9] leading-relaxed">This endpoint generated {cnt} SOC 2-relevant events this period. Under TSC criteria, these events may impact the audit opinion on control effectiveness.</p>
          </div>
        </div>
      )
    }

    const md = {
      'm-events': { t: 'SOC 2 Events', b: `Total TSC (SOC 2) events: ${totalEvents.toLocaleString()} across 19 monitored assets this week. Top control: CC6.1 (Logical Access Controls) with 42 events. Low and Medium severities represent 80% of total volume.` },
      'm-crit': { t: 'Critical Violations', b: `Critical violations: ${data?.severity?.Critical || 10}. Immediate action required. Unapproved deployment on WIN-DC01 (CC6.8) and system log deletion on web-server02 (CC7.2) may require escalation to your SOC 2 auditor.` },
      'm-high': { t: 'High Severity Violations', b: `High severity violations: ${data?.severity?.High || 36}. These require prompt investigation to ensure controls are operating effectively.` },
      'm-assets': { t: 'Monitored Assets', b: `${data?.topAgents?.length || 5} active agents generating SOC 2 compliance events out of 19 total monitored assets.` },
      'm-controls': { t: 'Controls Violated', b: `5 unique SOC 2 controls were violated this period: ${TSC_CONTROLS.map(c => c.ctrl).join(', ')}. Each maps to specific TSC criteria under the SOC 2 framework.` },
      'm-top-ctrl': { t: 'Most Active Control', b: 'CC6.1 (Logical Access Controls) is the most frequently violated control with 42 events. CC6.1 requires logical access security measures to protect against threats from outside the system boundaries.' }
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

  if (loading) return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-xs text-[#8b949e]">Loading TSC (SOC 2) data...</motion.div>
  if (error) return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-xs text-[#f85149]">Error: {error}</motion.div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="p-3">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[11px] text-[#8b949e]">Home / <span className="text-[#e8681a] cursor-pointer" onClick={() => openModal('go-overview')}>Compliance Management</span> / TSC (SOC 2)</div>
          <div className="text-xl font-bold text-[#1f2328] dark:text-[#f0f6fc] tracking-tight">TSC (SOC 2) Compliance</div>
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

      {/* Metric Cards */}
      <div className="grid grid-cols-6 gap-2.5 mb-3">
        {[
          { key: 'm-events', label: 'SOC 2 Events', val: totalEvents.toLocaleString(), change: '20%', up: true, icon: 'certificate', iconBg: '#a371f71a', iconColor: '#a371f7' },
          { key: 'm-crit', label: 'Critical Violations', val: (data?.severity?.Critical || 10).toLocaleString(), change: '11%', up: true, icon: 'alert-triangle', iconBg: '#e0525218', iconColor: '#ff6b6b', valColor: '#ff6b6b' },
          { key: 'm-high', label: 'High Severity Violations', val: (data?.severity?.High || 36).toLocaleString(), change: '15%', up: true, icon: 'alert-circle', iconBg: '#e8893a18', iconColor: '#e8893a', valColor: '#e8893a' },
          { key: 'm-assets', label: 'Monitored Assets', val: data?.topAgents?.length || 5, sub: 'Active agents', icon: 'device-desktop', iconBg: '#58a6ff1a', iconColor: '#58a6ff' },
          { key: 'm-controls', label: 'Controls Violated', val: TSC_CONTROLS.length, sub: 'Unique SOC 2 controls', icon: 'list-check', iconBg: '#3fb95018', iconColor: '#3fb950' },
          { key: 'm-top-ctrl', label: 'Most Active Control', val: TSC_CONTROLS[0].ctrl, sub: TSC_CONTROLS[0].desc + ' · 42 Events', icon: 'award', iconBg: '#e8681a18', iconColor: '#e8681a', valColor: '#e8681a', valSize: 'text-base' },
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
            {card.change && <div className="text-[10px] font-semibold mt-0.5" style={{ color: card.up ? '#3fb950' : '#f85149' }}>{card.up ? '↑' : '↓'} {card.change} vs last 7 days</div>}
            {card.sub && <div className="text-[10px] text-[#8b949e] mt-0.5">{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* Tri Row */}
      <div className="grid grid-cols-[1.1fr_0.85fr_1.05fr] gap-2.5 mb-2.5">
        {/* Events by SOC 2 Control */}
        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
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

        {/* Trend */}
        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2 flex items-center justify-between">
            <span>SOC 2 Events Trend</span>
            <span className="text-[10px] text-[#8b949e] bg-[#f0f2f4] dark:bg-[#21262d] px-2 py-0.5 rounded font-medium normal-case cursor-pointer hover:bg-[#e5e7eb] dark:hover:bg-[#2d3140]">
              Last 7 Days <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline ml-0.5"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
          <div className="h-[150px]">
            {data?.timeline?.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={data.timeline}>
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
            <span>May 18</span><span>May 19</span><span>May 20</span><span>May 21</span><span>May 22</span><span>May 23</span><span>May 24</span>
          </div>
        </div>
      </div>

      {/* Three Table Row */}
      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        {/* Top Violated Controls */}
        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Violated Controls</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">#</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Control</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Description</th><th className="text-right py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Events</th></tr></thead>
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
        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Agents</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">#</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Agent</th><th className="text-right py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Events</th></tr></thead>
            <tbody>
              {(data?.topAgents?.length ? data.topAgents.slice(0, 5) : TSC_TOP_AGENTS).map((a, i) => {
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

        {/* Top Rule IDs */}
        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-3 shadow-lg transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40">
          <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5">Top Rule IDs</div>
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide"><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">#</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Rule ID</th><th className="text-left py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Description</th><th className="text-right py-1 px-2 border-b border-[#d0d7de] dark:border-[#30363d]">Fired</th></tr></thead>
            <tbody>
              {[
                { id: '550', desc: 'Integrity checksum changed.', count: 34 },
                { id: '554', desc: 'File added to system.', count: 22 },
                { id: '553', desc: 'File deleted from system.', count: 18 },
                { id: '571', desc: 'User login failed.', count: 16 },
                { id: '562', desc: 'User authentication success.', count: 12 },
              ].map((r, i) => (
                <tr key={r.id} onClick={() => setFilter('rule', r.id)}
                  className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] transition-colors ${filters.rule === r.id ? 'bg-[#e8681a]/5 ring-1 ring-inset ring-[#e8681a]/30' : ''}`}>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#8b949e]">{i + 1}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#e8681a] font-bold">{r.id}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#36454f] dark:text-[#c9d1d9]">{r.desc}</td>
                  <td className="py-1 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-right font-bold text-[#1f2328] dark:text-[#f0f6fc]">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[#e8681a] text-[11px] font-semibold mt-2 cursor-pointer inline-flex items-center gap-1 hover:text-[#ff7b2e]"
            onClick={() => openModal('all-rules')}>View all rules <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
        </div>
      </div>

      {/* SOC 2 Event Logs */}
      <div className="mb-3">
        <div className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc] mb-2.5 tracking-tight">SOC 2 Event Logs</div>
        <table className="w-full text-[10px] border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '110px' }} /><col style={{ width: '100px' }} /><col style={{ width: '55px' }} />
            <col style={{ width: '65px' }} /><col style={{ width: '145px' }} /><col style={{ width: '90px' }} />
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
              return (
                <tr key={idx} onClick={() => openModal('log-' + idx)}
                  className="cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#21262d]">
                  <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#8b949e]">{l.time}</td>
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
