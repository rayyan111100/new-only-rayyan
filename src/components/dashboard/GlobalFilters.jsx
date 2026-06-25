import React, { useState } from 'react'
import { useDashboard } from './dashboardStore'

const COMMON_FIELDS = [
  'rule.level', 'rule.id', 'rule.groups', 'rule.description',
  'agent.name', 'agent.id', 'agent.ip',
  'data.action', 'data.srcip', 'data.dstip',
  'location', 'decoder.name', '@timestamp',
]

export default function GlobalFilters() {
  const { globalFilters, addFilter, removeFilter, applyFiltersToAll, toggleApplyFilters } = useDashboard()
  const [field, setField] = useState('')
  const [value, setValue] = useState('')
  const [customField, setCustomField] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  const handleAdd = () => {
    const f = useCustom ? customField : field
    if (!f || !value) return
    addFilter({ field: f, value, operator: 'is' })
    setField('')
    setValue('')
    setCustomField('')
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0">Filters</label>
        <div className="flex items-center gap-1.5 flex-1">
          <div className="flex-1 flex gap-1">
            {!useCustom ? (
              <select value={field} onChange={e => setField(e.target.value)}
                className="ginput flex-1 px-2 py-1.5 text-[10px] font-mono rounded-lg max-w-[140px]">
                <option value="">Field...</option>
                {COMMON_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            ) : (
              <input type="text" value={customField} onChange={e => setCustomField(e.target.value)}
                placeholder="Custom field" className="ginput flex-1 px-2 py-1.5 text-[10px] font-mono rounded-lg max-w-[140px]" />
            )}
            <button onClick={() => setUseCustom(!useCustom)}
              className={`px-2 py-1.5 text-[9px] font-medium rounded-lg border transition-colors ${
                useCustom ? 'bg-[#EF843C]/10 text-[#EF843C] border-[#EF843C]/30' : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
              }`}>{useCustom ? 'Preset' : 'Custom'}</button>
          </div>
          <input type="text" value={value} onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Value" className="ginput w-28 px-2 py-1.5 text-[10px] font-mono rounded-lg" />
          <button onClick={handleAdd}
            className="px-2.5 py-1.5 text-[10px] font-semibold rounded-lg bg-[#EF843C] text-white hover:bg-[#e0752a] transition-colors shrink-0">+ Add</button>
        </div>
        <label className="flex items-center gap-1.5 text-[9px] text-zinc-400 cursor-pointer shrink-0">
          <input type="checkbox" checked={applyFiltersToAll} onChange={toggleApplyFilters}
            className="w-3 h-3 rounded border-zinc-300 text-[#EF843C] focus:ring-[#EF843C]/30" />
          Apply to all
        </label>
      </div>

      {/* Active filter chips */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {globalFilters.map((f, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#EF843C]/5 dark:bg-[#EF843C]/10 border border-[#EF843C]/20 text-[10px] font-mono group hover:border-[#EF843C]/40 transition-colors">
            <span className="text-[#EF843C] font-semibold">{f.field === '__kql__' ? 'KQL' : f.field}</span>
            {f.field !== '__kql__' && <span className="text-zinc-400">:</span>}
            <span className="text-zinc-600 dark:text-zinc-300 max-w-[120px] truncate">{f.value}</span>
            <button onClick={() => removeFilter(i)}
              className="p-0.5 text-zinc-400 hover:text-red-500 opacity-60 hover:opacity-100 transition-opacity rounded hover:bg-red-50 dark:hover:bg-red-900/20"
              aria-label="Remove filter">
              ×
            </button>
          </div>
        ))}
        {globalFilters.length === 0 && (
          <span className="text-[10px] text-zinc-400 italic px-1">No filters — add a field and value above</span>
        )}
      </div>
    </div>
  )
}
