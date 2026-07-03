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
    timeline: (d.timeline || []).map(b => {
      const ts = parseInt(b.time || b.key) || 0
      const d2 = ts ? new Date(ts) : null
      return {
        time: d2 ? d2.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '--',
        rawTime: ts,
        count: b.count || b.doc_count || 0
      }
    }),
    categories: (d.categories || []).slice(0, 8),
    topControls: d.topControls || [],
    recent: (d.recent || []).slice(0, 1000),
    recentTotal: d.recentTotal || 0
  }
}

function toEntry(val) {
  return Array.isArray(val) ? val[0] : val
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
    ctrl: toEntry(r.rule?.gdpr) || toEntry(r.rule?.tsc) || toEntry(r.rule?.hipaa) || toEntry(r.rule?.pci_dss) || toEntry(r.rule?.nist_800_53) || r.control || '--'
  }
}

export default function useCompliance(framework, filters = {}) {
  const { startDate: rawStart, endDate: rawEnd } = useApp()
  const startDate = rawStart || 'now-24h'
  const endDate = rawEnd || 'now'
  const severityFilter = filters.severity
  const sevKey = (severityFilter || []).sort().join(',')
  const cacheKey = `${framework || '__all__'}|${sevKey}`
  const timeKey = `${startDate}|${endDate}`

  const [state, setState] = useState(() => {
    const cached = cache.get(cacheKey)
    return {
      data: cached?.data?.d || null,
      loading: !cached,
      error: null,
    }
  })

  const mountedRef = useRef(true)
  const cacheKeyRef = useRef(cacheKey)

  const fetchData = useCallback(async (silent, noCache) => {
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
      if (severityFilter?.length) params.severity = severityFilter.join(',')
      if (noCache) params._t = Date.now()
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
  }, [framework, startDate, endDate, timeKey, severityFilter])

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

  const refresh = useCallback(() => fetchData(false, true), [fetchData])

  return useMemo(() => ({ ...state, refresh, toLogEntry, toSev }), [state, refresh])
}
