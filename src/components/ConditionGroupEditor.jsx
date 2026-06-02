import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GDPR_FIELDS, GDPR_CATEGORIES, getGdprField } from '../data/gdprFields'

const MAX_DEPTH = 3
const OPERATORS = ['equals', 'contains', 'regex', 'startsWith', 'endsWith', 'gt', 'gte', 'lt', 'lte', 'inList', 'exists']

function FieldPicker({ value, onChange, fieldList }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focusedOnce, setFocusedOnce] = useState(false)
  const [pos, setPos] = useState(null)
  const inputRef = useRef(null)
  const ref = useRef(null)

  const list = fieldList || []
  const filtered = query ? list.filter(f => f.toLowerCase().includes(query.toLowerCase())) : list

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick); return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function openDropdown() {
    setOpen(true)
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }

  return (
    <div className="flex-1 min-w-0 relative" ref={ref}>
      <div className="flex items-center gap-1">
        <input ref={inputRef} className="w-full bg-transparent outline-none text-soc-stext dark:text-soc-darkstext py-1 text-[10px] sm:text-[11px]" placeholder="field"
          value={focusedOnce ? query : value} onFocus={() => { openDropdown(); if (!focusedOnce) { setFocusedOnce(true); setQuery(value || '') } }}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); openDropdown() }} />
      </div>
      {open && pos && (
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: Math.max(pos.width, 320) }}
          className="bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          <div className="p-2">
            <div className="text-[9px] font-semibold text-[#6b7280] dark:text-[#9ca3af] uppercase tracking-wider mb-1 px-1">Fields</div>
            {filtered.map(f => (
              <button key={f} type="button" className="w-full text-left px-2 py-1 text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext truncate rounded transition-colors"
                onMouseDown={() => { setQuery(''); setFocusedOnce(false); onChange(f); setOpen(false) }}>{f}</button>
            ))}
            {filtered.length === 0 && <div className="px-2 py-1.5 text-[9px] text-[#9ca3af] italic">Custom: {query}</div>}
          </div>
          <div className="border-t border-[#e5e7eb] dark:border-[#2d3140]" />
          <div className="p-2">
            <div className="text-[9px] font-semibold text-[#6b7280] dark:text-[#9ca3af] uppercase tracking-wider mb-1 px-1">GDPR</div>
            <div className="space-y-0.5">
              {GDPR_CATEGORIES.map(cat => {
                const catFields = GDPR_FIELDS.filter(f => f.category === cat)
                return (
                  <div key={cat}>
                    <div className="text-[8px] font-medium text-[#9ca3af] px-1 py-0.5">{cat}</div>
                    {catFields.map(gf => (
                      <button key={gf.field} type="button"
                        onMouseDown={() => { onChange(gf.field); setOpen(false) }}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-left transition-colors">
                        <span className="text-xs shrink-0">{gf.icon}</span>
                        <span className="flex-1 truncate text-soc-stext dark:text-soc-darkstext font-medium">{gf.field}</span>
                        <span className="text-[8px] text-[#9ca3af] whitespace-nowrap">{gf.gdprArticle}</span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function genId() { return 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) }

function LogicBadge({ logic, onClick }) {
  const isOr = (logic || 'AND') === 'OR'
  return (
    <button onClick={onClick} title="Click to toggle"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase transition-all duration-150 ${
        isOr
          ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-500/30'
          : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/30'
      }`}>
      <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d={isOr ? "M5 12h14M12 5v14" : "M5 12h14"}/></svg>
      {logic || 'AND'}
    </button>
  )
}

function updateInTree(items, id, updater) {
  return items.map(item => {
    if (item.id === id) return updater(item)
    if (item.type === 'group') {
      return { ...item, conditions: updateInTree(item.conditions || item.items || [], id, updater) }
    }
    return item
  })
}

function removeFromTree(items, id) {
  return items.filter(item => {
    if (item.id === id) return false
    if (item.type === 'group') {
      item = { ...item, conditions: removeFromTree(item.conditions || item.items || [], id) }
    }
    return true
  })
}

function countLeafConditions(items) {
  let count = 0
  for (const item of items) {
    if (item.type === 'group') {
      count += countLeafConditions(item.conditions || item.items || [])
    } else {
      count++
    }
  }
  return count
}

export default function ConditionGroupEditor({ conditions = [], logic = 'AND', depth = 0, fieldList = [], onChange, onLogicChange, canRemove, onRemove }) {
  const [dragOverId, setDragOverId] = useState(null)
  const [dragItemId, setDragItemId] = useState(null)
  const [showFlat, setShowFlat] = useState(false)

  const effectiveDepth = conditions.length > 0 && conditions[0]?.type === 'group' ? depth + 1 : depth
  const exceededMax = depth >= MAX_DEPTH

  function handleAddCondition() {
    onChange([...conditions, { id: genId(), field: 'rule.description', operator: 'contains', value: '', logic: 'AND' }])
  }

  function handleAddGroup() {
    if (depth >= MAX_DEPTH) return
    onChange([...conditions, { id: genId(), type: 'group', logic: 'AND', conditions: [{ id: genId(), field: 'rule.description', operator: 'contains', value: '', logic: 'AND' }] }])
  }

  function handleItemChange(idx, item) {
    const updated = [...conditions]; updated[idx] = item; onChange(updated)
  }

  function handleItemRemove(idx) {
    if (conditions.length <= 1) return
    onChange(conditions.filter((_, i) => i !== idx))
  }

  function handleLogicToggle() {
    if (onLogicChange) onLogicChange(logic === 'AND' ? 'OR' : 'AND')
  }

  function handleDragStart(e, id) {
    setDragItemId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  function handleDragOver(e, id) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(id)
  }

  function handleDragLeave() {
    setDragOverId(null)
  }

  function handleDrop(e, targetId) {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData('text/plain')
    if (sourceId === targetId) { setDragOverId(null); setDragItemId(null); return }

    let sourceItem = null
    let targetParent = null

    function findSourceAndParent(items, sid, tid, parent) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === sid) { sourceItem = items[i]; targetParent = parent || conditions }
        if (items[i].type === 'group') {
          findSourceAndParent(items[i].conditions || items[i].items || [], sid, tid, items[i].conditions || items[i].items || [])
        }
      }
    }
    findSourceAndParent(conditions, sourceId, targetId, null)
    if (!sourceItem) { setDragOverId(null); setDragItemId(null); return }

    let result = removeFromTree(conditions, sourceId)
    result = updateInTree(result, targetId, item => {
      if (item.type === 'group') {
        const children = item.conditions || item.items || []
        return { ...item, conditions: [...children, { ...sourceItem }] }
      }
      return { ...item, conditions: [sourceItem] }
    })
    onChange(result)
    setDragOverId(null); setDragItemId(null)
  }

  function handleDropOnGroup(e, groupId) {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData('text/plain')
    if (sourceId === groupId) { setDragOverId(null); setDragItemId(null); return }

    let sourceItem = null
    function findItem(items, sid) {
      for (const item of items) {
        if (item.id === sid) { sourceItem = item; return true }
        if (item.type === 'group' && findItem(item.conditions || item.items || [], sid)) return true
      }
      return false
    }
    findItem(conditions, sourceId)
    if (!sourceItem) { setDragOverId(null); setDragItemId(null); return }

    let result = removeFromTree(conditions, sourceId)
    result = updateInTree(result, groupId, item => {
      if (item.type === 'group') {
        const children = item.conditions || item.items || []
        return { ...item, conditions: [...children, { ...sourceItem }] }
      }
      return item
    })
    onChange(result)
    setDragOverId(null); setDragItemId(null)
  }

  function renderFlatList() {
    const flat = []
    function extract(item) {
      if (item.type === 'group') {
        (item.conditions || item.items || []).forEach(extract)
      } else {
        flat.push(item)
      }
    }
    conditions.forEach(extract)
    return flat
  }

  const items = conditions.length === 0 ? [] : (showFlat ? renderFlatList() : conditions)
  const isFlatMode = showFlat

  return (
    <div className="relative">
      {depth === 0 && conditions[0]?.type === 'group' && (
        <div className="flex items-center justify-end gap-2 mb-2">
          <button onClick={() => setShowFlat(o => !o)}
            className="text-[9px] px-2 py-0.5 rounded-full bg-[#f3f4f6] dark:bg-[#2d3140] text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-colors">
            {showFlat ? 'Nested View' : 'Flat View'}
          </button>
        </div>
      )}

      {exceededMax && depth > 0 && (
        <div className="flex items-center gap-1.5 text-[9px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/15 px-2 py-1 rounded-lg mb-2">
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
          Max nesting depth ({MAX_DEPTH}) reached
        </div>
      )}

      <div className="space-y-1">
        {conditions.length === 0 && (
          <div className="text-xs text-[#9ca3af] py-6 text-center italic">No conditions — add one below</div>
        )}
        {items.map((item, idx) => {
          if (isFlatMode || !item.type) {
            const cond = isFlatMode ? item : item
            return (
              <div key={cond.id}>
                {idx > 0 && !isFlatMode && (
                  <div className="flex items-center justify-center py-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 sm:w-12 h-px bg-[#e5e7eb] dark:bg-[#2d3140]" />
                      <LogicBadge logic={cond.logic || logic} onClick={() => {
                        const updated = [...conditions]; updated[idx] = { ...cond, logic: (cond.logic || logic) === 'AND' ? 'OR' : 'AND' }; onChange(updated)
                      }} />
                      <div className="w-8 sm:w-12 h-px bg-[#e5e7eb] dark:bg-[#2d3140]" />
                    </div>
                  </div>
                )}
                <ConditionRow
                  condition={cond}
                  fieldList={fieldList}
                  onChange={c => handleItemChange(idx, c)}
                  onRemove={() => handleItemRemove(idx)}
                  canRemove={conditions.length > 1}
                  onDragStart={e => handleDragStart(e, cond.id)}
                  onDragOver={e => handleDragOver(e, cond.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, cond.id)}
                  isDragOver={dragOverId === cond.id}
                />
              </div>
            )
          }

          const grp = item
          const groupItems = grp.conditions || grp.items || []
          return (
            <div key={grp.id}>
              {idx > 0 && (
                <div className="flex items-center justify-center py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 sm:w-12 h-px bg-[#e5e7eb] dark:bg-[#2d3140]" />
                    <LogicBadge logic={grp.logic || logic} onClick={() => {
                      const updated = [...conditions]; updated[idx] = { ...grp, logic: (grp.logic || logic) === 'AND' ? 'OR' : 'AND' }; onChange(updated)
                    }} />
                    <div className="w-8 sm:w-12 h-px bg-[#e5e7eb] dark:bg-[#2d3140]" />
                  </div>
                </div>
              )}
              <div
                draggable
                onDragStart={e => { e.dataTransfer.setData('text/plain', grp.id); setDragItemId(grp.id) }}
                onDragOver={e => handleDragOver(e, grp.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDropOnGroup(e, grp.id)}
                className={`relative rounded-lg border transition-all ${
                  dragOverId === grp.id ? 'border-[#3b82f6] bg-[#3b82f6]/5 dark:bg-[#3b82f6]/10 shadow-md' : 'border-[#e5e7eb] dark:border-[#2d3140]'
                } ${depth > 0 ? 'ml-4' : ''}`}
                style={depth > 0 ? {
                  borderLeft: '2px solid ' + (dragOverId === grp.id ? '#3b82f6' : '#d1d5db'),
                  borderLeftColor: dragOverId === grp.id ? '#3b82f6' : undefined
                } : {}}>
                {depth > 0 && (
                  <div className="absolute left-0 top-0 bottom-0 flex items-center">
                    <div className="w-3 h-px bg-[#d1d5db] dark:bg-[#4b5563]" />
                  </div>
                )}
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#f9fafb] dark:bg-[#0f1117] rounded-t-lg border-b border-[#e5e7eb] dark:border-[#2d3140]">
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#6b7280] dark:text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
                    <span className="text-[9px] font-semibold text-[#6b7280] dark:text-[#9ca3af] uppercase tracking-wider">
                      Group ({groupItems.length} item{groupItems.length !== 1 ? 's' : ''})
                    </span>
                    <LogicBadge logic={grp.logic || 'AND'} onClick={() => {
                      const updated = [...conditions]; updated[idx] = { ...grp, logic: (grp.logic || 'AND') === 'AND' ? 'OR' : 'AND' }; onChange(updated)
                    }} />
                  </div>
                  <div className="flex items-center gap-1">
                    {canRemove && (
                      <button onClick={() => handleItemRemove(idx)}
                        className="p-1 text-[#9ca3af] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-2 sm:p-3">
                  <ConditionGroupEditor
                    conditions={groupItems}
                    logic={grp.logic || 'AND'}
                    depth={depth + 1}
                    fieldList={fieldList}
                    onChange={newItems => {
                      const updated = [...conditions]; updated[idx] = { ...grp, conditions: newItems }; onChange(updated)
                    }}
                    onLogicChange={newLogic => {
                      const updated = [...conditions]; updated[idx] = { ...grp, logic: newLogic }; onChange(updated)
                    }}
                    canRemove={groupItems.length > 1}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!isFlatMode && (
        <div className="flex items-center gap-2 mt-3">
          <button onClick={handleAddCondition}
            className="gbtn text-[10px] flex items-center gap-1 px-2.5 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-colors rounded-lg">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Condition
          </button>
          {depth < MAX_DEPTH && (
            <button onClick={handleAddGroup}
              className="gbtn text-[10px] flex items-center gap-1 px-2.5 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-colors rounded-lg">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
              Group
            </button>
          )}
          {depth >= MAX_DEPTH && (
            <span className="text-[9px] text-amber-500 flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01"/></svg>
              Max depth
            </span>
          )}
          <span className="text-[9px] text-[#9ca3af] ml-auto">{countLeafConditions(conditions)} condition{countLeafConditions(conditions) !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  )
}

function ConditionRow({ condition, fieldList, onChange, onRemove, canRemove, onDragStart, onDragOver, onDragLeave, onDrop, isDragOver }) {
  const gdpr = getGdprField(condition.field)
  const gdprOps = gdpr ? gdpr.operators : OPERATORS

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex rounded-lg border p-1.5 sm:p-1.5 transition-all cursor-grab active:cursor-grabbing ${
        isDragOver ? 'border-[#3b82f6] bg-[#3b82f6]/5 shadow-md' : 'border-[#e5e7eb] dark:border-[#2d3140] bg-[#f9fafb] dark:bg-[#0f1117]'
      }`}>
      <div className="flex items-center gap-0.5 text-[#9ca3af] opacity-40 cursor-grab shrink-0">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z"/></svg>
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <FieldPicker value={condition.field} onChange={v => onChange({ ...condition, field: v })} fieldList={fieldList} />
        <span className="text-[#d1d5db] dark:text-[#4b5563] text-[10px]">|</span>
        <select className="bg-transparent outline-none text-soc-stext dark:text-soc-darkstext w-20 py-0.5 cursor-pointer text-[10px]" value={condition.operator} onChange={e => onChange({ ...condition, operator: e.target.value })}>
          {gdprOps.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="text-[#d1d5db] dark:text-[#4b5563] text-[10px]">|</span>
        <input className="flex-1 bg-transparent outline-none text-soc-stext dark:text-soc-darkstext py-0.5 text-[10px] min-w-[80px]" placeholder="value" value={condition.value || ''} onChange={e => onChange({ ...condition, value: e.target.value })} />
      </div>
      {canRemove && (
        <button onClick={onRemove} className="p-1 text-[#9ca3af] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      )}
    </div>
  )
}
