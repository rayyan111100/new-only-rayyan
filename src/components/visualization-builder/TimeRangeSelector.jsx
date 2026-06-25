import React, { useState } from 'react'

const PRESETS = [
  { label: 'Last 1 hour', from: 'now-1h', to: 'now' },
  { label: 'Last 24 hours', from: 'now-24h', to: 'now' },
  { label: 'Last 7 days', from: 'now-7d', to: 'now' },
  { label: 'Last 30 days', from: 'now-30d', to: 'now' },
  { label: 'Last 90 days', from: 'now-90d', to: 'now' },
  { label: 'This month', from: 'now/M', to: 'now' },
  { label: 'Previous month', from: 'now-1M/M', to: 'now-1M/M' },
  { label: 'Custom', from: '', to: '', custom: true },
]

export default function TimeRangeSelector({ value = { from: 'now-24h', to: 'now' }, onChange }) {
  const [custom, setCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const handlePreset = (preset) => {
    if (preset.custom) {
      setCustom(true)
      return
    }
    setCustom(false)
    onChange?.({ from: preset.from, to: preset.to })
  }

  const applyCustom = () => {
    if (customFrom && customTo) {
      onChange?.({ from: customFrom, to: customTo })
      setCustom(false)
    }
  }

  const activeLabel = PRESETS.find(p => p.from === value.from && p.to === value.to)?.label || 'Custom'

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Time Range</label>
      <div className="flex flex-wrap gap-1">
        {PRESETS.filter(p => !p.custom).map(p => (
          <button
            key={p.label}
            onClick={() => handlePreset(p)}
            className={`px-2 py-1 text-[9px] font-medium rounded-md border transition-colors ${
              value.from === p.from && value.to === p.to && !custom
                ? 'bg-[#EF843C] text-white border-[#EF843C]'
                : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => handlePreset({ custom: true })}
          className={`px-2 py-1 text-[9px] font-medium rounded-md border transition-colors ${
            custom ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
          }`}
        >
          Custom
        </button>
      </div>

      {custom && (
        <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <input
            type="text"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            placeholder="e.g. now-3d or 2026-01-01"
            className="ginput flex-1 px-2 py-1 text-[10px] font-mono"
          />
          <span className="text-[10px] text-zinc-400">→</span>
          <input
            type="text"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            placeholder="e.g. now"
            className="ginput flex-1 px-2 py-1 text-[10px] font-mono"
          />
          <button onClick={applyCustom}
            className="px-2 py-1 text-[9px] font-semibold rounded-md bg-[#8b5cf6] text-white hover:bg-[#7c3aed] transition-colors">
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
