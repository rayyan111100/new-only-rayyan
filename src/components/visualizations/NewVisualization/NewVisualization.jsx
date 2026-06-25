import React, { useState } from 'react'

const VIZ_TYPES = [
  { id: 'area', label: 'Area Chart', desc: 'Stacked or filled time series', icon: '📈', category: 'Time Series' },
  { id: 'bar-vertical', label: 'Vertical Bar', desc: 'Column chart with value labels', icon: '📊', category: 'Categorical' },
  { id: 'bar-horizontal', label: 'Horizontal Bar', desc: 'Sorted bar chart', icon: '📊', category: 'Categorical' },
  { id: 'line', label: 'Line Chart', desc: 'Trend lines with markers', icon: '📉', category: 'Time Series' },
  { id: 'pie', label: 'Pie / Donut', desc: 'Proportional segments', icon: '🥧', category: 'Categorical' },
  { id: 'heatmap', label: 'Heat Map', desc: 'MITRE ATT&CK matrix style', icon: '🗺️', category: 'Matrix' },
  { id: 'gauge', label: 'Gauge', desc: 'Single value with ranges', icon: '🎯', category: 'Single Value' },
  { id: 'goal', label: 'Goal / Progress', desc: 'Progress toward target', icon: '🏁', category: 'Single Value' },
  { id: 'metric', label: 'Metric', desc: 'Big number display', icon: '🔢', category: 'Single Value' },
  { id: 'table', label: 'Data Table', desc: 'Sortable, paginated table', icon: '📋', category: 'Tabular' },
  { id: 'map-coordinate', label: 'Coordinate Map', desc: 'Geo points on map', icon: '🌍', category: 'Map' },
  { id: 'map-region', label: 'Region Map', desc: 'Choropleth heat map', icon: '🗺️', category: 'Map' },
  { id: 'maps', label: 'Maps (Multi-layer)', desc: 'Points, heat, clusters', icon: '🗺️', category: 'Map' },
  { id: 'gantt', label: 'Gantt Chart', desc: 'Timeline bars', icon: '📅', category: 'Time Series' },
  { id: 'timeline', label: 'Timeline', desc: 'Event timeline with zones', icon: '⏱️', category: 'Time Series' },
  { id: 'tsvb', label: 'TSVB', desc: 'Time series with metrics', icon: '📈', category: 'Time Series' },
  { id: 'tagcloud', label: 'Tag Cloud', desc: 'Weighted word cloud', icon: '☁️', category: 'Text' },
  { id: 'markdown', label: 'Markdown', desc: 'Rich text display', icon: '📝', category: 'Text' },
  { id: 'vega', label: 'Vega Chart', desc: 'Custom Vega/Vega-Lite spec', icon: '🎨', category: 'Advanced' },
]

const CATEGORIES = [...new Set(VIZ_TYPES.map(v => v.category))]

export default function NewVisualization({ onSelectType }) {
  const [category, setCategory] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = VIZ_TYPES.filter(v => {
    if (category && v.category !== category) return false
    if (search && !v.label.toLowerCase().includes(search.toLowerCase()) && !v.desc.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        <button onClick={() => setCategory(null)}
          className={`px-2 py-1 text-[9px] font-semibold rounded-md transition-colors ${!category ? 'bg-[#EF843C] text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
          All
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(category === cat ? null : cat)}
            className={`px-2 py-1 text-[9px] font-semibold rounded-md transition-colors ${category === cat ? 'bg-[#EF843C] text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
            {cat}
          </button>
        ))}
      </div>

      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search visualizations..." className="ginput w-full px-3 py-1.5 text-[10px]" />

      <div className="grid grid-cols-2 gap-1.5 max-h-80 overflow-y-auto">
        {filtered.map(v => (
          <button key={v.id} onClick={() => onSelectType?.(v.id)}
            className="flex items-start gap-2 px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 hover:border-[#EF843C]/40 hover:bg-[#EF843C]/5 transition-all text-left">
            <span className="text-lg">{v.icon}</span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-200 truncate">{v.label}</div>
              <div className="text-[8px] text-zinc-400 dark:text-zinc-500 line-clamp-2">{v.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {!filtered.length && (
        <div className="text-center py-6 text-xs text-zinc-400">No visualizations match "{search}"</div>
      )}
    </div>
  )
}
