import React from 'react'

const FILTER_CONFIG = {
  severity: {
    label: 'Severity',
    options: [
      { value: '', label: 'All Severities' },
      { value: 'critical', label: 'Critical', color: '#ef4444' },
      { value: 'high', label: 'High', color: '#f97316' },
      { value: 'medium', label: 'Medium', color: '#f59e0b' },
      { value: 'low', label: 'Low', color: '#6b7280' },
    ],
  },
  status: {
    label: 'Status',
    options: [
      { value: '', label: 'All Statuses' },
      { value: 'new', label: 'New' },
      { value: 'acknowledged', label: 'Acknowledged' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'suppressed', label: 'Suppressed' },
    ],
  },
  timeRange: {
    label: 'Time Range',
    options: [
      { value: '', label: 'All Time' },
      { value: '1h', label: 'Last 1 Hour' },
      { value: '24h', label: 'Last 24 Hours' },
      { value: '7d', label: 'Last 7 Days' },
      { value: '30d', label: 'Last 30 Days' },
    ],
  },
  source: {
    label: 'Source',
    options: [
      { value: '', label: 'All Sources' },
    ],
  },
}

export default function AlertFilter({ filters, onChange, sources = [], stats }) {
  const update = (key, value) => {
    onChange?.({ ...filters, [key]: value })
  }

  const activeCount = Object.entries(filters).filter(([, v]) => v && v !== '').length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Filters</span>
        {activeCount > 0 && (
          <button onClick={() => onChange?.({})} className="text-[9px] text-[#EF843C] hover:underline">Clear ({activeCount})</button>
        )}
      </div>

      {/* Quick severity chips */}
      <div className="flex items-center gap-1.5">
        {FILTER_CONFIG.severity.options.filter(o => o.value).map(opt => (
          <button key={opt.value} onClick={() => update('severity', filters.severity === opt.value ? '' : opt.value)}
            className={`flex items-center gap-1 px-2.5 py-1 text-[9px] font-semibold rounded-lg border transition-all ${
              filters.severity === opt.value
                ? 'text-white border-transparent shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
            style={filters.severity === opt.value ? { backgroundColor: opt.color, borderColor: opt.color } : {}}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: filters.severity === opt.value ? '#fff' : opt.color }} />
            {opt.label}
            {stats?.[opt.value] > 0 && (
              <span className={`text-[8px] ml-0.5 ${filters.severity === opt.value ? 'opacity-80' : 'text-zinc-400'}`}>({stats[opt.value]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="text" value={filters.search || ''} onChange={e => update('search', e.target.value)}
          placeholder="Search alerts by title, source, rule..." className="ginput w-full pl-7 pr-2 py-1.5 text-[10px]" />
        {filters.search && (
          <button onClick={() => update('search', '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {/* Dropdown filters */}
      <div className="grid grid-cols-3 gap-1.5">
        {['status', 'timeRange'].map(key => (
          <select key={key} value={filters[key] || ''} onChange={e => update(key, e.target.value)}
            className="ginput px-1.5 py-1.5 text-[9px] font-mono">
            {FILTER_CONFIG[key].options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ))}
        {sources.length > 0 && (
          <select value={filters.source || ''} onChange={e => update('source', e.target.value)}
            className="ginput px-1.5 py-1.5 text-[9px] font-mono">
            <option value="">All Sources</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex items-center gap-2 text-[9px] text-zinc-400 pt-1">
          <span className="font-semibold text-zinc-500">{stats.total} total</span>
          {stats.new > 0 && <span className="text-red-500 font-medium">{stats.new} new</span>}
          {stats.acknowledged > 0 && <span>{stats.acknowledged} ack</span>}
          {stats.resolved > 0 && <span className="text-green-500">{stats.resolved} resolved</span>}
        </div>
      )}
    </div>
  )
}
