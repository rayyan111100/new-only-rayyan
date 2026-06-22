import React, { useState, useEffect } from 'react'
import { reportService } from '../../services/reportService'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DASHBOARD_STORAGE_KEY = 'unishield_dashboards'

function getDashboardList() {
  try { return JSON.parse(localStorage.getItem(DASHBOARD_STORAGE_KEY) || '[]') }
  catch { return [] }
}

function Switch({ checked, onChange }) {
  return (
    <button onClick={onChange}
      className={`relative w-8 h-4 rounded-full transition-colors ${checked ? 'bg-[#EF843C]' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
      <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  )
}

export default function ReportCreator({ onCreateReport, onCancel }) {
  const [dashboards, setDashboards] = useState([])
  const [previewData, setPreviewData] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [config, setConfig] = useState({
    name: '',
    description: '',
    dashboardId: '',
    timeRange: 'now-24h',
    format: 'PDF',
    includeCharts: true,
    includeTables: true,
    includeMetrics: true,
    scheduled: false,
    frequency: 'Daily',
    time: '08:00',
    days: ['Monday'],
    sendEmail: false,
    emailTo: '',
    emailFrom: '',
    emailSubject: '',
    includeInBody: false,
    attachAsFile: true,
  })

  useEffect(() => {
    setDashboards(getDashboardList())
  }, [])

  const update = (key, value) => setConfig(prev => ({ ...prev, [key]: value }))

  const toggleDay = (day) => {
    const newDays = config.days.includes(day)
      ? config.days.filter(d => d !== day)
      : [...config.days, day]
    update('days', newDays.length ? newDays : ['Monday'])
  }

  const handlePreview = async () => {
    setPreviewLoading(true)
    try {
      const result = await reportService.preview(config.dashboardId, config)
      setPreviewData(result)
    } catch (e) {
      setPreviewData({ error: e.message })
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!config.name.trim()) return
    const id = await reportService.create(config)
    if (config.scheduled) await reportService.schedule({ ...config, id })
    if (config.sendEmail) await reportService.email(id, config)
    onCreateReport?.(config)
  }

  return (
    <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-zinc-200 dark:border-zinc-700 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-[#EF843C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <div>
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Create Report</h2>
            <p className="text-[10px] text-zinc-400">Configure scheduled report generation</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Left: Form */}
        <div className="p-5 space-y-5 border-r border-zinc-200 dark:border-zinc-700 max-h-[70vh] overflow-y-auto">
          {/* Report Settings */}
          <div>
            <h3 className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Report Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 block">Name *</label>
                <input type="text" value={config.name} onChange={e => update('name', e.target.value)}
                  placeholder="Weekly Security Report" className="ginput w-full px-3 py-2 text-[11px]" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 block">Description</label>
                <textarea value={config.description} onChange={e => update('description', e.target.value)}
                  placeholder="Summary of security events for the week" rows={2}
                  className="ginput w-full px-3 py-2 text-[11px] resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 block">Dashboard</label>
                <select value={config.dashboardId} onChange={e => update('dashboardId', e.target.value)}
                  className="ginput w-full px-3 py-2 text-[11px]">
                  <option value="">Select dashboard...</option>
                  {dashboards.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 block">Time Range</label>
                <select value={config.timeRange} onChange={e => update('timeRange', e.target.value)}
                  className="ginput w-full px-3 py-2 text-[11px]">
                  <option value="now-1h">Last 1 hour</option>
                  <option value="now-24h">Last 24 hours</option>
                  <option value="now-7d">Last 7 days</option>
                  <option value="now-30d">Last 30 days</option>
                  <option value="now-90d">Last 90 days</option>
                  <option value="now-1y">Last 1 year</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 block">Format</label>
                <div className="flex gap-2">
                  {['PDF', 'PNG', 'CSV'].map(f => (
                    <button key={f} onClick={() => update('format', f)}
                      className={`flex-1 px-3 py-2 text-[11px] font-semibold rounded-lg border transition-colors ${
                        config.format === f
                          ? 'bg-[#EF843C] text-white border-[#EF843C]'
                          : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                      }`}>{f}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-400 cursor-pointer p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <input type="checkbox" checked={config.includeCharts} onChange={e => update('includeCharts', e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-zinc-300 text-[#EF843C] focus:ring-[#EF843C]/30" /> Charts
                </label>
                <label className="flex items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-400 cursor-pointer p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <input type="checkbox" checked={config.includeTables} onChange={e => update('includeTables', e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-zinc-300 text-[#EF843C] focus:ring-[#EF843C]/30" /> Tables
                </label>
                <label className="flex items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-400 cursor-pointer p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <input type="checkbox" checked={config.includeMetrics} onChange={e => update('includeMetrics', e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-zinc-300 text-[#EF843C] focus:ring-[#EF843C]/30" /> Metrics
                </label>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Schedule</h3>
              <Switch checked={config.scheduled} onChange={() => update('scheduled', !config.scheduled)} />
            </div>
            {config.scheduled && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 block">Frequency</label>
                  <div className="flex gap-2">
                    {['Daily', 'Weekly', 'Monthly'].map(f => (
                      <button key={f} onClick={() => update('frequency', f)}
                        className={`flex-1 px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-colors ${
                          config.frequency === f
                            ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]'
                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                        }`}>{f}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Time</label>
                    <input type="time" value={config.time} onChange={e => update('time', e.target.value)}
                      className="ginput w-full px-2 py-1.5 text-[10px]" />
                  </div>
                  {config.frequency === 'Weekly' && (
                    <div>
                      <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Days</label>
                      <div className="flex flex-wrap gap-1">
                        {DAYS.map(d => (
                          <button key={d} onClick={() => toggleDay(d)}
                            className={`px-1.5 py-1 text-[8px] font-medium rounded transition-colors ${
                              config.days.includes(d)
                                ? 'bg-[#8b5cf6] text-white'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                            }`}>{d.slice(0, 3)}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Email Recipients</h3>
              <Switch checked={config.sendEmail} onChange={() => update('sendEmail', !config.sendEmail)} />
            </div>
            {config.sendEmail && (
              <div className="space-y-3">
                <input type="email" value={config.emailTo} onChange={e => update('emailTo', e.target.value)}
                  placeholder="recipient@example.com" className="ginput w-full px-3 py-2 text-[11px]" />
                <input type="email" value={config.emailFrom} onChange={e => update('emailFrom', e.target.value)}
                  placeholder="from@example.com" className="ginput w-full px-3 py-2 text-[11px]" />
                <input type="text" value={config.emailSubject} onChange={e => update('emailSubject', e.target.value)}
                  placeholder="Weekly Security Report - ${date}" className="ginput w-full px-3 py-2 text-[11px]" />
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-[9px] text-zinc-500 cursor-pointer">
                    <input type="checkbox" checked={config.includeInBody} onChange={e => update('includeInBody', e.target.checked)}
                      className="w-3 h-3 rounded border-zinc-300 text-[#8b5cf6]" /> Include in body
                  </label>
                  <label className="flex items-center gap-1.5 text-[9px] text-zinc-500 cursor-pointer">
                    <input type="checkbox" checked={config.attachAsFile} onChange={e => update('attachAsFile', e.target.checked)}
                      className="w-3 h-3 rounded border-zinc-300 text-[#8b5cf6]" /> Attach as file
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Preview button */}
          <button onClick={handlePreview} disabled={!config.dashboardId || previewLoading}
            className="w-full py-2 text-[10px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40">
            {previewLoading ? 'Loading preview...' : 'Preview Report Content'}
          </button>
        </div>

        {/* Right: Preview */}
        <div className="p-5 flex flex-col max-h-[70vh]">
          <h3 className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Preview</h3>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {previewLoading ? (
              <div className="flex items-center justify-center h-48">
                <svg className="animate-spin w-5 h-5 text-[#EF843C]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              </div>
            ) : previewData?.error ? (
              <div className="text-center py-8 text-xs text-red-500">{previewData.error}</div>
            ) : previewData ? (
              <div className="space-y-3">
                <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                  <div className="text-xs font-bold text-zinc-700 dark:text-zinc-200">{previewData.dashboard || 'Dashboard'}</div>
                  <div className="text-[10px] text-zinc-400 mt-1">{previewData.panels?.length || 0} of {previewData.total || 0} panels</div>
                </div>
                {(previewData.panels || []).map(p => (
                  <div key={p.id} className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">{p.title || 'Panel'}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-500">{p.vizType}</span>
                    </div>
                    {p.data ? (
                      <div className="text-[9px] text-zinc-500 font-mono">
                        Total: {p.data.total || 0} hits
                      </div>
                    ) : (
                      <div className="text-[9px] text-zinc-400 italic">No data</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-zinc-400">
                <div className="text-center">
                  <svg className="w-8 h-8 mx-auto mb-2 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <p className="text-xs">Click "Preview" to see report content</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-700">
        <button onClick={onCancel}
          className="px-4 py-2 text-[10px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
          Cancel
        </button>
        <button onClick={() => reportService.create(config).then(() => onCreateReport?.(config))}
          className="px-4 py-2 text-[10px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
          Save as Template
        </button>
        <button onClick={handleCreate} disabled={!config.name.trim() || !config.dashboardId}
          className="px-5 py-2 text-[10px] font-semibold rounded-lg bg-gradient-to-r from-[#EF843C] to-[#e0752a] text-white hover:from-[#e0752a] hover:to-[#d0661a] transition-all disabled:opacity-40">
          Create Report
        </button>
      </div>
    </div>
  )
}
