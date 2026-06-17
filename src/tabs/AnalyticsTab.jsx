import React, { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { parseDateStr } from '../utils'

export default function AnalyticsTab() {
  const { startDate, endDate } = useApp()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)
  const fetchDataRef = useRef(null)
  const fetchData = async () => {
    try {
      const d = await api('count', { index: 'unishield360-alerts-4.x-*', field: 'rule.level', min_doc_count: 1, size: 20, start_date: parseDateStr(startDate).toISOString(), end_date: parseDateStr(endDate).toISOString() })
      setData((d.buckets || []).slice(0, 15).map(b => ({ level: b.key, count: b.doc_count })))
    } catch {}
    finally { setLoading(false) }
  }
  fetchDataRef.current = fetchData
  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(() => fetchDataRef.current(), 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [startDate, endDate])
  return (
    <div className="space-y-4">
      <div className="gcard p-4">
        <div className="text-sm font-semibold text-soc-text dark:text-soc-darktext mb-3">Alert Levels Distribution</div>
        {loading ? <div className="text-xs text-soc-stext dark:text-soc-darkstext"><svg className="w-3 h-3 inline animate-spin mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Loading...</div> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <XAxis dataKey="level" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" fill="#324059" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
