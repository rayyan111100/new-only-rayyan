import React from 'react'
import Plot from 'react-plotly.js'

export default function PreviewPanel({ config = {} }) {
  const { yAxis = { metric: 'count', field: '' }, xAxis = {}, data, chartType, showLabels = true, maxItems = 20 } = config

  const sliced = data?.length > maxItems ? data.slice(0, maxItems) : data

  if (!sliced || !sliced.length) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
            <p className="text-xs font-medium">No data</p>
            <p className="text-[10px] mt-0.5">Configure axes and execute search</p>
          </div>
        </div>
      </div>
    )
  }

  const x = sliced.map(d => d.x || d.key || d.timestamp || '')
  const y = sliced.map(d => d.y || d.count || d.doc_count || d.value || 0)
  const label = yAxis.label || `${yAxis.metric}${yAxis.field ? ' of ' + yAxis.field : ''}`

  const common = { x, y, hovertemplate: '%{x}<br>%{y}<extra></extra>' }

  const getPlotlyData = () => {
    switch (chartType) {
      case 'bar':
        return [{
          ...common,
          type: 'bar',
          marker: { color: '#EF843C', opacity: 0.85 },
          text: showLabels ? y : undefined,
          textposition: 'auto',
          textfont: { size: 9 },
          name: label,
        }]
      case 'area':
        return [{
          ...common,
          type: 'scatter',
          mode: 'lines',
          fill: 'tozeroy',
          line: { color: '#EF843C', width: 2 },
          fillcolor: '#EF843C30',
          name: label,
        }]
      case 'line':
        return [{
          ...common,
          type: 'scatter',
          mode: showLabels ? 'lines+markers' : 'lines',
          line: { color: '#EF843C', width: 2, shape: 'spline', smoothing: 1.3 },
          marker: { size: showLabels ? 5 : 0, color: '#EF843C' },
          name: label,
        }]
      case 'pie':
        return [{
          labels: x, values: y, type: 'pie', hole: 0.4,
          marker: { colors: ['#EF843C', '#8b5cf6', '#10b981', '#06b6d4', '#ef4444', '#f59e0b', '#ec4899'] },
          textinfo: showLabels ? 'label+percent' : 'none',
          textfont: { size: 9 },
          hovertemplate: '%{label}<br>%{value} (%{percent})<extra></extra>',
        }]
      default:
        return [{ ...common, type: 'scatter', mode: showLabels ? 'lines+markers' : 'lines', line: { color: '#EF843C', width: 2 }, marker: { size: showLabels ? 4 : 0 }, name: label }]
    }
  }

  const titleText = [yAxis.label || `${yAxis.metric}${yAxis.field ? ' of ' + yAxis.field : ''}`, xAxis.field && `over ${xAxis.field}`].filter(Boolean).join(' ') || 'Visualization'

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">Preview</span>
        <div className="flex items-center gap-2 text-[9px] text-zinc-400">
          {data && data.length > maxItems && <span className="text-amber-500">{maxItems} of {data.length}</span>}
          <span className="font-mono">{chartType || 'auto'}</span>
          <span>{sliced.length} items</span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Plot
          data={getPlotlyData()}
          layout={{
            title: { text: titleText, font: { size: 12, color: '#374151', family: 'Inter, sans-serif' } },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { t: 35, r: 200, b: 45, l: 50 },
            font: { family: 'Inter, sans-serif', size: 10, color: '#6b7280' },
            xaxis: { title: xAxis.field || '', gridcolor: '#f3f4f6', zeroline: false, type: xAxis.bucket === 'date_histogram' ? 'date' : '-' },
            yaxis: { title: yAxis.label || yAxis.metric, gridcolor: '#f3f4f6', zeroline: false },
            hovermode: 'x unified',
            showlegend: true,
            legend: { orientation: 'v', x: 1.02, y: 1, xanchor: 'left', yanchor: 'top', font: { size: 9 } },
          }}
          config={{ responsive: true, displayModeBar: false, scrollZoom: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  )
}
