import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const NAV_SECTIONS = [
  {
    key: 'compliance', label: 'Compliance Management / Frameworks', icon: 'compliance',
    children: [
      { key: 'compliance', label: 'Overview', icon: 'dashboard' },
      { key: 'pcidss', label: 'PCI-DSS', icon: 'assignment' },
      { key: 'hipaa', label: 'HIPAA', icon: 'assignment' },
      { key: 'gdpr', label: 'GDPR', icon: 'assignment' },
      { key: 'tscsoc2', label: 'SOC 2 (TSC)', icon: 'assignment' },
      { key: 'nist80053', label: 'NIST 800-53', icon: 'assignment' },
      { key: 'mitreattack', label: 'MITRE ATT&CK', icon: 'assignment' },
    ]
  },
]

const NavIcon = ({ icon, className }) => {
  const icons = {
    dashboard: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    assignment: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h6"/></svg>,
    compliance: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
    create: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
  }
  return icons[icon] || null
}

function isChildActive(active, item) {
  if (item.children) return item.children.some(c => c.key === active)
  return item.key === active
}

export default function Sidebar({ active, onSelect, collapsed, onToggle }) {
  const [expanded, setExpanded] = useState(() => {
    const inCompliance = ['compliance', 'pcidss', 'hipaa', 'gdpr', 'tscsoc2', 'mitreattack', 'nist80053'].includes(active)
    if (inCompliance) return 'compliance'
    return null
  })

  const isInCompliance = ['compliance', 'pcidss', 'hipaa', 'gdpr', 'tscsoc2', 'mitreattack', 'nist80053'].includes(active)

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
            const parentActive = isInCompliance
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