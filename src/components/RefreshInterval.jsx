import React from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'

export default function RefreshInterval() {
  const { refreshValue, setRefreshValue, refreshUnit, setRefreshUnit, refreshActive, toggleRefresh, isDark } = useApp()

  return (
    <div className="inline-flex items-center gap-1 shrink-0">
      <span className="text-[10px] font-medium text-[#6b7280] dark:text-[#9ca3af] whitespace-nowrap">Refresh every</span>
      <input
        type="number"
        min="0"
        value={refreshValue}
        onChange={e => setRefreshValue(Math.max(0, parseInt(e.target.value) || 0))}
        className={`w-12 px-1.5 py-1 text-xs text-center rounded border outline-none transition-colors ${
          isDark
            ? 'bg-[#0f1117] border-[#2d3140] text-[#e4e6eb] focus:border-[#EF843C]'
            : 'bg-white border-[#e5e7eb] text-[#1a1c23] focus:border-[#EF843C]'
        }`}
        aria-label="Refresh interval value"
      />
      <div className="relative">
        <select
          value={refreshUnit}
          onChange={e => setRefreshUnit(e.target.value)}
          className={`appearance-none px-1.5 py-1 text-xs rounded border outline-none pr-5 transition-colors ${
            isDark
              ? 'bg-[#0f1117] border-[#2d3140] text-[#e4e6eb] focus:border-[#EF843C]'
              : 'bg-white border-[#e5e7eb] text-[#1a1c23] focus:border-[#EF843C]'
          }`}
          aria-label="Refresh interval units"
        >
          <option value="s">sec</option>
          <option value="m">min</option>
          <option value="h">hr</option>
        </select>
        <svg width="12" height="12" viewBox="0 0 16 16" className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-[#9ca3af]" fill="currentColor"><path d="M13.069 5.157 8.384 9.768a.546.546 0 0 1-.768 0L2.93 5.158a.552.552 0 0 0-.771 0 .53.53 0 0 0 0 .759l4.684 4.61c.641.631 1.672.63 2.312 0l4.684-4.61a.53.53 0 0 0 0-.76.552.552 0 0 0-.771 0Z"/></svg>
      </div>
      <button
        onClick={toggleRefresh}
        disabled={!refreshValue}
        className={`flex items-center gap-1 px-1.5 py-1 text-xs font-medium rounded transition-all shrink-0 ${
          refreshActive
            ? 'bg-[#dc2626] text-white hover:bg-[#b91c1c]'
            : refreshValue
              ? isDark ? 'bg-[#EF843C] text-white hover:bg-[#e0752a]' : 'bg-[#EF843C] text-white hover:bg-[#e0752a]'
              : isDark ? 'bg-[#2d3140] text-[#6b7280] cursor-not-allowed' : 'bg-[#e5e7eb] text-[#9ca3af] cursor-not-allowed'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.608 3.063C4.345 2.895 4 3.089 4 3.418v9.167c0 .329.345.523.608.356l7.2-4.584a.426.426 0 0 0 0-.711l-7.2-4.583Zm.538-.844 7.2 4.583a1.426 1.426 0 0 1 0 2.399l-7.2 4.583C4.21 14.38 3 13.696 3 12.585V3.418C3 2.307 4.21 1.624 5.146 2.22Z"/>
        </svg>
        {refreshActive ? 'Stop' : 'Start'}
      </button>
    </div>
  )
}
