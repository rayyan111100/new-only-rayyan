import { useState, useCallback, useRef } from 'react'
import { api } from '../api'
import { parseDateStr } from '../utils'

const BATCH_SIZE = 500
const PAGE_SIZE = 10
const MAX_TOTAL = 10000

export default function useEventLoader(q) {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [logPage, setLogPage] = useState(1)
  const offsetRef = useRef(0)

  const fetchEvents = useCallback(async (append, startDate, endDate) => {
    try {
      const sd = parseDateStr(startDate).toISOString()
      const ed = parseDateStr(endDate).toISOString()
      const offset = append ? offsetRef.current : 0
      if (append) setLoadingMore(true)
      const res = await api('search', {
        index: 'unishield360-alerts-4.x-*',
        start_date: sd,
        end_date: ed,
        q,
        limit: BATCH_SIZE,
        offset,
        sort: '@timestamp',
        order: 'desc'
      })
      const results = res.results || []
      const t = typeof res.total === 'object' ? res.total.value : (res.total || 0)
      if (append) {
        setLogs(prev => [...prev, ...results])
      } else {
        setLogs(results)
        setLogPage(1)
      }
      offsetRef.current = append ? offsetRef.current + results.length : results.length
      setTotal(Math.min(t, MAX_TOTAL))
    } catch (e) {
      if (!append) setLogs([])
    } finally {
      setLoadingMore(false)
    }
  }, [q])

  return { logs, total, loadingMore, logPage, setLogPage, fetchEvents, offsetRef, PAGE_SIZE }
}
