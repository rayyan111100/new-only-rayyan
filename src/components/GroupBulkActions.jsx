import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAllGroups, getRule, updateRule } from '../services/ruleStorage'
import { addRulesToGroup, removeRulesFromGroup, moveRulesToGroup } from '../services/ruleGroupManager'
import { useToast } from '../context/ToastContext'

function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-xl p-5 max-w-sm w-full mx-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-soc-stext dark:text-soc-darkstext mb-2">{title}</h3>
        <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="gbtn text-xs px-3 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`gbtn text-xs px-3 py-1.5 transition-colors ${confirmLabel?.includes('Delete') ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#EF843C] text-white hover:bg-[#e0752a]'}`}>{confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>
  )
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-xl p-5 max-w-lg w-full mx-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-soc-stext dark:text-soc-darkstext">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-[#9ca3af] transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function flattenConditions(items) {
  const result = []
  for (const item of items) {
    if (item.type === 'group') result.push(...flattenConditions(item.conditions || item.items || []))
    else result.push(item)
  }
  return result
}

const SHORTCUTS = [
  { key: 'Ctrl+A', desc: 'Select all visible rules' },
  { key: 'Escape', desc: 'Clear selection' },
  { key: 'Delete', desc: 'Delete selected rules' },
  { key: '?', desc: 'Toggle keyboard shortcut guide' },
  { key: 'Ctrl+S', desc: 'Save current rule' },
  { key: 'Ctrl+Z', desc: 'Undo last operation' },
]

