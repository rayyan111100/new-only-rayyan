import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { vizService } from './VizService'

const TYPE_META = {
  area: { label: 'Area Chart', icon: '📈', color: '#EF843C', desc: 'Stacked or filled time series' },
  'bar-vertical': { label: 'Vertical Bar', icon: '📊', color: '#8b5cf6', desc: 'Column chart' },
  'bar-horizontal': { label: 'Horizontal Bar', icon: '📊', color: '#10b981', desc: 'Sorted bar chart' },
  line: { label: 'Line Chart', icon: '📉', color: '#06b6d4', desc: 'Trend lines' },
  pie: { label: 'Pie / Donut', icon: '🥧', color: '#ef4444', desc: 'Proportional segments' },
  heatmap: { label: 'Heat Map', icon: '🗺️', color: '#f59e0b', desc: 'MITRE ATT&CK matrix' },
  gauge: { label: 'Gauge', icon: '🎯', color: '#ec4899', desc: 'Single value with ranges' },
  goal: { label: 'Goal / Progress', icon: '🏁', color: '#14b8a6', desc: 'Progress toward target' },
  metric: { label: 'Metric', icon: '🔢', color: '#f97316', desc: 'Big number display' },
  table: { label: 'Data Table', icon: '📋', color: '#6366f1', desc: 'Sortable table' },
  map: { label: 'Coordinate Map', icon: '🌍', color: '#84cc16', desc: 'Geo points' },
  'region-map': { label: 'Region Map', icon: '🗺️', color: '#0d9488', desc: 'Country boundaries' },
  maps: { label: 'Maps', icon: '🗺️', color: '#0891b2', desc: 'Geospatial' },
  gantt: { label: 'Gantt Chart', icon: '📅', color: '#7c3aed', desc: 'Project schedules' },
  timeline: { label: 'Timeline', icon: '⏱️', color: '#06b6d4', desc: 'Event chronology' },
  tsvb: { label: 'TSVB', icon: '📈', color: '#0ea5e9', desc: 'Advanced time-series' },
  tagcloud: { label: 'Tag Cloud', icon: '☁️', color: '#a855f7', desc: 'Word frequency' },
  markdown: { label: 'Markdown', icon: '📝', color: '#6b7280', desc: 'Info display' },
  vega: { label: 'Vega Chart', icon: '🎨', color: '#f43f5e', desc: 'Custom JSON viz' },
  controls: { label: 'Controls', icon: '🎛️', color: '#78716c', desc: 'Dashboard filters' },
  visbuilder: { label: 'VisBuilder', icon: '🧩', color: '#d97706', desc: 'Quick viz' },
}

const ITEMS_PER_PAGE = 12

