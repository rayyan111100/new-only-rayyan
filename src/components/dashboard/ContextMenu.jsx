import React, { useEffect, useRef, useState } from 'react'

const COPIED_KEY = 'unishield_copied_design'

function hasCopiedDesign() {
  try { return !!localStorage.getItem(COPIED_KEY) } catch { return false }
}

const ITEMS = [
  {
    label: 'Visualization',
    icon: 'M12 20V10m-6 10V14m12 4V6',
    action: 'settings',
  },
  {
    label: 'Drill Down',
    icon: 'M18 10v-4c0-1.1-.9-2-2-2h-4m-4 0h-4c-1.1 0-2 .9-2 2v4m0 6v4c0 1.1.9 2 2 2h4m6 0h4c1.1 0 2-.9 2-2v-4',
    action: 'drilldown',
  },
  {
    label: 'Inspect',
    icon: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M5.636 18.364a9 9 0 1 0 12.728-12.728a9 9 0 0 0 -12.728 12.728',
    action: 'inspect',
  },
  { type: 'divider' },
  {
    label: 'Duplicate',
    icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
    action: 'duplicate',
  },
  {
    label: 'Clone Widget',
    icon: 'M7 17l5 5 5-5M7 7l5-5 5 5',
    sublabel: 'Ctrl+D',
    action: 'clone',
  },
  { type: 'divider' },
  {
    label: 'Copy Design',
    icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2',
    action: 'copydesign',
  },
  {
    label: 'Paste Design',
    icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6',
    action: 'pastedesign',
    dynamic: true,
  },
  { type: 'divider' },
  {
    label: 'Export Data',
    icon: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5m-5 5V3',
    action: 'export',
  },
  {
    label: 'Remove',
    icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    action: 'remove',
    danger: true,
  },
]

export default function ContextMenu({ x, y, panel, onAction, onClose }) {
  const ref = useRef(null)
  const [hasDesign, setHasDesign] = useState(hasCopiedDesign())

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    const k = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [onClose])

  const handleClick = (action) => {
    if (action === 'copydesign') {
      localStorage.setItem(COPIED_KEY, JSON.stringify({
        type: panel.type,
        vizType: panel.vizType,
        query: panel.query,
        vizConfig: panel.vizConfig,
        dataSource: panel.dataSource,
        w: panel.w,
        h: panel.h,
      }))
      setHasDesign(true)
      onClose()
      return
    }
    onAction(action, panel)
    onClose()
  }

  const menuX = Math.min(x, window.innerWidth - 170)
  const menuY = Math.min(y, window.innerHeight - 220)

  return (
    <div ref={ref}
      className="fixed z-[100] bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xl py-1 overflow-hidden"
      style={{ left: menuX, top: menuY, minWidth: 160 }}>
      {ITEMS.map((item) => {
        if (item.type === 'divider') return <div key={item.action || Math.random()} className="mx-2 h-px bg-zinc-200 dark:bg-zinc-700" />
        if (item.dynamic && item.action === 'pastedesign' && !hasDesign) return null
        return (
          <button key={item.action} onClick={() => handleClick(item.action)}
            className={'w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium transition-colors ' +
              (item.danger ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800')}>
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={item.icon}/></svg>
            <span className="flex-1">{item.label}</span>
            {item.sublabel && <span className="text-[8px] text-zinc-400 ml-2">{item.sublabel}</span>}
            {item.action === 'drilldown' && <svg className="w-3 h-3 ml-auto text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 7h10v10M7 17L17 7"/></svg>}
          </button>
        )
      })}
    </div>
  )
}
