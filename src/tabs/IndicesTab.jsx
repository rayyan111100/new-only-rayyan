import React, { useState, useEffect, useRef } from 'react'
import { api } from '../api'

export default function IndicesTab() {
  const [indices, setIndices] = useState([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)
  const fetchData = async () => {
    try { const d = await api('indices', {}); setIndices(d.indices || d.results || d) }
    catch {}
    finally { setLoading(false) }
  }
  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])
  if (loading) return <div className="text-xs text-soc-stext dark:text-soc-darkstext p-4">{'\u23F3'} Loading...</div>
  return (
    <div className="gcard p-4">
      <div className="text-sm font-semibold text-soc-text dark:text-soc-darktext mb-3">Indices</div>
      <div className="space-y-1">
        {indices.map((idx, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs border border-soc-border/50 dark:border-soc-darkborder/50 rounded hover:bg-soc-bg/50 dark:hover:bg-soc-darkbg/50">
            <span className="text-soc-text dark:text-soc-darktext">{idx.index || idx.name || idx}</span>
            <span className="text-soc-stext dark:text-soc-darkstext">{idx.doc_count || ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
