import React, { useState, useEffect } from 'react'

export default function ResizablePanel({
  children,
  defaultWidth = 224,
  minWidth = 160,
  maxWidth = 400,
  side = 'left',
  visible = true,
  storageKey = null
}) {
  const [width, setWidth] = useState(() => {
    if (storageKey) {
      try { return parseInt(localStorage.getItem(storageKey)) || defaultWidth }
      catch { return defaultWidth }
    }
    return defaultWidth
  })
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e) => {
      const newW = side === 'left' ? e.clientX : window.innerWidth - e.clientX
      setWidth(Math.max(minWidth, Math.min(maxWidth, newW)))
    }
    const handleUp = () => setDragging(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp) }
  }, [dragging, side, minWidth, maxWidth])

  // Persist width
  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, String(width))
  }, [width, storageKey])

  useEffect(() => {
    if (dragging) document.body.style.cursor = 'col-resize'
    else document.body.style.cursor = ''
  }, [dragging])

  if (!visible) return null

  return (
    <div className="flex h-full">
      {side === 'right' && (
        <div
          onMouseDown={() => setDragging(true)}
          className={`relative shrink-0 w-1 cursor-col-resize transition-colors ${
            dragging ? 'bg-[#EF843C]' : 'bg-transparent hover:bg-[#EF843C]/40'
          }`}
        >
          <div className="absolute inset-y-0 -left-0.5 -right-0.5" />
        </div>
      )}
      <div className={`shrink-0 overflow-hidden bg-white dark:bg-[#1e2337] ${side === 'left' ? 'border-r' : 'border-l'} border-[#e8eaed] dark:border-[#2a3042]`}
        style={{ width }}>
        {children}
      </div>
      {side === 'left' && (
        <div
          onMouseDown={() => setDragging(true)}
          className={`relative shrink-0 w-1 cursor-col-resize transition-colors ${
            dragging ? 'bg-[#EF843C]' : 'bg-transparent hover:bg-[#EF843C]/40'
          }`}
        >
          <div className="absolute inset-y-0 -left-0.5 -right-0.5" />
        </div>
      )}
    </div>
  )
}
