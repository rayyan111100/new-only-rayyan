import React, { useState, useCallback, useRef, useEffect } from 'react'
import axios from 'axios'
import TabsSystem from './TabsSystem'
import TimeRangeSelector from './TimeRangeSelector'
import YAxisSelector from './YAxisSelector'
import XAxisSelector from './XAxisSelector'
import FilterModal from './FilterModal'
import PreviewPanel from './PreviewPanel'
import { vizService } from '../visualizations/VizService'
import { useApp } from '../../context/AppContext'

const INDEX_PATTERNS = ['unishield360-alerts-4.x-*', 'unishield360-archives-4.x-*', 'unishield360-states-4.x-*', 'unishield360-events-4.x-*', 'unishield360-alerts-*']
const QUERY_LANGUAGES = [{ value: 'lucene', label: 'Lucene (DQL)' }, { value: 'kuery', label: 'KQL' }, { value: 'dsl', label: 'ES DSL' }]
const AUTO_REFRESH_OPTIONS = [{ value: 0, label: 'Off' }, { value: 5, label: '5s' }, { value: 10, label: '10s' }, { value: 30, label: '30s' }, { value: 60, label: '60s' }]
const CHART_TYPES = [
  { id: 'auto', label: 'Auto', icon: 'M4 16l4-4 4 4 4-4 4 4' },
  { id: 'line', label: 'Line', icon: 'M4 17l4-8 4 4 4-6 4 4' },
  { id: 'bar', label: 'Bar', icon: 'M6 18V8m4 10V6m4 12v-6m4 6v-4' },
  { id: 'area', label: 'Area', icon: 'M4 16l4-4 4 4 4-4 4 4v4H4z' },
  { id: 'pie', label: 'Pie', icon: 'M12 2v10l8.5 5M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10' },
]

