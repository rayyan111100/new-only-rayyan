import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api'

const SEV_CLASSES = {
  critical: 'badge-critical',
  warn: 'badge-high',
  ok: 'badge-low',
}
const SEV_DOTS = { critical: '#f85149', warn: '#e8681a', high: '#e8681a', ok: '#3fb950', low: '#3fb950' }

function Bar({ value, color }) {
  return (
    <div className="w-full h-1.5 bg-[#d0d7de] dark:bg-[#1d2432] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
    </div>
  )
}

function SevDot({ sev }) {
  const c = SEV_DOTS[sev] || '#3fb950'
  return <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: c }} />
}

function sortCategories(categories) {
  const order = ['Windows', 'Linux', 'Security Engines', 'Other']
  return [...categories].sort((a, b) => {
    const ia = order.indexOf(a.name)
    const ib = order.indexOf(b.name)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

function AlertRow({ alert }) {
  const cls = alert.sev === 'c' ? 'badge-critical' : alert.sev === 'h' ? 'badge-high' : 'badge-medium'
  return (
    <div className="flex gap-2 py-1.5 border-b border-[#d0d7de]/50 dark:border-[#30363d]/50 last:border-b-0">
      <span className={`badge text-[9px] ${cls} shrink-0 mt-0.5`}>{alert.label}</span>
      <div className="min-w-0">
        <div className="text-xs leading-snug text-[#36454f] dark:text-[#c9d1d9]">{alert.msg}</div>
        <div className="text-[10px] text-[#8b949e] mt-0.5">{alert.time}</div>
      </div>
    </div>
  )
}

function DeviceDetail({ device }) {
  if (!device) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#8b949e]">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <p className="text-xs">Select a device to view details</p>
        </div>
      </div>
    )
  }

  const m = device.metrics || {}

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#e5e7eb] dark:border-[#2d3140] shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-[#8b949e]">
          <span>{device.category}</span>
          <span className="opacity-40">/</span>
          <span>{device.type}</span>
          <span className="opacity-40">/</span>
          <span className="text-[#1f2328] dark:text-[#f0f6fc] font-semibold">{device.name}</span>
        </div>
        <span className={`badge ${SEV_CLASSES[device.sev] || 'badge-low'} ml-auto`}>{device.sevLabel}</span>
      </div>

      <div className="px-4 py-2 border-b border-[#e5e7eb] dark:border-[#2d3140] shrink-0">
        <div className="text-sm font-bold text-[#1f2328] dark:text-[#f0f6fc]">{device.name}</div>
        <div className="text-xs text-[#8b949e] mt-0.5">
          {device.role}
          {device.location ? ` / ${device.location}` : ''}
          {device.lastSeen ? ` / Last seen ${new Date(device.lastSeen).toLocaleString()}` : ''}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 px-4 py-2.5 shrink-0">
        <MetricCard label="Active alerts" value={m.alerts || 0} critical={(m.alerts || 0) > 0} />
        <MetricCard label="Events (7d)" value={(device.totalEvents || 0).toLocaleString()} />
        <MetricCard label="Critical" value={m.critical || 0} critical={(m.critical || 0) > 0} />
        <MetricCard label="High" value={m.high || 0} warn={(m.high || 0) > 0} />
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 pb-4 flex-1 overflow-y-auto auto-rows-min">
        <Panel title="SEVERITY DISTRIBUTION">
          {(device.severityBuckets || []).length === 0 ? (
            <p className="text-xs text-[#8b949e] py-4 text-center">No severity data</p>
          ) : (
            (device.severityBuckets || []).slice(0, 6).map((b, i) => {
              const lvl = parseInt(b.key) || 0
              const pct = device.totalEvents > 0 ? ((b.doc_count || 0) / device.totalEvents * 100) : 0
              const color = lvl >= 15 ? '#f85149' : lvl >= 12 ? '#e8681a' : lvl >= 7 ? '#d29922' : '#3fb950'
              return (
                <div key={i} className="mb-1.5">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-[#8b949e]">Level {lvl}</span>
                    <span className="text-[#1f2328] dark:text-[#f0f6fc] font-bold">{b.doc_count}</span>
                  </div>
                  <Bar value={pct} color={color} />
                </div>
              )
            })
          )}
        </Panel>

        <Panel title="ACTIVE ALERTS">
          {(device.alerts || []).length === 0 ? (
            <p className="text-xs text-[#8b949e] py-4 text-center">No active alerts</p>
          ) : (
            (device.alerts || []).map((a, i) => <AlertRow key={i} alert={a} />)
          )}
        </Panel>

        <Panel title="ACTIVITY SUMMARY">
          <div className="space-y-2">
            <ActivityRow label="Total events" value={(device.totalEvents || 0).toLocaleString()} />
            <ActivityRow label="Alert events" value={(m.alerts || 0).toLocaleString()} />
            <ActivityRow label="Critical" value={(m.critical || 0).toLocaleString()} color="#f85149" />
            <ActivityRow label="High" value={(m.high || 0).toLocaleString()} color="#e8681a" />
            <ActivityRow label="Medium" value={(m.medium || 0).toLocaleString()} color="#d29922" />
            <ActivityRow label="Low" value={(m.low || 0).toLocaleString()} color="#3fb950" />
          </div>
        </Panel>

        <Panel title="ASSET DETAILS">
          <table className="w-full">
            <tbody>
              {[
                ['Name', device.name],
                ['Type', device.type],
                ['Category', device.category],
                ['Role', device.role],
                ['Source', device.location || 'N/A'],
                ['Last seen', device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'N/A'],
                ['Alert status', device.sevLabel],
              ].map(([k, v], i) => (
                <tr key={i}>
                  <td className="text-xs text-[#8b949e] py-1 pr-2 w-[40%] whitespace-nowrap">{k}</td>
                  <td className="text-xs text-[#36454f] dark:text-[#c9d1d9] font-medium py-1">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  )
}

const CARD_CLS = 'bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl p-3 shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[2px] dark:hover:shadow-[0_8px_30px_rgba(232,104,26,0.12)] hover:border-[#e8681a]/30 dark:hover:border-[#e8681a]/40'

function MetricCard({ label, value, critical, warn }) {
  let valColor = 'text-[#1f2328] dark:text-[#f0f6fc]'
  let deltaText = ''
  let deltaClass = ''
  if (critical) { valColor = 'text-[#f85149]'; deltaText = 'Critical'; deltaClass = 'text-[#f85149]' }
  else if (warn) { valColor = 'text-[#e8681a]'; deltaText = 'Warning'; deltaClass = 'text-[#e8681a]' }
  else { deltaText = 'Stable'; deltaClass = 'text-[#3fb950]' }

  return (
    <div className={CARD_CLS}>
      <div className="text-[10px] uppercase tracking-wide font-bold text-[#8b949e] mb-0.5">{label}</div>
      <div className={`text-lg font-bold ${valColor}`}>{value}</div>
      <div className={`text-[10px] font-medium ${deltaClass}`}>{deltaText}</div>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div className={CARD_CLS}>
      <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-3">{title}</div>
      {children}
    </div>
  )
}

function ActivityRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="flex items-center gap-2 text-xs text-[#36454f] dark:text-[#c9d1d9]">
        {color && <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: color }} />}
        {label}
      </span>
      <span className="text-xs font-bold text-[#1f2328] dark:text-[#f0f6fc]">{value}</span>
    </div>
  )
}

