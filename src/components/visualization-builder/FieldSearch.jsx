import React, { useState, useRef, useEffect } from 'react'

export default function FieldSearch({ value = '', onChange, suggestions = [], placeholder = 'Search...', color = '#8b5cf6' }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(value || '')
  const [activeIdx, setActiveIdx] = useState(-1)
  const ref = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { setSearch(value || '') }, [value])
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(value || '') } }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [value])

  const filtered = suggestions.filter(s => !search || s.value.toLowerCase().includes(search.toLowerCase()) || s.label.toLowerCase().includes(search.toLowerCase()))

  const select = (item) => {
    setSearch(item.value)
    setOpen(false)
    onChange?.(item.value)
  }

  const handleInput = (e) => {
    setSearch(e.target.value)
    onChange?.(e.target.value)
    setOpen(true)
    setActiveIdx(-1)
  }

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(prev => Math.min(prev + 1, filtered.length - 1)); if (!open) setOpen(true) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(prev => Math.max(prev - 1, 0)) }
    else if (e.key === 'Enter' && activeIdx >= 0 && filtered[activeIdx]) { select(filtered[activeIdx]) }
    else if (e.key === 'Escape') { setOpen(false); setSearch(value || '') }
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input ref={inputRef} type="text" value={search} onChange={handleInput} onFocus={() => setOpen(true)} onKeyDown={handleKey}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 text-[11px] font-mono pr-9 rounded-xl bg-white dark:bg-zinc-800/60 border outline-none transition-all"
          style={{
            borderColor: open ? color + '66' : undefined,
            boxShadow: open ? `0 0 0 2px ${color}1a` : undefined,
          }}
        />
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        {search && (
          <button onClick={() => { setSearch(''); onChange?.(''); inputRef.current?.focus() }} className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-[#252832] rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-lg overflow-hidden max-h-56">
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.map((item, i) => (
              <div key={item.value}
                onClick={() => select(item)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex items-center gap-2 px-3 py-2 text-[11px] font-mono cursor-pointer transition-colors ${
                  activeIdx === i ? 'bg-zinc-50 dark:bg-zinc-700/40' : ''
                } ${search && item.value.toLowerCase() === search.toLowerCase() ? 'font-semibold' : 'text-zinc-600 dark:text-zinc-400'}`}
                style={search && item.value.toLowerCase() === search.toLowerCase() ? { color } : {}}>
                <svg className="w-3 h-3 shrink-0 text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span className="truncate flex-1">{item.label}</span>
                <span className="text-[8px] text-zinc-400 dark:text-zinc-500 shrink-0 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="px-3 py-1.5 border-t border-zinc-200 dark:border-zinc-700 text-[8px] text-zinc-400 flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      )}
    </div>
  )
}
