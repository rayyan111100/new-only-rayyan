import React, { useState, useRef } from 'react'
import { useDashboard } from './dashboardStore'
import DashboardFolderSelector from './DashboardFolderSelector'
import DashboardTabs from './DashboardTabs'

export default function DashboardToolbar({ folders, activeFolderId, activeTabId, onFolderChange, onTabChange, onNewFolder, onEditFolder, onDeleteFolder, onNewTab, onDeleteTab, onRenameTab }) {
  const { activeDashboard, setActiveDashboard, setTimeRange, setFilters, addPanel, removePanel } = useDashboard()
  const fileRef = useRef(null)
  const [importError, setImportError] = useState('')

  const activeFolder = folders.find(f => f.id === activeFolderId)
  const tabs = activeFolder?.tabs || []

  const openWidgetLib = () => window.dispatchEvent(new CustomEvent('open-widget-lib'))
  const openTemplates = () => window.dispatchEvent(new CustomEvent('open-templates'))

  const handleSave = () => {
    window.dispatchEvent(new CustomEvent('save-dashboard'))
  }

  const handleClone = () => {
    if (!activeDashboard) return
    window.dispatchEvent(new CustomEvent('clone-tab'))
  }

  const handleExport = () => {
    if (!activeDashboard) return
    const data = { name: activeDashboard.name, panels: activeDashboard.panels, timeRange: activeDashboard.timeRange }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (activeDashboard.name || 'dashboard').replace(/\s+/g, '_') + '.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const dash = JSON.parse(ev.target.result)
        if (!dash.panels) throw new Error('Invalid dashboard file')
        window.dispatchEvent(new CustomEvent('import-dashboard', { detail: { dashboard: dash } }))
      } catch (err) { setImportError(err.message) }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleAddPanel = (vizId) => {
    if (!activeDashboard) return
    const panel = { id: 'panel_' + Date.now(), title: 'New Panel', vizType: 'bar', vizConfig: null, x: 0, y: 0, data: null, lastUpdated: null }
    addPanel(panel)
  }

  const handleAutoLayout = () => {
    window.dispatchEvent(new CustomEvent('auto-layout'))
  }

  const handleRemoveAll = () => {
    if (!activeDashboard || !window.confirm('Remove all widgets from this dashboard?')) return
    activeDashboard.panels.forEach(p => removePanel(p.id))
    window.dispatchEvent(new CustomEvent('save-dashboard'))
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
        <DashboardFolderSelector
          folders={folders}
          activeFolderId={activeFolderId}
          onSelect={onFolderChange}
          onNewFolder={onNewFolder}
          onEditFolder={onEditFolder}
          onDeleteFolder={onDeleteFolder}
        />
        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />
        <div className="flex-1 min-w-0">
          <DashboardTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onSelect={onTabChange}
            onAdd={onNewTab}
            onDelete={onDeleteTab}
            onRename={onRenameTab}
          />
        </div>
        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />
        <div className="flex items-center gap-0.5">
          <button onClick={handleSave} disabled={!activeDashboard} title="Save Dashboard"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>
          </button>
          <button onClick={handleClone} disabled={!activeDashboard} title="Clone Dashboard"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          </button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('save-template'))} disabled={!activeDashboard} title="Save as Template"
            className="p-1.5 rounded-md text-zinc-400 hover:text-[#10b981] hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-40">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 00-4 4v2a4 4 0 008 0V6a4 4 0 00-4-4z"/><path d="M16 14H8a4 4 0 00-4 4v2a2 2 0 002 2h12a2 2 0 002-2v-2a4 4 0 00-4-4z"/></svg>
          </button>
        </div>
        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />
        <div className="flex items-center gap-0.5">
          <button onClick={openWidgetLib} disabled={!activeDashboard} title="Add Widget"
            className="p-1.5 rounded-md bg-[#EF843C] text-white hover:bg-[#e0752a] transition-all disabled:opacity-40">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button onClick={openTemplates} disabled={!activeDashboard} title="Templates"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
          <span className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
          <button onClick={handleAutoLayout} title="Auto arrange"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('toggle-autoload'))} title="Toggle auto-load template"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 00-4 4v2a4 4 0 008 0V6a4 4 0 00-4-4z"/><path d="M16 14H8a4 4 0 00-4 4v2a2 2 0 002 2h12a2 2 0 002-2v-2a4 4 0 00-4-4z"/></svg>
          </button>
          <button onClick={() => fileRef.current?.click()} title="Import"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <button onClick={handleExport} disabled={!activeDashboard} title="Export"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('refresh-dashboard'))} title="Refresh"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          </button>
          <button onClick={handleRemoveAll} disabled={!activeDashboard || !activeDashboard.panels?.length} title="Remove all"
            className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-30">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
          <span className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
          <button onClick={() => { if (window.confirm('Reset all dashboard data? This will clear all folders and tabs.')) { localStorage.removeItem('unishield_folders'); window.location.reload() } }} title="Reset Dashboard"
            className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          </button>
        </div>
      </div>

      {importError && <div className="px-3 text-[9px] text-red-500">{importError}</div>}
    </>
  )
}
