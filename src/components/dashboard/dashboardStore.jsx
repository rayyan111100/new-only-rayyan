import React, { createContext, useContext, useReducer, useCallback } from 'react'

const DashboardContext = createContext()

const initialState = {
  dashboards: [],
  activeDashboard: null,
  panels: [],
  editingPanel: null,
  gridLayout: [],
  timeRange: { from: 'now-24h', to: 'now' },
  globalFilters: [],
  filterMatch: 'and',
  applyFiltersToAll: true,
  applyTimeToAll: true,
  fullScreen: false,
  darkMode: false,
  refreshCounter: 0,
  showReportWindow: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_DASHBOARDS':
      return { ...state, dashboards: action.payload }
    case 'SET_ACTIVE':
      return {
        ...state,
        activeDashboard: action.payload,
        panels: action.payload?.panels || [],
        timeRange: action.payload?.timeRange || state.timeRange,
        gridLayout: (action.payload?.panels || []).map(p => ({
          i: p.id, x: p.x || 0, y: p.y || 0,
          w: p.w || 10, h: p.h || 1, minW: 0.5, minH: 0.5,
        })),
      }
    case 'ADD_DASHBOARD':
      return { ...state, dashboards: [...state.dashboards, action.payload] }
    case 'UPDATE_DASHBOARD':
      return {
        ...state,
        dashboards: state.dashboards.map(d => d.id === action.payload.id ? { ...d, ...action.payload, updatedAt: new Date().toISOString() } : d),
        activeDashboard: state.activeDashboard?.id === action.payload.id ? { ...state.activeDashboard, ...action.payload } : state.activeDashboard,
      }
    case 'DELETE_DASHBOARD':
      return {
        ...state,
        dashboards: state.dashboards.filter(d => d.id !== action.payload),
        activeDashboard: state.activeDashboard?.id === action.payload ? null : state.activeDashboard,
        panels: state.activeDashboard?.id === action.payload ? [] : state.panels,
        gridLayout: state.activeDashboard?.id === action.payload ? [] : state.gridLayout,
      }
    case 'ADD_PANEL':
      const np = action.payload
      const npType = np.type || np.vizType || ''
      const isMetricType = ['metric', 'gauge', 'kpi'].includes(npType)
      const isTableType = ['table', 'clusterbubble', 'heatmap', 'log-stream'].includes(npType)
      const isAlertCounter = npType === 'alert-counter'
      const npH = np.h || 1
      const npW = np.w || (isMetricType ? 2 : isTableType ? 8 : isAlertCounter ? 4 : 6)
      const npY = state.panels.reduce((maxY, p) => {
        const existing = state.gridLayout.find(l => l.i === p.id)
        const pH = existing?.h ?? p.h ?? 10
        const pY = existing?.y ?? p.y ?? 0
        return Math.max(maxY, pY + pH + 1)
      }, 0)
      const newPanel = { ...np, h: npH, w: npW, x: 0, y: npY }
      return {
        ...state,
        panels: [...state.panels, newPanel],
        gridLayout: [...state.gridLayout, { i: newPanel.id, x: 0, y: npY, w: npW, h: npH, minW: 0.5, minH: 0.5 }],
        activeDashboard: state.activeDashboard ? { ...state.activeDashboard, panels: [...(state.activeDashboard.panels || []), newPanel] } : state.activeDashboard,
      }
    case 'UPDATE_PANEL':
      const up = action.payload
      const upType = up.type || up.vizType || ''
      const upIsMetric = ['metric', 'gauge', 'kpi'].includes(upType)
      const upIsTable = ['table', 'clusterbubble', 'heatmap', 'log-stream'].includes(upType)
      const upIsAlertCounter = upType === 'alert-counter'
      const upH = up.h || 1
      const upW = up.w || (upIsMetric ? 2 : upIsTable ? 8 : upIsAlertCounter ? 4 : 6)
      const updatedPanels = state.panels.map(p => p.id === up.id ? { ...p, ...up, h: upH, w: upW } : p)
      return {
        ...state,
        panels: updatedPanels,
        gridLayout: state.gridLayout.map(l => l.i === up.id ? { ...l, w: upW, h: upH } : l),
        activeDashboard: state.activeDashboard ? { ...state.activeDashboard, panels: updatedPanels } : state.activeDashboard,
      }
    case 'REMOVE_PANEL':
      return {
        ...state,
        panels: state.panels.filter(p => p.id !== action.payload),
        gridLayout: state.gridLayout.filter(l => l.i !== action.payload),
        activeDashboard: state.activeDashboard ? { ...state.activeDashboard, panels: state.activeDashboard.panels.filter(p => p.id !== action.payload) } : state.activeDashboard,
      }
    case 'SET_LAYOUT':
      const newLayout = action.payload
      if (!Array.isArray(newLayout) || newLayout.length === 0) return state
      const posMap = {}
      newLayout.forEach(l => { if (l && l.i) posMap[l.i] = { x: l.x, y: l.y } })
      const positionedPanels = state.panels.map(p => {
        const pos = posMap[p.id]
        return pos ? { ...p, x: pos.x, y: pos.y } : p
      })
      return {
        ...state,
        gridLayout: newLayout,
        panels: positionedPanels,
        activeDashboard: state.activeDashboard ? { ...state.activeDashboard, panels: positionedPanels } : state.activeDashboard,
      }
    case 'SET_TIME_RANGE':
      return { ...state, timeRange: action.payload }
    case 'ADD_FILTER': {
      const nf = { ...action.payload, negate: action.payload.negate ?? !!action.payload.exclude, disabled: false, pinned: false, operator: action.payload.operator || 'is', id: action.payload.id || crypto.randomUUID() }
      const SKIP = ['#', 'key', 'doc_count', 'pct', 'count', 'eps', 'ingest', 'lastEvent']
      if (nf.type === 'pair' && nf.key && SKIP.includes(nf.key)) return state
      if (nf.type === 'pair' && nf.key) {
        const filtered = state.globalFilters.filter(f => !(f.type === 'pair' && f.key === nf.key))
        return { ...state, globalFilters: [...filtered, nf] }
      }
      return { ...state, globalFilters: [...state.globalFilters, nf] }
    }
    case 'REMOVE_FILTER':
      return { ...state, globalFilters: state.globalFilters.filter((_, i) => i !== action.payload) }
    case 'UPDATE_FILTER':
      return { ...state, globalFilters: state.globalFilters.map((f, i) => i === action.payload ? { ...f, ...action.patch } : f) }
    case 'SET_FILTERS': {
      const seen = {}; const deduped = []
      for (const f of action.payload) {
        if (f.type === 'pair' && f.key) {
          if (seen[f.key]) { const idx = deduped.findIndex(x => x.type === 'pair' && x.key === f.key); if (idx >= 0) deduped[idx] = f; continue }
          seen[f.key] = true
        }
        deduped.push(f)
      }
      return { ...state, globalFilters: deduped }
    }
    case 'TOGGLE_FULLSCREEN':
      return { ...state, fullScreen: !state.fullScreen }
    case 'SET_EDITING':
      return { ...state, editingPanel: action.payload }
    case 'SET_FILTER_MATCH':
      return { ...state, filterMatch: action.payload }
    case 'CLEAR_FILTERS':
      return { ...state, globalFilters: state.globalFilters.filter(f => f.pinned) }
    case 'TOGGLE_APPLY_FILTERS':
      return { ...state, applyFiltersToAll: !state.applyFiltersToAll }
    case 'TOGGLE_APPLY_TIME':
      return { ...state, applyTimeToAll: !state.applyTimeToAll }
    case 'TRIGGER_REFRESH':
      return { ...state, refreshCounter: state.refreshCounter + 1 }
    case 'TOGGLE_REPORT_WINDOW':
      return { ...state, showReportWindow: !state.showReportWindow }
    default:
      return state
  }
}

