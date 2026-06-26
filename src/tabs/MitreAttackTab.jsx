import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import DateRangePicker from '../components/DateRangePicker'
import { parseDateStr } from '../utils'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts'
import InlineFilter from '../components/InlineFilter'

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
  const [evTotal, setEvTotal] = useState(0)
  const evOffsetRef = useRef(0)
  const evEventsRef = useRef([])
  const [evLoadingMore, setEvLoadingMore] = useState(false)
  const [evTimeline, setEvTimeline] = useState([])
  const [evTimelineLoading, setEvTimelineLoading] = useState(false)
  const [evPage, setEvPage] = useState(1)
  const EV_PAGE_SIZE = 10
  const [filters, setFilters] = useState({})
  const [excludes, setExcludes] = useState({})
  const [expandedRow, setExpandedRow] = useState({})
  const [jsonView, setJsonView] = useState({})

  const toggleRow = useCallback((id) => {
    setExpandedRow(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const flattenDoc = useCallback((obj, prefix) => {
    prefix = prefix || ''
    if (obj === null || obj === undefined) return [{ path: prefix || 'value', value: null }]
    if (typeof obj !== 'object') return [{ path: prefix || 'value', value: obj }]
    if (Array.isArray(obj)) {
      if (!obj.length) return [{ path: prefix || 'value', value: '' }]
      if (obj.every(v => v === null || v === undefined || typeof v !== 'object'))
        return [{ path: prefix || 'value', value: obj.join(', ') }]
      return [{ path: prefix || 'value', value: JSON.stringify(obj) }]
    }
    let result = []
    for (const k of Object.keys(obj)) {
      if (k.startsWith('_') && k !== '_frameworks') continue
      const p = prefix ? prefix + '.' + k : k
      result = result.concat(flattenDoc(obj[k], p))
    }
    return result
  }, [])
  const [mitreKnowledge, setMitreKnowledge] = useState({ groups: [], software: [], mitigations: [], tactics: [], techniques: [] })
  const [fwData, setFwData] = useState(null)
  const [fwSelectedTactics, setFwSelectedTactics] = useState([])
  const [fwSearch, setFwSearch] = useState('')
  const [fwHideEmpty, setFwHideEmpty] = useState(false)
  const [fwContextTech, setFwContextTech] = useState(null)
  const fwContextRef = useRef(null)
  const [dashboardTechnique, setDashboardTechnique] = useState(null)

  const timeParams = useCallback(() => {
    const sd = parseDateStr(startDate).toISOString()
    const ed = parseDateStr(endDate).toISOString()
    return { start_date: sd, end_date: ed }
  }, [startDate, endDate])

  const fetchDashboard = useCallback(async () => {
    try {
      const tp = timeParams()
      const qFilter = dashboardTechnique ? { q: `rule.mitre.technique:"${dashboardTechnique}"` } : {}
      const agg = await api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'rule.mitre.tactic', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 20, ...qFilter })
      const aggTech = await api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'rule.mitre.technique', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 20, ...qFilter })
      const count24 = await api('count', { index: 'unishield360-alerts-4.x-*', start_date: tp.start_date, end_date: tp.end_date, ...qFilter })
      const byLevel = await api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'rule.level', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 20, ...qFilter })
      const timeline = await api('aggregate', { index: 'unishield360-alerts-4.x-*', field: '@timestamp', type: 'date_histogram', interval: '1h', start_date: tp.start_date, end_date: tp.end_date, limit: 48, ...qFilter })
      const byAgent = await api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'agent.name', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 10, ...qFilter })

      const tacticsBuckets = agg.buckets || []
      const techBuckets = aggTech.buckets || []
      const sevBuckets = byLevel.buckets || []
      const timelineBuckets = timeline.buckets || []
      const agentBuckets = byAgent.buckets || []

      const liveTacKeys = tacticsBuckets.map(b => b.key)
      const enrichedTacs = (mitreKnowledge.tactics || []).filter(t => liveTacKeys.includes(t.name)).map(t => ({
        name: t.name, count: tacticsBuckets.find(b => b.key === t.name)?.doc_count || 0
      }))
      const extraTacs = tacticsBuckets.filter(b => !mitreKnowledge.tactics?.some(t => t.name === b.key)).map(b => ({
        name: b.key, count: b.doc_count
      }))
      const tacticNames = [...enrichedTacs, ...extraTacs].sort((a, b) => b.count - a.count)

      const liveTechs = techBuckets.map(b => b.key)
      const enrichedTechs = (mitreKnowledge.techniques || []).filter(t => liveTechs.includes(t.name)).map(t => ({
        name: t.name, count: techBuckets.find(b => b.key === t.name)?.doc_count || 0
      }))
      const extraTechs = techBuckets.filter(b => !mitreKnowledge.techniques?.some(t => t.name === b.key)).map(b => ({
        name: b.key, count: b.doc_count
      }))
      const techNames = [...enrichedTechs, ...extraTechs].sort((a, b) => b.count - a.count)

      const sevMap = groupSev(sevBuckets)
      const sevData = SEV_ORDER.filter(s => sevMap[s]).map(s => ({ name: s, value: sevMap[s], color: SEV_COLORS[s] }))

      const topTechs = techNames.slice(0, 5)
      const techTimelinePromises = topTechs.map(tech =>
        api('aggregate', {
          index: 'unishield360-alerts-4.x-*', field: '@timestamp', type: 'date_histogram', interval: '1h',
          q: `rule.mitre.technique:"${tech.name}"`,
          start_date: tp.start_date, end_date: tp.end_date, limit: 48
        }).catch(() => ({ buckets: [] }))
      )
      const techTimelineResponses = await Promise.all(techTimelinePromises)

      const baseTimeline = timelineBuckets.map(b => ({
        time: new Date(b.key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        alerts: b.doc_count || 0
      }))
      topTechs.forEach((tech, idx) => {
        const buckets = techTimelineResponses[idx].buckets || []
        const bucketMap = {}
        buckets.forEach(b => {
          const t = new Date(b.key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          bucketMap[t] = b.doc_count || 0
        })
        baseTimeline.forEach(item => { item[`tech_${idx}`] = bucketMap[item.time] || 0 })
      })

      setDashboardData({
        total: count24.count || 0,
        tactics: tacticNames.slice(0, 10),
        techniques: techNames.slice(0, 10),
        severity: sevData,
        timeline: baseTimeline,
        agents: agentBuckets.map(b => ({ name: b.key, count: b.doc_count })),
        topTechNames: topTechs.map(t => t.name)
      })
      setError(null)
    } catch (e) {
      setError(e.message)
      setDashboardData(null)
    }
  }, [timeParams, mitreKnowledge, dashboardTechnique])

  const fetchFrameworkData = useCallback(async () => {
    try {
      const tp = timeParams()
      const [tacAgg, techIdAgg, techNameAgg] = await Promise.all([
        api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'rule.mitre.tactic', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 50 }),
        api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'rule.mitre.id', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 200 }),
        api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'rule.mitre.technique', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 200 })
      ])
      const tacBuckets = tacAgg.buckets || []

      const idCount = {}; (techIdAgg.buckets || []).forEach(b => { idCount[b.key] = b.doc_count })
      const nameCount = {}; (techNameAgg.buckets || []).forEach(b => { nameCount[b.key] = b.doc_count })

      const allTactics = (mitreKnowledge.tactics || []).map(t => ({
        ...t,
        count: tacBuckets.find(b => b.key === t.name)?.doc_count || 0
      }))
      const extraTacs = tacBuckets.filter(b => !mitreKnowledge.tactics?.some(t => t.name === b.key)).map(b => ({
        id: `TA-${b.key.replace(/\s+/g, '-')}`, name: b.key, count: b.doc_count, order: 99
      }))
      const fwTactics = [...allTactics, ...extraTacs].sort((a, b) => (b.count || 0) - (a.count || 0))

      const seenKeys = new Set()
      const allTechniques = (mitreKnowledge.techniques || []).map(t => {
        const count = idCount[t.id] || nameCount[t.name] || 0
        if (count > 0) seenKeys.add(t.id)
        return { ...t, count }
      })

      const extraFromId = (techIdAgg.buckets || []).filter(b => !seenKeys.has(b.key) && !mitreKnowledge.techniques?.some(t => t.id === b.key)).map(b => {
        const nameMatch = (mitreKnowledge.techniques || []).find(t => t.id === b.key)
        return nameMatch ? { ...nameMatch, count: b.doc_count } : null
      }).filter(Boolean)
      extraFromId.forEach(e => seenKeys.add(e.id))

      const extraFromName = (techNameAgg.buckets || []).filter(b => !seenKeys.has(b.key) && !mitreKnowledge.techniques?.some(t => t.name === b.key || t.id === b.key)).map(b => ({
        id: b.key, name: b.key, tactic: 'Unknown', count: b.doc_count
      }))

      const extraTechsLookup = {}
      ;[...extraFromId, ...extraFromName].forEach(e => {
        const k = e.id || e.name
        if (!extraTechsLookup[k] || e.count > extraTechsLookup[k].count) extraTechsLookup[k] = e
      })
      const fwTechniques = [...allTechniques, ...Object.values(extraTechsLookup)]

      setFwData({ tactics: fwTactics, techniques: fwTechniques })
      setFwSelectedTactics(prev => prev.filter(p => fwTactics.some(t => t.name === p)))
    } catch (e) {
      console.error('fetchFrameworkData error:', e)
      setFwData(null)
    }
  }, [timeParams, mitreKnowledge])

  const fetchEvents = useCallback(async (append) => {
    try {
      const tp = timeParams()
      const offset = append ? evOffsetRef.current : 0
      const limit = 500
      if (append) setEvLoadingMore(true)
      const [res, timelineRes] = await Promise.all([
        api('search', { index: 'unishield360-alerts-4.x-*', start_date: tp.start_date, end_date: tp.end_date, q: '_exists_:rule.mitre.id', limit, offset, sort: '@timestamp', order: 'desc' }),
        !append ? api('aggregate', { index: 'unishield360-alerts-4.x-*', field: '@timestamp', type: 'date_histogram', interval: '1h', start_date: tp.start_date, end_date: tp.end_date, limit: 48, q: '_exists_:rule.mitre.id' }) : Promise.resolve(null)
      ])
      const results = res.results || []
      const total = typeof res.total === 'object' ? res.total.value : (res.total || 0)
      const mapped = results.map(d => ({
        ts: d['@timestamp'] || d.timestamp || '--',
        technique: d.rule?.mitre?.id && d.rule?.mitre?.technique ? `${d.rule.mitre.id} — ${d.rule.mitre.technique}` : (d.rule?.mitre?.id || d.rule?.mitre?.technique || d.rule?.id || '—'),
        tactic: d.rule?.mitre?.tactic || d.rule?.groups?.[0] || '—',
        agent: d.agent?.name || '—',
        severity: toSev(d.rule?.level || 0),
        rule: d.rule?.description || '—',
        _id: d._id,
        raw: d
      }))
      if (append) {
        const existingIds = new Set(evEventsRef.current.map(e => e._id))
        const newOnes = mapped.filter(e => !existingIds.has(e._id))
        setEvEvents(prev => { const next = [...prev, ...newOnes]; evEventsRef.current = next; return next })
        evOffsetRef.current += newOnes.length
      } else {
        setEvEvents(mapped)
        evEventsRef.current = mapped
        evOffsetRef.current = mapped.length
        if (timelineRes?.buckets) {
          setEvTimeline(timelineRes.buckets.map(b => ({
            time: new Date(b.key).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            ts: b.key,
            alerts: b.doc_count || 0
          })))
        }
      }
      setEvTotal(total)
    } catch {
      if (!append) setEvEvents([])
    } finally {
      setEvLoadingMore(false)
    }
  }, [timeParams])

  const handleRefresh = useCallback(() => {
    setLoading(true)
    Promise.all([fetchDashboard(), fetchEvents()]).finally(() => setLoading(false))
  }, [fetchDashboard, fetchEvents])

  const fetchTechniqueDashboard = useCallback(async (techName, techId) => {
    try {
      setLoading(true)
      const tp = timeParams()
      const q = techId ? `rule.mitre.id:"${techId}"` : `rule.mitre.technique:"${techName}"`
      const [agg, aggTech, byLevel, timeline, byAgent] = await Promise.all([
        api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'rule.mitre.tactic', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 20, q }),
        api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'rule.mitre.technique', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 20, q }),
        api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'rule.level', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 20, q }),
        api('aggregate', { index: 'unishield360-alerts-4.x-*', field: '@timestamp', type: 'date_histogram', interval: '1h', start_date: tp.start_date, end_date: tp.end_date, limit: 48, q }),
        api('aggregate', { index: 'unishield360-alerts-4.x-*', field: 'agent.name', type: 'terms', start_date: tp.start_date, end_date: tp.end_date, limit: 10, q })
      ])
      const sevBuckets = (byLevel.buckets || [])
      const sevMap = groupSev(sevBuckets)
      const sevData = SEV_ORDER.filter(s => sevMap[s]).map(s => ({ name: s, value: sevMap[s], color: SEV_COLORS[s] }))
      setDashboardData({
        total: (byLevel.buckets || []).reduce((s, b) => s + b.doc_count, 0),
        tactics: (agg.buckets || []).map(b => ({ name: b.key, count: b.doc_count })),
        techniques: (aggTech.buckets || []).map(b => ({ name: b.key, count: b.doc_count })),
        severity: sevData,
        timeline: (timeline.buckets || []).map(b => ({ time: new Date(b.key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), alerts: b.doc_count || 0 })),
        agents: (byAgent.buckets || []).map(b => ({ name: b.key, count: b.doc_count })),
        topTechNames: []
      })
      setDashboardTechnique(techName)
      setView('dashboard')
      setError(null)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [timeParams])

  useEffect(() => {
    api('mitre-data').then(d => {
      if (d?.groups) setMitreKnowledge(d)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    handleRefresh()
    const interval = setInterval(() => {
      fetchDashboard()
    }, 30000)
    return () => clearInterval(interval)
  }, [handleRefresh, fetchDashboard])

  useEffect(() => {
    if (view === 'framework') fetchFrameworkData()
  }, [view, fetchFrameworkData])

  useEffect(() => {
    if (!fwContextTech) return
    const handler = (e) => {
      if (fwContextRef.current && !fwContextRef.current.contains(e.target)) setFwContextTech(null)
    }
    setTimeout(() => document.addEventListener('click', handler), 0)
    return () => document.removeEventListener('click', handler)
  }, [fwContextTech])

  const setInclude = (field, value) => {
    setExcludes(prev => { const next = { ...prev }; if (next[field]) { const f = next[field].filter(v => v !== value); if (f.length) next[field] = f; else delete next[field] } return next })
    setFilters(prev => { const next = { ...prev }; const arr = next[field] || []; if (arr.includes(value)) return prev; next[field] = [...arr, value]; return next })
  }
  const setExclude = (field, value) => {
    setFilters(prev => { const next = { ...prev }; if (next[field]) { const f = next[field].filter(v => v !== value); if (f.length) next[field] = f; else delete next[field] } return next })
    setExcludes(prev => { const next = { ...prev }; const arr = next[field] || []; if (arr.includes(value)) return prev; next[field] = [...arr, value]; return next })
  }
  const clearAllFilters = () => { setFilters({}); setExcludes({}) }

  const setEvFilterTac = (name) => { setView('events'); setInclude('tactic', name) }
  const setEvFilterAgent = (name) => { setView('events'); setInclude('agent', name) }
  const setEvFilterTech = (name) => { setView('events'); setInclude('technique', name) }

  const activeFilters = Object.keys(filters).length > 0 || Object.keys(excludes).length > 0
  const evFiltered = evEvents.filter(e => {
    if (filters.severity?.length && !filters.severity.includes(e.severity)) return false
    if (filters.tactic?.length && !filters.tactic.includes(e.tactic)) return false
    if (filters.agent?.length && !filters.agent.includes(e.agent)) return false
    if (filters.technique?.length && !filters.technique.some(t => e.technique.includes(t))) return false
    if (excludes.severity?.length && excludes.severity.includes(e.severity)) return false
    if (excludes.tactic?.length && excludes.tactic.includes(e.tactic)) return false
    if (excludes.agent?.length && excludes.agent.includes(e.agent)) return false
    if (excludes.technique?.length && excludes.technique.some(t => e.technique.includes(t))) return false
    return true
  })
  const evPageCount = Math.ceil(evFiltered.length / EV_PAGE_SIZE)
  const evPaged = evFiltered.slice((evPage - 1) * EV_PAGE_SIZE, evPage * EV_PAGE_SIZE)

  useEffect(() => { setEvPage(1) }, [evFiltered.length])
  const evCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  evEvents.forEach(e => { const s = e.severity.toLowerCase(); if (s in evCounts) evCounts[s]++ })

  const liveTactics = dashboardData?.tactics || []
  const timelineData = dashboardData?.timeline?.slice(-24) || []
  const agentData = dashboardData?.agents?.slice(0, 8) || []

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
      <button onClick={handleRefresh} className="px-3 py-1.5 text-xs font-bold text-white bg-[#EF843C] rounded-lg hover:bg-[#e0752a]">Retry</button>
    </div>
  )

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-[11px] text-[#8b949e]">Home / <span className="text-[#EF843C] cursor-pointer">Threat Intelligence</span> / MITRE ATT&CK</div>
          <div className="text-xl font-bold text-[#1f2328] dark:text-[#f0f6fc] tracking-tight">MITRE ATT&CK Coverage</div>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <DateRangePicker />
          <button onClick={handleRefresh} className="p-1.5 rounded border border-transparent hover:bg-[#21262d] text-[#8b949e] hover:text-[#EF843C] transition-colors" title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </div>
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
          {dashboardTechnique && (
            <div className="flex items-center justify-between bg-[#EF843C]/10 border border-[#EF843C]/30 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF843C" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <span className="text-xs font-bold text-[#1a1c23] dark:text-[#e4e6eb]">Dashboard filtered by technique:</span>
                <span className="text-xs font-mono font-bold text-[#EF843C] bg-[#EF843C]/10 px-2 py-0.5 rounded">{dashboardTechnique}</span>
              </div>
              <button onClick={() => { setDashboardTechnique(null); setTimeout(fetchDashboard, 50) }} className="text-[10px] font-bold text-[#8b949e] hover:text-[#EF843C] flex items-center gap-1">
                Clear filter <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}
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
                      <defs>
                        {(dashboardData?.topTechNames || []).map((name, i) => (
                          <linearGradient key={name} id={`techGrad_${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTip />} />
                      {(dashboardData?.topTechNames || []).map((name, i) => (
                        <Area key={name} type="monotone" dataKey={`tech_${i}`} stackId="1" stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={`url(#techGrad_${i})`} strokeWidth={2} name={name} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div className="h-[200px] flex items-center justify-center text-[#8b949e] text-xs">No timeline data</div>}
              </div>
              <div className="w-40 space-y-1 text-xs text-[#6b7280] dark:text-[#9ca3af]">
                {(dashboardData?.topTechNames || []).map((name, i) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="truncate">{name}</span>
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
                            onClick={() => { setEvFilterTac(t.name) }}>
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
                            onClick={() => { setEvFilterAgent(a.name) }}>
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
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search by name, id..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#f6f8fa] dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg text-[#1a1c23] dark:text-[#e4e6eb] outline-none focus:border-[#EF843C]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">{renderTable()}</div>
            <div className="flex items-center justify-between px-3 py-2 border-t border-[#e5e7eb] dark:border-[#2d3140] bg-[#f6f8fa] dark:bg-[#16181f]">
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
        </div>
      )}

      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setSelectedItem(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 z-50 h-full w-[35vw] min-w-[360px] max-w-[600px] bg-white dark:bg-[#16181f] border-l border-[#d0d7de] dark:border-[#1d2432] shadow-2xl flex flex-col"
            >
              <div className="px-3 py-2 border-b border-[#e5e7eb] dark:border-[#2d3140] bg-[#f6f8fa] dark:bg-[#16181f] flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider">{intelSection} Details</span>
                <button onClick={() => setSelectedItem(null)} className="text-[#8b949e] hover:text-[#EF843C]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              {renderDetail()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {view === 'framework' && (
        <div className="flex gap-3 h-[calc(100vh-220px)]">
          <div className="w-52 shrink-0 bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl shadow-sm flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-[#e5e7eb] dark:border-[#2d3140] bg-[#f6f8fa] dark:bg-[#16181f]">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#1a1c23] dark:text-[#e4e6eb]">Tactics</h3>
                <button onClick={() => setFwSelectedTactics(prev => prev.length === (fwData?.tactics || []).length ? [] : (fwData?.tactics || []).map(t => t.name))}
                  className="text-[9px] text-[#EF843C] font-bold hover:underline">{fwSelectedTactics.length === (fwData?.tactics || []).length ? 'Clear all' : 'Select all'}</button>
              </div>
              <p className="text-[9px] text-[#8b949e]">{(fwData?.tactics || []).length} active</p>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {(fwData?.tactics || []).map(tac => {
                const active = fwSelectedTactics.includes(tac.name)
                return (
                  <button key={tac.name} onClick={() => setFwSelectedTactics(prev => active ? prev.filter(n => n !== tac.name) : [...prev, tac.name])}
                    className={`w-full text-left px-3 py-2 text-xs border-b border-[#f0f2f4] dark:border-[#21262d] transition-colors hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] ${active ? 'bg-[#EF843C]/10 border-l-2 border-l-[#EF843C] font-bold text-[#1a1c23] dark:text-[#e4e6eb]' : 'text-[#5f6368] dark:text-[#9aa0b0]'}`}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${active ? 'bg-[#EF843C] border-[#EF843C]' : 'border-[#d0d7de] dark:border-[#2d3140]'}`}>{active && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}</span>
                        <span className="truncate">{tac.name}</span>
                      </span>
                      <span className="ml-2 shrink-0 text-[10px] font-bold bg-[#f3f4f6] dark:bg-[#2d3140] px-1.5 py-0.5 rounded-full">{tac.count?.toLocaleString() || 0}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex-1 bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl shadow-sm flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-[#e5e7eb] dark:border-[#2d3140] bg-[#f6f8fa] dark:bg-[#16181f] space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#1a1c23] dark:text-[#e4e6eb]">
                  {fwSelectedTactics.length > 0 ? `${fwSelectedTactics.length} tactic${fwSelectedTactics.length > 1 ? 's' : ''} selected` : 'Select tactics'}
                  <span className="ml-2 text-[10px] text-[#8b949e] font-normal">
                    {(fwData?.techniques || []).filter(t => fwSelectedTactics.includes(t.tactic)).length} techniques
                  </span>
                </h3>
                <label className="flex items-center gap-1.5 text-[10px] text-[#8b949e] cursor-pointer select-none">
                  <span>Hide techniques with no alerts</span>
                  <div onClick={() => setFwHideEmpty(!fwHideEmpty)} className={`relative w-7 h-4 rounded-full transition-colors cursor-pointer ${fwHideEmpty ? 'bg-[#EF843C]' : 'bg-[#d1d5db] dark:bg-[#2d3140]'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${fwHideEmpty ? 'translate-x-3' : 'translate-x-0'}`} />
                  </div>
                </label>
              </div>
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#8b949e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input value={fwSearch} onChange={e => setFwSearch(e.target.value)} placeholder="Search by name or ID..." className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg text-[#1a1c23] dark:text-[#e4e6eb] outline-none focus:border-[#EF843C] placeholder:text-[#8b949e]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-3">
              {(() => {
                const filtered = (fwData?.techniques || [])
                  .filter(t => fwSelectedTactics.length === 0 || fwSelectedTactics.includes(t.tactic))
                  .filter(t => !fwHideEmpty || (t.count || 0) > 0)
                  .filter(t => !fwSearch || t.name?.toLowerCase().includes(fwSearch.toLowerCase()) || t.id?.toLowerCase().includes(fwSearch.toLowerCase()))
                if (fwSelectedTactics.length === 0) return <div className="flex items-center justify-center h-full text-[#8b949e] text-xs">Select tactics from the left panel</div>
                if (filtered.length === 0) return <div className="flex items-center justify-center h-full text-[#8b949e] text-xs">No techniques match your filters</div>
                return (
                  <div className="grid grid-cols-3 gap-2.5">
                    {filtered.map(tech => {
                      const cnt = tech.count || 0
                      const bgIntensity = cnt > 100 ? 'bg-[#EF843C]/15 border-[#EF843C]/30' : cnt > 10 ? 'bg-[#EF843C]/8 border-[#EF843C]/20' : 'border-[#d0d7de] dark:border-[#2d3140]'
                      const countStyle = cnt > 100 ? 'bg-[#EF843C] text-white' : cnt > 10 ? 'bg-[#EF843C]/15 text-[#EF843C]' : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#1a1c23] dark:text-[#e4e6eb]'
                      return (
                      <div key={tech.id || tech.name} className="relative"
                        onClick={(e) => { e.stopPropagation(); setFwContextTech(fwContextTech === (tech.id || tech.name) ? null : (tech.id || tech.name)) }}>
                        <div className={`border rounded-lg cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden ${bgIntensity}`}>
                          <div className="px-2.5 py-2">
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                {tech.id && (
                                  <span className="inline-block text-[9px] font-mono font-bold text-[#EF843C] bg-[#EF843C]/10 px-1.5 py-0.5 rounded mb-1 leading-tight truncate max-w-full">{tech.id}</span>
                                )}
                                <div className="text-[11px] font-semibold text-[#1a1c23] dark:text-[#e4e6eb] leading-tight line-clamp-2" title={tech.name}>{tech.name}</div>
                                {tech.tactic && (
                                  <span className="inline-block text-[9px] text-[#8b949e] mt-1 truncate max-w-full">{tech.tactic}</span>
                                )}
                              </div>
                              <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full leading-none ${countStyle}`}>
                                {cnt.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        {fwContextTech === (tech.id || tech.name) && (
                          <div ref={fwContextRef}
                            className="absolute z-50 top-full left-0 mt-1 w-44 bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg shadow-xl py-1 text-xs"
                            onClick={e => e.stopPropagation()}>
                            <button onClick={() => { fetchTechniqueDashboard(tech.name, tech.id); setFwContextTech(null) }}
                              className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] text-[#1a1c23] dark:text-[#e4e6eb] flex items-center gap-2">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> View on dashboard
                            </button>
                            <button onClick={() => { setEvFilterTech(tech.name || tech.id); setFwContextTech(null) }}
                              className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] text-[#1a1c23] dark:text-[#e4e6eb] flex items-center gap-2">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg> View events
                            </button>
                            <div className="border-t border-[#e5e7eb] dark:border-[#2d3140] my-1" />
                            <button onClick={() => { setEvFilterTech(tech.name || tech.id); setFwContextTech(null) }}
                              className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] text-[#EF843C] flex items-center gap-2">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Filter for this technique
                            </button>
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                )
              })()}
            </div>
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
              <button key={s.k} onClick={() => setInclude('severity', s.l)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${filters.severity?.includes(s.l) ? 'ring-2 ring-offset-1' : ''}`}
                style={{ background: `${s.c}15`, borderColor: `${s.c}40`, color: s.c, ...(filters.severity?.includes(s.l) ? { ringColor: s.c } : {}) }}>
                {s.l}: {evCounts[s.k]} {filters.severity?.includes(s.l) && '✕'}
              </button>
            ))}
            <button onClick={clearAllFilters}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${activeFilters ? 'bg-[#EF843C]/10 border-[#EF843C]/40 text-[#EF843C]' : 'text-[#8b949e] border-[#e5e7eb] dark:border-[#2d3140]'}`}>
              {activeFilters ? 'Clear filters' : 'All events'}
            </button>
          </div>

          {activeFilters && (
            <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 bg-[#f6f8fa] dark:bg-[#16181f] rounded-lg border border-[#e5e7eb] dark:border-[#2d3140]">
              <span className="text-[9px] font-bold text-[#8b949e] uppercase">Active:</span>
              {Object.entries(filters).flatMap(([key, vals]) =>
                vals.map(v => (
                  <span key={key + v} onClick={() => setInclude(key, v)} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer bg-[#EF843C]/10 text-[#EF843C]">
                    Include {key}: {v} <span className="text-xs">✕</span>
                  </span>
                ))
              )}
              {Object.entries(excludes).flatMap(([key, vals]) =>
                vals.map(v => (
                  <span key={'ex-' + key + v} onClick={() => setExclude(key, v)} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                    Exclude {key}: {v} <span className="text-xs">✕</span>
                  </span>
                ))
              )}
            </div>
          )}

          <div className="bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl overflow-hidden shadow-sm">
            {evTimeline.length > 0 && (
              <div className="px-4 pt-3 pb-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-[11px] font-bold text-[#1a1c23] dark:text-[#e4e6eb]">MITRE Events Over Time</h4>
                  {evTimelineLoading && <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EF843C" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32" strokeLinecap="round"/></svg>}
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={evTimeline} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTip />} cursor={{ fill: 'var(--tooltip-bg, #f0f2f4)' }} />
                    <Bar dataKey="alerts" fill="#EF843C" radius={[2, 2, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {evFiltered.length > 0 ? (
              <><div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse">
                  <colgroup>
                    <col style={{ width: '130px' }} /><col style={{ width: '140px' }} /><col style={{ width: '110px' }} />
                    <col style={{ width: '120px' }} /><col style={{ width: '65px' }} /><col style={{ width: 'auto' }} />
                  </colgroup>
                  <thead>
                    <tr className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wide bg-[#f6f8fa] dark:bg-[#16181f]">
                      <th className="text-left py-1.5 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Timestamp</th>
                      <th className="text-left py-1.5 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Technique</th>
                      <th className="text-left py-1.5 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Tactic</th>
                      <th className="text-left py-1.5 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Agent</th>
                      <th className="text-left py-1.5 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Severity</th>
                      <th className="text-left py-1.5 px-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">Rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evPaged.map((e, i) => {
                      const rowId = e._id || String(i)
                      const isExp = expandedRow[rowId]
                      return (
                        <React.Fragment key={rowId}>
                          <tr onClick={() => toggleRow(rowId)}
                            className={`cursor-pointer hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] ${isExp ? 'bg-[#f6f8fa] dark:bg-[#16181f]' : ''}`}>
                            <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                              <span className="inline-flex items-center gap-1">
                                <span className="text-[10px] w-3">{isExp ? '▾' : '▸'}</span>
                                <span className="font-mono text-[#8b949e]">{new Date(e.ts).toLocaleString()}</span>
                              </span>
                            </td>
                            <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] font-medium text-[#1a1c23] dark:text-[#e4e6eb] cursor-pointer hover:text-[#EF843C]" onClick={(ev) => { ev.stopPropagation(); setView('intelligence'); setIntelSection('techniques'); setTimeout(() => setSearch(e.technique.split('—')[0]?.trim() || ''), 100) }}>{e.technique}</td>
                            <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                              <InlineFilter field="tactic" value={e.tactic}
                                onInclude={() => setInclude('tactic', e.tactic)}
                                onExclude={() => setExclude('tactic', e.tactic)}
                                isIncluded={filters.tactic?.includes(e.tactic)}
                                isExcluded={excludes.tactic?.includes(e.tactic)}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filters.tactic?.includes(e.tactic) ? 'text-[#58a6ff]' : excludes.tactic?.includes(e.tactic) ? 'text-[#f85149]' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'}`}>
                                {e.tactic}
                              </InlineFilter>
                            </td>
                            <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                              <InlineFilter field="agent" value={e.agent}
                                onInclude={() => setInclude('agent', e.agent)}
                                onExclude={() => setExclude('agent', e.agent)}
                                isIncluded={filters.agent?.includes(e.agent)}
                                isExcluded={excludes.agent?.includes(e.agent)}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filters.agent?.includes(e.agent) ? 'text-[#58a6ff]' : excludes.agent?.includes(e.agent) ? 'text-[#f85149]' : 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'}`}>
                                {e.agent}
                              </InlineFilter>
                            </td>
                            <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d]">
                              <InlineFilter field="severity" value={e.severity}
                                onInclude={() => setInclude('severity', e.severity)}
                                onExclude={() => setExclude('severity', e.severity)}
                                isIncluded={filters.severity?.includes(e.severity)}
                                isExcluded={excludes.severity?.includes(e.severity)}>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filters.severity?.includes(e.severity) ? 'ring-1 ring-green-500/50' : excludes.severity?.includes(e.severity) ? 'ring-1 ring-red-500/50' : ''}`} style={{ background: SEV_COLORS[e.severity.charAt(0).toUpperCase() + e.severity.slice(1)] + '20', color: SEV_COLORS[e.severity.charAt(0).toUpperCase() + e.severity.slice(1)] }}>{e.severity}</span>
                              </InlineFilter>
                            </td>
                            <td className="py-1.5 px-2 border-b border-[#f0f2f4] dark:border-[#21262d] text-[#6b7280] dark:text-[#9ca3af] max-w-[200px] truncate">{e.rule}</td>
                          </tr>
                          {isExp && e.raw && (
                            <tr>
                              <td colSpan={6} className="p-0 border-b border-[#f0f2f4] dark:border-[#21262d]">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  transition={{ duration: 0.15 }}
                                >
                                  <div className="bg-[#f6f8fa] dark:bg-[#16181f] border-t border-[#e5e7eb] dark:border-[#2d3140]">
                                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                                      <div className="flex items-center gap-2">
                                        <button onClick={(ev) => { ev.stopPropagation(); setJsonView(prev => ({ ...prev, [rowId]: false })) }}
                                          className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${!jsonView[rowId] ? 'bg-[#EF843C] text-white' : 'text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]'}`}>Table</button>
                                        <button onClick={(ev) => { ev.stopPropagation(); setJsonView(prev => ({ ...prev, [rowId]: true })) }}
                                          className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${jsonView[rowId] ? 'bg-[#EF843C] text-white' : 'text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]'}`}>JSON</button>
                                      </div>
                                      <button onClick={(ev) => { ev.stopPropagation(); navigator.clipboard.writeText(JSON.stringify(e.raw, null, 2)) }}
                                        className="text-[10px] px-2 py-0.5 rounded font-medium bg-[#e8eaed] dark:bg-[#2d3140] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#d1d5db] dark:hover:bg-[#30363d] transition-all flex items-center gap-1">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy
                                      </button>
                                    </div>
                                    <div className="max-h-56 overflow-y-auto">
                                      {jsonView[rowId] ? (
                                        <pre className="text-xs text-[#c9d1d9] bg-[#0d1117] p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed m-0">
                                          {JSON.stringify(e.raw, null, 2)}
                                        </pre>
                                      ) : (
                                        <table className="w-full text-[11px]">
                                          <tbody>
                                            {flattenDoc(e.raw).map((fld, fi) => (
                                              <tr key={fi} className="border-b border-[#e5e7eb]/30 dark:border-[#2d3140]/30 hover:bg-[#f0f2f4] dark:hover:bg-[#161b22]">
                                                <td className="px-3 py-1 font-medium text-[#1f2328] dark:text-[#f0f6fc] whitespace-nowrap w-1/3 align-top text-[10px]">{fld.path}</td>
                                                <td className="px-3 py-1 text-[#36454f] dark:text-[#c9d1d9] break-all text-[11px]">{String(fld.value ?? '')}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {evFiltered.length > 0 && evPageCount > 1 && (
                <div className="flex items-center justify-between px-3 py-2 border-t border-[#e5e7eb] dark:border-[#2d3140]">
                  <div className="flex items-center gap-1 text-[11px] text-[#8b949e]">
                    <span>Page {evPage} of {evPageCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEvPage(p => Math.max(1, p - 1))} disabled={evPage === 1}
                      className="bg-transparent border border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[11px] min-w-[28px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#EF843C] disabled:opacity-35 disabled:cursor-default transition-all">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    {Array.from({ length: Math.min(evPageCount, 5) }, (_, i) => {
                      const pageNum = evPageCount <= 5 ? i + 1 : Math.max(1, Math.min(evPage - 2, evPageCount - 4)) + i
                      if (pageNum > evPageCount) return null
                      return (
                        <button key={pageNum} onClick={() => setEvPage(pageNum)}
                          className={`bg-transparent border px-2 py-0.5 rounded text-[11px] min-w-[28px] transition-all ${
                            pageNum === evPage ? 'bg-[#EF843C] text-white border-[#EF843C]' : 'border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#EF843C]'
                          }`}>{pageNum}</button>
                      )
                    })}
                    {evPageCount > 5 && evPage < evPageCount - 2 && <span className="px-0.5 text-[#8b949e]">...</span>}
                    {evPageCount > 5 && (
                      <button onClick={() => setEvPage(evPageCount)}
                        className="bg-transparent border border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[11px] min-w-[28px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#EF843C] transition-all">{evPageCount}</button>
                    )}
                    <button onClick={() => setEvPage(p => Math.min(evPageCount, p + 1))} disabled={evPage === evPageCount}
                      className="bg-transparent border border-[#e5e7eb] dark:border-[#2d3140] text-[#36454f] dark:text-[#c9d1d9] px-2 py-0.5 rounded text-[11px] min-w-[28px] hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#EF843C] disabled:opacity-35 disabled:cursor-default transition-all">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                </div>
              )}
              {evPage === evPageCount && evOffsetRef.current < evTotal && evTotal > EV_PAGE_SIZE * 50 && (
                <div className="flex justify-center py-3 border-t border-[#e5e7eb] dark:border-[#2d3140]">
                  <button onClick={() => fetchEvents(true)} disabled={evLoadingMore}
                    className="px-4 py-1.5 text-xs font-bold bg-[#EF843C]/10 text-[#EF843C] border border-[#EF843C]/30 rounded-lg hover:bg-[#EF843C]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2">
                    {evLoadingMore ? (
                      <><svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32" strokeLinecap="round"/></svg> Loading 500 more...</>
                    ) : (
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg> Load 500 more ({Math.min(evTotal - evOffsetRef.current, 10000 - evOffsetRef.current)} remaining)</>
                    )}
                  </button>
                </div>
              )}
              {evTotal > 0 && (
                <div className="flex items-center justify-between px-3 py-2 text-[10px] text-[#8b949e] border-t border-[#e5e7eb] dark:border-[#2d3140]">
                  <span>{(evPage - 1) * EV_PAGE_SIZE + 1}-{Math.min(evPage * EV_PAGE_SIZE, evFiltered.length)} of {evFiltered.length}</span>
                  <span>{evOffsetRef.current >= evTotal ? 'All events loaded' : `${evTotal} total, ${evTotal - evOffsetRef.current} more`}</span>
                </div>
              )}
            </>
            ) : (
              <div className="py-8 text-center">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-30 text-[#8b949e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <p className="text-sm text-[#8b949e]">{evEvents.length === 0 ? 'No MITRE-tagged events from API' : 'No events match current filters'}</p>
                {activeFilters && <button onClick={clearAllFilters} className="mt-2 px-3 py-1 text-xs font-bold border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg hover:border-[#EF843C] hover:text-[#EF843C]">Clear filters</button>}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
