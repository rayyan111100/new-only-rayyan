import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Plot from 'react-plotly.js'
import axios from 'axios'
import { useDashboard } from './dashboardStore'
import ContextMenu from './ContextMenu'
import ClusterBubbleChart from '../visualizations/ClusterBubbleChart/ClusterBubbleChart'
import PanelSettingsModal from './PanelSettingsModal'

const CHART_COLORS = { area: '#EF843C', bar: '#EF843C', line: '#EF843C', pie: '#8b5cf6', metric: '#10b981', gauge: '#06b6d4', table: '#6b7280', heatmap: '#ef4444', 'alert-counter': '#ef4444', timeline: '#06b6d4', clusterbubble: '#14b8a6', kpi: '#d97706', 'log-stream': '#0ea5e9', 'top-n': '#f97316', 'agent-status': '#10b981', markdown: '#6b7280', tagcloud: '#a855f7' }
const REFRESH_INTERVAL = 30000

function buildQ(panel, globalFilters) {
  const cfg = panel.vizConfig || {}
  const q = panel.query || {}
  const index = cfg.selectedIndex || 'unishield360-alerts-4.x-*'
  const start = cfg.timeRange?.from || 'now-24h'
  const end = cfg.timeRange?.to || 'now'
  let queryStr = cfg.query || q.query || ''

  const base = { index, start_date: start, end_date: end }

  let parts = []
  if (queryStr) {
    const fixed = queryStr.replace(/>=/g, ':').replace(/<=/g, ':').replace(/>/g, ':').replace(/</g, ':').replace(/\s*:\s*/g, ':')
    if (fixed && fixed !== '*') parts.push(fixed)
  }
  if (globalFilters?.length) {
    for (const f of globalFilters) {
      if (f.type === 'pair' && f.key && f.value) {
        const expr = f.key + ':' + f.value
        parts.push(f.exclude ? 'NOT ' + expr : expr)
      }
      if (f.type === 'text' && f.query) {
        parts.push(f.exclude ? 'NOT ' + f.query : f.query)
      }
    }
  }
  if (parts.length) base.q = parts.join(' AND ')

  return base
}

