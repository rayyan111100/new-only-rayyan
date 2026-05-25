import React, { useState, useEffect } from 'react'
import { api } from '../api'

export default function GeoTab() {
  const [geo, setGeo] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    (async () => {
      try {
        const d = await api('geo', { index: 'wazuh-alerts-4.x-*', field: 'GeoLocation.country_name', size: 50 })
        setGeo(d.buckets || d.results || [])
      } catch {}
      finally { setLoading(false) }
    })()
  }, [])
  if (loading) return <div className="text-xs text-soc-stext dark:text-soc-darkstext p-4">{'\u23F3'} Loading...</div>
  if (!geo.length) return <div className="text-xs text-soc-stext dark:text-soc-darkstext p-4">No geo data</div>
  return (
    <div className="grid grid-cols-3 gap-3">
      {geo.map((g, i) => (
        <div key={i} className="gcard p-3">
          <div className="text-xs font-semibold text-[#1a73e8] dark:text-[#8ab4f8]">{g.key || g.country}</div>
          <div className="text-lg font-bold text-soc-text dark:text-soc-darktext mt-1">{g.doc_count || g.count}</div>
        </div>
      ))}
    </div>
  )
}