const VizCard = React.memo(({ v, meta, isSelected, isRenaming, renameVal, onToggle, onStar, onEdit, onDuplicate, onDelete, onStartRename, onRenameChange, onRenameCommit }) => (
  <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
    className={`group bg-white dark:bg-[#1a1d27] rounded-xl border overflow-hidden transition-all ${
      isSelected ? 'border-[#8b5cf6] ring-2 ring-[#8b5cf6]/20 shadow-md' : 'border-zinc-200 dark:border-zinc-700 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600'
    }`}>
    <div className="h-1" style={{ backgroundColor: meta.color }} />
    <div className="p-3.5">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div onClick={() => onToggle(v.id)} className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center cursor-pointer ${isSelected ? 'bg-[#8b5cf6] border-[#8b5cf6]' : 'border-zinc-300 dark:border-zinc-600 hover:border-[#8b5cf6]'}`}>
            {isSelected && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-lg shrink-0">{meta.icon}</span>
              {isRenaming ? (
                <input type="text" value={renameVal} onChange={onRenameChange} onBlur={onRenameCommit}
                  onKeyDown={e => { if (e.key === 'Enter') onRenameCommit(); if (e.key === 'Escape') onStartRename(null) }}
                  autoFocus className="flex-1 text-[11px] font-semibold px-1 py-0 rounded border-b-2 border-[#8b5cf6] bg-transparent outline-none text-zinc-800 dark:text-zinc-100" />
              ) : (
                <span onClick={() => onStartRename(v)} className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100 truncate cursor-pointer hover:text-[#8b5cf6]">{v.name}</span>
              )}
            </div>
            {v.description && <p className="text-[9px] text-zinc-400 truncate">{v.description}</p>}
          </div>
        </div>
        <button onClick={() => onStar(v.id)} className={`p-1 shrink-0 ${v.starred ? 'text-yellow-500' : 'text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100'}`}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={v.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
      </div>
      <div className="flex items-center gap-2 text-[9px] text-zinc-400 mb-2.5">
        <span className={`px-1.5 py-0.5 rounded-md font-mono`} style={{ backgroundColor: meta.color + '15', color: meta.color }}>{meta.label}</span>
        <span>{new Date(v.updatedAt).toLocaleDateString()}</span>
      </div>
      <div className="flex gap-1">
        <button onClick={() => onEdit(v)} className="flex-1 px-2 py-1.5 text-[9px] font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700">Edit</button>
        <button onClick={() => onDuplicate(v.id)} className="px-2 py-1.5 text-[9px] font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700">Copy</button>
        <button onClick={() => onDelete(v.id)} className="px-2 py-1.5 text-[9px] font-semibold rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">Del</button>
      </div>
    </div>
  </motion.div>
))

const VizRow = React.memo(({ v, meta, isSelected, onToggle, onEdit, onStar, onDuplicate, onDelete }) => (
  <tr className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-700/30 ${isSelected ? 'bg-[#8b5cf6]/5' : ''}`}>
    <td className="px-3 py-2.5"><div onClick={() => onToggle(v.id)} className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer ${isSelected ? 'bg-[#8b5cf6] border-[#8b5cf6]' : 'border-zinc-300 dark:border-zinc-600'}`}>{isSelected && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}</div></td>
    <td className="px-3 py-2.5"><div className="flex items-center gap-2.5"><span className="text-base">{meta.icon}</span><div><span onClick={() => onEdit(v)} className="font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer hover:text-[#8b5cf6]">{v.name}</span>{v.description && <div className="text-[9px] text-zinc-400 truncate max-w-[250px]">{v.description}</div>}</div></div></td>
    <td className="px-3 py-2.5"><span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: meta.color + '15', color: meta.color }}>{meta.label}</span></td>
    <td className="px-3 py-2.5 text-zinc-400 text-[10px]">{new Date(v.createdAt).toLocaleDateString()}</td>
    <td className="px-3 py-2.5 text-right"><div className="flex gap-1 justify-end">
      <button onClick={() => onStar(v.id)} className={`p-1 rounded ${v.starred ? 'text-yellow-500' : 'text-zinc-400 hover:text-yellow-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={v.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>
      <button onClick={() => onEdit(v)} className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      <button onClick={() => onDuplicate(v.id)} className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
      <button onClick={() => onDelete(v.id)} className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
    </div></td>
  </tr>
))

