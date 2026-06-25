import React from 'react'

export default function MetricChart({ value, config = {} }) {
  const displayValue = (() => {
    if (value === null || value === undefined) return '—'
    const v = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(v)) return value
    if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B'
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
    return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1)
  })()

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div
        className="font-bold tracking-tight text-zinc-800 dark:text-zinc-100"
        style={{ fontSize: config.fontSize || 36 }}
      >
        {config.prefix && (
          <span className="text-zinc-400 dark:text-zinc-500 text-sm mr-1">{config.prefix}</span>
        )}
        {displayValue}
        {config.suffix && (
          <span className="text-zinc-400 dark:text-zinc-500 text-sm ml-1">{config.suffix}</span>
        )}
      </div>
      {config.label && (
        <div className="text-xs text-zinc-400 dark:text-zinc-500 font-medium mt-1">{config.label}</div>
      )}
      {config.subtitle && (
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{config.subtitle}</div>
      )}
      {config.change !== undefined && (
        <div className={`text-[11px] font-medium mt-1 ${config.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {config.change >= 0 ? '+' : ''}{config.change}%
        </div>
      )}
    </div>
  )
}
