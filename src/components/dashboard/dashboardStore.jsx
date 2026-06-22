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
          w: p.w || 10, h: p.h || 7, minW: 1, minH: 1,
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
      const npH = np.h || (['metric', 'gauge'].includes(npType) ? 10 : (['table', 'clusterbubble', 'heatmap'].includes(npType) ? 17 : 13))
      const npW = np.w || (['metric', 'gauge'].includes(npType) ? 10 : 8)
      // Auto-position: find next available y slot
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
        gridLayout: [...state.gridLayout, { i: newPanel.id, x: 0, y: npY, w: npW, h: npH, minW: 1, minH: 1 }],
        activeDashboard: state.activeDashboard ? { ...state.activeDashboard, panels: [...(state.activeDashboard.panels || []), newPanel] } : state.activeDashboard,
      }

    case 'UPDATE_PANEL':
      const up = action.payload
      const upType = up.type || up.vizType || ''
      const upH = up.h || (['metric', 'gauge'].includes(upType) ? 10 : (['table', 'clusterbubble', 'heatmap'].includes(upType) ? 17 : 13))
      const upW = up.w || 8
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
      const posMap = {}
      newLayout.forEach(l => { posMap[l.i] = { x: l.x, y: l.y, w: l.w, h: l.h } })
      const positionedPanels = state.panels.map(p => {
        const pos = posMap[p.id]
        return pos ? { ...p, ...pos } : p
      })
      return {
        ...state,
        gridLayout: newLayout,
        panels: positionedPanels,
        activeDashboard: state.activeDashboard ? { ...state.activeDashboard, panels: positionedPanels } : state.activeDashboard,
      }

    case 'SET_TIME_RANGE':
      return { ...state, timeRange: action.payload }

    case 'ADD_FILTER':
      return { ...state, globalFilters: [...state.globalFilters, action.payload] }

    case 'REMOVE_FILTER':
      return { ...state, globalFilters: state.globalFilters.filter((_, i) => i !== action.payload) }

    case 'SET_FILTERS':
      return { ...state, globalFilters: action.payload }

    case 'TOGGLE_FULLSCREEN':
      return { ...state, fullScreen: !state.fullScreen }

    case 'SET_EDITING':
      return { ...state, editingPanel: action.payload }

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
  const addFilter = useCallback(f => dispatch({ type: 'ADD_FILTER', payload: f }), [])
  const removeFilter = useCallback(i => dispatch({ type: 'REMOVE_FILTER', payload: i }), [])
  const setFilters = useCallback(f => dispatch({ type: 'SET_FILTERS', payload: f }), [])
  const toggleFullScreen = useCallback(() => dispatch({ type: 'TOGGLE_FULLSCREEN' }), [])
  const setEditingPanel = useCallback(p => dispatch({ type: 'SET_EDITING', payload: p }), [])
  const toggleApplyFilters = useCallback(() => dispatch({ type: 'TOGGLE_APPLY_FILTERS' }), [])
  const toggleApplyTime = useCallback(() => dispatch({ type: 'TOGGLE_APPLY_TIME' }), [])
  const triggerRefresh = useCallback(() => dispatch({ type: 'TRIGGER_REFRESH' }), [])
  const toggleReportWindow = useCallback(() => dispatch({ type: 'TOGGLE_REPORT_WINDOW' }), [])

  const value = {
    ...state,
    setDashboards, setActiveDashboard, addDashboard, updateDashboard, deleteDashboard,
    addPanel, updatePanel, removePanel, setLayout,
    setTimeRange, addFilter, removeFilter, setFilters,
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
