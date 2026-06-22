import React, { useState } from 'react'

const WIDGET_TYPES = [
  { id: 'metric', label: 'Metric Card', icon: 'M', desc: 'Single number KPI display', color: '#10b981' },
  { id: 'bar', label: 'Bar Chart', icon: 'B', desc: 'Category comparison', color: '#8b5cf6' },
  { id: 'line', label: 'Line Chart', icon: 'L', desc: 'Trend over time', color: '#06b6d4' },
  { id: 'area', label: 'Area Chart', icon: 'A', desc: 'Filled time series', color: '#EF843C' },
  { id: 'pie', label: 'Pie Chart', icon: 'P', desc: 'Proportional distribution', color: '#ef4444' },
  { id: 'table', label: 'Data Table', icon: 'T', desc: 'Sortable tabular data', color: '#6366f1' },
  { id: 'gauge', label: 'Gauge', icon: 'G', desc: 'Single value with ranges', color: '#ec4899' },
  { id: 'heatmap', label: 'Heatmap', icon: 'H', desc: 'MITRE-style matrix', color: '#f59e0b' },
  { id: 'timeline', label: 'Timeline', icon: 'TL', desc: 'Event chronology', color: '#14b8a6' },
  { id: 'map', label: 'Geo Map', icon: 'GM', desc: 'Geographic visualization', color: '#84cc16' },
  { id: 'markdown', label: 'Markdown', icon: 'MD', desc: 'Rich text display', color: '#6b7280' },
  { id: 'tagcloud', label: 'Tag Cloud', icon: 'TC', desc: 'Weighted word cloud', color: '#a855f7' },
  { id: 'top-n', label: 'Top N List', icon: 'TN', desc: 'Top values with counts', color: '#f97316' },
  { id: 'alert-counter', label: 'Alert Counter', icon: 'AC', desc: 'Alert count by severity', color: '#ef4444' },
  { id: 'clusterbubble', label: 'Cluster Bubble', icon: 'CB', desc: 'Bubble chart grouped by field', color: '#14b8a6' },
  { id: 'log-stream', label: 'Log Stream', icon: 'LS', desc: 'Live log event stream', color: '#0ea5e9' },
  { id: 'kpi', label: 'KPI Cards', icon: 'KP', desc: 'Multi-metric KPI display', color: '#d97706' },
  { id: 'agent-status', label: 'Agent Status', icon: 'AS', desc: 'Agent online/offline status', color: '#10b981' },
]

const DATA_SOURCES = [
  { id: 'alerts', label: 'Security Alerts' },
  { id: 'agents', label: 'Agent Status' },
  { id: 'mitre', label: 'MITRE ATT&CK' },
  { id: 'auth', label: 'Authentication Logs' },
  { id: 'windows', label: 'Windows Events' },
  { id: 'linux', label: 'Linux Events' },
  { id: 'fim', label: 'FIM Events' },
  { id: 'vulnerability', label: 'Vulnerability' },
  { id: 'firewall', label: 'Firewall Logs' },
  { id: 'aws', label: 'AWS Logs' },
  { id: 'azure', label: 'Azure Logs' },
  { id: 'gcp', label: 'GCP Logs' },
]

