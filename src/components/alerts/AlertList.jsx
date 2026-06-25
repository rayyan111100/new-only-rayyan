import React from 'react'
import { alertService } from './AlertService'

const SEVERITY_CONFIG = {
  critical: { color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-700/50', label: 'Critical' },
  high: { color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-700/50', label: 'High' },
  medium: { color: '#f59e0b', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-700/50', label: 'Medium' },
  low: { color: '#6b7280', bg: 'bg-gray-50 dark:bg-gray-900/20', border: 'border-gray-200 dark:border-gray-700/50', label: 'Low' },
}

function formatTime(ts) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
  return d.toLocaleDateString()
}

export default function AlertList({ alerts, selectedId, onSelect }) {
  if (!alerts?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 dark:text-zinc-500">
        <div className="text-center">
          <svg className="w-10 h-10 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <p className="text-sm font-semibold text-zinc-500">No Alerts</p>
          <p className="text-[10px] mt-1">Alerts will appear here in real-time</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {alerts.map(alert => {
        const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low
        return (
          <button
            key={alert.id}
            onClick={() => onSelect?.(alert.id)}
            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
              selectedId === alert.id
                ? 'bg-white dark:bg-[#252832] border-zinc-300 dark:border-zinc-600 shadow-sm'
                : 'bg-white/50 dark:bg-zinc-800/20 border-transparent hover:bg-white dark:hover:bg-zinc-800/40'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: sev.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${sev.bg}`} style={{ color: sev.color }}>{sev.label}</span>
                  <span className="text-[9px] text-zinc-400 font-mono">{alert.ruleId || ''}</span>
                  <span className="text-[9px] text-zinc-400 ml-auto shrink-0">{formatTime(alert.timestamp)}</span>
                </div>
                <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100 truncate">{alert.title || 'Untitled Alert'}</div>
                <div className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  {alert.agentName && <span className="font-mono">{alert.agentName} · </span>}
                  {alert.source}
                </div>
                {alert.status !== 'new' && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-[8px] font-medium px-1 py-0.5 rounded ${
                      alert.status === 'acknowledged' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                      alert.status === 'resolved' ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' :
                      alert.status === 'suppressed' ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' : ''
                    }`}>{alert.status}</span>
                  </div>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