export default function VisualizationBuilder({ indexPattern = 'unishield360-alerts-4.x-*' }) {
  const { setTab } = useApp()
  const [pendingData] = useState(() => {
    try { const raw = localStorage.getItem('unishield_pending_viz'); if (raw) { localStorage.removeItem('unishield_pending_viz'); return JSON.parse(raw) } } catch {}
    return null
  })
  const editingId = pendingData?.editVizId || null
  const editingViz = pendingData?.editViz || null

  const [activeTab, setActiveTab] = useState('metrics')
  const [query, setQuery] = useState(editingViz?.config?.query || '')
  const [queryLang, setQueryLang] = useState('lucene')
  const [timeRange, setTimeRange] = useState(editingViz?.config?.timeRange || { from: 'now-24h', to: 'now' })
  const [autoRefresh, setAutoRefresh] = useState(0)
  const [filters, setFilters] = useState(editingViz?.config?.filters || [])
  const [yAxis, setYAxis] = useState(editingViz?.config?.yAxis || { metric: 'count', field: '' })
  const [xAxis, setXAxis] = useState(editingViz?.config?.xAxis || { bucket: 'date_histogram', field: '@timestamp', interval: '1h', size: 10 })
  const [chartType, setChartType] = useState(editingViz?.config?.chartType || 'auto')
  const [panelTitle, setPanelTitle] = useState(editingViz?.name || editingViz?.config?.panelTitle || '')
  const [panelWidth, setPanelWidth] = useState(editingViz?.config?.panelWidth || 100)
  const [panelBg, setPanelBg] = useState(editingViz?.config?.panelBg || 'auto')
  const [selectedIndex, setSelectedIndex] = useState(editingViz?.config?.selectedIndex || indexPattern)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)
  const [yAxes, setYAxes] = useState(editingViz?.config?.yAxes || [{ id: 1, metric: 'count', field: '' }])
  const [saved, setSaved] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [panelWidthPx, setPanelWidthPx] = useState(320)
  const [showConfig, setShowConfig] = useState(true)
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  const [maxItems, setMaxItems] = useState(20)
  const [showAddToDash, setShowAddToDash] = useState(false)
  const [dashList, setDashList] = useState([])
  const [dashSearch, setDashSearch] = useState('')
  const [addedToDash, setAddedToDash] = useState(false)

  const debounceRef = useRef(null)
  const autoRefreshRef = useRef(null)
  const executeRef = useRef(null)
  const resizeRef = useRef(null)

  const buildQuery = useCallback(() => {
    const parts = []
    if (query) parts.push(query)
    filters.forEach(f => {
      if (f.operator === 'exists') parts.push(`_exists_:${f.field}`)
      else if (f.operator === 'does not exist') parts.push(`NOT _exists_:${f.field}`)
      else if (f.operator === 'contains') parts.push(`${f.field}:*${f.value}*`)
      else if (f.operator === 'does not contain') parts.push(`NOT ${f.field}:*${f.value}*`)
      else if (f.operator === 'starts with') parts.push(`${f.field}:${f.value}*`)
      else if (f.operator === 'ends with') parts.push(`${f.field}:*${f.value}`)
      else if (['>', '>=', '<', '<='].includes(f.operator)) parts.push(`${f.field}:${f.operator}${f.value}`)
      else parts.push(`${f.field}:${f.value}`)
    })
    return parts.join(' AND ') || undefined
  }, [query, filters])

  const fetchSearch = useCallback(async (showLoading) => {
    if (showLoading) setPreviewLoading(true)
    setPreviewError(null); setDataLoaded(false)
    try {
      const q = buildQuery()
      const baseParams = { index: selectedIndex, start_date: timeRange.from, end_date: timeRange.to }
      if (q) baseParams.q = q
      let r
      if (xAxis.bucket === 'date_histogram') r = await axios.get('/api/aggregate', { params: { ...baseParams, field: xAxis.field || '@timestamp', type: 'date_histogram', interval: xAxis.interval || '1h', limit: 100 }, timeout: 30000 })
      else r = await axios.get('/api/aggregate', { params: { ...baseParams, field: xAxis.field || 'rule.level', type: 'terms', limit: xAxis.size || 20 }, timeout: 30000 })
      const buckets = r.data.buckets || []
      if (buckets.length > 0) { setPreviewData(buckets.map(b => ({ x: b.key_as_string || b.key, y: b.doc_count || 0 }))); setDataLoaded(true) }
      else { setPreviewData([]); setPreviewError('No data found for this configuration.') }
    } catch (e) { const msg = e.response?.data?.error || e.message; setPreviewError(msg.includes('500') ? 'Backend API error. Check connection.' : typeof msg === 'string' ? msg : 'Request failed'); setPreviewData(null) }
    finally { setPreviewLoading(false) }
  }, [buildQuery, selectedIndex, timeRange, xAxis])

  executeRef.current = fetchSearch

  useEffect(() => { if (debounceRef.current) clearTimeout(debounceRef.current); debounceRef.current = setTimeout(() => fetchSearch(false), 600); return () => { if (debounceRef.current) clearTimeout(debounceRef.current) } }, [fetchSearch])
  useEffect(() => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); autoRefreshRef.current = null; if (autoRefresh > 0) autoRefreshRef.current = setInterval(() => executeRef.current?.(true), autoRefresh * 1000); return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current) } }, [autoRefresh])
  useEffect(() => { fetchSearch(true) }, [])

  // Resize handler
  const startResize = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = panelWidthPx
    const onMove = (ev) => { const w = Math.max(240, Math.min(600, startWidth + ev.clientX - startX)); setPanelWidthPx(w) }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = '' }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleSave = () => {
    const config = { yAxis, xAxis: { ...xAxis, label: xAxis.label }, yAxes, filters, timeRange, chartType, query, queryLang, selectedIndex, panelTitle, panelWidth, panelBg }
    const vizData = { name: panelTitle || 'Untitled Visualization', description: `${yAxis.metric}${yAxis.field ? '(' + yAxis.field + ')' : ''} over ${xAxis.field || '@timestamp'}`, type: chartType === 'auto' ? (xAxis.bucket === 'date_histogram' ? 'line' : 'bar') : chartType, config }
    if (editingId) { const existing = vizService.get(editingId); if (existing) vizService.save({ ...existing, ...vizData }) }
    else vizService.create(vizData)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const getCurrentVizId = () => {
    const all = vizService.list()
    const match = all.find(v => v.name === (panelTitle || 'Untitled Visualization') && v.type === (chartType === 'auto' ? (xAxis.bucket === 'date_histogram' ? 'line' : 'bar') : chartType))
    return match?.id || editingId || null
  }

  const openAddToDash = () => {
    handleSave()
    setTimeout(() => {
      try { setDashList(JSON.parse(localStorage.getItem('unishield_dashboards') || '[]')) } catch {}
      setShowAddToDash(true)
    }, 100)
  }

  const handleAddToDash = (dashId) => {
    const all = JSON.parse(localStorage.getItem('unishield_dashboards') || '[]')
    const dash = all.find(d => d.id === dashId)
    if (!dash) return
    const newPanel = {
      id: 'panel_' + Date.now(),
      title: panelTitle || 'Untitled Panel',
      vizType: chartType === 'auto' ? (xAxis.bucket === 'date_histogram' ? 'line' : 'bar') : chartType,
      vizId: getCurrentVizId(),
      vizConfig: { yAxis, xAxis: { ...xAxis, label: xAxis.label }, filters, timeRange, chartType, query, queryLang, selectedIndex },
      x: 0, y: dash.panels?.length || 0, w: 4, h: 3, data: null, lastUpdated: null,
    }
    dash.panels = [...(dash.panels || []), newPanel]
    dash.updatedAt = new Date().toISOString()
    localStorage.setItem('unishield_dashboards', JSON.stringify(all))
    setAddedToDash(true)
    setTimeout(() => { setShowAddToDash(false); setAddedToDash(false) }, 1500)
  }

  const handleYAxisChange = (val) => { setYAxis(val); setYAxes([{ id: 1, ...val }]) }
  const handleXAxisChange = (val) => { setXAxis(val); if (chartType === 'auto') setChartType(val.bucket === 'date_histogram' ? 'line' : val.bucket === 'terms' ? 'bar' : chartType) }
  const removeFilter = (idx) => setFilters(prev => prev.filter((_, i) => i !== idx))
  const addYAxis = () => setYAxes(prev => [...prev, { id: Math.max(...prev.map(a => a.id), 0) + 1, metric: 'count', field: '' }])
  const removeYAxis = (id) => { if (yAxes.length > 1) setYAxes(prev => prev.filter(a => a.id !== id)) }

  return (
    <div className="flex h-full gap-0 lg:gap-4 overflow-hidden">
      {/* Mobile Toggle */}
      <button onClick={() => setMobileConfigOpen(!mobileConfigOpen)} className="lg:hidden fixed bottom-4 left-4 z-50 px-3 py-2 text-[10px] font-semibold rounded-xl bg-[#8b5cf6] text-white shadow-lg hover:bg-[#7c3aed] transition-all">
        {mobileConfigOpen ? '✕ Close' : '⚙ Config'}
      </button>

      {/* Config Panel */}
      <div className={`${showConfig ? 'flex' : 'hidden'} ${mobileConfigOpen ? 'fixed inset-0 z-40 bg-white dark:bg-[#1a1d27]' : 'hidden'} lg:relative lg:flex lg:flex-col shrink-0 bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-all`}
        style={{ width: mobileConfigOpen ? '100%' : panelWidthPx }}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 lg:hidden">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Configuration</span>
          <button onClick={() => setMobileConfigOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <TabsSystem active={activeTab} onChange={setActiveTab}>
          {activeTab === 'data' && (
            <div className="px-3 py-3 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)] lg:max-h-none">
              <FormGroup label="Index Pattern">
                <select value={selectedIndex} onChange={e => setSelectedIndex(e.target.value)} className="ginput w-full px-3 py-2.5 text-[11px] font-mono rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">{INDEX_PATTERNS.map(ip => <option key={ip} value={ip}>{ip}</option>)}</select>
              </FormGroup>
              <FormGroup label="Query">
                <div className="flex gap-1 mb-2">{QUERY_LANGUAGES.map(ql => (<button key={ql.value} onClick={() => setQueryLang(ql.value)} className={`px-2.5 py-1 text-[9px] font-semibold rounded-lg border transition-all ${queryLang === ql.value ? 'bg-[#EF843C] text-white border-[#EF843C]' : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'}`}>{ql.label}</button>))}</div>
                <div className="relative">
                  <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder={queryLang === 'dsl' ? '{"query":{"match_all":{}}}' : 'e.g. rule.level:10'} className="ginput w-full px-3 py-2.5 text-[11px] font-mono pr-9 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 focus:border-[#EF843C]/40 focus:ring-2 focus:ring-[#EF843C]/10 transition-all" />
                  {query && <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
                </div>
              </FormGroup>
              <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
              <FormGroup label="Auto Refresh">
                <div className="flex gap-1.5">{AUTO_REFRESH_OPTIONS.map(ar => (<button key={ar.value} onClick={() => setAutoRefresh(ar.value)} className={`flex-1 px-2 py-1.5 text-[9px] font-medium rounded-lg border transition-all ${autoRefresh === ar.value ? 'bg-[#10b981] text-white border-[#10b981] shadow-sm' : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>{ar.label}</button>))}</div>
              </FormGroup>
              <div>
                <div className="flex items-center justify-between mb-2"><label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Filters</label><button onClick={() => setShowFilterModal(true)} className="text-[9px] font-semibold text-[#EF843C] hover:text-[#e0752a] transition-colors">+ Add</button></div>
                <div className="space-y-1.5">{filters.length === 0 ? <div className="text-[10px] text-zinc-400 italic px-1">No filters applied</div> : filters.map((f, i) => (<div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono group hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"><span className="text-[#EF843C] font-semibold">{f.field}</span><span className="text-zinc-400">{f.operator}</span>{f.value && <span className="text-zinc-600 dark:text-zinc-300 truncate flex-1">{f.value}</span>}<button onClick={() => removeFilter(i)} className="p-0.5 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>))}</div>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700/50 text-[10px]"><div className={`w-2 h-2 rounded-full ${previewLoading ? 'bg-[#EF843C] animate-pulse' : dataLoaded ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} /><span className="text-zinc-500 dark:text-zinc-400 font-medium">{previewLoading ? 'Loading...' : dataLoaded ? `Loaded ${previewData?.length || 0} points` : 'Awaiting config'}</span></div>
            </div>
          )}
          {activeTab === 'metrics' && (
            <div className="px-3 py-3 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)] lg:max-h-none">
              <div>
                <div className="flex items-center justify-between mb-2"><label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Y-Axis</label><button onClick={addYAxis} className="text-[9px] font-semibold text-[#EF843C] hover:text-[#e0752a] transition-colors">+ Add Series</button></div>
                <div className="space-y-3">{yAxes.map((ya, i) => (<div key={ya.id} className="relative bg-white dark:bg-zinc-800/40 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/50 shadow-sm">{yAxes.length > 1 && <button onClick={() => removeYAxis(ya.id)} className="absolute top-2 right-2 p-0.5 text-zinc-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}<div className="text-[8px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Series {i + 1}</div><YAxisSelector value={ya} onChange={(val) => { const ny = [...yAxes]; ny[i] = { ...ny[i], ...val }; if (i === 0) setYAxis(val); setYAxes(ny) }} /></div>))}</div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2.5"><label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Chart Type</label>{chartType !== 'auto' && <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-[#EF843C]/10 text-[#EF843C]">{chartType}</span>}</div>
                <div className="grid grid-cols-5 gap-1.5">{CHART_TYPES.map(ct => (<button key={ct.id} onClick={() => setChartType(ct.id)} className={`flex flex-col items-center gap-1 px-1 py-1.5 rounded-xl border transition-all ${chartType === ct.id ? 'bg-[#EF843C]/10 border-[#EF843C]/40 shadow-sm ring-1 ring-[#EF843C]/20' : 'bg-white dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={chartType === ct.id ? '#EF843C' : '#9ca3af'} strokeWidth="1.5" strokeLinecap="round"><path d={ct.icon}/></svg><span className={`text-[7px] font-semibold ${chartType === ct.id ? 'text-[#EF843C]' : 'text-zinc-500 dark:text-zinc-400'}`}>{ct.label}</span></button>))}</div>
              </div>
              <div className="bg-white dark:bg-zinc-800/40 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/50 shadow-sm"><label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3 block">X-Axis</label><XAxisSelector value={xAxis} onChange={handleXAxisChange} /></div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="px-3 py-3 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)] lg:max-h-none">
              <FormGroup label="Panel Title"><input type="text" value={panelTitle} onChange={e => setPanelTitle(e.target.value)} placeholder="My Visualization" className="ginput w-full px-3 py-2.5 text-[11px] rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 focus:border-[#EF843C]/40 focus:ring-2 focus:ring-[#EF843C]/10" /></FormGroup>
              <div className="grid grid-cols-2 gap-3">
                <FormGroup label="Width"><input type="number" value={panelWidth} onChange={e => setPanelWidth(parseInt(e.target.value) || 100)} min={25} max={100} step={25} className="ginput w-full px-3 py-2.5 text-[11px] rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700" /></FormGroup>
                <FormGroup label="Background"><select value={panelBg} onChange={e => setPanelBg(e.target.value)} className="ginput w-full px-3 py-2.5 text-[11px] rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700"><option value="auto">Auto</option><option value="transparent">Transparent</option><option value="white">White</option><option value="dark">Dark</option></select></FormGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormGroup label="Legend"><select value={yAxis.legendPosition || 'bottom'} onChange={e => setYAxis(prev => ({ ...prev, legendPosition: e.target.value }))} className="ginput w-full px-3 py-2.5 text-[11px] rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700"><option value="bottom">Bottom</option><option value="top">Top</option><option value="left">Left</option><option value="right">Right</option><option value="none">Hidden</option></select></FormGroup>
                <FormGroup label="X Label"><input type="text" value={xAxis.label || ''} onChange={e => setXAxis(prev => ({ ...prev, label: e.target.value }))} placeholder={xAxis.field || '@timestamp'} className="ginput w-full px-3 py-2.5 text-[11px] rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700" /></FormGroup>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} className={`flex-1 py-2.5 text-[11px] font-semibold rounded-xl transition-all active:scale-[0.98] shadow-sm ${saved ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-[#EF843C] to-[#e0752a] text-white hover:from-[#e0752a] hover:to-[#d0661a] shadow-orange-500/20'}`}>{saved ? '✓ Saved' : 'Save'}</button>
                <button onClick={openAddToDash} className="flex-1 py-2.5 text-[11px] font-semibold rounded-xl border border-[#8b5cf6] text-[#8b5cf6] hover:bg-[#8b5cf6]/5 transition-all">+ Dashboard</button>
                <button onClick={() => { localStorage.setItem('dashboard_tab', 'vizmanager'); window.location.reload() }} className="px-4 py-2.5 text-[11px] font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800">Back</button>
              </div>
            </div>
          )}
        </TabsSystem>
      </div>

      {/* Resize Handle */}
      {showConfig && (
        <div className="hidden lg:flex w-2 shrink-0 cursor-col-resize items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group" onMouseDown={startResize}>
          <div className="w-0.5 h-8 rounded-full bg-zinc-300 dark:bg-zinc-600 group-hover:bg-[#EF843C] transition-colors" />
        </div>
      )}

      {/* Preview Panel */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <button onClick={() => setShowConfig(!showConfig)} className="hidden lg:flex p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title={showConfig ? 'Hide config' : 'Show config'}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="KQL query — e.g. rule.level:10" className="flex-1 px-2 py-1 text-[11px] bg-transparent outline-none text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 font-mono min-w-0" />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 mr-1 pr-2 border-r border-zinc-200 dark:border-zinc-700">
              <button onClick={() => setShowLabels(!showLabels)}
                className={`px-1.5 py-1 text-[8px] font-semibold rounded-md border transition-all ${showLabels ? 'bg-[#EF843C]/10 text-[#EF843C] border-[#EF843C]/30' : 'bg-white dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700'}`}
                title={showLabels ? 'Labels visible' : 'Labels hidden'}>
                <svg className="w-3 h-3 inline-block mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
                {showLabels ? 'Lbl' : 'No Lbl'}
              </button>
              <select value={maxItems} onChange={e => setMaxItems(parseInt(e.target.value))}
                className="ginput px-1.5 py-1 text-[8px] font-mono rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500"
                title="Max items to display">
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            {autoRefresh > 0 && <span className="flex items-center gap-1 text-[9px] text-green-600 bg-green-50 dark:bg-green-900/10 px-2 py-1 rounded-lg border border-green-200"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />{autoRefresh}s</span>}
            {previewLoading && <span className="flex items-center gap-1 text-[9px] text-[#EF843C] bg-orange-50 dark:bg-orange-900/10 px-2 py-1 rounded-lg border border-orange-200"><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></span>}
            <button onClick={() => setShowFilterModal(true)} className="text-[10px] font-medium px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800">+ Filter</button>
            <button onClick={() => fetchSearch(true)} disabled={previewLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-[#EF843C] text-white hover:bg-[#e0752a] transition-all disabled:opacity-50 shadow-sm active:scale-[0.98]">
              {previewLoading ? <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
              {previewLoading ? '...' : 'Run'}
            </button>
          </div>
        </div>

        {/* Chart Area */}
        <div className="flex-1 bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm min-h-0">
          {previewLoading ? (
            <div className="flex items-center justify-center h-full"><div className="text-center"><svg className="animate-spin w-7 h-7 mx-auto text-[#EF843C] mb-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg><p className="text-xs text-zinc-400 font-medium">Loading...</p></div></div>
          ) : previewError ? (
            <div className="flex items-center justify-center h-full"><div className="text-center max-w-sm px-6"><svg className="w-8 h-8 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p className="text-[11px] text-zinc-400">{previewError}</p></div></div>
          ) : previewData && previewData.length > 0 ? (
            <PreviewPanel config={{ yAxis, xAxis, data: previewData, chartType, showLabels, maxItems }} />
          ) : (
            <div className="flex items-center justify-center h-full"><div className="text-center"><svg className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg><p className="text-sm font-medium text-zinc-400">Configure your chart</p></div></div>
          )}
        </div>

        {/* Data bar */}
        {previewData && !previewLoading && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 text-[10px] text-zinc-500 shadow-sm">
            <span className="font-semibold text-zinc-600 dark:text-zinc-400">{previewData.length} points</span>
            <span className="w-px h-3 bg-zinc-200 dark:bg-zinc-700" />
            <span>Y: <code className="font-mono font-semibold text-[#EF843C]">{yAxis.metric}{yAxis.field ? '(' + yAxis.field + ')' : ''}</code></span>
            <span className="w-px h-3 bg-zinc-200 dark:bg-zinc-700" />
            <span>X: <code className="font-mono font-semibold text-[#8b5cf6]">{xAxis.bucket}</code>(<code className="font-mono">{xAxis.field || ''}</code>)</span>
            <span className="w-px h-3 bg-zinc-200 dark:bg-zinc-700" />
            <span>{timeRange.from} → {timeRange.to}</span>
            {chartType !== 'auto' && <><span className="w-px h-3 bg-zinc-200 dark:bg-zinc-700" /><span>Type: <code className="font-mono font-semibold text-[#10b981]">{chartType}</code></span></>}
          </div>
        )}
      </div>

      <FilterModal open={showFilterModal} onClose={() => setShowFilterModal(false)} onAdd={(f) => { setFilters(prev => [...prev, f]); setShowFilterModal(false) }} />

      {/* Add to Dashboard Modal */}
      {showAddToDash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowAddToDash(false)}>
          <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl w-full max-w-md mx-3" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{addedToDash ? '✓ Added!' : 'Add to Dashboard'}</h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{addedToDash ? 'Panel added successfully' : 'Choose a dashboard to add this visualization'}</p>
                </div>
                <button onClick={() => setShowAddToDash(false)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            </div>
            {!addedToDash && (
              <>
                <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-700">
                  <input type="text" value={dashSearch} onChange={e => setDashSearch(e.target.value)} placeholder="Search dashboards..." className="w-full px-3 py-2 text-[11px] bg-zinc-50 dark:bg-zinc-800/60 rounded-xl outline-none border border-zinc-200 dark:border-zinc-700" autoFocus />
                </div>
                <div className="max-h-64 overflow-y-auto p-3 space-y-1">
                  {dashList.filter(d => !dashSearch || d.name.toLowerCase().includes(dashSearch.toLowerCase())).length === 0 ? (
                    <div className="text-center py-8 text-xs text-zinc-400">No dashboards found. Create one first.</div>
                  ) : dashList.filter(d => !dashSearch || d.name.toLowerCase().includes(dashSearch.toLowerCase())).map(dash => (
                    <button key={dash.id} onClick={() => handleAddToDash(dash.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/40 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all text-left">
                      <svg className="w-4 h-4 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 truncate">{dash.name}</div>
                        <div className="text-[9px] text-zinc-400">{dash.panels?.length || 0} panels</div>
                      </div>
                      <span className="text-[9px] font-semibold text-[#EF843C] shrink-0">+ Add</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FormGroup({ label, children }) {
  return <div><label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 block">{label}</label>{children}</div>
}
