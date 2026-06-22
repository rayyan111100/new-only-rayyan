import React, { useState, useRef, useEffect } from 'react'

export default function Select({ value, options, onChange, className = '', placeholder = 'Select...', search }) {
  const [open, setOpen] = useState(false)
  const [searchVal, setSearchVal] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selected = options.find(o => o.value === value) || null
  const filtered = search ? options.filter(o => {
    const q = searchVal.toLowerCase()
    return (o.label || o.value || '').toLowerCase().includes(q)
  }) : options

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 w-full px-3 py-2 text-[11px] font-mono rounded-xl bg-white dark:bg-zinc-800/60 border cursor-pointer transition-all ${
          open ? 'border-[#8b5cf6]/40 ring-2 ring-[#8b5cf6]/10' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
        } ${className}`}
      >
        <span className={`flex-1 truncate ${selected ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-400'}`}>
          {selected ? (selected.label || selected.value) : placeholder}
        </span>
        <svg className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-[#252832] rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-lg overflow-hidden" style={{ minWidth: '100%' }}>
          {search && (
            <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
              <input ref={inputRef} type="text" value={searchVal} onChange={e => setSearchVal(e.target.value)}
                placeholder={typeof search === 'string' ? search : 'Search...'}
                className="w-full px-2 py-1.5 text-[10px] font-mono bg-zinc-50 dark:bg-zinc-800 rounded-lg outline-none border border-zinc-200 dark:border-zinc-700 focus:border-[#8b5cf6]/40 transition-colors"
                autoFocus />
            </div>
          )}
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[10px] text-zinc-400">No options found</div>
            ) : filtered.map(o => (
              <div key={o.value} onClick={() => { onChange?.(o.value); setOpen(false); setSearchVal('') }}
                className={`flex items-center gap-2 px-3 py-2 text-[11px] font-mono cursor-pointer transition-colors ${
                  value === o.value
                    ? 'bg-[#8b5cf6]/10 text-[#8b5cf6] font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700/40'
                }`}>
                {o.icon && <span className="text-sm">{o.icon}</span>}
                <span className="truncate">{o.label || o.value}</span>
                {value === o.value && (
                  <svg className="w-3.5 h-3.5 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
