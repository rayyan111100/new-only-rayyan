import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SVG_ICONS = {
  agent: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  control: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e8681a" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  rule: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d29922" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  article: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e8681a" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  log: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
}

export default function DetailSidebar({ open, onClose, onSelectItem, items, title, labelKey = 'key', countKey = 'doc_count', icon = 'agent', itemLabel = 'items', accentColor = '#58a6ff' }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!items) return []
    return items.filter(it => {
      const name = String(it[labelKey] || it.key || it.agent || it.name || it.id || it.art || it.req || it.ctrl || it.code || '').toLowerCase()
      return name.includes(search.toLowerCase())
    })
  }, [items, search, labelKey])

  const totalCount = useMemo(() => {
    return (items || []).reduce((s, it) => s + (it[countKey] || it.doc_count || it.count || it.events || 0), 0)
  }, [items, countKey])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 z-50 h-full w-80 bg-white dark:bg-[#0d1117] border-l border-[#d0d7de] dark:border-[#1d2432] shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-4 h-12 border-b border-[#d0d7de] dark:border-[#1d2432] shrink-0">
              <span className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">{title}</span>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="px-4 py-2 border-b border-[#d0d7de] dark:border-[#1d2432] shrink-0">
              <div className="flex items-center gap-2 bg-[#f0f2f4] dark:bg-[#161b22] rounded-lg px-2.5 py-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={'Search ' + itemLabel + '...'}
                  className="flex-1 bg-transparent text-xs text-[#1f2328] dark:text-[#f0f6fc] outline-none placeholder-[#8b949e]"
                />
              </div>
            </div>

            <div className="px-3 py-2 border-b border-[#d0d7de] dark:border-[#1d2432] shrink-0">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#8b949e]">{filtered.length} {itemLabel}</span>
                <span className="text-[#8b949e]">{totalCount.toLocaleString()} total events</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-xs text-[#8b949e]">No {itemLabel} found</div>
              ) : (
                filtered.map((it, i) => {
                  const name = it[labelKey] || it.key || it.agent || it.name || it.id || it.art || it.req || it.ctrl || it.code || 'Unknown'
                  const cnt = it[countKey] || it.doc_count || it.count || it.events || 0
                  return (
                    <div key={name + '-' + i}
                      onClick={() => { onSelectItem?.(name); onClose() }}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-[#f0f2f4] dark:hover:bg-[#161b22] cursor-pointer transition-colors border-b border-[#f0f2f4] dark:border-[#1d2432]/50"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: accentColor + '1a' }}>
                          {SVG_ICONS[icon] || SVG_ICONS.agent}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#1f2328] dark:text-[#f0f6fc] truncate">{name}</div>
                          {it.description && <div className="text-[10px] text-[#8b949e] truncate">{it.description}</div>}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-[#5f6368] dark:text-[#e4e6eb] tabular-nums shrink-0 ml-3">{cnt}</div>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
