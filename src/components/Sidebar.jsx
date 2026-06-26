import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const NAV_SECTIONS = [
  { key: 'discover', label: 'Raw Event Viewer', icon: 'search' },
  {
    key: 'dashboard', label: 'Dashboard', icon: 'dashboard',
    children: [
      { key: 'customdashboard', label: 'Dashboard', icon: 'dashboard' },
      { key: 'dashboard-new', label: 'Dashboard-New', icon: 'monitor' },
    ]
  },
  {
    key: 'securityhub', label: 'Security Operations', icon: 'security',
    children: [
      { key: 'securityhub', label: 'Overview', icon: 'dashboard' },
      { key: 'securityevents', label: 'Security Events', icon: 'shieldCheck' },
      { key: 'vulnerabilitydetection', label: 'Vulnerability Detection', icon: 'alert' },
      { key: 'malwaredetection', label: 'Malware Detection', icon: 'bug' },
      { key: 'fim', label: 'FIM', icon: 'file' },
      { key: 'windowsevent', label: 'Windows Event', icon: 'monitor' },
      { key: 'incidentmanagement', label: 'Incident Management', icon: 'alert' },
    ]
  },
  {
    key: 'noc', label: 'NOC', icon: 'wifi',
    children: [
      { key: 'aim', label: 'AIM', icon: 'server' },
      { key: 'infrastructurehealth', label: 'Infrastructure Health', icon: 'health' },
      { key: 'dtm', label: 'DTM', icon: 'clock' },
    ]
  },
  {
    key: 'compliance', label: 'Compliance/Framework Managment', icon: 'compliance',
    children: [
      { key: 'compliance', label: 'Overview', icon: 'barChart' },
      { key: 'pcidss', label: 'PCI-DSS', icon: 'lock' },
      { key: 'hipaa', label: 'HIPAA', icon: 'activity' },
      { key: 'gdpr', label: 'GDPR', icon: 'globe' },
      { key: 'tsc', label: 'TSC (SOC 2)', icon: 'shieldCheck' },
      { key: 'nist80053', label: 'NIST 800-53', icon: 'shieldCheck' },
      { key: 'cisbenchmark', label: 'CIS Benchmark', icon: 'checklist' },
      { key: 'mitreattack', label: 'MITRE ATT&CK', icon: 'target' },
    ]
  },
  {
    key: 'cspm', label: 'CSPM', icon: 'cloud',
    children: [
      { key: 'docker', label: 'Docker', icon: 'docker' },
      { key: 'aws', label: 'AWS', icon: 'aws' },
      { key: 'gcp', label: 'GCP', icon: 'gcp' },
      { key: 'github', label: 'GitHub', icon: 'github' },
      { key: 'office365', label: 'Office 365', icon: 'office365' },
    ]
  },
  {
    key: 'rules', label: 'Rules', icon: 'settings',
    children: [
      { key: 'createrule', label: 'Create Rule', icon: 'create' },
      { key: 'rulegroups', label: 'Groups', icon: 'groups' },

      { key: 'ruleview', label: 'Rule View', icon: 'visibility' },
      { key: 'ruleguide', label: 'Rule Guide', icon: 'book' },
    ]
  },
  { key: 'decoder', label: 'Decoder', icon: 'decode' },
]

const ICONS = {
  search: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z',
  dashboard: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z',
  security: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  health: 'M22 12h-4l-3 9L9 3l-3 9H2',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zm0 0V3m0 18v-3m-9.54-3.46l2.12-2.12m12.72-12.72l2.12 2.12M3 12h3m12 0h3M4.93 19.07l2.12-2.12m12.72 0l2.12 2.12',
  groups: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8zm10 6v2h-3m-1-10a4 4 0 000 7.75',
  assignment: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  compliance: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  visibility: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm10 0a1 1 0 112 0 1 1 0 01-2 0z',
  decode: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  book: 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
  create: 'M12 5v14M5 12h14',
  vulnerability: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4m0 4h.01',
  monitor: 'M2 3h20v14H2V3zm6 18h8m-4-4v4',
  server: 'M2 2h20v8H2V2zm0 12h20v8H2v-8zm4-8h.01M6 18h.01',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zm0-18v8l4 4',
  alert: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01',
  bug: 'M8 2h8v4H8V2zM4 8h16M4 8v8a4 4 0 004 4h8a4 4 0 004-4V8M8 12h8',
  file: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6',
  lock: 'M3 11h18v11H3V11zm4 0V7a5 5 0 0110 0v4',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  globe: 'M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z',
  target: 'M12 22a10 10 0 100-20 10 10 0 000 20zm0-6a4 4 0 100-8 4 4 0 000 8zm0-4a0 0 0 000 0v0z',
  barChart: 'M18 20V10m-6 10V4M6 20v-6',
  terminal: 'M4 17l6-6-6-6m8 14h8',
  shieldCheck: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  database: 'M12 2a9 3 0 000 6 9 3 0 000-6zm0 0v18m9-15v12M3 5v12m0-6h18',
  wifi: 'M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20a1 1 0 100-2 1 1 0 000 2z',
  cloud: 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',
  checklist: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  docker: 'M4 17l6-6-6-6m8 14h8',
  aws: 'M12 2a9 3 0 000 6 9 3 0 000-6zm0 0v18m9-15v12M3 5v12m0-6h18',
  gcp: 'M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z',
  github: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22',
  office365: 'M6.5 2h11l3 8-8.5 12L3 10l3.5-8z',
}

