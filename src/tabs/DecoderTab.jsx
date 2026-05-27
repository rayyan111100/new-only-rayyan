import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import { decodeLog } from '../services/decoderEngine'
import { createRule, updateRule } from '../services/ruleStorage'

const FORMAT_COLORS = {
  json: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 ring-1 ring-green-400/30',
  syslog: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 ring-1 ring-blue-400/30',
  'key=value': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 ring-1 ring-purple-400/30',
  apache: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 ring-1 ring-orange-400/30',
  nginx: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 ring-1 ring-teal-400/30',
  ssh_failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 ring-1 ring-red-400/30',
  ssh_accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 ring-1 ring-green-400/30',
  iptables: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 ring-1 ring-yellow-400/30',
  pfSense: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-amber-400/30',
  netfilter: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 ring-1 ring-yellow-400/30',
  windows_event: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 ring-1 ring-cyan-400/30',
  pfsense_filterlog: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-amber-400/30',
  delimited: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 ring-1 ring-gray-400/30',
  generic: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 ring-1 ring-pink-400/30',
  unknown: 'bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400 ring-1 ring-gray-400/20'
}

function FormatBadge({ format }) {
  const cls = FORMAT_COLORS[format] || FORMAT_COLORS.unknown
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${cls}`}>{format}</span>
}

export default function DecoderTab() {
  const { isDark, setTab } = useApp()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(50)
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [decoded, setDecoded] = useState(null)
  const [copyMsg, setCopyMsg] = useState('')
  const [showRaw, setShowRaw] = useState(false)

  const fetchArchives = useCallback(async () => {
    setLoading(true)
    try {
      const params = { index: 'wazuh-archives-4.x-*', limit, sort: '@timestamp', order: 'desc' }
      if (query.trim()) params.q = query.trim()
      const d = await api('search', params)
      const results = d.results || []
      const mapped = results.map((r, i) => ({
        index: i,
        id: r._id || r.id || i,
        timestamp: r['@timestamp'] || '',
        agent: r.agent?.name || '',
        location: r.location || '',
        full_log: r.full_log || r.fullLog || JSON.stringify(r),
        raw: r
      }))
      setLogs(mapped)
      setSelectedIdx(null)
      setDecoded(null)
    } catch (e) {
      setLogs([])
    }
    setLoading(false)
  }, [query, limit])

  useEffect(() => { fetchArchives() }, [])

  const handleSelect = (idx) => {
    setSelectedIdx(idx)
    const log = logs[idx]
    if (log) {
      const result = decodeLog(log.full_log)
      setDecoded(result)
    }
    setShowRaw(false)
  }

  const handleDecodeAll = () => {
    if (!logs.length) return
    const all = logs.map(l => decodeLog(l.full_log))
    const formats = {}
    all.forEach(d => { formats[d.format] = (formats[d.format] || 0) + 1 })
    const out = { total: all.length, formatBreakdown: formats, results: all }
    setDecoded({ format: 'batch', fields: out, raw: 'Batch decode complete' })
    setShowRaw(true)
  }

  const copyField = async (path) => {
    try {
      await navigator.clipboard.writeText(path)
      setCopyMsg(path)
      setTimeout(() => setCopyMsg(''), 1500)
    } catch {}
  }

  const handlePasteToRules = () => {
    if (!decoded || decoded.format === 'unknown') return
    const fields = Object.keys(decoded.fields).map(f => `decoded.${f}`).join('\n')
    try {
      navigator.clipboard.writeText(fields)
      setCopyMsg('Copied all field paths for rules!')
      setTimeout(() => setCopyMsg(''), 2000)
    } catch {}
  }

  const handleCreateRule = () => {
    if (!decoded || decoded.format === 'unknown' || decoded.format === 'batch') return
    const decodedFields = decoded.fields || {}
    const conditions = Object.entries(decodedFields)
      .filter(([, v]) => String(v || '').length > 0 && String(v || '').length < 200)
      .slice(0, 10)
      .map(([k, v]) => ({
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        field: `decoded.${k}`,
        operator: 'equals',
        value: Array.isArray(v) ? v[0] : String(v)
      }))
    const paths = Object.keys(decodedFields).map(k => `decoded.${k}`)
    try {
      const stored = JSON.parse(sessionStorage.getItem('ruleFields') || '[]')
      const merged = [...new Set([...stored, ...paths])].sort((a, b) => a.localeCompare(b))
      sessionStorage.setItem('ruleFields', JSON.stringify(merged))
    } catch {}
    try {
      const rule = createRule({
        name: `Decode: ${decoded.format} — ${Object.keys(decodedFields).slice(0, 3).join(', ')}${Object.keys(decodedFields).length > 3 ? '...' : ''}`
      })
      const patched = { ...rule, conditions }
      updateRule(rule.id, patched)
    } catch {}
    setTab('rules')
    setCopyMsg('Rule created! Switched to Rules tab.')
    setTimeout(() => setCopyMsg(''), 2000)
  }

  const txt = isDark ? 'text-soc-darkstext' : 'text-soc-stext'
  const txt2 = isDark ? 'text-soc-darkstext/60' : 'text-soc-stext/60'
  const bg = isDark ? 'bg-[#16181f] border-[#2d3140]' : 'bg-white border-[#e5e7eb]'
  const hoverBg = isDark ? 'hover:bg-[#2d3140]' : 'hover:bg-[#f3f4f6]'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} className="space-y-2">
      <div className={`flex items-center gap-2 px-2 py-1 border rounded ${bg}`}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af] shrink-0">Archives</span>
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchArchives()}
          placeholder="Search archives or leave empty for latest..."
          className={`flex-1 min-w-[80px] px-1.5 py-1 text-xs border-none outline-none rounded ginput`} />
        <select value={limit} onChange={e => setLimit(parseInt(e.target.value))} className="ginput px-1.5 py-1 text-xs w-14">
          <option>20</option><option>50</option><option>100</option>
        </select>
        <button onClick={fetchArchives} disabled={loading}
          className={`px-2.5 py-1 text-xs font-semibold rounded transition-all whitespace-nowrap shrink-0 ${loading ? 'bg-soc-stext/30 text-white cursor-not-allowed' : 'gbtn-primary'}`}>
          {loading ? '\u23F3' : '\u27F3'}
        </button>
      </div>

      <div className="flex gap-3">
        <div className={`flex-1 min-w-0 ${bg} rounded-xl border overflow-hidden`}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">
            <span className={`text-[11px] uppercase font-semibold ${txt2}`}>
              Logs <span className="text-[#9ca3af]">({logs.length})</span>
            </span>
            {logs.length > 0 && (
              <button onClick={handleDecodeAll} className="text-[10px] px-2 py-0.5 rounded bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-all">
                Decode All
              </button>
            )}
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {loading && <div className="p-4 text-xs text-center text-soc-stext dark:text-soc-darkstext">{'\u23F3'} Loading...</div>}
            {!loading && logs.length === 0 && <div className="p-4 text-xs text-center text-soc-stext/50 dark:text-soc-darkstext/50">No logs. Click search to fetch.</div>}
            {logs.map(log => {
              const isSelected = selectedIdx === log.index
              const prev = decoded && isSelected ? decoded : null
              return (
                <div key={log.id}>
                  <div onClick={() => handleSelect(log.index)}
                    className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-b border-[#e5e7eb] dark:border-[#2d3140]/50 transition-colors ${isSelected ? `${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}` : hoverBg}`}>
                    <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-500' : 'bg-transparent'}`} />
                    <span className="shrink-0 text-[10px] font-mono text-[#9ca3af] w-14">{String(log.timestamp).slice(11, 19)}</span>
                    <span className="shrink-0 text-[10px] text-[#9ca3af] max-w-[80px] truncate">{log.agent || '?'}</span>
                    {prev && <FormatBadge format={prev.format} />}
                    <span className={`flex-1 truncate ${txt}`}>{log.full_log.replace(/\n/g, ' ').substring(0, 120)}</span>
                  </div>
                  <AnimatePresence>
                    {isSelected && decoded && !showRaw && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-b border-[#e5e7eb] dark:border-[#2d3140]">
                        <div className="px-3 py-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <FormatBadge format={decoded.format} />
                            {decoded.format !== 'unknown' && decoded.format !== 'batch' && (
                              <>
                                <button onClick={handlePasteToRules}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-[#f3f4f6] dark:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-all">
                                  Copy All Fields
                                </button>
                                <button onClick={handleCreateRule}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-all">
                                  \u2795 Rule
                                </button>
                              </>
                            )}
                            <button onClick={() => setShowRaw(true)}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-[#f3f4f6] dark:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-all">
                              Raw
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-0.5">
                            {Object.entries(decoded.fields).map(([key, val]) => {
                              const displayVal = Array.isArray(val) ? val.join(', ') : String(val ?? '')
                              return (
                                <div key={key} className="flex items-start gap-2 py-0.5 group">
                                  <button onClick={() => copyField(`decoded.${key}`)}
                                    className={`text-[9px] font-mono font-semibold shrink-0 truncate max-w-[160px] ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'} transition-colors`}
                                    title="Click to copy field path">
                                    decoded.{key}
                                    {copyMsg === `decoded.${key}` && <span className="ml-1 text-green-500">\u2713</span>}
                                  </button>
                                  <span className={`text-[10px] break-all ${txt2}`}>{displayVal.length > 200 ? displayVal.slice(0, 200) + '\u2026' : displayVal}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {isSelected && showRaw && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-b border-[#e5e7eb] dark:border-[#2d3140]">
                        <div className="px-3 py-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setShowRaw(false)}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-all">
                              Decoded View
                            </button>
                            <span className="text-[10px] text-[#9ca3af]">Raw full_log</span>
                          </div>
                          <pre className="text-[10px] font-mono leading-relaxed whitespace-pre-wrap break-all max-h-48 overflow-y-auto p-2 rounded bg-[#0f1117] text-green-400 border border-[#2d3140]">
                            {logs.find(l => l.index === selectedIdx)?.full_log || ''}
                          </pre>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>

        {decoded && decoded.format !== 'batch' && decoded.format !== 'unknown' && (
          <div className={`w-56 shrink-0 ${bg} rounded-xl border overflow-hidden hidden lg:block`}>
            <div className="px-3 py-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">
              <span className="text-[11px] uppercase font-semibold text-[#9ca3af]">Rule Fields</span>
            </div>
            <div className="p-2 space-y-1 max-h-[468px] overflow-y-auto">
              <div className="text-[10px] text-soc-stext dark:text-soc-darkstext mb-2 italic">
                Click a field to copy path, then use in Rule Builder
              </div>
              {Object.keys(decoded.fields).map(key => (
                <button key={key} onClick={() => copyField(`decoded.${key}`)}
                  className={`w-full text-left px-2 py-1 text-[10px] font-mono rounded transition-colors ${isDark ? 'text-blue-400 hover:bg-[#2d3140]' : 'text-blue-600 hover:bg-[#f3f4f6]'}`}>
                  decoded.{key}
                  {copyMsg === `decoded.${key}` && <span className="ml-1 text-green-500 float-right">\u2713</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {copyMsg && copyMsg.startsWith('Copied') && (
        <div className="fixed bottom-4 right-4 px-3 py-2 rounded-lg bg-green-600 text-white text-xs shadow-lg z-50">
          {copyMsg}
        </div>
      )}
    </motion.div>
  )
}
