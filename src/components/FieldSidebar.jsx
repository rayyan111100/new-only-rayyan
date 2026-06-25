import React, { useEffect, useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'

export default function FieldSidebar() {
  const { fields, columns, toggleColumn, loadFields, isDark } = useApp()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => { loadFields() }, [])

  const types = useMemo(() => {
    const s = new Set(fields.map(f => f.type).filter(Boolean))
    return ['all', ...Array.from(s).slice(0, 20)]
  }, [fields])

  const filtered = useMemo(() => {
    let f = fields
    if (search) {
      const q = search.toLowerCase()
      f = f.filter(fld => fld.name.toLowerCase().includes(q))
    }
    if (typeFilter !== 'all') f = f.filter(fld => fld.type === typeFilter)
    return f
  }, [fields, search, typeFilter])

  const selected = filtered.filter(f => columns.includes(f.name))
  const available = filtered.filter(f => !columns.includes(f.name))

  const hover = isDark ? 'hover:bg-[#3c4043]/50' : 'hover:bg-[#f1f3f4]'
  const txt = isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'

  return (
    <div className="gcard flex flex-col max-h-[600px]">
      <div className="px-2.5 py-2 border-b border-[#dadce0] dark:border-[#3c4043] space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wide">Fields</span>
          <span className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6]">{fields.length} available</span>
        </div>
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#5f6368] dark:text-[#9aa0a6]" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="m11.271 11.978 3.872 3.873a.502.502 0 0 0 .708 0 .502.502 0 0 0 0-.708l-3.565-3.564c2.38-2.747 2.267-6.923-.342-9.532-2.73-2.73-7.17-2.73-9.898 0-2.728 2.729-2.728 7.17 0 9.9a6.955 6.955 0 0 0 4.949 2.05.5.5 0 0 0 0-1 5.96 5.96 0 0 1-4.242-1.757 6.01 6.01 0 0 1 0-8.486c2.337-2.34 6.143-2.34 8.484 0a6.01 6.01 0 0 1 0 8.486.5.5 0 0 0 .034.738Z"/>
          </svg>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search field names"
            className="w-full pl-6 pr-2 py-1 text-xs border border-[#dadce0] dark:border-[#3c4043] rounded bg-white dark:bg-[#1a1a1a] text-[#202124] dark:text-[#e8eaed] placeholder-[#5f6368] dark:placeholder-[#9aa0a6] outline-none focus:border-[#EF843C] dark:focus:border-[#EF843C] transition-colors"
          />
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3 text-[#5f6368] dark:text-[#9aa0a6] shrink-0" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="m9.759 12.652-1.8 2.25-.78-.625 1.8-2.25A.1.1 0 0 0 9 11.965V8.362a1 1 0 0 1 .232-.64l4.631-5.558A.1.1 0 0 0 13.787 2H2.213a.1.1 0 0 0-.077.164l4.631 5.558a1 1 0 0 1 .232.64v5.853a.1.1 0 0 0 .178.062l.781.625c-.65.812-1.959.353-1.959-.687V8.362L1.368 2.804C.771 2.088 1.281 1 2.214 1h11.573c.932 0 1.442 1.088.845 1.804L10 8.362v3.603a1.1 1.1 0 0 1-.241.687Z"/>
          </svg>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="flex-1 px-1.5 py-1 text-[10px] border border-[#dadce0] dark:border-[#3c4043] rounded bg-white dark:bg-[#1a1a1a] text-[#202124] dark:text-[#e8eaed] outline-none"
          >
            <option value="all">Filter by type</option>
            {types.filter(t => t !== 'all').map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selected.length > 0 && (
          <>
            <div className={`text-[10px] font-medium uppercase px-2.5 pt-1.5 pb-0.5 ${txt}`}>Selected</div>
            {selected.map(f => (
              <div key={f.name} onClick={() => toggleColumn(f.name)}
                className={`flex items-center justify-between px-2.5 py-0.5 cursor-pointer text-xs ${hover} transition-colors`}>
                <span className="text-[#EF843C] dark:text-[#EF843C] font-medium truncate">{f.name}</span>
                <span className={`text-[10px] ${txt} shrink-0`}>column</span>
              </div>
            ))}
          </>
        )}
        <div className={`text-[10px] font-medium uppercase px-2.5 pt-1.5 pb-0.5 ${txt}`}>
          {available.length ? 'Available' : 'No matching fields'}
        </div>
        {available.slice(0, 200).map(f => (
          <div key={f.name} onClick={() => toggleColumn(f.name)}
            className={`flex items-center justify-between px-2.5 py-0.5 cursor-pointer text-xs ${hover} transition-colors group`}>
            <span className="truncate text-[#202124] dark:text-[#e8eaed]">{f.name}</span>
            <span className={`text-[10px] ${txt} shrink-0 ml-1`}>{f.type || ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
