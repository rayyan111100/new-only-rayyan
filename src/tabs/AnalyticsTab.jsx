import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import { motion } from 'framer-motion'

export default function AnalyticsTab() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    (async () => {
      try {
        const d = await api('count', { index: 'wazuh-alerts-4.x-*', field: 'rule.level', min_doc_count: 1, size: 20 })
        setData((d.buckets || []).slice(0, 15).map(b => ({ level: b.key, count: b.doc_count })))
      } catch {}
      finally { setLoading(false) }
    })()
  }, [])
  return (
    <div className="space-y-4">
      <div className="gcard p-4">
        <div className="text-sm font-semibold text-soc-text dark:text-soc-darktext mb-3">Alert Levels Distribution</div>
        {loading ? <div className="text-xs text-soc-stext dark:text-soc-darkstext">{'\u23F3'} Loading...</div> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <XAxis dataKey="level" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" fill="#006BB4" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
