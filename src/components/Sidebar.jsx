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
      animate={{ width: collapsed ? 48 : 200 }}
      className="h-full bg-soc-sidebar dark:bg-soc-darkside border-r border-soc-border dark:border-soc-darkborder flex flex-col overflow-hidden shrink-0"
    >
      <div className="flex items-center justify-between px-3 h-11 border-b border-soc-border dark:border-soc-darkborder">
        {!collapsed && <span className="text-xs font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wide">Navigate</span>}
        <button onClick={onToggle} className="p-1 hover:bg-soc-border/50 dark:hover:bg-soc-darkborder/50 text-soc-stext dark:text-soc-darkstext text-xs">
          {collapsed ? '\u25B6' : '\u25C0'}
        </button>
      </div>
      <nav className="flex-1 py-2 space-y-0.5 px-1.5">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-xs font-medium transition-all duration-150 ${
              active === item.key
                ? 'bg-[#1a73e8]/10 text-[#1a73e8] dark:text-[#8ab4f8] dark:bg-[#8ab4f8]/10'
                : 'text-soc-stext dark:text-soc-darkstext hover:bg-soc-border/30 dark:hover:bg-soc-darkborder/30'
            }`}
            title={collapsed ? item.label : undefined}
          >
            <span className="text-sm shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
      <div className="p-2 border-t border-soc-border dark:border-soc-darkborder text-center">
        {!collapsed && <span className="text-[10px] text-soc-stext dark:text-soc-darkstext">SOC v2.0</span>}
      </div>
    </motion.aside>
  )
}
