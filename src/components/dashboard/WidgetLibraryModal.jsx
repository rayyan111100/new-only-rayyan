import React, { useState } from 'react'

const WIDGET_TYPES = [
  { id: 'metric', label: 'Metric Card', icon: 'M', desc: 'Single number KPI display', color: '#10b981' },
  { id: 'bar', label: 'Bar Chart', icon: 'B', desc: 'Category comparison', color: '#EF843C' },
  { id: 'line', label: 'Line Chart', icon: 'L', desc: 'Trend over time', color: '#06b6d4' },
  { id: 'area', label: 'Area Chart', icon: 'A', desc: 'Filled time series', color: '#EF843C' },
  { id: 'severity-pie', label: 'Pie Chart', icon: 'P', desc: 'Donut pie with severity distribution', color: '#e8681a' },
  { id: 'timeline-area', label: 'Timeline Area', icon: 'TA', desc: 'Area chart with gradient fill', color: '#06b6d4' },
  { id: 'gauge', label: 'Gauge', icon: 'G', desc: 'Single value with ranges', color: '#ec4899' },
  { id: 'heatmap', label: 'Heatmap', icon: 'H', desc: 'MITRE-style matrix', color: '#f59e0b' },
  { id: 'timeline', label: 'Timeline', icon: 'TL', desc: 'Event chronology', color: '#14b8a6' },
  { id: 'markdown', label: 'Markdown', icon: 'MD', desc: 'Rich text display', color: '#6b7280' },
  { id: 'tagcloud', label: 'Tag Cloud', icon: 'TC', desc: 'Weighted word cloud', color: '#a855f7' },
  { id: 'top-n', label: 'Top N List', icon: 'TN', desc: 'Top values with counts', color: '#f97316' },
  { id: 'alert-counter', label: 'Alert Counter', icon: 'AC', desc: 'Alert count by severity', color: '#ef4444' },
  { id: 'clusterbubble', label: 'Cluster Bubble', icon: 'CB', desc: 'Bubble chart grouped by field', color: '#14b8a6' },
  { id: 'log-stream', label: 'Log Stream', icon: 'LS', desc: 'Live log event stream', color: '#0ea5e9' },
  { id: 'event-logs', label: 'Event Logs', icon: 'EL', desc: 'Detailed event table with expandable rows', color: '#6366f1' },
  { id: 'framework-dist', label: 'Framework Dist', icon: 'FD', desc: 'Compliance framework event distribution', color: '#e8681a' },
  { id: 'top-agents', label: 'Top Agents', icon: 'TA', desc: 'Top agents with event counts and rankings', color: '#e8681a' },
  { id: 'kpi', label: 'KPI Cards', icon: 'KP', desc: 'Multi-metric KPI display', color: '#d97706' },
  { id: 'agent-status', label: 'Agent Status', icon: 'AS', desc: 'Agent online/offline status', color: '#10b981' },
  { id: 'data-table', label: 'Data Table', icon: 'DT', desc: 'Raw event data as table with column picker & inline filters', color: '#6366f1' },
]

const DEFAULT_SOURCE = { id: 'alerts', label: 'Security Alerts', filter: '', accent: '#EF843C', aggField: 'rule.level' }

function autoQuery(typeId, src) {
  const sf = src?.filter || ''
  const q = sf ? sf : '*'
  const aggField = src?.aggField || 'rule.level'
  if (typeId === 'severity-pie') return { language: 'lucene', query: q, aggregation: { field: 'rule.level', type: 'terms', limit: 10 } }
  if (typeId === 'timeline-area') return { language: 'lucene', query: q, aggregation: { field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48 } }
  if (typeId === 'event-logs') return { language: 'lucene', query: q, sort: { field: '@timestamp', order: 'desc' }, limit: 50 }
  if (typeId === 'framework-dist') return { language: 'lucene', query: q, aggregation: { type: 'count' } }
  if (typeId === 'top-agents') return { language: 'lucene', query: q, aggregation: { field: 'agent.name', type: 'terms', limit: 10 } }
  if (['metric', 'gauge', 'kpi', 'alert-counter'].includes(typeId)) return { language: 'lucene', query: q, aggregation: { type: 'count' } }
  if (['table', 'log-stream', 'data-table'].includes(typeId)) return { language: 'lucene', query: q, sort: { field: '@timestamp', order: 'desc' }, limit: 50 }
  const aggType = ['line', 'area', 'timeline'].includes(typeId) ? 'date_histogram' : 'terms'
  const fieldMap = { bar: aggField, pie: aggField, heatmap: aggField, clusterbubble: 'agent.name', tagcloud: 'rule.description' }
  const f = fieldMap[typeId] || aggField
  return { language: 'lucene', query: q, aggregation: { field: f, type: aggType, limit: 10, interval: aggType === 'date_histogram' ? '1h' : undefined } }
}

function autoWidth(typeId) {
  if (typeId === 'severity-pie') return 3
  if (typeId === 'timeline-area') return 5
  if (typeId === 'event-logs') return 8
  if (typeId === 'framework-dist' || typeId === 'top-agents') return 3
  if (['metric', 'gauge', 'kpi', 'alert-counter'].includes(typeId)) return 2
  if (['table', 'log-stream', 'data-table'].includes(typeId)) return 8
  return 5
}

function autoHeight(typeId) {
  if (typeId === 'severity-pie' || typeId === 'timeline-area' || typeId === 'framework-dist' || typeId === 'top-agents') return 3
  if (typeId === 'event-logs') return 4
  if (['metric', 'gauge', 'kpi', 'alert-counter'].includes(typeId)) return 1
  if (['table', 'log-stream', 'data-table'].includes(typeId)) return 5
  return 3
}

export default function WidgetLibraryModal({ open, onClose, onAddWidget }) {
  const [search, setSearch] = useState('')

  if (!open) return null

  const filteredWidgets = WIDGET_TYPES.filter(w => !search || w.label.toLowerCase().includes(search.toLowerCase()) || w.desc.toLowerCase().includes(search.toLowerCase()))

  const handleSelectType = (w) => {
    const panel = {
      id: 'panel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: w.label,
      type: w.id,
      dataSource: 'alerts',
      query: autoQuery(w.id, DEFAULT_SOURCE),
      vizConfig: { accent: '#EF843C', dataSource: 'alerts' },
      x: 0, y: 0, w: autoWidth(w.id), h: autoHeight(w.id),
      minW: 1, minH: 1, locked: false,
    }
    onAddWidget(panel)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl w-full max-w-2xl mx-3 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-700">
          <div>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Add Widget</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">Click a widget to add it to your dashboard</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>

        <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search widget types..."
              className="w-full pl-9 pr-3 py-2 text-[11px] bg-zinc-50 dark:bg-zinc-800/60 rounded-xl outline-none border border-zinc-200 dark:border-zinc-700" autoFocus />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredWidgets.map(w => (
              <button key={w.id} onClick={() => handleSelectType(w)}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 hover:border-[#EF843C]/40 hover:bg-[#EF843C]/5 transition-all group">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{backgroundColor: w.color}}>{w.icon}</span>
                <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-200">{w.label}</span>
                <span className="text-[8px] text-zinc-400 text-center leading-tight">{w.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
