import React, { useState, useEffect, useRef, useCallback } from 'react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import axios from 'axios'

const CHART_TYPES = [
  { id: 'bar', label: 'Bar', icon: '📊' },
  { id: 'line', label: 'Line', icon: '📈' },
  { id: 'area', label: 'Area', icon: '📉' },
  { id: 'pie', label: 'Pie', icon: '🥧' },
  { id: 'metric', label: 'Metric', icon: '🔢' },
  { id: 'gauge', label: 'Gauge', icon: '🎯' },
  { id: 'table', label: 'Table', icon: '📋' },
  { id: 'data-table', label: 'Data Table', icon: '📋' },
  { id: 'heatmap', label: 'Heatmap', icon: '🗺️' },
  { id: 'timeline', label: 'Timeline', icon: '⏱️' },
  { id: 'tagcloud', label: 'Tag Cloud', icon: '☁️' },
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

function SortableBucketItem({ bucket, fields, onUpdate, onRemove, onToggleEnabled, interval, onIntervalChange, fetchFieldValues }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bucket.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const typeLabels = { terms: 'Terms', date_histogram: 'Date Histogram' }
  const label = bucket.label || `${typeLabels[bucket.type] || bucket.type}${bucket.field ? ': ' + bucket.field : ''}`
  const [showAdv, setShowAdv] = useState(false)
  const [showFilter, setShowFilter] = useState(true)
  const [fieldValues, setFieldValues] = useState([])
  const [loadingValues, setLoadingValues] = useState(false)
  const [valueSearch, setValueSearch] = useState('')

  const isTimestampField = bucket.field && (bucket.field.includes('timestamp') || bucket.field.includes('@timestamp'))

  useEffect(() => {
    if (isTimestampField && bucket.type !== 'date_histogram') {
      onUpdate(bucket.id, { type: 'date_histogram' })
      onIntervalChange({ target: { value: '1M' } })
    }
  }, [bucket.field])

  useEffect(() => {
    if (bucket.field && bucket.type === 'terms') {
      setFieldValues([])
      setValueSearch('')
      setLoadingValues(true)
      fetchFieldValues(bucket.field).then(vals => {
        setFieldValues(vals)
        setLoadingValues(false)
      })
    }
  }, [bucket.field, bucket.type, fetchFieldValues])

  const filteredFieldValues = fieldValues.filter(v =>
    !valueSearch || (v.key && v.key.toString().toLowerCase().includes(valueSearch.toLowerCase()))
  )

  return (
    <div ref={setNodeRef} style={style} className={'border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden ' + (!bucket.enabled ? 'opacity-50' : '')}>
      <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" title="Drag to reorder">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
        </button>
        <button onClick={() => onUpdate(bucket.id, { collapsed: !bucket.collapsed })} className="flex items-center gap-1.5 flex-1 text-left">
          <svg className={'w-3 h-3 text-zinc-400 transition-transform ' + (!bucket.collapsed ? 'rotate-90' : '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">{label}</span>
        </button>
        <button onClick={() => onToggleEnabled(bucket.id)} className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" title={bucket.enabled ? 'Disable aggregation' : 'Enable aggregation'}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {bucket.enabled
              ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
              : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
            }
          </svg>
        </button>
        <button onClick={() => onRemove(bucket.id)} className="p-0.5 text-zinc-400 hover:text-red-500" title="Remove dimension">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      {!bucket.collapsed && (
        <div className="p-3 space-y-2">
          <div className="text-[9px] text-zinc-500 italic -mt-1">X-Axis</div>
          <div>
            <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Aggregation</label>
            <select value={bucket.type} onChange={e => onUpdate(bucket.id, { type: e.target.value })}
              className="ginput w-full px-2 py-1.5 text-[10px]">
              <option value="terms">Terms</option>
              <option value="date_histogram">Date Histogram</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Field</label>
            <select value={bucket.field} onChange={e => onUpdate(bucket.id, { field: e.target.value })}
              className="ginput w-full px-2 py-1.5 text-[10px]">
              {fields.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          {bucket.type === 'terms' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Order by</label>
                  <select value={bucket.orderBy} onChange={e => onUpdate(bucket.id, { orderBy: e.target.value })}
                    className="ginput w-full px-2 py-1.5 text-[10px]">
                    <option value="count">Count</option>
                    <option value="_key">Alphabetical</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Order</label>
                  <select value={bucket.order} onChange={e => onUpdate(bucket.id, { order: e.target.value })}
                    className="ginput w-full px-2 py-1.5 text-[10px]">
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Size</label>
                <input type="number" value={bucket.size} onChange={e => onUpdate(bucket.id, { size: parseInt(e.target.value) || 1 })} min={1} max={100}
                  className="ginput w-full px-2 py-1.5 text-[10px]" />
              </div>
              <label className="flex items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={bucket.otherBucket} onChange={e => onUpdate(bucket.id, { otherBucket: e.target.checked })}
                  className="accent-[#EF843C] w-3 h-3" />
                Group other values in separate bucket
              </label>
              <label className="flex items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={bucket.missingBucket} onChange={e => onUpdate(bucket.id, { missingBucket: e.target.checked })}
                  className="accent-[#EF843C] w-3 h-3" />
                Show missing values
              </label>
              {/* Filter Values */}
              <div>
                <button onClick={() => setShowFilter(v => !v)}
                  className="flex items-center gap-1 text-[9px] font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                  <svg className={'w-3 h-3 transition-transform ' + (showFilter ? 'rotate-90' : '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  Filter Values{bucket.include?.length ? ` (${bucket.include.length} selected)` : ''}
                </button>
                {showFilter && (
                  <div className="mt-2">
                    <input value={valueSearch} onChange={e => setValueSearch(e.target.value)}
                      placeholder="Search values..." className="ginput w-full px-2 py-1.5 text-[10px] mb-1" />
                    {loadingValues ? (
                      <div className="text-[9px] text-zinc-400 py-2">Loading values...</div>
                    ) : fieldValues.length === 0 ? (
                      <div className="text-[9px] text-zinc-400 py-2">No values found</div>
                    ) : (
                      <div className="max-h-28 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 space-y-0.5">
                        {filteredFieldValues.map(v => {
                          const checked = bucket.include?.includes(v.key)
                          return (
                            <label key={v.key} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer text-[10px]">
                              <input type="checkbox" checked={!!checked}
                                onChange={() => {
                                  const arr = bucket.include || []
                                  const next = checked ? arr.filter(x => x !== v.key) : [...arr, v.key]
                                  onUpdate(bucket.id, { include: next.length ? next : undefined })
                                }}
                                className="accent-[#EF843C] w-3 h-3 shrink-0" />
                              <span className="text-zinc-700 dark:text-zinc-300 truncate flex-1 min-w-0">{v.key}</span>
                              <span className="text-[8px] text-zinc-400 ml-1 shrink-0">{v.doc_count}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
          {bucket.type === 'date_histogram' && (
            <div>
              <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Interval</label>
              <select value={interval} onChange={onIntervalChange} className="ginput w-full px-2 py-1.5 text-[10px]">
                <option value="1h">1 hour</option>
                <option value="6h">6 hours</option>
                <option value="12h">12 hours</option>
                <option value="1d">1 day</option>
                <option value="7d">7 days</option>
                <option value="1M">1 month</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Custom label</label>
            <input value={bucket.label} onChange={e => onUpdate(bucket.id, { label: e.target.value })}
              className="ginput w-full px-2 py-1.5 text-[10px]" placeholder="e.g. Rule Levels" />
          </div>
          <div>
            <button onClick={() => setShowAdv(v => !v)}
              className="flex items-center gap-1 text-[9px] font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
              <svg className={'w-3 h-3 transition-transform ' + (showAdv ? 'rotate-90' : '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              Advanced
            </button>
            {showAdv && (
              <div className="mt-2">
                <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">JSON input</label>
                <textarea value={bucket.json} onChange={e => onUpdate(bucket.id, { json: e.target.value })}
                  rows={3} className="ginput w-full px-2 py-1.5 text-[9px] font-mono resize-y"
                  placeholder='{ "min_doc_count": 1 }' />
                <p className="text-[7px] text-zinc-400 mt-0.5">Any JSON properties will be merged with the aggregation definition. e.g. "shard_size"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const typeLabels = { count: 'Count', avg: 'Average', sum: 'Sum', min: 'Min', max: 'Max', cardinality: 'Cardinality', terms: 'Terms', date_histogram: 'Date Histogram' }

const HIDDEN_COL_KEYS = ['_id', 'id', 'timestamp', 'data', 'syscheck', 'offset', 'previous_log', 'previous_output', 'rule.mitre', 'rule.groups', 'rule.mail', 'rule.firedtimes', 'rule.cve', 'manager.name', 'input.type', 'predecoder']

export default function PanelSettingsModal({ panel, onSave, onClose, availableKeys = [] }) {
  const q = panel.query || {}
  const cfg = panel.vizConfig || {}
  const [title, setTitle] = useState(panel.title || '')
  const DS_OPTIONS = [
    { id: 'alerts', label: 'Security Alerts' }, { id: 'agents', label: 'Agent Status' },
    { id: 'mitre', label: 'MITRE ATT&CK' }, { id: 'auth', label: 'Authentication Logs' },
    { id: 'windows', label: 'Windows Events' }, { id: 'linux', label: 'Linux Events' },
    { id: 'fim', label: 'FIM Events' }, { id: 'vulnerability', label: 'Vulnerability' },
    { id: 'firewall', label: 'Firewall Logs' }, { id: 'aws', label: 'AWS Logs' },
    { id: 'azure', label: 'Azure Logs' }, { id: 'gcp', label: 'GCP Logs' },
  ]
  const [chartType, setChartType] = useState(panel.type || panel.vizType || 'bar')
  const [dataSource, setDataSource] = useState(panel.dataSource || cfg.dataSource || 'alerts')
  const [field, setField] = useState(q.aggregation?.field || 'rule.level')
  const [aggType, setAggType] = useState(q.aggregation?.type || 'terms')
  const [queryStr, setQueryStr] = useState(q.query || cfg.query || '')
  const [limit, setLimit] = useState(q.aggregation?.limit || q.limit || 10)
  const [interval, setInterval] = useState(q.aggregation?.interval || '1h')
  const [fieldSearch, setFieldSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const apiKeys = availableKeys.filter(k => !HIDDEN_COL_KEYS.some(h => k === h || k.startsWith(h + '.')))
  const [tableCols, setTableCols] = useState((cfg.tableColumns || DEFAULT_TABLE_COLS).filter(c => apiKeys.includes(c)))
  const [sortField, setSortField] = useState(q.sort?.field || '@timestamp')
  const [sortOrder, setSortOrder] = useState(q.sort?.order || 'desc')
  const [gaugeMax, setGaugeMax] = useState(cfg.gaugeMax || 100)
  const [bubbleMax, setBubbleMax] = useState(q.aggregation?.limit || 20)
  const [metricKey, setMetricKey] = useState(cfg.metricKey || 'totalEvents')
  const [colSearch, setColSearch] = useState('')
  const COL_W = 100, ROW_H = 20
  const [pxW, setPxW] = useState((panel.w || 8) * COL_W)
  const [pxH, setPxH] = useState((panel.h || 5) * ROW_H)
  const [contentPadding, setContentPadding] = useState(cfg.contentPadding ?? 8)
  const [contentMargin, setContentMargin] = useState(cfg.contentMargin ?? 0)
  const [contentAlign, setContentAlign] = useState(cfg.contentAlign || 'center')
  const [showTitle, setShowTitle] = useState(cfg.showTitle !== false)
  const [showXLabels, setShowXLabels] = useState(cfg.showXLabels !== false)
  const [xAngle, setXAngle] = useState(cfg.xAngle ?? -30)
  const [showGridX, setShowGridX] = useState(cfg.showGridX === true)
  const [showGridY, setShowGridY] = useState(cfg.showGridY === true)
  const [legendPos, setLegendPos] = useState(cfg.legendPos || 'none')
  const [showTooltip, setShowTooltip] = useState(cfg.showTooltip !== false)
  const [yTitle, setYTitle] = useState(cfg.yTitle || '')
  const [yMin, setYMin] = useState(cfg.yMin ?? '')
  const [yMax, setYMax] = useState(cfg.yMax ?? '')
  const [thrLine, setThrLine] = useState(cfg.thrLine ?? '')
  const [txtSize, setTxtSize] = useState(cfg.txtSize || 'inherit')
  const [txtColor, setTxtColor] = useState(cfg.txtColor || '')
  const [txtWeight, setTxtWeight] = useState(cfg.txtWeight || 'inherit')
  const [valSize, setValSize] = useState(cfg.valSize || 'inherit')
  const [valColor, setValColor] = useState(cfg.valColor || '')
  const [valWeight, setValWeight] = useState(cfg.valWeight || 'inherit')
  const [txtTransform, setTxtTransform] = useState(cfg.txtTransform || 'none')
  const [txtDisplay, setTxtDisplay] = useState(cfg.txtDisplay || '')
  const [txtLineH, setTxtLineH] = useState(cfg.txtLineH || '')
  const [txtTracking, setTxtTracking] = useState(cfg.txtTracking || '')
  const [customCSS, setCustomCSS] = useState(cfg.customCSS || '')
  const [thresholds, setThresholds] = useState(cfg.thresholds || '')
  const [barOrientation, setBarOrientation] = useState(cfg.barOrientation || 'v')
  const [showDataLabels, setShowDataLabels] = useState(cfg.showDataLabels !== false)
  const [palette, setPalette] = useState(cfg.palette || 'qualitative')
  const [maxLabelLength, setMaxLabelLength] = useState(cfg.maxLabelLength || 25)
  const [openSections, setOpenSections] = useState({
    chartType: true, xAxis: true, yAxis: true, barStyle: true,
    legendTooltip: false, thresholds: false,
    valueStyle: false, textStyle: false, queryFilter: true,
  })
  const toggleSection = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }))
  const [buckets, setBuckets] = useState(() => {
    const saved = q.buckets || []
    if (saved.length > 0) return saved.map(b => ({ ...b, id: b.id || crypto.randomUUID(), enabled: b.enabled ?? true, collapsed: b.collapsed ?? false }))
    return [{ id: crypto.randomUUID(), type: q.aggregation?.type || 'terms', field: q.aggregation?.field || 'rule.level', orderBy: 'count', order: 'desc', size: q.aggregation?.limit || 10, label: '', json: '', enabled: true, collapsed: false, otherBucket: false, missingBucket: false }]
  })
  const timerRef = useRef(null)

  useEffect(() => {
    setTableCols(prev => prev.filter(c => apiKeys.includes(c)))
  }, [apiKeys])

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

  const fetchFieldValues = useCallback(async (field) => {
    if (!field) return []
    try {
      const index = cfg.selectedIndex || 'unishield360-alerts-4.x-*'
      const { data } = await axios.get('/api/aggregate', {
        params: { index, field, type: 'terms', limit: 50, start_date: 'now-24h', end_date: 'now' },
        timeout: 10000
      })
      return data?.buckets || []
    } catch {
      return []
    }
  }, [cfg.selectedIndex])

  const handleSave = () => {
    const isChart = ['bar', 'line', 'area', 'pie', 'severity-pie', 'heatmap', 'timeline', 'tagcloud'].includes(chartType)
    const isTable = chartType === 'table' || chartType === 'data-table'
    const isMetric = chartType === 'metric' || chartType === 'gauge'
    const isBubble = chartType === 'clusterbubble'

    const firstBucket = buckets.find(b => b.enabled) || buckets[0]
    const aggField = (isTable || isMetric) ? null : (isBubble ? 'agent.name' : firstBucket?.field)
    const aggLimit = isChart || isBubble ? (isBubble ? bubbleMax : firstBucket?.size) : undefined
    const aggIntervalVal = (firstBucket?.type === 'date_histogram') ? interval : undefined

    const updated = {
      ...panel,
      title,
      w: Math.max(0.5, +(pxW / COL_W).toFixed(2)),
      h: Math.max(0.5, +(pxH / ROW_H).toFixed(2)),
      type: chartType,
      vizType: chartType,
      dataSource,
      query: {
        language: 'lucene',
        query: queryStr || '',
        aggregation: aggField ? {
          field: aggField,
          type: isBubble ? 'terms' : (firstBucket?.type || aggType),
          limit: aggLimit,
          interval: aggIntervalVal,
          include: firstBucket?.include?.length ? firstBucket.include : undefined,
        } : isMetric ? { type: 'count' } : undefined,
        sort: { field: sortField, order: sortOrder },
        limit: isTable ? limit : (aggLimit || limit),
        buckets: (!isTable && !isBubble) ? buckets.filter(b => b.enabled).map(b => ({
          type: b.type,
          field: b.field,
          orderBy: b.orderBy,
          order: b.order,
          size: b.size,
          label: b.label || '',
          json: b.json || '',
          otherBucket: b.otherBucket || false,
          missingBucket: b.missingBucket || false,
          include: b.include?.length ? b.include : undefined,
          interval: b.type === 'date_histogram' ? interval : undefined,
        })) : undefined,
      },
      vizConfig: {
        ...cfg,
        query: queryStr || '',
        selectedIndex: cfg.selectedIndex || 'unishield360-alerts-4.x-*',
        contentPadding,
        contentMargin,
        contentAlign,
        txtSize,
        txtColor,
        txtWeight,
        txtTransform,
        txtDisplay,
        txtLineH,
        txtTracking,
        valSize,
        valColor,
        valWeight,
        showTitle,
        showXLabels,
        xAngle,
        showGridX,
        showGridY,
        legendPos,
        showTooltip,
        yTitle,
        yMin,
        yMax,
        thrLine,
        thresholds,
        customCSS,
        barOrientation,
        showDataLabels,
        palette,
        maxLabelLength,
        ...(isTable || chartType === 'data-table' ? { tableColumns: tableCols } : {}),
        metricKey,
        ...(chartType === 'gauge' ? { gaugeMax } : {}),
      },
    }
    onSave(updated)
    handleClose()
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEndBuckets = useCallback((event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setBuckets(prev => {
      const oldIdx = prev.findIndex(b => b.id === active.id)
      const newIdx = prev.findIndex(b => b.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return prev
      const copy = [...prev]
      const [removed] = copy.splice(oldIdx, 1)
      copy.splice(newIdx, 0, removed)
      return copy
    })
  }, [])

  const updateBucket = useCallback((id, patch) => {
    setBuckets(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b))
  }, [])

  const addBucket = useCallback(() => {
    setBuckets(prev => [...prev, { id: crypto.randomUUID(), type: 'terms', field: 'rule.level', orderBy: 'count', order: 'desc', size: 10, label: '', json: '', enabled: true, collapsed: false, otherBucket: false, missingBucket: false }])
  }, [])

  const removeBucket = useCallback((id) => {
    setBuckets(prev => prev.filter(b => b.id !== id))
  }, [])

  const toggleBucketEnabled = useCallback((id) => {
    setBuckets(prev => prev.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b))
  }, [])

  const getBucketLabel = useCallback((bucket) => {
    const typeLabels = { terms: 'Terms', date_histogram: 'Date Histogram' }
    return bucket.label || `${typeLabels[bucket.type] || bucket.type}${bucket.field ? ': ' + bucket.field : ''}`
  }, [])

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
          <style>{`.euiAccordion__icon { transition: transform .25s ease; } .euiAccordion__icon-isOpen { transform: rotate(90deg); }`}</style>
          {/* Title */}
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="ginput w-full px-3 py-2 text-[12px]" placeholder="Panel title..." />
            <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={showTitle} onChange={e => setShowTitle(e.target.checked)}
                className="accent-[#EF843C] w-3.5 h-3.5 cursor-pointer" />
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Show Title</span>
            </label>
          </div>

          {/* Grid Size — Pixels */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Width (px)</label>
              <div className="flex items-center gap-0.5">
                <button onClick={() => setPxW(Math.max(10, pxW - 10))} className="w-7 h-8 flex items-center justify-center rounded-l-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-sm font-bold">−</button>
                <input type="number" value={pxW} onChange={e => setPxW(parseFloat(e.target.value) || 100)} min={10} max={4800} step="any" className="ginput w-full px-2 py-2 text-[11px] text-center rounded-none border-r-0 border-l-0" style={{ borderRadius: 0 }} />
                <button onClick={() => setPxW(Math.min(4800, pxW + 10))} className="w-7 h-8 flex items-center justify-center rounded-r-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-sm font-bold">+</button>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Height (px)</label>
              <div className="flex items-center gap-0.5">
                <button onClick={() => setPxH(Math.max(10, pxH - 10))} className="w-7 h-8 flex items-center justify-center rounded-l-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-sm font-bold">−</button>
                <input type="number" value={pxH} onChange={e => setPxH(parseFloat(e.target.value) || 20)} min={10} max={2500} step="any" className="ginput w-full px-2 py-2 text-[11px] text-center rounded-none border-r-0 border-l-0" style={{ borderRadius: 0 }} />
                <button onClick={() => setPxH(Math.min(2500, pxH + 10))} className="w-7 h-8 flex items-center justify-center rounded-r-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-sm font-bold">+</button>
              </div>
            </div>
          </div>

          {/* Chart Type */}
          <div className="border-t border-zinc-200 dark:border-zinc-700">
            <button onClick={() => toggleSection('chartType')} className="w-full flex items-center gap-2 py-3 px-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded">
              <span className="flex items-center justify-center w-4 h-4">
                <svg className={'euiIcon euiIcon--medium euiAccordion__icon' + (openSections.chartType ? ' euiAccordion__icon-isOpen' : '')} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4" /></svg>
              </span>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Chart Type</span>
            </button>
            {openSections.chartType && <div className="px-1 pb-3">
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
            </div>}
          </div>

          {/* Metric Type */}
          {(chartType === 'metric' || chartType === 'gauge') && (
            <div className="border-t border-zinc-200 dark:border-zinc-700">
              <div className="py-3 px-1">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 block">Metric Type</label>
                <select value={metricKey} onChange={e => setMetricKey(e.target.value)}
                  className="ginput w-full px-2 py-2 text-[11px]">
                  <optgroup label="Alerts">
                    <option value="totalEvents">Total Events</option>
                    <option value="critical">Critical (12-15)</option>
                    <option value="high">High (7-11)</option>
                    <option value="medium">Medium (4-6)</option>
                    <option value="low">Low (1-3)</option>
                  </optgroup>
                  <optgroup label="Agents">
                    <option value="totalAgents">Total Agents</option>
                  </optgroup>
                  <optgroup label="Performance">
                    <option value="epsCount">EPS (60s calc)</option>
                    <option value="eps60">EPS (60s avg)</option>
                    <option value="eps5m">EPS (5m avg)</option>
                  </optgroup>
                  <optgroup label="Ingestion">
                    <option value="totalIngestGB">Total Ingestion (GB)</option>
                    <option value="todayIngestMB">Today Ingestion (MB)</option>
                    <option value="minIngestRate">Min Ingest Rate</option>
                    <option value="maxIngestRate">Max Ingest Rate</option>
                  </optgroup>
                </select>
              </div>
            </div>
          )}

          {/* X-Axis */}
          <div className="border-t border-zinc-200 dark:border-zinc-700">
            <button onClick={() => toggleSection('xAxis')} className="w-full flex items-center gap-2 py-3 px-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded">
              <span className="flex items-center justify-center w-4 h-4">
                <svg className={'euiIcon euiIcon--medium euiAccordion__icon' + (openSections.xAxis ? ' euiAccordion__icon-isOpen' : '')} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4" /></svg>
              </span>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">X-Axis</span>
            </button>
            {openSections.xAxis && (<div className="px-1 pb-3 space-y-2">
              <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                <input type="checkbox" checked={showXLabels} onChange={e => setShowXLabels(e.target.checked)} className="accent-[#EF843C] w-3 h-3" />
                <span className="text-zinc-600 dark:text-zinc-400">Show labels</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Label angle</label>
                  <input type="number" value={xAngle} onChange={e => setXAngle(parseInt(e.target.value) || 0)} min={-90} max={90}
                    className="ginput w-full px-2 py-1.5 text-[10px]" />
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                    <input type="checkbox" checked={showGridX} onChange={e => setShowGridX(e.target.checked)} className="accent-[#EF843C] w-3 h-3" />
                    <span className="text-zinc-600 dark:text-zinc-400">Grid X</span>
                  </label>
                  <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                    <input type="checkbox" checked={showGridY} onChange={e => setShowGridY(e.target.checked)} className="accent-[#EF843C] w-3 h-3" />
                    <span className="text-zinc-600 dark:text-zinc-400">Grid Y</span>
                  </label>
                </div>
              </div>
            </div>)}
          </div>

          {/* Y-Axis */}
          <div className="border-t border-zinc-200 dark:border-zinc-700">
            <button onClick={() => toggleSection('yAxis')} className="w-full flex items-center gap-2 py-3 px-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded">
              <span className="flex items-center justify-center w-4 h-4">
                <svg className={'euiIcon euiIcon--medium euiAccordion__icon' + (openSections.yAxis ? ' euiAccordion__icon-isOpen' : '')} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4" /></svg>
              </span>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Y-Axis</span>
            </button>
            {openSections.yAxis && (<div className="px-1 pb-3">
              <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Title</label>
                <input type="text" value={yTitle} onChange={e => setYTitle(e.target.value)}
                  className="ginput w-full px-2 py-1.5 text-[10px]" placeholder="e.g. Count" />
              </div>
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Min</label>
                <input type="number" value={yMin} onChange={e => setYMin(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="ginput w-full px-2 py-1.5 text-[10px]" placeholder="Auto" />
              </div>
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Max</label>
                <input type="number" value={yMax} onChange={e => setYMax(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="ginput w-full px-2 py-1.5 text-[10px]" placeholder="Auto" />
              </div>
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Threshold line</label>
                <input type="number" value={thrLine} onChange={e => setThrLine(e.target.value === '' ? '' : parseInt(e.target.value))} step="any"
                  className="ginput w-full px-2 py-1.5 text-[10px]" placeholder="None" />
              </div>
            </div>
          </div>)}
          </div>

          {/* Bar Style */}
          {['bar', 'bar-vertical', 'bar-horizontal'].includes(chartType) && <div className="border-t border-zinc-200 dark:border-zinc-700">
            <button onClick={() => toggleSection('barStyle')} className="w-full flex items-center gap-2 py-3 px-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded">
              <span className="flex items-center justify-center w-4 h-4">
                <svg className={'euiIcon euiIcon--medium euiAccordion__icon' + (openSections.barStyle ? ' euiAccordion__icon-isOpen' : '')} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4" /></svg>
              </span>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Bar Style</span>
            </button>
            {openSections.barStyle && (<div className="px-1 pb-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Orientation</label>
                  <div className="flex gap-1">
                    {[
                      { id: 'v', label: 'Vertical' },
                      { id: 'h', label: 'Horizontal' },
                    ].map(o => (
                      <button key={o.id} onClick={() => setBarOrientation(o.id)}
                        className={'flex-1 px-2 py-1.5 rounded-lg border text-[10px] font-medium transition-colors ' +
                          (barOrientation === o.id ? 'bg-[#EF843C]/10 border-[#EF843C] text-[#EF843C]' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800')}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Color Palette</label>
                  <select value={palette} onChange={e => setPalette(e.target.value)}
                    className="ginput w-full px-2 py-1.5 text-[10px]">
                    <option value="qualitative">Qualitative</option>
                    <option value="warm">Warm</option>
                    <option value="cool">Cool</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                  <input type="checkbox" checked={showDataLabels} onChange={e => setShowDataLabels(e.target.checked)} className="accent-[#EF843C] w-3 h-3" />
                  <span className="text-zinc-600 dark:text-zinc-400">Show data labels</span>
                </label>
              </div>
            </div>)}
          </div>}

          {/* Legend & Tooltip */}
          <div className="border-t border-zinc-200 dark:border-zinc-700">
            <button onClick={() => toggleSection('legendTooltip')} className="w-full flex items-center gap-2 py-3 px-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded">
              <span className="flex items-center justify-center w-4 h-4">
                <svg className={'euiIcon euiIcon--medium euiAccordion__icon' + (openSections.legendTooltip ? ' euiAccordion__icon-isOpen' : '')} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4" /></svg>
              </span>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Legend & Tooltip</span>
            </button>
            {openSections.legendTooltip && (<div className="px-1 pb-3">
              <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Legend</label>
                <select value={legendPos} onChange={e => setLegendPos(e.target.value)}
                  className="ginput w-full px-2 py-1.5 text-[10px]">
                  <option value="none">Hidden</option>
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                  <option value="bottom">Bottom</option>
                  <option value="top">Top</option>
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                  <input type="checkbox" checked={showTooltip} onChange={e => setShowTooltip(e.target.checked)} className="accent-[#EF843C] w-3 h-3" />
                  <span className="text-zinc-600 dark:text-zinc-400">Show tooltip</span>
                </label>
              </div>
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Max Label Length</label>
                <input type="number" value={maxLabelLength} onChange={e => setMaxLabelLength(parseInt(e.target.value) || 25)} min={5} max={100}
                  className="ginput w-full px-2 py-1.5 text-[10px]" placeholder="25" />
                <div className="text-[7px] text-zinc-400 mt-0.5">Truncates long labels in pie/legend</div>
              </div>
            </div>
          </div>)}
          </div>

          {/* Threshold Colors */}
          <div className="border-t border-zinc-200 dark:border-zinc-700">
            <button onClick={() => toggleSection('thresholds')} className="w-full flex items-center gap-2 py-3 px-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded">
              <span className="flex items-center justify-center w-4 h-4">
                <svg className={'euiIcon euiIcon--medium euiAccordion__icon' + (openSections.thresholds ? ' euiAccordion__icon-isOpen' : '')} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4" /></svg>
              </span>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Threshold Colors</span>
            </button>
            {openSections.thresholds && (<div className="px-1 pb-3">
            <p className="text-[8px] text-zinc-400 mb-1.5">Format: value1=color1, value2=color2 (e.g. 100=#ef4444, 50=#f59e0b)</p>
            <input type="text" value={thresholds} onChange={e => setThresholds(e.target.value)}
              className="ginput w-full px-2 py-1.5 text-[10px] font-mono" placeholder="e.g. 100=#ef4444, 50=#f59e0b, 0=#10b981" />
          </div>)}
          </div>

          {/* Value Style */}
          <div className="border-t border-zinc-200 dark:border-zinc-700">
            <button onClick={() => toggleSection('valueStyle')} className="w-full flex items-center gap-2 py-3 px-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded">
              <span className="flex items-center justify-center w-4 h-4">
                <svg className={'euiIcon euiIcon--medium euiAccordion__icon' + (openSections.valueStyle ? ' euiAccordion__icon-isOpen' : '')} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4" /></svg>
              </span>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Value Style</span>
            </button>
            {openSections.valueStyle && (<div className="px-1 pb-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Value Size</label>
                <input type="text" value={valSize} onChange={e => setValSize(e.target.value)}
                  className="ginput w-full px-2 py-1.5 text-[10px]" placeholder="24px / 2rem / inherit" />
              </div>
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Value Color</label>
                <div className="flex gap-1">
                  <input type="color" value={valColor || '#1f2328'} onChange={e => setValColor(e.target.value === '#1f2328' ? '' : e.target.value)}
                    className="w-8 h-8 rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer shrink-0" style={{ padding: 0 }} />
                  <input type="text" value={valColor} onChange={e => setValColor(e.target.value)} placeholder="#000"
                    className="ginput w-full px-2 py-1.5 text-[10px] font-mono" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Value Weight</label>
                <select value={valWeight} onChange={e => setValWeight(e.target.value)}
                  className="ginput w-full px-2 py-1.5 text-[10px]">
                  <option value="inherit">Default</option>
                  <option value="font-normal">Normal</option>
                  <option value="font-medium">Medium</option>
                  <option value="font-semibold">Semibold</option>
                  <option value="font-bold">Bold</option>
                </select>
              </div>
            </div>
          </div>)}
          </div>

          {/* Text Style */}
          <div className="border-t border-zinc-200 dark:border-zinc-700">
            <button onClick={() => toggleSection('textStyle')} className="w-full flex items-center gap-2 py-3 px-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded">
              <span className="flex items-center justify-center w-4 h-4">
                <svg className={'euiIcon euiIcon--medium euiAccordion__icon' + (openSections.textStyle ? ' euiAccordion__icon-isOpen' : '')} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4" /></svg>
              </span>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Text Style</span>
            </button>
            {openSections.textStyle && (<div className="px-1 pb-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Font Size</label>
                <div className="flex items-center gap-1">
                  <input type="text" value={txtSize} onChange={e => setTxtSize(e.target.value)}
                    className="ginput w-full px-2 py-1.5 text-[10px]" placeholder="14px / 1rem / inherit" />
                  <span className="text-[8px] text-zinc-400 shrink-0">px/rem</span>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Color</label>
                <div className="flex gap-1">
                  <input type="color" value={txtColor || '#1f2328'} onChange={e => setTxtColor(e.target.value === '#1f2328' ? '' : e.target.value)}
                    className="w-8 h-8 rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer shrink-0" style={{ padding: 0 }} />
                  <input type="text" value={txtColor} onChange={e => setTxtColor(e.target.value)} placeholder="#000"
                    className="ginput w-full px-2 py-1.5 text-[10px] font-mono" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Weight</label>
                <select value={txtWeight} onChange={e => setTxtWeight(e.target.value)}
                  className="ginput w-full px-2 py-1.5 text-[10px]">
                  <option value="inherit">Default</option>
                  <option value="font-normal">Normal</option>
                  <option value="font-medium">Medium</option>
                  <option value="font-semibold">Semibold</option>
                  <option value="font-bold">Bold</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Transform</label>
                <select value={txtTransform} onChange={e => setTxtTransform(e.target.value)}
                  className="ginput w-full px-2 py-1.5 text-[10px]">
                  <option value="none">None</option>
                  <option value="uppercase">UPPERCASE</option>
                  <option value="lowercase">lowercase</option>
                  <option value="capitalize">Capitalize</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Display</label>
                <select value={txtDisplay} onChange={e => setTxtDisplay(e.target.value)}
                  className="ginput w-full px-2 py-1.5 text-[10px]">
                  <option value="">Default</option>
                  <option value="block">Block</option>
                  <option value="inline">Inline</option>
                  <option value="inline-block">Inline Block</option>
                  <option value="flex">Flex</option>
                  <option value="none">Hidden</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Line Height</label>
                <input type="text" value={txtLineH} onChange={e => setTxtLineH(e.target.value)}
                  className="ginput w-full px-2 py-1.5 text-[10px]" placeholder="e.g. 1.5" />
              </div>
              <div>
                <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Letter Spacing</label>
                <input type="text" value={txtTracking} onChange={e => setTxtTracking(e.target.value)}
                  className="ginput w-full px-2 py-1.5 text-[10px]" placeholder="e.g. 0.5px" />
              </div>
            </div>
            <div className="mt-2">
              <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Custom CSS</label>
              <textarea value={customCSS} onChange={e => setCustomCSS(e.target.value)}
                rows={3} className="ginput w-full px-3 py-2 text-[10px] font-mono resize-y"
                placeholder={'background: #1a1d27;\nborder: 2px solid #EF843C;\nborder-radius: 16px;\nopacity: 0.9;'} />
              <div className="text-[8px] text-zinc-400 mt-1">Enter any CSS properties. Affects widget background/border.</div>
            </div>
          </div>)}
          </div>

          {/* Query Filter */}
          <div className="border-t border-zinc-200 dark:border-zinc-700">
            <button onClick={() => toggleSection('queryFilter')} className="w-full flex items-center gap-2 py-3 px-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded">
              <span className="flex items-center justify-center w-4 h-4">
                <svg className={'euiIcon euiIcon--medium euiAccordion__icon' + (openSections.queryFilter ? ' euiAccordion__icon-isOpen' : '')} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4" /></svg>
              </span>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Query Filter</span>
            </button>
            {openSections.queryFilter && (<div className="px-1 pb-3">
            <input value={queryStr} onChange={e => setQueryStr(e.target.value)}
              className="ginput w-full px-3 py-2 text-[11px] font-mono" placeholder="rule.level:12 OR rule.level:15" />
          </div>)}
          </div>

          {/* ===== TABLE SETTINGS ===== */}
          {(chartType === 'table' || chartType === 'data-table') && (
            <>
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 block">Columns to Display</label>
                <input value={colSearch} onChange={e => setColSearch(e.target.value)}
                  placeholder="Search columns..." className="ginput w-full px-3 py-2 text-[11px] mb-2" />
                <div className="max-h-40 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 space-y-1">
                  {(apiKeys.length ? apiKeys.filter(k => !colSearch || k.toLowerCase().includes(colSearch.toLowerCase())) : filteredColFields.map(f => f.value)).map(key => (
                    <label key={key} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer text-[11px]">
                      <input type="checkbox" checked={tableCols.includes(key)} onChange={() => toggleColumn(key)}
                        className="accent-[#EF843C] w-3 h-3" />
                      <span className="text-zinc-700 dark:text-zinc-300">{key}</span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {tableCols.map(v => (
                    <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EF843C]/10 text-[#EF843C] text-[9px] font-medium">
                      {v}
                      <button onClick={() => toggleColumn(v)} className="hover:text-red-500">✕</button>
                    </span>
                  ))}
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

          {/* ===== METRICS & BUCKETS ===== */}
          {!['metric', 'gauge', 'table', 'data-table', 'clusterbubble'].includes(chartType) && (
            <>
              {/* ─── Buckets ─── */}
              <div className="euiPanel border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden" data-test-subj="bucketsAggGroup">
                <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                  <h3 className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Buckets</h3>
                </div>
                <div className="p-3">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndBuckets}>
                    <SortableContext items={buckets.map(b => b.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {buckets.map(b => (
                          <SortableBucketItem
                            key={b.id} bucket={b} fields={FIELD_PRESETS}
                            onUpdate={updateBucket} onRemove={removeBucket} onToggleEnabled={toggleBucketEnabled}
                            interval={interval} onIntervalChange={e => setInterval(e.target.value)}
                            fetchFieldValues={fetchFieldValues} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <div className="flex justify-center mt-2">
                    <button onClick={addBucket} className="flex items-center gap-1 text-[10px] font-medium text-[#EF843C] hover:text-[#e0752a] transition-colors">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                      Add
                    </button>
                  </div>
                </div>
              </div>
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
