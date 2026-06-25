import React, { useState, useCallback } from 'react'

export default function FilterPanel({ fields = [], onFilterChange }) {
  const [selectedField, setSelectedField] = useState('')
  const [operator, setOperator] = useState('is')
  const [value, setValue] = useState('')
  const [kqlQuery, setKqlQuery] = useState('')
  const [useKql, setUseKql] = useState(false)
  const [recentFilters, setRecentFilters] = useState([])

  const operators = ['is', 'is not', 'contains', 'does not contain', 'exists', 'does not exist', 'starts with', 'ends with', '>', '>=', '<', '<=']

  const handleAddFilter = useCallback(() => {
    if (!selectedField && !useKql) return
    const filter = useKql
      ? { type: 'kql', query: kqlQuery }
      : { field: selectedField, operator, value, type: 'field' }
    if (onFilterChange) onFilterChange(filter)
    setRecentFilters(prev => [filter, ...prev].slice(0, 10))
    if (!useKql) { setValue('') }
    else { setKqlQuery('') }
  }, [selectedField, operator, value, kqlQuery, useKql, onFilterChange])

  const handleQuickFilter = useCallback((filter) => {
    if (onFilterChange) onFilterChange(filter)
  }, [onFilterChange])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setUseKql(false)}
          className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-colors ${
            !useKql
              ? 'bg-[#EF843C] text-white border-[#EF843C]'
              : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
          }`}
        >
          Field Filter
        </button>
        <button
          onClick={() => setUseKql(true)}
          className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-colors ${
            useKql
              ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]'
              : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
          }`}
        >
          KQL Query
        </button>
      </div>

      {useKql ? (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={kqlQuery}
              onChange={e => setKqlQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddFilter()}
              placeholder='e.g. rule.level:10 OR rule.groups:windows'
              className="ginput w-full px-3 py-2 text-[11px] font-mono bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:border-[#8b5cf6]/40 focus:ring-2 focus:ring-[#8b5cf6]/10 outline-none transition-all"
            />
            <div className="mt-1 text-[9px] text-zinc-400 leading-relaxed">
              Use <code className="text-[#8b5cf6] font-mono">field:value</code>, <code className="text-[#8b5cf6] font-mono">AND</code>, <code className="text-[#8b5cf6] font-mono">OR</code>, <code className="text-[#8b5cf6] font-mono">_exists_</code>
            </div>
          </div>
          <button onClick={handleAddFilter}
            className="w-full py-1.5 text-[10px] font-semibold rounded-lg bg-[#8b5cf6] text-white hover:bg-[#7c3aed] transition-colors">
            Apply KQL
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <select value={selectedField} onChange={e => setSelectedField(e.target.value)}
            className="ginput w-full px-2 py-1.5 text-[10px] font-mono">
            <option value="">Select field...</option>
            {fields.map(f => (
              <option key={f.name || f} value={f.name || f}>{f.name || f}</option>
            ))}
          </select>
          {selectedField && (
            <>
              <select value={operator} onChange={e => setOperator(e.target.value)}
                className="ginput w-full px-2 py-1.5 text-[10px]">
                {operators.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              {!['exists', 'does not exist'].includes(operator) && (
                <input type="text" value={value} onChange={e => setValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddFilter()}
                  placeholder="Value..." className="ginput w-full px-2 py-1.5 text-[10px] font-mono" />
              )}
              <button onClick={handleAddFilter}
                className="w-full py-1.5 text-[10px] font-semibold rounded-lg bg-[#EF843C] text-white hover:bg-[#e0752a] transition-colors">
                Add Filter
              </button>
            </>
          )}
        </div>
      )}

      {recentFilters.length > 0 && (
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Recent</div>
          <div className="space-y-1">
            {recentFilters.map((f, i) => (
              <button key={i} onClick={() => handleQuickFilter(f)}
                className="w-full text-left px-2 py-1.5 text-[9px] font-mono rounded-lg bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-700/40 text-zinc-600 dark:text-zinc-400 transition-colors truncate">
                {f.type === 'kql' ? f.query : `${f.field} ${f.operator} ${f.value}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
