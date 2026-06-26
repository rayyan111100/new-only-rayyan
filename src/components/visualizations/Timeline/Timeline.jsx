import React from 'react'
import Plot from 'react-plotly.js'

export default function Timeline({ data = [], config = {} }) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-48 text-zinc-400 text-xs">No data</div>
  }

  const timestamps = data.map(d => d.timestamp || d.time || d.x || d.key)
  const values = data.map(d => d.count || d.value || d.y || d.doc_count || 0)
  const events = data.map(d => d.event || d.name || d.label || '')

  const shapes = (config.zones || []).map(z => ({
    type: 'rect',
    x0: z.start,
    x1: z.end,
    y0: 0,
    y1: 1,
    yref: 'paper',
    fillcolor: z.color || '#ef444415',
    line: { width: 0 },
    layer: 'below',
  }))

  return (
    <Plot
      data={[
        {
          x: timestamps,
          y: values,
          type: 'scatter',
          mode: config.showMarkers !== false ? 'lines+markers' : 'lines',
          line: { color: '#EF843C', width: 2, shape: 'spline', smoothing: 1 },
          marker: {
            color: '#EF843C',
            size: config.showMarkers !== false ? 6 : 0,
            symbol: 'circle',
          },
          text: events,
          hovertemplate: '%{x}<br>%{y}<br>%{text}<extra></extra>',
          fill: 'tozeroy',
          fillcolor: '#EF843C15',
        },
      ]}
      layout={{
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { t: 20, r: 20, b: 50, l: 50 },
        font: { family: 'Inter, sans-serif', size: 10, color: '#6b7280' },
        xaxis: {
          gridcolor: '#f3f4f6',
          zeroline: false,
          type: 'date',
          rangeslider: { visible: true, thickness: 0.08 },
        },
        yaxis: { gridcolor: '#f3f4f6', zeroline: false },
        shapes,
        hovermode: 'x unified',
        ...config.layout,
      }}
      config={{ responsive: true, displayModeBar: false, scrollZoom: true }}
      style={{ width: '100%', height: config.height || 300 }}
      useResizeHandler
    />
  )
}
