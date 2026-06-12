import React, { useState, useEffect, useCallback, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { motion } from 'framer-motion'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import DateRangePicker from './DateRangePicker'
import { parseDateStr, formatPretty } from '../utils'

const SEV_LABELS = { Critical: { color: '#dc2626', min: 15 }, High: { color: '#ea580c', min: 12 }, Medium: { color: '#ca8a04', min: 7 }, Low: { color: '#16a34a', min: 1 }, Info: { color: '#e0752a', min: 0 } }
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Info']
const CHART_COLORS = ['#EF843C', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308', '#f97316']



const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#9ca3af] dark:text-[#6b7280] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-semibold text-[#1a1c23] dark:text-white">{p.value?.toLocaleString() || p.value}</span></p>
      ))}
    </div>
  )
}

function FilterBtn({ field, value, label }) {
  const { addFilter } = useApp()
  const handle = (e) => { e.stopPropagation(); addFilter(field, value, false) }
  return (
    <button onClick={handle} className="ml-auto p-1 rounded hover:bg-[#EF843C]/20 text-[#9ca3af] dark:text-[#6b7280] hover:text-[#EF843C] dark:hover:text-[#EF843C] transition-all shrink-0 opacity-0 group-hover:opacity-100" title={'Filter by ' + label}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 7h3.5a.5.5 0 1 1 0 1H8v3.5a.5.5 0 1 1-1 0V8H3.5a.5.5 0 0 1 0-1H7V3.5a.5.5 0 0 1 1 0V7Z"/></svg>
    </button>
  )
}

function PulseDot({ color = '#22c55e' }) {
  return (
    <span className="relative inline-flex w-1.5 h-1.5">
      <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: color }} />
      <span className="absolute inset-0 rounded-full" style={{ background: color }} />
    </span>
  )
}

function toSeverity(level) {
  const n = parseInt(level) || 0
  for (const s of SEV_ORDER) if (n >= SEV_LABELS[s].min) return s
  return 'Info'
}

const SEV_RANGES = {
  Critical: 'rule.level:>=15',
  High: 'rule.level:[12 TO 14]',
  Medium: 'rule.level:[7 TO 11]',
  Low: 'rule.level:[1 TO 6]',
  Info: 'rule.level:[0 TO 0]'
}

