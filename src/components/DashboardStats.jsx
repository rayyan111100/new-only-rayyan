import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { motion } from 'framer-motion'
import { api } from '../api'

const COLORS = ['#d32f2f', '#e65100', '#f9a825', '#2e7d32', '#00838f', '#6a1b9a']

export default function DashboardStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const d = await api('search', { index: 'unishield360-alerts-4.x-*', limit: 0, start_date: 'now-24h', end_date: 'now' })
        const total = d.total || 0
        const byLevel = {}
        for (const r of (d.results || [])) {
          const lv = r.rule?.level || 0
          const cat = lv >= 15 ? 'Critical' : lv >= 12 ? 'High' : lv >= 7 ? 'Medium' : lv >= 1 ? 'Low' : 'Info'
          byLevel[cat] = (byLevel[cat] || 0) + 1
        }
        setStats({ total, byLevel })
      } catch (e) { setError(e.message) }
      finally { setLoading(false) }
    })()
  }, [])

  if (loading) return <div className="col-span-full p-4 text-xs text-center text-soc-stext dark:text-soc-darkstext">{'\u23F3'} Loading...</div>
  if (error) return <div className="col-span-full p-4 text-xs text-red-500">{'\u274C'} {error}</div>
  if (!stats) return null

  const pieData = Object.entries(stats.byLevel).map(([name, value]) => ({ name, value }))

  return (
    <div className="col-span-full grid grid-cols-4 gap-3">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="gcard p-3">
        <div className="text-[10px] uppercase tracking-wider text-soc-stext dark:text-soc-darkstext">Total Events</div>
        <div className="text-2xl font-bold text-soc-text dark:text-soc-darktext mt-1">{stats.total.toLocaleString()}</div>
        <div className="text-[10px] text-soc-stext dark:text-soc-darkstext mt-0.5">Last 24 hours</div>
      </motion.div>
      {pieData.map((d, i) => (
        <motion.div key={d.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="gcard p-3">
          <div className="text-[10px] uppercase tracking-wider text-soc-stext dark:text-soc-darkstext">{d.name}</div>
          <div className="text-xl font-bold mt-1" style={{ color: COLORS[i % COLORS.length] }}>{d.value}</div>
        </motion.div>
      ))}
      <div className="col-span-2 gcard p-3">
        <div className="text-xs font-semibold text-soc-text dark:text-soc-darktext mb-2">Events by Severity</div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pieData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="col-span-2 gcard p-3">
        <div className="text-xs font-semibold text-soc-text dark:text-soc-darktext mb-2">Severity Distribution</div>
        <div className="h-40 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" label={({ name, value }) => `${name} ${value}`}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
