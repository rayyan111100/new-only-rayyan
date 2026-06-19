import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const NAV_SECTIONS = [
  { key: 'discover', label: 'Discover', icon: 'search' },
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  {
    key: 'securityhub', label: 'Security Hub', icon: 'security',
    children: [
      { key: 'securityhub', label: 'Overview', icon: 'dashboard' },
      { key: 'windowsevent', label: 'Windows Event', icon: 'create' },
    ]
  },
  { key: 'health', label: 'Health', icon: 'health' },
  { key: 'vulnerability', label: 'Vulnerability', icon: 'vulnerability' },
  {
    key: 'compliance', label: 'Compliance Management', icon: 'compliance',
    children: [
      { key: 'compliance', label: 'Overview', icon: 'dashboard' },
      { key: 'pcidss', label: 'PCI-DSS', icon: 'assignment' },
      { key: 'hipaa', label: 'HIPAA', icon: 'assignment' },
      { key: 'gdpr', label: 'GDPR', icon: 'assignment' },
      { key: 'mitreattack', label: 'MITRE ATT&CK', icon: 'assignment' },
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
  { key: 'apiconsole', label: 'API Console', icon: 'api' },
  { key: 'apiguide', label: 'API Guide', icon: 'book' },
]

const NavIcon = ({ icon, className }) => {
  const icons = {
    search: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
    dashboard: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    security: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    health: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    settings: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    groups: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    assignment: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h6"/></svg>,
    compliance: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
    visibility: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    decode: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    book: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
    create: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
    vulnerability: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>,
    api: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="12" y1="2" x2="12" y2="22"/></svg>,
  }
  return icons[icon] || null
}

function isChildActive(active, item) {
  if (item.children) return item.children.some(c => c.key === active)
  return item.key === active
}

export default function Sidebar({ active, onSelect, collapsed, onToggle }) {
  const [expanded, setExpanded] = useState(() => {
    const inRules = ['createrule', 'rulegroups', 'ruleview', 'ruleguide'].includes(active)
    const inSec = ['securityhub', 'windowsevent'].includes(active)
    const inCompliance = ['compliance', 'pcidss', 'hipaa', 'gdpr', 'mitreattack'].includes(active)
    if (inSec) return 'securityhub'
    if (inRules) return 'rules'
    if (inCompliance) return 'compliance'
    return null
  })

  const isInRules = ['createrule', 'rulegroups', 'ruleview', 'ruleguide'].includes(active)
  const isInSecurity = ['securityhub', 'windowsevent'].includes(active)
  const isInCompliance = ['compliance', 'pcidss', 'hipaa', 'gdpr', 'mitreattack'].includes(active)

  return (
    <motion.aside
      animate={{ width: collapsed ? 52 : 220 }}
      className="h-full bg-white dark:bg-[#151a28] border-r border-[#e8eaed] dark:border-[#2a3042] flex flex-col overflow-hidden shrink-0"
    >
      <div className="flex items-center justify-between px-3 h-12 border-b border-[#e8eaed] dark:border-[#2a3042]">
        {!collapsed && <span className="text-[10px] font-semibold text-[#9ca3af] dark:text-[#6b7280] uppercase tracking-widest">Navigate</span>}
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042] text-[#5f6368] dark:text-[#9aa0b0] transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <path d="M9 18l6-6-6-6"/> : <path d="M15 18l-6-6 6-6"/>}
          </svg>
        </button>
      </div>
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {NAV_SECTIONS.map(item => {
          if (item.children) {
            const isExpanded = !collapsed && expanded === item.key
            const parentActive = item.key === 'rules' ? isInRules : item.key === 'securityhub' ? isInSecurity : isInCompliance
            return (
              <div key={item.key}>
                <button
                  onClick={() => {
                    if (collapsed) { onToggle(); setExpanded(item.key); return }
                    setExpanded(expanded === item.key ? null : item.key)
                    if (parentActive && expanded === item.key) onSelect(item.children[0].key)
                    else if (!parentActive) onSelect(item.children[0].key)
                  }}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
                    parentActive
                      ? 'bg-[#EF843C]/10 text-[#EF843C] dark:text-[#EF843C] dark:bg-[#EF843C]/10'
                      : 'text-[#5f6368] dark:text-[#9aa0b0] hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042] hover:text-[#324059] dark:hover:text-[#e4e6eb]'
                  }`}
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
                          className={`w-full flex items-center gap-3 pl-8 pr-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-all duration-150 ${
                            active === child.key
                              ? 'bg-[#EF843C]/10 text-[#EF843C] dark:text-[#EF843C] dark:bg-[#EF843C]/10'
                              : 'text-[#5f6368] dark:text-[#9aa0b0] hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042] hover:text-[#324059] dark:hover:text-[#e4e6eb]'
                          }`}
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
              className={`w-full flex items-center gap-3 px-2.5 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
                active === item.key
                  ? 'bg-[#EF843C]/10 text-[#EF843C] dark:text-[#EF843C] dark:bg-[#EF843C]/10'
                  : 'text-[#5f6368] dark:text-[#9aa0b0] hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042] hover:text-[#324059] dark:hover:text-[#e4e6eb]'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <NavIcon icon={item.icon} className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>
      <div className="p-3 border-t border-[#e8eaed] dark:border-[#2a3042]">
        {!collapsed && (
          <a href="https://unishield360.com" target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-[#9ca3af] dark:text-[#6b7280] font-medium hover:text-soc-accent transition-colors">
            UniShield SOC v2.0
          </a>
        )}
      </div>
    </motion.aside>
  )
}