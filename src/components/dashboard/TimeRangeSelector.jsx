import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PRESETS = [
  { label: 'Last 1 hour', from: 'now-1h', to: 'now' },
  { label: 'Last 6 hours', from: 'now-6h', to: 'now' },
  { label: 'Last 24 hours', from: 'now-24h', to: 'now' },
  { label: 'Last 3 days', from: 'now-3d', to: 'now' },
  { label: 'Last 7 days', from: 'now-7d', to: 'now' },
  { label: 'Last 30 days', from: 'now-30d', to: 'now' },
  { label: 'Last 90 days', from: 'now-90d', to: 'now' },
  { label: 'This month', from: 'now/M', to: 'now' },
  { label: 'Previous month', from: 'now-1M/M', to: 'now-1M/M' },
  { label: 'This year', from: 'now/y', to: 'now' },
]

function formatLabel(v) {
  if (!v) return 'Last 24 hours'
  const match = PRESETS.find(p => p.from === v.from && p.to === v.to)
  if (match) return match.label
  return v.from + ' → ' + v.to
}

export default function TimeRangeSelector({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const [cf, setCf] = useState('')
  const [ct, setCt] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const select = (p) => { onChange?.(p); setOpen(false); setCustom(false) }

  const applyCustom = () => {
    if (cf && ct) { onChange?.({ from: cf, to: ct }); setOpen(false); setCustom(false) }
  }

  const activeLabel = formatLabel(value)

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all whitespace-nowrap">
        <svg className="w-3 h-3 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span className="max-w-[100px] truncate">{activeLabel}</span>
        <svg className={`w-2.5 h-2.5 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full left-0 mt-1.5 z-[200] bg-white dark:bg-[#252832] rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl overflow-hidden"
            style={{ width: custom ? 280 : 200 }}
          >
            <div className="p-1.5 max-h-64 overflow-y-auto">
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => select(p)}
                  className={`w-full text-left px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
                    value?.from === p.from && value?.to === p.to
                      ? 'bg-[#EF843C]/10 text-[#EF843C] font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700/40'
                  }`}>{p.label}</button>
              ))}
              <div className="mx-3 my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
              <button onClick={() => setCustom(!custom)}
                className={`w-full text-left px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
                  custom ? 'bg-[#EF843C]/10 text-[#EF843C] font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700/40'
                }`}>Custom Range</button>
            </div>
            {custom && (
              <div className="px-3 pb-3 pt-1 border-t border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <input type="text" value={cf} onChange={e => setCf(e.target.value)} placeholder="now-24h"
                    className="ginput flex-1 px-2 py-1 text-[10px] font-mono rounded-lg" />
                  <span className="text-[10px] text-zinc-400">→</span>
                  <input type="text" value={ct} onChange={e => setCt(e.target.value)} placeholder="now"
                    className="ginput flex-1 px-2 py-1 text-[10px] font-mono rounded-lg" />
                </div>
                <button onClick={applyCustom} className="w-full py-1.5 text-[10px] font-semibold rounded-lg bg-[#EF843C] text-white hover:bg-[#e0752a] transition-colors">Apply</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