export function DashboardProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const setDashboards = useCallback(list => dispatch({ type: 'SET_DASHBOARDS', payload: list }), [])
  const setActiveDashboard = useCallback(d => dispatch({ type: 'SET_ACTIVE', payload: d }), [])
  const addDashboard = useCallback(d => dispatch({ type: 'ADD_DASHBOARD', payload: d }), [])
  const updateDashboard = useCallback(d => dispatch({ type: 'UPDATE_DASHBOARD', payload: d }), [])
  const deleteDashboard = useCallback(id => dispatch({ type: 'DELETE_DASHBOARD', payload: id }), [])
  const addPanel = useCallback(p => dispatch({ type: 'ADD_PANEL', payload: p }), [])
  const updatePanel = useCallback(p => dispatch({ type: 'UPDATE_PANEL', payload: p }), [])
  const removePanel = useCallback(id => dispatch({ type: 'REMOVE_PANEL', payload: id }), [])
  const setLayout = useCallback(l => dispatch({ type: 'SET_LAYOUT', payload: l }), [])
  const setTimeRange = useCallback(r => dispatch({ type: 'SET_TIME_RANGE', payload: r }), [])
  const addFilter = useCallback(f => { dispatch({ type: 'ADD_FILTER', payload: f }); dispatch({ type: 'TRIGGER_REFRESH' }) }, [])
  const removeFilter = useCallback(i => { dispatch({ type: 'REMOVE_FILTER', payload: i }); dispatch({ type: 'TRIGGER_REFRESH' }) }, [])
  const setFilters = useCallback(f => dispatch({ type: 'SET_FILTERS', payload: f }), [])
  const updateFilter = useCallback((i, patch) => { dispatch({ type: 'UPDATE_FILTER', payload: i, patch }); dispatch({ type: 'TRIGGER_REFRESH' }) }, [])
  const toggleFullScreen = useCallback(() => dispatch({ type: 'TOGGLE_FULLSCREEN' }), [])
  const setEditingPanel = useCallback(p => dispatch({ type: 'SET_EDITING', payload: p }), [])
  const setFilterMatch = useCallback(m => dispatch({ type: 'SET_FILTER_MATCH', payload: m }), [])
  const clearFilters = useCallback(() => { dispatch({ type: 'CLEAR_FILTERS' }); dispatch({ type: 'TRIGGER_REFRESH' }) }, [])
  const toggleApplyFilters = useCallback(() => dispatch({ type: 'TOGGLE_APPLY_FILTERS' }), [])
  const toggleApplyTime = useCallback(() => dispatch({ type: 'TOGGLE_APPLY_TIME' }), [])
  const triggerRefresh = useCallback(() => dispatch({ type: 'TRIGGER_REFRESH' }), [])
  const toggleReportWindow = useCallback(() => dispatch({ type: 'TOGGLE_REPORT_WINDOW' }), [])
  const value = {
    ...state,
    setDashboards, setActiveDashboard, addDashboard, updateDashboard, deleteDashboard,
    addPanel, updatePanel, removePanel, setLayout,
    setTimeRange, addFilter, removeFilter, setFilters, updateFilter, setFilterMatch, clearFilters,
    toggleFullScreen, setEditingPanel, toggleApplyFilters, toggleApplyTime,
    triggerRefresh, toggleReportWindow,
  }
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}
