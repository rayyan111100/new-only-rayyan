import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAllGroups, getAllRules, getRule, updateRule } from '../services/ruleStorage'
import { createGroup, updateGroup, deleteGroup, getGroupStats } from '../services/ruleGroupManager'
import { useToast } from '../context/ToastContext'

function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-xl p-5 max-w-sm w-full mx-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-soc-stext dark:text-soc-darkstext mb-2">{title}</h3>
        <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mb-4">{message}</p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="gbtn text-xs px-3 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-colors">Cancel</button>
          <button onClick={onConfirm} className="gbtn text-xs px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

function EditGroupModal({ open, group, onSave, onCancel }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (group) { setName(group.name); setDescription(group.description || '') }
  }, [group])

  if (!open || !group) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-xl p-5 max-w-sm w-full mx-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-soc-stext dark:text-soc-darkstext mb-3">Edit Group</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase font-semibold text-[#9ca3af] tracking-wider block mb-1">Name</label>
            <input className="ginput w-full text-xs py-1.5 px-2" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-[#9ca3af] tracking-wider block mb-1">Description</label>
            <textarea className="ginput w-full text-xs p-2 resize-none" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={onCancel} className="gbtn text-xs px-3 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-colors">Cancel</button>
          <button onClick={() => onSave({ name, description })} className="gbtn text-xs px-3 py-1.5 bg-[#EF843C] text-white hover:bg-[#e0752a] transition-colors">Save</button>
        </div>
      </div>
    </div>
  )
}