export default function WidgetLibraryModal({ open, onClose, onAddWidget }) {
  const [step, setStep] = useState('type')
  const [selectedType, setSelectedType] = useState(null)
  const [selectedSource, setSelectedSource] = useState(null)
  const [search, setSearch] = useState('')

  if (!open) return null

  const filteredWidgets = WIDGET_TYPES.filter(w => !search || w.label.toLowerCase().includes(search.toLowerCase()) || w.desc.toLowerCase().includes(search.toLowerCase()))

  const handleSelectType = (w) => {
    setSelectedType(w)
    setStep('source')
    setSearch('')
  }

  const handleSelectSource = (ds) => {
    setSelectedSource(ds)
    setStep('confirm')
  }

  const handleConfirm = () => {
    const isChart = ['bar', 'line', 'area', 'pie', 'heatmap', 'timeline'].includes(selectedType.id)
    const isMetric = ['metric', 'gauge', 'kpi', 'alert-counter'].includes(selectedType.id)
    const isTable = ['table', 'log-stream'].includes(selectedType.id)
    const isBubble = selectedType.id === 'clusterbubble'
    const fieldMap = { bar: 'rule.level', pie: 'rule.category', heatmap: 'rule.mitre.tactic', line: '@timestamp', area: '@timestamp', timeline: '@timestamp', clusterbubble: 'agent.name' }
    const aggType = isChart ? (['line', 'area', 'timeline'].includes(selectedType.id) ? 'date_histogram' : 'terms') : 'terms'
    const panel = {
      id: 'panel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: selectedType.label,
      type: selectedType.id,
      dataSource: selectedSource?.id || 'alerts',
      query: isMetric
        ? { language: 'lucene', query: '*', aggregation: { type: 'count' } }
        : isTable
        ? { language: 'lucene', query: '*', sort: { field: '@timestamp', order: 'desc' }, limit: 10 }
        : { language: 'lucene', query: '*', aggregation: { field: fieldMap[selectedType.id] || 'rule.level', type: aggType, limit: 10, interval: aggType === 'date_histogram' ? '1h' : undefined } },
      vizConfig: {},
      x: 0, y: 0, w: isMetric ? 6 : isTable ? 16 : 12, h: isMetric ? 5 : 8,
      minW: 1, minH: 1, locked: false,
    }
    onAddWidget(panel)
    setStep('type'); setSelectedType(null); setSelectedSource(null);
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl w-full max-w-2xl mx-3 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-700">
          <div>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{step === 'type' ? 'Add Widget' : step === 'source' ? 'Select Data Source' : 'Confirm Widget'}</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">{step === 'type' ? 'Choose a visualization type' : step === 'source' ? 'Choose a data source' : 'Review and add widget'}</p>
          </div>
          <div className="flex items-center gap-2">
            {step !== 'type' && <button onClick={() => { setStep('type'); setSelectedType(null); setSelectedSource(null) }} className="text-[10px] text-zinc-400 hover:text-zinc-600">Back</button>}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={step === 'type' ? 'Search widget types...' : 'Search data sources...'}
              className="w-full pl-9 pr-3 py-2 text-[11px] bg-zinc-50 dark:bg-zinc-800/60 rounded-xl outline-none border border-zinc-200 dark:border-zinc-700" autoFocus />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'type' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredWidgets.map(w => (
                <button key={w.id} onClick={() => handleSelectType(w)}
                  className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 hover:border-[#8b5cf6]/40 hover:bg-[#8b5cf6]/5 transition-all group">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{backgroundColor: w.color}}>{w.icon}</span>
                  <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-200">{w.label}</span>
                  <span className="text-[8px] text-zinc-400 text-center leading-tight">{w.desc}</span>
                </button>
              ))}
            </div>
          )}

          {step === 'source' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DATA_SOURCES.filter(ds => !search || ds.label.toLowerCase().includes(search.toLowerCase())).map(ds => (
                <button key={ds.id} onClick={() => handleSelectSource(ds)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 hover:border-[#8b5cf6]/40 hover:bg-[#8b5cf6]/5 transition-all text-left">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[8px] font-bold text-white bg-[#8b5cf6]">{ds.label[0]}</span>
                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">{ds.label}</span>
                </button>
              ))}
            </div>
          )}

          {step === 'confirm' && selectedType && selectedSource && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white mx-auto mb-3" style={{backgroundColor: selectedType.color}}>{selectedType.icon}</div>
              <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-1">{selectedType.label}</h4>
              <p className="text-[11px] text-zinc-400 mb-1">Data source: {selectedSource.label}</p>
              <p className="text-[10px] text-zinc-400">{selectedType.desc}</p>
              <div className="flex items-center justify-center gap-1.5 mt-4 text-[9px] text-zinc-400">
                <span className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800">Default time range</span>
                <span className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800">Auto-query</span>
              </div>
              <button onClick={handleConfirm} className="mt-6 px-6 py-2.5 text-[11px] font-semibold rounded-xl bg-gradient-to-r from-[#EF843C] to-[#e0752a] text-white hover:from-[#e0752a] hover:to-[#d0661a] transition-all">
                Add {selectedType.label} to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
