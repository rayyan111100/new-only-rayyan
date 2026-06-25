import React from 'react'
import Plot from 'react-plotly.js'

const COLORS = ['#EF843C', '#8b5cf6', '#10b981', '#06b6d4', '#ef4444', '#f59e0b', '#ec4899']

export default function LineChart({ data, config = {} }) {
  const traces = Array.isArray(data)
    ? data.map((d, i) => ({
        x: d.x || [],
        y: d.y || [],
        type: 'scatter',
        mode: config.showMarkers ? 'lines+markers' : 'lines',
        name: d.name || `Series ${i + 1}`,
        line: {
          color: d.color || COLORS[i % COLORS.length],
          width: config.lineWidth || 2,
          shape: config.smoothing ? 'spline' : 'linear',
          smoothing: config.smoothing ? 1.3 : 0,
        },
        marker: {
          size: config.showMarkers ? 6 : 0,
          color: d.color || COLORS[i % COLORS.length],
        },
        hovertemplate: '%{x}<br>%{y:.2f}<extra></extra>',
      }))
    : [
        {
          x: data.x || [],
          y: data.y || [],
          type: 'scatter',
          mode: config.showMarkers ? 'lines+markers' : 'lines',
          line: {
            color: COLORS[0],
            width: config.lineWidth || 2,
            shape: config.smoothing ? 'spline' : 'linear',
            smoothing: config.smoothing ? 1.3 : 0,
          },
          marker: { size: config.showMarkers ? 6 : 0 },
        },
      ]

  return (
    <Plot
      data={traces}
      layout={{
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { t: 20, r: 20, b: 40, l: 50 },
        font: { family: 'Inter, sans-serif', size: 10, color: '#6b7280' },
        xaxis: { gridcolor: '#f3f4f6', zeroline: false },
        yaxis: { gridcolor: '#f3f4f6', zeroline: false },
        hovermode: 'x unified',
        legend: { orientation: 'h', y: -0.2 },
        ...config.layout,
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%', height: config.height || 300 }}
      useResizeHandler
    />
  )
}