export default function SocDashboard() {
  const { startDate, endDate } = useApp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const timerRef = useRef(null)

  const [drillFilters, setDrillFilters] = useState([])
  const [drillResults, setDrillResults] = useState(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const drillRef = useRef([])

  const runDrillSearch = useCallback(async (filters) => {
    if (filters.length === 0) { setDrillResults(null); setDrillLoading(false); return }
    setDrillLoading(true)
    try {
      const sd = parseDateStr(startDate).toISOString()
      const ed = parseDateStr(endDate).toISOString()
      const hasWildcard = filters.some(f => f.field === '*' && f.value === '*')
      const effective = hasWildcard ? [] : filters
      let q = '*'
      if (effective.length > 0) {
        q = effective.map(f => {
          const val = /^\d+(\.\d+)?$/.test(String(f.value)) ? f.value : `"${f.value}"`
          return `${f.field}:${val}`
        }).join(' AND ')
      }
      const res = await api('search', { start_date: sd, end_date: ed, q, size: 50, sort: '@timestamp:desc' })
      setDrillResults(res)
    } catch { setDrillResults({ results: [], total: 0 }) }
    setDrillLoading(false)
  }, [startDate, endDate])

  const addDrill = useCallback((field, value) => {
    setDrillFilters(prev => {
      const exists = prev.find(f => f.field === field && f.value === value)
      if (exists) return prev
      const next = [...prev, { field, value }]
      drillRef.current = next
      runDrillSearch(next)
      return next
    })
  }, [runDrillSearch])

  const removeDrill = useCallback((idx) => {
    setDrillFilters(prev => {
      const next = prev.filter((_, i) => i !== idx)
      drillRef.current = next
      runDrillSearch(next)
      return next
    })
  }, [runDrillSearch])

  const clearDrills = useCallback(() => {
    setDrillFilters([])
    drillRef.current = []
    setDrillResults(null)
  }, [])

  const fetchDashboard = () => {
    const sd = parseDateStr(startDate).toISOString()
    const ed = parseDateStr(endDate).toISOString()
    api('dashboard', { index: 'unishield360-alerts-4.x-*', start_date: sd, end_date: ed })
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }

  useEffect(() => {
    setLoading(true)
    fetchDashboard()
    timerRef.current = setInterval(fetchDashboard, 60000)
    return () => clearInterval(timerRef.current)
  }, [startDate, endDate])

  if (loading) return (
    <div className="space-y-3">
        <div className="flex gap-1.5 flex-wrap"><div className="h-7 w-44 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-lg animate-pulse" /></div>
      <div className="grid grid-cols-5 gap-2.5">{[1,2,3,4,5].map(i => <div key={i} className="gcard p-4"><div className="h-16 bg-[#f3f4f6] dark:bg-[#2d3140] rounded animate-pulse"/></div>)}</div>
      <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i => <div key={i} className="gcard p-4"><div className="h-40 bg-[#f3f4f6] dark:bg-[#2d3140] rounded animate-pulse"/></div>)}</div>
    </div>
  )
  if (error) return (
    <div className="gcard p-6 text-center">
      <div className="text-2xl mb-2"><svg className="w-8 h-8 inline text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
      <div className="text-sm text-[#dc2626] mb-3">{error}</div>
      <button onClick={fetchDashboard} className="gbtn-primary px-4 py-1.5">Retry</button>
    </div>
  )
  if (!data) return null

  const { count24, count7d, count30d, byLevel, topRules, topAgents, timeline, categories, recent, recentTotal } = data

  const sevMap = {}
  for (const b of byLevel) { const s = toSeverity(b.key); sevMap[s] = (sevMap[s] || 0) + b.doc_count }
  const sevData = SEV_ORDER.filter(s => sevMap[s]).map(s => ({ name: s, value: sevMap[s], color: SEV_LABELS[s].color }))
  const sevTotal = sevData.reduce((a, b) => a + b.value, 0)

  const timelineData = (timeline || []).slice(-24).map(b => ({ time: new Date(b.key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), alerts: b.doc_count }))

  const topRulesData = (topRules || []).slice(0, 8).map((b, i) => ({ name: b.key || `Rule ${i+1}`, count: b.doc_count }))
  const topAgentsData = (topAgents || []).slice(0, 8).map(b => ({ name: b.key || 'Unknown', count: b.doc_count }))
  const catData = (categories || []).slice(0, 6).map((b, i) => ({ name: (b.key || 'Other').slice(0, 20), value: b.doc_count, color: CHART_COLORS[i % CHART_COLORS.length] }))
  const maxRule = Math.max(1, ...topRulesData.map(r => r.count))
  const maxAgent = Math.max(1, ...topAgentsData.map(a => a.count))

  return (
    <div className="space-y-3">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="gcard px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <PulseDot />
          <span className="text-sm font-semibold text-[#1a1c23] dark:text-[#e4e6eb]"><svg className="w-4 h-4 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Security Overview</span>
          <span className="gchip text-[10px]">{(count24 || 0).toLocaleString()} alerts</span>
          {drillFilters.length > 0 && (
            <span className="gchip text-[9px] bg-[#EF843C]/10 text-[#EF843C] dark:text-[#EF843C]">{'Drill: ' + drillFilters.length}</span>
          )}
        </div>
        <div className="-mr-1.5"><DateRangePicker /></div>
      </motion.div>

      <div className="grid grid-cols-5 gap-2.5">
        {[
          { label: 'Total Alerts', value: count24, prev: count7d / 7, field: '*', val: '*', color: '#EF843C' },
          { label: 'Last 7 Days', value: count7d, prev: count30d / 4, field: '*', val: '*', color: '#8b5cf6' },
          { label: 'Last 30 Days', value: count30d, prev: null, field: '*', val: '*', color: '#06b6d4' },
          { label: 'Alert Rate', value: Math.round(count24 / 24), prev: null, suffix: '/hr', field: '*', val: '*', color: '#16a34a' },
          { label: 'Recent Alerts', value: recentTotal, prev: null, field: '*', val: '*', color: '#ca8a04' }
        ].map((item, i) => {
          const pct = item.prev ? Math.round(((item.value - item.prev) / item.prev) * 100) : 0
          const isUp = pct > 0
          return (
            <motion.button key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => addDrill(item.field, item.val)}
              className="gcard p-3.5 text-left hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-[#9ca3af] dark:text-[#6b7280] font-semibold">{item.label}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#d1d5db] dark:text-[#4b5563] opacity-0 group-hover:opacity-100 transition-opacity"><path d="M9 5l7 7-7 7"/></svg>
              </div>
              <div className="text-2xl font-bold text-[#1a1c23] dark:text-[#e4e6eb]">{(item.value || 0).toLocaleString()}{item.suffix || ''}</div>
              {item.prev && pct !== 0 && (
                <div className={'text-[10px] font-medium mt-0.5 flex items-center gap-0.5 ' + (isUp ? 'text-[#dc2626]' : 'text-[#16a34a]')}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className={isUp ? '' : 'rotate-180'}><path d="M12 5l7 7-1.41 1.41L13 9.83V21h-2V9.83l-4.59 4.58L5 12l7-7z"/></svg>
                  {Math.abs(pct)}%
                </div>
              )}
            </motion.button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="gcard p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Alert Severity</h3>
            <span className="text-[9px] text-[#9ca3af] dark:text-[#6b7280]">{(sevTotal || 0).toLocaleString()} total</span>
          </div>
          <div className="space-y-2.5">
            {sevData.map(s => {
              const pct = sevTotal ? Math.round((s.value / sevTotal) * 100) : 0
              return (
                <button key={s.name} onClick={() => addDrill('rule.level', SEV_RANGES[s.name])}
                  className="w-full text-left group">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="flex items-center gap-1.5 text-[#1a1c23] dark:text-[#e4e6eb]">
                      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="font-medium">{s.name}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-semibold" style={{ color: s.color }}>{s.value.toLocaleString()}</span>
                      <span className="text-[#9ca3af] dark:text-[#6b7280] text-[10px]">({pct}%)</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#d1d5db] dark:text-[#4b5563] opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"><path d="M9 5l7 7-7 7"/></svg>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: pct + '%', backgroundColor: s.color }} />
                  </div>
                </button>
              )
            })}
            {sevData.length === 0 && <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] py-4 text-center">No data</div>}
          </div>
        </div>

        <div className="gcard p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Alert Timeline</h3>
            <span className="text-[9px] text-[#9ca3af] dark:text-[#6b7280]">{formatPretty(startDate, endDate)}</span>
          </div>
          <div className="h-44">
            {timelineData.length === 0 ? (
              <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] h-full flex items-center justify-center">No timeline data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#EF843C" stopOpacity={0.3}/><stop offset="95%" stopColor="#EF843C" stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="alerts" stroke="#EF843C" strokeWidth={2} fill="url(#tg)" dot={false} activeDot={{ r: 4, fill: '#EF843C', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="gcard">
          <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Top Alert Rules</h3>
              <span className="gchip text-[9px]">{topRulesData.length}</span>
            </div>
          </div>
          {topRulesData.length === 0 ? (
            <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] py-8 text-center">No data</div>
          ) : (
            <div className="p-3 space-y-1.5">
              {topRulesData.map((r, i) => (
                <button key={i} onClick={() => addDrill('rule.id', r.name)}
                  className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]/50 transition-colors group">
                  <span className="w-4 text-center text-[#9ca3af] dark:text-[#6b7280] text-[10px] font-mono shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-[#1a1c23] dark:text-[#e4e6eb] truncate">{r.name}</span>
                      <span className="shrink-0 ml-2 text-xs font-semibold text-[#EF843C] dark:text-[#EF843C]">{r.count.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#EF843C] dark:bg-[#EF843C] transition-all duration-700" style={{ width: (r.count / maxRule) * 100 + '%' }} />
                    </div>
                  </div>
                  <FilterBtn field="rule.id" value={r.name} label={r.name} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="gcard">
          <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Top Agents</h3>
              <span className="gchip text-[9px]">{topAgentsData.length}</span>
            </div>
          </div>
          {topAgentsData.length === 0 ? (
            <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] py-8 text-center">No data</div>
          ) : (
            <div className="p-3 space-y-1.5">
              {topAgentsData.map((a, i) => (
                <button key={i} onClick={() => addDrill('agent.name', a.name)}
                  className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]/50 transition-colors group">
                  <span className="w-4 text-center text-[#9ca3af] dark:text-[#6b7280] text-[10px] font-mono shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-[#1a1c23] dark:text-[#e4e6eb] truncate">{a.name}</span>
                      <span className="shrink-0 ml-2 text-xs font-semibold text-[#8b5cf6]">{a.count.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#8b5cf6] transition-all duration-700" style={{ width: (a.count / maxAgent) * 100 + '%' }} />
                    </div>
                  </div>
                  <FilterBtn field="agent.name" value={a.name} label={a.name} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="gcard p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Alert Categories</h3>
            <span className="text-[9px] text-[#9ca3af] dark:text-[#6b7280]">{catData.length}</span>
          </div>
          <div className="h-44 flex items-center justify-center">
            {catData.length === 0 ? (
              <div className="text-xs text-[#9ca3af] dark:text-[#6b7280]">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={2} style={{ cursor: 'pointer' }}>
                    {catData.map((e, i) => (
                      <Cell key={i} fill={e.color} stroke="#fff" strokeWidth={2}
                        onClick={() => addDrill('rule.groups', e.name)} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
            {catData.map((c, i) => (
              <button key={i} onClick={() => addDrill('rule.groups', c.name)}
                className="inline-flex items-center gap-1 text-[10px] text-[#6b7280] dark:text-[#9ca3af] hover:text-[#1a1c23] dark:hover:text-[#e4e6eb] transition-colors">
                <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: c.color }} />
                <span className="truncate max-w-[80px]">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="gcard lg:col-span-2">
          <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Recent Alerts</h3>
                <span className="gchip text-[9px]">{recent?.length || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <PulseDot color="#EF843C" />
                <span className="text-[9px] text-[#9ca3af] dark:text-[#6b7280]">60s refresh</span>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-[#9ca3af] dark:text-[#6b7280] border-b border-[#e5e7eb] dark:border-[#2d3140]/50">
                  <th className="text-left py-2.5 px-4 font-medium w-20">Time</th>
                  <th className="text-left py-2.5 px-3 font-medium w-10">Lvl</th>
                  <th className="text-left py-2.5 px-3 font-medium">Rule</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden sm:table-cell">Agent</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden md:table-cell">Description</th>
                  <th className="text-right py-2.5 px-4 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {(recent || []).slice(0, 6).map((r, i) => {
                  const lv = r.rule?.level || 0
                  const badgeCls = lv >= 15 ? 'badge-critical' : lv >= 12 ? 'badge-high' : lv >= 7 ? 'badge-medium' : lv >= 1 ? 'badge-low' : 'badge-info'
                  return (
                    <tr key={i} className={'border-b border-[#e5e7eb]/50 dark:border-[#2d3140]/30 hover:bg-[#f9fafb]/50 dark:hover:bg-[#2d3140]/30 transition-colors group ' + (i % 2 === 0 ? '' : 'bg-[#f9fafb]/30 dark:bg-[#0f1117]/30')}>
                      <td className="py-2.5 px-4 whitespace-nowrap font-mono">
                        <button onClick={() => addDrill('@timestamp', r['@timestamp'] || 'now')} className="text-[#6b7280] dark:text-[#9ca3af] hover:text-[#EF843C] dark:hover:text-[#EF843C] transition-colors text-[10px]">
                          {r['@timestamp'] ? new Date(r['@timestamp']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <button onClick={() => addDrill('rule.level', r.rule?.level)} className={'text-[10px] badge ' + badgeCls + ' hover:opacity-80 transition-opacity'}>
                          {lv || '--'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <button onClick={() => addDrill('rule.id', r.rule?.id)} className="text-[#EF843C] dark:text-[#EF843C] hover:underline truncate max-w-[100px] block">
                          {r.rule?.id || '--'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 hidden sm:table-cell">
                        <button onClick={() => addDrill('agent.name', r.agent?.name)} className="text-[#1a1c23] dark:text-[#e4e6eb] hover:text-[#EF843C] dark:hover:text-[#EF843C] transition-colors truncate max-w-[100px] block">
                          {r.agent?.name || '--'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 hidden md:table-cell">
                        <span className="text-[#6b7280] dark:text-[#9ca3af] truncate max-w-[160px] block text-[10px]">{r.rule?.description || '--'}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <FilterBtn field="_id" value={r._id} label={'alert ' + (i + 1)} />
                      </td>
                    </tr>
                  )
                })}
                {recent.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-[#9ca3af] dark:text-[#6b7280]"><svg className="w-4 h-4 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> No recent alerts</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {drillFilters.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="gcard">
          <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Drill Filters</h3>
                <span className="gchip text-[9px]">{drillFilters.length}</span>
              </div>
              <div className="flex items-center gap-2">
                {drillLoading && <span className="text-[9px] text-[#9ca3af] dark:text-[#6b7280]"><svg className="w-3 h-3 inline animate-spin mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> searching...</span>}
                <button onClick={clearDrills} className="gbtn-ghost text-[10px] text-[#dc2626] dark:text-red-400">Clear All</button>
              </div>
            </div>
          </div>
          <div className="px-4 py-2 flex flex-wrap gap-1.5">
            {drillFilters.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#eff6ff] dark:bg-[#EF843C]/10 border border-[#bfdbfe] dark:border-[#EF843C]/30 text-[10px] text-[#e0752a] dark:text-blue-400">
                <span className="font-medium">{f.field}:</span>
                <span className="truncate max-w-[120px]">{f.value}</span>
                <button onClick={() => removeDrill(i)} className="ml-0.5 hover:text-[#dc2626] transition-colors">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {drillResults !== null && drillFilters.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="gcard">
          <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Drill Results</h3>
              <span className="gchip text-[9px]">{(drillResults?.total || 0).toLocaleString()} total</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-[#9ca3af] dark:text-[#6b7280] border-b border-[#e5e7eb] dark:border-[#2d3140]/50">
                  <th className="text-left py-2.5 px-4 font-medium w-20">Time</th>
                  <th className="text-left py-2.5 px-3 font-medium w-10">Lvl</th>
                  <th className="text-left py-2.5 px-3 font-medium">Rule</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden sm:table-cell">Agent</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden md:table-cell">Description</th>
                  <th className="text-right py-2.5 px-4 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {(drillResults?.results || []).map((r, i) => {
                  const lv = parseInt(r?.rule?.level) || 0
                  const badgeCls = lv >= 15 ? 'badge-critical' : lv >= 12 ? 'badge-high' : lv >= 7 ? 'badge-medium' : lv >= 1 ? 'badge-low' : 'badge-info'
                  return (
                    <tr key={r._id || i} className={'border-b border-[#e5e7eb]/50 dark:border-[#2d3140]/30 hover:bg-[#f9fafb]/50 dark:hover:bg-[#2d3140]/30 transition-colors group ' + (i % 2 === 0 ? '' : 'bg-[#f9fafb]/30 dark:bg-[#0f1117]/30')}>
                      <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                        {r['@timestamp'] ? new Date(r['@timestamp']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <button onClick={() => addDrill('rule.level', r?.rule?.level)} className={'text-[10px] badge ' + badgeCls + ' hover:opacity-80 transition-opacity'}>{lv || '-'}</button>
                      </td>
                      <td className="py-2.5 px-3">
                        <button onClick={() => addDrill('rule.id', r?.rule?.id)} className="text-[#EF843C] dark:text-[#EF843C] hover:underline truncate max-w-[100px] block">{(r?.rule?.id || '').toString()}</button>
                      </td>
                      <td className="py-2.5 px-3 hidden sm:table-cell">
                        <button onClick={() => addDrill('agent.name', r?.agent?.name)} className="text-[#1a1c23] dark:text-[#e4e6eb] hover:text-[#EF843C] dark:hover:text-[#EF843C] transition-colors truncate max-w-[100px] block">{r?.agent?.name || '-'}</button>
                      </td>
                      <td className="py-2.5 px-3 hidden md:table-cell"><span className="text-[#6b7280] dark:text-[#9ca3af] truncate max-w-[180px] block text-[10px]">{r?.rule?.description || r?.rule?.groups?.[0] || ''}</span></td>
                      <td className="py-2.5 px-4 text-right">
                        <button onClick={() => addDrill('_id', r._id)} className="p-1 rounded hover:bg-[#EF843C]/20 text-[#9ca3af] dark:text-[#6b7280] hover:text-[#EF843C] dark:hover:text-[#EF843C] transition-all" title="Filter by this alert">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 7h3.5a.5.5 0 1 1 0 1H8v3.5a.5.5 0 1 1-1 0V8H3.5a.5.5 0 0 1 0-1H7V3.5a.5.5 0 0 1 1 0V7Z"/></svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(!drillResults?.results || drillResults.results.length === 0) && (
              <div className="text-center py-10 text-xs text-[#9ca3af] dark:text-[#6b7280]"><svg className="w-4 h-4 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> No results</div>
            )}
          </div>
        </motion.div>
      )}

      {drillFilters.length === 0 && (
        <div className="flex items-center justify-center py-8 text-xs text-[#9ca3af] dark:text-[#6b7280] gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/></svg>
          Click any widget above to drill down - results appear here
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-[#9ca3af] dark:text-[#6b7280] pt-1">
        <div className="flex items-center gap-3">
          <span><svg className="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Dashboard &middot; Drill-down &middot; 60s refresh</span>
          <span className="hidden sm:inline">Last: {lastUpdated.toLocaleTimeString()}</span>
        </div>
        <button onClick={fetchDashboard} className="gbtn-ghost gap-1 inline-flex items-center">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
          </svg>
          Refresh
        </button>
      </div>
    </div>
  )
}
