import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { api, apiPost } from '../api'
import { applyClientFilters, buildDqlText, parseDateStr, COMMON_FIELDS, inferFieldTypes, extractTotal, extractResults } from '../utils'
import { getRule, getAllRules, updateRule, deleteRule, toggleRuleEnabled } from '../services/ruleStorage'
import { addRulesToGroup, moveRulesToGroup, removeRulesFromGroup } from '../services/ruleGroupManager'
import useRealtime from '../hooks/useRealtime'

const AppContext = createContext()

export function useApp() { return useContext(AppContext) }

let filterId = 0
function genId() { return ++filterId }

export function AppProvider({ children }) {
  const [theme, setThemeRaw] = useState(() => localStorage.getItem('theme') || 'dark')
  const [tab, setTabState] = useState(() => localStorage.getItem('dashboard_tab') || 'discover')
  const setTab = useCallback(t => { localStorage.setItem('dashboard_tab', t); setTabState(t) }, [])
  const [dql, setDql] = useState('')
  const [filters, setFilters] = useState([])
  const [startDate, setStartDate] = useState('now-24h')
  const [endDate, setEndDate] = useState('now')
  const [limit, setLimit] = useState(50)
  const [index, setIndex] = useState('unishield360-alerts-4.x-*')
  const [sortField, setSortField] = useState('timestamp')
  const [sortOrder, setSortOrder] = useState('desc')
  const [columns, setColumns] = useState(['timestamp', 'Rule', 'rule.id', 'rule.description'])
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [browsableTotal, setBrowsableTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [fields, setFields] = useState([])
  const [histogram, setHistogram] = useState([])
  const [error, setError] = useState(null)
  const [refreshValue, setRefreshValue] = useState(0)
  const [refreshUnit, setRefreshUnit] = useState('s')
  const [refreshActive, setRefreshActive] = useState(false)
  const [pendingRuleId, setPendingRuleId] = useState(null)
  const [activeGroup, setActiveGroup] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedRules, setSelectedRules] = useState([])
  const [filterMatch, setFilterMatch] = useState('and')
  const [warning, setWarning] = useState(null)
  const [page, setPageState] = useState(1)
  const pageRef = useRef(1)
  const setPage = useCallback(n => { pageRef.current = n; setPageState(n) }, [])
  const { connected: realtimeConnected, matches: realtimeMatches, stats: realtimeStats, clearMatches: realtimeClearMatches } = useRealtime()

  // Merge real-time WebSocket alerts into results when on discover tab
  const realtimeMergeKey = useRef(0)
  useEffect(() => {
    const msgs = realtimeMatches
    if (msgs.length === 0) return
    const newDocs = msgs.filter(m => m.doc).map(m => m.doc)
    if (newDocs.length === 0) return
    const key = newDocs[0]?.['@timestamp'] || newDocs[0]?.timestamp || ''
    if (key === realtimeMergeKey.current) return
    realtimeMergeKey.current = key
    setResults(prev => {
      const existingIds = new Set(prev.map(r => r._id || r.id || r['@timestamp']))
      const unique = newDocs.filter(d => !existingIds.has(d._id || d.id || d['@timestamp']))
      if (unique.length === 0) return prev
      return [...unique, ...prev].slice(0, 500)
    })
    setTotal(prev => prev + 1)
  }, [realtimeMatches, tab])

  // Auto-refresh every 10s on discover tab for continuous real-time data
  const autoRefreshRef = useRef(null)
  useEffect(() => {
    if (tab === 'discover') {
      autoRefreshRef.current = setInterval(() => {
        doSearchRef.current({ keepPage: true })
      }, 10000)
      return () => {
        if (autoRefreshRef.current) {
          clearInterval(autoRefreshRef.current)
          autoRefreshRef.current = null
        }
      }
    }
  }, [tab])

  const dedupFilters = (arr) => {
    const seen = new Set()
    return arr.filter(f => {
      const key = `${f.field}|${f.value}|${f.operator}|${!!f.negate}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  const refreshRef = useRef(null)
  const filtersRef = useRef(filters)
  useEffect(() => { filtersRef.current = filters }, [filters])
  const startDateRef = useRef(startDate)
  const endDateRef = useRef(endDate)
  useEffect(() => { startDateRef.current = startDate }, [startDate])
  useEffect(() => { endDateRef.current = endDate }, [endDate])

  const setTheme = useCallback(t => {
    setThemeRaw(t)
    localStorage.setItem('theme', t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (theme === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [theme])

  const isDark = theme === 'dark'

  const resolveTimeRange = useCallback(() => {
    const sd = parseDateStr(startDateRef.current)
    const ed = parseDateStr(endDateRef.current)
    return { start_date: sd.toISOString(), end_date: ed.toISOString() }
  }, [])

  const updateStartDate = useCallback(val => { startDateRef.current = val; setStartDate(val) }, [])
  const updateEndDate = useCallback(val => { endDateRef.current = val; setEndDate(val) }, [])

  const clearAllFilters = useCallback(() => {
    const pinned = filtersRef.current.filter(f => f.pinned)
    setFiltersSafe(pinned)
    if (!pinned.length) setDql('')
  }, [])

  const searchCounter = useRef(0)

  const doSearch = useCallback(async (opts = {}) => {
    setLoading(true)
    setError(null)
    setWarning(null)
    const prevPage = pageRef.current
    const gen = ++searchCounter.current
    try {
      const currentFilters = opts.filters !== undefined ? opts.filters : filtersRef.current
      const matchMode = opts.filterMatch || filterMatch
      const userQ = opts.q !== undefined ? opts.q : dql

      // Build FULL filter DQL (all filters, for client-side)
      const fullFilterQ = buildDqlText(currentFilters, matchMode)

      // Build SERVER filter DQL (exclude operators the UniShield360 API search endpoint ignores)
      // Known issues: NOT, is not, range operators, wildcard, regex, contains, starts/ends with
      const serverSafe = currentFilters.filter(f =>
        !f.disabled &&
        !f.negate &&
        !['is not', 'does not contain', 'is not one of', 'is not between', 'does not exist',
          'matches regex', 'wildcard',
          'is greater than', 'is greater than or equal', 'is less than', 'is less than or equal',
          'is between', 'is not between',
          'contains', 'starts with', 'ends with'
        ].includes(f.operator)
      )
      const serverFilterQ = buildDqlText(serverSafe, matchMode)

      // Combine user DQL with server-safe filter DQL
      let combined = ''
      if (userQ && serverFilterQ) combined = '(' + userQ + ') ' + (matchMode === 'or' ? 'OR' : 'AND') + ' ' + serverFilterQ
      else combined = userQ || serverFilterQ

      if (!opts.keepPage) { pageRef.current = 1; setPageState(1) }
      const offset = (pageRef.current - 1) * (opts.limit || limit)

      const params = {
        limit: opts.limit || limit,
        offset: offset,
        index: opts.index || index,
        q: combined || undefined,
        sort: opts.sortField || sortField,
        order: opts.sortOrder || sortOrder,
        start_date: opts.startDate || resolveTimeRange().start_date,
        end_date: opts.endDate || resolveTimeRange().end_date
      }
      if (!params.q) delete params.q

      // Use scan endpoint for deep pagination (no 10,000 max_result_window limit)
      const ep = offset > 9000 ? 'scan' : 'search'
      const [d, c] = await Promise.all([
        offset > 9000 ? apiPost(ep, params) : api(ep, params),
        api('count', { index: params.index, q: params.q || '*', start_date: params.start_date, end_date: params.end_date }).catch(() => null)
      ])

      if (gen !== searchCounter.current) return // stale request, discard

      let totalRes = extractTotal(c) || extractTotal(d)
      let rawRes = extractResults(d)

      // Auto-fallback: if 0 results in 4.x index, try broader index
      if (totalRes === 0 && params.index && params.index.includes('4.x') && !opts.index) {
        const fallbackParams = { ...params, index: 'unishield360-alerts-*' }
        try {
          const [fd, fc] = await Promise.all([
            api('search', fallbackParams),
            api('count', { index: 'unishield360-alerts-*', q: params.q || '*', start_date: params.start_date, end_date: params.end_date }).catch(() => null)
          ])
          const fdTotal = extractTotal(fd) || extractTotal(fc)
          if (fdTotal > 0) {
            setIndex('unishield360-alerts-*')
            setWarning(`Switched to unishield360-alerts-* (found ${fdTotal} results). No data in ${params.index}.`)
            totalRes = fdTotal
            rawRes = extractResults(fd)
          }
        } catch {}
      }

      let res = applyClientFilters(rawRes, currentFilters, matchMode)

      setTotal(totalRes)
      setBrowsableTotal(totalRes)
      if (rawRes.length === 0 && totalRes > 0 && offset === 0) {
        setWarning('Server returned results that did not match your filter (API limitation). Results refined client-side.')
      } else if (fullFilterQ && !serverFilterQ && totalRes > 0 && res.length < totalRes) {
        setWarning(`Showing ${res.length} of ${totalRes} results (client-filtered). Remove restrictive filters to see more.`)
      }
      setResults(res)
      if (opts.noHistogram !== true) loadHistogram(params)
    } catch (e) {
      pageRef.current = prevPage
      setPageState(prevPage)
      setError(e.message)
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [dql, limit, index, sortField, sortOrder, resolveTimeRange, filterMatch])

  const setFiltersSafe = useCallback((arr) => {
    const clean = dedupFilters(arr)
    filtersRef.current = clean
    setFilters(clean)
  }, [])

  const addFilter = useCallback((field, value, negate, operator, params) => {
    const isExists = value === '__exists__'
    const fv = isExists ? '_exists_' : String(value)
    const ft = isExists ? 'exists' : 'value'
    const op = operator || (isExists ? 'exists' : negate ? 'is not' : 'is')
    if (ft === 'exists') negate = false
    const existing = filtersRef.current.find(f => f.field === field)
    if (existing) {
      const updated = { ...existing, value: fv, negate: !!negate, type: ft, operator: op, params: params || null, secondValue: null, disabled: false }
      filtersRef.current = filtersRef.current.map(f => f.id === existing.id ? updated : f)
      setFiltersSafe(filtersRef.current)
    } else {
      const newFilter = { id: genId(), field, value: fv, negate: !!negate, type: ft, operator: op, params: params || null, secondValue: null, disabled: false, pinned: false }
      setFiltersSafe([...filtersRef.current, newFilter])
    }
  }, [])

  const editFilter = useCallback((id, updates) => {
    filtersRef.current = filtersRef.current.map(f => f.id === id ? { ...f, ...updates } : f)
    setFiltersSafe(filtersRef.current)
  }, [])

  const removeFilter = useCallback(id => {
    filtersRef.current = filtersRef.current.filter(f => f.id !== id)
    setFiltersSafe(filtersRef.current)
  }, [])

  const loadHistogram = useCallback(async (params) => {
    try {
      const hParams = { ...params, field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48 }
      delete hParams.q; delete hParams.limit; delete hParams.offset
      const d = await api('aggregate', hParams)
      setHistogram(d.buckets || [])
    } catch { setHistogram([]) }
  }, [])

  const loadFields = useCallback(async () => {
    let fieldList = []
    try {
      const d = await api('fields', { index })
      if (d.fields && Array.isArray(d.fields) && d.fields.length > 0) {
        fieldList = d.fields
      }
    } catch {}
    if (fieldList.length === 0) {
      try {
        const sample = await api('search', { index, limit: 3, sort: '@timestamp', order: 'desc' })
        const docs = extractResults(sample)
        if (docs.length > 0) {
          fieldList = inferFieldTypes(docs)
        }
      } catch {}
    }
    const nameSet = new Set(fieldList.map(f => f.name))
    const merged = [...fieldList]
    for (const name of COMMON_FIELDS) {
      if (!nameSet.has(name)) merged.push({ name, type: 'keyword' })
    }
    setFields(merged)
  }, [index])

  const toggleColumn = useCallback(name => {
    setColumns(prev => { const i = prev.indexOf(name); return i >= 0 ? prev.filter(c => c !== name) : [...prev, name] })
  }, [])

  const moveColumn = useCallback((name, dir) => {
    setColumns(prev => {
      const i = prev.indexOf(name); if (i < 0) return prev
      const j = i + dir; if (j < 0 || j >= prev.length) return prev
      const arr = [...prev]; const [t] = arr.splice(i, 1); arr.splice(j, 0, t); return arr
    })
  }, [])

  const doSort = useCallback(field => {
    setSortField(prev => {
      if (prev === field) { setSortOrder(o => (o === 'asc' ? 'desc' : 'asc')); return prev }
      setSortOrder('desc'); return field
    })
  }, [])

  const doSearchRef = useRef(doSearch)
  useEffect(() => { doSearchRef.current = doSearch }, [doSearch])

  useEffect(() => {
    if (refreshRef.current) { clearInterval(refreshRef.current); refreshRef.current = null }
    if (!refreshActive || refreshValue <= 0) return
    const ms = refreshUnit === 'h' ? refreshValue * 3600000 : refreshUnit === 'm' ? refreshValue * 60000 : refreshValue * 1000
    refreshRef.current = setInterval(() => doSearchRef.current({ noHistogram: false, filterMatch: filterMatch, keepPage: true }), ms)
    return () => { if (refreshRef.current) clearInterval(refreshRef.current) }
  }, [refreshActive, refreshValue, refreshUnit, filterMatch])

  const toggleRefresh = useCallback(() => {
    if (refreshActive) { setRefreshActive(false); if (refreshRef.current) { clearInterval(refreshRef.current); refreshRef.current = null } }
    else if (refreshValue > 0) { doSearch({ keepPage: true }); setRefreshActive(true) }
  }, [refreshActive, refreshValue, doSearch])

  const selectRule = useCallback(id => {
    setSelectedRules(prev => prev.includes(id) ? prev : [...prev, id])
  }, [])

  const deselectRule = useCallback(id => {
    setSelectedRules(prev => prev.filter(x => x !== id))
  }, [])

  const selectAllRules = useCallback(() => {
    setSelectedRules(getAllRules().map(r => r.id))
  }, [])

  const deselectAllRules = useCallback(() => {
    setSelectedRules([])
  }, [])

  const bulkAddToGroup = useCallback(groupId => {
    const ids = selectedRules
    if (ids.length === 0) return
    addRulesToGroup(groupId, ids)
  }, [selectedRules])

  const bulkMoveToGroup = useCallback((sourceGroupId, targetGroupId) => {
    const ids = selectedRules
    if (ids.length === 0) return
    moveRulesToGroup(sourceGroupId, targetGroupId, ids)
    setSelectedRules([])
  }, [selectedRules])

  const bulkRemoveFromGroup = useCallback(groupId => {
    const ids = selectedRules
    if (ids.length === 0) return
    removeRulesFromGroup(groupId, ids)
    setSelectedRules([])
  }, [selectedRules])

  const bulkDeleteRules = useCallback(() => {
    const ids = selectedRules
    if (ids.length === 0) return
    for (const id of ids) deleteRule(id)
    setSelectedRules([])
  }, [selectedRules])

  const bulkToggleRules = useCallback(enabled => {
    const ids = selectedRules
    if (ids.length === 0) return
    for (const id of ids) updateRule(id, { enabled })
    setSelectedRules([])
  }, [selectedRules])

  const value = {
    theme, setTheme, isDark, tab, setTab,
    dql, setDql, filters, setFilters, addFilter, editFilter, removeFilter,
    startDate, setStartDate: updateStartDate, endDate, setEndDate: updateEndDate,
    limit, setLimit, index, setIndex,
    sortField, sortOrder, columns,
    toggleColumn, moveColumn, doSort,
    results, total, browsableTotal, loading, error, page, setPage,
    fields, setFields, histogram,
    doSearch, loadFields, resolveTimeRange,
    refreshValue, setRefreshValue, refreshUnit, setRefreshUnit, refreshActive, toggleRefresh,
    pendingRuleId, setPendingRuleId,
    activeGroup, setActiveGroup,
    selectedRules, setSelectedRules,
    filterMatch, setFilterMatch,
    sidebarOpen, setSidebarOpen,
    warning, setWarning, clearAllFilters,
    selectRule, deselectRule,
    selectAllRules, deselectAllRules,
    bulkAddToGroup, bulkMoveToGroup, bulkRemoveFromGroup,
    bulkDeleteRules, bulkToggleRules,
    realtimeConnected, realtimeMatches, realtimeStats, realtimeClearMatches
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
