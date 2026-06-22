import React from 'react'
import Plot from 'react-plotly.js'

const TASK_COLORS = ['#EF843C', '#8b5cf6', '#10b981', '#06b6d4', '#ef4444', '#f59e0b', '#ec4899', '#14b8a6']

export default function GanttChart({ data = [], config = {} }) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-48 text-zinc-400 text-xs">No data</div>
  }

  const colors = config.taskColors || TASK_COLORS

  const plotData = data.map((d, i) => {
    const start = new Date(d.start || d.start_date || d.startTime)
    const end = new Date(d.end || d.end_date || d.endTime || start.getTime() + (d.duration || 3600000))
    return {
      x: [start, end],
      y: [d.task || d.name || `Task ${i + 1}`],
      type: 'scatter',
      mode: 'lines',
      name: d.task || d.name || `Task ${i + 1}`,
      line: { width: 18, color: colors[i % colors.length] },
      showlegend: false,
      hoverinfo: 'x+name',
      hovertemplate: '%{x}<br>%{y}<extra></extra>',
    }
  })

  if (config.showMilestones) {
    data.filter(d => d.milestone || d.type === 'milestone').forEach((d, i) => {
      const date = new Date(d.start || d.start_date || d.date)
      plotData.push({
        x: [date],
        y: [d.task || d.name || `Milestone ${i + 1}`],
        type: 'scatter',
        mode: 'markers',
        marker: { symbol: 'diamond', size: 12, color: '#f59e0b' },
        name: 'Milestone',
        showlegend: true,
      })
    })
  }

  return (
    <Plot
      data={plotData}
      layout={{
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { t: 20, r: 20, b: 50, l: Math.max(120, Math.max(...data.map(d => (d.task || d.name || '').length)) * 7) },
        font: { family: 'Inter, sans-serif', size: 10, color: '#6b7280' },
        xaxis: { gridcolor: '#f3f4f6', zeroline: false, type: 'date' },
        yaxis: { gridcolor: '#f3f4f6', zeroline: false, autorange: 'reversed' },
        hovermode: 'closest',
        ...config.layout,
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%', height: config.height || Math.max(200, data.length * 30) }}
      useResizeHandler
    />
  )
}
