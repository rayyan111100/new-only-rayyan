import React from 'react'
import Plot from 'react-plotly.js'

const COLORS = ['#EF843C', '#8b5cf6', '#10b981', '#06b6d4', '#ef4444', '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#6366f1']

export default function PieChart({ data, config = {} }) {
  if (!data || !data.length) {
    return <div className="flex items-center justify-center h-48 text-zinc-400 text-xs">No data</div>
  }

  const labels = data.map(d => d.label || d.name || '')
  const values = data.map(d => d.value || d.count || 0)
  const total = values.reduce((a, b) => a + b, 0)

  return (
    <div className="relative">
      <Plot
        data={[
          {
            labels,
            values,
            type: 'pie',
            hole: config.donut ? 0.55 : 0,
            textinfo: config.showLabels ? 'label+percent' : 'none',
            textposition: 'outside',
            textfont: { size: 10, family: 'Inter, sans-serif' },
            marker: {
              colors: config.colors || COLORS,
              line: { color: '#ffffff', width: 2 },
            },
            hovertemplate: '%{label}<br>%{value} (%{percent})<extra></extra>',
            sort: false,
          },
        ]}
        layout={{
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          margin: { t: 10, r: 10, b: 10, l: 10 },
          font: { family: 'Inter, sans-serif', size: 10, color: '#6b7280' },
          showlegend: config.showLegend !== false,
          legend: { orientation: 'h', y: -0.1, font: { size: 9 } },
          annotations: config.donut
            ? [
                {
                  text: `<b>${total}</b>`,
                  x: 0.5,
                  y: 0.5,
                  showarrow: false,
                  font: { size: 18, color: '#374151' },
                },
              ]
            : [],
          ...config.layout,
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%', height: config.height || 280 }}
        useResizeHandler
      />
    </div>
  )
}
