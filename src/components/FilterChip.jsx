import React, { useState } from 'react'
import { motion } from 'framer-motion'

const OP_LABELS = {
  'is': ':', 'is not': '\u2260', 'is one of': 'in', 'is not one of': 'not in',
  'contains': '\u007E', 'does not contain': '!\u007E',
  'starts with': '^', 'ends with': '$',
  'exists': 'exists', 'does not exist': '!exists',
  'is greater than': '>', 'is greater than or equal': '\u2265',
  'is less than': '<', 'is less than or equal': '\u2264',
  'is between': 'between', 'is not between': '!between',
}

export default function FilterChip({ filter, onEdit, onRemove, onToggle, onToggleDisabled, onTogglePin, onInvert, onCopyDql, onSaveFilter }) {
  const opLabel = OP_LABELS[filter.operator] || ':'
  const isNeg = filter.negate
  const isExists = filter.operator === 'exists' || filter.operator === 'does not exist'
  const isRange = filter.operator === 'is between' || filter.operator === 'is not between'
  const isList = filter.operator === 'is one of' || filter.operator === 'is not one of'
  const disabled = filter.disabled
  const pinned = filter.pinned
  const [showMenu, setShowMenu] = useState(false)

  let displayVal = filter.value
  if (isExists) displayVal = ''
  else if (isRange) {
    const to = filter.secondValue ?? filter.params?.to ?? ''
    displayVal = `${filter.value} to ${to}`
  }
  else if (isList) displayVal = filter.value

  const getDqlText = () => {
    const neg = isNeg ? 'NOT ' : ''
    return `${neg}${filter.key || filter.field}${opLabel}${displayVal || ''}`
  }

  const handleCopyDql = (e) => {
    e.stopPropagation()
    navigator.clipboard?.writeText(getDqlText())
    setShowMenu(false)
  }

  const fieldLabel = filter.key || filter.field || ''
  const valLabel = filter.type === 'text' ? filter.query : (isRange ? displayVal : (filter.value || ''))

  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: disabled ? 0.4 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`relative inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium border group transition-all ${
        disabled
          ? 'bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-800/30 dark:border-gray-700 dark:text-gray-500 line-through'
          : isNeg
            ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30'
            : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
      } ${pinned ? 'ring-1 ring-purple-400 dark:ring-purple-600' : ''}`}
      title={`${disabled ? '[Disabled] ' : ''}${pinned ? '[Pinned] ' : ''}${isNeg ? 'NOT ' : ''}${fieldLabel} ${opLabel} ${valLabel || ''}`}
    >
      {pinned && <span className="text-[8px] mr-0.5" title="Pinned"><svg className="w-2.5 h-2.5 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/></svg></span>}
      <span className="flex items-center gap-0.5 cursor-pointer" onClick={() => onEdit?.(filter)}>
        {isNeg && <span className="font-bold text-[9px] uppercase mr-0.5">NOT</span>}
        {fieldLabel && <span className="max-w-[90px] truncate">{fieldLabel}</span>}
        {fieldLabel && valLabel && <span className="opacity-60 mx-0.5">{opLabel}</span>}
        {valLabel && <span className="max-w-[80px] truncate">{valLabel}</span>}
      </span>

      <span className="ml-0.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!disabled && (
          isNeg
            ? <button onClick={e => { e.stopPropagation(); onToggle?.(filter.id, false) }}
                className="w-3.5 h-3.5 flex items-center justify-center rounded font-bold leading-none text-[9px] transition-colors bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-200" title="Filter for (include)">+</button>
            : <button onClick={e => { e.stopPropagation(); onToggle?.(filter.id, true) }}
                className="w-3.5 h-3.5 flex items-center justify-center rounded font-bold leading-none text-[9px] transition-colors bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-200" title="Filter out (exclude)">&ndash;</button>
        )}
        <button onClick={e => { e.stopPropagation(); onToggleDisabled?.(filter.id) }}
          className={`w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 font-bold leading-none text-[9px] transition-colors ${disabled ? 'text-green-500' : 'text-soc-stext dark:text-soc-darkstext'}`}
          title={disabled ? 'Enable' : 'Disable'}>{disabled ? <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> : <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>}</button>
        <button onClick={e => { e.stopPropagation(); onTogglePin?.(filter.id) }}
          className={`w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 text-[9px] transition-colors ${pinned ? 'text-purple-500' : 'text-soc-stext dark:text-soc-darkstext'}`}
          title={pinned ? 'Unpin' : 'Pin'}><svg className="w-2.5 h-2.5 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/></svg></button>
        <button onClick={e => { e.stopPropagation(); onInvert?.(filter.id) }}
          className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 text-[9px] transition-colors"
          title="Invert"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg></button>
        <div className="relative">
          <button onClick={e => { e.stopPropagation(); setShowMenu(!showMenu) }}
            className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 text-[9px] transition-colors" title="More">...</button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded shadow-lg py-1 min-w-[130px]">
                <button onClick={handleCopyDql} className="w-full text-left px-2.5 py-1 text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext transition-colors whitespace-nowrap"><svg className="w-3 h-3 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> Copy DQL</button>
                <button onClick={e => { e.stopPropagation(); onSaveFilter?.(filter); setShowMenu(false) }} className="w-full text-left px-2.5 py-1 text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext transition-colors whitespace-nowrap"><svg className="w-3 h-3 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg> Save as filter</button>
                <button onClick={e => { e.stopPropagation(); onRemove(filter.id); setShowMenu(false) }} className="w-full text-left px-2.5 py-1 text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-red-500 transition-colors whitespace-nowrap"><svg className="w-3 h-3 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg> Remove</button>
              </div>
            </>
          )}
        </div>
      </span>
    </motion.span>
  )
}
