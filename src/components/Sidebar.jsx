import React from 'react'
import { motion } from 'framer-motion'

const NAV_SECTIONS = [
  { key: 'discover', label: 'Discover', icon: 'search' },
  {
    key: 'customdashboard', label: 'Custom Dashboard', icon: 'dashboard',
  },
  { key: 'health', label: 'Health', icon: 'health' },
  { key: 'apiconsole', label: 'API Console', icon: 'api' },
  { key: 'apiguide', label: 'API Guide', icon: 'book' },
]

const NavIcon = ({ icon, className }) => {
  const icons = {
    search: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
    dashboard: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    health: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    api: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="12" y1="2" x2="12" y2="22"/></svg>,
    book: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  }
  return icons[icon] || null
}

export default function Sidebar({ active, onSelect, collapsed, onToggle }) {
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
        {NAV_SECTIONS.map(item => (
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
        ))}
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