export default function DashboardNewTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedCats, setExpandedCats] = useState(new Set())
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api('asset-inventory', { start_date: 'now-7d', end_date: 'now' })
      if (res.success) {
        setData(res)
        const cats = sortCategories(res.categories || [])
        if (cats.length > 0) {
          setExpandedCats(new Set([cats[0].name]))
          if (cats[0].devices.length > 0) setSelectedDevice(cats[0].devices[0])
        }
      } else {
        setError('Invalid response from server')
      }
    } catch (err) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleCategory = useCallback((catName) => {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(catName)) next.delete(catName)
      else next.add(catName)
      return next
    })
  }, [])

  const selectDevice = useCallback((device) => setSelectedDevice(device), [])

  const handleSearch = useCallback((e) => setSearchQuery(e.target.value.toLowerCase()), [])

  const categories = data ? sortCategories(data.categories || []) : []
  const summary = data?.summary || {}

  const filteredCategories = searchQuery
    ? categories.map(cat => ({
        ...cat,
        devices: cat.devices.filter(d =>
          d.name.toLowerCase().includes(searchQuery) ||
          d.type.toLowerCase().includes(searchQuery) ||
          d.role.toLowerCase().includes(searchQuery)
        )
      })).filter(cat => cat.devices.length > 0)
    : categories

  const allDevices = categories.flatMap(c => c.devices)
  const selectedName = selectedDevice?.name
  const activeDevice = allDevices.find(d => d.name === selectedName) || selectedDevice

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-8 h-8 mx-auto mb-3 animate-spin text-[#e8681a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" />
          </svg>
          <p className="text-xs text-[#8b949e]">Loading asset inventory...</p>
        </div>
      </motion.div>
    )
  }

  if (error && !data) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 flex items-center justify-center">
        <div className="text-center max-w-xs">
          <svg className="w-10 h-10 mx-auto mb-3 text-[#f85149]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs text-[#8b949e] mb-3">{error}</p>
          <button onClick={fetchData} className="bg-transparent border border-[#d0d7de] dark:border-[#30363d] text-[#36454f] dark:text-[#c9d1d9] px-3 py-1 rounded text-xs hover:bg-[#f0f2f4] dark:hover:bg-[#21262d] hover:border-[#e8681a] transition-all">Retry</button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="p-3">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[11px] text-[#8b949e]">Dashboard / <span className="text-[#e8681a]">Asset Inventory</span></div>
          <div className="text-xl font-bold text-[#1f2328] dark:text-[#f0f6fc] tracking-tight">Asset Inventory</div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[#8b949e]">
          {summary.totalAssets || 0} assets &middot; {summary.totalAlerts || 0} alerts
          {summary.criticalCount > 0 ? ` &middot; ${summary.criticalCount} critical` : ''}
        </div>
      </div>

      <div className="flex border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl overflow-hidden bg-white dark:bg-[#16181f]">

        <aside className="w-[220px] shrink-0 bg-[#f6f8fa] dark:bg-[#0d1117] border-r border-[#e5e7eb] dark:border-[#2d3140] flex flex-col">
          <div className="px-3 py-2.5 border-b border-[#e5e7eb] dark:border-[#2d3140]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1f2328] dark:text-[#f0f6fc]">
              <svg className="w-4 h-4 text-[#e8681a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              Asset inventory
            </div>
          </div>

          <div className="px-2.5 py-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full text-xs bg-white dark:bg-[#16181f] border border-[#d0d7de] dark:border-[#30363d] rounded-lg px-2 py-1.5 text-[#36454f] dark:text-[#c9d1d9] placeholder-[#8b949e] outline-none focus:border-[#e8681a] dark:focus:border-[#e8681a] transition-colors"
              aria-label="Search assets"
            />
          </div>

          <nav className="flex-1 overflow-y-auto py-1" aria-label="Asset categories">
            {filteredCategories.map(cat => (
              <div key={cat.name}>
                <button
                  onClick={() => toggleCategory(cat.name)}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#8b949e] hover:bg-white dark:hover:bg-[#16181f] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cat.color }} />
                  <span className="flex-1 text-left">{cat.name}</span>
                  {cat.devices.filter(d => d.sev === 'critical').length > 0 && (
                    <span className="badge badge-critical text-[9px]">{cat.devices.filter(d => d.sev === 'critical').length}</span>
                  )}
                  <svg className={`w-2.5 h-2.5 transition-transform ${expandedCats.has(cat.name) ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                <AnimatePresence>
                  {expandedCats.has(cat.name) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="overflow-hidden"
                    >
                      {cat.devices.map(d => {
                        const isActive = activeDevice?.name === d.name
                        return (
                          <button
                            key={d.name}
                            onClick={() => selectDevice(d)}
                            className={`w-full flex items-center gap-1.5 pl-8 pr-2.5 py-1 text-xs text-left border-l-2 transition-all ${
                              isActive
                                ? 'bg-white dark:bg-[#16181f] text-[#1f2328] dark:text-[#f0f6fc] font-bold border-l-[#e8681a]'
                                : 'text-[#8b949e] border-l-transparent hover:bg-white dark:hover:bg-[#16181f] hover:text-[#1f2328] dark:hover:text-[#f0f6fc]'
                            }`}
                          >
                            <SevDot sev={d.sev} />
                            <span>{d.name}</span>
                            {d.metrics?.alerts > 0 && (
                              <span className="ml-auto badge badge-critical text-[9px]">{d.metrics.alerts}</span>
                            )}
                          </button>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {filteredCategories.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-[#8b949e]">
                {searchQuery ? 'No matching assets' : 'No assets found'}
              </div>
            )}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col bg-white dark:bg-[#16181f] min-w-0" role="main" aria-label="Device details">
          <DeviceDetail device={activeDevice} />
        </main>
      </div>
    </motion.div>
  )
}