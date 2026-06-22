import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function CoordinateMap({ data = [], config = {} }) {
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
      opacity: config.tileOpacity || 0.8,
    }).addTo(mapRef.current)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    map.eachLayer(layer => {
      if (layer._isMarker) map.removeLayer(layer)
    })

    if (!data?.length) return

    const validPoints = data.filter(d => {
      const lat = parseFloat(d.lat || d.latitude || d.latitud)
      const lng = parseFloat(d.long || d.longitude || d.lon || d.lng)
      return !isNaN(lat) && !isNaN(lng)
    })

    if (!validPoints.length) {
      const el = containerRef.current?.querySelector('.leaflet-control-container')
      return
    }

    const markers = []
    validPoints.forEach(d => {
      const lat = parseFloat(d.lat || d.latitude || d.latitud)
      const lng = parseFloat(d.long || d.longitude || d.lon || d.lng)
      const count = d.count || d.doc_count || 1
      const size = Math.max(6, Math.min(20, config.pointSize || 8 + Math.log2(count) * 2))

      const circle = L.circleMarker([lat, lng], {
        radius: size,
        color: config.color || '#EF843C',
        fillColor: config.color || '#EF843C',
        fillOpacity: 0.6,
        weight: 1,
        opacity: 0.8,
      })
      circle._isMarker = true
      circle.bindTooltip(`${d.label || d.city_name || ''}: ${count}`, { direction: 'top' })
      circle.bindPopup(`
        <div style="font-family:sans-serif;font-size:12px">
          <b>${d.label || d.city_name || `${lat.toFixed(2)}, ${lng.toFixed(2)}`}</b><br/>
          Count: ${count}
          ${d.country_name ? `<br/>Country: ${d.country_name}` : ''}
          ${d.region_name ? `<br/>Region: ${d.region_name}` : ''}
        </div>
      `)
      circle.addTo(map)
      markers.push(circle)
    })

    if (markers.length > 1) {
      const group = L.featureGroup(markers)
      map.fitBounds(group.getBounds().pad(0.1))
    } else if (markers.length === 1) {
      map.setView(markers[0].getLatLng(), 5)
    }
  }, [data, config])

  return (
    <div ref={containerRef} style={{ width: '100%', height: config.height || 350 }} className="rounded-lg overflow-hidden" />
  )
}
