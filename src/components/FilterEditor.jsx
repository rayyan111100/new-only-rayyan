import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { api } from '../api'

const SUGGESTION_CACHE = new Map()
const CACHE_TTL = 120000

const OPERATORS_BY_TYPE = {
  string: [
    { value: 'is', label: 'is' }, { value: 'is not', label: 'is not' },
    { value: 'is one of', label: 'is one of' }, { value: 'is not one of', label: 'is not one of' },
    { value: 'contains', label: 'contains (\u007E)' }, { value: 'does not contain', label: 'does not contain' },
    { value: 'starts with', label: 'starts with' }, { value: 'ends with', label: 'ends with' },
    { value: 'matches regex', label: 'matches regex (/pattern/)' },
    { value: 'wildcard', label: 'wildcard (*?)' },
    { value: 'exists', label: 'exists' }, { value: 'does not exist', label: 'does not exist' }
  ],
  number: [
    { value: 'is', label: 'is' }, { value: 'is not', label: 'is not' },
    { value: 'is one of', label: 'is one of' }, { value: 'is not one of', label: 'is not one of' },
    { value: 'is greater than', label: 'is greater than' },
    { value: 'is less than', label: 'is less than' },
    { value: 'is greater than or equal', label: '\u2265' }, { value: 'is less than or equal', label: '\u2264' },
    { value: 'is between', label: 'is between' }, { value: 'is not between', label: 'is not between' },
    { value: 'exists', label: 'exists' }, { value: 'does not exist', label: 'does not exist' }
  ],
  date: [
    { value: 'is', label: 'is' }, { value: 'is not', label: 'is not' },
    { value: 'is after', label: 'is after', actual: 'is greater than' },
    { value: 'is after or equal', label: 'is after or equal', actual: 'is greater than or equal' },
    { value: 'is before', label: 'is before', actual: 'is less than' },
    { value: 'is before or equal', label: 'is before or equal', actual: 'is less than or equal' },
    { value: 'is between', label: 'is between' }, { value: 'is not between', label: 'is not between' },
    { value: 'last N', label: 'last N minutes/hours/days' },
    { value: 'exists', label: 'exists' }, { value: 'does not exist', label: 'does not exist' }
  ],
  ip: [
    { value: 'is', label: 'is' }, { value: 'is not', label: 'is not' },
    { value: 'is one of', label: 'is one of' }, { value: 'is not one of', label: 'is not one of' },
    { value: 'contains', label: 'contains (\u007E)' }, { value: 'does not contain', label: 'does not contain' },
    { value: 'starts with', label: 'starts with' }, { value: 'ends with', label: 'ends with' },
    { value: 'matches regex', label: 'matches regex (/pattern/)' },
    { value: 'exists', label: 'exists' }, { value: 'does not exist', label: 'does not exist' }
  ],
  boolean: [
    { value: 'is', label: 'is' }, { value: 'is not', label: 'is not' },
    { value: 'exists', label: 'exists' }, { value: 'does not exist', label: 'does not exist' }
  ],
  array: [
    { value: 'exists', label: 'exists' }, { value: 'does not exist', label: 'does not exist' }
  ],
  nested: [
    { value: 'exists', label: 'exists' }, { value: 'does not exist', label: 'does not exist' }
  ]
}

const DEFAULT_OPS = OPERATORS_BY_TYPE.string

const TYPE_ICONS = {
  string: { icon: 'T', color: '#7b7b7b' },
  number: { icon: '#', color: '#e5830e' },
  date: { icon: 'D', color: '#b77c4f' },
  ip: { icon: 'IP', color: '#8b5cf6' },
  boolean: { icon: '\u2713', color: '#1ea59a' },
  object: { icon: '{}', color: '#7b7b7b' },
  array: { icon: '[]', color: '#06b6d4' },
  nested: { icon: '{}', color: '#22c55e' },
  keyword: { icon: 'T', color: '#7b7b7b' },
  text: { icon: 'T', color: '#7b7b7b' },
  long: { icon: '#', color: '#e5830e' },
  integer: { icon: '#', color: '#e5830e' },
  float: { icon: '#', color: '#e5830e' },
  double: { icon: '#', color: '#e5830e' }
}

