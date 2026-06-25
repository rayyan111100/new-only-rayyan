import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import {
  getAllGroups, getGroup, updateGroup, deleteGroup, createGroup,
  getAllRules, getRule, updateRule, deleteRule
} from '../services/ruleStorage'
import {
  addRulesToGroup, removeRulesFromGroup, moveRulesToGroup, getGroupStats
} from '../services/ruleGroupManager'
import GroupBulkActions from '../components/GroupBulkActions'

const GROUP_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#84CC16', // Lime
  '#22C55E', // Green
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#6B7280', // Gray
]

function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-xl p-5 max-w-sm w-full mx-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-soc-stext dark:text-soc-darkstext mb-2">{title}</h3>
        <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mb-4">{message}</p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="gbtn text-xs px-3 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`gbtn text-xs px-3 py-1.5 transition-colors ${confirmLabel?.includes('Delete') ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#EF843C] text-white hover:bg-[#e0752a]'}`}>{confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>
  )
}

function MergeDialog({ open, sourceGroup, groups, onMerge, onCancel }) {
  const [targetId, setTargetId] = useState('')
  const [strategy, setStrategy] = useState('move')
  if (!open || !sourceGroup) return null
  const available = groups.filter(g => g.id !== sourceGroup.id)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-xl p-5 max-w-sm w-full mx-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-soc-stext dark:text-soc-darkstext mb-2">Merge Groups</h3>
        <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mb-3">Merge <strong>{sourceGroup.name}</strong> into another group</p>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase font-semibold text-[#9ca3af] tracking-wider block mb-1">Target Group</label>
            <select value={targetId} onChange={e => setTargetId(e.target.value)}
              className="ginput w-full text-xs py-1.5 px-2">
              <option value="">Select a group...</option>
              {available.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-[#9ca3af] tracking-wider block mb-1">Strategy</label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" name="strategy" value="move" checked={strategy === 'move'} onChange={() => setStrategy('move')}
                  className="text-[#EF843C] focus:ring-[#EF843C]/30" />
                <span className="text-soc-stext dark:text-soc-darkstext">Move all rules to target (deletes source)</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" name="strategy" value="copy" checked={strategy === 'copy'} onChange={() => setStrategy('copy')}
                  className="text-[#EF843C] focus:ring-[#EF843C]/30" />
                <span className="text-soc-stext dark:text-soc-darkstext">Copy rules to target (keeps both groups)</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={onCancel} className="gbtn text-xs px-3 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-colors">Cancel</button>
          <button onClick={() => onMerge(targetId, strategy)} disabled={!targetId}
            className="gbtn text-xs px-3 py-1.5 bg-[#EF843C] text-white hover:bg-[#e0752a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Merge</button>
        </div>
      </div>
    </div>
  )
}

export default function GroupRulesTab() {
  const [groups, setGroups] = useState([])
  const [rules, setRules] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [selectedRuleIds, setSelectedRuleIds] = useState([])
  const [mergeSource, setMergeSource] = useState(null)
  const [showMerge, setShowMerge] = useState(false)
  const [copyTargetOpen, setCopyTargetOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [expandedGroupId, setExpandedGroupId] = useState(null)

  const refresh = useCallback(() => {
    setGroups(getAllGroups())
    setRules(getAllRules())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const selectedGroup = groups.find(g => g.id === selectedGroupId)
  const groupRules = selectedGroupId
    ? rules.filter(r => (r.groupIds || []).includes(selectedGroupId))
    : []
  const ungroupedRules = rules.filter(r => !r.groupIds || r.groupIds.length === 0)
  const stats = getGroupStats()
  const groupMap = Object.fromEntries(groups.map(g => [g.id, g]))

  function toggleRuleSelection(id) {
    setSelectedRuleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleSelectAll() {
    if (groupRules.every(r => selectedRuleIds.includes(r.id))) {
      setSelectedRuleIds([])
    } else {
      setSelectedRuleIds(groupRules.map(r => r.id))
    }
  }

  function handleGroupSelect(id) {
    setSelectedGroupId(id)
    setSelectedRuleIds([])
    setExpandedGroupId(id)
  }

  function handleCreateGroup() {
    const g = createGroup('New Group', '', GROUP_COLORS[groups.length % GROUP_COLORS.length])
    refresh()
    setSelectedGroupId(g.id)
  }

  function handleDeleteGroup(id) {
    deleteGroup(id)
    if (selectedGroupId === id) setSelectedGroupId(null)
    setDeleteConfirm(null)
    refresh()
  }

  function handleMergeGroup(targetId, strategy) {
    if (!mergeSource || !targetId) return
    const sourceRules = rules.filter(r => (r.groupIds || []).includes(mergeSource.id))
    const sourceRuleIds = sourceRules.map(r => r.id)

    if (strategy === 'move') {
      moveRulesToGroup(mergeSource.id, targetId, sourceRuleIds)
      deleteGroup(mergeSource.id)
    } else {
      addRulesToGroup(targetId, sourceRuleIds)
    }
    setShowMerge(false)
    setMergeSource(null)
    setSelectedGroupId(targetId)
    refresh()
  }

  function handleExportGroup() {
    if (!selectedGroup) return
    const data = { group: selectedGroup, rules: groupRules }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `group_${selectedGroup.name.replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportToGroup() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = e => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result)
          const importedRules = data.rules || (Array.isArray(data) ? data : [data])
          for (const rule of importedRules) {
            const existing = getRule(rule.id)
            if (existing) {
              const gids = (existing.groupIds || []).includes(selectedGroupId)
                ? existing.groupIds
                : [...(existing.groupIds || []), selectedGroupId]
              updateRule(rule.id, { ...rule, groupIds: gids })
            } else {
              updateRule(null, { ...rule, groupIds: [selectedGroupId] })
            }
          }
          refresh()
        } catch (err) {
          alert('Invalid JSON file: ' + err.message)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  function handleCopyToGroup(ruleId, targetGroupId) {
    const rule = getRule(ruleId)
    if (!rule) return
    const gids = (rule.groupIds || []).includes(targetGroupId)
      ? rule.groupIds
      : [...(rule.groupIds || []), targetGroupId]
    updateRule(ruleId, { groupIds: gids })
    refresh()
    setCopyTargetOpen(null)
  }

  function handleMoveToGroup(ruleId, targetGroupId) {
    if (!selectedGroupId) return
    const rule = getRule(ruleId)
    if (!rule) return
    const gids = (rule.groupIds || [])
      .filter(gid => gid !== selectedGroupId)
    if (!gids.includes(targetGroupId)) gids.push(targetGroupId)
    updateRule(ruleId, { groupIds: gids })
    refresh()
  }

  function handleRemoveFromGroup(ruleId) {
    if (!selectedGroupId) return
    const rule = getRule(ruleId)
    if (!rule) return
    updateRule(ruleId, { groupIds: (rule.groupIds || []).filter(gid => gid !== selectedGroupId) })
    refresh()
  }

  function handleDropOnGroup(e, groupId) {
    e.preventDefault()
    const ruleId = e.dataTransfer.getData('text/plain')
    if (ruleId) {
      addRulesToGroup(groupId, [ruleId])
      refresh()
    }
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const pieData = selectedGroup ? [
    { name: 'Enabled', value: groupRules.filter(r => r.enabled).length, color: '#22c55e' },
    { name: 'Disabled', value: groupRules.filter(r => !r.enabled).length, color: '#6b7280' }
  ].filter(d => d.value > 0) : []

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc] dark:bg-[#0e0f14]">
      <header className="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs border-b border-[#e5e7eb] dark:border-[#2d3140] bg-white dark:bg-[#16181f]">
        <span className="font-semibold text-soc-stext dark:text-soc-darkstext flex items-center gap-1.5 shrink-0">
          <svg className="w-3.5 h-3.5 text-[#EF843C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          <span className="hidden sm:inline">Group Rules</span>
        </span>
        <span className="text-[#9ca3af] ml-1">{groups.length} groups</span>
        <span className="text-[#9ca3af] ml-1">·</span>
        <span className="text-[#9ca3af]">{ungroupedRules.length} ungrouped</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={handleCreateGroup}
            className="gbtn text-xs flex items-center gap-1 bg-[#EF843C] text-white hover:bg-[#e0752a] px-2.5 py-1.5 shadow-sm transition-all">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            <span className="hidden sm:inline">New Group</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-52 lg:w-52 border-r border-[#e5e7eb] dark:border-[#2d3140] bg-white dark:bg-[#16181f] flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto py-1">
            <button onClick={() => handleGroupSelect(null)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-all duration-150 ${
                !selectedGroupId ? 'bg-[#EF843C]/10 text-[#EF843C]' : 'text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'
              }`}>
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              <span className="flex-1 truncate">Ungrouped</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                !selectedGroupId ? 'bg-[#EF843C]/10 text-[#EF843C]' : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#9ca3af]'
              }`}>{ungroupedRules.length}</span>
            </button>
            <div className="h-px bg-[#e5e7eb] dark:bg-[#2d3140] my-1 mx-2" />
            {groups.map(g => {
              const cnt = rules.filter(r => (r.groupIds || []).includes(g.id)).length
              const ecnt = rules.filter(r => (r.groupIds || []).includes(g.id) && r.enabled).length
              return (
                <div key={g.id} className="relative"
                  onDrop={e => handleDropOnGroup(e, g.id)}
                  onDragOver={handleDragOver}>
                  <button onClick={() => handleGroupSelect(g.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-all duration-150 border-l-2 ${
                      selectedGroupId === g.id
                        ? 'bg-soc-blue/5 dark:bg-blue-500/10 text-soc-blue dark:text-blue-400 border-l-soc-blue dark:border-l-blue-400'
                        : 'text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] border-l-transparent'
                    }`}>
                    <span className="flex-1 truncate">{g.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      selectedGroupId === g.id ? 'bg-soc-blue/10 dark:bg-blue-500/20 text-soc-blue' : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#9ca3af]'
                    }`}>{cnt}</span>
                  </button>
                  {cnt > 0 && <div className="flex items-center gap-1 px-3 pb-1.5 -mt-0.5">
                    <span className="text-[8px] font-medium text-green-500">{ecnt} on</span>
                    <span className="text-[#d1d5db] text-[8px]">/</span>
                    <span className="text-[8px] font-medium text-[#9ca3af]">{cnt - ecnt} off</span>
                  </div>}
                </div>
              )
            })}
          </div>
          <div className="p-3 border-t border-[#e5e7eb] dark:border-[#2d3140]">
            <div className="flex items-center justify-between text-[10px] text-[#9ca3af] mb-2">
              <span>All Rules</span>
              <span>{rules.filter(r => r.enabled).length} on / {rules.filter(r => !r.enabled).length} off</span>
            </div>
          </div>
        </aside>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {!selectedGroup ? (
            <div className="flex flex-col items-center justify-center h-full text-sm text-[#9ca3af] gap-3">
              <svg className="w-12 h-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              {selectedGroupId === null ? (
                <span>Drag ungrouped rules onto a group to assign them</span>
              ) : (
                <span>Select a group to manage its rules</span>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-start gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-soc-stext dark:text-soc-darkstext truncate">{selectedGroup.name}</h2>
                    {selectedGroup.description && (
                      <p className="text-[10px] text-[#9ca3af] truncate mt-0.5">{selectedGroup.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-[#9ca3af] ml-auto shrink-0">
                    <span className="font-medium">{groupRules.length} rules</span>
                    <span className="text-green-500">{groupRules.filter(r => r.enabled).length} enabled</span>
                    <span>{groupRules.filter(r => !r.enabled).length} disabled</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={handleExportGroup} disabled={groupRules.length === 0}
                    className="gbtn text-[10px] px-2 py-1.5 flex items-center gap-1 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#6b7280] transition-all disabled:opacity-40">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5m-5 5V3"/></svg>
                    Export
                  </button>
                  <button onClick={handleImportToGroup}
                    className="gbtn text-[10px] px-2 py-1.5 flex items-center gap-1 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#6b7280] transition-all">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5m-5 5V3"/></svg>
                    Import
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowMerge(!showMerge)}
                      className="gbtn text-[10px] px-2 py-1.5 flex items-center gap-1 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#6b7280] transition-all">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7l4-4 4 4m-4 14V3"/></svg>
                      Merge
                    </button>
                    {showMerge && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowMerge(false)} />
                        <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg shadow-xl py-1 min-w-[160px]">
                          {groups.filter(g => g.id !== selectedGroup.id).map(g => (
                            <button key={g.id} onClick={() => { setMergeSource(selectedGroup); setShowMerge(false); setTimeout(() => setShowMerge(true), 50) }}
                              className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext flex items-center gap-2">
                              Merge into {g.name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <button onClick={() => setDeleteConfirm(selectedGroup)}
                    className="gbtn text-[10px] px-2 py-1.5 flex items-center gap-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 transition-all">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    Delete
                  </button>
                </div>
              </div>

              {(groupRules.length > 0 || ungroupedRules.length > 0) && (
                <div className="flex gap-4 flex-col lg:flex-row">
                  <div className="flex-1 min-w-0">
                    <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                          <span className="text-[11px] uppercase font-semibold text-[#9ca3af] tracking-wider">Rules</span>
                          <span className="text-[10px] text-[#9ca3af] bg-[#f3f4f6] dark:bg-[#2d3140] px-1.5 py-0.5 rounded-full font-medium">{groupRules.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-[10px] text-[#9ca3af] cursor-pointer">
                            <input type="checkbox" checked={groupRules.length > 0 && groupRules.every(r => selectedRuleIds.includes(r.id))}
                              onChange={toggleSelectAll}
                              className="w-3 h-3 rounded border-[#d1d5db] text-[#EF843C] focus:ring-[#EF843C]/30 cursor-pointer" />
                            Select All
                          </label>
                          {selectedRuleIds.length > 0 && (
                            <span className="text-[9px] text-[#EF843C] font-medium">{selectedRuleIds.length} selected</span>
                          )}
                        </div>
                      </div>
                      <div className="p-2 max-h-96 overflow-y-auto">
                        {groupRules.length === 0 ? (
                          <div className="text-xs text-[#9ca3af] py-6 text-center italic">No rules in this group yet</div>
                        ) : (
                          <div className="space-y-0.5">
                            {groupRules.map(r => {
                              const inSelection = selectedRuleIds.includes(r.id)
                              const otherGroupIds = (r.groupIds || []).filter(gid => gid !== selectedGroupId)
                              return (
                                <div key={r.id}
                                  draggable
                                  onDragStart={e => e.dataTransfer.setData('text/plain', r.id)}
                                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all group ${
                                    inSelection ? 'bg-[#EF843C]/5 dark:bg-[#EF843C]/10' : 'hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'
                                  }`}>
                                  <label className="flex items-center shrink-0" onClick={e => e.stopPropagation()}>
                                    <input type="checkbox" checked={inSelection} onChange={() => toggleRuleSelection(r.id)}
                                      className="w-3.5 h-3.5 rounded border-[#d1d5db] dark:border-[#4b5563] text-[#EF843C] focus:ring-[#EF843C]/30 cursor-pointer" />
                                  </label>
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.enabled ? 'bg-green-500' : 'bg-[#d1d5db] dark:bg-[#4b5563]'}`} />
                                  <span className="flex-1 truncate font-medium text-soc-stext dark:text-soc-darkstext">{r.name}</span>
                                  <div className="flex items-center gap-1">
                                    {otherGroupIds.slice(0, 2).map(gid => {
                                      const og = groupMap[gid]
                                      if (!og) return null
                                      return (
                                        <span key={gid} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-medium text-[#6b7280] dark:text-[#9ca3af] bg-[#f3f4f6] dark:bg-[#2d3140] truncate max-w-[70px]">
                                          {og.name}
                                        </span>
                                      )
                                    })}
                                    {otherGroupIds.length > 2 && <span className="text-[8px] text-[#9ca3af]">+{otherGroupIds.length - 2}</span>}
                                  </div>
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                                    <div className="relative">
                                      <button onClick={() => setCopyTargetOpen(copyTargetOpen === r.id ? null : r.id)}
                                        className="p-1 rounded hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#9ca3af]" title="Copy to group">
                                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                      </button>
                                      {copyTargetOpen === r.id && (
                                        <>
                                          <div className="fixed inset-0 z-30" onClick={() => setCopyTargetOpen(null)} />
                                          <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg shadow-xl py-1 min-w-[150px]">
                                            {groups.filter(g => g.id !== selectedGroupId).map(g => (
                                              <button key={g.id} onClick={() => handleCopyToGroup(r.id, g.id)}
                                                className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext flex items-center gap-2">
                                                {g.name}
                                              </button>
                                            ))}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    <button onClick={() => handleMoveToGroup(r.id, selectedGroupId)}
                                      className="p-1 rounded hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#9ca3af]" title="Move to group">
                                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7l4-4 4 4m-4 14V3"/></svg>
                                    </button>
                                    <button onClick={() => handleRemoveFromGroup(r.id)}
                                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[#9ca3af] hover:text-red-500" title="Remove from group">
                                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="w-full lg:w-48 shrink-0 space-y-3">
                    <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-sm p-3">
                      <h3 className="text-[10px] uppercase font-semibold text-[#9ca3af] tracking-wider mb-2">Rule Status</h3>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 shrink-0">
                          {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={18} outerRadius={30} dataKey="value" paddingAngle={2}>
                                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#d1d5db]">
                              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/></svg>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-soc-stext dark:text-soc-darkstext">{pieData.find(d => d.name === 'Enabled')?.value || 0}</span>
                            <span className="text-[#9ca3af]">enabled</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#6b7280]" />
                            <span className="text-soc-stext dark:text-soc-darkstext">{pieData.find(d => d.name === 'Disabled')?.value || 0}</span>
                            <span className="text-[#9ca3af]">disabled</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-sm p-3">
                      <h3 className="text-[10px] uppercase font-semibold text-[#9ca3af] tracking-wider mb-2">Ungrouped Rules</h3>
                      <p className="text-xs text-[#9ca3af] mb-2">Drag rules onto a group in the sidebar</p>
                      <div className="max-h-40 overflow-y-auto space-y-0.5">
                        {ungroupedRules.length === 0 ? (
                          <div className="text-[10px] text-[#9ca3af] italic">All rules are grouped</div>
                        ) : (
                          ungroupedRules.slice(0, 10).map(r => (
                            <div key={r.id} draggable
                              onDragStart={e => e.dataTransfer.setData('text/plain', r.id)}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] cursor-grab active:cursor-grabbing transition-colors">
                              <svg className="w-2.5 h-2.5 text-[#9ca3af] shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.enabled ? 'bg-green-500' : 'bg-[#d1d5db]'}`} />
                              <span className="truncate text-soc-stext dark:text-soc-darkstext">{r.name}</span>
                            </div>
                          ))
                        )}
                        {ungroupedRules.length > 10 && (
                          <div className="text-[9px] text-[#9ca3af] text-center pt-1">+{ungroupedRules.length - 10} more</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <GroupBulkActions
        selectedRuleIds={selectedRuleIds}
        visibleRuleIds={groupRules.map(r => r.id)}
        groupId={selectedGroupId}
        onSelectionChange={setSelectedRuleIds}
        onRefresh={refresh}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Group"
        message={deleteConfirm ? `Delete "${deleteConfirm.name}"? Rules will not be deleted, only group assignments removed.` : ''}
        confirmLabel={`Delete ${deleteConfirm?.name || ''}`}
        onConfirm={() => handleDeleteGroup(deleteConfirm?.id)}
        onCancel={() => setDeleteConfirm(null)}
      />

      <MergeDialog
        open={showMerge && mergeSource}
        sourceGroup={mergeSource}
        groups={groups}
        onMerge={handleMergeGroup}
        onCancel={() => { setShowMerge(false); setMergeSource(null) }}
      />
    </div>
  )
}
