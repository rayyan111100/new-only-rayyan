import React, { useState } from 'react'

export default function Controls({ field, options = [], type = 'dropdown', onChange }) {
  const [value, setValue] = useState(options[0]?.value || '')
  const [rangeVal, setRangeVal] = useState(0)

  const handleChange = (newVal) => {
    setValue(newVal)
    if (onChange) onChange(newVal)
  }

  return (
    <div className="space-y-1.5">
      {field && (
        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
          {field.replace(/_/g, ' ')}
        </label>
      )}
      {type === 'dropdown' && (
        <div className="relative">
          <select
            value={value}
            onChange={e => handleChange(e.target.value)}
            className="ginput w-full px-3 py-2 text-[11px] font-mono appearance-none bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:border-[#EF843C]/40 focus:ring-2 focus:ring-[#EF843C]/10 outline-none transition-all"
          >
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>
            ))}
          </select>
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      )}
      {type === 'slider' && (
        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={options.length - 1 || 100}
            value={rangeVal}
            onChange={e => {
              const idx = parseInt(e.target.value)
              setRangeVal(idx)
              if (options[idx]) handleChange(options[idx].value)
              else handleChange(String(idx))
            }}
            className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#EF843C]"
          />
          <div className="flex justify-between text-[9px] text-zinc-400">
            <span>{options[0]?.label || '0'}</span>
            <span>{options[options.length - 1]?.label || String(options.length - 1)}</span>
          </div>
        </div>
      )}
      {type === 'kql' && (
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={e => handleChange(e.target.value)}
            placeholder={`Search ${field || '...'}`}
            className="ginput w-full px-3 py-2 text-[11px] font-mono bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:border-[#EF843C]/40 focus:ring-2 focus:ring-[#EF843C]/10 outline-none transition-all"
          />
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
      )}
    </div>
  )
}
