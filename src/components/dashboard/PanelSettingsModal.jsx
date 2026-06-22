import React, { useState, useEffect, useRef } from 'react'

const CHART_TYPES = [
  { id: 'bar', label: 'Bar', icon: '📊' },
  { id: 'line', label: 'Line', icon: '📈' },
  { id: 'area', label: 'Area', icon: '📉' },
  { id: 'pie', label: 'Pie', icon: '🥧' },
  { id: 'metric', label: 'Metric', icon: '🔢' },
  { id: 'gauge', label: 'Gauge', icon: '🎯' },
  { id: 'table', label: 'Table', icon: '📋' },
  { id: 'heatmap', label: 'Heatmap', icon: '🗺️' },
  { id: 'timeline', label: 'Timeline', icon: '⏱️' },
  { id: 'clusterbubble', label: 'Cluster Bubble', icon: '🫧' },
]

const FIELD_PRESETS = [
  { label: 'Rule Level', value: 'rule.level' },
  { label: 'Rule ID', value: 'rule.id' },
  { label: 'Rule Description', value: 'rule.description' },
  { label: 'Agent Name', value: 'agent.name' },
  { label: 'Agent ID', value: 'agent.id' },
  { label: 'Agent IP', value: 'agent.ip' },
  { label: 'Timestamp', value: '@timestamp' },
  { label: 'Rule Category', value: 'rule.category' },
  { label: 'Rule Groups', value: 'rule.groups' },
  { label: 'Rule PCI DSS', value: 'rule.pci_dss' },
  { label: 'Rule HIPAA', value: 'rule.hipaa' },
  { label: 'Rule GDPR', value: 'rule.gdpr' },
  { label: 'Rule NIST 800-53', value: 'rule.nist_800_53' },
  { label: 'Rule TSC', value: 'rule.tsc' },
  { label: 'Rule MITRE Tactic', value: 'rule.mitre.tactic' },
  { label: 'Rule MITRE Technique', value: 'rule.mitre.technique' },
  { label: 'Rule MITRE ID', value: 'rule.mitre.id' },
  { label: 'Location', value: 'location' },
  { label: 'Decoder Name', value: 'decoder.name' },
  { label: 'Decoder Parent', value: 'decoder.parent' },
  { label: 'Full Log', value: 'full_log' },
  { label: 'Data Action', value: 'data.action' },
  { label: 'Data Protocol', value: 'data.protocol' },
  { label: 'Data SrcIP', value: 'data.srcip' },
  { label: 'Data DstIP', value: 'data.dstip' },
  { label: 'Data SrcPort', value: 'data.srcport' },
  { label: 'Data DstPort', value: 'data.dstport' },
  { label: 'Data Src Country', value: 'data.srcCountry' },
  { label: 'Data Dst Country', value: 'data.dstCountry' },
  { label: 'Data Hostname', value: 'data.hostname' },
  { label: 'Data Username', value: 'data.username' },
  { label: 'Data Win EventID', value: 'data.win.eventId' },
  { label: 'Data Win Provider', value: 'data.win.provider' },
  { label: 'Data Win LogName', value: 'data.win.logName' },
  { label: 'Data Win EventData', value: 'data.win.eventdata.targetUserName' },
  { label: 'Data Win EventData Domain', value: 'data.win.eventdata.targeDomain' },
  { label: 'Data Win EventData LogonID', value: 'data.win.eventdata.logonId' },
  { label: 'Data Win EventData ProcessID', value: 'data.win.eventdata.processId' },
  { label: 'Data Win EventData Workstation', value: 'data.win.eventdata.workstationName' },
  { label: 'Data Vuln Severity', value: 'data.vulnerability.severity' },
  { label: 'Data Vuln CVSS', value: 'data.vulnerability.cvss' },
  { label: 'Data Vuln CVE', value: 'data.vulnerability.cve' },
  { label: 'Data Vuln Title', value: 'data.vulnerability.title' },
  { label: 'Data Vuln Description', value: 'data.vulnerability.description' },
  { label: 'Data Vuln Solution', value: 'data.vulnerability.solution' },
  { label: 'Data Vuln References', value: 'data.vulnerability.references' },
]

const DEFAULT_TABLE_COLS = ['@timestamp', 'rule.description', 'rule.id', 'rule.level', 'agent.name', 'location', 'full_log']

