import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import { parseDateStr } from '../utils'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts'

const SEV_COLORS = { Critical: '#f85149', High: '#e8681a', Medium: '#d29922', Low: '#3fb950' }
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low']
const CHART_COLORS = ['#EF843C', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#ec4899', '#14b8a6']

const CustomTip = ({ active, payload, label }) => {
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

function toSev(level) {
  const n = parseInt(level) || 0
  if (n >= 12) return 'Critical'
  if (n >= 7) return 'High'
  if (n >= 4) return 'Medium'
  return 'Low'
}

function groupSev(buckets) {
  const map = {}
  for (const b of buckets) { const s = toSev(b.key); map[s] = (map[s] || 0) + b.doc_count }
  return map
}

const INTEL_SECTIONS = ['groups', 'mitigations', 'software', 'tactics', 'techniques']



function countryFlag(code) {
  const map = { CN: '🇨🇳', IR: '🇮🇷', KP: '🇰🇵', CO: '🇨🇴', RU: '🇷🇺' }
  return map[code] ? <span className="mr-1">{map[code]}</span> : null
}

export default function MitreAttackTab() {
  const { isDark, startDate, endDate } = useApp()
  const [view, setView] = useState('dashboard')
  const [intelSection, setIntelSection] = useState('groups')
  const [sectionData, setSectionData] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState(1)
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const pageRef = useRef(1)
  const setPage = n => { pageRef.current = n; setPageState(n) }

  const [evEvents, setEvEvents] = useState([])
  const [evFilterSev, setEvFilterSev] = useState(null)
  const [evFilterTac, setEvFilterTac] = useState(null)
  const [evFilterAgent, setEvFilterAgent] = useState(null)
  const [mitreKnowledge, setMitreKnowledge] = useState({ groups: [], software: [], mitigations: [], tactics: [], techniques: [] })

  const timeParams = useCallback(() => {
    const sd = parseDateStr(startDate).toISOString()
    const ed = parseDateStr(endDate).toISOString()
    return { start_date: sd, end_date: ed }
  }, [startDate, endDate])

  const fetchDashboard = useCallback(async () => {
    try {
      const tp = timeParams()
      const agg = await api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'rule.mitre.tactic', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 20 })
      const aggTech = await api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'rule.mitre.technique', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 20 })
      const count24 = await api('count', { index: 'unishield360-alerts-4.x-*', start_date: tp.start_date, end_date: tp.end_date })
      const byLevel = await api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'rule.level', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 20 })
      const timeline = await api('aggregate', { index: 'unishield360-alerts-4.x-*', field: '@timestamp', type: 'date_histogram', interval: '1h', start_date: tp.start_date, end_date: tp.end_date, limit: 48 })
      const byAgent = await api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'agent.name', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 10 })

      const tacticsBuckets = agg.buckets || []
      const techBuckets = aggTech.buckets || []
      const sevBuckets = byLevel.buckets || []
      const timelineBuckets = timeline.buckets || []
      const agentBuckets = byAgent.buckets || []

      const tacticNames = tacticsBuckets.map(b => ({ name: b.key, count: b.doc_count }))
      tacticNames.sort((a, b) => b.count - a.count)

      const techNames = techBuckets.map(b => ({ name: b.key, count: b.doc_count }))
      techNames.sort((a, b) => b.count - a.count)

      const sevMap = groupSev(sevBuckets)
      const sevData = SEV_ORDER.filter(s => sevMap[s]).map(s => ({ name: s, value: sevMap[s], color: SEV_COLORS[s] }))

      setDashboardData({
        total: count24.count || 0,
        tactics: tacticNames.slice(0, 10),
        techniques: techNames.slice(0, 10),
        severity: sevData,
        timeline: timelineBuckets.map(b => ({ time: new Date(b.key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), alerts: b.doc_count || 0 })),
        agents: agentBuckets.map(b => ({ name: b.key, count: b.doc_count }))
      })
      setError(null)
    } catch (e) {
      setError(e.message)
      setDashboardData(null)
    }
  }, [timeParams])

  const fetchEvents = useCallback(async () => {
    try {
      const tp = timeParams()
      const res = await api('search', { index: 'unishield360-alerts-4.x-*', start_date: tp.start_date, end_date: tp.end_date, q: '*', limit: 100, sort: '@timestamp', order: 'desc' })
      const results = res.results || []
      setEvEvents(results.map(d => ({
        ts: d['@timestamp'] || d.timestamp || '--',
        technique: d.rule?.mitre?.id && d.rule?.mitre?.technique ? `${d.rule.mitre.id} — ${d.rule.mitre.technique}` : (d.rule?.mitre?.id || d.rule?.mitre?.technique || d.rule?.id || '—'),
        tactic: d.rule?.mitre?.tactic || d.rule?.groups?.[0] || '—',
        agent: d.agent?.name || '—',
        severity: toSev(d.rule?.level || 0),
        rule: d.rule?.description || '—',
        _id: d._id
      })))
    } catch {
      setEvEvents([])
    }
  }, [timeParams])

  useEffect(() => {
    api('mitre-data').then(d => {
      if (d?.groups) setMitreKnowledge(d)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchDashboard(), fetchEvents()]).finally(() => setLoading(false))
    const interval = setInterval(() => { fetchDashboard(); fetchEvents() }, 30000)
    return () => clearInterval(interval)
  }, [fetchDashboard, fetchEvents])

  const activeFilters = [evFilterSev, evFilterTac, evFilterAgent].filter(Boolean).length > 0
  const evFiltered = evEvents.filter(e => {
    if (evFilterSev && e.severity !== evFilterSev) return false
    if (evFilterTac && e.tactic !== evFilterTac) return false
    if (evFilterAgent && e.agent !== evFilterAgent) return false
    return true
  })

  const evCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  evEvents.forEach(e => evCounts[e.severity]++)

  const liveTactics = dashboardData?.tactics || []
  const timelineData = dashboardData?.timeline?.slice(-24) || []
  const agentData = dashboardData?.agents?.slice(0, 8) || []

  const setFilter = (type, val) => {
    if (type === 'sev') setEvFilterSev(prev => prev === val ? null : val)
    if (type === 'tac') setEvFilterTac(prev => prev === val ? null : val)
    if (type === 'agent') setEvFilterAgent(prev => prev === val ? null : val)
  }

  const loadSection = useCallback(async (sec) => {
    setLoading(true)
    setSelectedItem(null)
    setSearch('')
    setPage(1)
    setSortKey(null)
    setSortDir(1)
    try {
      const tp = timeParams()
      if (sec === 'tactics' || sec === 'techniques') {
        const field = sec === 'tactics' ? 'rule.mitre.tactic' : 'rule.mitre.technique'
        const agg = await api('aggregate', { index: 'unishield360-alerts-4.x-*', field, type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 50 })
        const buckets = agg.buckets || []

        if (sec === 'tactics') {
          const liveTactics = buckets.map(b => b.key)
          const enriched = (mitreKnowledge.tactics || []).filter(t => liveTactics.includes(t.name) || !liveTactics.length).map(t => ({
            ...t,
            count24: buckets.find(b => b.key === t.name)?.doc_count || 0
          }))
          const extraFromAgg = buckets.filter(b => !mitreKnowledge.tactics.some(t => t.name === b.key)).map(b => ({
            id: `TA-${b.key.replace(/\s+/g, '-')}`, name: b.key, shortDesc: b.key, techniqueCount: b.doc_count, order: 99, count24: b.doc_count
          }))
          setSectionData([...enriched, ...extraFromAgg].sort((a, b) => (b.count24 || b.techniqueCount || 0) - (a.count24 || a.techniqueCount || 0)))
        } else {
          const liveTechs = buckets.map(b => b.key)
          const enriched = (mitreKnowledge.techniques || []).filter(t => liveTechs.includes(t.name)).map(t => ({
            ...t,
            count24: buckets.find(b => b.key === t.name)?.doc_count || 0
          }))
          const extraFromAgg = buckets.filter(b => !mitreKnowledge.techniques.some(t => t.name === b.key)).map(b => ({
            id: `T-${b.key.replace(/\s+/g, '-')}`, name: b.key, tactic: 'Unknown', platforms: [], subCount: 0, count24: b.doc_count, desc: `${b.key} — ${b.doc_count.toLocaleString()} alerts`
          }))
          setSectionData([...enriched, ...extraFromAgg].sort((a, b) => (b.count24 || 0) - (a.count24 || 0)))
        }
      } else {
        setSectionData(mitreKnowledge[sec] || [])
      }
      setError(null)
    } catch {
      setSectionData([])
    }
    setLoading(false)
  }, [timeParams, mitreKnowledge])

  useEffect(() => { loadSection(intelSection) }, [intelSection, loadSection])

  const filteredData = sectionData ? sectionData.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return ['id', 'name', 'countryName', 'type', 'tactic', 'shortDesc'].some(k => String(r[k] || '').toLowerCase().includes(q))
  }) : []

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortKey) return 0
    const av = a[sortKey], bv = b[sortKey]
    if (typeof av === 'number') return (av - bv) * sortDir
    return String(av).localeCompare(String(bv)) * sortDir
  })

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const pg = Math.min(page, totalPages)
  const pageData = sortedData.slice((pg - 1) * pageSize, pg * pageSize)

  const sortBy = (key) => {
    if (sortKey === key) setSortDir(d => -d)
    else { setSortKey(key); setSortDir(1) }
  }

  const COL_DEFS = {
    groups: [
      { key: 'id', label: 'ID', render: r => <span className="font-mono text-[#EF843C] font-bold text-xs">{r.id}</span> },
      { key: 'name', label: 'Name', sort: true, render: r => <span className="font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">{r.name}</span> },
      { key: 'type', label: 'Type' },
      { key: 'countryName', label: 'Country', render: r => <>{countryFlag(r.country)}{r.countryName}</> },
      { key: 'firstSeen', label: 'First Seen', sort: true },
      { key: 'lastSeen', label: 'Last Seen', sort: true },
      { key: 'status', label: 'Status', render: r => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>{r.status}</span> }
    ],
    mitigations: [
      { key: 'id', label: 'ID', render: r => <span className="font-mono text-[#EF843C] font-bold text-xs">{r.id}</span> },
      { key: 'name', label: 'Name', sort: true, render: r => <span className="font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">{r.name}</span> },
      { key: 'domain', label: 'Domain' },
      { key: 'techniquesAddressed', label: 'Techniques', sort: true }
    ],
    software: [
      { key: 'id', label: 'ID', render: r => <span className="font-mono text-[#EF843C] font-bold text-xs">{r.id}</span> },
      { key: 'name', label: 'Name', sort: true, render: r => <span className="font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">{r.name}</span> },
      { key: 'type', label: 'Type' },
      { key: 'platforms', label: 'Platforms', render: r => r.platforms?.join(', ') },
      { key: 'techniquesUsed', label: 'Techniques', sort: true }
    ],
    tactics: [
      { key: 'id', label: 'ID', render: r => <span className="font-mono text-[#EF843C] font-bold text-xs">{r.id}</span> },
      { key: 'name', label: 'Name', sort: true, render: r => <span className="font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">{r.name}</span> },
      { key: 'shortDesc', label: 'Description' },
      { key: 'techniqueCount', label: 'Alerts', sort: true }
    ],
    techniques: [
      { key: 'id', label: 'ID', render: r => <span className="font-mono text-[#EF843C] font-bold text-xs">{r.id}</span> },
      { key: 'name', label: 'Name', sort: true, render: r => <span className="font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">{r.name}</span> },
      { key: 'tactic', label: 'Tactic' },
      { key: 'platforms', label: 'Platforms', render: r => r.platforms?.join(', ') || '—' },
      { key: 'subCount', label: 'Alerts', sort: true }
    ]
  }

  const renderTable = () => {
    const cols = COL_DEFS[intelSection]
    return (
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide">
            {cols.map(c => (
              <th key={c.key} className={`text-left py-2 px-3 border-b border-[#e5e7eb] dark:border-[#2d3140] ${c.sort ? 'cursor-pointer hover:text-[#EF843C]' : ''}`}
                onClick={() => c.sort && sortBy(c.key)}>
                {c.label}
                {c.sort && sortKey === c.key && <span className="ml-1">{sortDir > 0 ? '↑' : '↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageData.map((r, i) => (
            <tr key={r.id || i}
              onClick={() => setSelectedItem(r)}
              className={`cursor-pointer transition-colors hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] ${selectedItem?.id === r.id ? 'bg-[#EF843C]/5 ring-1 ring-inset ring-[#EF843C]/30' : ''}`}>
              {cols.map(c => (
                <td key={c.key} className="py-2 px-3 border-b border-[#f0f2f4] dark:border-[#21262d]">
                  {c.render ? c.render(r) : r[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
          {pageData.length === 0 && (
            <tr><td colSpan={cols.length} className="text-center py-8 text-[#8b949e]">No results found</td></tr>
          )}
        </tbody>
      </table>
    )
  }

  const renderDetail = () => {
    const item = selectedItem
    if (!item) return (
      <div className="flex-1 flex items-center justify-center text-[#8b949e] text-sm">
        <div className="text-center"><svg className="w-8 h-8 mx-auto mb-2 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Select an item to view details</div>
      </div>
    )

    if (intelSection === 'groups') return (
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        <div className="flex items-center justify-between"><span className="font-mono text-[#EF843C] font-bold">{item.id}</span><button onClick={() => setSelectedItem(null)} className="text-[#8b949e] hover:text-[#EF843C]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
        <div className="flex items-center gap-2"><span className="font-bold text-[#1a1c23] dark:text-[#e4e6eb]">{item.name}</span><span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${item.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{item.status}</span></div>
        <p className="text-[#6b7280] dark:text-[#9ca3af] leading-relaxed">{item.desc}</p>
        <div className="grid grid-cols-2 gap-2"><span className="text-[#8b949e]">Type:</span><span className="font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">{item.type}</span><span className="text-[#8b949e]">Country:</span><span className="font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">{item.countryName}</span><span className="text-[#8b949e]">First Seen:</span><span className="font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">{item.firstSeen}</span><span className="text-[#8b949e]">Last Seen:</span><span className="font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">{item.lastSeen}</span></div>
        <div><span className="text-[#8b949e] text-[10px] font-bold uppercase tracking-wide">Software</span><div className="flex flex-wrap gap-1 mt-1">{item.software?.map(s => <span key={s} className="px-1.5 py-0.5 bg-[#f3f4f6] dark:bg-[#2d3140] rounded text-[10px]">{s}</span>) || '—'}</div></div>
        <div><span className="text-[#8b949e] text-[10px] font-bold uppercase tracking-wide">Target Sectors</span><div className="flex flex-wrap gap-1 mt-1">{item.sectors?.map(s => <span key={s} className="px-1.5 py-0.5 bg-[#fdeee3] text-[#EF843C] dark:bg-[#EF843C]/10 rounded text-[10px] font-semibold">{s}</span>) || '—'}</div></div>
        <div><span className="text-[#8b949e] text-[10px] font-bold uppercase tracking-wide">Confidence</span><div className="flex items-center gap-2 mt-1"><div className="flex-1 h-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#EF843C] to-[#ff7b2e]" style={{ width: item.confidence + '%' }} /></div><span className="font-bold text-[#1a1c23] dark:text-[#e4e6eb] text-xs">{item.confidence}%</span></div></div>
        <div><span className="text-[#8b949e] text-[10px] font-bold uppercase tracking-wide">Notes</span><p className="mt-1 text-[#6b7280] dark:text-[#9ca3af]">{item.notes || 'No notes'}</p></div>
      </div>
    )
    if (intelSection === 'mitigations') return (
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        <div className="flex items-center justify-between"><span className="font-mono text-[#EF843C] font-bold">{item.id}</span><button onClick={() => setSelectedItem(null)} className="text-[#8b949e] hover:text-[#EF843C]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
        <div className="font-bold text-[#1a1c23] dark:text-[#e4e6eb]">{item.name}</div>
        <p className="text-[#6b7280] dark:text-[#9ca3af] leading-relaxed">{item.desc}</p>
        <div className="grid grid-cols-2 gap-2"><span className="text-[#8b949e]">Domain:</span><span className="font-semibold">{item.domain}</span><span className="text-[#8b949e]">Coverage:</span><span className="font-semibold">{item.techniquesAddressed} techniques</span></div>
      </div>
    )
    if (intelSection === 'software') return (
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        <div className="flex items-center justify-between"><span className="font-mono text-[#EF843C] font-bold">{item.id}</span><button onClick={() => setSelectedItem(null)} className="text-[#8b949e] hover:text-[#EF843C]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
        <div className="flex items-center gap-2"><span className="font-bold text-[#1a1c23] dark:text-[#e4e6eb]">{item.name}</span><span className="px-1.5 py-0.5 bg-[#f3f4f6] dark:bg-[#2d3140] rounded text-[10px]">{item.type}</span></div>
        <p className="text-[#6b7280] dark:text-[#9ca3af] leading-relaxed">{item.desc}</p>
        <div><span className="text-[#8b949e] text-[10px] font-bold uppercase tracking-wide">Platforms</span><div className="flex flex-wrap gap-1 mt-1">{item.platforms?.map(p => <span key={p} className="px-1.5 py-0.5 bg-[#f3f4f6] dark:bg-[#2d3140] rounded text-[10px]">{p}</span>) || '—'}</div></div>
        <div><span className="text-[#8b949e] text-[10px] font-bold uppercase tracking-wide">Used By</span><div className="flex flex-wrap gap-1 mt-1">{item.groupsUsing?.length ? item.groupsUsing.map(g => <span key={g} className="px-1.5 py-0.5 bg-[#fdeee3] text-[#EF843C] dark:bg-[#EF843C]/10 rounded text-[10px] font-semibold">{g}</span>) : <span className="text-[#8b949e]">No known groups</span>}</div></div>
      </div>
    )
    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        <div className="flex items-center justify-between"><span className="font-mono text-[#EF843C] font-bold">{item.id}</span><button onClick={() => setSelectedItem(null)} className="text-[#8b949e] hover:text-[#EF843C]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
        <div className="font-bold text-[#1a1c23] dark:text-[#e4e6eb]">{item.name}</div>
        <p className="text-[#6b7280] dark:text-[#9ca3af] leading-relaxed">{item.shortDesc || item.desc}</p>
        <div className="grid grid-cols-2 gap-2">
          {item.order ? <><span className="text-[#8b949e]">Order:</span><span className="font-semibold">Stage {item.order} of 14</span></> : null}
          {item.tactic ? <><span className="text-[#8b949e]">Tactic:</span><span className="font-semibold">{item.tactic}</span></> : null}
          {item.techniqueCount ? <><span className="text-[#8b949e]">Techniques:</span><span className="font-semibold">{item.techniqueCount} mapped</span></> : <><span className="text-[#8b949e]">Alerts (24h):</span><span className="font-semibold">{(item.count24 ?? item.subCount)?.toLocaleString() || '—'}</span></>}
          {item.platforms ? <><span className="text-[#8b949e]">Platforms:</span><span className="font-semibold">{Array.isArray(item.platforms) ? item.platforms.join(', ') : item.platforms}</span></> : null}
        </div>
      </div>
    )
  }

  if (loading && !dashboardData) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 p-2">
      <div className="flex gap-2"><div className="h-8 w-32 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-lg animate-pulse" /></div>
      <div className="grid grid-cols-4 gap-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-lg animate-pulse" />)}</div>
      <div className="grid grid-cols-2 gap-3">{[1, 2].map(i => <div key={i} className="h-48 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-lg animate-pulse" />)}</div>
    </motion.div>
  )

  if (error && !dashboardData) return (
    <div className="p-6 text-center">
      <svg className="w-8 h-8 mx-auto mb-2 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div className="text-xs text-[#dc2626] mb-3">{error}</div>
      <button onClick={() => { fetchDashboard(); fetchEvents() }} className="px-3 py-1.5 text-xs font-bold text-white bg-[#EF843C] rounded-lg hover:bg-[#e0752a]">Retry</button>
    </div>
  )

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <div className="flex items-center gap-2 border-b border-[#e5e7eb] dark:border-[#2a3042] pb-2">
        {[{ k: 'dashboard', l: 'Dashboard' }, { k: 'intelligence', l: 'Intelligence' }, { k: 'framework', l: 'Framework' }, { k: 'events', l: 'Events' }].map(t => (
          <button key={t.k} onClick={() => { setView(t.k); if (t.k !== 'intelligence') setSelectedItem(null) }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${view === t.k ? 'bg-[#EF843C] text-white shadow-md' : 'text-[#5f6368] dark:text-[#9aa0b0] hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042]'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {view === 'dashboard' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-bold text-[#1a1c23] dark:text-[#e4e6eb]">Alerts evolution over time</h3>
              <i className="text-[#8b949e] text-[10px] ti ti-info-circle" />
            </div>
            <div className="flex gap-4 items-center">
              <div className="flex-1 h-[200px]">
                {timelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={timelineData}>
                      <defs><linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#EF843C" stopOpacity={0.3} /><stop offset="95%" stopColor="#EF843C" stopOpacity={0} /></linearGradient></defs>
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTip />} />
                      <Area type="monotone" dataKey="alerts" stroke="#EF843C" fill="url(#colorAlerts)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div className="h-[200px] flex items-center justify-center text-[#8b949e] text-xs">No timeline data</div>}
              </div>
              <div className="w-40 space-y-1 text-xs text-[#6b7280] dark:text-[#9ca3af]">
                {(dashboardData?.techniques || []).slice(0, 5).map((t, i) => (
                  <div key={t.name} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="truncate">{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-bold text-[#1a1c23] dark:text-[#e4e6eb]">Top tactics</h3>
                <i className="text-[#8b949e] text-[10px] ti ti-info-circle" />
              </div>
              <div className="flex gap-4 items-center">
                <div className="w-[180px] h-[180px] shrink-0">
                  {liveTactics.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={liveTactics.slice(0, 6)} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="count" nameKey="name"
                          stroke={isDark ? '#161b22' : '#ffffff'} strokeWidth={3}>
                          {liveTactics.slice(0, 6).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="h-[180px] flex items-center justify-center text-[#8b949e] text-xs">No data</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="text-[#8b949e] font-semibold">
                        <th className="text-left pb-1 pr-2">Tactic</th>
                        <th className="text-right pb-1 pr-2">Count</th>
                        <th className="text-right pb-1">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveTactics.slice(0, 6).map((t, i) => {
                        const pct = liveTactics[0]?.count ? Math.round((t.count / liveTactics[0].count) * 100) : 0
                        return (
                          <tr key={t.name} className="cursor-pointer hover:bg-[#f9fafb] dark:hover:bg-[#21262d]"
                            onClick={() => { setView('events'); setEvFilterTac(t.name) }}>
                            <td className="py-1 pr-2 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <span className="font-semibold text-[#1a1c23] dark:text-[#e4e6eb] truncate">{t.name}</span>
                            </td>
                            <td className="text-right pr-2 font-semibold">{t.count.toLocaleString()}</td>
                            <td className="text-right text-[#8b949e]">{pct}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#e5e7eb] dark:border-[#2d3140]">
                        <td className="pt-2 font-bold text-[#1a1c23] dark:text-[#e4e6eb]">Total</td>
                        <td className="text-right pt-2 font-bold">{liveTactics.reduce((s, t) => s + t.count, 0).toLocaleString()}</td>
                        <td className="text-right pt-2 text-[#8b949e]">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-bold text-[#1a1c23] dark:text-[#e4e6eb]">Attacks by technique</h3>
                <i className="text-[#8b949e] text-[10px] ti ti-info-circle" />
              </div>
              <div className="flex gap-4 items-center">
                <div className="flex-1 h-[200px]">
                  {(dashboardData?.techniques || []).length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={(dashboardData?.techniques || []).slice(0, 8)} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} width={90} />
                        <Tooltip content={<CustomTip />} />
                        <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                          {(dashboardData?.techniques || []).slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-[200px] flex items-center justify-center text-[#8b949e] text-xs">No technique data</div>}
                </div>
                <div className="w-36 space-y-1 text-xs text-[#6b7280] dark:text-[#9ca3af] shrink-0">
                  {(dashboardData?.techniques || []).slice(0, 5).map((t, i) => (
                    <div key={t.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="truncate">{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-bold text-[#1a1c23] dark:text-[#e4e6eb]">Top tactics by agent</h3>
                <i className="text-[#8b949e] text-[10px] ti ti-info-circle" />
              </div>
              <div className="flex gap-4 items-center">
                <div className="flex-1 h-[200px]">
                  {agentData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={agentData}>
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTip />} />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                          {agentData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-[200px] flex items-center justify-center text-[#8b949e] text-xs">No agent data</div>}
                </div>
                <div className="w-36 space-y-1 text-xs text-[#6b7280] dark:text-[#9ca3af] shrink-0">
                  {agentData.slice(0, 5).map((a, i) => (
                    <div key={a.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="truncate">{a.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-bold text-[#1a1c23] dark:text-[#e4e6eb]">Mitre techniques by agent</h3>
                <i className="text-[#8b949e] text-[10px] ti ti-info-circle" />
              </div>
              <div className="flex gap-4 items-center">
                <div className="w-[180px] h-[180px] shrink-0">
                  {agentData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={agentData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="count" nameKey="name"
                          stroke={isDark ? '#161b22' : '#ffffff'} strokeWidth={3}>
                          {agentData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="h-[180px] flex items-center justify-center text-[#8b949e] text-xs">No data</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="text-[#8b949e] font-semibold">
                        <th className="text-left pb-1 pr-2">Agent</th>
                        <th className="text-right pb-1 pr-2">Count</th>
                        <th className="text-right pb-1">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentData.slice(0, 6).map((a, i) => {
                        const total = agentData.reduce((s, a) => s + a.count, 0)
                        const pct = total ? Math.round((a.count / total) * 100) : 0
                        return (
                          <tr key={a.name} className="cursor-pointer hover:bg-[#f9fafb] dark:hover:bg-[#21262d]"
                            onClick={() => { setView('events'); setEvFilterAgent(a.name) }}>
                            <td className="py-1 pr-2 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <span className="font-semibold text-[#1a1c23] dark:text-[#e4e6eb] truncate">{a.name}</span>
                            </td>
                            <td className="text-right pr-2 font-semibold">{a.count.toLocaleString()}</td>
                            <td className="text-right text-[#8b949e]">{pct}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#e5e7eb] dark:border-[#2d3140]">
                        <td className="pt-2 font-bold text-[#1a1c23] dark:text-[#e4e6eb]">Total</td>
                        <td className="text-right pt-2 font-bold">{agentData.reduce((s, a) => s + a.count, 0).toLocaleString()}</td>
                        <td className="text-right pt-2 text-[#8b949e]">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'intelligence' && (
        <div className="flex gap-3 h-[calc(100vh-220px)]">
          <div className="w-40 shrink-0 space-y-0.5">
            {INTEL_SECTIONS.map(s => (
              <button key={s} onClick={() => { setIntelSection(s); setSelectedItem(null) }}
                className={`w-full text-left px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${intelSection === s ? 'bg-[#EF843C]/10 text-[#EF843C] font-bold' : 'text-[#5f6368] dark:text-[#9aa0b0] hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042]'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex-1 bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl overflow-hidden flex flex-col shadow-sm">
            <div className="p-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8b949e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search by name, id..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg text-[#1a1c23] dark:text-[#e4e6eb] outline-none focus:border-[#EF843C]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">{renderTable()}</div>
            <div className="flex items-center justify-between px-3 py-2 border-t border-[#e5e7eb] dark:border-[#2d3140] bg-[#f6f8fa] dark:bg-[#0d1117]">
              <span className="text-[10px] text-[#8b949e]">{sortedData.length} items</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={pg === 1} className="px-1.5 py-0.5 text-[10px] border border-[#e5e7eb] dark:border-[#2d3140] rounded disabled:opacity-30 bg-white dark:bg-[#16181f]"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg></button>
                <button onClick={() => setPage(pg - 1)} disabled={pg === 1} className="px-1.5 py-0.5 text-[10px] border border-[#e5e7eb] dark:border-[#2d3140] rounded disabled:opacity-30 bg-white dark:bg-[#16181f]"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
                <span className="text-[10px] text-[#8b949e] px-1">{pg}/{totalPages}</span>
                <button onClick={() => setPage(pg + 1)} disabled={pg === totalPages} className="px-1.5 py-0.5 text-[10px] border border-[#e5e7eb] dark:border-[#2d3140] rounded disabled:opacity-30 bg-white dark:bg-[#16181f]"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>
                <button onClick={() => setPage(totalPages)} disabled={pg === totalPages} className="px-1.5 py-0.5 text-[10px] border border-[#e5e7eb] dark:border-[#2d3140] rounded disabled:opacity-30 bg-white dark:bg-[#16181f]"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg></button>
              </div>
            </div>
          </div>
          <div className="w-72 shrink-0 bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl overflow-hidden flex flex-col shadow-sm">
            <div className="px-3 py-2 border-b border-[#e5e7eb] dark:border-[#2d3140] bg-[#f6f8fa] dark:bg-[#0d1117]">
              <span className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider">Details</span>
            </div>
            {renderDetail()}
          </div>
        </div>
      )}

      {view === 'framework' && (
        <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-sm overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <div><h3 className="text-sm font-bold text-[#1a1c23] dark:text-[#e4e6eb]">MITRE ATT&CK Framework</h3><p className="text-[10px] text-[#8b949e]">Tactics × Techniques coverage matrix</p></div>
            <div className="flex items-center gap-3 text-[10px] text-[#8b949e]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#e5e7eb] dark:border-[#2d3140]" />None</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: 'color-mix(in srgb, #EF843C 10%, #f6f8fa)' }} />Low</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: 'color-mix(in srgb, #EF843C 25%, #f6f8fa)' }} />Med</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: 'color-mix(in srgb, #EF843C 40%, #f6f8fa)' }} />High</span>
            </div>
          </div>
          <div className="flex gap-1.5 min-w-max">
            {(mitreKnowledge.tactics || []).sort((a, b) => a.order - b.order).map(tac => {
              const relTechs = (mitreKnowledge.techniques || []).filter(t => t.tactic === tac.name)
              const cells = relTechs.length ? relTechs.slice(0, 5) : []
              const heatClass = (sub) => sub >= 6 ? 'bg-[#EF843C]/30 border-[#EF843C]/60' : sub >= 3 ? 'bg-[#EF843C]/15 border-[#EF843C]/40' : sub > 0 ? 'bg-[#EF843C]/8 border-[#EF843C]/25' : ''
              return (
                <div key={tac.id || tac.name} className="w-36 shrink-0">
                  <div className="bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#e5e7eb] dark:border-[#2d3140] rounded-t-lg px-2 py-1.5 text-center">
                    <div className="text-[10px] font-bold text-[#1a1c23] dark:text-[#e4e6eb]">{tac.name}</div>
                    <div className="text-[8px] text-[#8b949e]">{tac.techniqueCount || 0} techniques</div>
                  </div>
                  {cells.length > 0 ? cells.map(t => (
                    <div key={t.id || t.name} onClick={() => { setView('intelligence'); setIntelSection('techniques'); setTimeout(() => { setSearch(t.name.split(' ')[0]) }, 100) }}
                      className={`border border-[#e5e7eb] dark:border-[#2d3140] border-t-0 px-2 py-1 text-[10px] text-[#1a1c23] dark:text-[#e4e6eb] cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] transition-colors ${heatClass(t.subCount || 0)}`}>
                      {t.name}
                      {(t.subCount || 0) > 0 && <span className="ml-1 text-[8px] text-[#8b949e] font-bold">{t.subCount}</span>}
                    </div>
                  )) : <div className="border border-[#e5e7eb] dark:border-[#2d3140] border-t-0 px-2 py-4 text-center text-[8px] text-[#8b949e]">No techniques</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'events' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1a1c23] dark:text-[#e4e6eb]">MITRE ATT&CK Events ({evEvents.length})</h3>
            <button onClick={() => { fetchEvents() }} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg hover:border-[#EF843C] hover:text-[#EF843C]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Refresh
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {[{ k: 'critical', l: 'Critical', c: '#f85149' }, { k: 'high', l: 'High', c: '#e8681a' }, { k: 'medium', l: 'Medium', c: '#d29922' }, { k: 'low', l: 'Low', c: '#3fb950' }].map(s => (
              <button key={s.k} onClick={() => setFilter('sev', s.k)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${evFilterSev === s.k ? 'ring-2 ring-offset-1' : ''}`}
                style={{ background: `${s.c}15`, borderColor: `${s.c}40`, color: s.c, ...(evFilterSev === s.k ? { ringColor: s.c } : {}) }}>
                {s.l}: {evCounts[s.k]} {evFilterSev === s.k && '✕'}
              </button>
            ))}
            <button onClick={() => { setEvFilterSev(null); setEvFilterTac(null); setEvFilterAgent(null) }}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${activeFilters ? 'bg-[#EF843C]/10 border-[#EF843C]/40 text-[#EF843C]' : 'text-[#8b949e] border-[#e5e7eb] dark:border-[#2d3140]'}`}>
              {activeFilters ? 'Clear filters' : 'All events'}
            </button>
          </div>

          {activeFilters && (
            <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 bg-[#f6f8fa] dark:bg-[#0d1117] rounded-lg border border-[#e5e7eb] dark:border-[#2d3140]">
              <span className="text-[9px] font-bold text-[#8b949e] uppercase">Active:</span>
              {evFilterSev && <span onClick={() => setFilter('sev', evFilterSev)} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer" style={{ background: SEV_COLORS[evFilterSev.charAt(0).toUpperCase() + evFilterSev.slice(1)] + '20', color: SEV_COLORS[evFilterSev.charAt(0).toUpperCase() + evFilterSev.slice(1)] }}>Severity: {evFilterSev} <span className="text-xs">✕</span></span>}
              {evFilterTac && <span onClick={() => setFilter('tac', evFilterTac)} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">Tactic: {evFilterTac} <span className="text-xs">✕</span></span>}
              {evFilterAgent && <span onClick={() => setFilter('agent', evFilterAgent)} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">Agent: {evFilterAgent} <span className="text-xs">✕</span></span>}
            </div>
          )}

          <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl overflow-hidden shadow-sm">
            {evFiltered.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide bg-[#f6f8fa] dark:bg-[#0d1117]">
                      <th className="text-left py-2 px-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">Timestamp</th>
                      <th className="text-left py-2 px-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">Technique</th>
                      <th className="text-left py-2 px-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">Tactic</th>
                      <th className="text-left py-2 px-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">Agent</th>
                      <th className="text-left py-2 px-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">Severity</th>
                      <th className="text-left py-2 px-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">Rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evFiltered.map((e, i) => (
                      <tr key={e._id || i} className="border-b border-[#f0f2f4] dark:border-[#21262d] hover:bg-[#f9fafb] dark:hover:bg-[#2d3140]/30 transition-colors">
                        <td className="py-2 px-3 font-mono text-[10px] text-[#8b949e]">{new Date(e.ts).toLocaleString()}</td>
                        <td className="py-2 px-3 font-medium text-[#1a1c23] dark:text-[#e4e6eb] cursor-pointer hover:text-[#EF843C]" onClick={() => { setView('intelligence'); setIntelSection('techniques'); setTimeout(() => setSearch(e.technique.split('—')[0]?.trim() || ''), 100) }}>{e.technique}</td>
                        <td className="py-2 px-3"><span onClick={() => setFilter('tac', e.tactic)} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50">{e.tactic}</span></td>
                        <td className="py-2 px-3"><span onClick={() => setFilter('agent', e.agent)} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-900/50">{e.agent}</span></td>
                        <td className="py-2 px-3"><span onClick={() => setFilter('sev', e.severity)} className="px-1.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer" style={{ background: SEV_COLORS[e.severity.charAt(0).toUpperCase() + e.severity.slice(1)] + '20', color: SEV_COLORS[e.severity.charAt(0).toUpperCase() + e.severity.slice(1)] }}>{e.severity}</span></td>
                        <td className="py-2 px-3 text-[#6b7280] dark:text-[#9ca3af] max-w-[200px] truncate">{e.rule}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-30 text-[#8b949e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <p className="text-sm text-[#8b949e]">{evEvents.length === 0 ? 'No MITRE-tagged events from API' : 'No events match current filters'}</p>
                {activeFilters && <button onClick={() => { setEvFilterSev(null); setEvFilterTac(null); setEvFilterAgent(null) }} className="mt-2 px-3 py-1 text-xs font-bold border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg hover:border-[#EF843C] hover:text-[#EF843C]">Clear filters</button>}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
