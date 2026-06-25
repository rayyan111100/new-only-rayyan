import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { getAllTemplates } from '../services/ruleTemplates'
import { createRule, updateRule } from '../services/ruleStorage'
import { applyTemplate } from '../services/ruleTemplates'

const OPERATORS = [
  { name: 'equals', desc: 'Exact match (string)', example: 'data.action equals "block"' },
  { name: 'contains', desc: 'Case-insensitive substring', example: 'rule.description contains "failed"' },
  { name: 'regex', desc: 'Regular expression match', example: 'data.url regex ".*\\.(exe|dll)$"' },
  { name: 'startsWith', desc: 'Prefix match', example: 'data.url startsWith "/admin"' },
  { name: 'endsWith', desc: 'Suffix match', example: 'full_log endsWith ".exe"' },
  { name: 'gt', desc: 'Greater than (numeric)', example: 'rule.level gt 10' },
  { name: 'gte', desc: 'Greater than or equal', example: 'rule.level gte 12' },
  { name: 'lt', desc: 'Less than (numeric)', example: 'rule.level lt 5' },
  { name: 'lte', desc: 'Less than or equal', example: 'rule.level lte 7' },
  { name: 'inList', desc: 'Value in comma-separated list', example: 'eventID inList "4624,4625,4626"' },
  { name: 'exists', desc: 'Field exists (not null)', example: 'syscheck.sha1_after exists' }
]

const CATEGORY_DETAILS = {
  'Windows Security': {
    color: '#EF843C',
    fields: ['data.win.system.eventID', 'data.win.eventdata.logonType', 'data.win.eventdata.ipAddress', 'data.win.eventdata.processName'],
    desc: 'Monitor Windows Event Log security events. Key Event IDs: 4624(Logon), 4625(Failed), 4688(Process), 4720(User), 7045(Service), 1102(Log Cleared)'
  },
  'Firewall & Network': {
    color: '#f59e0b',
    fields: ['data.action', 'data.srcip', 'data.dstip', 'data.srcport', 'data.dstport', 'data.protocol', 'decoded.src_ip', 'decoded.dst_ip'],
    desc: 'Monitor firewall logs, network traffic, and connection events. Supports pfSense, iptables, netfilter formats.'
  },
  'Linux Security': {
    color: '#10b981',
    fields: ['decoded.format', 'decoded.user', 'decoded.src_ip', 'data.audit.command', 'data.audit.user'],
    desc: 'Monitor Linux auditd and SSH logs. Detects sudo usage, user changes, SSH attacks, file permission changes.'
  },
  'File Integrity (FIM)': {
    color: '#8b5cf6',
    fields: ['syscheck.event', 'syscheck.path', 'syscheck.sha1_after', 'syscheck.sha1_before'],
    desc: 'File Integrity Monitoring. Detects file additions, modifications, deletions. Critical for compliance (PCI DSS, HIPAA).'
  },
  'Authentication': {
    color: '#ef4444',
    fields: ['decoded.format', 'decoded.user', 'decoded.src_ip', 'data.action', 'data.status'],
    desc: 'Monitor authentication events across SSH, VPN, API, and Windows logon. Use frequency thresholds for brute force detection.'
  },
  'Web Security': {
    color: '#06b6d4',
    fields: ['data.url', 'decoded.status', 'decoded.method', 'decoded.src_ip', 'data.method'],
    desc: 'Web application security. Detects SQL injection, XSS, path traversal, and scanning activity via status code analysis.'
  },
  'General / Compliance': {
    color: '#6b7280',
    fields: ['rule.level', 'rule.groups', 'rule.description'],
    desc: 'Catch-all rules for alert severity, compliance frameworks (PCI DSS, GDPR), malware detection, and policy violations.'
  }
}

