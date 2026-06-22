import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'

const MITRE_COLORS = {
  'Reconnaissance': '#7c3aed', 'Resource Development': '#6d28d9',
  'Initial Access': '#ef4444', 'Execution': '#f97316',
  'Persistence': '#f59e0b', 'Privilege Escalation': '#eab308',
  'Defense Evasion': '#84cc16', 'Credential Access': '#22c55e',
  'Discovery': '#14b8a6', 'Lateral Movement': '#06b6d4',
  'Collection': '#0ea5e9', 'Command and Control': '#3b82f6',
  'Exfiltration': '#6366f1', 'Impact': '#8b5cf6',
}

const TACTICS = Object.keys(MITRE_COLORS)

export default function MitreAttackTab() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTactic, setSelectedTactic] = useState(null)
  const [totalEvents, setTotalEvents] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tacticsRes, techniquesRes, countRes] = await Promise.all([
          axios.get('/api/aggregate', { params: { index: 'unishield360-alerts-4.x-*', field: 'rule.mitre.tactic', type: 'terms', limit: 20, q: '_exists_:rule.mitre.id', start_date: 'now-30d', end_date: 'now' } }),
          axios.get('/api/aggregate', { params: { index: 'unishield360-alerts-4.x-*', field: 'rule.mitre.technique', type: 'terms', limit: 50, q: '_exists_:rule.mitre.id', start_date: 'now-30d', end_date: 'now' } }),
          axios.get('/api/count', { params: { index: 'unishield360-alerts-4.x-*', q: '_exists_:rule.mitre.id', start_date: 'now-30d', end_date: 'now' } }),
        ])
        setTotalEvents(countRes.data?.count || countRes.count || 0)
        const tactics = (tacticsRes.data?.buckets || []).map(b => ({ name: b.key, count: b.doc_count || 0, color: MITRE_COLORS[b.key] || '#6b7280' }))
        const techniques = (techniquesRes.data?.buckets || []).map(b => ({ name: b.key, count: b.doc_count || 0 }))
        const merged = TACTICS.map(t => {
          const found = tactics.find(x => x.name === t)
          const techsForTactic = techniques.filter(tc => tc.name && tc.name.startsWith(t + '.'))
          return {
            name: t,
            count: found?.count || 0,
            color: MITRE_COLORS[t] || '#6b7280',
            techniques: techsForTactic.slice(0, 8),
          }
        }).filter(t => t.count > 0 || selectedTactic === t.name)
        setData(merged)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [])

  const totalMitre = data.reduce((s, t) => s + t.count, 0)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-6xl pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-0.5 pb-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] flex items-center justify-center shadow-md">
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">MITRE ATT&CK Framework</h2>
          <p className="text-[11px] text-zinc-400 font-medium">{totalEvents} events mapped · {totalMitre} tactic hits (30d)</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {data.slice(0, 7).map(t => (
          <div key={t.name} className="bg-white dark:bg-[#1a1d27] rounded-xl p-3 border border-zinc-200 dark:border-zinc-700 hover:shadow-sm transition-all">
            <div className="w-2 h-2 rounded-full mb-1.5" style={{ backgroundColor: t.color }} />
            <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100 truncate">{t.name}</div>
            <div className="text-[18px] font-bold mt-0.5" style={{ color: t.color }}>{t.count}</div>
            <div className="text-[9px] text-zinc-400">{t.techniques.length} techniques</div>
          </div>
        ))}
      </div>

      {/* Matrix Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><svg className="animate-spin w-6 h-6 text-[#7c3aed]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {data.filter(t => !selectedTactic || t.name === selectedTactic).map(tactic => (
            <div key={tactic.name} className="bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:shadow-sm transition-all">
              <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: tactic.color + '15', borderBottom: `2px solid ${tactic.color}` }}>
                <div>
                  <div className="text-[11px] font-bold" style={{ color: tactic.color }}>{tactic.name}</div>
                  <div className="text-[9px] text-zinc-500">{tactic.count} events</div>
                </div>
                <div className="text-lg font-bold" style={{ color: tactic.color }}>{tactic.count}</div>
              </div>
              <div className="p-2 space-y-1">
                {tactic.techniques.length === 0 ? (
                  <div className="text-[9px] text-zinc-400 italic px-2 py-3 text-center">No techniques detected</div>
                ) : tactic.techniques.map((tech, i) => (
                  <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tactic.color }} />
                      <span className="text-[9px] font-mono text-zinc-600 dark:text-zinc-400 truncate">{tech.name.replace(tactic.name + '.', '')}</span>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-400 shrink-0 ml-2">{tech.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
