import React, { useRef, useEffect } from 'react'
import * as d3 from 'd3'

export default function HeatMap({ data = [], config = {} }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { t: 40, r: 10, b: 80, l: 100 }
    const width = config.width || 500
    const height = config.height || 350
    const innerW = width - margin.l - margin.r
    const innerH = height - margin.t - margin.b

    const tactics = data.map(d => d.tactic)
    const allTechniques = [...new Set(data.flatMap(d => d.techniques.map(t => t.technique)))]
    if (!allTechniques.length) {
      svg.append('text').attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle').attr('fill', '#9ca3af').attr('font-size', 12)
        .text('No data')
      return
    }

    const x = d3.scaleBand().domain(allTechniques).range([0, innerW]).padding(0.05)
    const y = d3.scaleBand().domain(tactics).range([0, innerH]).padding(0.05)

    const flat = data.flatMap(d =>
      d.techniques.map(t => ({ tactic: d.tactic, technique: t.technique, count: t.count || 0 }))
    )
    const maxCount = d3.max(flat, d => d.count) || 1
    const colorScale = d3.scaleSequential(d3.interpolateOranges).domain([0, maxCount])
    if (config.colorScale) {
      const interpolator = d3.piecewise(d3.interpolateRgb, config.colorScale)
      colorScale.domain([0, maxCount]).interpolator(interpolator)
    }

    const g = svg.append('g').attr('transform', `translate(${margin.l},${margin.t})`)

    g.selectAll('rect')
      .data(flat)
      .enter()
      .append('rect')
      .attr('x', d => x(d.technique))
      .attr('y', d => y(d.tactic))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('fill', d => colorScale(d.count))
      .attr('rx', 3)
      .attr('ry', 3)
      .append('title')
      .text(d => `${d.tactic} > ${d.technique}: ${d.count}`)

    g.append('g')
      .call(d3.axisLeft(y).tickSize(0))
      .selectAll('text')
      .attr('font-size', 10)
      .attr('fill', '#6b7280')

    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickSize(0))

    xAxis.selectAll('text')
      .attr('font-size', 9)
      .attr('fill', '#6b7280')
      .attr('transform', 'rotate(-35)')
      .attr('text-anchor', 'end')

    xAxis.selectAll('line,path').attr('stroke', '#e5e7eb')
  }, [data, config])

  return (
    <div className="overflow-auto">
      <svg ref={svgRef} width={config.width || 500} height={config.height || 350} />
    </div>
  )
}
