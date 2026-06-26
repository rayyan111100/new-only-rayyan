import React, { useRef, useEffect } from 'react'
import * as d3 from 'd3'

export default function GaugeChart({ value = 0, max = 100, config = {} }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = config.width || 300
    const height = config.height || 200
    const radius = Math.min(width, height * 1.2) / 2
    const arcWidth = config.arcWidth || 30

    const ranges = config.ranges || [
      { from: 0, to: 33, color: '#10b981' },
      { from: 33, to: 66, color: '#f59e0b' },
      { from: 66, to: 100, color: '#ef4444' },
    ]

    const g = svg.append('g').attr('transform', `translate(${width / 2},${height * 0.75})`)

    const scale = d3.scaleLinear().domain([0, max]).range([-Math.PI * 0.75, Math.PI * 0.75])
    const clampVal = Math.min(value, max)

    const background = d3.arc()
      .innerRadius(radius - arcWidth)
      .outerRadius(radius)
      .startAngle(-Math.PI * 0.75)
      .endAngle(Math.PI * 0.75)

    g.append('path').attr('d', background).attr('fill', '#f3f4f6')

    ranges.forEach(r => {
      const startAngle = scale(Math.max(0, r.from))
      const endAngle = scale(Math.min(max, r.to))
      const arc = d3.arc()
        .innerRadius(radius - arcWidth)
        .outerRadius(radius)
        .startAngle(startAngle)
        .endAngle(endAngle)
      g.append('path').attr('d', arc).attr('fill', r.color)
    })

    const valAngle = scale(clampVal)
    const needle = d3.arc()
      .innerRadius(0)
      .outerRadius(radius - arcWidth - 8)
      .startAngle(-0.02)
      .endAngle(0.02)
    g.append('path').attr('d', needle(valAngle)).attr('fill', '#374151')

    g.append('circle').attr('r', 5).attr('fill', '#374151')

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -radius + 30)
      .attr('fill', '#374151')
      .attr('font-size', 28)
      .attr('font-weight', 'bold')
      .text(clampVal)

    if (config.label) {
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -radius + 50)
        .attr('fill', '#9ca3af')
        .attr('font-size', 11)
        .text(config.label)
    }
  }, [value, max, config])

  return (
    <svg ref={svgRef} width={config.width || 300} height={config.height || 200} />
  )
}
