import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { api } from '../api'
import { applyClientFilters, buildDqlText, parseDateStr } from '../utils'

const AppContext = createContext()

export function useApp() { return useContext(AppContext) }

let filterId = 0
function genId() { return ++filterId }

export function AppProvider({ children }) {
  const [theme, setThemeRaw] = useState(() => localStorage.getItem('theme') || 'dark')
  const [tab, setTab] = useState('discover')
  const [dql, setDql] = useState('')
  const [filters, setFilters] = useState([])
  const [startDate, setStartDate] = useState('now-24h')
  const [endDate, setEndDate] = useState('now')
  const [limit, setLimit] = useState(50)
  const [index, setIndex] = useState('wazuh-alerts-4.x-*')
  const [sortField, setSortField] = useState('@timestamp')
  const [sortOrder, setSortOrder] = useState('desc')
  const [columns, setColumns] = useState(['@timestamp', 'rule.id', 'rule.level', 'rule.description', 'agent.name'])
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [fields, setFields] = useState([])
  const [histogram, setHistogram] = useState([])
  const [error, setError] = useState(null)
  const [refreshValue, setRefreshValue] = useState(0)
  const [refreshUnit, setRefreshUnit] = useState('s')
  const [refreshActive, setRefreshActive] = useState(false)
  const refreshRef = useRef(null)

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
    const start = document.getElementById('dStartDate')?.value || startDate
    const end = document.getElementById('dEndDate')?.value || endDate
    const sd = parseDateStr(start)
    const ed = parseDateStr(end)
    return { start_date: sd.toISOString(), end_date: ed.toISOString() }
  }, [startDate, endDate])

  const doSearch = useCallback(async (opts = {}) => {
    setLoading(true)
    setError(null)
    try {
      const userQ = opts.q !== undefined ? opts.q : dql
      const filterQ = buildDqlText(filters)
      let combined = ''
      if (userQ && filterQ) combined = '(' + userQ + ') AND ' + filterQ
      else combined = userQ || filterQ
      const params = {
        limit: opts.limit || limit,
        index: opts.index || index,
        q: combined || undefined,
        sort: opts.sortField || sortField,
        order: opts.sortOrder || sortOrder,
        start_date: opts.startDate || resolveTimeRange().start_date,
        end_date: opts.endDate || resolveTimeRange().end_date
      }
      if (!params.q) delete params.q
      const d = await api('search', params)
      const totalRes = d.total || 0
      let res = d.results || []
      const haveClient = filters.some(f => f.negate || f.type === 'exists')
      if (haveClient || dql) res = applyClientFilters(res, filters)
      setTotal(totalRes)
      setResults(res)
      if (opts.noHistogram !== true) loadHistogram(params)
    } catch (e) {
      setError(e.message)
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filters, dql, limit, index, sortField, sortOrder, resolveTimeRange])

  const addFilter = useCallback((field, value, negate) => {
    setFilters(prev => {
      const isExists = value === '__exists__'
      const fv = isExists ? '_exists_' : String(value)
      const ft = isExists ? 'exists' : 'value'
      if (ft === 'exists') negate = false
      const dup = prev.find(f => f.field === field && f.value === fv && f.type === ft)
      if (dup) return prev
      return [...prev, { id: genId(), field, value: fv, negate: !!negate, type: ft }]
    })
  }, [])

  const removeFilter = useCallback(id => {
    setFilters(prev => prev.filter(f => f.id !== id))
  }, [])

  const loadHistogram = useCallback(async (params) => {
    try {
      const hParams = { ...params, field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48 }
      delete hParams.q; delete hParams.limit
      const d = await api('aggregate', hParams)
      setHistogram(d.buckets || [])
    } catch { setHistogram([]) }
  }, [])

  const loadFields = useCallback(async () => {
    try { const d = await api('fields', { index }); setFields(d.fields || []) } catch {}
  }, [index])

  const toggleColumn = useCallback(name => {
    setColumns(prev => { const i = prev.indexOf(name); return i >= 0 ? prev.filter(c => c !== name) : [...prev, name] })
    doSearch()
  }, [doSearch])

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
    refreshRef.current = setInterval(() => doSearchRef.current({ noHistogram: false }), ms)
    return () => { if (refreshRef.current) clearInterval(refreshRef.current) }
  }, [refreshActive, refreshValue, refreshUnit])

  const toggleRefresh = useCallback(() => {
    if (refreshActive) { setRefreshActive(false); if (refreshRef.current) { clearInterval(refreshRef.current); refreshRef.current = null } }
    else if (refreshValue > 0) { doSearch(); setRefreshActive(true) }
  }, [refreshActive, refreshValue, doSearch])

  const value = {
    theme, setTheme, isDark, tab, setTab,
    dql, setDql, filters, setFilters, addFilter, removeFilter,
    startDate, setStartDate, endDate, setEndDate,
    limit, setLimit, index, setIndex,
    sortField, sortOrder, columns,
    toggleColumn, moveColumn, doSort,
    results, total, loading, error,
    fields, setFields, histogram,
    doSearch, loadFields, resolveTimeRange,
    refreshValue, setRefreshValue, refreshUnit, setRefreshUnit, refreshActive, toggleRefresh
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