async function fetchPanelData(panel, globalFilters) {
  const panelType = panel.type || panel.vizType || ''
  const q = panel.query || {}
  const cfg = panel.vizConfig || {}
  const base = buildQ(panel, globalFilters)

  // EPS calculation
  if (q.aggregation?.type === 'eps') {
    const epsWindow = q.aggregation?.interval || '60s'
    const epsBase = { ...base, start_date: 'now-' + epsWindow, end_date: 'now' }
    const { data } = await axios.get('/api/count', { params: epsBase, timeout: 15000 })
    const count = data?.count ?? data ?? 0
    const seconds = parseInt(epsWindow) || 60
    const eps = count / seconds
    return { type: 'metric', data: Math.round(eps * 100) / 100, raw: { count, eps, seconds } }
  }

  // Metric/Count
  if (panelType === 'metric' || panelType === 'gauge' || panelType === 'kpi' || panelType === 'alert-counter' || q.aggregation?.type === 'count') {
    const useCardinality = q.aggregation?.field && q.aggregation?.type === 'cardinality'
    if (useCardinality) {
      const { data } = await axios.get('/api/aggregate', { params: { ...base, field: q.aggregation.field, type: 'cardinality', limit: 1 }, timeout: 15000 })
      const val = Math.round(data?.buckets?.[0]?.value || data?.value || 0)
      return { type: panelType, data: val, raw: val }
    }
    const { data } = await axios.get('/api/count', { params: base, timeout: 15000 })
    const count = data?.count ?? data ?? 0
    if (panelType === 'alert-counter') {
      return { type: 'alert-counter', data: { critical: Math.round(count * 0.05), high: Math.round(count * 0.15), medium: Math.round(count * 0.3), low: count - Math.round(count * 0.5) }, raw: count }
    }
    return { type: panelType === 'gauge' ? 'gauge' : 'metric', data: count, raw: count }
  }

  // Log stop detection — find agents with no recent activity (must be before aggregation table)
  if (panelType === 'table' && q.aggregation?.type === 'logstop') {
    const lookback = q.aggregation.interval || '5m'
    const searchBase = { ...base, start_date: 'now-' + lookback, end_date: 'now' }
    const recentRes = await axios.get('/api/aggregate', {
      params: { ...searchBase, field: 'agent.name', type: 'terms', limit: 100 },
      timeout: 15000
    })
    const recentAgents = new Set((recentRes.data?.buckets || []).map(b => b.key))

    const allRes = await axios.get('/api/aggregate', {
      params: { ...base, field: 'agent.name', type: 'terms', limit: 100 },
      timeout: 15000
    })
    const allAgents = (allRes.data?.buckets || []).map(b => b.key)

    const stopped = allAgents.filter(a => !recentAgents.has(a)).map((a, i) => ({
      '#': i + 1,
      agent: a || 'unknown',
      lastSeen: '>' + lookback + ' ago',
      status: 'STOPPED',
    }))
    return { type: 'table', data: stopped, raw: stopped.length }
  }

  // Aggregation Table — table with aggregation field (shows aggregated data in table format)
  if ((panelType === 'table' || panelType === 'log-stream') && q.aggregation?.field) {
    const aggField = q.aggregation.field
    const aggType = q.aggregation.type || 'terms'
    const aggLimit = q.aggregation.limit || 20
    const epsInterval = q.aggregation.eps ? (q.aggregation.interval || '60s') : null
    const epsSeconds = epsInterval ? (parseInt(epsInterval) || 60) : null
    // For EPS per asset, fetch count with short time window separately
    let epsBuckets = null
    if (epsInterval) {
      const epsBase = { ...base, start_date: 'now-' + epsInterval, end_date: 'now' }
      const epsRes = await axios.get('/api/aggregate', {
        params: { ...epsBase, field: aggField, type: 'terms', limit: aggLimit },
        timeout: 15000
      })
      epsBuckets = epsRes.data?.buckets || []
    }
    const params = { ...base, field: aggField, type: aggType, limit: aggLimit }
    if (aggType === 'date_histogram') params.interval = q.aggregation.interval || '1h'
    const { data } = await axios.get('/api/aggregate', { params, timeout: 15000 })
    const buckets = data?.buckets || []
    const totalCount = buckets.reduce((s, x) => s + (x.doc_count || 0), 0) || 1
    const epsLookup = {}
    if (epsBuckets) {
      epsBuckets.forEach(b => { epsLookup[b.key] = (b.doc_count || 0) / epsSeconds })
    }
    const flat = buckets.map((b, i) => {
      const agentName = b.key_as_string || b.key || ''
      const count = b.doc_count || 0
      const eps = epsInterval ? (epsLookup[agentName] || (count / epsSeconds)) : null
      return {
        '#': i + 1,
        agent: agentName,
        count,
        ...(eps !== null ? { eps: Math.round(eps * 100) / 100 } : {}),
        ...(aggType === 'date_histogram' ? {} : { pct: (count / totalCount * 100).toFixed(1) + '%' }),
        ...(epsInterval ? { status: eps > 0 ? 'ACTIVE' : 'IDLE' } : {})
      }
    })
    return { type: 'table', data: flat, raw: buckets.length }
  }

  // Table / Log stream
  if (panelType === 'table' || panelType === 'log-stream') {
    const sortField = q.sort?.field || '@timestamp'
    const sortOrder = q.sort?.order || 'desc'
    const limit = q.limit || 10
    const { data } = await axios.get('/api/search', { params: { ...base, limit: Math.min(limit, 50), sort: sortField, order: sortOrder }, timeout: 15000 })
    const results = data?.results || data?.hits || []
    const flat = results.map(doc => {
      const r = {}
      for (const [k, v] of Object.entries(doc)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          for (const [sk, sv] of Object.entries(v)) r[k + '.' + sk] = typeof sv === 'object' ? JSON.stringify(sv) : sv
        } else { r[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '') }
      }
      return r
    })
    return { type: 'table', data: flat.slice(0, limit), raw: data?.total || 0 }
  }

  // Cluster Bubble
  if (panelType === 'clusterbubble') {
    const { data } = await axios.get('/api/aggregate', { params: { ...base, field: q.aggregation?.field || 'agent.name', type: 'terms', limit: q.aggregation?.limit || 10 }, timeout: 15000 })
    const buckets = data?.buckets || []
    return { type: 'clusterbubble', chartType: 'clusterbubble', data: buckets.map(b => ({ x: b.key, y: b.doc_count || 0 })), raw: buckets }
  }

  // Aggregation (bar, pie, area, line, heatmap, timeline)
  if (q.aggregation?.field || ['bar', 'pie', 'area', 'line', 'timeline', 'heatmap', 'clusterbubble'].includes(panelType)) {
    const FIELD_MAP = { bar: 'rule.level', pie: 'rule.category', heatmap: 'rule.mitre.tactic', line: '@timestamp', area: '@timestamp', timeline: '@timestamp' }
    const aggField = q.aggregation?.field || FIELD_MAP[panelType] || 'rule.level'
    const aggType = q.aggregation?.type || (['area', 'line', 'timeline'].includes(panelType) ? 'date_histogram' : 'terms')
    const aggInterval = q.aggregation?.interval || '1h'
    const aggLimit = q.aggregation?.limit || 10
    const params = { ...base, field: aggField, type: aggType, limit: aggLimit }
    if (aggType === 'date_histogram') params.interval = aggInterval
    const { data } = await axios.get('/api/aggregate', { params, timeout: 15000 })
    const buckets = data?.buckets || []
    return { type: 'chart', chartType: panelType, data: buckets.map(b => ({ x: b.key_as_string || b.key, y: b.doc_count || 0 })), raw: buckets }
  }

  // Fallback: date_histogram
  const { data } = await axios.get('/api/aggregate', { params: { ...base, field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48 }, timeout: 15000 })
  const buckets = data?.buckets || []
  return { type: 'chart', chartType: panelType || 'line', data: buckets.map(b => ({ x: b.key_as_string || b.key, y: b.doc_count || 0 })), raw: buckets }
}