function NavIcon({ icon, className }) {
  const d = ICONS[icon]
  if (!d) return null
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={d} /></svg>
}

function isChildActive(active, item) {
  if (item.children) return item.children.some(c => c.key === active)
  return item.key === active
}

export default function Sidebar({ active, onSelect, collapsed, onToggle }) {
  const [expanded, setExpanded] = useState(() => {
    const keys = []
    if (['customdashboard', 'dashboard-new'].includes(active)) keys.push('dashboard')
    if (['createrule', 'rulegroups', 'ruleview', 'ruleguide'].includes(active)) keys.push('rules')
    if (['securityhub', 'windowsevent', 'securityevents', 'vulnerabilitydetection', 'malwaredetection', 'fim', 'incidentmanagement'].includes(active)) keys.push('securityhub')
    if (['aim', 'infrastructurehealth', 'dtm'].includes(active)) keys.push('noc')
    if (['compliance', 'pcidss', 'hipaa', 'gdpr', 'tsc', 'mitreattack', 'cisbenchmark'].includes(active)) keys.push('compliance')
    if (['cspm', 'docker', 'aws', 'gcp', 'github', 'office365'].includes(active)) keys.push('cspm')
    return keys
  })

  const isInDashboard = ['customdashboard', 'dashboard-new'].includes(active)
  const isInRules = ['createrule', 'rulegroups', 'ruleview', 'ruleguide'].includes(active)
  const isInSecurity = ['securityhub', 'windowsevent', 'securityevents', 'vulnerabilitydetection', 'malwaredetection', 'fim', 'incidentmanagement'].includes(active)
  const isInNoc = ['aim', 'infrastructurehealth', 'dtm'].includes(active)
  const isInCompliance = ['compliance', 'pcidss', 'hipaa', 'gdpr', 'tsc', 'mitreattack', 'cisbenchmark'].includes(active)
  const isInCspm = ['cspm', 'docker', 'aws', 'gcp', 'github', 'office365'].includes(active)

  return (
    <motion.aside
      animate={{ width: collapsed ? 52 : 220 }}
      className="h-full bg-soc-bg dark:bg-soc-darkbg border-r border-[#e8eaed] dark:border-soc-darkborder flex flex-col overflow-hidden shrink-0"
    >
      <div className="flex items-center justify-between px-3 h-12 border-b border-[#e8eaed] dark:border-soc-darkborder shadow-sm">
        {!collapsed && <span className="text-[10px] font-bold text-[#4b5563] dark:text-[#9ca3af] uppercase tracking-widest" style={{textShadow: '0 1px 1px rgba(0,0,0,0.08)'}}>Navigate</span>}
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-[#f59e0b]/10 dark:hover:bg-[#f59e0b]/20 text-[#5f6368] dark:text-[#9aa0b0] transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <path d="M9 18l6-6-6-6"/> : <path d="M15 18l-6-6 6-6"/>}
          </svg>
        </button>
      </div>
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {NAV_SECTIONS.map(item => {
          if (item.children) {
            const isExpanded = !collapsed && expanded.includes(item.key)
            const parentActive = item.key === 'dashboard' ? isInDashboard : item.key === 'rules' ? isInRules : item.key === 'securityhub' ? isInSecurity : item.key === 'noc' ? isInNoc : item.key === 'compliance' ? isInCompliance : item.key === 'cspm' ? isInCspm : false
            return (
              <div key={item.key}>
                <button
                  onClick={() => {
                    if (collapsed) { onToggle(); setExpanded([item.key]); return }
                    setExpanded(prev => prev.includes(item.key) ? prev.filter(k => k !== item.key) : [...prev, item.key])
                    if (parentActive && expanded.includes(item.key)) onSelect(item.children[0].key)
                    else if (!parentActive) onSelect(item.children[0].key)
                  }}
                  className={`w-full flex items-center gap-3 px-2.5 py-2.5 text-xs font-bold rounded-lg transition-all duration-150 border-l-2 ${
                    parentActive
                      ? 'border-l-[#f59e0b] bg-gradient-to-r from-[#f59e0b]/20 to-[#f59e0b]/5 text-[#f59e0b] dark:text-[#fbbf24] dark:from-[#f59e0b]/25 dark:to-[#f59e0b]/5 shadow-[0_2px_6px_rgba(245,158,11,0.2)] dark:shadow-[0_2px_10px_rgba(245,158,11,0.15)] hover:from-[#f59e0b]/35 hover:to-[#f59e0b]/10 hover:shadow-[0_2px_12px_rgba(245,158,11,0.35)] dark:hover:shadow-[0_2px_16px_rgba(245,158,11,0.3)]'
                      : 'border-l-transparent text-[#374151] dark:text-[#c4c8d4] hover:border-l-[#f59e0b] hover:bg-[#f59e0b]/20 dark:hover:bg-[#f59e0b]/30 hover:text-[#f59e0b] dark:hover:text-[#fbbf24] hover:shadow-[0_2px_8px_rgba(245,158,11,0.15)] dark:hover:shadow-[0_2px_12px_rgba(245,158,11,0.2)]'
                  }`}
                  style={{textShadow: parentActive ? '0 1px 3px rgba(245,158,11,0.2)' : '0 1px 1px rgba(0,0,0,0.06)'}}
                  title={collapsed ? item.label : undefined}
                >
                  <NavIcon icon={item.icon} className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                  {!collapsed && (
                    <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  )}
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      {item.children.map(child => (
                        <button
                          key={child.key}
                          onClick={() => onSelect(child.key)}
                          className={`w-full flex items-center gap-3 pl-8 pr-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all duration-150 border-l-2 ${
                            active === child.key
                              ? 'border-l-[#f59e0b] bg-gradient-to-r from-[#f59e0b]/20 to-[#f59e0b]/5 text-[#f59e0b] dark:text-[#fbbf24] dark:from-[#f59e0b]/25 dark:to-[#f59e0b]/5 shadow-[0_2px_6px_rgba(245,158,11,0.18)] hover:from-[#f59e0b]/35 hover:to-[#f59e0b]/10 hover:shadow-[0_2px_12px_rgba(245,158,11,0.3)]'
                              : 'border-l-transparent text-[#374151] dark:text-[#c4c8d4] hover:border-l-[#f59e0b] hover:bg-[#f59e0b]/20 dark:hover:bg-[#f59e0b]/30 hover:text-[#f59e0b] dark:hover:text-[#fbbf24] hover:shadow-[0_2px_8px_rgba(245,158,11,0.12)]'
                          }`}
                          style={{textShadow: active === child.key ? '0 1px 3px rgba(245,158,11,0.15)' : '0 1px 1px rgba(0,0,0,0.05)'}}
                        >
                          <NavIcon icon={child.icon} className="w-3.5 h-3.5 shrink-0" />
                          <span>{child.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          }
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`w-full flex items-center gap-3 px-2.5 py-2.5 text-xs font-bold rounded-lg transition-all duration-150 border-l-2 ${
                active === item.key
                  ? 'border-l-[#f59e0b] bg-gradient-to-r from-[#f59e0b]/20 to-[#f59e0b]/5 text-[#f59e0b] dark:text-[#fbbf24] dark:from-[#f59e0b]/25 dark:to-[#f59e0b]/5 shadow-[0_2px_6px_rgba(245,158,11,0.2)] dark:shadow-[0_2px_10px_rgba(245,158,11,0.15)] hover:from-[#f59e0b]/35 hover:to-[#f59e0b]/10 hover:shadow-[0_2px_12px_rgba(245,158,11,0.35)] dark:hover:shadow-[0_2px_16px_rgba(245,158,11,0.3)]'
                  : 'border-l-transparent text-[#374151] dark:text-[#c4c8d4] hover:border-l-[#f59e0b] hover:bg-[#f59e0b]/20 dark:hover:bg-[#f59e0b]/30 hover:text-[#f59e0b] dark:hover:text-[#fbbf24] hover:shadow-[0_2px_8px_rgba(245,158,11,0.15)] dark:hover:shadow-[0_2px_12px_rgba(245,158,11,0.2)]'
              }`}
              style={{textShadow: active === item.key ? '0 1px 3px rgba(245,158,11,0.2)' : '0 1px 1px rgba(0,0,0,0.06)'}}
              title={collapsed ? item.label : undefined}
            >
              <NavIcon icon={item.icon} className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>
      <div className="p-3 border-t border-[#e8eaed] dark:border-soc-darkborder">
        {!collapsed && (
          <a href="https://unishield360.com" target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-bold text-[#4b5563] dark:text-[#9ca3af] hover:text-[#EF843C] dark:hover:text-[#EF843C] transition-all duration-300"
            style={{textShadow: '0 0 6px rgba(239,132,60,0.15)'}}>
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF843C] shadow-[0_0_6px_rgba(239,132,60,0.6)] animate-pulse" />
              UniShield SOC v2.0
            </span>
          </a>
        )}
      </div>
    </motion.aside>
  )
}