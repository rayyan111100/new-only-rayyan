import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAllGroups, createGroup, updateGroup, deleteGroup, getAllRules, updateRule } from '../services/ruleStorage'
import ResizablePanel from '../components/ResizablePanel'

export default function RuleGroupsTab() {
  const [groups, setGroups] = useState([])
  const [rules, setRules] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [groupSearch, setGroupSearch] = useState('')

  const refresh = useCallback(() => {
    setGroups(getAllGroups())
    setRules(getAllRules())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const selected = groups.find(g => g.id === selectedId)

  function handleSelect(id) {
    if (editing) handleSave()
    setSelectedId(id)
    const g = getAllGroups().find(x => x.id === id)
    setEditing(g ? { ...g } : null)
    if (window.innerWidth < 1024) setSidebarOpen(false)
  }

  function handleNew() {
    if (editing) handleSave()
    const g = createGroup({ name: 'New Group' })
    refresh()
    setSelectedId(g.id)
    setEditing({ ...g })
    if (window.innerWidth < 1024) setSidebarOpen(false)
  }

  function handleSave() {
    if (!editing?.id) return
    updateGroup(editing.id, {
      name: editing.name,
      description: editing.description,
    })
    refresh()
  }

  function handleDelete() {
    if (!editing?.id) return
    deleteGroup(editing.id)
    setSelectedId(null)
    setEditing(null)
    refresh()
  }

  function toggleRuleGroup(ruleId, groupId) {
    const rule = rules.find(r => r.id === ruleId)
    if (!rule) return
    const groupIds = rule.groupIds || []
    const updated = groupIds.includes(groupId)
      ? groupIds.filter(gid => gid !== groupId)
      : [...groupIds, groupId]
    updateRule(ruleId, { groupIds: updated })
    refresh()
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc] dark:bg-[#0e0f14]">
      <header className="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs border-b border-[#e5e7eb] dark:border-[#2d3140] bg-white dark:bg-[#16181f]">
        <button onClick={() => setSidebarOpen(o => !o)} className="p-1 -ml-1 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors shrink-0"
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
          <svg className="w-4 h-4 text-[#6b7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {sidebarOpen ? <path d="M9 5l7 7-7 7"/> : <path d="M15 19l-7-7 7-7"/>}
          </svg>
        </button>
        <span className="font-semibold text-soc-stext dark:text-soc-darkstext flex items-center gap-1.5 shrink-0">
          <svg className="w-3.5 h-3.5 text-[#EF843C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          <span className="hidden sm:inline">Rule Groups</span>
        </span>
        <span className="text-[#9ca3af] dark:text-[#6b7280] ml-1">{groups.length} groups</span>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <ResizablePanel visible={sidebarOpen} defaultWidth={224} minWidth={160} maxWidth={400} storageKey="rg_sidebar_w">
          <div className="p-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">
            <button onClick={handleNew} className="gbtn text-xs w-full flex items-center justify-center gap-1.5 bg-[#EF843C] text-white hover:bg-[#e0752a] active:bg-[#c85a14] shadow-sm transition-all">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              New Group
            </button>
          </div>
            <div className="px-3 pt-1.5">
              <div className="relative">
                <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input value={groupSearch} onChange={e => setGroupSearch(e.target.value)}
                  className="w-full bg-[#f3f4f6] dark:bg-[#2d3140] border border-transparent rounded-lg pl-7 pr-2 py-1 text-[10px] outline-none text-soc-stext dark:text-soc-darkstext placeholder-[#9ca3af] focus:border-[#EF843C]/30 transition-colors"
                  placeholder="Search groups..." />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {groups.filter(g => !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase())).length === 0 && (
                <div className="flex flex-col items-center gap-2 text-[#9ca3af] text-xs text-center py-10 px-4">
                  <svg className="w-8 h-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                  {groupSearch ? 'No groups match your search' : 'No groups yet'}
                </div>
              )}
              {groups.filter(g => !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase())).map(g => {
                const ruleCount = rules.filter(r => (r.groupIds || []).includes(g.id)).length
                return (
                  <button key={g.id} onClick={() => handleSelect(g.id)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left transition-all duration-150 border-l-2 ${
                      selectedId === g.id
                        ? 'bg-soc-blue/5 dark:bg-blue-500/10 text-soc-blue dark:text-blue-400 border-l-soc-blue dark:border-l-blue-400'
                            : 'text-soc-stext dark:text-soc-darkstext hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] border-l-transparent'
                        }`}>
                        <span className="flex-1 truncate font-medium">{g.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                          selectedId === g.id
                            ? 'bg-soc-blue/10 dark:bg-blue-500/20 text-soc-blue dark:text-blue-400'
                            : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#9ca3af] dark:text-[#6b7280]'
                        }`}>{ruleCount}</span>
                      </button>
                    )
                  })}
                </div>
        </ResizablePanel>
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {!editing ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-sm text-[#9ca3af] gap-3">
              <svg className="w-12 h-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              <span>Select a group or create a new one</span>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-4 sm:space-y-5 pb-28">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] px-4 py-3 shadow-sm">
                <div className="flex-1 w-full sm:w-auto">
                  <input className="ginput w-full text-sm font-semibold py-2" value={editing.name}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    onBlur={handleSave} placeholder="Group name" />
                </div>
                <span className="text-[10px] text-[#9ca3af] font-mono whitespace-nowrap">ID: {editing.id}</span>
              </div>

              <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>
                    <span className="text-[11px] uppercase font-semibold text-[#9ca3af] tracking-wider">Details</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4 space-y-3">
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-[#9ca3af] tracking-wider block mb-1">Description</label>
                    <textarea className="ginput w-full p-2 text-xs leading-relaxed resize-none" rows={2}
                      value={editing.description || ''}
                      onChange={e => setEditing({ ...editing, description: e.target.value })}
                      onBlur={handleSave} placeholder="Optional description..." />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                    <span className="text-[11px] uppercase font-semibold text-[#9ca3af] tracking-wider">Assigned Rules</span>
                    <span className="text-[10px] text-[#9ca3af] bg-[#f3f4f6] dark:bg-[#2d3140] px-1.5 py-0.5 rounded-full font-medium">
                      {rules.filter(r => (r.groupIds || []).includes(editing.id)).length}
                    </span>
                  </div>
                </div>
                <div className="p-3 sm:p-4">
                  {rules.length === 0 ? (
                    <div className="text-xs text-[#9ca3af] py-6 text-center italic">No rules yet</div>
                  ) : (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {rules.map(r => {
                        const inGroup = (r.groupIds || []).includes(editing.id)
                        return (
                          <div key={r.id} onClick={() => toggleRuleGroup(r.id, editing.id)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs cursor-pointer transition-all ${
                              inGroup
                                ? 'bg-[#EF843C]/5 dark:bg-[#EF843C]/10 border border-[#EF843C]/20 dark:border-[#EF843C]/30'
                                : 'hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] border border-transparent'
                            }`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                              inGroup
                                ? 'bg-[#EF843C] border-[#EF843C]'
                                : 'border-[#d1d5db] dark:border-[#4b5563]'
                            }`}>
                              {inGroup && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5"/></svg>}
                            </div>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${r.enabled ? 'bg-green-500' : 'bg-[#d1d5db] dark:bg-[#4b5563]'}`} />
                            <span className="flex-1 truncate font-medium text-soc-stext dark:text-soc-darkstext">{r.name}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              inGroup
                                ? 'bg-[#EF843C]/10 text-[#EF843C]'
                                : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#9ca3af] dark:text-[#6b7280]'
                            }`}>{inGroup ? 'Assigned' : 'Add'}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#16181f]/95 backdrop-blur border-t border-[#e5e7eb] dark:border-[#2d3140] px-3 sm:px-5 py-3 flex items-center gap-2 sm:gap-3 z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
                <button onClick={handleDelete} className="gbtn text-xs flex items-center gap-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 dark:hover:border-red-800/40 px-3 sm:px-4 transition-all">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  <span className="hidden sm:inline">Delete Group</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