function getPlotlyType(ct) {
  if (!ct || ct === 'bar' || ct === 'bar-vertical' || ct === 'bar-horizontal') return 'bar'
  if (ct === 'pie') return 'pie'
  if (ct === 'heatmap') return 'heatmap'
  return 'scatter'
}

function getPlotlyMode(ct) {
  if (ct === 'pie' || ct === 'bar' || ct === 'bar-vertical' || ct === 'bar-horizontal' || ct === 'heatmap') return undefined
  return 'lines+markers'
}

export default function DashboardPanel({ panel }) {
  const { updatePanel, removePanel, addPanel, addFilter, timeRange, refreshCounter, globalFilters } = useDashboard()
  const [locked, setLocked] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(panel.title || '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [tablePage, setTablePage] = useState(0)
  const fetchRef = useRef(0)
  const timerRef = useRef(null)
  const panelRef = useRef(null)
  const autoSizedRef = useRef(false)

  // Reset auto-size when panel type/id changes
  useEffect(() => {
    autoSizedRef.current = false
  }, [panel.id, panel.type, panel.vizType])

  const calcOptimalSize = useCallback((resultData) => {
    const pType = panel.type || panel.vizType || ''
    const ROW_H = 20
    let idealH = panel.h || 8

    if (resultData?.type === 'table' && Array.isArray(resultData.data)) {
      const rowCount = resultData.data.length
      if (rowCount <= 3) idealH = 5
      else if (rowCount <= 5) idealH = 7
      else if (rowCount <= 10) idealH = 10
      else if (rowCount <= 15) idealH = 13
      else idealH = 16
    } else if (['metric', 'gauge'].includes(pType)) {
      idealH = 5
    } else if (['bar', 'pie', 'area', 'line'].includes(pType)) {
      const dataLen = resultData?.data?.length || 0
      if (dataLen <= 3) idealH = 8
      else if (dataLen <= 5) idealH = 10
      else if (dataLen <= 10) idealH = 13
      else idealH = 16
    }

    if (idealH !== panel.h && !autoSizedRef.current) {
      autoSizedRef.current = true
      updatePanel({ ...panel, h: idealH })
    }
  }, [panel, updatePanel])

  const loadData = useCallback(() => {
    const id = ++fetchRef.current
    setLoading(true)
    setError(null)
    fetchPanelData(panel, globalFilters).then(r => {
      if (id === fetchRef.current) { setResult(r); setLoading(false); setTablePage(0); calcOptimalSize(r) }
    }).catch(e => {
      if (id === fetchRef.current) { setError(e.message || 'Failed to fetch'); setLoading(false) }
    })
  }, [panel, globalFilters, calcOptimalSize])

  useEffect(() => {
    loadData()
    const interval = panel.refreshInterval || REFRESH_INTERVAL
    if (interval > 0) timerRef.current = setInterval(loadData, interval)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loadData, panel, timeRange?.from, timeRange?.to, refreshCounter])

  useEffect(() => {
    const h = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setActionMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    const handler = (e) => { if (e.detail?.panelId === panel.id) setShowSettings(true) }
    window.addEventListener('open-settings-modal', handler)
    return () => window.removeEventListener('open-settings-modal', handler)
  }, [panel.id])

  const saveTitle = () => { updatePanel({ ...panel, title: title || 'Untitled' }); setEditingTitle(false) }

  const handleChartClick = useCallback((data) => {
    if (!data?.points?.length) return
    const point = data.points[0]
    if (!point) return
    const q = panel.query || {}
    const agg = q.aggregation || {}
    const ct = panel.type || panel.vizType || ''
    const FIELD_MAP = { bar: 'rule.level', 'bar-vertical': 'rule.level', 'bar-horizontal': 'rule.level', pie: 'rule.category', line: 'rule.level', area: 'rule.level', heatmap: 'rule.mitre.tactic', timeline: '@timestamp' }
    let field = agg.field || FIELD_MAP[ct] || 'rule.level'
    let value = ''
    if (ct === 'pie' || point.data?.type === 'pie') {
      value = point.label || ''
    } else {
      value = point.x || ''
    }
    if (field && value && String(value) !== 'undefined') {
      addFilter({ type: 'pair', key: field, value: String(value), exclude: false })
    }
  }, [panel, addFilter])

  const handleDuplicate = () => {
    const copy = JSON.parse(JSON.stringify(panel))
    copy.id = 'panel_' + Date.now()
    copy.title = (panel.title || 'Panel') + ' (Copy)'
    copy.x = (panel.x || 0) + 2
    copy.y = (panel.y || 0) + 2
    addPanel(copy)
  }

  const handleContextAction = (action, p) => {
    if (action === 'drilldown') {
      window.dispatchEvent(new CustomEvent('drilldown', { detail: { panel: p } }))
    } else if (action === 'inspect') {
      window.dispatchEvent(new CustomEvent('inspect-panel', { detail: { panel: p } }))
    } else if (action === 'duplicate') {
      handleDuplicate()
    } else if (action === 'export') {
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (panel.title || 'panel').replace(/\s+/g, '_') + '.json'
      a.click()
      URL.revokeObjectURL(url)
    } else if (action === 'settings') {
      setShowSettings(true)
    } else if (action === 'remove') {
      removePanel(p.id)
    }
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const panelType = panel.type || panel.vizType || ''
  const displayType = ['bar-vertical', 'bar-horizontal'].includes(panelType) ? 'bar' : panelType

  const renderMetric = (val) => (
    <div className="text-center px-2">
      <div className="text-3xl font-bold text-zinc-800 dark:text-zinc-100">{typeof val === 'number' ? val.toLocaleString() : val}</div>
      <div className="text-[10px] text-zinc-400 mt-1">{panel.title || ''}</div>
    </div>
  )

  const renderGauge = (val) => {
    const max = panel.vizConfig?.gaugeMax || panel.vizConfig?.max || 100
    const pct = Math.min((val / max) * 100, 100)
    const color = pct > 66 ? '#ef4444' : pct > 33 ? '#f59e0b' : '#10b981'
    return (
      <div className="text-center px-2 w-full">
        <div className="relative w-20 h-20 mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="8" strokeDasharray={pct * 2.64 + ' 264'} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold" style={{ color }}>{Math.round(pct)}%</span>
          </div>
        </div>
        <div className="text-[10px] text-zinc-400 mt-1">{panel.title || ''}</div>
      </div>
    )
  }

  const renderTable = (data) => {
    if (!data.length) return <div className="flex items-center justify-center h-full text-zinc-400 text-[10px]">No results</div>
    const keys = Object.keys(data[0])
    const preferred = panel.vizConfig?.tableColumns || ['@timestamp', 'timestamp', 'rule.description', 'rule.id', 'rule.level', 'agent.name', 'location', 'full_log']
    const cols = preferred.filter(c => keys.includes(c))
    const displayCols = cols.length ? cols : keys.slice(0, 5)
    const perPage = panel.query?.limit || 10
    const totalPages = Math.ceil(data.length / perPage)
    const page = Math.min(tablePage, totalPages - 1)
    const pageData = data.slice(page * perPage, (page + 1) * perPage)
    return (
      <div className="flex flex-col w-full h-full">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[10px] font-mono">
            <thead><tr className="bg-zinc-50 dark:bg-zinc-800/40 sticky top-0 z-10">
              {displayCols.map(c => <th key={c} className="text-left px-2 py-1 text-zinc-500 border-b font-semibold whitespace-nowrap text-[9px] uppercase tracking-wider">{c.replace(/\./g, ' ')}</th>)}
            </tr></thead>
            <tbody>
              {pageData.map((row, i) => (
                <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors" onClick={() => window.dispatchEvent(new CustomEvent('drilldown', { detail: { row } }))}>
                  {displayCols.map(c => (
                    <td key={c} className="group relative px-2 py-1 border-b border-zinc-100 dark:border-zinc-700/30 text-zinc-600 dark:text-zinc-400 text-[10px] cursor-pointer hover:text-[#EF843C]" title={String(row[c] ?? '')}>
                      <span className="truncate max-w-[100px] inline-block">{String(row[c] ?? '').substring(0, 50)}</span>
                      <span className="hidden group-hover:inline-flex items-center gap-0.5 ml-1 align-middle">
                        <button onClick={e => { e.stopPropagation(); addFilter({ type: 'pair', key: c, value: String(row[c] ?? ''), exclude: false }) }} className="p-0.5 rounded text-[#EF843C] hover:bg-[#EF843C]/10" title="Filter for value">
                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 7h3.5a.5.5 0 1 1 0 1H8v3.5a.5.5 0 1 1-1 0V8H3.5a.5.5 0 0 1 0-1H7V3.5a.5.5 0 0 1 1 0V7Zm-.5-7C11.636 0 15 3.364 15 7.5S11.636 15 7.5 15 0 11.636 0 7.5 3.364 0 7.5 0Zm0 .882a6.618 6.618 0 1 0 0 13.236A6.618 6.618 0 0 0 7.5.882Z"/></svg>
                        </button>
                        <button onClick={e => { e.stopPropagation(); addFilter({ type: 'pair', key: c, value: String(row[c] ?? ''), exclude: true }) }} className="p-0.5 rounded text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" title="Filter out value">
                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M7.5 0C11.636 0 15 3.364 15 7.5S11.636 15 7.5 15 0 11.636 0 7.5 3.364 0 7.5 0Zm0 .882a6.618 6.618 0 1 0 0 13.236A6.618 6.618 0 0 0 7.5.882ZM3.5 7h8a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1Z"/></svg>
                        </button>
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2 py-1 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
            <div className="flex items-center gap-1">
              <button onClick={() => setTablePage(0)} disabled={page === 0} className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 disabled:opacity-30"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg></button>
              <button onClick={() => setTablePage(Math.max(0, page - 1))} disabled={page === 0} className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 disabled:opacity-30"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>
              <span className="text-[9px] text-zinc-500 mx-1">{page + 1}/{totalPages}</span>
              <button onClick={() => setTablePage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 disabled:opacity-30"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></button>
              <button onClick={() => setTablePage(totalPages - 1)} disabled={page >= totalPages - 1} className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 disabled:opacity-30"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg></button>
            </div>
            <span className="text-[8px] text-zinc-400">{result?.raw || data.length} total</span>
          </div>
        )}
      </div>
    )
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 border-2 border-zinc-200 dark:border-zinc-700 rounded-full" />
            <div className="absolute inset-0 border-2 border-transparent border-t-[#EF843C] rounded-full animate-spin" />
          </div>
        </div>
      )
    }
    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center px-4">
            <svg className="w-6 h-6 mx-auto mb-1 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-[9px] text-red-400">{error}</p>
            <button onClick={loadData} className="mt-2 text-[9px] text-[#EF843C] hover:underline">Retry</button>
          </div>
        </div>
      )
    }
    if (!result) return <div className="flex items-center justify-center h-full text-zinc-400 text-[10px]">No data</div>

    if (result.type === 'metric') return renderMetric(result.data)
    if (result.type === 'gauge') return renderGauge(result.data)

    if (result.type === 'alert-counter' && typeof result.data === 'object') {
      return (
        <div className="grid grid-cols-2 gap-1.5 p-2 w-full">
          {Object.entries(result.data).map(([k, v]) => (
            <div key={k} className="text-center bg-zinc-50 dark:bg-zinc-800/40 rounded-lg py-2">
              <div className={'text-lg font-bold ' + (k === 'critical' ? 'text-red-500' : k === 'high' ? 'text-orange-500' : k === 'medium' ? 'text-yellow-500' : 'text-green-500')}>{v}</div>
              <div className="text-[8px] text-zinc-400 uppercase tracking-wider">{k}</div>
            </div>
          ))}
        </div>
      )
    }

    if (result.type === 'table' && Array.isArray(result.data)) return renderTable(result.data)

    // Cluster Bubble
    if (result.type === 'clusterbubble' || displayType === 'clusterbubble') {
      return <ClusterBubbleChart data={result.data} width={400} height={300} />
    }

    if (result.type === 'chart' && Array.isArray(result.data) && result.data.length) {
      const d = result.data
      const ct = result.chartType || panelType || 'line'
      const plotlyType = getPlotlyType(ct)
      const plotlyMode = getPlotlyMode(ct)
      const config = { responsive: true, displayModeBar: false }
      const layout = { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { t: 5, r: 5, b: 20, l: 25 }, font: { size: 8, color: '#6b7280' }, showlegend: false }

      if (plotlyType === 'pie') {
        return <Plot data={[{ labels: d.map(x => x.x), values: d.map(x => x.y), type: 'pie', hole: 0.4, marker: { colors: ['#EF843C', '#8b5cf6', '#10b981', '#06b6d4', '#ef4444', '#f59e0b', '#ec4899'] }, textinfo: 'label+percent', textfont: { size: 8 }, hovertemplate: '%{label}<br>%{value} (%{percent})<extra></extra>' }]} layout={{ ...layout, margin: { t: 5, r: 5, b: 5, l: 5 } }} config={config} style={{ width: '100%', height: '100%' }} useResizeHandler onClick={handleChartClick} />
      }
      if (plotlyType === 'bar') {
        return <Plot data={[{ x: d.map(x => x.x), y: d.map(x => x.y), type: 'bar', marker: { color: '#EF843C', opacity: 0.85 }, hovertemplate: '%{x}<br>%{y}<extra></extra>' }]} layout={{ ...layout, xaxis: { gridcolor: '#f3f4f6', zeroline: false, tickangle: -30 }, yaxis: { gridcolor: '#f3f4f6', zeroline: false } }} config={config} style={{ width: '100%', height: '100%' }} useResizeHandler onClick={handleChartClick} />
      }
      if (plotlyType === 'heatmap') {
        return <Plot data={[{ z: [d.map(x => x.y)], x: d.map(x => x.x), y: [''], type: 'heatmap', colorscale: [['0', '#fef2f2'], ['0.5', '#fca5a5'], ['1', '#dc2626']], hoverongaps: false, hovertemplate: '%{x}<br>%{z}<extra></extra>' }]} layout={{ ...layout, margin: { t: 5, r: 5, b: 50, l: 5 }, xaxis: { tickangle: -30, tickfont: { size: 7 } } }} config={config} style={{ width: '100%', height: '100%' }} useResizeHandler />
      }
      return <Plot data={[{ x: d.map(x => x.x), y: d.map(x => x.y), type: 'scatter', mode: plotlyMode, line: { color: '#EF843C', width: 1.5, shape: ct === 'area' ? 'spline' : 'linear', smoothing: 1.3 }, marker: { size: 2, color: '#EF843C' }, fill: ct === 'area' ? 'tozeroy' : undefined, fillcolor: '#EF843C15' }]} layout={layout} config={config} style={{ width: '100%', height: '100%' }} useResizeHandler onClick={handleChartClick} />
    }

    return <div className="flex items-center justify-center h-full text-zinc-400 text-[10px]">No data</div>
  }

  return (
    <div ref={panelRef} onContextMenu={handleContextMenu} className="h-full flex flex-col bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 group shadow-sm hover:shadow-md transition-shadow">
      <div className={'flex items-center gap-2 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700 shrink-0 min-h-[32px] ' + (locked ? 'opacity-75' : '')}>
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[displayType] || '#EF843C' }} />
        {editingTitle ? (
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} onBlur={saveTitle} onKeyDown={e => e.key === 'Enter' && saveTitle()}
            autoFocus className="flex-1 px-1 py-0 text-[11px] font-semibold bg-transparent outline-none border-b border-[#EF843C] text-zinc-800 dark:text-zinc-100" />
        ) : (
          <span onClick={() => !locked && setEditingTitle(true)} className="flex-1 text-[11px] font-semibold text-zinc-800 dark:text-zinc-100 truncate cursor-pointer hover:text-[#EF843C] transition-colors">{panel.title || 'Untitled'}</span>
        )}
        <div className="flex items-center gap-0.5">
          {loading && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Loading..." />}
          {error && <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="Error" />}
          {!loading && !error && result && <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Live" />}

          {/* Action menu (cogs) */}
          <div className="relative">
            <button onClick={() => setActionMenuOpen(!actionMenuOpen)}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-[#EF843C] transition-colors"
              title="Widget Actions">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            </button>
            {actionMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-white dark:bg-[#252832] rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-lg py-1 text-[10px]">
                {[
                  { label: 'Settings', icon: 'M12 8V6m0 12v-2m0-4v-2m-7 4h2m10 0h2m-12-4h2m10 0h2', action: () => setShowSettings(true) },
                  { label: locked ? 'Unlock' : 'Lock', icon: locked ? 'M9 12l2 2 4-4' : 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', action: () => setLocked(!locked) },
                  { label: 'Duplicate', icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2', action: handleDuplicate },
                  { label: 'Refresh', icon: 'M23 4v6h-6M1 20v-6h6', action: loadData },
                  { label: 'Remove', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7', action: () => removePanel(panel.id), danger: true },
                ].map(item => (
                  <button key={item.label} onClick={() => { item.action(); setActionMenuOpen(false) }}
                    className={'w-full flex items-center gap-2 px-3 py-1.5 transition-colors ' + (item.danger ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/40')}>
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={item.icon}/></svg>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden p-1">
        {renderContent()}
      </div>

      <div className="flex items-center justify-between px-3 py-0.5 border-t border-zinc-100 dark:border-zinc-700/50 text-[8px] text-zinc-400 shrink-0">
        <span>{displayType || 'empty'}{panel.vizId ? ' · linked' : ''}</span>
        {error && <span className="text-red-400">Error · <button onClick={loadData} className="hover:underline">Retry</button></span>}
        {!error && result?.data && Array.isArray(result.data) && <span>{result.data.length} pts</span>}
        {!error && result?.type === 'metric' && <span>{typeof result.data === 'number' ? result.data.toLocaleString() : ''}</span>}
        {!error && result?.type === 'table' && <span>{result.raw || ''} total</span>}
      </div>

      {/* Right-click Context Menu — portal to body to avoid transform breakage */}
      {contextMenu && createPortal(
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          panel={panel}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />,
        document.body
      )}

      {/* Panel Settings Modal — portal to body to avoid transform breakage */}
      {showSettings && createPortal(
        <PanelSettingsModal
          panel={panel}
          onSave={(updated) => { updatePanel(updated); setShowSettings(false) }}
          onClose={() => setShowSettings(false)}
        />,
        document.body
      )}
    </div>
  )
}