import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import DateRangePicker from '../components/DateRangePicker'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'



const WIDGETS = {
  metricTotal: { title: 'Total Windows Events', cols: 1, icon: 'file-text', category: 'metrics' },
  metricSecurity: { title: 'Security Events', cols: 1, icon: 'shield-check', category: 'metrics' },
  metricFailed: { title: 'Failed Logons', cols: 1, icon: 'user-x', category: 'metrics' },
  metricRate: { title: 'Event Rate', cols: 1, icon: 'trending-up', category: 'metrics' },
  metricCritical: { title: 'Critical Alerts', cols: 1, icon: 'alert-triangle', category: 'metrics' },
  alertSeverity: { title: 'Alert Severity', cols: 1, category: 'charts' },
  eventsByAgent: { title: 'Events by Agent', cols: 1, category: 'charts' },
  eventTimeline: { title: 'Event Timeline', cols: 3, category: 'charts' },
  topEventIds: { title: 'Top Event IDs (Windows)', cols: 1, category: 'tables' },
  eventDetails: { title: 'Windows Event Details', cols: 2, category: 'details' },
  recentEvents: { title: 'Recent Windows Events', cols: 2, category: 'tables' },
  eventDistribution: { title: 'Event Distribution', cols: 1, category: 'charts' },
  logonActivity: { title: 'Logon Activity', cols: 1, category: 'charts' },
  powershellActivity: { title: 'PowerShell Activity', cols: 1, category: 'lists' },
  processCreation: { title: 'Process Creation (4688)', cols: 1, category: 'lists' },
  mitreMapping: { title: 'MITRE ATT&CK Mapping', cols: 1, category: 'lists' }
}

const DEFAULT_ORDER = [
  'metricTotal', 'metricSecurity', 'metricFailed', 'metricRate', 'metricCritical',
  'alertSeverity', 'eventsByAgent', 'eventTimeline',
  'topEventIds', 'eventDetails', 'recentEvents',
  'eventDistribution', 'logonActivity', 'powershellActivity', 'processCreation', 'mitreMapping'
]

const STORAGE_KEY = 'unishield_windows_event_order'

const SVG_ICONS = {
  'file-text': <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  'shield-check': <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
  'user-x': <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>,
  'trending-up': <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  'alert-triangle': <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  terminal: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  anchor: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>,
  'arrow-up-circle': <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/></svg>,
  'eye-off': <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  key: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="2" cy="2" r="2"/><path d="M6 6l4 4"/><path d="M12 4c-.6.6-1 1.5-1 2.5s.4 1.9 1 2.5l-1.5 1.5L13 14l1.5-1.5c.6.6 1.5 1 2.5 1s1.9-.4 2.5-1"/></svg>,
  search: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  'arrows-horizontal': <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 17 20 12 15 7"/><polyline points="9 7 4 12 9 17"/></svg>,
  database: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  'alert-circle': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  'arrow-right': <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  x: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  grip: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>,
  'plus': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  'settings': <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
}

function SevBadge({ sev }) {
  const cls = sev === 'critical' ? 'badge-critical' : sev === 'high' ? 'badge-high' : sev === 'medium' ? 'badge-medium' : 'badge-low'
  const label = sev.charAt(0).toUpperCase() + sev.slice(1)
  return <span className={`badge ${cls}`}>{label}</span>
}

