import React, { useState, useRef, useEffect } from 'react'

export default function DashboardTabs({ tabs, activeTabId, onSelect, onAdd, onDelete, onRename }) {
  const scrollRef = useRef(null)
  const [showScrollLeft, setShowScrollLeft] = useState(false)
  const [showScrollRight, setShowScrollRight] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const createRef = useRef(null)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setShowScrollLeft(el.scrollLeft > 2)
    setShowScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (el) { el.addEventListener('scroll', checkScroll); window.addEventListener('resize', checkScroll) }
    return () => { if (el) el.removeEventListener('scroll', checkScroll); window.removeEventListener('resize', checkScroll) }
  }, [tabs])

  const scroll = (dir) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * 150, behavior: 'smooth' })
    setTimeout(checkScroll, 150)
  }

  useEffect(() => { if (creating && createRef.current) createRef.current.focus() }, [creating])

  const handleDoubleClick = (tab) => {
    setEditingId(tab.id)
    setEditName(tab.name)
  }

  const handleRename = (tabId) => {
    if (editName.trim()) onRename(tabId, editName.trim())
    setEditingId(null)
  }

  return (
    <div className="flex items-center gap-0.5">
      {showScrollLeft && (
        <button onClick={() => scroll(-1)}
          className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      )}
      <div ref={scrollRef} className="flex items-center gap-0.5 overflow-hidden" style={{ scrollBehavior: 'smooth' }}>
        {tabs.map((tab, i) => {
          const isActive = tab.id === activeTabId
          return (
            <div key={tab.id}
              onClick={() => onSelect(tab.id)}
              onDoubleClick={() => handleDoubleClick(tab)}
              className={'group relative flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg cursor-pointer select-none transition-all whitespace-nowrap ' +
                (isActive
                  ? 'bg-[#EF843C] text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200')}>
              {editingId === tab.id ? (
                <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                  onBlur={() => handleRename(tab.id)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(tab.id); if (e.key === 'Escape') setEditingId(null) }}
                  className="w-20 px-1 py-0 text-[11px] bg-transparent border-b border-current outline-none"
                  onClick={e => e.stopPropagation()} />
              ) : (
                <span className="max-w-[100px] truncate">{tab.name}</span>
              )}
              <button onClick={(e) => { e.stopPropagation(); onDelete(tab.id) }}
                className={'p-0.5 rounded transition-opacity ' + (tabs.length > 1 ? 'opacity-0 group-hover:opacity-100 ' : 'opacity-30 ') +
                  (isActive ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-700')}>
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )
        })}
      </div>
      {showScrollRight && (
        <button onClick={() => scroll(1)}
          className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      )}
      {creating ? (
        <input ref={createRef} value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="Tab name..." autoFocus
          onKeyDown={e => { if (e.key === 'Enter') { onAdd(newName || 'New Tab'); setCreating(false); setNewName('') } if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
          onBlur={() => { if (newName.trim()) { onAdd(newName.trim()); setNewName('') }; setCreating(false) }}
          className="w-20 px-2 py-1 text-[11px] bg-zinc-50 dark:bg-zinc-800/60 rounded-lg outline-none border border-zinc-200 dark:border-zinc-700 focus:border-[#EF843C]/50 transition-colors" />
      ) : (
        <button onClick={() => setCreating(true)}
          className="p-1 rounded text-zinc-400 hover:text-[#EF843C] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
          title="Create New Dashboard">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      )}
    </div>
  )
}