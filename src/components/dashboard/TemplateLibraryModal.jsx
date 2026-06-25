import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { getTemplateList, getTemplate, createFromTemplate, deleteUserTemplate, TEMPLATE_CATEGORIES } from './dashboardTemplates'

const ACCENT = '#EF843C'
const CAT_COLORS = {
  soc: '#EF843C', executive: '#EF843C', security: '#EF843C',
  platform: '#EF843C', network: '#EF843C',
}

export default function TemplateLibraryModal({ open, onClose, onUseTemplate }) {
  const [category, setCategory] = useState(null)
  const [search, setSearch] = useState('')
  const [previewId, setPreviewId] = useState(null)
  const [showAgentFilter, setShowAgentFilter] = useState(false)
  const [pendingTemplateId, setPendingTemplateId] = useState(null)
  const [agentSearch, setAgentSearch] = useState('')
  const [agentList, setAgentList] = useState([])
  const [selectedAgents, setSelectedAgents] = useState([])
  const [agentLoading, setAgentLoading] = useState(false)

  useEffect(() => {
    if (!showAgentFilter) return
    setAgentLoading(true)
    axios.get('/api/aggregate', {
      params: { field: 'agent.name', type: 'terms', limit: 100, start_date: 'now-24h', end_date: 'now' },
      timeout: 10000
    }).then(res => {
      const buckets = res.data?.buckets || []
      setAgentList(buckets.map(b => ({ name: b.key, count: b.doc_count })))
    }).catch(() => {
      setAgentList([])
    }).finally(() => setAgentLoading(false))
  }, [showAgentFilter])

  const allTemplates = getTemplateList()
  const filtered = allTemplates.filter(t => {
    if (category && t.category !== category) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const previewTpl = previewId ? getTemplate(previewId) : null

  const handleUseTemplate = (templateId) => {
    setPendingTemplateId(templateId)
    setShowAgentFilter(true)
  }

  const handleConfirmWithFilter = () => {
    const dash = createFromTemplate(pendingTemplateId)
    if (dash) {
      if (selectedAgents.length > 0) {
        dash.globalFilters = selectedAgents.map(name => ({
          type: 'pair', key: 'agent.name', value: name, exclude: false,
        }))
        dash.name = (dash.name || '') + ' [' + selectedAgents.join(', ') + ']'
      }
      onUseTemplate(dash)
    }
    setShowAgentFilter(false)
    setSelectedAgents([])
    setAgentSearch('')
    onClose()
  }

  const toggleAgent = (name) => {
    setSelectedAgents(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const filteredAgents = agentList.filter(a =>
    !agentSearch || a.name.toLowerCase().includes(agentSearch.toLowerCase())
  )

  if (!open) return null

  if (showAgentFilter) {
    const tpl = pendingTemplateId ? getTemplate(pendingTemplateId) : null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => { setShowAgentFilter(false); setSelectedAgents([]); setAgentSearch('') }}>
        <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl w-full max-w-lg mx-3" onClick={e => e.stopPropagation()}>
          <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{backgroundColor: tpl ? (CAT_COLORS[tpl.category] || ACCENT) : ACCENT}}>{tpl?.name ? tpl.name[0] : '?'}</span>
              <div>
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Filter by Agent</h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">Select agents to filter "{tpl?.name}" dashboard</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={agentSearch} onChange={e => setAgentSearch(e.target.value)} placeholder="Search agents..."
                className="w-full pl-9 pr-3 py-2 text-[11px] bg-zinc-50 dark:bg-zinc-800/60 rounded-xl outline-none border border-zinc-200 dark:border-zinc-700" autoFocus />
            </div>
            {selectedAgents.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedAgents.map(name => (
                  <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EF843C]/10 text-[#EF843C] text-[9px] font-medium">
                    {name}
                    <button onClick={() => toggleAgent(name)} className="hover:text-red-500">✕</button>
                  </span>
                ))}
              </div>
            )}
            <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg">
              {agentLoading ? (
                <div className="flex items-center justify-center py-8 text-[10px] text-zinc-400">
                  <div className="w-3 h-3 border-2 border-zinc-300 border-t-[#EF843C] rounded-full animate-spin mr-2" />
                  Loading agents...
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="text-center py-8 text-[10px] text-zinc-400">No agents found</div>
              ) : filteredAgents.map(a => (
                <label key={a.name} className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer text-[11px]">
                  <input type="checkbox" checked={selectedAgents.includes(a.name)} onChange={() => toggleAgent(a.name)}
                    className="accent-[#EF843C] w-3 h-3" />
                  <span className="text-zinc-700 dark:text-zinc-300 flex-1">{a.name}</span>
                  <span className="text-[9px] text-zinc-400">{a.count.toLocaleString()} events</span>
                </label>
              ))}
            </div>
            <p className="text-[9px] text-zinc-400">Leave empty to include all agents</p>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200 dark:border-zinc-700">
            <button onClick={() => { setShowAgentFilter(false); setSelectedAgents([]); setAgentSearch('') }}
              className="px-4 py-2 text-[10px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
            <button onClick={handleConfirmWithFilter}
              className="px-5 py-2 text-[10px] font-semibold rounded-lg bg-gradient-to-r from-[#EF843C] to-[#e0752a] text-white hover:from-[#e0752a] hover:to-[#d0661a] transition-all">
              {selectedAgents.length > 0 ? `Create with ${selectedAgents.length} agent${selectedAgents.length > 1 ? 's' : ''}` : 'Create Dashboard'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const btnBase = 'px-3 py-1 text-[10px] font-medium rounded-lg border transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl w-full max-w-4xl mx-3 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-700">
          <div>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Dashboard Templates</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">Choose a pre-built template to get started quickly</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-700 space-y-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..."
              className="w-full pl-9 pr-3 py-2 text-[11px] bg-zinc-50 dark:bg-zinc-800/60 rounded-xl outline-none border border-zinc-200 dark:border-zinc-700 focus:border-[#EF843C]/50 transition-colors" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setCategory(null)}
              className={`${btnBase} ${!category ? 'bg-[#EF843C] text-white border-[#EF843C]' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>All</button>
            {TEMPLATE_CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCategory(category === c.id ? null : c.id)}
                className={`${btnBase} ${category === c.id ? 'bg-[#EF843C] text-white border-[#EF843C]' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>{c.label}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {previewTpl ? (
            <div>
              <button onClick={() => setPreviewId(null)} className="text-[10px] hover:underline mb-3 flex items-center gap-1 transition-colors" style={{ color: ACCENT }}>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Back to templates
              </button>
              <div className="bg-white dark:bg-zinc-800/40 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{backgroundColor: CAT_COLORS[previewTpl.category] || ACCENT}}>{previewTpl.name[0]}</span>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{previewTpl.name}</h4>
                    <p className="text-[10px] text-zinc-400">{previewTpl.description}</p>
                  </div>
                  <div className="flex-1" />
                  <span className="text-[9px] px-2 py-1 rounded-md" style={{ background: `${ACCENT}18`, color: ACCENT }}>{previewTpl.panels.length} panels</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {previewTpl.panels.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.type === 'metric' ? '#10b981' : p.type === 'pie' ? '#EF843C' : p.type === 'table' ? '#6b7280' : ACCENT }} />
                      <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 truncate">{p.title}</span>
                      <span className="text-[8px] font-mono text-zinc-400 ml-auto">{p.type}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => { handleUseTemplate(previewId) }}
                className="mt-4 w-full py-2.5 text-[11px] font-semibold rounded-xl bg-gradient-to-r from-[#EF843C] to-[#e0752a] text-white hover:from-[#e0752a] hover:to-[#d0661a] transition-all">
                Create Dashboard from "{previewTpl.name}" Template
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(t => {
                const catColor = CAT_COLORS[t.category] || ACCENT
                return (
                  <div key={t.id}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${catColor}4D` }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '' }}
                    className="bg-white dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-lg group">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{backgroundColor: catColor}}>{t.name[0]}</span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100 truncate">{t.name}</h4>
                        <p className="text-[9px] text-zinc-400 dark:text-zinc-500 line-clamp-2 mt-0.5">{t.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-zinc-400 mb-3">
                      <span className="px-1.5 py-0.5 rounded" style={{ background: `${catColor}12`, color: catColor }}>{t.category}</span>
                      <span>{t.panelCount} panels</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setPreviewId(t.id)}
                        className="flex-1 px-2 py-1.5 text-[9px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">Preview</button>
                      <button onClick={() => handleUseTemplate(t.id)}
                        className="flex-1 px-2 py-1.5 text-[9px] font-semibold rounded-lg text-white transition-all hover:opacity-90"
                        style={{ background: `linear-gradient(90deg,${catColor},${catColor}dd)` }}>Use</button>
                      {t.category === 'user' && (
                        <button onClick={() => { if (window.confirm('Delete template "' + t.name + '"?')) { deleteUserTemplate(t.id); window.location.reload() } }}
                          className="px-2 py-1.5 text-[9px] font-semibold rounded-lg border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="Delete template">✕</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

