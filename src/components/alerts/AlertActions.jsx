import React, { useState } from 'react'

const ACTIONS = [
  { id: 'acknowledge', label: 'Acknowledge', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-blue-500 hover:bg-blue-600', shortcut: 'A' },
  { id: 'resolve', label: 'Resolve', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-green-500 hover:bg-green-600', shortcut: 'R' },
  { id: 'suppress', label: 'Suppress', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636', color: 'bg-zinc-500 hover:bg-zinc-600', shortcut: 'S' },
  { id: 'share', label: 'Share', icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z', color: 'bg-[#EF843C] hover:bg-[#e0752a]', shortcut: 'H' },
  { id: 'investigate', label: 'Investigate', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', color: 'bg-purple-500 hover:bg-purple-600', shortcut: 'I' },
  { id: 'delete', label: 'Delete', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16', color: 'bg-red-500 hover:bg-red-600', shortcut: 'Del' },
]

export default function AlertActions({ selectedAlerts = [], onAction, onBulkAction }) {
  const [showBulk, setShowBulk] = useState(false)

  const handleBulkAction = (actionId) => {
    onBulkAction?.(actionId, selectedAlerts)
    setShowBulk(false)
  }

  return (
    <div className="space-y-3">
      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-1">
        {ACTIONS.map(action => (
          <button
            key={action.id}
            onClick={() => onAction?.(action.id)}
            disabled={!selectedAlerts.length}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-semibold rounded-lg text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed ${action.color} active:scale-[0.97]`}
            title={`Shortcut: ${action.shortcut}`}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={action.icon}/></svg>
            {action.label}
            <span className="text-[7px] opacity-60 ml-0.5">({action.shortcut})</span>
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {selectedAlerts.length > 1 && (
        <div className="relative">
          <button onClick={() => setShowBulk(!showBulk)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3"/></svg>
            Bulk Actions ({selectedAlerts.length} selected)
          </button>
          {showBulk && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-[#252832] rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-lg overflow-hidden">
              {['acknowledge', 'resolve', 'suppress', 'delete'].map(id => {
                const action = ACTIONS.find(a => a.id === id)
                return (
                  <button key={id} onClick={() => handleBulkAction(id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700/40 transition-colors">
                    <div className={`w-2 h-2 rounded-full ${action?.color.split(' ')[0]}`} />
                    {action?.label} Selected
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/50">
        <div className="text-[8px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Keyboard Shortcuts</div>
        <div className="grid grid-cols-2 gap-1 text-[8px] text-zinc-500">
          {ACTIONS.slice(0, 6).map(a => (
            <div key={a.id} className="flex items-center gap-1.5">
              <kbd className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono text-[8px]">{a.shortcut}</kbd>
              <span>{a.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