function mapElasticType(esType) {
  if (!esType) return 'string'
  const t = esType.toLowerCase()
  if (['long', 'integer', 'short', 'byte', 'float', 'double', 'half_float', 'scaled_float', 'unsigned_long'].includes(t)) return 'number'
  if (['date', 'date_nanos'].includes(t)) return 'date'
  if (['ip'].includes(t)) return 'ip'
  if (['boolean'].includes(t)) return 'boolean'
  if (['keyword', 'text', 'string'].includes(t)) return 'string'
  if (['array'].includes(t)) return 'array'
  if (['nested'].includes(t)) return 'nested'
  if (['object', 'geo_point', 'geo_shape'].includes(t)) return 'object'
  return 'string'
}

function ComboBox({ options, value, onChange, placeholder, disabled }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef(null)
  const rootRef = useRef(null)

  const selected = options.find(o => (o.actual || o.value) === value)

  const filtered = useMemo(() => {
    if (!search) return options
    const q = search.toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(q) || (o.value || '').toLowerCase().includes(q))
  }, [options, search])

  useEffect(() => {
    function handleClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const select = useCallback((opt) => {
    onChange(opt.actual || opt.value)
    setOpen(false)
    setSearch('')
    setActiveIdx(-1)
  }, [onChange])

  const handleKey = useCallback((e) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActiveIdx(p => Math.min(p + 1, filtered.length - 1)); break
      case 'ArrowUp': e.preventDefault(); setActiveIdx(p => Math.max(p - 1, 0)); break
      case 'Enter': e.preventDefault(); if (filtered[activeIdx]) select(filtered[activeIdx]); break
      case 'Escape': e.preventDefault(); setOpen(false); break
    }
  }, [filtered, activeIdx, select])

  return (
    <div ref={rootRef} className="relative">
      <div
        className={`ginput w-full flex items-center gap-1 px-2 py-1.5 text-xs cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => { if (!disabled) { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50) } }}
        tabIndex={-1}
      >
        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setActiveIdx(0) }}
            onKeyDown={handleKey}
            placeholder="Type to search..."
            className="flex-1 bg-transparent outline-none border-none text-xs text-[#202124] dark:text-[#e8eaed]"
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className={`flex-1 ${!selected ? 'text-[#9ca3af]' : 'text-[#202124] dark:text-[#e8eaed]'}`}>
            {selected ? selected.label : (placeholder || 'Select...')}
          </span>
        )}
        <svg className="w-3 h-3 text-[#9ca3af] shrink-0 transition-transform" style={{ transform: open ? 'rotate(180deg)' : '' }} viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.069 5.157 8.384 9.768a.546.546 0 0 1-.768 0L2.93 5.158a.552.552 0 0 0-.771 0 .53.53 0 0 0 0 .759l4.684 4.61c.641.631 1.672.63 2.312 0l4.684-4.61a.53.53 0 0 0 0-.76.552.552 0 0 0-.771 0Z"/>
        </svg>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-0.5 max-h-48 overflow-y-auto bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded shadow-lg z-20">
          {filtered.map((opt, i) => (
            <button
              key={opt.value}
              onClick={() => select(opt)}
              className={`w-full text-left px-2.5 py-1.5 text-xs transition-colors ${
                i === activeIdx
                  ? 'bg-[#e8f0fe] dark:bg-[#2d3140] text-[#EF843C] dark:text-[#EF843C]'
                  : (opt.actual || opt.value) === value
                    ? 'bg-[#f3f4f6] dark:bg-[#111318] text-[#202124] dark:text-[#e8eaed]'
                    : 'text-[#202124] dark:text-[#e8eaed] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'
              }`}
            >{opt.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FilterEditor({ filter = null, onClose, onSave }) {
  const { fields, addFilter, loadFields, doSearch } = useApp()
  const isEdit = !!filter

  const initOp = filter?.operator || (filter?.type === 'exists' ? 'exists' : 'is')
  const [field, setField] = useState(filter?.field || '')
  const [operator, setOperator] = useState(initOp)
  const [value, setValue] = useState(filter?.value && filter.value !== '_exists_' ? filter.value : filter?.params?.from || '')
  const [secondValue, setSecondValue] = useState(filter?.secondValue || filter?.params?.to || '')
  const [lastNUnit, setLastNUnit] = useState(filter?.params?.unit || 'h')
  const [negate, setNegate] = useState(filter?.negate || false)
  const [customLabel, setCustomLabel] = useState('')
  const [showCustomLabel, setShowCustomLabel] = useState(false)
  const [fieldSearch, setFieldSearch] = useState('')
  const [showFieldDropdown, setShowFieldDropdown] = useState(false)

  const [suggestions, setSuggestions] = useState([])
  const [valueOpen, setValueOpen] = useState(false)
  const [valueActiveIdx, setValueActiveIdx] = useState(-1)
  const [loadingValues, setLoadingValues] = useState(false)
  const valueRootRef = useRef(null)

  const fieldRef = useRef(null)
  const rootRef = useRef(null)

  useEffect(() => { loadFields() }, [])

  useEffect(() => {
    if (!field || isExistsOp || isRangeOp || isListOp || isLastNOp) { setSuggestions([]); return }
    let cancelled = false
    const cacheKey = `suggest_${field}`
    const cached = SUGGESTION_CACHE.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setSuggestions(cached.data)
      return
    }
    setLoadingValues(true)
    api('aggregate', { field, index: 'unishield360-alerts-4.x-*', type: 'terms', limit: 20 })
      .then(d => {
        const buckets = d.buckets || []
        if (!cancelled) {
          SUGGESTION_CACHE.set(cacheKey, { data: buckets, ts: Date.now() })
          setSuggestions(buckets)
        }
      })
      .catch(() => { if (!cancelled) setSuggestions([]) })
      .finally(() => { if (!cancelled) setLoadingValues(false) })
    return () => { cancelled = true }
  }, [field])

  useEffect(() => {
    function handleClick(e) {
      if (valueRootRef.current && !valueRootRef.current.contains(e.target)) setValueOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredSuggestions = useMemo(() => {
    if (!value || !suggestions.length) return suggestions
    const q = value.toLowerCase()
    return suggestions.filter(s => String(s.key).toLowerCase().includes(q))
  }, [suggestions, value])

  useEffect(() => {
    if (showFieldDropdown && fieldRef.current) fieldRef.current.focus()
  }, [showFieldDropdown])

  useEffect(() => {
    function handleClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose?.()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const fieldMeta = useMemo(() => fields.find(f => f.name === field), [fields, field])
  const fieldTypeLabel = fieldMeta?.type || ''
  const fieldType = mapElasticType(fieldTypeLabel)
  const ops = OPERATORS_BY_TYPE[fieldType] || DEFAULT_OPS

  const isRangeOp = operator === 'is between' || operator === 'is not between'
  const isListOp = operator === 'is one of' || operator === 'is not one of'
  const isExistsOp = operator === 'exists' || operator === 'does not exist'
  const isLastNOp = operator === 'last N'
  const isRegexOp = operator === 'matches regex'
  const isWildcardOp = operator === 'wildcard'
  const alreadyNegated = ['is not', 'does not contain', 'is not one of', 'is not between'].includes(operator)
  const isNegatable = !isExistsOp && !alreadyNegated && !isLastNOp

  const filteredFields = useMemo(() => {
    if (!fieldSearch) return fields.slice(0, 100)
    const q = fieldSearch.toLowerCase()
    return fields.filter(f => f.name.toLowerCase().includes(q)).slice(0, 100)
  }, [fields, fieldSearch])

  const doSave = () => {
    if (!field) return
    if (!isExistsOp && !isRangeOp && !isLastNOp && !value) return
    if (isRangeOp && (!value || !secondValue)) return
    if (isLastNOp && (!value || isNaN(parseInt(value)))) return

    const saveParams = isRangeOp ? { from: value, to: secondValue } : isLastNOp ? { unit: lastNUnit } : null

    if (isEdit && filter) {
      onSave?.({
        ...filter,
        field,
        value: isExistsOp ? '_exists_' : value,
        secondValue: isRangeOp ? secondValue : null,
        operator,
        type: isExistsOp ? 'exists' : 'value',
        negate: isNegatable ? negate : false,
        disabled: filter.disabled || false,
        params: saveParams,
        customLabel: showCustomLabel ? customLabel || null : null
      })
    } else {
      const actualNegate = isNegatable ? negate : false
      if (isExistsOp) addFilter(field, value || '__exists__', false, operator)
      else addFilter(field, value, actualNegate, operator, saveParams)
      doSearch()
    }
    onClose?.()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="gcard absolute top-full left-0 mt-1 z-50 shadow-xl"
      style={{ width: 600 }}
      ref={rootRef}
      onClick={e => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#202124] dark:text-[#e8eaed]">
            {isEdit ? 'Edit filter' : 'Add filter'}
          </span>
          <button className="text-[11px] text-[#EF843C] dark:text-[#EF843C] hover:underline font-medium">
            Edit as Query DSL
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        <div className="flex gap-2">
          <div className="flex-[2] min-w-0">
            <label className="block text-[10px] text-[#5f6368] dark:text-[#9aa0a6] mb-0.5 font-medium">Field</label>
            <div className="relative">
              {showFieldDropdown ? (
                <div className="relative">
                  <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9ca3af] pointer-events-none z-10" viewBox="0 0 16 16" fill="currentColor">
                    <path d="m11.271 11.978 3.872 3.873a.502.502 0 0 0 .708 0 .502.502 0 0 0 0-.708l-3.565-3.564c2.38-2.747 2.267-6.923-.342-9.532-2.73-2.73-7.17-2.73-9.898 0-2.728 2.729-2.728 7.17 0 9.9a6.955 6.955 0 0 0 4.949 2.05.5.5 0 0 0 0-1 5.96 5.96 0 0 1-4.242-1.757 6.01 6.01 0 0 1 0-8.486c2.337-2.34 6.143-2.34 8.484 0a6.01 6.01 0 0 1 0 8.486.5.5 0 0 0 .034.738Z"/>
                  </svg>
                  <input
                    ref={fieldRef}
                    type="text"
                    value={fieldSearch}
                    onChange={e => { setFieldSearch(e.target.value); setField('') }}
                    placeholder="Search fields..."
                    className="ginput w-full pl-7 pr-2 py-1.5 text-xs"
                    onKeyDown={e => {
                      if (e.key === 'Escape') setShowFieldDropdown(false)
                      if (e.key === 'Enter' && filteredFields.length === 1) {
                        setField(filteredFields[0].name); setFieldSearch(''); setShowFieldDropdown(false)
                      }
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <div
                  onClick={() => setShowFieldDropdown(true)}
                  className="ginput w-full flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer text-left text-[#202124] dark:text-[#e8eaed] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors"
                >
                  {field ? (
                    <>
                      {fieldMeta && (() => {
                        const t = mapElasticType(fieldMeta.type)
                        const icon = TYPE_ICONS[t] || TYPE_ICONS.string
                        return <span className="flex items-center justify-center shrink-0 text-[10px]" style={{ width: 18, height: 18, borderRadius: 3, border: `1px solid ${icon.color}40`, color: icon.color }}>{icon.icon}</span>
                      })()}
                      <span className="flex-1">{field}</span>
                      {fieldTypeLabel && <span className="text-[9px] text-[#9ca3af] uppercase">{fieldTypeLabel}</span>}
                    </>
                  ) : (
                    <span className="text-[#9ca3af]">Select a field first</span>
                  )}
                  <svg className="w-3 h-3 text-[#9ca3af] shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M13.069 5.157 8.384 9.768a.546.546 0 0 1-.768 0L2.93 5.158a.552.552 0 0 0-.771 0 .53.53 0 0 0 0 .759l4.684 4.61c.641.631 1.672.63 2.312 0l4.684-4.61a.53.53 0 0 0 0-.76.552.552 0 0 0-.771 0Z"/></svg>
                </div>
              )}
              {showFieldDropdown && (
                <div className="absolute top-full left-0 right-0 mt-0.5 max-h-48 overflow-y-auto bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded shadow-lg z-10">
                  {filteredFields.map(f => {
                    const t = mapElasticType(f.type)
                    const icon = TYPE_ICONS[t] || TYPE_ICONS.string
                    return (
                      <button
                        key={f.name}
                        onClick={() => { setField(f.name); setFieldSearch(''); setShowFieldDropdown(false) }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors text-[#202124] dark:text-[#e8eaed]"
                      >
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

          <div style={{ flexBasis: 160 }} className="min-w-0">
            <label className="block text-[10px] text-[#5f6368] dark:text-[#9aa0a6] mb-0.5 font-medium">Operator</label>
            <ComboBox
              options={ops}
              value={operator}
              onChange={val => { setOperator(val); if (['exists', 'does not exist'].includes(val)) { setValue(''); setSecondValue('') } }}
              placeholder={field ? 'Select operator' : 'Waiting'}
              disabled={!field}
            />
          </div>
        </div>

        {field && (
          <div data-test-subj="filterParams">
            {!isExistsOp && !isRangeOp && !isListOp && !isLastNOp && (
              <div>
                <label className="block text-[10px] text-[#5f6368] dark:text-[#9aa0a6] mb-0.5 font-medium">
                  {isRegexOp ? 'Regex pattern' : isWildcardOp ? 'Wildcard pattern' : 'Value'}
                </label>
                <div className="relative" ref={valueRootRef}>
                  <div className="relative">
                    {isRegexOp ? (
                      <div className="flex items-center ginput">
                        <span className="text-[#9ca3af] text-xs px-1.5">/</span>
                        <input
                          type="text"
                          value={value}
                          onChange={e => setValue(e.target.value)}
                          placeholder="pattern"
                          className="flex-1 bg-transparent outline-none border-none text-xs py-1.5 text-[#202124] dark:text-[#e8eaed]"
                          onKeyDown={e => e.key === 'Enter' && doSave()}
                          autoFocus
                        />
                        <span className="text-[#9ca3af] text-xs px-1.5">/</span>
                      </div>
                    ) : isWildcardOp ? (
                      <div>
                        <input
                          type="text"
                          value={value}
                          onChange={e => setValue(e.target.value)}
                          placeholder="Use * for multiple chars, ? for single char"
                          className="ginput w-full px-2 py-1.5 text-xs"
                          onKeyDown={e => e.key === 'Enter' && doSave()}
                          autoFocus
                        />
                        <div className="text-[9px] text-[#9ca3af] mt-0.5 px-1">Tip: <code className="bg-gray-100 dark:bg-gray-700 px-0.5 rounded">*</code> matches any, <code className="bg-gray-100 dark:bg-gray-700 px-0.5 rounded">?</code> matches one character</div>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={value}
                        onChange={e => { setValue(e.target.value); setValueOpen(true); setValueActiveIdx(-1) }}
                        onFocus={() => setValueOpen(true)}
                        placeholder={fieldType === 'boolean' ? 'true / false' : 'Enter value...'}
                        className="ginput w-full px-2 py-1.5 text-xs pr-7"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            if (valueOpen && filteredSuggestions[valueActiveIdx]) {
                              setValue(String(filteredSuggestions[valueActiveIdx].key))
                              setValueOpen(false)
                            } else {
                              doSave()
                            }
                          }
                          if (e.key === 'ArrowDown') { e.preventDefault(); setValueActiveIdx(p => Math.min(p + 1, filteredSuggestions.length - 1)) }
                          if (e.key === 'ArrowUp') { e.preventDefault(); setValueActiveIdx(p => Math.max(p - 1, 0)) }
                          if (e.key === 'Escape') setValueOpen(false)
                        }}
                        autoFocus
                      />
                    )}
                    {loadingValues && !isRegexOp && !isWildcardOp && (
                      <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9ca3af] animate-spin" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 12.5A5.5 5.5 0 1 1 8 2.5a5.5 5.5 0 0 1 0 11Z" opacity="0.3"/>
                        <path d="M15 8a7 7 0 0 0-7-7v2a5 5 0 0 1 5 5h2Z"/>
                      </svg>
                    )}
                  </div>
                  {!isRegexOp && !isWildcardOp && valueOpen && filteredSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-0.5 max-h-48 overflow-y-auto bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded shadow-lg z-20">
                      {filteredSuggestions.map((s, i) => (
                        <button
                          key={s.key}
                          onClick={() => { setValue(String(s.key)); setValueOpen(false) }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs transition-colors ${
                            i === valueActiveIdx
                              ? 'bg-[#e8f0fe] dark:bg-[#2d3140] text-[#EF843C] dark:text-[#EF843C]'
                              : 'text-[#202124] dark:text-[#e8eaed] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'
                          }`}
                        >
                          <span className="truncate">{String(s.key)}</span>
                          <span className="text-[9px] text-[#9ca3af] ml-2 shrink-0">{s.count || s.doc_count || ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isListOp && (
              <div>
                <label className="block text-[10px] text-[#5f6368] dark:text-[#9aa0a6] mb-0.5 font-medium">Values (comma-separated)</label>
                <textarea
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder="val1, val2, val3"
                  rows={2}
                  className="ginput w-full px-2 py-1.5 text-xs resize-none"
                  onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) doSave() }}
                />
              </div>
            )}

            {isRangeOp && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-[#5f6368] dark:text-[#9aa0a6] mb-0.5 font-medium">From</label>
                  <input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder="Min" className="ginput w-full px-2 py-1.5 text-xs" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-[#5f6368] dark:text-[#9aa0a6] mb-0.5 font-medium">To</label>
                  <input type="text" value={secondValue} onChange={e => setSecondValue(e.target.value)} placeholder="Max" className="ginput w-full px-2 py-1.5 text-xs" onKeyDown={e => e.key === 'Enter' && doSave()} />
                </div>
              </div>
            )}

            {isLastNOp && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] text-[#5f6368] dark:text-[#9aa0a6] mb-0.5 font-medium">Last</label>
                  <input type="number" min="1" value={value} onChange={e => setValue(e.target.value)} placeholder="15" className="ginput w-full px-2 py-1.5 text-xs" />
                </div>
                <div className="flex-none">
                  <label className="block text-[10px] text-[#5f6368] dark:text-[#9aa0a6] mb-0.5 font-medium">Unit</label>
                  <select value={lastNUnit} onChange={e => { setLastNUnit(e.target.value); setValue(value || '1') }}
                    className="ginput px-2 py-1.5 text-xs">
                    <option value="m">minutes</option>
                    <option value="h">hours</option>
                    <option value="d">days</option>
                    <option value="w">weeks</option>
                    <option value="M">months</option>
                  </select>
                </div>
              </div>
            )}

            {isExistsOp && (
              <div className="text-xs text-[#9ca3af] py-1">
                {operator === 'exists'
                  ? 'Results must have a value for this field'
                  : 'Results must not have a value for this field'}
              </div>
            )}

            {isNegatable && (
              <div className="flex items-center gap-2 mt-2">
                <label className="flex items-center gap-1.5 text-xs text-[#202124] dark:text-[#e8eaed] cursor-pointer select-none">
                  <input type="checkbox" checked={negate} onChange={e => setNegate(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-[#d1d5db] text-[#EF843C] focus:ring-[#EF843C]/30" />
                  <span>Negate (NOT)</span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-[#e5e7eb] dark:border-[#2d3140]">
        <label className="flex items-center gap-2 text-xs text-[#202124] dark:text-[#e8eaed] cursor-pointer select-none">
          <button
            role="switch"
            type="button"
            aria-checked={showCustomLabel}
            onClick={() => setShowCustomLabel(!showCustomLabel)}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${showCustomLabel ? 'bg-[#EF843C]' : 'bg-[#d1d5db] dark:bg-[#3c4043]'}`}
          >
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${showCustomLabel ? 'translate-x-[14px]' : 'translate-x-[2px]'}`} />
          </button>
          <span>Create custom label?</span>
        </label>
        {showCustomLabel && (
          <input
            type="text"
            value={customLabel}
            onChange={e => setCustomLabel(e.target.value)}
            placeholder="Custom label for this filter"
            className="ginput w-full px-2 py-1 text-xs mt-1.5"
          />
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2.5 border-t border-[#e5e7eb] dark:border-[#2d3140] bg-[#f9fafb] dark:bg-[#111318] rounded-b-lg">
        <div />
        <div className="flex items-center gap-2">
          <button onClick={onClose}
            className="px-3 py-1 text-xs font-medium rounded text-[#EF843C] dark:text-[#EF843C] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors"
          >Cancel</button>
          <button onClick={doSave}
            disabled={!field || (!isExistsOp && !isRangeOp && !isLastNOp && !value) || (isRangeOp && (!value || !secondValue)) || (isLastNOp && (!value || isNaN(parseInt(value))))}
            className="px-3 py-1 text-xs font-semibold rounded bg-[#EF843C] text-white hover:bg-[#e0752a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >{isEdit ? 'Save' : 'Add'}</button>
        </div>
      </div>
    </motion.div>
  )
}
