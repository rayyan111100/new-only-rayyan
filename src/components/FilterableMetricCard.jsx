import React, { useState, useRef, useEffect } from 'react'

const SVG_ICONS = {
  certificate: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></>,
  'alert-triangle': <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  'alert-circle': <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
  'device-desktop': <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
  'list-check': <><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/></>,
  award: <><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></>,
}

export default function FilterableMetricCard({
  card,
  filterField,
  filterValue,
  onInclude,
  onExclude,
  onCustomClick,
  isIncluded,
  isExcluded,
  accentColor = '#e8681a',
  isDark
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const isFilterable = filterField && filterValue !== undefined && filterValue !== null && filterValue !== ''

  const handleClick = () => {
    if (isFilterable) {
      setOpen(prev => !prev)
    } else if (onCustomClick) {
      onCustomClick()
    }
  }

  const borderActive = isIncluded
    ? `${accentColor} dark:${accentColor} ring-1 ring-[${accentColor}]/30`
    : isExcluded
      ? '#f85149 dark:#f85149 ring-1 ring-[#f85149]/30'
      : ''

  return (
    <div ref={ref} className="relative">
      <div
        onClick={handleClick}
        className={`bg-white dark:bg-[#161b22] border rounded-xl p-3 cursor-pointer transition-all duration-300 hover:-translate-y-[3px] shadow-lg hover:shadow-[0_8px_25px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] ${
          borderActive
            ? borderActive.includes('#f85149')
              ? 'border-[#f85149] dark:border-[#f85149] ring-1 ring-[#f85149]/30'
              : `border-[${accentColor}] dark:border-[${accentColor}] ring-1 ring-[${accentColor}]/30`
            : 'border-[#d0d7de] dark:border-[#30363d] hover:border-[#e8681a]/50 dark:hover:border-[#e8681a]/60'
        }`}
      >
        <div className="float-right w-[34px] h-[34px] rounded-lg flex items-center justify-center text-lg" style={{ background: card.iconBg }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={card.iconColor} strokeWidth="2">
            {SVG_ICONS[card.icon] || SVG_ICONS.certificate}
          </svg>
        </div>
        <div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-1 clear-both">{card.label}</div>
        <div className={`text-2xl font-bold text-[#1f2328] dark:text-[#f0f6fc] ${card.valSize || ''} tracking-tight`} style={card.valColor ? { color: card.valColor } : undefined}>
          {card.val}
        </div>
        {card.sub && <div className="text-[10px] text-[#8b949e] mt-0.5">{card.sub}</div>}

        {isIncluded && (
          <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-500/30" title="Included" />
        )}
        {isExcluded && (
          <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-500/30" title="Excluded" />
        )}
      </div>

      {open && isFilterable && (
        <div
          className="absolute top-full left-0 mt-1 z-[100] bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-lg shadow-xl p-1 min-w-[130px]"
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            {isExcluded ? 'Excluded' : 'Exclude'}
          </button>
        </div>
      )}
    </div>
  )
}
