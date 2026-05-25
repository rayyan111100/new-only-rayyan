import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ScanTab() {
  const [target, setTarget] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const run = async () => {
    if (!target.trim()) return
    setLoading(true)
    try {
      const { apiPost } = await import('../api')
      const d = await apiPost('scan', { target: target.trim() })
      setResults(d)
    } catch (e) { setResults({ error: e.message }) }
    finally { setLoading(false) }
  }
  return (
    <div className="space-y-4">
      <div className="gcard p-4">
        <div className="text-sm font-semibold text-soc-text dark:text-soc-darktext mb-3">Security Scan</div>
        <div className="flex gap-2">
          <input type="text" value={target} onChange={e => setTarget(e.target.value)} placeholder="IP / Hostname / URL" className="ginput flex-1 px-3 py-1.5 text-xs" onKeyDown={e => e.key === 'Enter' && run()} />
          <button onClick={run} disabled={loading} className="gbtn-primary px-4 py-1.5 text-xs font-semibold rounded">{loading ? '\u23F3' : '\uD83D\uDD0D'} Scan</button>
        </div>
      </div>
      {results && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="gcard p-4">
          <pre className="text-xs text-soc-text dark:text-soc-darktext overflow-auto max-h-96">{JSON.stringify(results, null, 2)}</pre>
        </motion.div>
      )}
    </div>
  )
}