function Modal({ title, children, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="gcard w-[460px] max-h-[70vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-3.5">
          <span className="text-sm font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">{title}</span>
          <button onClick={onClose} className="text-[#9ca3af] dark:text-[#6b7280] hover:text-[#1a1c23] dark:hover:text-[#e4e6eb] transition-colors">{SVG_ICONS.x}</button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

function SortableCard({ id, children, cols }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${cols}`
  }
  return (
    <div ref={setNodeRef} style={style}
      className={`relative group ${isDragging ? 'z-10 opacity-50' : ''}`}>
      <div className="gcard h-full relative">
        <div {...attributes} {...listeners}
          className="absolute top-1 right-1 z-10 w-6 h-6 flex items-center justify-center rounded cursor-grab active:cursor-grabbing text-[#9ca3af] dark:text-[#6b7280] hover:text-[#e8681a] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors opacity-0 group-hover:opacity-100">
          {SVG_ICONS.grip}
        </div>
        {children}
      </div>
    </div>
  )
}

function FilterBtns({ field, value, operator, label }) {
  const { addFilter, doSearch } = useApp()
  const hFilter = (e, negate) => { e.stopPropagation(); addFilter(field, value, negate, operator); doSearch() }
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
      <button onClick={e => hFilter(e, false)} className="p-0.5 rounded hover:bg-[#EF843C]/20 text-[#9ca3af] dark:text-[#6b7280] hover:text-[#EF843C] dark:hover:text-[#EF843C] transition-all" title={'Filter by ' + label}>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 7h3.5a.5.5 0 1 1 0 1H8v3.5a.5.5 0 1 1-1 0V8H3.5a.5.5 0 0 1 0-1H7V3.5a.5.5 0 0 1 1 0V7Z"/></svg>
      </button>
      <button onClick={e => hFilter(e, true)} className="p-0.5 rounded hover:bg-red-500/20 text-[#9ca3af] dark:text-[#6b7280] hover:text-red-500 transition-all" title={'Filter out ' + label}>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 7h8a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1Z"/></svg>
      </button>
    </span>
  )
}

function MetricCard({ label, value, change, changeColor, icon, color, onClick, filterField, filterValue, filterOperator }) {
  return (
    <div className="w-full p-2.5 group">
      <div className="flex items-start justify-between">
        <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] dark:text-[#6b7280] font-semibold">{label}</div>
        <div className="flex items-center gap-1">
          {filterField && filterValue && (
            <FilterBtns field={filterField} value={filterValue} operator={filterOperator} label={label} />
          )}
          <div className="w-7 h-7 rounded-full bg-[#f3f4f6] dark:bg-[#2d3140] flex items-center justify-center" style={{ color }}>
            {SVG_ICONS[icon]}
          </div>
        </div>
      </div>
      <button onClick={onClick} className="w-full text-left">
        <div className="text-xl font-bold text-[#1a1c23] dark:text-[#e4e6eb] mt-1">{value}</div>
        {change !== null && (
          <div><span className={`${changeColor} text-[10px] font-medium`}>{change}</span> <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">vs last 24h</span></div>
        )}
      </button>
    </div>
  )
}

const SEVERITIES = [
  { key: 'critical', label: 'Critical', color: '#f85149', min: 12 },
  { key: 'high', label: 'High', color: '#e8681a', min: 7 },
  { key: 'medium', label: 'Medium', color: '#d29922', min: 4 },
  { key: 'low', label: 'Low', color: '#58a6ff', min: 1 }
]

function toSeverity(level) {
  const n = parseInt(level) || 0
  for (const s of SEVERITIES) if (n >= s.min) return s.key
  return 'low'
}

function groupSeverity(buckets) {
  const map = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const b of buckets) {
    const s = toSeverity(b.key)
    map[s] = (map[s] || 0) + b.doc_count
  }
  return map
}

function AlertSeverityWidget({ data }) {
  const sevMap = groupSeverity(data?.byLevel || [])
  const total = Object.values(sevMap).reduce((a, b) => a + b, 0)
  return (
    <div className="p-2.5">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[11px] font-semibold text-[#1a1c23] dark:text-[#e4e6eb] uppercase tracking-wider">Alert Severity</h3>
        <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">{(data?.count24 || 0).toLocaleString()} Total</span>
      </div>
      {SEVERITIES.map(s => {
        const count = sevMap[s.key] || 0
        const pct = total ? Math.round((count / total) * 100) : 0
        return (
          <div key={s.key} className="flex items-center gap-1.5 w-full py-1 px-1 rounded group">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }}></span>
            <span className="text-[11px] text-[#1a1c23] dark:text-[#e4e6eb] flex-1 text-left">{s.label}</span>
            <div className="flex-1 h-1 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden max-w-[80px]">
              <div className="h-full rounded-full" style={{ width: pct + '%', background: s.color }}></div>
            </div>
            <span className="text-[11px] text-[#9ca3af] dark:text-[#6b7280] min-w-[50px] text-right">{count.toLocaleString()}</span>
            <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">({pct}%)</span>
            <FilterBtns field="rule.level" value={String(s.min)} operator="is greater than or equal" label={s.label + ' severity'} />
          </div>
        )
      })}
    </div>
  )
}

function EventsByAgentWidget({ data }) {
  const agents = (data?.topAgents || []).slice(0, 8)
  const max = Math.max(1, ...agents.map(a => a.doc_count))
  return (
    <div className="p-2.5">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[11px] font-semibold text-[#1a1c23] dark:text-[#e4e6eb] uppercase tracking-wider">Events by Agent</h3>
        <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">{(data?.count24 || 0).toLocaleString()} Total</span>
      </div>
      {agents.map(a => (
        <div key={a.key} className="flex items-center gap-1.5 w-full py-1 px-1 rounded group">
          <span className="text-[11px] text-[#1a1c23] dark:text-[#e4e6eb] w-[80px] text-left shrink-0 truncate">{a.key}</span>
          <div className="flex-1 h-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#e8681a]" style={{ width: (a.doc_count / max) * 100 + '%' }}></div>
          </div>
          <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280] min-w-[60px] text-right">{a.doc_count.toLocaleString()}</span>
          <FilterBtns field="agent.name" value={a.key} label={'agent ' + a.key} />
        </div>
      ))}
    </div>
  )
}

function EventTimelineWidget({ data }) {
  const timeline = (data?.timeline || []).slice(-24)
  return (
    <div className="p-2.5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[11px] font-semibold text-[#1a1c23] dark:text-[#e4e6eb] uppercase tracking-wider">Event Timeline</h3>
        <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">Last 24 Hours</span>
      </div>
      <div className="flex gap-3 flex-wrap mb-1.5">
        <span className="flex items-center gap-1 text-[10px] text-[#9ca3af] dark:text-[#6b7280]"><span className="w-2 h-2 rounded-full bg-[#e8681a] inline-block"></span>Total Events</span>
        <span className="flex items-center gap-1 text-[10px] text-[#9ca3af] dark:text-[#6b7280]"><span className="w-2 h-2 rounded-full bg-[#f85149] inline-block"></span>Failed Logons</span>
      </div>
      <div className="h-[140px]">
        {timeline.length === 0 ? (
          <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] h-full flex items-center justify-center">No timeline data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline.map(b => ({ time: new Date(b.key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), alerts: b.doc_count }))} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="alerts" stroke="#e8681a" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function TopEventIdsWidget({ data }) {
  const eventIds = (data?.topEventIds || []).slice(0, 8)
  return (
    <div className="p-2.5">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[11px] font-semibold text-[#1a1c23] dark:text-[#e4e6eb] uppercase tracking-wider">Top Event IDs</h3>
        <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">{eventIds.length}</span>
      </div>
      {eventIds.length === 0 ? (
        <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] py-4 text-center">No data</div>
      ) : (
        <div className="space-y-1">
          {eventIds.map((ev, i) => (
            <div key={ev.key || i} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors group">
              <span className="w-8 text-center text-[#9ca3af] dark:text-[#6b7280] text-[10px] font-mono shrink-0">{ev.key || '--'}</span>
              <div className="flex-1 h-1 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#e8681a]" style={{ width: Math.min(100, (ev.doc_count / (eventIds[0]?.doc_count || 1)) * 100) + '%' }}></div>
              </div>
              <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280] min-w-[50px] text-right">{ev.doc_count.toLocaleString()}</span>
              <FilterBtns field="win.event_id" value={String(ev.key)} label={'event ID ' + ev.key} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EventDetailsWidget({ data }) {
  const totalFailed = data?.logonFailed || 0
  return (
    <div className="p-2.5">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[11px] font-semibold text-[#1a1c23] dark:text-[#e4e6eb] uppercase tracking-wider">Windows Event Details</h3>
      </div>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 bg-[#e8681a] rounded flex items-center justify-center text-white text-sm">{SVG_ICONS['alert-circle']}</div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Event ID 4625 – Failed Logon</div>
          <SevBadge sev="high" />
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-[#1a1c23] dark:text-[#e4e6eb]">{totalFailed.toLocaleString()}</div>
          <div className="text-[9px] text-[#9ca3af] dark:text-[#6b7280]">Total Events</div>
        </div>
      </div>
      <p className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] mb-2">An account failed to log on.</p>
      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        <div><div className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">Event ID</div><div className="text-xs text-[#1a1c23] dark:text-[#e4e6eb]">4625</div></div>
        <div><div className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">Log Type</div><div className="text-xs text-[#1a1c23] dark:text-[#e4e6eb]">Security</div></div>
        <div><div className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">Keywords</div><div className="text-xs text-[#1a1c23] dark:text-[#e4e6eb]">Audit Failure</div></div>
        <div><div className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">Level</div><div className="text-xs text-[#1a1c23] dark:text-[#e4e6eb]">Information</div></div>
      </div>
    </div>
  )
}

function RecentEventsWidget({ data }) {
  const recent = (data?.recent || []).slice(0, 5)
  return (
    <div className="p-2.5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold text-[#1a1c23] dark:text-[#e4e6eb] uppercase tracking-wider">Recent Windows Events</h3>
      </div>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">
            <th className="text-left pb-1 pr-1 font-medium">Time</th>
            <th className="text-left pb-1 pr-1 font-medium">Host</th>
            <th className="text-left pb-1 pr-1 font-medium hidden sm:table-cell">Source</th>
            <th className="text-left pb-1 font-medium">Sev</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((ev, i) => {
            const lv = ev.rule?.level || 0
            const sev = lv >= 12 ? 'critical' : lv >= 7 ? 'high' : lv >= 4 ? 'medium' : 'low'
            return (
              <tr key={ev._id || i} className="border-b border-[#f3f4f6] dark:border-[#2d3140]/30 hover:bg-[#f9fafb] dark:hover:bg-[#2d3140]/30 transition-colors group">
                <td className="py-1 pr-1 whitespace-nowrap text-[#6b7280] dark:text-[#9ca3af]">{ev['@timestamp'] ? new Date(ev['@timestamp']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                <td className="py-1 pr-1 text-[#1a1c23] dark:text-[#e4e6eb]">
                  <span className="inline-flex items-center gap-1">
                    {ev.agent?.name || '--'}
                    {ev.agent?.name && <FilterBtns field="agent.name" value={ev.agent.name} label={'agent ' + ev.agent.name} />}
                  </span>
                </td>
                <td className="py-1 pr-1 hidden sm:table-cell text-[#6b7280] dark:text-[#9ca3af]">
                  <span className="inline-flex items-center gap-1">
                    {ev.rule?.groups?.[0] || '--'}
                    {ev.rule?.groups?.[0] && <FilterBtns field="rule.groups" value={ev.rule.groups[0]} label={'group ' + ev.rule.groups[0]} />}
                  </span>
                </td>
                <td className="py-1"><SevBadge sev={sev} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EventDistributionWidget({ data }) {
  const categories = (data?.byLevel || []).slice(0, 5)
  const colors = ['#e8681a', '#58a6ff', '#3fb950', '#d29922', '#7c3aed']
  const total = categories.reduce((a, b) => a + b.doc_count, 0) || 1
  return (
    <div className="p-2.5">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[11px] font-semibold text-[#1a1c23] dark:text-[#e4e6eb] uppercase tracking-wider">Event Distribution</h3>
        <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280">{(data?.count24 || 0).toLocaleString()} Total</span>
      </div>
      <div className="h-24">
        {categories.length === 0 ? (
          <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] h-full flex items-center justify-center">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categories.map((c, i) => ({ name: c.key, value: c.doc_count }))}
                cx="50%" cy="50%" innerRadius={30} outerRadius={45} dataKey="value" borderWidth={0}>
                {categories.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-1 space-y-0.5">
        {categories.map((c, i) => (
          <div key={c.key || i} className="flex items-center gap-1.5 py-0.5 px-1 rounded group">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[i % colors.length] }}></span>
            <span className="text-[10px] text-[#1a1c23] dark:text-[#e4e6eb] flex-1 truncate">{c.key}</span>
            <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">{Math.round((c.doc_count / total) * 100)}%</span>
            <FilterBtns field="rule.level" value={String(c.key)} label={'level ' + c.key} />
          </div>
        ))}
      </div>
    </div>
  )
}

function LogonActivityWidget({ data }) {
  const totalFailed = data?.logonFailed || 0
  const totalEvents = data?.count24 || 1
  const successCount = Math.max(0, totalEvents - totalFailed)
  const successPct = Math.round((successCount / totalEvents) * 100)
  const failedPct = Math.round((totalFailed / totalEvents) * 100)
  return (
    <div className="p-2.5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold text-[#1a1c23] dark:text-[#e4e6eb] uppercase tracking-wider">Logon Activity</h3>
        <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">Last 24 Hours</span>
      </div>
      <div className="flex items-center gap-3 py-1">
        <div className="relative w-[90px] h-[90px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={[
                { name: 'Successful', value: successPct },
                { name: 'Failed', value: Math.max(1, failedPct) }
              ]} cx="50%" cy="50%" innerRadius={32} outerRadius={45} dataKey="value" borderWidth={0}>
                <Cell fill="#3fb950" />
                <Cell fill="#f85149" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">Total</div>
              <div className="text-xs font-bold text-[#1a1c23] dark:text-[#e4e6eb]">{totalEvents.toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#3fb950] shrink-0"></span>
            <span className="text-[10px] text-[#1a1c23] dark:text-[#e4e6eb] flex-1">Successful</span>
            <span className="text-[10px] text-[#3fb950]">{successPct}%</span>
          </div>
          <div className="text-[11px] text-[#3fb950] ml-[14px] mb-2">{successCount.toLocaleString()}</div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f85149] shrink-0"></span>
            <span className="text-[10px] text-[#1a1c23] dark:text-[#e4e6eb] flex-1">Failed</span>
            <span className="text-[10px] text-[#f85149]">{failedPct}%</span>
          </div>
          <div className="text-[11px] text-[#f85149] ml-[14px]">{totalFailed.toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}

function PowershellActivityWidget({ data }) {
  const processes = (data?.processes || []).slice(0, 4)
  return (
    <div className="p-2.5">
      <h3 className="text-[11px] font-semibold text-[#1a1c23] dark:text-[#e4e6eb] uppercase tracking-wider mb-2.5">Powershell Activity</h3>
      <div className="text-[10px] text-[#9ca3af] dark:text-[#6b7280] mb-1.5">Severity</div>
      {[
        { label: 'Info', color: '#58a6ff', count: '-' },
        { label: 'Warning', color: '#d29922', count: '-' },
        { label: 'Suspicious', color: '#e8681a', count: '-' },
        { label: 'Malicious', color: '#f85149', count: '-' }
      ].map(ps => (
        <div key={ps.label} className="flex items-center gap-1.5 py-1 px-1 rounded">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ps.color }}></span>
          <span className="text-[11px] text-[#1a1c23] dark:text-[#e4e6eb] flex-1">{ps.label}</span>
          <span className="text-[11px] text-[#9ca3af] dark:text-[#6b7280]">{processes.find(p => p.key?.toLowerCase().includes(ps.label.toLowerCase()))?.doc_count?.toLocaleString() || ps.count}</span>
        </div>
      ))}
    </div>
  )
}

function ProcessCreationWidget({ data }) {
  const processes = (data?.processes || []).slice(0, 6)
  const maxP = Math.max(1, ...processes.map(p => p.doc_count))
  return (
    <div className="p-2.5">
      <h3 className="text-[11px] font-semibold text-[#1a1c23] dark:text-[#e4e6eb] uppercase tracking-wider mb-2">Process Creation (4688)</h3>
      {processes.length === 0 ? (
        <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] py-4 text-center">No data</div>
      ) : (
        processes.map(p => (
          <div key={p.key || p.doc_count} className="flex items-center gap-1.5 py-0.5 px-1 rounded group">
            <span className="text-[10px] text-[#1a1c23] dark:text-[#e4e6eb] flex-1 truncate">{p.key || '--'}</span>
            <div className="w-[70px] h-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[#e8681a]" style={{ width: (p.doc_count / maxP) * 100 + '%' }}></div>
            </div>
            <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280] min-w-[40px] text-right">{p.doc_count.toLocaleString()}</span>
            <FilterBtns field="win.process.name" value={p.key} label={'process ' + p.key} />
          </div>
        ))
      )}
    </div>
  )
}

function MitreMappingWidget() {
  const MITRE = [
    { name: 'Execution', color: '#f85149', count: 5, sev: 'high' },
    { name: 'Persistence', color: '#e8681a', count: 4, sev: 'medium' },
    { name: 'Privilege Escalation', color: '#f85149', count: 4, sev: 'high' },
    { name: 'Defense Evasion', color: '#e8681a', count: 4, sev: 'medium' },
    { name: 'Credential Access', color: '#e8681a', count: 4, sev: 'medium' },
    { name: 'Discovery', color: '#e8681a', count: 3, sev: 'medium' },
    { name: 'Lateral Movement', color: '#58a6ff', count: 2, sev: 'low' },
    { name: 'Collection', color: '#58a6ff', count: 1, sev: 'low' }
  ]
  return (
    <div className="p-2.5">
      <h3 className="text-[11px] font-semibold text-[#1a1c23] dark:text-[#e4e6eb] uppercase tracking-wider mb-2">MITRE ATT&CK Mapping</h3>
      {MITRE.map(m => (
        <div key={m.name} className="flex items-center gap-1 py-0.5 px-1 rounded hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors group">
          <span className="text-[10px] text-[#1a1c23] dark:text-[#e4e6eb] flex-1">{m.name}</span>
          <div className="flex gap-0.5">
            {[0, 1, 2, 3, 4].map(i => (
              <span key={i} className="w-2 h-2 rounded-full" style={{ background: i < m.count ? m.color : '#f3f4f6' }}></span>
            ))}
          </div>
          <SevBadge sev={m.sev} />
          <FilterBtns field="rule.mitre.tactic" value={m.name} label={'MITRE ' + m.name} />
        </div>
      ))}
    </div>
  )
}

export default function WindowsEventTab() {
  const { startDate, endDate } = useApp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [cardOrder, setCardOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const valid = parsed.filter(id => WIDGETS[id])
        if (valid.length > 0) return valid
      }
    } catch {}
    return [...DEFAULT_ORDER]
  })
  const [showSettings, setShowSettings] = useState(false)
  const intervalRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchData = useCallback(async () => {
    try {
      const d = await api('windows-dashboard', {
        start_date: startDate,
        end_date: endDate
      })
      setData(d)
      setError(null)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    setLoading(true)
    fetchData()
    intervalRef.current = setInterval(fetchData, 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchData])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cardOrder))
  }, [cardOrder])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setCardOrder(prev => {
      const oldIdx = prev.indexOf(active.id)
      const newIdx = prev.indexOf(over.id)
      if (oldIdx === -1 || newIdx === -1) return prev
      const next = [...prev]
      next.splice(oldIdx, 1)
      next.splice(newIdx, 0, active.id)
      return next
    })
  }, [])

  const toggleCard = useCallback((id) => {
    setCardOrder(prev => {
      const idx = prev.indexOf(id)
      if (idx !== -1) return prev.filter(x => x !== id)
      const insertAt = Math.max(0, ...Object.keys(WIDGETS).map(k => {
        const p = prev.indexOf(k)
        return p !== -1 ? p : -1
      })) + 1
      const next = [...prev]
      const defIdx = DEFAULT_ORDER.indexOf(id)
      let pos = 0
      for (let i = 0; i < next.length; i++) {
        const defPos = DEFAULT_ORDER.indexOf(next[i])
        if (defPos < defIdx) pos = i + 1
      }
      next.splice(pos, 0, id)
      return next
    })
  }, [])

  const visibleCards = cardOrder.filter(id => WIDGETS[id])
  const hiddenCards = Object.keys(WIDGETS).filter(id => !cardOrder.includes(id))

  const formatTime = (ts) => ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  function renderCard(id) {
    switch (id) {
      case 'metricTotal':
        return <MetricCard label="Total Windows Events" value={(data?.count24 || 0).toLocaleString()} change={data?.count7d ? `↑${Math.round(((data.count24 - data.count7d / 7) / (data.count7d / 7)) * 100)}%` : null} changeColor="text-[#3fb950]" icon="file-text" color="#e8681a" />
      case 'metricSecurity':
        return <MetricCard label="Security Events" value={((data?.byLevel || []).reduce((a, b) => a + b.doc_count, 0) || 0).toLocaleString()} change={null} changeColor="text-[#3fb950]" icon="shield-check" color="#e8681a" />
      case 'metricFailed':
        return <MetricCard label="Failed Logons" value={(data?.logonFailed || 0).toLocaleString()} change={null} changeColor="text-[#f85149]" icon="user-x" color="#f85149" />
      case 'metricRate':
        return <MetricCard label="Event Rate" value={Math.round((data?.count24 || 0) / 24).toLocaleString() + '/hr'} change={null} changeColor="text-[#3fb950]" icon="trending-up" color="#3fb950" />
      case 'metricCritical':
        return <MetricCard label="Critical Alerts" value={Object.entries(groupSeverity(data?.byLevel || []))?.find(([k]) => k === 'critical')?.[1]?.toLocaleString() || '0'} change={null} changeColor="text-[#f85149]" icon="alert-triangle" color="#f85149" filterField="rule.level" filterValue="12" filterOperator="is greater than or equal" />
      case 'alertSeverity':
        return <AlertSeverityWidget data={data} />
      case 'eventsByAgent':
        return <EventsByAgentWidget data={data} />
      case 'eventTimeline':
        return <EventTimelineWidget data={data} />
      case 'topEventIds':
        return <TopEventIdsWidget data={data} />
      case 'eventDetails':
        return <EventDetailsWidget data={data} />
      case 'recentEvents':
        return <RecentEventsWidget data={data} />
      case 'eventDistribution':
        return <EventDistributionWidget data={data} />
      case 'logonActivity':
        return <LogonActivityWidget data={data} />
      case 'powershellActivity':
        return <PowershellActivityWidget data={data} />
      case 'processCreation':
        return <ProcessCreationWidget data={data} />
      case 'mitreMapping':
        return <MitreMappingWidget />
      default:
        return null
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-3">
        <div className="flex gap-1.5 flex-wrap"><div className="h-7 w-44 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-lg animate-pulse" /></div>
        <div className="grid grid-cols-5 gap-2">{[1,2,3,4,5].map(i => <div key={i} className="gcard p-4"><div className="h-16 bg-[#f3f4f6] dark:bg-[#2d3140] rounded animate-pulse"/></div>)}</div>
        <div className="grid grid-cols-[1fr_1fr_2fr] gap-2">{[1,2,3].map(i => <div key={i} className="gcard p-4"><div className="h-40 bg-[#f3f4f6] dark:bg-[#2d3140] rounded animate-pulse"/></div>)}</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="gcard p-6 text-center">
        <div className="text-2xl mb-2">{SVG_ICONS['alert-triangle']}</div>
        <div className="text-sm text-[#dc2626] mb-3">{error}</div>
        <button onClick={fetchData} className="gbtn-primary px-4 py-1.5">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#3fb950] rounded-full inline-block"></span>
            <span className="text-sm font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Windows Event</span>
          </div>
          <span className="gchip text-[10px]">{(data?.count24 || 0).toLocaleString()} alerts</span>
          <span className="gchip text-[10px] bg-[#e8681a]/10 text-[#e8681a]">{visibleCards.length} cards</span>
        </div>
        <div className="flex-1"></div>
        <button onClick={() => setShowSettings(!showSettings)}
          className="gbtn-ghost text-[10px] px-2 py-1 flex items-center gap-1">
          {SVG_ICONS['settings']} {showSettings ? 'Done' : 'Customize'}
        </button>
        <DateRangePicker />
      </motion.div>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="gcard p-3 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold text-[#1a1c23] dark:text-[#e4e6eb] uppercase tracking-wider">Customize Dashboard</h3>
              <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">{visibleCards.length} visible / {Object.keys(WIDGETS).length} total</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(WIDGETS).map(([id, w]) => {
                const active = cardOrder.includes(id)
                return (
                  <button key={id} onClick={() => toggleCard(id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-all border ${
                      active
                        ? 'bg-[#e8681a]/10 text-[#e8681a] border-[#e8681a]/30'
                        : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#6b7280] dark:text-[#9ca3af] border-transparent hover:border-[#e8681a]/30'
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${active ? 'bg-[#e8681a]' : 'bg-[#d0d5dd] dark:bg-[#4b5563]'}`}></span>
                    {w.title}
                  </button>
                )
              })}
            </div>
            <div className="mt-2 text-[10px] text-[#9ca3af] dark:text-[#6b7280]">
              Drag cards by the grip handle <span className="inline-block align-middle">{SVG_ICONS.grip}</span> to reorder. Toggle cards on/off above.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleCards} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-5 gap-2 auto-rows-min">
            {visibleCards.map(id => (
              <SortableCard key={id} id={id} cols={WIDGETS[id].cols}>
                {renderCard(id)}
              </SortableCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {visibleCards.length === 0 && (
        <div className="gcard p-10 text-center">
          <div className="text-3xl mb-2 text-[#9ca3af] dark:text-[#6b7280]">{SVG_ICONS['settings']}</div>
          <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] mb-3">No cards visible. Click "Customize" to add cards.</div>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-[#9ca3af] dark:text-[#6b7280] pt-1">
        <span>Windows Event Dashboard &middot; Drag to reorder &middot; 30s refresh</span>
        <span>Last: {formatTime(lastUpdated)}</span>
      </div>
    </div>
  )
}
