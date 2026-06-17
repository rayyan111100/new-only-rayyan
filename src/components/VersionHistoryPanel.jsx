import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { diffLines } from 'diff'
import { getVersionHistory, rollbackToVersion, exportVersionAsRule, getVersion } from '../services/ruleVersionStorage'
import { useToast } from '../context/ToastContext'

function renderDiff(oldText, newText) {
  const changes = diffLines(oldText, newText)
  return changes.map((part, i) => {
    const cls = part.added ? 'bg-green-100 dark:bg-green-900/25 text-green-800 dark:text-green-200' :
      part.removed ? 'bg-red-100 dark:bg-red-900/25 text-red-800 dark:text-red-200' :
      'text-[#6b7280] dark:text-[#9ca3af]'
    const prefix = part.added ? '+' : part.removed ? '-' : ' '
    return (
      <pre key={i} className={`${cls} px-2 py-0.5 text-[10px] font-mono leading-relaxed whitespace-pre-wrap`}>
        {prefix} {part.value}
      </pre>
    )
  })
}

function snapshotToText(snapshot) {
  const s = { ...snapshot }
  delete s.id; delete s.createdAt; delete s.updatedAt; delete s.groupIds
  return JSON.stringify(s, null, 2)
}

export default function VersionHistoryPanel({ ruleId, onRollback, onExport }) {
  const [versions, setVersions] = useState(() => ruleId ? getVersionHistory(ruleId) : [])
  const [selectedV, setSelectedV] = useState(null)
  const [compareMode, setCompareMode] = useState(false)
  const [v1Idx, setV1Idx] = useState(null)
  const [v2Idx, setV2Idx] = useState(null)
  const [rollbackTarget, setRollbackTarget] = useState(null)
  const toast = useToast()

  function refresh() { if (ruleId) setVersions(getVersionHistory(ruleId)) }

  function handleRollback() {
    if (rollbackTarget === null || !ruleId) return
    const result = rollbackToVersion(ruleId, versions.length - 1 - rollbackTarget, 'Rollback')
    if (result) {
      toast.success('Rolled back to selected version')
      setRollbackTarget(null)
      setSelectedV(null)
      refresh()
      if (onRollback) onRollback(result)
    }
  }

  function handleExport(vIdx) {
    if (!ruleId) return
    const exported = exportVersionAsRule(ruleId, versions.length - 1 - vIdx)
    if (exported) {
      toast.success(`Exported as "${exported.name}"`)
      refresh()
      if (onExport) onExport(exported.id)
    }
  }

  function compareVersions() {
    if (v1Idx === null || v2Idx === null || !ruleId) return
    const a = getVersion(ruleId, versions.length - 1 - v1Idx)
    const b = getVersion(ruleId, versions.length - 1 - v2Idx)
    if (!a || !b) return
    setSelectedV({ v1: a, v2: b, compare: true })
  }

  const currentSnapshot = versions.length > 0 ? versions[versions.length - 1] : null
  const displayList = versions

  if (versions.length === 0) {
    return (
      <div className="text-xs text-[#9ca3af] py-6 text-center italic">
        <svg className="w-8 h-8 mx-auto mb-2 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        No version history yet
      </div>
    )
  }

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase font-semibold text-[#9ca3af] tracking-wider">{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
        {!compareMode && versions.length >= 2 && (
          <button onClick={() => { setCompareMode(true); setV1Idx(null); setV2Idx(null); setSelectedV(null) }}
            className="text-[9px] text-[#EF843C] hover:underline">Compare</button>
        )}
        {compareMode && (
          <button onClick={() => setCompareMode(false)}
            className="text-[9px] text-[#9ca3af] hover:underline">Cancel</button>
        )}
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {displayList.map((v, idx) => (
          <div key={v.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
              selectedV && !selectedV.compare && selectedV.v1 === v
                ? 'bg-[#EF843C]/10 dark:bg-[#EF843C]/20'
                : 'hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'
            } ${compareMode ? 'border border-dashed border-[#d1d5db] dark:border-[#4b5563]' : ''}`}
            onClick={() => {
              if (compareMode) {
                if (v1Idx === null) setV1Idx(idx)
                else if (v2Idx === null && idx !== v1Idx) setV2Idx(idx)
                else { setV1Idx(idx); setV2Idx(null) }
              } else {
                setSelectedV({ v1: v, compare: false })
              }
            }}>
            {compareMode && (
              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                v1Idx === idx ? 'border-[#EF843C] bg-[#EF843C]' :
                v2Idx === idx ? 'border-[#8b5cf6] bg-[#8b5cf6]' :
                'border-[#d1d5db] dark:border-[#4b5563]'
              }`}>
                {(v1Idx === idx || v2Idx === idx) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-soc-stext dark:text-soc-darkstext">v{v.versionNumber}</span>
                <span className="text-[8px] text-[#9ca3af]">{new Date(v.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {v.comment && <div className="text-[9px] text-[#6b7280] dark:text-[#9ca3af] truncate mt-0.5">{v.comment}</div>}
            </div>
            {!compareMode && (
              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100">
                <button onClick={e => { e.stopPropagation(); setRollbackTarget(idx) }}
                  className="p-0.5 text-[#9ca3af] hover:text-[#EF843C] transition-colors" title="Rollback">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4"/></svg>
                </button>
                <button onClick={e => { e.stopPropagation(); handleExport(idx) }}
                  className="p-0.5 text-[#9ca3af] hover:text-[#22c55e] transition-colors" title="Export as new rule">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {compareMode && v1Idx !== null && v2Idx !== null && (
        <button onClick={compareVersions}
          className="w-full mt-2 text-[10px] px-2 py-1.5 bg-[#EF843C] text-white rounded-lg hover:bg-[#e0752a] transition-colors">
          Compare v{displayList[v1Idx].versionNumber} vs v{displayList[v2Idx].versionNumber}
        </button>
      )}

      <AnimatePresence>
        {selectedV && !selectedV.compare && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mt-2 border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg overflow-hidden">
            <div className="text-[9px] uppercase font-semibold text-[#9ca3af] tracking-wider px-2 py-1.5 bg-[#f9fafb] dark:bg-[#0f1117] border-b border-[#e5e7eb] dark:border-[#2d3140]">
              v{selectedV.v1.versionNumber} — {selectedV.v1.comment || 'No comment'}
            </div>
            <div className="max-h-40 overflow-y-auto divide-y divide-[#e5e7eb] dark:divide-[#2d3140] [&>pre]:text-[9px]">
              {renderDiff(
                snapshotToText(selectedV.v1.snapshot),
                snapshotToText(currentSnapshot ? currentSnapshot.snapshot : {})
              )}
            </div>
          </motion.div>
        )}

        {selectedV && selectedV.compare && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-2">
            <div className="border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg overflow-hidden">
              <div className="text-[9px] uppercase font-semibold text-[#9ca3af] tracking-wider px-2 py-1.5 bg-[#f9fafb] dark:bg-[#0f1117] border-b border-[#e5e7eb] dark:border-[#2d3140]">
                Comparing v{selectedV.v1.versionNumber} → v{selectedV.v2.versionNumber}
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-[#e5e7eb] dark:divide-[#2d3140] [&>pre]:text-[9px]">
                {renderDiff(
                  snapshotToText(selectedV.v1.snapshot),
                  snapshotToText(selectedV.v2.snapshot)
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rollbackTarget !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRollbackTarget(null)}>
            <div className="bg-white dark:bg-[#1a1d27] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-xl p-5 max-w-sm w-full mx-3" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-soc-stext dark:text-soc-darkstext mb-2">Rollback to v{displayList[rollbackTarget].versionNumber}?</h3>
              <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mb-4">Rollback will create a new version with the old state. Current state is preserved as the latest version.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setRollbackTarget(null)} className="gbtn text-xs px-3 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-colors">Cancel</button>
                <button onClick={handleRollback} className="gbtn text-xs px-3 py-1.5 bg-orange-600 text-white hover:bg-orange-700 transition-colors">Rollback</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
