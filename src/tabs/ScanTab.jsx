import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import { parseDateStr, formatPretty } from '../utils'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const QUICK_TIMES = [
  { label: '15m', value: 'now-15m' },
  { label: '1h', value: 'now-1h' },
  { label: '6h', value: 'now-6h' },
  { label: '24h', value: 'now-24h' },
  { label: '7d', value: 'now-7d' },
  { label: '30d', value: 'now-30d' }
]

const SEV_CONFIG = [
  { key: 'critical', label: 'Critical', range: 'rule.level:>=12', color: '#ef4444', bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: '\uD83D\uDD34' },
  { key: 'high', label: 'High', range: 'rule.level:[7 TO 11]', color: '#f97316', bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', icon: '\uD83D\uDFE1' },
  { key: 'medium', label: 'Medium', range: 'rule.level:[3 TO 6]', color: '#eab308', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: '\uD83D\uDFE0' },
  { key: 'low', label: 'Low', range: 'rule.level:[1 TO 2]', color: '#22c55e', bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', icon: '\uD83D\uDFE2' }
]

const WINDOWS_EVENTS = [
  { id: 4624, label: 'Successful Logon', desc: 'User logged on to system', severity: 'info', query: 'rule.groups:authentication_success OR data.win.system.eventID:4624' },
  { id: 4625, label: 'Failed Logon', desc: 'Failed logon attempt', severity: 'high', query: 'rule.groups:authentication_failed OR data.win.system.eventID:4625' },
  { id: 4672, label: 'Admin Logon', desc: 'Special privileges assigned', severity: 'critical', query: 'data.win.system.eventID:4672' },
  { id: 4688, label: 'Process Creation', desc: 'New process created', severity: 'medium', query: 'data.win.system.eventID:4688' },
  { id: 4719, label: 'Audit Policy Changed', desc: 'System audit policy was modified', severity: 'critical', query: 'data.win.system.eventID:4719' },
  { id: 4720, label: 'User Account Created', desc: 'New user account created', severity: 'critical', query: 'data.win.system.eventID:4720' },
  { id: 4728, label: 'Group Member Added', desc: 'Member added to security group', severity: 'high', query: 'data.win.system.eventID:4728' },
  { id: 4740, label: 'Account Lockout', desc: 'User account locked out', severity: 'medium', query: 'data.win.system.eventID:4740' },
  { id: 1102, label: 'Security Log Cleared', desc: 'Audit log was cleared', severity: 'critical', query: 'data.win.system.eventID:1102' },
  { id: 7045, label: 'Service Installed', desc: 'New service installed', severity: 'high', query: 'data.win.system.eventID:7045' }
]

const SEV_EVENT_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#eab308', info: '#3b82f6' }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1d2e] border border-[#2d3140] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#9ca3af] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-semibold text-white">{p.value}</span></p>
      ))}
    </div>
  )
}

function FilterBtn({ field, value, label }) {
  const { addFilter, setTab } = useApp()
  const handle = (e) => { e.stopPropagation(); addFilter(field, value, false); setTab('discover') }
  return (
    <button onClick={handle} className="ml-1.5 p-0.5 rounded hover:bg-[#3b82f6]/20 text-[#6b7280] hover:text-[#3b82f6] transition-all shrink-0" title={'Filter for ' + label}>
      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 7h3.5a.5.5 0 1 1 0 1H8v3.5a.5.5 0 1 1-1 0V8H3.5a.5.5 0 0 1 0-1H7V3.5a.5.5 0 0 1 1 0V7Z"/></svg>
    </button>
  )
}

function Card({ children, className = '' }) {
  return <div className={'bg-[#16181f] border border-[#2d3140] rounded-xl p-4 ' + className}>{children}</div>
}

