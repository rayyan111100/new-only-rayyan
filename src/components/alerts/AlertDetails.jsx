import React from 'react'
import { alertService } from './AlertService'

function Field({ label, children }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg">
      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 w-24 shrink-0">{label}</span>
      <div className="text-[11px] text-zinc-700 dark:text-zinc-200 font-mono break-all min-w-0">{children}</div>
    </div>
  )
}

const SEVERITY_MAP = {
  critical: { color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' },
  high: { color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' },
  medium: { color: '#f59e0b', bg: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400' },
  low: { color: '#6b7280', bg: 'bg-gray-50 dark:bg-gray-900/20 text-gray-500' },
}

export default function AlertDetails({ alert, onClose, onRefresh }) {
  if (!alert) return null

  const sev = SEVERITY_MAP[alert.severity] || SEVERITY_MAP.low
  const data = alert.data || {}

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sev.color }} />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">{alert.title}</h3>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${sev.bg}`}>{alert.severity}</span>
              <span>{alert.ruleId && `Rule #${alert.ruleId}`}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors shrink-0">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <Field label="Timestamp">{new Date(alert.timestamp).toLocaleString()}</Field>
        <Field label="Source">{alert.source || 'unknown'}</Field>
        {alert.agentName && <Field label="Agent">{alert.agentName} ({alert.agentId})</Field>}
        <Field label="Status">
          <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded ${
            alert.status === 'new' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
            alert.status === 'acknowledged' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
            alert.status === 'resolved' ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' :
            'bg-zinc-100 text-zinc-500'
          }`}>{alert.status}</span>
        </Field>
        {alert.acknowledgedBy && <Field label="Acknowledged By">{alert.acknowledgedBy} at {new Date(alert.acknowledgedAt).toLocaleString()}</Field>}
        {alert.resolutionNote && <Field label="Resolution Note">{alert.resolutionNote}</Field>}
        {alert.description && (
          <div>
            <div className="text-[10px] font-medium text-zinc-500 mb-1">Description</div>
            <pre className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-3 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 overflow-auto max-h-48 whitespace-pre-wrap">{alert.description}</pre>
          </div>
        )}
        {data.full_log && (
          <div>
            <div className="text-[10px] font-medium text-zinc-500 mb-1">Full Log</div>
            <pre className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-3 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50 overflow-auto max-h-48 whitespace-pre-wrap text-[9px]">{data.full_log}</pre>
          </div>
        )}
        {data.rule && (
          <div>
            <div className="text-[10px] font-medium text-zinc-500 mb-1">Rule</div>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-3 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
              <div>ID: {data.rule.id}</div>
              <div>Level: {data.rule.level}</div>
              <div>Description: {data.rule.description}</div>
              {data.rule.groups && <div>Groups: {Array.isArray(data.rule.groups) ? data.rule.groups.join(', ') : data.rule.groups}</div>}
            </div>
          </div>
        )}
        {data.agent && (
          <div className="grid grid-cols-2 gap-2">
            {data.agent.name && <Field label="Agent Name">{data.agent.name}</Field>}
            {data.agent.id && <Field label="Agent ID">{data.agent.id}</Field>}
            {data.agent.ip && <Field label="Agent IP">{data.agent.ip}</Field>}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
        {alert.status === 'new' && (
          <button onClick={() => { alertService.acknowledge(alert.id); onRefresh?.() }}
            className="flex-1 py-2 text-[10px] font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors">Acknowledge</button>
        )}
        {alert.status !== 'resolved' && (
          <button onClick={() => { alertService.resolve(alert.id); onRefresh?.() }}
            className="flex-1 py-2 text-[10px] font-semibold rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors">Resolve</button>
        )}
        <button onClick={() => { alertService.suppress(alert.id); onRefresh?.() }}
          className="flex-1 py-2 text-[10px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Suppress</button>
        <button onClick={() => { alertService.delete(alert.id); onClose?.() }}
          className="px-3 py-2 text-[10px] font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Delete</button>
      </div>
    </div>
  )
}
