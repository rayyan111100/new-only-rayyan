import React, { useState, useRef, useCallback, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useApp } from '../context/AppContext'
import dayjs from 'dayjs'

export default function Histogram() {
  const { histogram, isDark, setStartDate, setEndDate, doSearch } = useApp()
  const [dragStart, setDragStart] = useState(null)
  const [dragEnd, setDragEnd] = useState(null)
  const [dragging, setDragging] = useState(false)
  const chartRef = useRef(null)

  const data = useMemo(() => histogram.length
    ? histogram.slice(-48).map((b, i) => ({
        idx: i,
        time: new Date(b.key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ts: b.key,
        count: b.doc_count || b.count || 0
      }))
    : [], [histogram])

  const max = useMemo(() => data.length ? Math.max(...data.map(d => d.count), 1) : 1, [data])

  const getIdxFromX = useCallback((clientX) => {
    const el = chartRef.current
    if (!el || !data.length) return null
    const rect = el.getBoundingClientRect()
    const pad = 8
    const w = rect.width - pad * 2
    if (w <= 0) return null
    const ratio = (clientX - rect.left - pad) / w
    return Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1))))
  }, [data])

  const handleDown = useCallback((e) => {
    const idx = getIdxFromX(e.clientX)
    if (idx !== null) { setDragStart(idx); setDragging(true); setDragEnd(null) }
  }, [getIdxFromX])

  const handleMove = useCallback((e) => {
    if (!dragging) return
    const idx = getIdxFromX(e.clientX)
    if (idx !== null) setDragEnd(idx)
  }, [dragging, getIdxFromX])

  const handleUp = useCallback(() => {
    if (!dragging) return
    setDragging(false)
    setDragStart(null)
    setDragEnd(null)
    if (!data.length || dragStart === null) return
    const idxA = data[dragStart]?.ts
    const idxB = dragEnd !== null ? data[dragEnd]?.ts : null
    const fromTs = idxA && idxB ? Math.min(idxA, idxB) : idxA
    const toTs = idxA && idxB ? Math.max(idxA, idxB) : null
    if (fromTs && toTs && fromTs !== toTs) {
      const from = dayjs(fromTs).toISOString()
      const to = dayjs(toTs).add(1, 'hour').toISOString()
      setStartDate(from)
      setEndDate(to)
      doSearch({ startDate: from, endDate: to })
    } else if (fromTs) {
      const t = dayjs(fromTs)
      const from = t.subtract(30, 'minute').toISOString()
      const to = t.add(30, 'minute').toISOString()
      setStartDate(from)
      setEndDate(to)
      doSearch({ startDate: from, endDate: to })
    }
  }, [dragging, dragStart, dragEnd, data, setStartDate, setEndDate, doSearch])

  if (!histogram.length) return null

  const stroke = isDark ? '#2a3648' : '#d3dae6'
  const fill = isDark ? '#EF843C' : '#324059'
  const selStart = dragStart !== null ? Math.min(dragStart, dragEnd ?? dragStart) : null
  const selEnd = dragStart !== null ? Math.max(dragStart, dragEnd ?? dragStart) : null

  return (
    <div
      className="gcard h-20 overflow-hidden relative select-none"
      ref={chartRef}
      onMouseDown={handleDown}
      onMouseMove={handleMove}
      onMouseUp={handleUp}
      onMouseLeave={() => { if (dragging) { setDragging(false); setDragStart(null); setDragEnd(null) } }}
    >
      {dragging && (
        <div className="absolute top-0 left-0 right-0 text-center text-[8px] text-[#EF843C] dark:text-[#EF843C] bg-[#EF843C]/10 dark:bg-[#EF843C]/10 py-0.5 font-medium z-10">
          Release to filter by time range
        </div>
      )}
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        {selStart !== null && selEnd !== null && dragging && (
          <div className="absolute top-0 bottom-4 bg-[#EF843C]/15 dark:bg-[#EF843C]/15 border-l border-r border-[#EF843C]/40 dark:border-[#EF843C]/40"
            style={{
              left: `${(selStart / data.length) * 100}%`,
              width: `${((selEnd - selStart + 1) / data.length) * 100}%`
            }}
          />
        )}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          style={{ cursor: 'pointer' }}>
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: stroke }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis hide domain={[0, max]} />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              background: isDark ? '#1a2332' : '#fff',
              border: `1px solid ${stroke}`,
              borderRadius: 4,
              color: isDark ? '#e0e4ea' : '#343741'
            }}
            formatter={(v) => [v, 'Events']}
            labelFormatter={(l, p) => p?.[0]?.payload?.ts ? new Date(p[0].payload.ts).toLocaleString() : l}
          />
          <Bar dataKey="count" fill={fill} radius={[1, 1, 0, 0]}
            activeBar={{ fill: isDark ? '#EF843C' : '#1a8bff' }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