function ContextMenu({ x, y, group, onClose, onEdit, onDelete, onSelectAll, onDeselectAll }) {
  const ref = useRef(null)
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (!group) return null
  return (
    <div ref={ref} style={{ position: 'fixed', top: y, left: x, zIndex: 60 }}
      className="bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg shadow-xl py-1 min-w-[160px]">
      <button onClick={() => { onEdit(group); onClose() }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext flex items-center gap-2 transition-colors">
        <svg className="w-3.5 h-3.5 text-[#6b7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        Edit Group
      </button>
      <button onClick={() => { onSelectAll(group); onClose() }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext flex items-center gap-2 transition-colors">
        <svg className="w-3.5 h-3.5 text-[#6b7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
        Select All Rules
      </button>
      <button onClick={() => { onDeselectAll(group); onClose() }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext flex items-center gap-2 transition-colors">
        <svg className="w-3.5 h-3.5 text-[#6b7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        Deselect All Rules
      </button>
      <div className="h-px bg-[#e5e7eb] dark:bg-[#2d3140] my-1" />
      <button onClick={() => { onDelete(group); onClose() }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2 transition-colors">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        Delete Group
      </button>
    </div>
  )
}

export default function GroupSidebar({
  selectedGroupId,
  onSelectGroup,
  onSelectedRulesChange,
  className = ''
}) {
  const [groups, setGroups] = useState([])
  const [rules, setRules] = useState([])
  const [stats, setStats] = useState([])
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, group: null })
  const [dragIndex, setDragIndex] = useState(null)
  const [dropIndex, setDropIndex] = useState(null)
  const toast = useToast()

  const refresh = useCallback(() => {
    setGroups(getAllGroups())
    setRules(getAllRules())
    setStats(getGroupStats())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  function handleSelect(id) {
    onSelectGroup(id === selectedGroupId ? null : id)
  }

  function handleCreate() {
    const g = createGroup('New Group', '', GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)])
    refresh()
    onSelectGroup(g.id)
    toast.success(`Created group "${g.name}"`)
  }

  function handleEditSave(updates) {
    if (editingGroup) {
      updateGroup(editingGroup.id, updates)
      setShowEditModal(false)
      setEditingGroup(null)
      refresh()
      toast.success(`Updated group "${editingGroup.name}"`)
    }
  }

  function handleDeleteConfirm() {
    if (deleteTarget) {
      const deletedGroup = { ...deleteTarget }
      const rulesWithGroup = getAllRules().filter(r => (r.groupIds || []).includes(deletedGroup.id))
      const prevRuleGroupIds = rulesWithGroup.map(r => ({ id: r.id, gids: [...(r.groupIds || [])] }))
      deleteGroup(deletedGroup.id)
      if (selectedGroupId === deletedGroup.id) onSelectGroup(null)
      setDeleteTarget(null)
      refresh()
      toast.notifyOperation(`Deleted group "${deletedGroup.name}"`, 'deleteGroup', () => {
        createGroup({ ...deletedGroup })
        for (const p of prevRuleGroupIds) updateRule(p.id, { groupIds: p.gids })
        refresh()
      })
    }
  }

  function handleContextMenu(e, group) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, group })
  }

  function handleDragStart(e, idx) {
    setDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    setDropIndex(idx)
  }

  function handleDragLeave() {
    setDropIndex(null)
  }

  function handleDrop(e) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) { setDragIndex(null); setDropIndex(null); return }
    const reordered = [...groups]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(dropIndex, 0, moved)
    reordered.forEach((g, i) => updateGroup(g.id, { order: i }))
    setGroups(reordered)
    setDragIndex(null)
    setDropIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDropIndex(null)
  }

  function handleSelectAll(group) {
    const groupRuleIds = rules.filter(r => (r.groupIds || []).includes(group.id)).map(r => r.id)
    if (onSelectedRulesChange) onSelectedRulesChange(groupRuleIds)
  }

  function handleDeselectAll(group) {
    const groupRuleIds = rules.filter(r => (r.groupIds || []).includes(group.id)).map(r => r.id)
    const allSelected = rules.map(r => r.id)
    const deselected = allSelected.filter(id => !groupRuleIds.includes(id))
    if (onSelectedRulesChange) onSelectedRulesChange(deselected)
  }

  const filter = search.toLowerCase()
  const ungroupedCount = rules.filter(r => !r.groupIds || r.groupIds.length === 0).length
  const totalEnabled = rules.filter(r => r.enabled).length
  const totalDisabled = rules.filter(r => !r.enabled).length
  const filteredStats = filter
    ? stats.filter(s => s.name.toLowerCase().includes(filter))
    : stats

  return (
    <>
      <aside className={`bg-white dark:bg-[#16181f] border-r border-[#e5e7eb] dark:border-[#2d3140] flex flex-col ${collapsed ? 'w-12' : 'w-56'} transition-all duration-200 shrink-0 ${className}`}>
        <div className="flex items-center justify-between px-3 h-11 border-b border-[#e5e7eb] dark:border-[#2d3140]">
          {!collapsed && <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-widest">Groups</span>}
          <button onClick={() => setCollapsed(o => !o)} className="p-1.5 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-[#6b7280] transition-colors ml-auto">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              {collapsed ? <path d="M9 18l6-6-6-6"/> : <path d="M15 18l-6-6 6-6"/>}
            </svg>
          </button>
        </div>

        {!collapsed && (
          <div className="px-3 pt-2 pb-1">
            <div className="relative">
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9ca3af] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input className="w-full bg-[#f3f4f6] dark:bg-[#0f1117] border border-transparent focus:border-[#EF843C]/30 rounded-lg pl-7 pr-2 py-1.5 text-[11px] outline-none text-soc-stext dark:text-soc-darkstext placeholder:text-[#9ca3af] transition-colors"
                placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-1 px-2 space-y-0.5">
          {!collapsed && (
            <>
              <button onClick={() => onSelectGroup(null)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
                  !selectedGroupId
                    ? 'bg-[#EF843C]/10 text-[#EF843C] dark:text-[#EF843C] dark:bg-[#EF843C]/10'
                    : 'text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'
                }`}>
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                <span className="flex-1 truncate">All Rules</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                  !selectedGroupId ? 'bg-[#EF843C]/10 text-[#EF843C]' : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#9ca3af] dark:text-[#6b7280]'
                }`}>{rules.length}</span>
              </button>

              <button onClick={() => onSelectGroup('__ungrouped__')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
                  selectedGroupId === '__ungrouped__'
                    ? 'bg-[#8b5cf6]/10 text-[#8b5cf6] dark:text-[#a78bfa] dark:bg-[#a78bfa]/10'
                    : 'text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'
                }`}>
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6l6-4 6 4 6-4v16l-6 4-6-4-6 4V6z"/><path d="M8 2v16M16 2v16"/></svg>
                <span className="flex-1 truncate">Ungrouped</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                  selectedGroupId === '__ungrouped__' ? 'bg-[#8b5cf6]/10 text-[#8b5cf6]' : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#9ca3af] dark:text-[#6b7280]'
                }`}>{ungroupedCount}</span>
              </button>

              <div className="h-px bg-[#e5e7eb] dark:bg-[#2d3140] my-1.5 mx-1" />
            </>
          )}

          {collapsed ? (
            <>
              <button onClick={() => onSelectGroup(null)} title="All Rules"
                className={`w-full flex items-center justify-center px-1 py-2 text-xs rounded-lg transition-all ${
                  !selectedGroupId ? 'bg-[#EF843C]/10 text-[#EF843C]' : 'text-[#6b7280] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'}`}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              </button>
              {groups.map(g => (
                <button key={g.id} onClick={() => handleSelect(g.id)} title={g.name}
                  className={`w-full flex items-center justify-center px-1 py-2 rounded-lg transition-all ${
                    selectedGroupId === g.id ? 'bg-[#EF843C]/10' : 'hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'}`}>

                </button>
              ))}
            </>
          ) : (
            filteredStats.map((s, idx) => (
              <div key={s.id}
                draggable
                onDragStart={e => handleDragStart(e, idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onContextMenu={e => handleContextMenu(e, s)}
                className={`group relative ${dropIndex === idx ? 'border-t-2 border-[#EF843C]' : ''}`}>
                <button onClick={() => handleSelect(s.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg transition-all duration-150 pr-8 ${
                    selectedGroupId === s.id
                      ? 'bg-[#EF843C]/10 text-[#EF843C] dark:text-[#EF843C] dark:bg-[#EF843C]/10'
                      : 'text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'
                  }`}>
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    selectedGroupId === s.id ? 'bg-[#EF843C]/10 text-[#EF843C]' : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#9ca3af] dark:text-[#6b7280]'
                  }`}>{s.ruleCount}</span>
                </button>
                <button onClick={e => handleContextMenu(e, s)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#9ca3af] transition-all">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
                <div className="flex items-center gap-2 px-2.5 pb-1.5 -mt-0.5">
                  <span className={`text-[8px] font-medium ${s.enabledCount > 0 ? 'text-green-500' : 'text-[#d1d5db] dark:text-[#4b5563]'}`}>{s.enabledCount} on</span>
                  <span className="text-[#d1d5db] dark:text-[#4b5563] text-[8px]">/</span>
                  <span className={`text-[8px] font-medium ${s.disabledCount > 0 ? 'text-[#9ca3af]' : 'text-[#d1d5db] dark:text-[#4b5563]'}`}>{s.disabledCount} off</span>
                </div>
              </div>
            ))
          )}
        </nav>

        {!collapsed && (
          <div className="p-3 border-t border-[#e5e7eb] dark:border-[#2d3140] space-y-2">
            <div className="flex items-center justify-between text-[10px] text-[#9ca3af] px-1">
              <span>All Rules</span>
              <span>{totalEnabled} on / {totalDisabled} off</span>
            </div>
            <button onClick={handleCreate}
              className="gbtn text-xs w-full flex items-center justify-center gap-1.5 bg-[#EF843C] text-white hover:bg-[#e0752a] active:bg-[#c85a14] shadow-sm transition-all">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Create New Group
            </button>
          </div>
        )}
      </aside>

      <ContextMenu
        x={contextMenu.x} y={contextMenu.y}
        group={contextMenu.group}
        onClose={() => setContextMenu({ x: 0, y: 0, group: null })}
        onEdit={g => { setEditingGroup(g); setShowEditModal(true) }}
        onDelete={g => setDeleteTarget(g)}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
      />

      <EditGroupModal
        open={showEditModal}
        group={editingGroup}
        onSave={handleEditSave}
        onCancel={() => { setShowEditModal(false); setEditingGroup(null) }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Group"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? The rules in this group will not be deleted, only the group assignment will be removed.` : ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
