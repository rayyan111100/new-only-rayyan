import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DashboardProvider, useDashboard } from '../components/dashboard/dashboardStore'
import DashboardToolbar from '../components/dashboard/DashboardToolbar'
import DashboardGrid from '../components/dashboard/DashboardGrid'
import TimeRangeSelector from '../components/dashboard/TimeRangeSelector'
import TemplateLibraryModal from '../components/dashboard/TemplateLibraryModal'
import WidgetLibraryModal from '../components/dashboard/WidgetLibraryModal'
// Share & Report features available in full deployment
import { dashboardService } from '../components/dashboard/dashboardService'
import { saveUserTemplate } from '../components/dashboard/dashboardTemplates'
import { folderService } from '../components/dashboard/dashboardFolderService'
import { useApp } from '../context/AppContext'
import FilterChip from '../components/FilterChip'
import DashboardFilterEditor from '../components/dashboard/DashboardFilterEditor'

function CustomDashboardInner() {
  const { activeDashboard, timeRange, setTimeRange, addPanel, setActiveDashboard, setDashboards, setFilters, showReportWindow, toggleReportWindow, triggerRefresh, panels, globalFilters, addFilter, removeFilter, updateFilter, filterMatch, setFilterMatch, clearFilters } = useDashboard()
  const gfRef = useRef(globalFilters)
  const trRef = useRef(timeRange)
  const adRef = useRef(activeDashboard)
  gfRef.current = globalFilters
  trRef.current = timeRange
  adRef.current = activeDashboard
  const [saveTrigger, setSaveTrigger] = useState(0)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [chipFilterIdx, setChipFilterIdx] = useState(null)
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
  const [showSaveTpl, setShowSaveTpl] = useState(false)
  const [saveTplName, setSaveTplName] = useState('')
  const [folders, setFolders] = useState([])
  const [activeFolderId, setActiveFolderId] = useState(null)
  const [activeTabId, setActiveTabId] = useState(null)
  const [autoLoad, setAutoLoad] = useState(() => localStorage.getItem('unishield_autoload') === 'true')

  useEffect(() => {
    const close = (e) => { if (!e.target.closest('.filter-chip-dropdown') && !e.target.closest('.filter-chip-wrapper')) setChipFilterIdx(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  // Initialize folders — auto-create if toggle is ON
  useEffect(() => {
    const f = folderService.init()
    setFolders(f)
    if (f.length > 0 && !activeFolderId) {
      setActiveFolderId(f[0].id)
    } else if (f.length === 0 && autoLoad) {
      import('../components/dashboard/dashboardTemplates').then(m => {
        const dash = m.createFromTemplate('soc-overview-v2')
        if (dash) {
          const folder = folderService.createFolder('Default')
          if (folder) {
            folderService.saveDashboardToTab(folder.id, folder.tabs[0].id, { ...dash, name: 'SOC Overview' })
            refreshFolders()
            setActiveFolderId(folder.id)
          }
        }
      })
    }
  }, [autoLoad])

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
      // Cap cached heights: metrics max 6 (150px), charts max 8 (200px), tables max 8 (200px)
      const cappedPanels = (dash.panels || []).map(p => {
        const type = p.type || p.vizType || ''
        const maxH = ['metric', 'gauge', 'kpi'].includes(type) ? 6 :
                     ['area', 'line', 'bar', 'pie', 'heatmap', 'timeline', 'tagcloud'].includes(type) ? 8 :
                     ['table', 'data-table', 'clusterbubble', 'log-stream'].includes(type) ? 8 : 10
        return { ...p, h: Math.min(p.h || 4, maxH) }
      })
      // Remove invalid filters (like ":14" without field prefix)
      const validFilters = (dash.globalFilters || []).filter(f => {
        if (f.type === 'text' && f.query && !f.query.includes(':')) return false
        if (f.type === 'pair' && (!f.key || !f.value)) return false
        return true
      })
      setActiveDashboard({ ...dash, panels: cappedPanels })
      setTimeRange(dash.timeRange || { from: 'now-24h', to: 'now' })
      setFilters(validFilters)
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
      const cleanPanels = (dash.panels || []).map(p => ({
        ...p, x: p.x ?? 0, y: p.y ?? 0, w: p.w ?? 4, h: p.h ?? 5,
      }))
      folderService.saveDashboardToTab(activeFolderId, tab.id, { ...dash, name: tab.name, panels: cleanPanels })
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
    const rf = () => handleRefresh()
    const al = () => handleAutoLayout()
    const gf = () => {}
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
    window.addEventListener('refresh-dashboard', rf)
    window.addEventListener('auto-layout', al)
    window.addEventListener('open-global-filters', gf)
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
    const st = () => { setSaveTplName(''); setShowSaveTpl(true) }
    window.addEventListener('save-template', st)
    const tal = () => { setAutoLoad(v => { const n = !v; localStorage.setItem('unishield_autoload', n); return n }) }
    window.addEventListener('toggle-autoload', tal)
    return () => {
      window.removeEventListener('open-widget-lib', w)
      window.removeEventListener('open-templates', t)
      window.removeEventListener('refresh-dashboard', rf)
      window.removeEventListener('auto-layout', al)
      window.removeEventListener('open-global-filters', gf)
      window.removeEventListener('save-dashboard', sd)
      window.removeEventListener('open-panel-settings', ps)
      window.removeEventListener('open-vizbuilder', vb)
      window.removeEventListener('clone-tab', ct)
      window.removeEventListener('import-dashboard', id)
      window.removeEventListener('save-template', st)
      window.removeEventListener('toggle-autoload', tal)
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
          {/* Global Filters — Wazuh/EUI style */}
          <div className="flex items-center gap-1 flex-wrap">
            <div className="relative">
              <button onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="px-1.5 py-0.5 text-[10px] border rounded bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                title="Add filter">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
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
                      <button onClick={() => { if (filterKey && filterValue) { addFilter({ type: 'pair', key: filterKey, value: filterValue, exclude: filterExclude }); triggerRefresh(); setFilterKey(''); setFilterValue(''); setFilterExclude(false) } }}
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
                      <input value={filterText} onChange={e => setFilterText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && filterText) { addFilter({ type: 'text', query: filterText, exclude: filterTextExclude }); triggerRefresh(); setFilterText(''); setFilterTextExclude(false) }}} placeholder="e.g. rule.level:>=5" className="flex-1 px-2 py-1.5 text-[10px] bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none text-zinc-800 dark:text-zinc-100 font-mono" />
                      <button onClick={() => { if (filterText) { addFilter({ type: 'text', query: filterText, exclude: filterTextExclude }); triggerRefresh(); setFilterText(''); setFilterTextExclude(false) } }}
                        className="px-2 py-1.5 text-[10px] font-medium bg-[#EF843C] text-white rounded-lg hover:bg-[#e0752a] shrink-0">Add</button>
                    </div>
                  </div>
                </div>
              )}
              {showFilterDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)} />}
            </div>

            {globalFilters.length > 1 && (
              <button onClick={() => setFilterMatch(filterMatch === 'and' ? 'or' : 'and')}
                className={'text-[9px] font-bold uppercase px-1 py-0.5 rounded border transition-colors ' + (filterMatch === 'and' ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300' : 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300')}
                title={'Filters match mode: ' + (filterMatch === 'and' ? 'ALL (AND)' : 'ANY (OR)') + '. Click to toggle.'}>
                {filterMatch === 'and' ? 'ALL' : 'ANY'}
              </button>
            )}

            <AnimatePresence>
              {globalFilters.filter(f => !f.pinned).map((f, i) => (
                <div key={f.id || i} className="relative inline-flex filter-chip-wrapper">
                  <FilterChip filter={f}
                    onEdit={() => setChipFilterIdx(chipFilterIdx === i ? null : i)}
                    onToggle={(id, negate) => updateFilter(i, { negate })}
                    onToggleDisabled={() => updateFilter(i, { disabled: !f.disabled })}
                    onTogglePin={() => updateFilter(i, { pinned: !f.pinned })}
                    onInvert={() => updateFilter(i, { negate: !f.negate })}
                    onRemove={() => { removeFilter(i); triggerRefresh() }}
                    onCopyDql={() => navigator.clipboard.writeText((f.negate ? 'NOT ' : '') + (f.key || f.field) + ':' + (f.value || ''))}
                    onSaveFilter={(flt) => {
                      const saved = JSON.parse(localStorage.getItem('unishield_saved_filters') || '[]')
                      saved.push({ name: flt.key || flt.field || 'filter', filter: flt, date: new Date().toISOString() })
                      localStorage.setItem('unishield_saved_filters', JSON.stringify(saved))
                    }}
                  />
                  {chipFilterIdx === i && (
                    <div className="filter-chip-dropdown absolute top-full left-0 mt-1 z-[100]">
                      <DashboardFilterEditor
                        filter={f}
                        onClose={() => setChipFilterIdx(null)}
                        onSave={(upd) => {
                          if (upd.addNew) {
                            addFilter({ type: upd.type, key: upd.key, value: upd.value, exclude: upd.exclude })
                          } else {
                            updateFilter(i, { key: upd.key, field: upd.key, value: upd.value, secondValue: upd.secondValue, negate: upd.negate, operator: upd.operator, type: 'pair' })
                          }
                          setChipFilterIdx(null)
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </AnimatePresence>

            {globalFilters.some(f => f.pinned) && globalFilters.some(f => !f.pinned) && (
              <span className="text-[9px] text-zinc-400 mx-0.5">|</span>
            )}

            <AnimatePresence>
              {globalFilters.filter(f => f.pinned).map((f, i) => {
                const realIdx = globalFilters.indexOf(f)
                return (
                <div key={f.id || 'p' + i} className="relative inline-flex filter-chip-wrapper">
                  <FilterChip filter={f}
                    onEdit={() => setChipFilterIdx(chipFilterIdx === realIdx ? null : realIdx)}
                    onToggle={(id, negate) => updateFilter(realIdx, { negate })}
                    onToggleDisabled={() => updateFilter(realIdx, { disabled: !f.disabled })}
                    onTogglePin={() => updateFilter(realIdx, { pinned: !f.pinned })}
                    onInvert={() => updateFilter(realIdx, { negate: !f.negate })}
                    onRemove={() => { removeFilter(realIdx); triggerRefresh() }}
                    onCopyDql={() => navigator.clipboard.writeText((f.negate ? 'NOT ' : '') + (f.key || f.field) + ':' + (f.value || ''))}
                    onSaveFilter={(flt) => {
                      const saved = JSON.parse(localStorage.getItem('unishield_saved_filters') || '[]')
                      saved.push({ name: flt.key || flt.field || 'filter', filter: flt, date: new Date().toISOString() })
                      localStorage.setItem('unishield_saved_filters', JSON.stringify(saved))
                    }}
                  />
                  {chipFilterIdx === realIdx && (
                    <div className="filter-chip-dropdown absolute top-full left-0 mt-1 z-[100]">
                      <DashboardFilterEditor
                        filter={f}
                        onClose={() => setChipFilterIdx(null)}
                        onSave={(upd) => {
                          if (upd.addNew) {
                            addFilter({ type: upd.type, key: upd.key, value: upd.value, exclude: upd.exclude })
                          } else {
                            updateFilter(realIdx, { key: upd.key, field: upd.key, value: upd.value, secondValue: upd.secondValue, negate: upd.negate, operator: upd.operator, type: 'pair' })
                          }
                          setChipFilterIdx(null)
                        }}
                      />
                    </div>
                  )}
                </div>
                )
              })}
            </AnimatePresence>

            {globalFilters.length > 0 && (
              <button onClick={() => { clearFilters(); triggerRefresh() }}
                className="text-[10px] text-zinc-400 hover:text-red-500 dark:hover:text-red-400 px-1 transition-colors" title="Clear all (pinned filters stay)">
                Clear
              </button>
            )}
          </div>

          <TimeRangeSelector value={timeRange} onChange={(tr) => { setTimeRange(tr); triggerRefresh() }} />
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

      {/* Save to Template Dialog */}
      {showSaveTpl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowSaveTpl(false)}>
          <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl w-full max-w-sm mx-3 p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-1">Save as Template</h3>
            <p className="text-[10px] text-zinc-400 mb-3">Save current dashboard as reusable template</p>
            <input value={saveTplName} onChange={e => setSaveTplName(e.target.value)} placeholder="Template name..." autoFocus className="ginput w-full px-3 py-2 text-[11px] mb-3" onKeyDown={e => { if (e.key === 'Enter') { const ad = adRef.current; if (ad && saveTplName.trim()) { saveUserTemplate(saveTplName.trim(), ad); setShowSaveTpl(false); } } }} />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowSaveTpl(false)} className="px-4 py-2 text-[10px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={() => { const ad = adRef.current; if (ad && saveTplName.trim()) { saveUserTemplate(saveTplName.trim(), ad); setShowSaveTpl(false); } }} className="px-5 py-2 text-[10px] font-semibold rounded-lg bg-gradient-to-r from-[#10b981] to-[#059669] text-white hover:from-[#059669] hover:to-[#047857] transition-all">Save</button>
            </div>
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
