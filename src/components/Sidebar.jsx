import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const NAV_ITEMS = [
  { key: 'discover', label: 'Discover', icon: '\uD83D\uDD0E' },
  { key: 'dashboard', label: 'Dashboard', icon: '\uD83D\uDCCA' },
  { key: 'scan', label: 'Scan', icon: '\uD83D\uDD0D' },
  { key: 'analytics', label: 'Analytics', icon: '\uD83D\uDCC8' },
  { key: 'indices', label: 'Indices', icon: '\uD83D\uDDC4\uFE0F' },
  { key: 'geo', label: 'Geo', icon: '\uD83C\uDF0D' },
  { key: 'health', label: 'Health', icon: '\u2764\uFE0F' }
]

export default function Sidebar({ active, onSelect, collapsed, onToggle }) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 52 : 210 }}
      className="h-full bg-white dark:bg-[#0f1117] border-r border-[#e5e7eb] dark:border-[#2d3140] flex flex-col overflow-hidden shrink-0"
    >
      <div className="flex items-center justify-between px-3 h-11 border-b border-[#e5e7eb] dark:border-[#2d3140]">
        {!collapsed && <span className="text-[10px] font-semibold text-[#9ca3af] dark:text-[#6b7280] uppercase tracking-widest">Navigate</span>}
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-[#6b7280] dark:text-[#9ca3af] transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <path d="M9 18l6-6-6-6"/> : <path d="M15 18l-6-6 6-6"/>}
          </svg>
        </button>
      </div>
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={`w-full flex items-center gap-3 px-2.5 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
              active === item.key
                ? 'bg-[#3b82f6]/10 text-[#3b82f6] dark:text-[#60a5fa] dark:bg-[#60a5fa]/10'
                : 'text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] hover:text-[#1a1c23] dark:hover:text-[#e4e6eb]'
            }`}
            title={collapsed ? item.label : undefined}
          >
            <span className="text-sm shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-[#e5e7eb] dark:border-[#2d3140]">
        {!collapsed && <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280] font-medium">SOC v2.0</span>}
      </div>
    </motion.aside>
  )
}
