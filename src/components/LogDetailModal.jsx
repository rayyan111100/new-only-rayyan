import React, { useState } from 'react'

export default function LogDetailModal({ log, onClose, label = 'Log Entry' }) {
  const [view, setView] = useState('details')
  const [copied, setCopied] = useState(false)

  if (!log) return null

  const fieldOrder = ['time', 'agent', 'rule', 'ctrl', 'art', 'sev', 'event', 'desc', 'file', 'groups']
  const fieldLabels = {
    time: 'Time',
    agent: 'Agent',
    rule: 'Rule ID',
    ctrl: 'Control',
    art: 'Article',
    sev: 'Severity',
    event: 'Event Type',
    desc: 'Description',
    file: 'File / Resource',
    groups: 'Groups'
  }

  const entries = Object.keys(log)
    .filter(k => k !== 'id' && k !== 'key')
    .sort((a, b) => fieldOrder.indexOf(a) - fieldOrder.indexOf(b))

  const jsonStr = JSON.stringify(log, null, 2)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonStr)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl w-[560px] max-h-[80vh] overflow-hidden shadow-lg flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#d0d7de] dark:border-[#30363d] shrink-0">
          <span className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">{label} — {log.agent} (Rule {log.rule})</span>
          <button onClick={onClose} className="text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] text-lg leading-none">&times;</button>
        </div>

        <div className="flex items-center gap-1 px-5 pt-3 pb-1 shrink-0">
          <button onClick={() => setView('details')}
            className={`text-xs px-3 py-1 rounded-lg font-semibold transition-colors ${view === 'details' ? 'bg-[#e8681a] text-white' : 'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d]'}`}>
            Details
          </button>
          <button onClick={() => setView('json')}
            className={`text-xs px-3 py-1 rounded-lg font-semibold transition-colors ${view === 'json' ? 'bg-[#e8681a] text-white' : 'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d]'}`}>
            JSON
          </button>
          <div className="flex-1" />
          <button onClick={handleCopy}
            className="text-xs px-3 py-1 rounded-lg font-semibold transition-colors text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d] flex items-center gap-1.5">
            {copied ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3fb950" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy JSON</>
            )}
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-3 flex-1">
          {view === 'details' ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {entries.map(k => {
                if (!log[k] && log[k] !== 0) return null
                const val = String(log[k])
                const label = fieldLabels[k] || k.charAt(0).toUpperCase() + k.slice(1)
                const cls = k === 'agent' ? 'text-[#e8681a] font-semibold' :
                  k === 'rule' ? 'text-[#e8681a] font-bold text-sm' :
                  k === 'ctrl' ? 'text-[#a371f7] font-semibold' :
                  k === 'art' ? 'text-[#e8681a] font-semibold' :
                  k === 'sev' ? '' :
                  k === 'event' ? 'text-[#e8681a] font-medium' :
                  k === 'file' ? 'text-[#8b949e] text-[11px] break-all' :
                  k === 'groups' ? 'text-[#e8681a] text-[11px] font-medium' :
                  k === 'desc' ? 'col-span-2 text-[#36454f] dark:text-[#c9d1d9] leading-relaxed' : ''
                const isDesc = k === 'desc'
                const isFile = k === 'file' || k === 'groups'
                return (
                  <div key={k} className={isDesc ? 'col-span-2' : ''}>
                    <div className="text-[10px] text-[#8b949e] uppercase tracking-wide font-semibold mb-0.5">{label}</div>
                    <div className={`text-xs ${cls || 'text-[#36454f] dark:text-[#c9d1d9]'} ${isFile ? '' : ''}`}>{val}</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <pre className="text-xs text-[#c9d1d9] bg-[#0d1117] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-[50vh] font-mono leading-relaxed">{jsonStr}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
