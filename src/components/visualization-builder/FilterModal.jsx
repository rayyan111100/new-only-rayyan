import React, { useState } from 'react'

const COMMON_FIELDS = [
  'rule.level', 'rule.id', 'rule.description', 'rule.groups',
  'agent.name', 'agent.id', 'agent.ip',
  'data.action', 'data.srcip', 'data.dstip', 'data.srcport', 'data.dstport',
  'data.protocol', 'data.url',
  '@timestamp', 'timestamp',
  'location', 'decoder.name', 'decoder.parent',
  'syscheck.event', 'syscheck.path',
  'full_log', 'message',
  'rule.pci_dss', 'rule.hipaa', 'rule.gdpr', 'rule.mitre.id',
]

const OPERATORS = [
  { value: 'is', label: 'is' },
  { value: 'is not', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'does not contain', label: 'does not contain' },
  { value: 'exists', label: 'exists' },
  { value: 'does not exist', label: 'does not exist' },
  { value: 'starts with', label: 'starts with' },
  { value: 'ends with', label: 'ends with' },
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
]

export default function FilterModal({ open, onClose, onAdd }) {
  const [field, setField] = useState('')
  const [operator, setOperator] = useState('is')
  const [value, setValue] = useState('')
  const [customField, setCustomField] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  if (!open) return null

  const handleAdd = () => {
    const f = useCustom ? customField : field
    if (!f) return
    const filter = { field: f, operator, value: ['exists', 'does not exist'].includes(operator) ? '' : value }
    onAdd?.(filter)
    setField('')
    setValue('')
    setCustomField('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl p-5 w-full max-w-md mx-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Add Filter</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">Field</label>
            <div className="flex items-center gap-1 mb-1">
              <button onClick={() => setUseCustom(false)}
                className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${!useCustom ? 'bg-[#EF843C] text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>Preset</button>
              <button onClick={() => setUseCustom(true)}
                className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${useCustom ? 'bg-[#EF843C] text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>Custom</button>
            </div>
            {useCustom ? (
              <input type="text" value={customField} onChange={e => setCustomField(e.target.value)}
                placeholder="Enter field name..." className="ginput w-full px-2 py-1.5 text-[10px] font-mono" />
            ) : (
              <select value={field} onChange={e => setField(e.target.value)}
                className="ginput w-full px-2 py-1.5 text-[10px] font-mono">
                <option value="">Select field...</option>
                {COMMON_FIELDS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">Operator</label>
            <select value={operator} onChange={e => setOperator(e.target.value)}
              className="ginput w-full px-2 py-1.5 text-[10px]">
              {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
          </div>

          {!['exists', 'does not exist'].includes(operator) && (
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">Value</label>
              <input type="text" value={value} onChange={e => setValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Value..." className="ginput w-full px-2 py-1.5 text-[10px] font-mono" />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2 text-[10px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              Cancel
            </button>
            <button onClick={handleAdd}
              className="flex-1 py-2 text-[10px] font-semibold rounded-lg bg-[#EF843C] text-white hover:bg-[#e0752a] transition-colors">
              Add Filter
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
