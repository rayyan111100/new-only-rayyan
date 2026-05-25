import React from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'

export default function Navbar() {
  const { theme, setTheme, isDark, tab } = useApp()
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark')
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <header className="gcard rounded-none flex items-center justify-between px-4 h-10 shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-[#1a73e8] dark:text-[#8ab4f8] tracking-tight">Wazuh SOC</h1>
        <span className="text-[10px] text-soc-stext dark:text-soc-darkstext bg-soc-bg dark:bg-soc-darkbg px-1.5 py-0.5 rounded">SECURITY</span>
        <span className="text-xs text-soc-stext dark:text-soc-darkstext capitalize">{tab}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xxs text-soc-stext dark:text-soc-darkstext">{now}</span>
          <button onClick={toggleTheme} className="gbtn-ghost px-2 py-1 rounded text-xs dark:text-soc-darkstext dark:hover:bg-soc-darkborder/30 transition-colors">
            {isDark ? '\u2600\uFE0F' : '\uD83C\uDF19'}
          </button>
      </div>
    </header>
  )
}
