import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function Maps({ data = [], config = {} }) {
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
    L.tileLayer(`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, {
      maxZoom: 18,
      opacity: 0.8,
    }).addTo(mapRef.current)
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !data?.length) return
    const map = mapRef.current
    const layerType = config.layerType || 'points'

    map.eachLayer(layer => {
      if (layer._isLayer) map.removeLayer(layer)
      if (layer._isHeatLayer) map.removeLayer(layer)
    })

    const points = data.filter(d => {
      const lat = parseFloat(d.lat || d.latitude || 0)
      const lng = parseFloat(d.long || d.longitude || 0)
      return !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)
    })

    if (!points.length) return

    if (layerType === 'clusters') {
      const markers = L.markerClusterGroup ? L.markerClusterGroup() : L.layerGroup()
      points.forEach(d => {
        const lat = parseFloat(d.lat || d.latitude)
        const lng = parseFloat(d.long || d.longitude)
        const m = L.circleMarker([lat, lng], {
          radius: config.pointSize || 6,
          color: config.color || '#EF843C',
          fillColor: config.color || '#EF843C',
          fillOpacity: 0.6,
          weight: 1,
        })
        m._isLayer = true
        markers.addLayer(m)
      })
      map.addLayer(markers)
    } else {
      const group = L.layerGroup()
      points.forEach(d => {
        const lat = parseFloat(d.lat || d.latitude)
        const lng = parseFloat(d.long || d.longitude)
        const count = d.count || d.doc_count || 1
        const size = layerType === 'heat' ? 12 : Math.max(4, Math.min(14, config.pointSize || 6 + Math.log2(count) * 2))

        const circle = L.circleMarker([lat, lng], {
          radius: size,
          color: layerType === 'heat' ? '#EF843C33' : (config.color || '#EF843C'),
          fillColor: layerType === 'heat' ? '#EF843C' : (config.color || '#EF843C'),
          fillOpacity: layerType === 'heat' ? 0.3 : 0.6,
          weight: layerType === 'heat' ? 0 : 1,
        })
        circle._isLayer = true
        circle.bindTooltip(`${d.label || d.city_name || ''}: ${count}`)
        group.addLayer(circle)
      })
      map.addLayer(group)

      if (points.length > 1) {
        const bounds = L.featureGroup(group.getLayers()).getBounds()
        if (bounds.isValid()) map.fitBounds(bounds.pad(0.1))
      }
    }
  }, [data, config])

  return (
    <div ref={containerRef} style={{ width: '100%', height: config.height || 350 }} className="rounded-lg overflow-hidden" />
  )
}