export default function GroupBulkActions({
  selectedRuleIds = [],
  visibleRuleIds = [],
  groupId,
  onSelectionChange,
  onRefresh
}) {
  const [groups, setGroups] = useState([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [addToGroupIds, setAddToGroupIds] = useState([])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [showTag, setShowTag] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showTest, setShowTest] = useState(false)
  const [findField, setFindField] = useState('')
  const [findValue, setFindValue] = useState('')
  const [replaceValue, setReplaceValue] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [testJson, setTestJson] = useState('')
  const [testResults, setTestResults] = useState(null)

  const toast = useToast()
  const refreshGroups = useCallback(() => setGroups(getAllGroups()), [])

  useEffect(() => { refreshGroups() }, [refreshGroups])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape' && !showShortcuts && !showFindReplace && !showExport && !showTest && !confirmDelete) { onSelectionChange([]) }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setShowShortcuts(o => !o) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); onSelectionChange([...visibleRuleIds]) }
      if (e.key === 'Delete' && selectedRuleIds.length > 0) { e.preventDefault(); setConfirmDelete(true) }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [selectedRuleIds, visibleRuleIds, onSelectionChange, showShortcuts, showFindReplace, showExport, showTest, confirmDelete])

  function runBulk(operation) {
    setBusy(true); setOpenDropdown(null); setProgress({ current: 0, total: selectedRuleIds.length })
    const ids = [...selectedRuleIds]; const total = ids.length
    const previousStates = ids.map(id => { const r = getRule(id); return r ? { id, enabled: r.enabled } : null }).filter(Boolean)
    setTimeout(() => {
      try {
        const rules = JSON.parse(localStorage.getItem('soc_rules') || '[]')
        const updated = rules.map(r => {
          if (!ids.includes(r.id)) return r
          switch (operation) {
            case 'delete': return null
            case 'enable': return { ...r, enabled: true, updatedAt: new Date().toISOString() }
            case 'disable': return { ...r, enabled: false, updatedAt: new Date().toISOString() }
            default: return r
          }
        }).filter(Boolean)
        localStorage.setItem('soc_rules', JSON.stringify(updated))
        setProgress({ current: total, total })
        if (onRefresh) onRefresh()
        if (operation === 'delete') {
          onSelectionChange([])
          toast.notifyOperation(`Deleted ${total} rules`, 'delete', () => {
            const restored = JSON.parse(localStorage.getItem('soc_rules') || '[]')
            for (const id of ids) { const r = previousStates.find(p => p.id === id); if (r && !restored.some(x => x.id === id)) restored.push(r) }
            localStorage.setItem('soc_rules', JSON.stringify(restored)); if (onRefresh) onRefresh()
          })
        } else {
          const label = operation === 'enable' ? 'Enabled' : 'Disabled'
          toast.notifyOperation(`${label} ${total} rule${total !== 1 ? 's' : ''}`, operation, () => {
            for (const p of previousStates) updateRule(p.id, { enabled: p.enabled }); if (onRefresh) onRefresh()
          })
        }
      } catch (e) { toast.error(`Bulk operation failed: ${e.message}`) }
      setBusy(false); setProgress({ current: 0, total: 0 })
    }, 50)
  }

  function handleClone() {
    setBusy(true)
    const ids = [...selectedRuleIds]; const rules = JSON.parse(localStorage.getItem('soc_rules') || '[]')
    const clones = []
    for (const r of rules) {
      if (!ids.includes(r.id)) continue
      const clone = { ...r, id: 'rule_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name: r.name + ' (Copy)', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      clones.push(clone)
    }
    localStorage.setItem('soc_rules', JSON.stringify([...rules, ...clones]))
    if (onRefresh) onRefresh()
    toast.success(`Cloned ${clones.length} rule${clones.length !== 1 ? 's' : ''}`)
    setBusy(false)
  }

  function handleFindReplace() {
    if (!findField || !findValue) { toast.error('Enter both field and value to find'); return }
    const ids = [...selectedRuleIds]; const rules = JSON.parse(localStorage.getItem('soc_rules') || '[]')
    let count = 0
    const updated = rules.map(r => {
      if (!ids.includes(r.id)) return r
      const conds = JSON.parse(JSON.stringify(r.conditions || []))
      const flat = flattenConditions(conds)
      let changed = false
      for (const c of flat) {
        if (c.field === findField && c.value && c.value.includes(findValue)) {
          c.value = c.value.replace(new RegExp(findValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replaceValue || '')
          changed = true
        }
      }
      if (changed) { count++; return { ...r, conditions: conds, updatedAt: new Date().toISOString() } }
      return r
    })
    localStorage.setItem('soc_rules', JSON.stringify(updated))
    if (onRefresh) onRefresh()
    toast.success(`Replaced in ${count} rule${count !== 1 ? 's' : ''}`)
    setShowFindReplace(false); setFindField(''); setFindValue(''); setReplaceValue('')
  }

  function handleTag(action) {
    const tag = tagInput.trim().toLowerCase()
    if (!tag) { toast.error('Enter a tag name'); return }
    const ids = [...selectedRuleIds]; const rules = JSON.parse(localStorage.getItem('soc_rules') || '[]')
    let count = 0
    const updated = rules.map(r => {
      if (!ids.includes(r.id)) return r
      const tags = r.tags || []
      if (action === 'add' && !tags.includes(tag)) { count++; return { ...r, tags: [...tags, tag], updatedAt: new Date().toISOString() } }
      if (action === 'remove' && tags.includes(tag)) { count++; return { ...r, tags: tags.filter(t => t !== tag), updatedAt: new Date().toISOString() } }
      return r
    })
    localStorage.setItem('soc_rules', JSON.stringify(updated))
    if (onRefresh) onRefresh()
    toast.success(`${action === 'add' ? 'Added' : 'Removed'} tag "${tag}" ${action === 'add' ? 'to' : 'from'} ${count} rule${count !== 1 ? 's' : ''}`)
    setTagInput('')
  }

  function collectAllTags() {
    try {
      const rules = JSON.parse(localStorage.getItem('soc_rules') || '[]')
      const tagSet = new Set()
      for (const r of rules) { if (r.tags) r.tags.forEach(t => tagSet.add(t)) }
      return [...tagSet].sort()
    } catch { return [] }
  }

  function handleExport(format) {
    const ids = [...selectedRuleIds]; const rules = JSON.parse(localStorage.getItem('soc_rules') || '[]').filter(r => ids.includes(r.id))
    if (rules.length === 0) return
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `rules-export-${Date.now()}.json`; a.click()
      URL.revokeObjectURL(url); toast.success(`Exported ${rules.length} rule${rules.length !== 1 ? 's' : ''} as JSON`)
    } else if (format === 'sigma') {
      const sigma = toSigma(rules)
      const blob = new Blob([sigma], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `rules-export-${Date.now()}.yml`; a.click()
      URL.revokeObjectURL(url); toast.success(`Exported ${rules.length} rule${rules.length !== 1 ? 's' : ''} as Sigma`)
    } else if (format === 'clipboard') {
      navigator.clipboard?.writeText(JSON.stringify(rules, null, 2))
      toast.success(`Copied ${rules.length} rule${rules.length !== 1 ? 's' : ''} to clipboard`)
    }
    setShowExport(false)
  }

  function toSigma(rules) {
    return rules.map(r => {
      const lines = [`title: ${r.name}`, `id: ${r.id}`, `status: ${r.enabled ? 'experimental' : 'draft'}`, `date: ${(r.updatedAt || r.createdAt || '').slice(0, 10)}`, 'logsource:', '  category: unknown', '  product: unknown', 'detection:', '  selection:']
      const flat = flattenConditions(r.conditions || [])
      for (const c of flat) {
        if (c.operator === 'equals') lines.push(`    ${c.field}: "${c.value}"`)
        else if (c.operator === 'contains') lines.push(`    ${c.field}|contains: "${c.value}"`)
        else if (c.operator === 'startsWith') lines.push(`    ${c.field}|startswith: "${c.value}"`)
        else if (c.operator === 'endsWith') lines.push(`    ${c.field}|endswith: "${c.value}"`)
        else if (c.operator === 'regex') lines.push(`    ${c.field}|re: "${c.value}"`)
        else if (c.operator === 'gt') lines.push(`    ${c.field}|gt: ${c.value}`)
        else if (c.operator === 'gte') lines.push(`    ${c.field}|gte: ${c.value}`)
        else if (c.operator === 'lt') lines.push(`    ${c.field}|lt: ${c.value}`)
        else if (c.operator === 'lte') lines.push(`    ${c.field}|lte: ${c.value}`)
        else if (c.operator === 'inList') lines.push(`    ${c.field}: [${c.value}]`)
        else if (c.operator === 'exists') lines.push(`    ${c.field}|exists: true`)
      }
      lines.push(`  condition: selection`, `level: ${r.actions?.[0]?.params?.severity || 'medium'}`, '')
      return lines.join('\n')
    }).join('\n---\n')
  }

  function handleTest() {
    if (!testJson.trim()) { toast.error('Paste a test event JSON'); return }
    setTestResults(null)
    try {
      const doc = JSON.parse(testJson)
      const ids = [...selectedRuleIds]; const rules = JSON.parse(localStorage.getItem('soc_rules') || '[]').filter(r => ids.includes(r.id))
      const results = rules.map(r => {
        const { matched, details } = evalRule(r, doc)
        return { id: r.id, name: r.name, matched, detailCount: details.length, matchCount: details.filter(d => d.matched).length }
      })
      setTestResults(results)
      const matchedCount = results.filter(r => r.matched).length
      toast.success(`${matchedCount}/${results.length} rules matched`)
    } catch (e) { toast.error(`Invalid JSON: ${e.message}`) }
  }

  async function handleAddToGroup() {
    setBusy(true); setOpenDropdown(null)
    const targetIds = addToGroupIds
    if (targetIds.length === 0) { setBusy(false); return }
    const total = selectedRuleIds.length * targetIds.length; let done = 0
    setProgress({ current: 0, total })
    const prevGroupIds = selectedRuleIds.map(id => { const r = getRule(id); return r ? { id, gids: [...(r.groupIds || [])] } : null }).filter(Boolean)
    for (const gid of targetIds) { addRulesToGroup(gid, selectedRuleIds); done += selectedRuleIds.length; setProgress({ current: done, total }) }
    if (onRefresh) onRefresh()
    const groupNames = targetIds.map(gid => groups.find(g => g.id === gid)?.name || gid).join(', ')
    toast.notifyOperation(`Added ${selectedRuleIds.length} rule${selectedRuleIds.length !== 1 ? 's' : ''} to ${groupNames}`, 'addToGroup', () => {
      for (const p of prevGroupIds) updateRule(p.id, { groupIds: p.gids }); if (onRefresh) onRefresh()
    })
    setAddToGroupIds([]); setBusy(false); setProgress({ current: 0, total: 0 })
  }

  async function handleMoveToGroup(targetGroupId) {
    if (!groupId || !targetGroupId) return
    setBusy(true); setOpenDropdown(null); setProgress({ current: 0, total: selectedRuleIds.length })
    const prevGroupIds = selectedRuleIds.map(id => { const r = getRule(id); return r ? { id, gids: [...(r.groupIds || [])] } : null }).filter(Boolean)
    const srcName = groups.find(g => g.id === groupId)?.name || groupId; const tgtName = groups.find(g => g.id === targetGroupId)?.name || targetGroupId
    moveRulesToGroup(groupId, targetGroupId, selectedRuleIds)
    setProgress({ current: selectedRuleIds.length, total: selectedRuleIds.length })
    if (onRefresh) onRefresh()
    toast.notifyOperation(`Moved ${selectedRuleIds.length} rule${selectedRuleIds.length !== 1 ? 's' : ''} from ${srcName} to ${tgtName}`, 'moveToGroup', () => {
      for (const p of prevGroupIds) updateRule(p.id, { groupIds: p.gids }); if (onRefresh) onRefresh()
    })
    setBusy(false); setProgress({ current: 0, total: 0 })
  }

  async function handleRemoveFromGroup() {
    if (!groupId) return
    setBusy(true); setOpenDropdown(null); setProgress({ current: 0, total: selectedRuleIds.length })
    const prevGroupIds = selectedRuleIds.map(id => { const r = getRule(id); return r ? { id, gids: [...(r.groupIds || [])] } : null }).filter(Boolean)
    const grpName = groups.find(g => g.id === groupId)?.name || groupId
    removeRulesFromGroup(groupId, selectedRuleIds)
    setProgress({ current: selectedRuleIds.length, total: selectedRuleIds.length })
    if (onRefresh) onRefresh()
    toast.notifyOperation(`Removed ${selectedRuleIds.length} rule${selectedRuleIds.length !== 1 ? 's' : ''} from ${grpName}`, 'removeFromGroup', () => {
      for (const p of prevGroupIds) updateRule(p.id, { groupIds: p.gids }); if (onRefresh) onRefresh()
    })
    setBusy(false); setProgress({ current: 0, total: 0 })
  }

  function toggleAddGroup(gid) { setAddToGroupIds(prev => prev.includes(gid) ? prev.filter(id => id !== gid) : [...prev, gid]) }
  function toggleSelection() { onSelectionChange(selectedRuleIds.length === visibleRuleIds.length ? [] : [...visibleRuleIds]) }

  const hasSelection = selectedRuleIds.length > 0
  const allSelected = visibleRuleIds.length > 0 && selectedRuleIds.length === visibleRuleIds.length
  const allTags = collectAllTags()

  return (
    <>
      <AnimatePresence>
        {hasSelection && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl shadow-2xl px-3 sm:px-4 py-2.5 flex items-center gap-1.5 sm:gap-2 text-xs overflow-x-auto"
            style={{ maxWidth: 'calc(100vw - 2rem)' }}>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={toggleSelection} className="p-1 rounded hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors" title={allSelected ? 'Deselect All' : 'Select All'}>
                <svg className="w-4 h-4 text-[#6b7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {allSelected ? <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></> : <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></>}
                </svg>
              </button>
              <span className="font-semibold text-soc-stext dark:text-soc-darkstext whitespace-nowrap"><span className="text-[#EF843C]">{selectedRuleIds.length}</span> selected</span>
            </div>
            <div className="h-5 w-px bg-[#e5e7eb] dark:bg-[#2d3140]" />

            <div className="relative">
              <button onClick={() => setOpenDropdown(openDropdown === 'add' ? null : 'add')} disabled={busy}
                className={`gbtn text-xs px-2 py-1.5 flex items-center gap-1 transition-all ${openDropdown === 'add' ? 'bg-[#EF843C]/10 text-[#EF843C]' : 'bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#6b7280] dark:text-[#9ca3af]'} ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                <span className="hidden sm:inline">Group+</span>
              </button>
              {openDropdown === 'add' && (
                <div className="bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg shadow-xl py-1 min-w-[160px] max-h-48 overflow-y-auto absolute bottom-full left-0 mb-2">
                  {groups.length === 0 && <div className="px-3 py-2 text-[10px] text-[#9ca3af] italic">No groups</div>}
                  {groups.map(g => (
                    <label key={g.id} className="flex items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] cursor-pointer">
                      <input type="checkbox" checked={addToGroupIds.includes(g.id)} onChange={() => toggleAddGroup(g.id)} className="w-3 h-3 rounded border-[#d1d5db] dark:border-[#4b5563] text-[#EF843C]" />
                      {g.name}
                    </label>
                  ))}
                  {groups.length > 0 && (
                    <div className="border-t border-[#e5e7eb] dark:border-[#2d3140] px-2 py-1.5">
                      <button onClick={handleAddToGroup} disabled={addToGroupIds.length === 0 || busy}
                        className="w-full text-center text-[9px] py-1 rounded-md bg-[#EF843C] text-white hover:bg-[#e0752a] disabled:opacity-40 font-medium">Add to {addToGroupIds.length} group{addToGroupIds.length !== 1 ? 's' : ''}</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {groupId && (
              <>
                <div className="relative">
                  <button onClick={() => setOpenDropdown(openDropdown === 'move' ? null : 'move')} disabled={busy}
                    className={`gbtn text-xs px-2 py-1.5 flex items-center gap-1 transition-all ${openDropdown === 'move' ? 'bg-[#EF843C]/10 text-[#EF843C]' : 'bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#6b7280] dark:text-[#9ca3af]'} ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 17l4 4 4-4M8 7l4-4 4-4"/><path d="M12 3v18"/></svg>
                    <span className="hidden sm:inline">Move</span>
                  </button>
                  {openDropdown === 'move' && (
                    <div className="bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg shadow-xl py-1 min-w-[160px] max-h-48 overflow-y-auto absolute bottom-full left-0 mb-2">
                      {groups.filter(g => g.id !== groupId).length === 0 && <div className="px-3 py-2 text-[10px] text-[#9ca3af] italic">No other groups</div>}
                      {groups.filter(g => g.id !== groupId).map(g => (
                        <button key={g.id} onClick={() => handleMoveToGroup(g.id)} disabled={busy}
                          className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] flex items-center gap-2">
                          {g.name}</button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={handleRemoveFromGroup} disabled={busy}
                  className="gbtn text-xs px-2 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#6b7280] dark:text-[#9ca3af]">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
                  <span className="hidden sm:inline">Remove</span>
                </button>
              </>
            )}

            <div className="h-5 w-px bg-[#e5e7eb] dark:bg-[#2d3140]" />

            <button onClick={() => runBulk('enable')} disabled={busy}
              className="gbtn text-xs px-2 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800/40">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
              <span className="hidden sm:inline">On</span>
            </button>
            <button onClick={() => runBulk('disable')} disabled={busy}
              className="gbtn text-xs px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800/40">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 5l-7 7 7 7"/></svg>
              <span className="hidden sm:inline">Off</span>
            </button>

            <div className="h-5 w-px bg-[#e5e7eb] dark:bg-[#2d3140]" />

            <button onClick={handleClone} disabled={busy}
              className="gbtn text-xs px-2 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#6b7280] dark:text-[#9ca3af]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              <span className="hidden sm:inline">Clone</span>
            </button>

            <button onClick={() => setShowFindReplace(true)}
              className="gbtn text-xs px-2 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#6b7280] dark:text-[#9ca3af]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/><path d="M10 8v4m0 4h.01"/></svg>
              <span className="hidden sm:inline">Find&Replace</span>
            </button>

            <div className="relative">
              <button onClick={() => setShowTag(o => !o)}
                className="gbtn text-xs px-2 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#6b7280] dark:text-[#9ca3af]">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
                <span className="hidden sm:inline">Tag</span>
              </button>
              {showTag && (
                <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg shadow-xl p-3 min-w-[200px]">
                  <div className="flex gap-1 mb-2">
                    <input className="ginput flex-1 text-[10px] py-1.5 px-2" placeholder="tag name" value={tagInput} onChange={e => setTagInput(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleTag('add') }} />
                  </div>
                  {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {allTags.map(t => (
                        <button key={t} onClick={() => setTagInput(t)} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-colors">{t}</button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1">
                    <button onClick={() => handleTag('add')} className="gbtn text-[9px] px-2 py-1 bg-[#EF843C] text-white rounded hover:bg-[#e0752a]">Add</button>
                    <button onClick={() => handleTag('remove')} className="gbtn text-[9px] px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600">Remove</button>
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setShowExport(true)}
              className="gbtn text-xs px-2 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#6b7280] dark:text-[#9ca3af]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span className="hidden sm:inline">Export</span>
            </button>

            <button onClick={() => setShowTest(true)}
              className="gbtn text-xs px-2 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#6b7280] dark:text-[#9ca3af]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
              <span className="hidden sm:inline">Test</span>
            </button>

            <div className="h-5 w-px bg-[#e5e7eb] dark:bg-[#2d3140]" />

            <button onClick={() => setConfirmDelete(true)} disabled={busy}
              className="gbtn text-xs px-2 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 dark:hover:border-red-800/40">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              <span className="hidden sm:inline">Delete</span>
            </button>

            {busy && progress.total > 0 && (
              <div className="w-16 h-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden shrink-0">
                <div className="h-full bg-[#EF843C] rounded-full transition-all duration-200" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
              </div>
            )}

            <button onClick={() => setShowShortcuts(true)} className="p-1 rounded hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-[#9ca3af] transition-colors shrink-0" title="Keyboard shortcuts">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 3H4a2 2 0 00-2 2v14a2 2 0 002 2h16a2 2 0 002-2V5a2 2 0 00-2-2z"/><path d="M8 9h1m3 0h1m-5 4h6m-6 4h6"/></svg>
            </button>

            <button onClick={() => onSelectionChange([])} disabled={busy}
              className="p-1 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-[#9ca3af] hover:text-[#6b7280] dark:hover:text-[#e4e6eb] transition-colors shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog open={confirmDelete} title="Delete Rules" confirmLabel={`Delete ${selectedRuleIds.length} Rule${selectedRuleIds.length !== 1 ? 's' : ''}`}
        message={`Are you sure you want to delete ${selectedRuleIds.length} selected rule${selectedRuleIds.length !== 1 ? 's' : ''}?`}
        onConfirm={() => { setConfirmDelete(false); runBulk('delete') }} onCancel={() => setConfirmDelete(false)} />

      <Modal open={showShortcuts} onClose={() => setShowShortcuts(false)} title="Keyboard Shortcuts">
        <div className="space-y-1.5">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="flex items-center justify-between text-xs">
              <span className="text-[#6b7280] dark:text-[#9ca3af]">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-[#f3f4f6] dark:bg-[#2d3140] text-[10px] font-mono text-soc-stext dark:text-soc-darkstext border border-[#e5e7eb] dark:border-[#2d3140]">{s.key}</kbd>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={showFindReplace} onClose={() => setShowFindReplace(false)} title="Find & Replace in Conditions">
        <div className="space-y-3">
          <div><label className="text-[10px] uppercase font-semibold text-[#9ca3af] tracking-wider block mb-1">Field</label>
            <input className="ginput w-full text-xs py-2 px-3" placeholder="e.g. rule.description" value={findField} onChange={e => setFindField(e.target.value)} /></div>
          <div><label className="text-[10px] uppercase font-semibold text-[#9ca3af] tracking-wider block mb-1">Find Value</label>
            <input className="ginput w-full text-xs py-2 px-3" placeholder="e.g. old-value" value={findValue} onChange={e => setFindValue(e.target.value)} /></div>
          <div><label className="text-[10px] uppercase font-semibold text-[#9ca3af] tracking-wider block mb-1">Replace With</label>
            <input className="ginput w-full text-xs py-2 px-3" placeholder="e.g. new-value" value={replaceValue} onChange={e => setReplaceValue(e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowFindReplace(false)} className="gbtn text-xs px-3 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151]">Cancel</button>
            <button onClick={handleFindReplace} className="gbtn text-xs px-4 py-1.5 bg-[#EF843C] text-white hover:bg-[#e0752a]">Replace All</button>
          </div>
        </div>
      </Modal>

      <Modal open={showExport} onClose={() => setShowExport(false)} title="Export Rules">
        <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mb-3">Export {selectedRuleIds.length} selected rule{selectedRuleIds.length !== 1 ? 's' : ''}</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleExport('json')} className="gbtn text-xs px-4 py-2 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg> JSON (.json)
          </button>
          <button onClick={() => handleExport('sigma')} className="gbtn text-xs px-4 py-2 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg> Sigma (.yml)
          </button>
          <button onClick={() => handleExport('clipboard')} className="gbtn text-xs px-4 py-2 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg> Copy to Clipboard
          </button>
        </div>
      </Modal>

      <Modal open={showTest} onClose={() => { setShowTest(false); setTestResults(null) }} title="Bulk Test Selected Rules">
        <div className="space-y-3">
          <textarea className="ginput w-full p-2 text-[10px] font-mono leading-relaxed resize-none" rows={4} placeholder={'Paste a JSON event to test against all selected rules...'}
            value={testJson} onChange={e => { setTestJson(e.target.value); setTestResults(null) }} />
          <div className="flex justify-end">
            <button onClick={handleTest} disabled={!testJson.trim()}
              className="gbtn text-xs px-4 py-1.5 bg-[#EF843C] text-white hover:bg-[#e0752a] disabled:opacity-40">Test All Selected</button>
          </div>
          {testResults && (
            <div className="border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {testResults.map(r => (
                <div key={r.id} className={`flex items-center gap-2 px-3 py-2 text-[10px] border-b border-[#e5e7eb] dark:border-[#2d3140] last:border-0 ${r.matched ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.matched ? 'bg-green-500' : 'bg-[#d1d5db] dark:bg-[#4b5563]'}`} />
                  <span className="flex-1 truncate font-medium text-soc-stext dark:text-soc-darkstext">{r.name}</span>
                  <span className="text-[#9ca3af]">{r.matchCount}/{r.detailCount}</span>
                  {r.matched && <span className="px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-[8px] font-medium">MATCH</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

function evalRule(rule, doc) {
  const { conditions, conditionLogic, actions } = rule
  if (!conditions || conditions.length === 0) return { matched: true, details: [], actions: actions || [] }
  const results = conditions.map(c => evalItem(c, doc))
  const matched = results.reduce((acc, r, idx) => {
    if (idx === 0) return r.matched
    const l = r.condition?.logic || conditionLogic || 'AND'
    return l === 'OR' ? acc || r.matched : acc && r.matched
  }, false)
  return { matched, details: results, actions: matched ? (actions || []) : [] }
}

function evalItem(item, doc) {
  if (item.type === 'group') return evalConditionGroup(item, doc)
  const fieldVal = resolveField(doc, item.field)
  const exists = fieldVal !== null && fieldVal !== undefined && fieldVal !== ''
  if (!exists && item.operator !== 'exists') return { condition: { ...item, missing: true }, matched: false, actual: fieldVal, reason: 'Field missing' }
  const result = evalOperator(fieldVal, item.operator, item.value)
  const matched = item.negate ? !result.matched : result.matched
  return { condition: { ...item, missing: false }, matched, actual: fieldVal, reason: result.reason }
}

function evalConditionGroup(group, doc) {
  const items = group.conditions || group.items || []
  if (!items.length) return { matched: true, details: [] }
  const results = items.map(c => evalItem(c, doc))
  const matched = results.reduce((acc, r, idx) => {
    if (idx === 0) return r.matched; const l = r.condition?.logic || group.logic || 'AND'
    return l === 'OR' ? acc || r.matched : acc && r.matched
  }, false)
  return { matched, details: results }
}

function evalOperator(fieldVal, operator, condVal) {
  const exists = fieldVal !== null && fieldVal !== undefined && fieldVal !== ''
  const valueToText = v => { if (Array.isArray(v)) return v.join(', '); if (v && typeof v === 'object') return JSON.stringify(v); return String(v ?? '') }
  const valueParts = v => Array.isArray(v) ? v.map(x => String(x)) : [valueToText(v)]
  const fv = valueToText(fieldVal); const parts = valueParts(fieldVal); const cv = String(condVal ?? '')
  if (!exists && operator !== 'exists') return { matched: false, reason: 'Field missing in alert' }
  if (operator !== 'exists' && operator !== 'regex' && cv === '') return { matched: false, reason: 'Condition value is empty' }
  switch (operator) {
    case 'equals': return { matched: parts.some(v => String(v) === cv), reason: `Actual: ${fv}` }
    case 'contains': return { matched: parts.some(v => String(v).toLowerCase().includes(cv.toLowerCase())), reason: `Actual: ${fv}` }
    case 'regex': try { const re = new RegExp(cv, 'i'); return { matched: parts.some(v => re.test(String(v))), reason: `Actual: ${fv}` } } catch (err) { return { matched: false, reason: `Invalid regex: ${err.message}` } }
    case 'startsWith': return { matched: parts.some(v => String(v).toLowerCase().startsWith(cv.toLowerCase())), reason: `Actual: ${fv}` }
    case 'endsWith': return { matched: parts.some(v => String(v).toLowerCase().endsWith(cv.toLowerCase())), reason: `Actual: ${fv}` }
    case 'gt': case 'gte': case 'lt': case 'lte': {
      const actual = Number(fv); const expected = Number(cv)
      if (Number.isNaN(actual)) return { matched: false, reason: `Not a number: ${fv}` }
      if (Number.isNaN(expected)) return { matched: false, reason: `Not a number: ${cv}` }
      const m = operator === 'gt' ? actual > expected : operator === 'gte' ? actual >= expected : operator === 'lt' ? actual < expected : actual <= expected
      return { matched: m, reason: `Actual: ${actual}` }
    }
    case 'inList': { const list = cv.split(',').map(s => s.trim()).filter(Boolean); return { matched: parts.some(v => list.includes(String(v))), reason: `Actual: ${fv}` } }
    case 'exists': return { matched: exists, reason: exists ? `Actual: ${fv}` : 'Field missing' }
    default: return { matched: false, reason: `Unknown operator: ${operator}` }
  }
}

function resolveField(doc, path) {
  if (!path) return undefined
  const parts = path.split('.'); let cur = doc
  for (const p of parts) { if (cur === null || cur === undefined || typeof cur !== 'object') return undefined; cur = cur[p] }
  return cur
}
