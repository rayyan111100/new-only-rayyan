import React, { useRef, useEffect } from 'react'
import * as d3 from 'd3'

export default function TagCloud({ data = [], config = {} }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current || !data.length) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = config.width || 450
    const height = config.height || 250
    const maxWords = config.maxWords || 50
    const maxFontSize = config.maxFontSize || 36
    const minFontSize = config.minFontSize || 10

    const items = data
      .slice(0, maxWords)
      .map(d => ({ text: d.label || d.name || d.key || '', size: d.value || d.count || d.doc_count || 1 }))

    if (!items.length) {
      svg.append('text').attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle').attr('fill', '#9ca3af').attr('font-size', 12)
        .text('No data')
      return
    }

    const maxVal = d3.max(items, d => d.size) || 1
    const fontSizeScale = d3.scaleLinear()
      .domain([0, maxVal])
      .range([minFontSize, maxFontSize])

    const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`)

    const colorScale = d3.scaleSequential(d3.interpolateOranges).domain([0, maxVal])

    const simulation = d3.forceSimulation(
      items.map(d => ({ ...d, x: 0, y: 0 }))
    )
      .force('charge', d3.forceManyBody().strength(2))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide(d => fontSizeScale(d.size) * 0.5 + 2))
      .stop()

    for (let i = 0; i < 50; i++) simulation.tick()

    const texts = g.selectAll('text')
      .data(items)
      .enter()
      .append('text')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', d => fontSizeScale(d.size))
      .attr('fill', d => colorScale(d.size))
      .attr('font-family', 'Inter, sans-serif')
      .attr('font-weight', d => d.size > maxVal * 0.5 ? '700' : '500')
      .attr('opacity', 0)
      .text(d => d.text)
      .append('title')
      .text(d => `${d.text}: ${d.size}`)

    texts.transition()
      .duration(600)
      .attr('opacity', d => 0.5 + (d.size / maxVal) * 0.5)
  }, [data, config])

  return (
    <div className="overflow-hidden flex items-center justify-center">
      <svg ref={svgRef} width={config.width || 450} height={config.height || 250} />
    </div>
  )
}
