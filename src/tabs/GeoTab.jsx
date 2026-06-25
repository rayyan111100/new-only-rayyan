import React, { useState, useEffect } from 'react'
import { api } from '../api'

export default function GeoTab() {
  const [geo, setGeo] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    (async () => {
      try {
        const d = await api('geo', { index: 'unishield360-alerts-4.x-*', field: 'GeoLocation.country_name', size: 50 })
        setGeo(d.buckets || d.results || [])
      } catch {}
      finally { setLoading(false) }
    })()
  }, [])
  if (loading) return <div className="text-xs text-soc-stext dark:text-soc-darkstext p-4"><svg className="w-3 h-3 inline animate-spin mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Loading...</div>
  if (!geo.length) return <div className="text-xs text-soc-stext dark:text-soc-darkstext p-4">No geo data</div>
  return (
    <div className="grid grid-cols-3 gap-3">
      {geo.map((g, i) => (
        <div key={i} className="gcard p-3">
          <div className="text-xs font-semibold text-[#EF843C] dark:text-[#EF843C]">{g.key || g.country}</div>
          <div className="text-lg font-bold text-soc-text dark:text-soc-darktext mt-1">{g.doc_count || g.count}</div>
        </div>
      ))}
    </div>
  )
}
