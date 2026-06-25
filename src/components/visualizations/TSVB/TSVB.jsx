import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'

export default function TSVB({ data = [], config = {} }) {
  const processed = useMemo(() => {
    let pts = data.map(d => ({
      t: new Date(d.timestamp || d.time || d.x || d.key),
      v: d.count || d.value || d.y || d.doc_count || 0,
    })).sort((a, b) => a.t - b.t)

    if (config.timeShift) {
      pts = pts.map(p => ({ ...p, t: new Date(p.t.getTime() + config.timeShift * 3600000) }))
    }

    if (config.downsampling && pts.length > 200) {
      const step = Math.ceil(pts.length / 200)
      pts = pts.filter((_, i) => i % step === 0)
    }

    const maxPoints = config.maxPoints || 500
    if (pts.length > maxPoints) {
      const step = Math.ceil(pts.length / maxPoints)
      pts = pts.filter((_, i) => i % step === 0)
    }

    return pts
  }, [data, config])

  if (!processed.length) {
    return <div className="flex items-center justify-center h-48 text-zinc-400 text-xs">No data</div>
  }

  const traces = [
    {
      x: processed.map(p => p.t),
      y: processed.map(p => p.v),
      type: 'scatter',
      mode: 'lines',
      line: { color: '#EF843C', width: 2, shape: 'spline', smoothing: 0.8 },
      fill: 'tozeroy',
      fillcolor: '#EF843C20',
      hovertemplate: '%{x}<br>%{y}<extra></extra>',
    },
  ]

  if (config.showMovingAvg) {
    const vals = processed.map(p => p.v)
    const window = config.movingAvgWindow || 7
    const avg = vals.map((_, i) => {
      const start = Math.max(0, i - window + 1)
      const slice = vals.slice(start, i + 1)
      return slice.reduce((a, b) => a + b, 0) / slice.length
    })
    traces.push({
      x: processed.map(p => p.t),
      y: avg,
      type: 'scatter',
      mode: 'lines',
      line: { color: '#8b5cf6', width: 1.5, dash: 'dash' },
      name: 'Moving Avg',
      hovertemplate: '%{x}<br>%{y:.1f}<extra>Moving Avg</extra>',
    })
  }

  return (
    <Plot
      data={traces}
      layout={{
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { t: 20, r: 20, b: 40, l: 50 },
        font: { family: 'Inter, sans-serif', size: 10, color: '#6b7280' },
        xaxis: { gridcolor: '#f3f4f6', zeroline: false, type: 'date', rangeslider: { visible: true, thickness: 0.06 } },
        yaxis: { gridcolor: '#f3f4f6', zeroline: false },
        hovermode: 'x unified',
        legend: { orientation: 'h', y: -0.2 },
        ...config.layout,
      }}
      config={{ responsive: true, displayModeBar: false, scrollZoom: true }}
      style={{ width: '100%', height: config.height || 300 }}
      useResizeHandler
    />
  )
}
