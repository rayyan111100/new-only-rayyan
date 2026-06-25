import React, { useState, useEffect } from 'react'
import { api } from '../api'

export default function HealthTab() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    (async () => {
      try { setHealth(await api('health', {})) }
      catch (e) { setError(e.message) }
    })()
  }, [])
  if (error) return <div className="p-4 text-xs text-red-500">{'\u274C'} {error}</div>
  if (!health) return <div className="p-4 text-xs text-soc-stext dark:text-soc-darkstext">{'\u23F3'} Checking...</div>
  return (
    <div className="space-y-3">
      <div className="gcard p-4">
        <div className="text-sm font-semibold text-soc-text dark:text-soc-darktext mb-3">API Health</div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(health).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-xs font-medium text-soc-stext dark:text-soc-darkstext capitalize">{k.replace(/_/g, ' ')}:</span>
              <span className={`text-xs font-semibold ${v === 'ok' || v === true || v === 'green' ? 'text-green-600 dark:text-green-400' : 'text-soc-text dark:text-soc-darktext'}`}>
                {String(v)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
