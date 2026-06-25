import React, { useState, useEffect, useCallback } from 'react'

export default function ResizableSplitter({
  children,
  defaultRatio = 0.5,
  minRatio = 0.2,
  maxRatio = 0.8,
  direction = 'horizontal',
  storageKey = null
}) {
  const [ratio, setRatio] = useState(() => {
    if (storageKey) {
      try { return parseFloat(localStorage.getItem(storageKey)) || defaultRatio }
      catch { return defaultRatio }
    }
    return defaultRatio
  })
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e) => {
      const rect = document.getElementById('splitter-container')?.getBoundingClientRect()
      if (!rect) return
      let newRatio
      if (direction === 'horizontal') {
        newRatio = (e.clientX - rect.left) / rect.width
      } else {
        newRatio = (e.clientY - rect.top) / rect.height
      }
      setRatio(Math.max(minRatio, Math.min(maxRatio, newRatio)))
    }
    const handleUp = () => setDragging(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp) }
  }, [dragging, direction, minRatio, maxRatio])

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, String(ratio))
  }, [ratio, storageKey])

  useEffect(() => {
    document.body.style.cursor = dragging ? (direction === 'horizontal' ? 'col-resize' : 'row-resize') : ''
    return () => { document.body.style.cursor = '' }
  }, [dragging, direction])

  const childrenArr = React.Children.toArray(children)
  if (childrenArr.length !== 2) return children

  const isHorizontal = direction === 'horizontal'

  return (
    <div id="splitter-container" className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} h-full w-full overflow-hidden`}>
      <div className="overflow-hidden" style={isHorizontal ? { width: `${ratio * 100}%` } : { height: `${ratio * 100}%` }}>
        {childrenArr[0]}
      </div>
      <div
        onMouseDown={(e) => { e.preventDefault(); setDragging(true) }}
        className={`relative shrink-0 transition-colors ${
          isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
        } ${dragging ? 'bg-[#EF843C]' : 'bg-transparent hover:bg-[#EF843C]/40'}`}
      >
        <div className={`absolute ${isHorizontal ? 'inset-y-0 -left-0.5 -right-0.5' : 'inset-x-0 -top-0.5 -bottom-0.5'}`} />
      </div>
      <div className="overflow-hidden flex-1">
        {childrenArr[1]}
      </div>
    </div>
  )
}