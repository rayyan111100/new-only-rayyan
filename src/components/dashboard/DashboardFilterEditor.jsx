import React, { useState, useEffect, useRef, useMemo } from 'react'
import axios from 'axios'

const TYPE_ICONS = {
  string: { icon: 'T', color: '#7b7b7b' }, number: { icon: '#', color: '#e5830e' },
  date: { icon: 'D', color: '#b77c4f' }, ip: { icon: 'IP', color: '#8b5cf6' },
  boolean: { icon: '\u2713', color: '#1ea59a' }, keyword: { icon: 'T', color: '#7b7b7b' },
}

function getFieldType(type) {
  if (!type) return 'string'
  const t = type.toLowerCase()
  if (['long', 'integer', 'short', 'byte', 'float', 'double', 'half_float', 'scaled_float', 'unsigned_long'].includes(t)) return 'number'
  if (['date', 'date_nanos'].includes(t)) return 'date'
  if (['ip'].includes(t)) return 'ip'
  if (['boolean'].includes(t)) return 'boolean'
  if (['keyword', 'text', 'string'].includes(t)) return 'string'
  if (['object', 'geo_point', 'geo_shape', 'nested'].includes(t)) return 'object'
  return 'string'
}

const SUGGESTION_CACHE = new Map()
const CACHE_TTL = 120000

function parseRangeValue(raw) {
  const m = String(raw).match(/^\[(.+)\s+TO\s+(.+)\]$/)
  if (m) return { val: m[1].trim(), second: m[2].trim(), isRange: true }
  return { val: raw, second: '', isRange: false }
}

