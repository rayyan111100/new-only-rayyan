import React, { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import { parseDateStr } from '../utils'

export default function SearchTab() {
  const { startDate, endDate } = useApp()
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(50)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef(null)
  const doSearchRef = useRef(null)
  const doSearch = async () => {
    setLoading(true)
    try {
      const d = await api('search', { q: q || undefined, limit, index: 'unishield360-alerts-4.x-*', start_date: parseDateStr(startDate).toISOString(), end_date: parseDateStr(endDate).toISOString() })
      setResults(d)
    } catch (e) { setResults({ error: e.message }) }
    finally { setLoading(false) }
  }
  doSearchRef.current = doSearch

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (q === '') doSearchRef.current()
    }, 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [q])
  return (
    <div className="space-y-4">
      <div className="gcard p-4">
        <div className="text-sm font-semibold text-soc-text dark:text-soc-darktext mb-3">Raw Search</div>
        <div className="flex gap-2 mb-2">
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="DQL query (field:value)" className="ginput flex-1 px-3 py-1.5 text-xs" onKeyDown={e => e.key === 'Enter' && doSearch()} />
          <select value={limit} onChange={e => setLimit(parseInt(e.target.value))} className="ginput px-2 py-1.5 text-xs">
            <option>10</option><option>50</option><option>100</option>
          </select>
          <button onClick={doSearch} disabled={loading} className="gbtn-primary px-4 py-1.5 text-xs font-semibold rounded">{loading ? '\u23F3' : '\uD83D\uDD0D'} Search</button>
        </div>
      </div>
      {results && (
        <div className="gcard p-4">
          <div className="text-xs text-soc-stext dark:text-soc-darkstext mb-2">Total: <b>{results.total || 0}</b></div>
          <pre className="text-xs text-soc-text dark:text-soc-darktext overflow-auto max-h-96">{JSON.stringify(results.results?.slice(0, 10) || [], null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
