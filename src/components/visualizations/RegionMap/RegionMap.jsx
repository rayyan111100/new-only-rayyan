import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const CHOROPLETH_COLORS = ['#feedde', '#fdd0a2', '#fdae6b', '#fd8d3c', '#e6550d', '#a63603']

export default function RegionMap({ data = [], config = {} }) {
  const mapRef = useRef(null)
  const containerRef = useRef(null)

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
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !data?.length) return
    const map = mapRef.current

    map.eachLayer(layer => {
      if (layer._isOverlay) map.removeLayer(layer)
    })

    const values = data.map(d => d.count || d.doc_count || 0)
    const maxVal = Math.max(...values, 1)
    const colorScale = config.colorScale || CHOROPLETH_COLORS

    data.forEach(d => {
      const key = d.key || d.country_name || d.region || ''
      const count = d.count || d.doc_count || 0
      const idx = Math.min(Math.floor((count / maxVal) * colorScale.length), colorScale.length - 1)
      const lat = d.lat || d.latitude
      const lng = d.long || d.longitude || d.lon

      if (lat && lng) {
        const circle = L.circleMarker([parseFloat(lat), parseFloat(lng)], {
          radius: Math.max(6, Math.min(18, 6 + Math.log2(count || 1) * 2)),
          color: config.showBorders !== false ? '#ffffff' : colorScale[idx],
          fillColor: colorScale[idx],
          fillOpacity: 0.7,
          weight: config.showBorders !== false ? 1.5 : 0,
        })
        circle._isOverlay = true
        circle.bindTooltip(`${key}: ${count}`, { direction: 'top' })
        circle.addTo(map)
      }
    })

    if (config.showLabels) {
      data.forEach(d => {
        const lat = d.lat || d.latitude
        const lng = d.long || d.longitude || d.lon
        if (lat && lng && (d.count || d.doc_count || 0) > maxVal * 0.3) {
          L.marker([parseFloat(lat), parseFloat(lng)], {
            icon: L.divIcon({
              className: '',
              html: `<div style="font-size:9px;font-weight:600;color:#374151;background:rgba(255,255,255,0.8);padding:1px 4px;border-radius:3px;white-space:nowrap">${d.key || ''}</div>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            }),
          }).addTo(map)
        }
      })
    }
  }, [data, config])

  return (
    <div ref={containerRef} style={{ width: '100%', height: config.height || 350 }} className="rounded-lg overflow-hidden" />
  )
}
