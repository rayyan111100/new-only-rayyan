import React from 'react'
import Plot from 'react-plotly.js'

export default function HorizontalBarChart({ data, config = {} }) {
  let plotData = Array.isArray(data) ? data : [data]
  const sorted = config.sort
    ? plotData.map(d => {
        const pairs = (d.x || []).map((label, i) => ({ label, value: (d.y || [])[i] || 0 }))
        const order = config.sort === 'asc' ? 1 : -1
        pairs.sort((a, b) => (a.value - b.value) * order)
        return { ...d, x: pairs.map(p => p.label), y: pairs.map(p => p.value) }
      })
    : plotData

  const traces = sorted.map((d, i) => ({
    y: d.x || [],
    x: d.y || [],
    type: 'bar',
    orientation: 'h',
    name: d.name || '',
    marker: { color: d.colors || config.colorPalette?.[i] || '#EF843C' },
    text: config.showValues ? d.y : undefined,
    textposition: 'outside',
    hovertemplate: '%{y}<br>%{x}<extra></extra>',
  }))

  return (
    <Plot
      data={traces}
      layout={{
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { t: 10, r: config.showValues ? 60 : 30, b: 20, l: 120 },
        font: { family: 'Inter, sans-serif', size: 10, color: '#6b7280' },
        xaxis: { gridcolor: '#f3f4f6', zeroline: false },
        yaxis: { gridcolor: '#f3f4f6', zeroline: false, automargin: true },
        hovermode: 'y unified',
        ...config.layout,
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%', height: config.height || Math.max(200, (data.x?.length || 5) * 35) }}
      useResizeHandler
    />
  )
}