function Section({ title, color, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-soc-border/50 dark:border-soc-darkborder/50 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 bg-[#f8f9fa] dark:bg-[#252832] text-xs font-semibold text-soc-text dark:text-soc-darktext hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042] transition-colors">
        <span className="flex-1 text-left">{title}</span>
        <svg className={`w-3 h-3 text-soc-stext/40 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && <div className="p-3.5 text-[11px] text-soc-stext dark:text-soc-darkstext space-y-3">{children}</div>}
    </div>
  )
}

function EventCard({ title, fields, severity, example, note }) {
  return (
    <div className="bg-[#f8f9fa] dark:bg-[#252832] rounded-lg p-3 border border-soc-border/30 dark:border-soc-darkborder/30">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-soc-text dark:text-soc-darktext">{title}</span>
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
          severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
          severity === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
          severity === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        }`}>{severity}</span>
      </div>
      <div className="space-y-0.5 text-[10px] text-soc-stext/80 dark:text-soc-darkstext/80">
        {fields.map((f, i) => <div key={i} className="font-mono">{f}</div>)}
      </div>
      {example && <div className="mt-1.5 text-[9px] text-soc-stext/40 dark:text-soc-darkstext/40 italic bg-white dark:bg-[#1a1d27] px-2 py-1 rounded">{example}</div>}
      {note && <div className="mt-1 text-[9px] text-amber-600 dark:text-amber-400">{note}</div>}
    </div>
  )
}

export default function RuleGuideTab() {
  const { isDark, setTab, setPendingRuleId } = useApp()
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState(null)
  const [copiedField, setCopiedField] = useState('')

  const copyField = (f) => {
    navigator.clipboard.writeText(f)
    setCopiedField(f)
    setTimeout(() => setCopiedField(''), 1500)
  }

  const useTemplate = (tpl) => {
    const rule = createRule({ name: tpl.name })
    const patched = applyTemplate(rule, tpl)
    updateRule(rule.id, patched)
    setPendingRuleId(rule.id)
    setTab('rules')
  }
  const temps = getAllTemplates()

  const filtered = temps.filter(t => {
    if (activeCat && t.category !== activeCat) return false
    if (search) {
      const q = search.toLowerCase()
      return t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
    }
    return true
  })

  const categories = Object.keys(CATEGORY_DETAILS)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} className="space-y-3 max-w-4xl">
      <div className="flex items-center gap-2 px-0.5">
        <h2 className="text-sm font-bold text-soc-text dark:text-soc-darktext">Rule Writing Guide</h2>
      </div>

      {/* Quick reference */}
      <Section title="How Rules Work" color="#6b7280">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-[#f8f9fa] dark:bg-[#252832] rounded-lg p-3">
            <div className="text-[10px] font-semibold mb-1">Rule = Conditions + Actions</div>
            <div className="text-[10px] text-soc-stext/70 dark:text-soc-darkstext/70 space-y-1">
              <div><b>Conditions</b> are AND/OR groups of field checks</div>
              <div><b>Actions</b> define severity, level, and alert message</div>
              <div><b>Frequency</b> triggers if N matches in time window</div>
              <div><b>Suppression</b> ignores after N matches per source</div>
            </div>
          </div>
          <div className="bg-[#f8f9fa] dark:bg-[#252832] rounded-lg p-3">
            <div className="text-[10px] font-semibold mb-1">Severity Levels</div>
            <div className="space-y-1 text-[10px]">
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /> <b>Critical</b> (level 12-15)</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500" /> <b>High</b> (level 8-11)</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500" /> <b>Medium</b> (level 5-7)</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" /> <b>Low</b> (level 0-4)</div>
            </div>
          </div>
        </div>
      </Section>

      {/* Operators */}
      <Section title="Operators Reference" color="#8b5cf6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {OPERATORS.map(op => (
            <div key={op.name} className="flex items-start gap-2 px-2 py-1.5 rounded bg-[#f8f9fa] dark:bg-[#252832]">
              <code className="text-[10px] font-bold text-[#EF843C] dark:text-[#EF843C] whitespace-nowrap shrink-0">{op.name}</code>
              <div className="text-[10px]">
                <div className="text-soc-stext/70 dark:text-soc-darkstext/70">{op.desc}</div>
                <div className="text-soc-stext/40 dark:text-soc-darkstext/40 font-mono text-[9px]">{op.example}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Category navigation tabs */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setActiveCat(null)}
          className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${!activeCat ? 'bg-[#EF843C] text-white dark:bg-[#EF843C] dark:text-white' : 'bg-[#f1f3f4] dark:bg-[#2a3042] text-soc-stext dark:text-soc-darkstext hover:bg-white dark:hover:bg-[#3d4152]'}`}>
          All
        </button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCat(activeCat === cat ? null : cat)}
            className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${activeCat === cat ? 'bg-[#EF843C] text-white dark:bg-[#EF843C] dark:text-white' : 'bg-[#f1f3f4] dark:bg-[#2a3042] text-soc-stext dark:text-soc-darkstext hover:bg-white dark:hover:bg-[#3d4152]'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search rules, fields, or categories..."
        className="w-full px-3 py-2 text-xs bg-[#f3f4f6] dark:bg-[#2d3140] rounded-lg outline-none text-soc-text dark:text-soc-darktext border border-transparent focus:border-[#EF843C]/30 dark:focus:border-[#EF843C]/30 transition-colors" />

      {/* Category Details */}
      {activeCat && CATEGORY_DETAILS[activeCat] && (
        <div className="bg-[#f8f9fa] dark:bg-[#252832] rounded-lg p-3 text-[11px]">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-semibold text-soc-text dark:text-soc-darktext">{activeCat}</span>
          </div>
          <p className="text-soc-stext/70 dark:text-soc-darkstext/70 mb-2">{CATEGORY_DETAILS[activeCat].desc}</p>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-soc-stext/40 dark:text-soc-darkstext/40 mb-1">Common Fields</div>
          <div className="flex flex-wrap gap-1">
            {CATEGORY_DETAILS[activeCat].fields.map(f => (
              <code key={f}
                onClick={() => copyField(f)}
                className="text-[9px] px-1.5 py-0.5 bg-white dark:bg-[#1a1d27] rounded text-[#EF843C] dark:text-[#EF843C] cursor-pointer hover:bg-[#EF843C]/10 dark:hover:bg-[#EF843C]/10 transition-colors"
                title={copiedField === f ? 'Copied!' : 'Click to copy'}>
                {f}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Rule templates */}
      <div className="text-[10px] font-semibold text-soc-stext/50 dark:text-soc-darkstext/50 uppercase tracking-wider">
        {filtered.length} Rule{filtered.length !== 1 ? 's' : ''} Available
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {filtered.map(t => {
          const catDetail = CATEGORY_DETAILS[t.category]
          const sev = t.actions?.[0]?.params?.severity || 'medium'
          const sevColor = sev === 'critical' ? 'bg-red-500' : sev === 'high' ? 'bg-orange-500' : sev === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
          return (
            <div key={t.id} className="bg-white dark:bg-[#1a1d27] border border-soc-border/50 dark:border-soc-darkborder/50 rounded-lg overflow-hidden hover:shadow-md hover:scale-[1.01] transition-all duration-200">
              {/* Severity color bar */}
              <div className={`h-1 ${sevColor}`} />
              <div className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catDetail?.color || '#6b7280' }}></span>
                  <span className="text-xs font-semibold text-soc-text dark:text-soc-darktext">{t.name}</span>
                  <span className={`ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded ${
                    sev === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                    sev === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                    sev === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>{sev}</span>
                </div>
                <div className="text-[10px] text-soc-stext/60 dark:text-soc-darkstext/60 mb-2">{t.desc}</div>
                <div className="space-y-0.5 mb-2">
                  {t.conditions.slice(0, 3).map((c, i) => (
                    <div key={i} className="flex items-center gap-1 text-[9px] font-mono text-soc-stext/70 dark:text-soc-darkstext/70">
                      <span className="text-[#EF843C] dark:text-[#EF843C]">{c.field}</span>
                      <span className="text-soc-stext/40">{c.operator}</span>
                      <span className="truncate max-w-[120px] text-soc-text dark:text-soc-darktext">{c.value}</span>
                    </div>
                  ))}
                  {t.conditions.length > 3 && <div className="text-[9px] text-soc-stext/40">... +{t.conditions.length - 3} more</div>}
                </div>
                {t.frequency > 0 && (
                  <div className="mb-2 text-[9px] text-amber-600 dark:text-amber-400">
                    {t.frequency}x in {t.timeframe}{t.timeframeUnit}
                  </div>
                )}
                  <button onClick={() => useTemplate(t)}
                  className="w-full mt-1 px-2 py-1 text-[9px] font-medium rounded-md bg-[#EF843C] text-white hover:bg-[#e0752a] dark:bg-[#EF843C] dark:hover:bg-[#e0752a] transition-all text-center">
                  + Use Template
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
