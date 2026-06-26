import React, { useState, useRef, useEffect } from 'react'

export default function DashboardFolderSelector({ folders, activeFolderId, onSelect, onNewFolder, onEditFolder, onDeleteFolder }) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)
  const createRef = useRef(null)

  const active = folders.find(f => f.id === activeFolderId)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { if (editingId && inputRef.current) inputRef.current.focus() }, [editingId])
  useEffect(() => { if (creating && createRef.current) createRef.current.focus() }, [creating])

  const startEdit = (f, e) => {
    e.stopPropagation()
    setEditingId(f.id)
    setEditName(f.name)
  }

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      onEditFolder({ id: editingId, name: editName.trim() })
    }
    setEditingId(null)
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#1a1d27] border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap">
        <span className="max-w-[140px] truncate">{active?.name || 'Select Folder'}</span>
        <svg className="w-3 h-3 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-[60] w-64 bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xl overflow-hidden" style={{ maxHeight: '500px' }}>
          <div className="overflow-y-auto" style={{ maxHeight: '500px', padding: '4px' }}>
            {creating ? (
              <div className="px-3 py-2">
                <input ref={createRef} value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Folder name..." autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') { onNewFolder(newName || 'New Folder'); setCreating(false); setNewName('') } if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
                  onBlur={() => { if (newName.trim()) { onNewFolder(newName.trim()); setNewName('') }; setCreating(false) }}
                  className="w-full px-2 py-1.5 text-[11px] bg-zinc-50 dark:bg-zinc-800/60 rounded-lg outline-none border border-zinc-200 dark:border-zinc-700 focus:border-[#EF843C]/50 transition-colors" />
              </div>
            ) : (
              <button onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New
              </button>
            )}

            <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />

            {folders.map(f => {
              const isActive = f.id === activeFolderId
              const canEdit = !f.system
              return (
                <div key={f.id}
                  className={'group flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer transition-colors ' + (isActive ? 'bg-[#EF843C]/10 border-l-2 border-[#EF843C]' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 border-l-2 border-transparent')}
                  onClick={() => { onSelect(f.id); setOpen(false) }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {f.system && (
                        <svg className="w-3 h-3 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      )}
                      {editingId === f.id ? (
                        <input ref={inputRef} value={editName} onChange={e => setEditName(e.target.value)}
                          onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                          onClick={e => e.stopPropagation()}
                          className="w-full px-1 py-0 text-[11px] font-medium bg-transparent border-b border-[#EF843C] outline-none text-zinc-700 dark:text-zinc-200" />
                      ) : (
                        <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-200 truncate">{f.name}</span>
                      )}
                    </div>
                    <div className="text-[9px] text-zinc-400">{f.tabs?.length || 0} tabs</div>
                  </div>
                  {canEdit && (
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                      <button onClick={(e) => startEdit(f, e)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(f.id) }}
                        className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
