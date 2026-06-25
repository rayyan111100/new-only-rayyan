import React from 'react'
import Plot from 'react-plotly.js'

const VARIANTS = {
  wazuh: { colors: ['#EF843C', '#8b5cf6', '#10b981', '#06b6d4', '#ef4444'] },
  ocean: { colors: ['#006d77', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'] },
  forest: { colors: ['#2d6a4f', '#40916c', '#52b788', '#95d5b2', '#d8f3dc'] },
}

export default function AreaChart({ data, config = {} }) {
  const fill = config.fill || 'tozeroy'
  const variant = config.variant || 'wazuh'
  const palette = VARIANTS[variant]?.colors || VARIANTS.wazuh.colors

  const traces = Array.isArray(data)
    ? data.map((d, i) => ({
        x: d.x || [],
        y: d.y || [],
        type: 'scatter',
        mode: 'lines',
        name: d.name || `Series ${i + 1}`,
        fill: fill,
        line: { color: config.lineColor || palette[i % palette.length], width: config.lineWidth || 2 },
        fillcolor: config.fillColor
          ? config.fillColor
          : palette[i % palette.length] + '40',
        stackgroup: config.stacked ? 'one' : undefined,
      }))
    : [
        {
          x: data.x || [],
          y: data.y || [],
          type: 'scatter',
          mode: 'lines',
          fill: fill,
          line: { color: config.lineColor || palette[0], width: config.lineWidth || 2 },
          fillcolor: config.fillColor || palette[0] + '40',
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
      config={{ responsive: true, displayModeBar: false, ...config.plotlyConfig }}
      style={{ width: '100%', height: config.height || 300 }}
      useResizeHandler
    />
  )
}
