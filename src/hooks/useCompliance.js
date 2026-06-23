import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import { parseDateStr } from '../utils'

const cache = new Map()
const POLL_MS = 30000
let pollTimer = null
const pollSubs = new Set()

function toSev(level) {
  const n = parseInt(level) || 0
  if (n >= 12) return 'Critical'
  if (n >= 7) return 'High'
  if (n >= 4) return 'Medium'
  return 'Low'
}

function transform(d) {
  return {
    count24: d.count24 || 0,
    count7d: d.count7d || 0,
    severity: d.severity || {},
    frameworkCounts: d.frameworkCounts || [],
    topRules: (d.topRules || []).slice(0, 8),
    topAgents: (d.topAgents || []).slice(0, 8),
    timeline: (d.timeline || []).map(b => ({
      time: new Date(b.time || b.key).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      rawTime: b.time || b.key,
      count: b.count || b.doc_count || 0
    })),
    categories: (d.categories || []).slice(0, 8),
    topControls: d.topControls || [],
    recent: (d.recent || []).slice(0, 10000),
    recentTotal: d.recentTotal || 0
  }
}

function toLogEntry(r) {
  return {
    time: r['@timestamp'] || r.timestamp || '--',
    agent: r.agent?.name || r.agent || '--',
    rule: r.rule?.id || r.rule || '--',
    sev: toSev(parseInt(r.rule?.level || r.level || 0)),
    desc: r.rule?.description || r.description || '--',
    event: r.rule?.groups?.[0] || r.event_type || '--',
    file: r.data?.file || r.file || '--',
    groups: r.rule?.groups?.join(', ') || '--',
    ctrl: r.rule?.gdpr || r.rule?.tsc || r.rule?.hipaa || r.rule?.pci_dss || r.rule?.nist_800_53 || r.control || '--'
  }
}

export default function useCompliance(framework) {
  const { startDate: rawStart, endDate: rawEnd } = useApp()
  const startDate = rawStart || 'now-24h'
  const endDate = rawEnd || 'now'
  const cacheKey = framework || '__all__'
  const timeKey = `${startDate}|${endDate}`

  const [state, setState] = useState(() => {
    const cached = cache.get(cacheKey)
    return {
      data: cached?.data?.d || null,
      loading: !cached,
      error: null,
    }
  })
  const [logs, setLogs] = useState([])
  const [totalLogCount, setTotalLogCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const mountedRef = useRef(true)
  const cacheKeyRef = useRef(cacheKey)
  const loadingMoreRef = useRef(false)

  // Reset logs when initial data changes
  useEffect(() => {
    if (state.data?.recent) {
      setLogs(state.data.recent)
      setTotalLogCount(state.data.recentTotal || state.data.recent.length)
    }
  }, [state.data?.recent, state.data?.recentTotal])

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const sd = parseDateStr(startDate)
      const ed = parseDateStr(endDate)
      const offset = logs.length
      const params = {
        index: 'unishield360-alerts-4.x-*',
        start_date: sd.toISOString(),
        end_date: ed.toISOString(),
        offset,
        limit: 500,
      }
      if (framework) params.framework = framework
      const d = await api('compliance', params)
      const newDocs = (d.recent || []).map(r => ({
        ...r,
        _frameworks: r._frameworks || []
      }))
      if (mountedRef.current) {
        setLogs(prev => [...prev, ...newDocs])
        setTotalLogCount(d.recentTotal || logs.length + newDocs.length)
      }
    } catch (e) {
      console.error('loadMore error:', e)
    } finally {
      loadingMoreRef.current = false
      if (mountedRef.current) setLoadingMore(false)
    }
  }, [framework, startDate, endDate, logs.length])

  const fetchData = useCallback(async (silent) => {
    const key = cacheKeyRef.current
    const cached = cache.get(key)
    if (!silent && !cached) {
      setState(s => ({ ...s, loading: true }))
    }
    try {
      const sd = parseDateStr(startDate)
      const ed = parseDateStr(endDate)
      const params = {
        index: 'unishield360-alerts-4.x-*',
        start_date: sd.toISOString(),
        end_date: ed.toISOString(),
      }
      if (framework) params.framework = framework
      if (!silent) params._t = Date.now() // Bypass backend cache on manual refresh
      const d = await api('compliance', params)
      const t = transform(d)
      cache.set(key, { data: { d: t, time: Date.now(), timeKey } })
      if (mountedRef.current) {
        setState({ data: t, loading: false, error: null })
      }
    } catch (e) {
      if (mountedRef.current) {
        setState(s => ({ ...s, loading: false, error: silent ? null : e.message }))
      }
    }
  }, [framework, startDate, endDate, timeKey])

  useEffect(() => {
    cacheKeyRef.current = cacheKey
    const cached = cache.get(cacheKey)
    if (cached && cached.data && cached.data.timeKey === timeKey) {
      setState({ data: cached.data.d, loading: false, error: null })
      return
    }
    fetchData(false)
  }, [cacheKey, timeKey, fetchData])

  useEffect(() => {
    const sub = { key: cacheKey, fn: fetchData }
    pollSubs.add(sub)
    if (!pollTimer) {
      pollTimer = setInterval(() => {
        for (const s of pollSubs) {
          const cached = cache.get(s.key)
          if (cached?.data) {
            s.fn(true)
          }
        }
      }, POLL_MS)
    }
    return () => {
      pollSubs.delete(sub)
      if (pollSubs.size === 0 && pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }
  }, [cacheKey, fetchData])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const refresh = useCallback(() => { setLogs([]); fetchData(false) }, [fetchData])

  return useMemo(() => ({ ...state, refresh, toLogEntry, toSev, logs, totalLogCount, loadMore, loadingMore }), [state, refresh, logs, totalLogCount, loadMore, loadingMore])
}