function StatCard({ label, value, color, bg, border, text, icon, onClick, loading }) {
  return (
    <button onClick={onClick} className={'relative overflow-hidden rounded-xl border p-4 text-left transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] ' + bg + ' ' + border + ' ' + (onClick ? 'cursor-pointer' : '')}>
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 w-16 bg-[#2d3140] rounded animate-pulse" />
          <div className="h-7 w-20 bg-[#2d3140] rounded animate-pulse" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className={'text-[10px] font-semibold uppercase tracking-wider ' + text}>{icon} {label}</span>
            {onClick && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#6b7280]"><path d="M9 5l7 7-7 7"/></svg>}
          </div>
          <div className={'text-2xl font-bold ' + text}>{value}</div>
        </>
      )}
    </button>
  )
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h3 className="text-sm font-semibold text-[#e4e6eb]">{title}</h3>
        {subtitle && <p className="text-[10px] text-[#6b7280] mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export default function SecurityDashboard() {
  const { addFilter, setTab, startDate, endDate } = useApp()
  const [timeRange, setTimeRange] = useState('now-24h')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  const qs = (d) => d ? '&start_date=' + encodeURIComponent(d) : ''

  const timeParams = useCallback(() => {
    const sd = parseDateStr(timeRange).toISOString()
    const ed = parseDateStr('now').toISOString()
    return { start_date: sd, end_date: ed }
  }, [timeRange])

  const fetchData = useCallback(async () => {
    try {
      const tp = timeParams()
      const base = { start_date: tp.start_date, end_date: tp.end_date }

      const [totalRes, timelineRes, agentsRes, rulesRes, recentRes, ...sevRes] = await Promise.all([
        api('search', { ...base, size: 0, q: '*' }),
        api('aggregate', { ...base, field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48 }),
        api('search', { ...base, size: 0, q: '*', aggs: JSON.stringify({ agents: { terms: { field: 'agent.name.keyword', size: 10 } } }) }),
        api('search', { ...base, size: 0, q: '*', aggs: JSON.stringify({ rules: { terms: { field: 'rule.level', size: 10 } } }) }),
        api('search', { ...base, size: 15, sort: '@timestamp:desc' }),
        ...SEV_CONFIG.map(s => api('search', { ...base, size: 0, q: s.range }))
      ])

      const eventCounts = {}
      const eventResults = await Promise.all(
        WINDOWS_EVENTS.map(e =>
          api('search', { ...base, size: 0, q: e.query }).catch(() => ({ total: 0 }))
        )
      )
      WINDOWS_EVENTS.forEach((e, i) => { eventCounts[e.id] = eventResults[i].total || 0 })

      let agents = []
      try {
        const aAggs = typeof agentsRes.aggregations === 'string' ? JSON.parse(agentsRes.aggregations) : agentsRes.aggregations
        agents = (aAggs?.agents?.buckets || []).slice(0, 8)
      } catch { agents = [] }

      let rules = []
      try {
        const rAggs = typeof rulesRes.aggregations === 'string' ? JSON.parse(rulesRes.aggregations) : rulesRes.aggregations
        rules = (rAggs?.rules?.buckets || []).slice(0, 8)
      } catch { rules = [] }

      const timeline = (timelineRes.buckets || []).map(b => ({
        time: new Date(b.key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        alerts: b.doc_count || 0
      }))

      const sevCounts = {}
      SEV_CONFIG.forEach((s, i) => { sevCounts[s.key] = sevRes[i].total || 0 })

      setData({
        total: totalRes.total || 0,
        severity: sevCounts,
        timeline,
        agents,
        rules,
        events: eventCounts,
        recent: (recentRes.results || []).slice(0, 15)
      })
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [timeParams])

  useEffect(() => {
    setLoading(true)
    fetchData()
    intervalRef.current = setInterval(fetchData, 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchData])

  const navToDiscover = (field, value) => { addFilter(field, value, false); setTab('discover') }
  const navToDiscoverQ = (q) => { addFilter('_dql', q, false); setTab('discover') }

  const severityPie = data ? Object.entries(data.severity).map(([k, v]) => {
    const cfg = SEV_CONFIG.find(s => s.key === k)
    return { name: cfg.label, value: v, color: cfg.color }
  }).filter(d => d.value > 0) : []

  return (
    <div className="space-y-4 pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#16181f] border border-[#2d3140] rounded-xl p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#e4e6eb]">SOC Security Dashboard</span>
          <span className="text-[10px] text-[#6b7280] bg-[#1e2030] px-2 py-0.5 rounded-full border border-[#2d3140]">
            {data ? (data.total || 0).toLocaleString() + ' alerts' : '\u23F3'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK_TIMES.map(qt => (
            <button key={qt.value} onClick={() => setTimeRange(qt.value)}
              className={'px-2.5 py-1 text-[10px] font-medium rounded-lg transition-all ' + (timeRange === qt.value ? 'bg-[#3b82f6] text-white shadow-sm' : 'bg-[#1e2030] text-[#9ca3af] hover:bg-[#2d3140] border border-[#2d3140]')}>
              {qt.label}
            </button>
          ))}
          <span className="text-[9px] text-[#6b7280] ml-1 hidden sm:inline">{formatPretty(timeRange, 'now')}</span>
        </div>
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400">
          {error}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard label="Total Alerts" value={data ? (data.total || 0).toLocaleString() : '\u2014'} color="#3b82f6" bg="bg-blue-500/10" border="border-blue-500/30" text="text-blue-400" icon={'\uD83D\uDD35'} onClick={() => navToDiscover('*', '*')} loading={loading} />
        {SEV_CONFIG.map(s => (
          <StatCard key={s.key} label={s.label} value={data ? (data.severity[s.key] || 0).toLocaleString() : '\u2014'} color={s.color} bg={s.bg} border={s.border} text={s.text} icon={s.icon} onClick={() => navToDiscover('rule.level', s.range)} loading={loading} />
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2">
          <Card>
            <SectionHeader title="Alert Timeline" subtitle={'Alerts over time (' + formatPretty(timeRange, 'now') + ')'} />
            {loading ? (
              <div className="h-48 bg-[#1e2030] rounded-lg animate-pulse" />
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.timeline || []} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
                    <defs>
                      <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="alerts" stroke="#3b82f6" strokeWidth={2} fill="url(#colorAlerts)" dot={false} activeDot={{ r: 4, fill: '#3b82f6', stroke: '#16181f', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <SectionHeader title="Severity Distribution" />
            {loading ? (
              <div className="h-48 bg-[#1e2030] rounded-lg animate-pulse" />
            ) : (
              <div className="h-48 flex items-center justify-center">
                {severityPie.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={severityPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" onClick={(e) => {
                        const cfg = SEV_CONFIG.find(s => s.label === e.name)
                        if (cfg) navToDiscover('rule.level', cfg.range)
                      }} style={{ cursor: 'pointer' }}>
                        {severityPie.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="#16181f" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <span className="text-xs text-[#6b7280]">No data</span>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {severityPie.map(d => (
                <button key={d.name} onClick={() => {
                  const cfg = SEV_CONFIG.find(s => s.label === d.name)
                  if (cfg) navToDiscover('rule.level', cfg.range)
                }} className="flex items-center gap-1.5 text-[10px] text-[#9ca3af] hover:text-white transition-colors">
                  <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  {d.name}: <span className="font-semibold">{d.value}</span>
                </button>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <SectionHeader title="Critical Windows Security Events" subtitle="Click to filter by event type and navigate to Discover" />
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-16 bg-[#1e2030] rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {WINDOWS_EVENTS.map(ev => {
                const cnt = data?.events?.[ev.id] || 0
                const sevColor = SEV_EVENT_COLORS[ev.severity] || '#6b7280'
                return (
                  <button key={ev.id} onClick={() => navToDiscoverQ(ev.query)}
                    className="relative flex flex-col items-start p-3 rounded-xl border border-[#2d3140] bg-[#1e2030] hover:border-[#3b82f6]/50 hover:bg-[#252840] transition-all text-left group">
                    <div className="flex items-center gap-2 w-full mb-1">
                      <span className="text-[11px] font-mono font-bold" style={{ color: sevColor }}>{ev.id}</span>
                      <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-[#3b82f6]"><path fillRule="evenodd" d="M8 7h3.5a.5.5 0 1 1 0 1H8v3.5a.5.5 0 1 1-1 0V8H3.5a.5.5 0 0 1 0-1H7V3.5a.5.5 0 0 1 1 0V7Z"/></svg>
                      </span>
                    </div>
                    <span className="text-[10px] text-[#9ca3af] leading-tight line-clamp-2 mb-1.5">{ev.label}</span>
                    <span className="text-xs font-bold" style={{ color: sevColor }}>{cnt.toLocaleString()}</span>
                    <span className="text-[9px] text-[#6b7280] ml-1">alerts</span>
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card>
            <SectionHeader title="Top Agents" subtitle="Most active agents" />
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-6 bg-[#1e2030] rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-1.5">
                {(data?.agents?.length > 0 ? data.agents : []).map((a, i) => (
                  <button key={a.key || i} onClick={() => navToDiscover('agent.name', a.key)}
                    className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-[#1e2030] transition-colors text-left group">
                    <span className="text-[10px] font-mono text-[#6b7280] w-4">{i + 1}</span>
                    <span className="flex-1 text-xs text-[#d1d5db] truncate">{a.key}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 sm:w-24 h-1.5 bg-[#2d3140] rounded-full overflow-hidden">
                        <div className="h-full bg-[#3b82f6] rounded-full transition-all duration-500" style={{ width: Math.min(100, (a.doc_count / Math.max(...data.agents.map(x => x.doc_count))) * 100) + '%' }} />
                      </div>
                      <span className="text-[10px] font-semibold text-[#9ca3af] w-10 text-right">{a.doc_count}</span>
                      <FilterBtn field="agent.name" value={a.key} label={a.key} />
                    </div>
                  </button>
                ))}
                {(!data?.agents || data.agents.length === 0) && <span className="text-xs text-[#6b7280]">No agent data available</span>}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <SectionHeader title="Rule Level Distribution" subtitle="Top alert levels" />
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-6 bg-[#1e2030] rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-1.5">
                {(data?.rules?.length > 0 ? data.rules : []).map((r, i) => (
                  <button key={r.key || i} onClick={() => navToDiscover('rule.level', 'rule.level:' + r.key)}
                    className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-[#1e2030] transition-colors text-left group">
                    <span className="text-[10px] font-mono text-[#6b7280] w-4">{i + 1}</span>
                    <span className="flex-1 text-xs">
                      <span className={'font-mono font-bold ' + (parseInt(r.key) >= 12 ? 'text-red-400' : parseInt(r.key) >= 7 ? 'text-orange-400' : parseInt(r.key) >= 3 ? 'text-yellow-400' : 'text-green-400')}>
                        {r.key}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 sm:w-24 h-1.5 bg-[#2d3140] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: Math.min(100, (r.doc_count / Math.max(...data.rules.map(x => x.doc_count))) * 100) + '%', background: parseInt(r.key) >= 12 ? '#ef4444' : parseInt(r.key) >= 7 ? '#f97316' : parseInt(r.key) >= 3 ? '#eab308' : '#22c55e' }} />
                      </div>
                      <span className="text-[10px] font-semibold text-[#9ca3af] w-10 text-right">{r.doc_count}</span>
                      <FilterBtn field="rule.level" value={r.key} label={'rule.level: ' + r.key} />
                    </div>
                  </button>
                ))}
                {(!data?.rules || data.rules.length === 0) && <span className="text-xs text-[#6b7280]">No rule data available</span>}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card>
          <SectionHeader title="Recent Alerts" subtitle={'Last ' + (data?.recent?.length || 0) + ' events \u2014 click any row to filter'} />
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-7 bg-[#1e2030] rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#6b7280] text-[10px] uppercase tracking-wider border-b border-[#2d3140]">
                    <th className="text-left py-2 pr-3 font-medium">Time</th>
                    <th className="text-left py-2 pr-3 font-medium">Rule</th>
                    <th className="text-left py-2 pr-3 font-medium">Level</th>
                    <th className="text-left py-2 pr-3 font-medium">Agent</th>
                    <th className="text-left py-2 pr-3 font-medium hidden sm:table-cell">Description</th>
                    <th className="text-right py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recent || []).map((r, i) => {
                    const lv = parseInt(r?.rule?.level) || 0
                    const lvColor = lv >= 12 ? 'text-red-400' : lv >= 7 ? 'text-orange-400' : lv >= 3 ? 'text-yellow-400' : 'text-green-400'
                    const lvBg = lv >= 12 ? 'bg-red-500/10' : lv >= 7 ? 'bg-orange-500/10' : lv >= 3 ? 'bg-yellow-500/10' : 'bg-green-500/10'
                    return (
                      <tr key={r._id || i} className={'border-b border-[#2d3140]/50 hover:bg-[#1e2030] transition-colors ' + (i < 3 ? '' : 'opacity-80')}>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <button onClick={() => navToDiscover('@timestamp', r['@timestamp'])} className="text-[#9ca3af] hover:text-[#3b82f6] transition-colors">
                            {r['@timestamp'] ? new Date(r['@timestamp']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '\u2014'}
                          </button>
                        </td>
                        <td className="py-2 pr-3">
                          <button onClick={() => navToDiscover('rule.id', r?.rule?.id)} className="text-[#d1d5db] hover:text-[#3b82f6] transition-colors">
                            {(r?.rule?.id || '').toString().slice(0, 20)}
                          </button>
                        </td>
                        <td className="py-2 pr-3">
                          <button onClick={() => navToDiscover('rule.level', r?.rule?.level)} className={'px-1.5 py-0.5 rounded text-[10px] font-bold ' + lvBg + ' ' + lvColor + ' hover:opacity-80 transition-opacity'}>
                            {lv || '\u2014'}
                          </button>
                        </td>
                        <td className="py-2 pr-3">
                          <button onClick={() => navToDiscover('agent.name', r?.agent?.name)} className="text-[#9ca3af] hover:text-[#3b82f6] transition-colors truncate max-w-[80px] sm:max-w-[120px] block">
                            {r?.agent?.name || '\u2014'}
                          </button>
                        </td>
                        <td className="py-2 pr-3 hidden sm:table-cell">
                          <span className="text-[#6b7280] truncate max-w-[200px] block">{r?.rule?.description || r?.rule?.groups?.[0] || ''}</span>
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <FilterBtn field="_id" value={r._id} label="this alert" />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {(!data?.recent || data.recent.length === 0) && <div className="text-xs text-[#6b7280] text-center py-8">No recent alerts found</div>}
            </div>
          )}
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center justify-between text-[9px] text-[#4b5563] border-t border-[#2d3140] pt-3 mt-2">
        <span>Auto-refreshes every 30s &middot; Data from Wazuh index</span>
        <button onClick={fetchData} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#1e2030] transition-colors">
          <svg className={'w-3 h-3 ' + (loading ? 'animate-spin' : '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
          </svg>
          Refresh
        </button>
      </motion.div>
    </div>
  )
}
