import React, { useState, useCallback } from 'react'

const CHART_TYPES = [
  { id: 'area', label: 'Area', icon: '📈' },
  { id: 'bar', label: 'Bar', icon: '📊' },
  { id: 'line', label: 'Line', icon: '📉' },
  { id: 'pie', label: 'Pie', icon: '🥧' },
  { id: 'metric', label: 'Metric', icon: '🔢' },
  { id: 'table', label: 'Table', icon: '📋' },
  { id: 'heatmap', label: 'Heat Map', icon: '🗺️' },
  { id: 'gauge', label: 'Gauge', icon: '🎯' },
  { id: 'goal', label: 'Goal', icon: '🏁' },
]

export default function VisBuilder({ data = [], onConfigChange }) {
  const [chartType, setChartType] = useState('bar')
  const [xField, setXField] = useState('')
  const [yField, setYField] = useState('')
  const [aggType, setAggType] = useState('count')
  const [label, setLabel] = useState('')
  const [draggedField, setDraggedField] = useState(null)

  const fields = data?.length
    ? Object.keys(data[0]).map(k => ({ name: k, type: typeof data[0][k] }))
    : [{ name: 'timestamp', type: 'string' }, { name: 'count', type: 'number' }]

  const handleDrop = useCallback((target) => {
    if (!draggedField) return
    if (target === 'x') setXField(draggedField)
    if (target === 'y') setYField(draggedField)
    setDraggedField(null)
  }, [draggedField])

  const handleConfigChange = useCallback(() => {
    if (!onConfigChange) return
    onConfigChange({
      type: chartType,
      x: xField,
      y: yField,
      aggregation: aggType,
      label,
    })
  }, [chartType, xField, yField, aggType, label, onConfigChange])

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 block">Chart Type</label>
        <div className="grid grid-cols-3 gap-1.5">
          {CHART_TYPES.map(ct => (
            <button
              key={ct.id}
              onClick={() => setChartType(ct.id)}
              className={`px-2 py-2 text-[10px] font-medium rounded-lg border transition-all ${
                chartType === ct.id
                  ? 'bg-[#EF843C] text-white border-[#EF843C]'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
              }`}
            >
              <div className="text-base">{ct.icon}</div>
              <div>{ct.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 block">Fields</label>
        <div className="flex flex-wrap gap-1">
          {fields.map(f => (
            <div
              key={f.name}
              draggable
              onDragStart={() => setDraggedField(f.name)}
              className={`px-2 py-1 text-[10px] font-mono rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${
                draggedField === f.name
                  ? 'bg-[#EF843C]/10 border-[#EF843C] text-[#EF843C]'
                  : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
              }`}
            >
              {f.name}
              <span className="text-[8px] ml-1 text-zinc-400">({f.type})</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={() => handleDrop('x')}
          className={`px-3 py-2 rounded-lg border-2 border-dashed text-center transition-colors ${
            xField ? 'bg-[#EF843C]/5 border-[#EF843C]' : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700'
          }`}
        >
          <div className="text-[9px] font-medium text-zinc-400 mb-1">X-Axis (drop field)</div>
          {xField && <code className="text-[11px] font-mono font-semibold text-[#EF843C]">{xField}</code>}
        </div>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={() => handleDrop('y')}
          className={`px-3 py-2 rounded-lg border-2 border-dashed text-center transition-colors ${
            yField ? 'bg-[#8b5cf6]/5 border-[#8b5cf6]' : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700'
          }`}
        >
          <div className="text-[9px] font-medium text-zinc-400 mb-1">Y-Axis (drop field)</div>
          {yField && <code className="text-[11px] font-mono font-semibold text-[#8b5cf6]">{yField}</code>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">Aggregation</label>
          <select value={aggType} onChange={e => setAggType(e.target.value)}
            className="ginput w-full px-2 py-1.5 text-[10px]">
            {['count', 'sum', 'avg', 'min', 'max', 'unique'].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">Label</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)}
            placeholder="Chart label" className="ginput w-full px-2 py-1.5 text-[10px]" />
        </div>
      </div>

      <button onClick={handleConfigChange}
        className="w-full py-2 text-[11px] font-semibold rounded-lg bg-gradient-to-r from-[#EF843C] to-[#e0752a] text-white hover:from-[#e0752a] hover:to-[#d0661a] transition-all active:scale-[0.98]">
        Apply Configuration
      </button>
    </div>
  )
}
