import React, { useRef, useEffect } from 'react'
import * as d3 from 'd3'

export default function GoalChart({ value = 0, target = 100, config = {} }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = config.width || 360
    const height = config.height || 120
    const margin = { t: 10, r: 20, b: 20, l: 20 }
    const innerW = width - margin.l - margin.r
    const barH = 24

    const pct = Math.min((value / target) * 100, 100)
    const ranges = config.ranges || [
      { from: 0, to: 50, color: '#10b981' },
      { from: 50, to: 80, color: '#f59e0b' },
      { from: 80, to: 100, color: '#ef4444' },
    ]

    const g = svg.append('g').attr('transform', `translate(${margin.l},${margin.t})`)

    const xScale = d3.scaleLinear().domain([0, 100]).range([0, innerW])

    ranges.forEach(r => {
      const w = xScale(r.to) - xScale(r.from)
      g.append('rect')
        .attr('x', xScale(r.from))
        .attr('y', 0)
        .attr('width', w)
        .attr('height', barH)
        .attr('fill', r.color)
        .attr('rx', 4)
        .attr('ry', 4)
        .attr('opacity', 0.3)
    })

    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', xScale(pct))
      .attr('height', barH)
      .attr('fill', ranges.find(r => pct >= r.from && pct <= r.to)?.color || '#EF843C')
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('opacity', 0.9)

    g.append('rect')
      .attr('x', xScale(100 * value / target) - 2)
      .attr('y', -4)
      .attr('width', 4)
      .attr('height', barH + 8)
      .attr('fill', '#374151')
      .attr('rx', 2)
      .attr('ry', 2)

    g.append('line')
      .attr('x1', xScale(pct))
      .attr('y1', 0)
      .attr('x2', xScale(pct))
      .attr('y2', barH)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)

    g.append('text')
      .attr('x', xScale(pct) + 8)
      .attr('y', barH / 2 + 4)
      .attr('fill', '#374151')
      .attr('font-size', 12)
      .attr('font-weight', 'bold')
      .text(config.showPercentage !== false ? `${Math.round(pct)}%` : `${value}/${target}`)

    if (config.showPercentage !== false) {
      g.append('text')
        .attr('x', innerW)
        .attr('y', barH + 16)
        .attr('text-anchor', 'end')
        .attr('fill', '#9ca3af')
        .attr('font-size', 10)
        .text(`Target: ${target}`)
    }
  }, [value, target, config])

  return (
    <svg ref={svgRef} width={config.width || 360} height={config.height || 120} />
  )
}
