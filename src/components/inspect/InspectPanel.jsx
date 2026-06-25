import React, { useState } from 'react'

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg transition-colors ${active ? 'bg-[#EF843C] text-white' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
      {children}
    </button>
  )
}

function InfoRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg">
      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={`text-[11px] font-mono font-semibold ${color || 'text-zinc-700 dark:text-zinc-200'}`}>{value}</span>
    </div>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function InspectPanel({ query, response, timings, onClose }) {
  const [tab, setTab] = useState('overview')
  const [copied, setCopied] = useState('')

  const copyToClipboard = (label, text) => {
    navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2))
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const downloadJson = (label, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${label.replace(/\s+/g, '_').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const respData = response?.data || response
  const respSize = respData ? new Blob([JSON.stringify(respData)]).size : 0

  const performanceScore = (() => {
    if (!timings?.total) return { score: 'N/A', color: '#9ca3af' }
    const t = timings.total
    if (t < 100) return { score: 'Fast', color: '#10b981' }
    if (t < 500) return { score: 'Moderate', color: '#f59e0b' }
    if (t < 2000) return { score: 'Slow', color: '#f97316' }
    return { score: 'Critical', color: '#ef4444' }
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl w-full max-w-3xl mx-3 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-[#EF843C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <div>
              <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Inspect</h2>
              <p className="text-[10px] text-zinc-400">Query analysis & debugging</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
          {['overview', 'request', 'response', 'timings'].map(t => (
            <TabButton key={t} active={tab === t} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </TabButton>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Total Time</div>
                  <div className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{timings?.total || 0}ms</div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Performance</div>
                  <div className="text-2xl font-bold" style={{ color: performanceScore.color }}>{performanceScore.score}</div>
                </div>
              </div>

              {query && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Query</span>
                    <div className="flex gap-1">
                      <button onClick={() => copyToClipboard('query', query)} className="text-[9px] px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        {copied === 'query' ? 'Copied!' : 'Copy'}
                      </button>
                      <button onClick={() => downloadJson('query', query)} className="text-[9px] px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Download</button>
                    </div>
                  </div>
                  <pre className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-3 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 overflow-auto max-h-48 leading-relaxed">
                    {typeof query === 'string' ? query : JSON.stringify(query, null, 2)}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <InfoRow label="Response Size" value={formatBytes(respSize)} />
                <InfoRow label="Query Time" value={`${timings?.query || 0}ms`} />
                <InfoRow label="Aggregation Time" value={`${timings?.aggregation || 0}ms`} />
                <InfoRow label="Total Hits" value={response?.data?.total || response?.total || 'N/A'} color="text-[#EF843C]" />
              </div>
            </div>
          )}

          {tab === 'request' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Request DSL</span>
                <div className="flex gap-1">
                  <button onClick={() => copyToClipboard('request', query)} className="text-[9px] px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    {copied === 'request' ? 'Copied!' : 'Copy'}
                  </button>
                  <button onClick={() => downloadJson('request', query)} className="text-[9px] px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Download</button>
                </div>
              </div>
              <pre className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-4 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 overflow-auto max-h-96 leading-relaxed">
                {JSON.stringify(query, null, 2)}
              </pre>
            </div>
          )}

          {tab === 'response' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Response</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{formatBytes(respSize)}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => copyToClipboard('response', respData)} className="text-[9px] px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    {copied === 'response' ? 'Copied!' : 'Copy'}
                  </button>
                  <button onClick={() => downloadJson('response', respData)} className="text-[9px] px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Download</button>
                </div>
              </div>
              <pre className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-4 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 overflow-auto max-h-96 leading-relaxed">
                {JSON.stringify(respData, null, 2)}
              </pre>
            </div>
          )}

          {tab === 'timings' && (
            <div className="space-y-4">
              <div className="relative h-8 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                {(timings?.query || timings?.aggregation) && (
                  <div className="absolute inset-0 flex">
                    <div className="h-full bg-[#EF843C] transition-all duration-500" style={{ width: `${Math.min((timings.query / timings.total) * 100, 100)}%` }} title={`Query: ${timings.query}ms`} />
                    <div className="h-full bg-[#8b5cf6] transition-all duration-500" style={{ width: `${Math.min((timings.aggregation / timings.total) * 100, 100)}%` }} title={`Aggregation: ${timings.aggregation}ms`} />
                    <div className="h-full bg-[#10b981] transition-all duration-500" style={{ width: `${Math.max(0, Math.min(((timings.total - timings.query - timings.aggregation) / timings.total) * 100, 100))}%` }} title={`Other: ${timings.total - timings.query - timings.aggregation}ms`} />
                  </div>
                )}
              </div>
              <div className="flex gap-4 justify-center text-[10px]">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#EF843C]" /> Query: {timings?.query || 0}ms</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#8b5cf6]" /> Agg: {timings?.aggregation || 0}ms</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#10b981]" /> Other: {(timings?.total || 0) - (timings?.query || 0) - (timings?.aggregation || 0)}ms</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <InfoRow label="Query Time" value={`${timings?.query || 0}ms`} />
                <InfoRow label="Aggregation Time" value={`${timings?.aggregation || 0}ms`} />
                <InfoRow label="Total Time" value={`${timings?.total || 0}ms`} />
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">Analysis</span>
                <div className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {timings?.total < 100
                    ? 'Query performed exceptionally fast. No optimization needed.'
                    : timings?.total < 500
                    ? 'Query performed within acceptable range. Consider adding filters for large time ranges.'
                    : timings?.total < 2000
                    ? 'Query is slower than ideal. Try reducing time range or adding more specific filters.'
                    : 'Query is critically slow. Reduce time range, add specific filters, or optimize the index pattern.'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
