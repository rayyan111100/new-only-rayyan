import React from 'react'
import Plot from 'react-plotly.js'

const PALETTES = {
  wazuh: ['#EF843C', '#8b5cf6', '#10b981', '#06b6d4', '#ef4444', '#f59e0b', '#ec4899'],
  cool: ['#1f77b4', '#2ca02c', '#d62728', '#9467bd', '#8c564b'],
  warm: ['#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#006d77'],
}

export default function VerticalBarChart({ data, config = {} }) {
  const barWidth = config.barWidth || 0.6
  const palette = PALETTES[config.palette] || PALETTES.wazuh
  const colors = config.colorPalette || palette

  const traces = Array.isArray(data)
    ? data.map((d, i) => ({
        x: d.x || [],
        y: d.y || [],
        type: 'bar',
        name: d.name || `Series ${i + 1}`,
        marker: { color: colors[i % colors.length] },
        width: barWidth,
        text: config.showLabels ? d.y : undefined,
        textposition: 'auto',
        hovertemplate: '%{x}<br>%{y}<extra></extra>',
      }))
    : [
        {
          x: data.x || [],
          y: data.y || [],
          type: 'bar',
          marker: {
            color: Array.isArray(data.x)
              ? data.x.map((_, i) => colors[i % colors.length])
              : colors[0],
          },
          width: barWidth,
          text: config.showLabels ? data.y : undefined,
          textposition: 'auto',
        },
      ]

  return (
    <Plot
      data={traces}
      layout={{
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { t: 20, r: 20, b: 60, l: 50 },
        font: { family: 'Inter, sans-serif', size: 10, color: '#6b7280' },
        xaxis: { gridcolor: '#f3f4f6', zeroline: false, tickangle: -30 },
        yaxis: { gridcolor: '#f3f4f6', zeroline: false },
        barmode: config.stacked ? 'stack' : 'group',
        hovermode: 'x unified',
        legend: { orientation: 'h', y: -0.3 },
        ...config.layout,
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%', height: config.height || 300 }}
      useResizeHandler
    />
  )
}
