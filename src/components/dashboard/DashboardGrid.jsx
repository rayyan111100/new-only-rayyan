import React, { useCallback, useRef, useState, useEffect } from 'react'
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { useDashboard } from './dashboardStore'
import DashboardPanel from './DashboardPanel'

const WS_URL = 'ws://localhost:3099/ws'

function getPanelHeight(panel) {
  const type = panel.type || panel.vizType || ''
  if (['metric', 'gauge'].includes(type)) return 6
  if (['table', 'clusterbubble', 'heatmap'].includes(type)) return 12
  return 10
}

function getPanelWidth(p) {
  const type = p.type || p.vizType || ''
  if (['metric', 'gauge'].includes(type)) return 3
  if (['table', 'clusterbubble', 'heatmap'].includes(type)) return 8
  return 6
}

export default function DashboardGrid() {
  const { panels, gridLayout, setLayout, updatePanel, activeDashboard, globalFilters } = useDashboard()
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const w = containerRef.current.getBoundingClientRect().width
        if (w > 0) setContainerWidth(w)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    const observer = new ResizeObserver(measure)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => { window.removeEventListener('resize', measure); observer.disconnect() }
  }, [])

  // WebSocket real-time connection
  useEffect(() => {
    let reconnectTimer = null
    const connect = () => {
      try {
        const ws = new WebSocket(WS_URL)
        wsRef.current = ws
        ws.onopen = () => { setConnected(true); console.log('🔌 WS connected') }
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.type === 'initial' || msg.type === 'alert') {
              const alerts = msg.alerts || msg.data || []
              if (alerts.length) {
                window.dispatchEvent(new CustomEvent('realtime-alerts', { detail: alerts }))
              }
            }
          } catch {}
        }
        ws.onclose = () => {
          setConnected(false)
          reconnectTimer = setTimeout(connect, 5000)
        }
        ws.onerror = () => { ws.close() }
      } catch { reconnectTimer = setTimeout(connect, 5000) }
    }
    connect()
    return () => { if (wsRef.current) wsRef.current.close(); if (reconnectTimer) clearTimeout(reconnectTimer) }
  }, [])

  const onResizeStop = useCallback((layout, oldItem, newItem) => {
    const panel = panels.find(p => p.id === newItem.i)
    if (panel && (panel.w !== newItem.w || panel.h !== newItem.h)) {
      updatePanel({ ...panel, w: newItem.w, h: newItem.h })
    }
  }, [panels, updatePanel])

  const onDragStop = useCallback((layout, oldItem, newItem) => {
    const panel = panels.find(p => p.id === newItem.i)
    if (panel && (panel.x !== newItem.x || panel.y !== newItem.y)) {
      updatePanel({ ...panel, x: newItem.x, y: newItem.y })
    }
  }, [panels, updatePanel])

  const onLayoutChange = useCallback((layout) => {
    setLayout(layout)
  }, [setLayout])

  if (!activeDashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 dark:text-zinc-500">
        <div className="text-center">
          <svg className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">No Dashboard Selected</p>
          <p className="text-[10px] mt-1">Create or select a dashboard from the toolbar</p>
        </div>
      </div>
    )
  }

  if (!panels.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 dark:text-zinc-500">
        <div className="text-center">
          <svg className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Empty Dashboard</p>
          <p className="text-[10px] mt-1">Click "Add Panel" to start building</p>
        </div>
      </div>
    )
  }


  const layout = panels.map(p => {
    const existing = gridLayout.find(l => l.i === p.id)
    return {
      i: p.id,
      x: existing?.x ?? p.x ?? 0,
      y: existing?.y ?? p.y ?? 0,
      w: existing?.w ?? p.w ?? getPanelWidth(p),
      h: existing?.h ?? p.h ?? getPanelHeight(p),
      minW: 1, minH: 1,
    }
  })

  return (
    <div ref={containerRef} className="min-h-0 w-full">
      <style>{`
.react-grid-item {
  transition: none !important;
}
.react-grid-item > .react-resizable-handle {
  z-index: 100;
  width: 28px;
  height: 28px;
  opacity: 1;
  pointer-events: auto;
}
.react-grid-item > .react-resizable-handle::after {
  content: '';
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 14px;
  height: 14px;
  border-right: 3px solid rgba(239,132,60,0.6);
  border-bottom: 3px solid rgba(239,132,60,0.6);
}
.dark .react-grid-item > .react-resizable-handle::after {
  border-color: rgba(239,132,60,0.7);
}
.react-grid-item > .react-resizable-handle:hover {
  opacity: 1;
}
.react-grid-placeholder {
  background: #EF843C !important;
  opacity: 0.2 !important;
  border-radius: 12px !important;
}
`}</style>
      {connected && (
        <div className="flex items-center gap-1 px-2 py-0.5 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[8px] text-green-500 font-medium">Live</span>
        </div>
      )}
      <GridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={20}
        width={containerWidth}
        onLayoutChange={onLayoutChange}
        onResizeStop={onResizeStop}
        onDragStop={onDragStop}
        isDraggable={true}
        isResizable={true}
        compactType="vertical"
        resizeHandles={['se']}
        margin={[10, 10]}
        containerPadding={[10, 10]}
        useCSSTransforms={true}
      >
        {panels.map(panel => (
          <div key={panel.id} className="relative">
            <DashboardPanel panel={panel} />
            {(globalFilters?.length > 0) && (
              <div className="absolute top-1 right-8 flex gap-0.5 z-20">
                <div className="px-1 py-0.5 text-[7px] font-mono bg-[#EF843C]/10 text-[#EF843C] rounded">{globalFilters.length}f</div>
              </div>
            )}
          </div>
        ))}
      </GridLayout>
    </div>
  )
}