export default function PanelSettingsModal({ panel, onSave, onClose }) {
  const q = panel.query || {}
  const cfg = panel.vizConfig || {}
  const [title, setTitle] = useState(panel.title || '')
  const [chartType, setChartType] = useState(panel.type || panel.vizType || 'bar')
  const [field, setField] = useState(q.aggregation?.field || 'rule.level')
  const [aggType, setAggType] = useState(q.aggregation?.type || 'terms')
  const [queryStr, setQueryStr] = useState(q.query || cfg.query || '')
  const [limit, setLimit] = useState(q.aggregation?.limit || q.limit || 10)
  const [interval, setInterval] = useState(q.aggregation?.interval || '1h')
  const [fieldSearch, setFieldSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [tableCols, setTableCols] = useState(cfg.tableColumns || DEFAULT_TABLE_COLS)
  const [sortField, setSortField] = useState(q.sort?.field || '@timestamp')
  const [sortOrder, setSortOrder] = useState(q.sort?.order || 'desc')
  const [gaugeMax, setGaugeMax] = useState(cfg.gaugeMax || 100)
  const [bubbleMax, setBubbleMax] = useState(q.aggregation?.limit || 20)
  const [colSearch, setColSearch] = useState('')
  const [gridW, setGridW] = useState(panel.w || 8)
  const [gridH, setGridH] = useState(panel.h || 10)
  const timerRef = useRef(null)

  useEffect(() => {
    setVisible(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)))
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const handleClose = () => {
    setOpen(false)
    timerRef.current = setTimeout(() => { setVisible(false); onClose() }, 300)
  }

  const filteredFields = FIELD_PRESETS.filter(f =>
    !fieldSearch || f.label.toLowerCase().includes(fieldSearch.toLowerCase()) || f.value.toLowerCase().includes(fieldSearch.toLowerCase())
  )

  const filteredColFields = FIELD_PRESETS.filter(f =>
    !colSearch || f.label.toLowerCase().includes(colSearch.toLowerCase()) || f.value.toLowerCase().includes(colSearch.toLowerCase())
  )

  const toggleColumn = (val) => {
    setTableCols(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }

  const handleSave = () => {
    const isChart = ['bar', 'line', 'area', 'pie', 'heatmap', 'timeline'].includes(chartType)
    const isTable = chartType === 'table'
    const isMetric = chartType === 'metric' || chartType === 'gauge'
    const isBubble = chartType === 'clusterbubble'

    const aggField = (isTable || isMetric) ? null : (isBubble ? 'agent.name' : field)
    const aggLimit = isChart || isBubble ? (isBubble ? bubbleMax : limit) : undefined
    const aggIntervalVal = (aggType === 'date_histogram') ? interval : undefined

    const updated = {
      ...panel,
      title,
      w: Math.max(1, gridW),
      h: Math.max(1, gridH),
      type: chartType,
      vizType: chartType,
      query: {
        language: 'lucene',
        query: queryStr || '',
        aggregation: aggField ? {
          field: aggField,
          type: isBubble ? 'terms' : aggType,
          limit: aggLimit,
          interval: aggIntervalVal,
        } : isMetric ? { type: 'count' } : undefined,
        sort: isTable ? { field: sortField, order: sortOrder } : undefined,
        limit: isTable ? limit : undefined,
      },
      vizConfig: {
        ...cfg,
        query: queryStr || '',
        selectedIndex: cfg.selectedIndex || 'unishield360-alerts-4.x-*',
        ...(isTable ? { tableColumns: tableCols } : {}),
        ...(chartType === 'gauge' ? { gaugeMax } : {}),
      },
    }
    onSave(updated)
    handleClose()
  }

  if (!visible) return null

  const colChipStyle = (val) =>
    'px-2 py-1 rounded text-[10px] font-medium border transition-colors cursor-pointer ' +
    (tableCols.includes(val)
      ? 'bg-[#EF843C]/10 border-[#EF843C] text-[#EF843C]'
      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600')

  return (
    <>
      <div className={'fixed inset-0 z-[999] bg-black/20 transition-opacity duration-300 ' + (open ? 'opacity-100' : 'opacity-0')} onClick={handleClose} />
      <div className={'fixed top-0 right-0 w-[500px] max-w-[90%] h-full bg-white dark:bg-[#1a1d27] shadow-[-5px_0_20px_rgba(0,0,0,0.15)] z-[1000] flex flex-col transition-[right] duration-300 ease ' + (open ? 'right-0' : 'right-[-500px]')}>
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-[#1a1d27] flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#EF843C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Panel Settings</h3>
          </div>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="ginput w-full px-3 py-2 text-[12px]" placeholder="Panel title..." />
          </div>

          {/* Chart Type */}
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Chart Type</label>
            <div className="grid grid-cols-5 gap-1.5">
              {CHART_TYPES.map(ct => (
                <button key={ct.id} onClick={() => setChartType(ct.id)}
                  className={'flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg border text-[10px] transition-colors ' +
                    (chartType === ct.id
                      ? 'bg-[#EF843C]/10 border-[#EF843C] text-[#EF843C]'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800')}>
                  <span>{ct.icon}</span>
                  <span className="font-medium">{ct.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Grid Size */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Width (cols)</label>
              <input type="number" value={gridW} onChange={e => setGridW(parseInt(e.target.value) || 1)} min={1} max={48}
                className="ginput w-full px-2 py-2 text-[11px]" title="1 col = ~30-50px depending on screen width" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Height (rows)</label>
              <input type="number" value={gridH} onChange={e => setGridH(parseInt(e.target.value) || 1)} min={1} max={100}
                className="ginput w-full px-2 py-2 text-[11px]" title="1 row = 30px" />
            </div>
          </div>

          {/* Query */}
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Query Filter</label>
            <input value={queryStr} onChange={e => setQueryStr(e.target.value)}
              className="ginput w-full px-3 py-2 text-[11px] font-mono" placeholder="rule.level:12 OR rule.level:15" />
          </div>

          {/* ===== TABLE SETTINGS ===== */}
          {chartType === 'table' && (
            <>
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 block">Columns to Display</label>
                <input value={colSearch} onChange={e => setColSearch(e.target.value)}
                  placeholder="Search columns..." className="ginput w-full px-3 py-2 text-[11px] mb-2" />
                <div className="max-h-40 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 space-y-1">
                  {filteredColFields.map(f => (
                    <label key={f.value} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer text-[11px]">
                      <input type="checkbox" checked={tableCols.includes(f.value)} onChange={() => toggleColumn(f.value)}
                        className="accent-[#EF843C] w-3 h-3" />
                      <span className="text-zinc-700 dark:text-zinc-300">{f.label}</span>
                      <span className="text-[8px] text-zinc-400 ml-auto">{f.value}</span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {tableCols.map(v => {
                    const found = FIELD_PRESETS.find(f => f.value === v)
                    return (
                      <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EF843C]/10 text-[#EF843C] text-[9px] font-medium">
                        {found?.label || v}
                        <button onClick={() => toggleColumn(v)} className="hover:text-red-500">✕</button>
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Sort Field</label>
                  <select value={sortField} onChange={e => setSortField(e.target.value)}
                    className="ginput w-full px-2 py-2 text-[11px]">
                    {FIELD_PRESETS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Sort Order</label>
                  <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}
                    className="ginput w-full px-2 py-2 text-[11px]">
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Max Rows</label>
                <input type="number" value={limit} onChange={e => setLimit(parseInt(e.target.value) || 10)} min={1} max={100}
                  className="ginput w-full px-2 py-2 text-[11px]" />
              </div>
            </>
          )}

          {/* ===== GAUGE SETTINGS ===== */}
          {chartType === 'gauge' && (
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Max Value</label>
              <input type="number" value={gaugeMax} onChange={e => setGaugeMax(parseInt(e.target.value) || 100)} min={1}
                className="ginput w-full px-2 py-2 text-[11px]" />
            </div>
          )}

          {/* ===== CLUSTER BUBBLE SETTINGS ===== */}
          {chartType === 'clusterbubble' && (
            <>
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Agent Field</label>
                <select value={field} onChange={e => setField(e.target.value)}
                  className="ginput w-full px-2 py-2 text-[11px]">
                  {FIELD_PRESETS.filter(f => f.value.startsWith('agent.')).map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Max Bubbles</label>
                <input type="number" value={bubbleMax} onChange={e => setBubbleMax(parseInt(e.target.value) || 20)} min={5} max={100}
                  className="ginput w-full px-2 py-2 text-[11px]" />
              </div>
            </>
          )}

          {/* ===== STANDARD CHART SETTINGS ===== */}
          {!['metric', 'gauge', 'table', 'clusterbubble'].includes(chartType) && (
            <>
              {/* Aggregation Field */}
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Aggregation Field</label>
                <div className="relative">
                  <input value={fieldSearch} onChange={e => setFieldSearch(e.target.value)}
                    placeholder="Search fields..." className="ginput w-full px-3 py-2 text-[11px] mb-1" />
                  <div className="max-h-32 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg">
                    {filteredFields.map(f => (
                      <button key={f.value} onClick={() => { setField(f.value); setFieldSearch('') }}
                        className={'w-full text-left px-3 py-1 text-[10px] font-mono transition-colors ' +
                          (field === f.value ? 'bg-[#EF843C]/10 text-[#EF843C]' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800')}>
                        {f.label}
                        <span className="text-[8px] text-zinc-400 ml-2">{f.value}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Aggregation Type + Limit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Agg Type</label>
                  <select value={aggType} onChange={e => setAggType(e.target.value)}
                    className="ginput w-full px-2 py-2 text-[11px]">
                    <option value="terms">Terms</option>
                    <option value="date_histogram">Date Histogram</option>
                    <option value="cardinality">Cardinality</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Limit</label>
                  <input type="number" value={limit} onChange={e => setLimit(parseInt(e.target.value) || 10)} min={1} max={100}
                    className="ginput w-full px-2 py-2 text-[11px]" />
                </div>
              </div>

              {/* Interval */}
              {aggType === 'date_histogram' && (
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Interval</label>
                  <select value={interval} onChange={e => setInterval(e.target.value)}
                    className="ginput w-full px-2 py-2 text-[11px]">
                    <option value="1h">1 hour</option>
                    <option value="6h">6 hours</option>
                    <option value="12h">12 hours</option>
                    <option value="1d">1 day</option>
                    <option value="7d">7 days</option>
                    <option value="1M">1 month</option>
                  </select>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-[#1a1d27] flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200 dark:border-zinc-700">
          <button onClick={handleClose}
            className="px-4 py-2 text-[10px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
          <button onClick={handleSave}
            className="px-5 py-2 text-[10px] font-semibold rounded-lg bg-gradient-to-r from-[#EF843C] to-[#e0752a] text-white hover:from-[#e0752a] hover:to-[#d0661a] transition-all">Apply & Refresh</button>
        </div>
      </div>
    </>
  )
}
