import React, { useState, useRef, useEffect } from 'react'

export default function InlineFilter({ field, value, children, onInclude, onExclude, isIncluded, isExcluded, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <span ref={ref} className="relative inline-flex">
      <span
        onClick={(e) => { e.stopPropagation(); setOpen(prev => !prev) }}
        className={`cursor-pointer ${className} ${isIncluded ? 'ring-1 ring-green-500/50 rounded' : ''} ${isExcluded ? 'ring-1 ring-red-500/50 rounded' : ''}`}
      >
        {children}
      </span>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-[100] bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-lg shadow-xl p-1 min-w-[120px]"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => { onInclude?.(); setOpen(false) }}
            className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs rounded transition-colors ${
              isIncluded
                ? 'bg-green-500/15 text-green-600 dark:text-green-400 font-semibold'
                : 'hover:bg-green-500/10 text-green-600 dark:text-green-400'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            {isIncluded ? 'Included' : 'Include'}
          </button>
          <button
            onClick={() => { onExclude?.(); setOpen(false) }}
            className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs rounded transition-colors ${
              isExcluded
                ? 'bg-red-500/15 text-red-600 dark:text-red-400 font-semibold'
                : 'hover:bg-red-500/10 text-red-600 dark:text-red-400'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            {isExcluded ? 'Excluded' : 'Exclude'}
          </button>
        </div>
      )}
    </span>
  )
}