export default function DashboardFilterEditor({ filter, onSave, onClose }) {
  const fieldRef = useRef(null)
  const valueRootRef = useRef(null)
  const rootRef = useRef(null)
  const secondValueRef = useRef(null)

  const [field, setField] = useState(() => {
    if (filter?.key || filter?.field) return filter.key || filter.field
    if (filter?.type === 'text' && filter?.query?.includes(':')) {
      return filter.query.split(':')[0]
    }
    return ''
  })
  const [operator, setOperator] = useState(() => {
    if (filter?.operator && filter.operator !== 'is') return filter.operator
    const raw = filter?.value ?? (filter?.type === 'text' && filter?.query ? filter.query.split(':').slice(1).join(':') : '')
    if (parseRangeValue(raw).isRange) return 'is between'
    return 'is'
  })
  const [value, setValue] = useState(() => {
    if (filter?.value) {
      const p = parseRangeValue(filter.value)
      if (p.isRange) return p.val
      return filter.value
    }
    if (filter?.type === 'text' && filter?.query) {
      const idx = filter.query.indexOf(':')
      const raw = idx >= 0 ? filter.query.substring(idx + 1) : filter.query
      const p = parseRangeValue(raw)
      return p.isRange ? p.val : raw
    }
    return ''
  })
  const [secondValue, setSecondValue] = useState(() => {
    if (filter?.secondValue) {
      if (typeof filter.secondValue === 'string') return filter.secondValue
      return filter.secondValue?.to || filter.params?.to || ''
    }
    const raw = filter?.value ?? (filter?.type === 'text' && filter?.query ? filter.query.split(':').slice(1).join(':') : '')
    return parseRangeValue(raw).second
  })
  const [negate, setNegate] = useState(filter?.negate || false)
  const [fieldOpen, setFieldOpen] = useState(false)
  const [fieldSearch, setFieldSearch] = useState('')
  const [allFields, setAllFields] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loadingValues, setLoadingValues] = useState(false)
  const [valueOpen, setValueOpen] = useState(false)

  const fieldType = getFieldType(allFields.find(f => f.name === field)?.type || '')
  const typeIcon = TYPE_ICONS[fieldType] || TYPE_ICONS.string
  const isNumField = fieldType === 'number' || fieldType === 'date'

  useEffect(() => {
    axios.get('/api/fields', { params: { index: 'unishield360-alerts-4.x-*' }, timeout: 10000 })
      .then(d => setAllFields(d.data?.fields || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (field) {
      const ft = getFieldType(allFields.find(f => f.name === field)?.type || '')
      setOperator(ft === 'number' || ft === 'date' ? 'is between' : 'is')
    }
  }, [field, allFields])

  useEffect(() => {
    if (!field || operator === 'exists' || operator === 'does not exist') { setSuggestions([]); return }
    let cancelled = false
    const cacheKey = `suggest_${field}`
    const cached = SUGGESTION_CACHE.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setSuggestions(cached.data)
      return
    }
    setLoadingValues(true)
    axios.get('/api/aggregate', {
      params: { field, index: 'unishield360-alerts-4.x-*', type: 'terms', limit: 20, start_date: 'now-24h', end_date: 'now' },
      timeout: 10000
    }).then(d => {
      const buckets = d.data?.buckets || []
      if (!cancelled) {
        SUGGESTION_CACHE.set(cacheKey, { data: buckets, ts: Date.now() })
        setSuggestions(buckets)
      }
    }).catch(() => {
      if (!cancelled) setSuggestions([])
    }).finally(() => {
      if (!cancelled) setLoadingValues(false)
    })
    return () => { cancelled = true }
  }, [field, operator])

  useEffect(() => {
    function handleClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose?.()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  useEffect(() => {
    function handleClick(e) {
      if (valueRootRef.current && !valueRootRef.current.contains(e.target)) setValueOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (fieldOpen && fieldRef.current) fieldRef.current.focus()
  }, [fieldOpen])

  const filteredFields = useMemo(() => {
    if (!fieldSearch) return allFields.slice(0, 100)
    const q = fieldSearch.toLowerCase()
    return allFields.filter(f => f.name.toLowerCase().includes(q)).slice(0, 100)
  }, [allFields, fieldSearch])

  const filteredSuggestions = useMemo(() => {
    if (!value || !suggestions.length) return suggestions
    const q = value.toLowerCase()
    return suggestions.filter(s => String(s.key).toLowerCase().includes(q))
  }, [suggestions, value])

  return (
    <div className="gcard shadow-2xl" style={{ width: '600px' }} ref={rootRef} onClick={e => e.stopPropagation()}>
      <div className="px-3 py-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#202124] dark:text-[#e8eaed]">Edit filter</span>
        </div>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="flex gap-2">
          <div className="flex-[2] min-w-0">
            <label className="block text-[10px] text-[#5f6368] dark:text-[#9aa0a6] mb-0.5 font-medium">Field</label>
            <div className="relative">
              {fieldOpen ? (
                <div className="relative">
                  <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9ca3af] pointer-events-none z-10" viewBox="0 0 16 16" fill="currentColor">
                    <path d="m11.271 11.978 3.872 3.873a.502.502 0 0 0 .708 0 .502.502 0 0 0 0-.708l-3.565-3.564c2.38-2.747 2.267-6.923-.342-9.532-2.73-2.73-7.17-2.73-9.898 0-2.728 2.729-2.728 7.17 0 9.9a6.955 6.955 0 0 0 4.949 2.05.5.5 0 0 0 0-1 5.96 5.96 0 0 1-4.242-1.757 6.01 6.01 0 0 1 0-8.486c2.337-2.34 6.143-2.34 8.484 0a6.01 6.01 0 0 1 0 8.486.5.5 0 0 0 .034.738Z"/>
                  </svg>
                  <input ref={fieldRef} type="text" value={fieldSearch}
                    onChange={e => { setFieldSearch(e.target.value); setField('') }}
                    placeholder="Search fields..." className="ginput w-full pl-7 pr-2 py-1.5 text-xs"
                    onKeyDown={e => {
                      if (e.key === 'Escape') setFieldOpen(false)
                      if (e.key === 'Enter' && filteredFields.length === 1) {
                        setField(filteredFields[0].name); setFieldSearch(''); setFieldOpen(false)
                      }
                    }} autoFocus />
                </div>
              ) : (
                <div onClick={() => setFieldOpen(true)}
                  className="ginput w-full flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer text-left text-[#202124] dark:text-[#e8eaed] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors">
                  <span className="flex items-center justify-center shrink-0 text-[10px]" style={{ width: '18px', height: '18px', borderRadius: '3px', border: `1px solid ${typeIcon.color}40`, color: typeIcon.color }}>{typeIcon.icon}</span>
                  <span className="flex-1">{field || 'Select a field first'}</span>
                  {field && <span className="text-[9px] text-[#9ca3af] uppercase">{fieldType}</span>}
                  <svg className="w-3 h-3 text-[#9ca3af] shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M13.069 5.157 8.384 9.768a.546.546 0 0 1-.768 0L2.93 5.158a.552.552 0 0 0-.771 0 .53.53 0 0 0 0 .759l4.684 4.61c.641.631 1.672.63 2.312 0l4.684-4.61a.53.53 0 0 0 0-.76.552.552 0 0 0-.771 0Z"/></svg>
                </div>
              )}
              {fieldOpen && (
                <div className="absolute top-full left-0 right-0 mt-0.5 max-h-48 overflow-y-auto bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded shadow-lg z-10">
                  {filteredFields.map(f => {
                    const t = getFieldType(f.type)
                    const icon = TYPE_ICONS[t] || TYPE_ICONS.string
                    return (
                      <button key={f.name} onClick={() => { setField(f.name); setFieldSearch(''); setFieldOpen(false) }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors text-[#202124] dark:text-[#e8eaed]">
                        <span className="flex items-center justify-center shrink-0 text-[10px]" style={{ width: 18, height: 18, borderRadius: 3, border: `1px solid ${icon.color}40`, color: icon.color }}>{icon.icon}</span>
                        <span className="flex-1 truncate">{f.name}</span>
                        {f.type && <span className="text-[9px] text-[#9ca3af] uppercase">{f.type}</span>}
                      </button>
                    )
                  })}
                  {filteredFields.length === 0 && (
                    <div className="px-2 py-3 text-[10px] text-[#9ca3af] text-center">No matching fields</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-end gap-1 pb-[3px]">
            <label className="block text-[10px] text-[#5f6368] dark:text-[#9aa0a6] mb-0.5 font-medium">Operator</label>
            <span className="text-[10px] font-medium text-[#EF843C]">{isNumField ? 'Between (Range)' : 'Exact (Match)'}</span>
          </div>
        </div>
        <div ref={valueRootRef}>
          <label className="block text-[10px] text-[#5f6368] dark:text-[#9aa0a6] mb-0.5 font-medium">Value</label>
          <div className="relative">
            <div className="flex gap-2">
            <div className="flex-1">
              <input type="text" value={value} onChange={e => { setValue(e.target.value); setValueOpen(true) }}
                onFocus={() => setValueOpen(true)}
                placeholder={isNumField ? 'Min value' : 'Enter value...'}
                className="ginput w-full px-2 py-1.5 text-xs pr-7" autoComplete="off" />
            </div>
            {isNumField && (
              <div className="flex-1">
                <input ref={secondValueRef} type="text" value={secondValue} onChange={e => setSecondValue(e.target.value)}
                  placeholder="Max value"
                  className="ginput w-full px-2 py-1.5 text-xs" autoComplete="off" />
              </div>
            )}
          </div>
          {loadingValues && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <div className="w-3 h-3 border-2 border-[#EF843C] border-t-transparent rounded-full animate-spin" style={{ right: isNumField ? '50%' : '8px' }} />
            </div>
          )}
          {valueOpen && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-0.5 max-h-48 overflow-y-auto bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded shadow-lg z-20">
              {filteredSuggestions.map((s, i) => (
                <button key={s.key || i} onClick={() => { setValue(String(s.key)); setValueOpen(false) }}
                  className="w-full text-left px-2.5 py-1.5 text-xs transition-colors hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-[#202124] dark:text-[#e8eaed] flex items-center justify-between">
                  <span className="truncate">{String(s.key)}</span>
                  <span className="text-[9px] text-[#9ca3af] ml-2 shrink-0">{s.doc_count}</span>
                </button>
              ))}
            </div>
          )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <label className="flex items-center gap-1.5 text-xs text-[#202124] dark:text-[#e8eaed] cursor-pointer select-none">
              <input type="checkbox" checked={negate} onChange={e => setNegate(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#d1d5db] text-[#EF843C] focus:ring-[#EF843C]/30" />
              <span>Negate (NOT)</span>
            </label>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between px-3 py-2.5 border-t border-[#e5e7eb] dark:border-[#2d3140] bg-[#f9fafb] dark:bg-[#111318] rounded-b-lg">
        <div className="flex items-center gap-1">
          <button onClick={() => onSave?.({ key: field, value, secondValue, negate: false, operator, exclude: false, addNew: true, type: 'pair' })}
            className="text-[10px] px-2 py-1 rounded transition-colors hover:bg-green-500/10 text-green-600">+ Include</button>
          <button onClick={() => onSave?.({ key: field, value, secondValue, negate: true, operator, exclude: true, addNew: true, type: 'pair' })}
            className="text-[10px] px-2 py-1 rounded transition-colors hover:bg-red-500/10 text-red-600">− Exclude</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose}
            className="px-3 py-1 text-xs font-medium rounded text-[#EF843C] dark:text-[#EF843C] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors">Cancel</button>
          <button onClick={() => onSave?.({ key: field, value, secondValue, negate, operator, exclude: negate, addNew: false, type: 'pair' })}
            disabled={!value && operator !== 'exists' && operator !== 'does not exist'}
            className="px-3 py-1 text-xs font-semibold rounded bg-[#EF843C] text-white hover:bg-[#e0752a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Save</button>
        </div>
      </div>
    </div>
  )
}
