import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const THEMATIC_SCALES = {
  severity: ['#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#1f2937'],
  blues: ['#eff6ff', '#bfdbfe', '#60a5fa', '#3b82f6', '#1d4ed8', '#1e3a8a'],
  reds: ['#fef2f2', '#fecaca', '#f87171', '#ef4444', '#dc2626', '#991b1b'],
  greens: ['#f0fdf4', '#bbf7d0', '#4ade80', '#22c55e', '#16a34a', '#166534'],
  oranges: ['#fff7ed', '#fed7aa', '#fb923c', '#f97316', '#ea580c', '#9a3412'],
}

export default function ThematicRegionMap({ data = [], config = {} }) {
  const mapRef = useRef(null)
  const containerRef = useRef(null)

  const colorScheme = config.colorScheme || 'oranges'
  const scale = THEMATIC_SCALES[colorScheme] || THEMATIC_SCALES.oranges

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    mapRef.current = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
      attributionControl: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      opacity: 0.7,
    }).addTo(mapRef.current)
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !data?.length) return
    const map = mapRef.current

    map.eachLayer(layer => {
      if (layer._isThematic) map.removeLayer(layer)
    })

    const values = data.map(d => d.count || d.doc_count || d.value || 0)
    const maxVal = Math.max(...values, 1)
    const thresholds = config.thresholds || [0, maxVal * 0.2, maxVal * 0.4, maxVal * 0.6, maxVal * 0.8, maxVal]

    data.forEach(d => {
      const count = d.count || d.doc_count || d.value || 0
      const lat = parseFloat(d.lat || d.latitude || 0)
      const lng = parseFloat(d.long || d.longitude || d.lon || 0)

      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return

      let colorIdx = 0
      for (let i = 0; i < thresholds.length; i++) {
        if (count >= thresholds[i]) colorIdx = i
      }

      const size = Math.max(8, Math.min(22, config.pointSize || 10 + Math.log2(count || 1) * 2))

      const circle = L.circleMarker([lat, lng], {
        radius: size,
        color: config.showBorders !== false ? '#ffffff' : scale[Math.min(colorIdx, scale.length - 1)],
        fillColor: scale[Math.min(colorIdx, scale.length - 1)],
        fillOpacity: 0.75,
        weight: config.showBorders !== false ? 2 : 0,
      })
      circle._isThematic = true
      circle.bindTooltip(`${d.key || d.country_name || d.region || ''}: ${count}`, { direction: 'top' })
      circle.bindPopup(`
        <div style="font-family:sans-serif;font-size:12px;min-width:120px">
          <div style="font-weight:600;margin-bottom:4px">${d.key || d.country_name || d.region || 'Unknown'}</div>
          <div style="display:flex;justify-content:space-between;gap:12px">
            <span style="color:#6b7280">Count:</span><span style="font-weight:500">${count}</span>
          </div>
          ${d.percentage !== undefined ? `<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#6b7280">%:</span><span style="font-weight:500">${(d.percentage * 100).toFixed(1)}%</span></div>` : ''}
          ${d.threshold ? `<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#6b7280">Threshold:</span><span style="font-weight:500">${d.threshold}</span></div>` : ''}
        </div>
      `)
      circle.addTo(map)
    })

    const legend = L.control({ position: 'bottomright' })
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', '')
      div.style.background = 'white'
      div.style.padding = '8px 12px'
      div.style.borderRadius = '8px'
      div.style.boxShadow = '0 1px 4px rgba(0,0,0,0.15)'
      div.style.fontSize = '10px'
      div.style.fontFamily = 'Inter, sans-serif'
      div.innerHTML = '<div style="font-weight:600;margin-bottom:4px;color:#374151">' + (config.legendTitle || 'Intensity') + '</div>'
      const steps = scale.slice(0, thresholds.length)
      steps.forEach((color, i) => {
        div.innerHTML += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
          <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${color}"></span>
          <span style="color:#6b7280">${thresholds[i]}${i < thresholds.length - 1 ? ' — ' + thresholds[i + 1] : '+'}</span>
        </div>`
      })
      return div
    }
    legend.addTo(map)
    map._legendControl = legend

    return () => {
      if (map._legendControl) { map.removeControl(map._legendControl); delete map._legendControl }
    }
  }, [data, config, colorScheme])

  return (
    <div ref={containerRef} style={{ width: '100%', height: config.height || 350 }} className="rounded-lg overflow-hidden" />
  )
}
