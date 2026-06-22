import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { DashboardProvider, useDashboard } from '../components/dashboard/dashboardStore'
import DashboardToolbar from '../components/dashboard/DashboardToolbar'
import DashboardGrid from '../components/dashboard/DashboardGrid'
import TimeRangeSelector from '../components/dashboard/TimeRangeSelector'
import TemplateLibraryModal from '../components/dashboard/TemplateLibraryModal'
import WidgetLibraryModal from '../components/dashboard/WidgetLibraryModal'
import ShareDialog from '../components/share/ShareDialog'
import ReportCreator from '../components/reporting/ReportCreator'
import { dashboardService } from '../components/dashboard/dashboardService'
import { folderService } from '../components/dashboard/dashboardFolderService'
import { useApp } from '../context/AppContext'

function CustomDashboardInner() {
  const { activeDashboard, timeRange, setTimeRange, addPanel, setActiveDashboard, setDashboards, setFilters, showReportWindow, toggleReportWindow, triggerRefresh, panels, globalFilters, addFilter, removeFilter } = useDashboard()
  const gfRef = useRef(globalFilters)
  const trRef = useRef(timeRange)
  const adRef = useRef(activeDashboard)
  gfRef.current = globalFilters
  trRef.current = timeRange
  adRef.current = activeDashboard
  const [saveTrigger, setSaveTrigger] = useState(0)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [filterKey, setFilterKey] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [filterText, setFilterText] = useState('')
  const [filterExclude, setFilterExclude] = useState(false)
  const [filterTextExclude, setFilterTextExclude] = useState(false)
  const [showKeySuggestions, setShowKeySuggestions] = useState(false)
  const keyInputRef = useRef(null)
  const FIELD_PRESETS = [
    'rule.level', 'rule.id', 'rule.description', 'rule.category', 'rule.groups',
    'agent.name', 'agent.id', 'agent.ip',
    '@timestamp', 'location', 'decoder.name', 'decoder.parent', 'full_log',
    'data.action', 'data.protocol',
    'data.srcip', 'data.dstip', 'data.srcport', 'data.dstport',
    'data.srcCountry', 'data.dstCountry', 'data.hostname', 'data.username',
    'data.win.eventId', 'data.win.provider', 'data.win.logName',
    'data.win.eventdata.targetUserName', 'data.win.eventdata.targeDomain',
    'data.win.eventdata.logonId', 'data.win.eventdata.processId', 'data.win.eventdata.workstationName',
    'data.vulnerability.severity', 'data.vulnerability.cvss', 'data.vulnerability.cve',
    'data.vulnerability.title', 'data.vulnerability.description',
    'rule.pci_dss', 'rule.hipaa', 'rule.gdpr', 'rule.nist_800_53', 'rule.tsc',
    'rule.mitre.tactic', 'rule.mitre.technique', 'rule.mitre.id',
  ]
  const { setTab } = useApp()
  const [showWidgetLib, setShowWidgetLib] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [folders, setFolders] = useState([])
  const [activeFolderId, setActiveFolderId] = useState(null)
  const [activeTabId, setActiveTabId] = useState(null)

  // Initialize folders
  useEffect(() => {
    const f = folderService.init()
    setFolders(f)
    if (f.length > 0 && !activeFolderId) {
      setActiveFolderId(f[0].id)
    }
  }, [])

  // When active folder changes, select first tab
  useEffect(() => {
    if (!activeFolderId) return
    const f = folders.find(f => f.id === activeFolderId)
    if (f && f.tabs.length > 0) {
      const tid = activeTabId && f.tabs.find(t => t.id === activeTabId) ? activeTabId : f.tabs[0].id
      loadTab(f.id, tid)
    }
  }, [activeFolderId, folders])

  const loadTab = useCallback((folderId, tabId) => {
    if (!folderId || !tabId) return
    setActiveTabId(tabId)
    const dash = folderService.getTabAsDashboard(folderId, tabId)
    if (dash) {
      setActiveDashboard(dash)
      setTimeRange(dash.timeRange || { from: 'now-24h', to: 'now' })
      setFilters(dash.globalFilters || [])
    }
  }, [setActiveDashboard, setTimeRange, setFilters])

  const saveCurrentToTab = useCallback(() => {
    const ad = adRef.current
    if (!ad || !activeFolderId || !activeTabId) return
    folderService.saveDashboardToTab(activeFolderId, activeTabId, ad)
  }, [activeFolderId, activeTabId])

  // Auto-save on panel changes
  useEffect(() => { if (saveTrigger > 0) saveCurrentToTab() }, [saveTrigger])
  useEffect(() => { setSaveTrigger(s => s + 1) }, [activeDashboard?.panels])

  const refreshFolders = () => setFolders([...folderService.list()])

  const handleFolderChange = (folderId) => {
    setActiveFolderId(folderId)
    setActiveTabId(null)
  }

  const handleTabChange = (tabId) => {
    saveCurrentToTab()
    loadTab(activeFolderId, tabId)
  }

  const handleNewFolder = (name) => {
    folderService.createFolder(name || 'New Folder')
    refreshFolders()
  }

  const handleEditFolder = (folder) => {
    folderService.updateFolder(folder.id, { name: folder.name })
    refreshFolders()
  }

  const handleDeleteFolder = (folderId) => {
    const ok = folderService.deleteFolder(folderId)
    if (!ok) { alert('System folders cannot be deleted.'); return }
    refreshFolders()
    const f = folders.filter(f => f.id !== folderId)
    if (f.length > 0 && activeFolderId === folderId) {
      setActiveFolderId(f[0].id)
    }
  }

  const handleNewTab = (name) => {
    if (!activeFolderId) return
    const tab = folderService.createTab(activeFolderId, name || 'New Tab')
    if (tab) {
      refreshFolders()
      loadTab(activeFolderId, tab.id)
    }
  }

  const handleDeleteTab = (tabId) => {
    if (!activeFolderId) return
    const ok = folderService.deleteTab(activeFolderId, tabId)
    if (!ok) return
    refreshFolders()
    const f = folders.find(f => f.id === activeFolderId)
    if (f && f.tabs.length > 0) {
      const nextTab = f.tabs.find(t => t.id !== tabId) || f.tabs[0]
      loadTab(activeFolderId, nextTab.id)
    }
  }

  const handleRenameTab = (tabId, name) => {
    if (!activeFolderId) return
    folderService.updateTab(activeFolderId, tabId, { name })
    refreshFolders()
  }

  const handleUseTemplate = (dash) => {
    if (!activeFolderId) return
    const tab = folderService.createTab(activeFolderId, dash.name || 'Template')
    if (tab) {
      folderService.saveDashboardToTab(activeFolderId, tab.id, { ...dash, name: tab.name })
      refreshFolders()
      loadTab(activeFolderId, tab.id)
    }
  }

  const handleAddWidget = (panel) => {
    addPanel(panel)
    if (activeFolderId && activeTabId) {
      setTimeout(() => {
        const dash = folderService.getTabAsDashboard(activeFolderId, activeTabId)
        if (dash) {
          folderService.saveDashboardToTab(activeFolderId, activeTabId, {
            ...dash,
            panels: [...(dash.panels || []), panel],
          })
          refreshFolders()
        }
      }, 50)
    }
  }

  const handleCreateReport = () => setShowReport(false)

  const handleRefresh = () => {
    triggerRefresh()
    if (activeDashboard && activeFolderId && activeTabId) {
      folderService.saveDashboardToTab(activeFolderId, activeTabId, { ...activeDashboard, updatedAt: new Date().toISOString() })
    }
  }

  const handleAutoLayout = () => {
    if (!activeDashboard?.panels) return
    const cols = 12
    const w = 4, h = 3
    const panels = activeDashboard.panels.map((p, i) => ({
      ...p,
      x: (i * w) % cols,
      y: Math.floor((i * w) / cols) * h,
      w: p.w || w,
      h: p.h || h,
    }))
    const updated = { ...activeDashboard, panels }
    setActiveDashboard(updated)
    if (activeFolderId && activeTabId) {
      folderService.saveDashboardToTab(activeFolderId, activeTabId, updated)
    }
  }

  useEffect(() => {
    const w = () => setShowWidgetLib(true)
    const t = () => setShowTemplates(true)
    const s = () => setShowShare(true)
    const r = () => setShowReport(true)
    const rf = () => handleRefresh()
    const al = () => handleAutoLayout()
    const gf = () => {}
    const rw = () => toggleReportWindow()
    const sd = () => {
      const ad = adRef.current
      if (ad && activeFolderId && activeTabId) {
        folderService.saveDashboardToTab(activeFolderId, activeTabId, { ...ad, globalFilters: gfRef.current, timeRange: trRef.current, updatedAt: new Date().toISOString() })
        refreshFolders()
      }
    }
    const ps = (e) => {
      window.dispatchEvent(new CustomEvent('open-settings-modal', { detail: { panelId: e.detail?.panelId } }))
    }
    const vb = (e) => {
      const p = e.detail?.panel
      if (p) {
        localStorage.setItem('unishield_pending_viz', JSON.stringify(p))
        setTab('vizbuilder')
      }
    }
    const ct = () => {
      const ad = adRef.current
      if (ad && activeFolderId) {
        const tab = folderService.createTab(activeFolderId, (ad.name || 'Tab') + ' (Copy)')
        if (tab) {
          folderService.saveDashboardToTab(activeFolderId, tab.id, { ...ad, name: tab.name })
          refreshFolders()
          loadTab(activeFolderId, tab.id)
        }
      }
    }
    window.addEventListener('open-widget-lib', w)
    window.addEventListener('open-templates', t)
    window.addEventListener('open-share', s)
    window.addEventListener('open-report', r)
    window.addEventListener('refresh-dashboard', rf)
    window.addEventListener('auto-layout', al)
    window.addEventListener('open-global-filters', gf)
    window.addEventListener('toggle-report-window', rw)
    window.addEventListener('save-dashboard', sd)
    window.addEventListener('open-panel-settings', ps)
    window.addEventListener('open-vizbuilder', vb)
    window.addEventListener('clone-tab', ct)
    const id = (e) => {
      if (activeFolderId) {
        const dash = e.detail?.dashboard
        if (dash) {
          const tab = folderService.createTab(activeFolderId, dash.name || 'Imported')
          if (tab) {
            folderService.saveDashboardToTab(activeFolderId, tab.id, { ...dash, name: tab.name })
            refreshFolders()
            loadTab(activeFolderId, tab.id)
          }
        }
      }
    }
    window.addEventListener('import-dashboard', id)
    return () => {
      window.removeEventListener('open-widget-lib', w)
      window.removeEventListener('open-templates', t)
      window.removeEventListener('open-share', s)
      window.removeEventListener('open-report', r)
      window.removeEventListener('refresh-dashboard', rf)
      window.removeEventListener('auto-layout', al)
      window.removeEventListener('open-global-filters', gf)
      window.removeEventListener('toggle-report-window', rw)
      window.removeEventListener('save-dashboard', sd)
      window.removeEventListener('open-panel-settings', ps)
      window.removeEventListener('open-vizbuilder', vb)
      window.removeEventListener('clone-tab', ct)
      window.removeEventListener('import-dashboard', id)
    }
  }, [activeDashboard, activeFolderId, activeTabId])

  const activeFolder = folders.find(f => f.id === activeFolderId)
  const activeTab = activeFolder?.tabs.find(t => t.id === activeTabId)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full gap-1 pb-4">
      <motion.div layout="position">
        <DashboardToolbar
          folders={folders}
          activeFolderId={activeFolderId}
          activeTabId={activeTabId}
          onFolderChange={handleFolderChange}
          onTabChange={handleTabChange}
          onNewFolder={handleNewFolder}
          onEditFolder={handleEditFolder}
          onDeleteFolder={handleDeleteFolder}
          onNewTab={handleNewTab}
          onDeleteTab={handleDeleteTab}
          onRenameTab={handleRenameTab}
        />
      </motion.div>

      {/* Controls Bar */}
      {activeDashboard && (
        <motion.div layout initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <TimeRangeSelector value={timeRange} onChange={(tr) => { setTimeRange(tr); triggerRefresh() }} />

          {/* Global Filters — Wazuh/EUI style */}
          {globalFilters?.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {globalFilters.map((f, i) => (
                <span key={i} className="inline-flex items-stretch text-[10px] font-medium rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 shadow-sm overflow-hidden">
                  <button onClick={() => { /* click for filter actions */ }} className="flex items-center gap-1 px-2 py-0.5 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">
                    {f.type === 'pair' ? <><span className="text-zinc-500 dark:text-zinc-400">{f.key}:</span><span className="text-[#EF843C] font-medium">{f.value}</span></> : <span className="font-mono">{f.query}</span>}
                  </button>
                  <button onClick={() => removeFilter(i)} className="flex items-center px-1.5 py-0.5 border-l border-zinc-200 dark:border-zinc-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 transition-colors">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor"><path d="M7.293 8 3.146 3.854a.5.5 0 1 1 .708-.708L8 7.293l4.146-4.147a.5.5 0 0 1 .708.708L8.707 8l4.147 4.146a.5.5 0 0 1-.708.708L8 8.707l-4.146 4.147a.5.5 0 0 1-.708-.708L7.293 8Z"/></svg>
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <button onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[#EF843C] hover:text-[#e0752a] transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
              <span>Add filter</span>
            </button>
            {showFilterDropdown && (
              <div className="absolute top-full left-0 mt-1 z-50 w-80 bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xl p-3 space-y-3" onClick={e => e.stopPropagation()}>
                <div>
                  <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Key:Value</div>
                  <div className="flex gap-1 relative">
                    <button onClick={() => setFilterExclude(!filterExclude)}
                      className={'shrink-0 w-6 h-6 flex items-center justify-center rounded text-[11px] font-bold border transition-all ' + (filterExclude ? 'bg-red-50 text-red-500 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' : 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800')}>
                      {filterExclude ? '−' : '+'}
                    </button>
                    <div className="flex-1 min-w-0 relative">
                      <input ref={keyInputRef} value={filterKey} onChange={e => { setFilterKey(e.target.value); setShowKeySuggestions(true) }} onFocus={() => setShowKeySuggestions(true)} onBlur={() => setTimeout(() => setShowKeySuggestions(false), 200)} placeholder="Key" className="w-full px-2 py-1.5 text-[10px] bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none text-zinc-800 dark:text-zinc-100" />
                      {showKeySuggestions && filterKey && (
                        <div className="absolute top-full left-0 mt-0.5 w-full max-h-32 overflow-y-auto bg-white dark:bg-[#252832] border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-10">
                          {FIELD_PRESETS.filter(f => f.includes(filterKey.toLowerCase())).map(f => (
                            <button key={f} onClick={() => { setFilterKey(f); setShowKeySuggestions(false); keyInputRef.current?.focus() }}
                              className="w-full text-left px-2 py-1 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">{f}</button>
                          ))}
                          {FIELD_PRESETS.filter(f => f.includes(filterKey.toLowerCase())).length === 0 && (
                            <div className="px-2 py-1 text-[9px] text-zinc-400">No matching fields</div>
                          )}
                        </div>
                      )}
                    </div>
                    <input value={filterValue} onChange={e => setFilterValue(e.target.value)} placeholder="Value" className="flex-1 min-w-0 px-2 py-1.5 text-[10px] bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none text-zinc-800 dark:text-zinc-100" />
                    <button onClick={() => { if (filterKey && filterValue) { addFilter({ type: 'pair', key: filterKey, value: filterValue, exclude: filterExclude }); setFilterKey(''); setFilterValue(''); setFilterExclude(false) } }}
                      className="px-2 py-1.5 text-[10px] font-medium bg-[#EF843C] text-white rounded-lg hover:bg-[#e0752a] shrink-0">Add</button>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Text Query</div>
                  <div className="flex gap-1">
                    <button onClick={() => setFilterTextExclude(!filterTextExclude)}
                      className={'shrink-0 w-6 h-6 flex items-center justify-center rounded text-[11px] font-bold border transition-all ' + (filterTextExclude ? 'bg-red-50 text-red-500 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' : 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800')}>
                      {filterTextExclude ? '−' : '+'}
                    </button>
                    <input value={filterText} onChange={e => setFilterText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && filterText) { addFilter({ type: 'text', query: filterText, exclude: filterTextExclude }); setFilterText(''); setFilterTextExclude(false) }}} placeholder="e.g. rule.level:>=5" className="flex-1 px-2 py-1.5 text-[10px] bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none text-zinc-800 dark:text-zinc-100 font-mono" />
                    <button onClick={() => { if (filterText) { addFilter({ type: 'text', query: filterText, exclude: filterTextExclude }); setFilterText(''); setFilterTextExclude(false) } }}
                      className="px-2 py-1.5 text-[10px] font-medium bg-[#EF843C] text-white rounded-lg hover:bg-[#e0752a] shrink-0">Add</button>
                  </div>
                </div>
              </div>
            )}
            {showFilterDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)} />}
          </div>

          <button onClick={handleRefresh}
            className="text-[9px] p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-600 transition-all"
            title="Refresh all panels">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          </button>
          <div className="flex-1" />
          <span className="text-[9px] text-zinc-400">{activeTab?.name || ''} · {activeDashboard?.panels?.length || 0} panel{(activeDashboard?.panels?.length || 0) !== 1 ? 's' : ''}</span>
        </motion.div>
      )}

      {/* Dashboard Grid */}
      <motion.div layout className="flex-1 min-h-0 overflow-y-auto rounded-xl bg-zinc-50/30 dark:bg-zinc-900/10 border border-dashed border-zinc-200 dark:border-zinc-700/50 p-1">
        {activeDashboard && activeDashboard.panels?.length > 0 ? (
          <DashboardGrid />
        ) : activeDashboard ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <p className="text-sm font-medium text-zinc-400">Empty dashboard</p>
              <p className="text-[10px] text-zinc-400 mt-1">Add panels using <strong>+ Widget</strong>, <strong>Saved</strong>, or <strong>Templates</strong></p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <p className="text-sm font-medium text-zinc-400">Select or create a dashboard</p>
              <p className="text-[10px] text-zinc-400 mt-1">Use folder dropdown to navigate, or <strong>Save</strong> to persist changes</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Modals */}
      <TemplateLibraryModal open={showTemplates} onClose={() => setShowTemplates(false)} onUseTemplate={handleUseTemplate} />
      <WidgetLibraryModal open={showWidgetLib} onClose={() => setShowWidgetLib(false)} onAddWidget={handleAddWidget} />
      {showShare && activeDashboard && (
        <ShareDialog dashboardId={activeDashboard.id} dashboardTitle={activeDashboard.name} onClose={() => setShowShare(false)} />
      )}
      {showReport && activeDashboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowReport(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-4xl mx-3 max-h-[90vh] overflow-y-auto">
            <ReportCreator onCreateReport={handleCreateReport} onCancel={() => setShowReport(false)} />
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default function CustomDashboardTab() {
  return (
    <DashboardProvider>
      <CustomDashboardInner />
    </DashboardProvider>
  )
}