export default function VizManager() {
  const [vizList, setVizList] = useState([])
  const [search, setSearch] = useState('')
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [typeSearch, setTypeSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [page, setPage] = useState(1)
  const [renamingId, setRenamingId] = useState(null)
  const [renameVal, setRenameVal] = useState('')
  const [viewMode, setViewMode] = useState('grid')

  useEffect(() => { setVizList(vizService.list()) }, [])

  const refresh = useCallback(() => { setVizList(vizService.list()); setSelected(new Set()); setRenamingId(null) }, [])

  const filtered = useMemo(() => vizList.filter(v => !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.description?.toLowerCase().includes(search.toLowerCase())), [vizList, search])
  const totalPages = useMemo(() => Math.ceil(filtered.length / ITEMS_PER_PAGE), [filtered])
  const paged = useMemo(() => filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE), [filtered, page])

  useEffect(() => { setPage(1) }, [search])

  const toggleSelect = useCallback((id) => { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }, [])
  const handleDelete = useCallback((id) => { vizService.delete(id); refresh() }, [refresh])
  const handleBulkDelete = useCallback(() => { for (const id of selected) vizService.delete(id); setShowDeleteConfirm(false); refresh() }, [selected, refresh])
  const handleDuplicate = useCallback((id) => { vizService.duplicate(id); refresh() }, [refresh])
  const handleStar = useCallback((id) => { const v = vizService.get(id); if (v) { vizService.save({ ...v, starred: !v.starred }); refresh() } }, [refresh])
  const startRename = useCallback((v) => { setRenamingId(v.id); setRenameVal(v.name) }, [])
  const commitRename = useCallback(() => { if (renamingId && renameVal.trim()) { const v = vizService.get(renamingId); if (v) vizService.save({ ...v, name: renameVal.trim() }); refresh() } setRenamingId(null) }, [renamingId, renameVal, refresh])
  const handleEdit = useCallback((v) => { localStorage.setItem('unishield_pending_viz', JSON.stringify({ editVizId: v.id, editViz: v })); localStorage.setItem('dashboard_tab', 'vizbuilder'); window.location.reload() }, [])
  const handleCreateFromPicker = useCallback((key, meta) => { setShowTypePicker(false); const viz = vizService.create({ name: meta.label, type: key }); localStorage.setItem('unishield_pending_viz', JSON.stringify({ editVizId: viz.id, editViz: viz })); localStorage.setItem('dashboard_tab', 'vizbuilder'); window.location.reload() }, [])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center shadow-sm">
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">Visualization Manager</h2>
          <p className="text-[11px] text-zinc-400 font-medium">{vizList.length} visualization{vizList.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1" />
        {selected.size > 0 && (
          <button onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all active:scale-95">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            Delete ({selected.size})
          </button>
        )}
        <button onClick={() => setShowTypePicker(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white hover:from-[#7c3aed] hover:to-[#6d28d9] transition-all shadow-sm active:scale-95">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setSelected(new Set()) }} placeholder="Search visualizations..."
            className="w-full pl-9 pr-3 py-2 text-[11px] bg-white dark:bg-zinc-800/60 rounded-xl outline-none text-zinc-800 dark:text-zinc-100 border border-zinc-200/70 dark:border-zinc-700/40 focus:border-[#8b5cf6]/40 transition-all" />
        </div>
        <div className="flex gap-1">
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg border ${viewMode === 'grid' ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]' : 'border-zinc-200 text-zinc-400 hover:bg-zinc-100'}`}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg border ${viewMode === 'list' ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]' : 'border-zinc-200 text-zinc-400 hover:bg-zinc-100'}`}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/10 rounded-xl border border-[#8b5cf6]/20 text-[10px]">
          <span className="font-semibold text-[#8b5cf6]">{selected.size} selected</span>
          <span className="w-px h-3 bg-zinc-200 dark:bg-zinc-700" />
          <button onClick={() => { if (selected.size === paged.length) setSelected(new Set()); else setSelected(new Set(paged.map(v => v.id))) }} className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-800">Select all {paged.length}</button>
          <button onClick={() => setSelected(new Set())} className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-800">Clear</button>
          <div className="flex-1" />
          <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1 text-red-500 hover:text-red-600 font-semibold">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            Delete
          </button>
        </div>
      )}

      {paged.length === 0 ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
            <p className="text-sm font-semibold text-zinc-500">{search ? 'No matching visualizations' : 'No visualizations yet'}</p>
            <p className="text-[11px] text-zinc-400 mt-1">{search ? 'Try a different search' : 'Create your first visualization'}</p>
            {!search && <button onClick={() => setShowTypePicker(true)} className="mt-4 px-4 py-2 text-[10px] font-semibold rounded-lg bg-[#8b5cf6] text-white hover:bg-[#7c3aed]">Create</button>}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {paged.map(v => {
            const meta = TYPE_META[v.type] || { label: v.type, icon: '📊', color: '#6b7280' }
            return <VizCard key={v.id} v={v} meta={meta} isSelected={selected.has(v.id)} isRenaming={renamingId === v.id} renameVal={renameVal}
              onToggle={toggleSelect} onStar={handleStar} onEdit={handleEdit} onDuplicate={handleDuplicate} onDelete={handleDelete}
              onStartRename={startRename} onRenameChange={(e) => setRenameVal(e.target.value)} onRenameCommit={commitRename} />
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <table className="w-full text-[11px] font-mono border-collapse">
            <thead><tr className="bg-zinc-50 dark:bg-zinc-800/40">
              <th className="w-10 px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
                <div onClick={() => { if (selected.size === paged.length) setSelected(new Set()); else setSelected(new Set(paged.map(v => v.id))) }}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer ${selected.size === paged.length ? 'bg-[#8b5cf6] border-[#8b5cf6]' : 'border-zinc-300 dark:border-zinc-600'}`}>
                  {selected.size === paged.length && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-zinc-500 border-b">Name</th>
              <th className="text-left px-3 py-2.5 font-semibold text-zinc-500 border-b">Type</th>
              <th className="text-left px-3 py-2.5 font-semibold text-zinc-500 border-b">Created</th>
              <th className="text-right px-3 py-2.5 font-semibold text-zinc-500 border-b">Actions</th>
            </tr></thead>
            <tbody>{paged.map(v => {
              const meta = TYPE_META[v.type] || { label: v.type, icon: '📊', color: '#6b7280' }
              return <VizRow key={v.id} v={v} meta={meta} isSelected={selected.has(v.id)}
                onToggle={toggleSelect} onEdit={handleEdit} onStar={handleStar} onDuplicate={handleDuplicate} onDelete={handleDelete} />
            })}</tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="px-2.5 py-1.5 text-[10px] font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 disabled:opacity-30">Prev</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let p; if (totalPages <= 7) p = i + 1; else if (page <= 4) p = i + 1; else if (page >= totalPages - 3) p = totalPages - 6 + i; else p = page - 3 + i
            return <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 text-[10px] font-semibold rounded-lg ${page === p ? 'bg-[#8b5cf6] text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}>{p}</button>
          })}
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="px-2.5 py-1.5 text-[10px] font-medium rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-30">Next</button>
        </div>
      )}

      {/* Delete Confirm Modal */}
      <AnimatePresence>{showDeleteConfirm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowDeleteConfirm(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
            className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl p-6 w-full max-w-sm mx-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </div>
              <div><h3 className="text-sm font-bold text-zinc-800">Delete Visualizations</h3><p className="text-[11px] text-zinc-500">This cannot be undone</p></div>
            </div>
            <p className="text-[12px] text-zinc-600 mb-5">Delete <strong>{selected.size}</strong> visualization{selected.size !== 1 ? 's' : ''}?</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 text-[10px] font-semibold rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50">Cancel</button>
              <button onClick={handleBulkDelete} className="flex-1 py-2 text-[10px] font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600">Delete</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Type Picker Modal */}
      <AnimatePresence>{showTypePicker && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowTypePicker(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl w-full max-w-2xl mx-3 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-700">
              <div><h3 className="text-sm font-bold text-zinc-800">Choose Type</h3><p className="text-[10px] text-zinc-400 mt-0.5">Select a chart type</p></div>
              <button onClick={() => setShowTypePicker(false)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="px-5 py-3 border-b border-zinc-200"><div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={typeSearch} onChange={e => setTypeSearch(e.target.value)} placeholder="Search types..." className="w-full pl-9 pr-3 py-2 text-[11px] bg-zinc-50 dark:bg-zinc-800/60 rounded-xl outline-none border border-zinc-200" autoFocus />
            </div></div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(TYPE_META).filter(([, m]) => !typeSearch || m.label.toLowerCase().includes(typeSearch.toLowerCase())).map(([key, meta]) => (
                  <button key={key} onClick={() => handleCreateFromPicker(key, meta)}
                    className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 hover:border-[#8b5cf6]/40 hover:bg-[#8b5cf6]/5 transition-all group">
                    <span className="text-2xl">{meta.icon}</span>
                    <span className="text-[11px] font-semibold text-zinc-700 text-center">{meta.label}</span>
                    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-400">{key}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </motion.div>
  )
}
