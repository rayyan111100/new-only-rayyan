import React, { useMemo } from 'react'
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import useCompliance from '../../../hooks/useCompliance'
import FilterableMetricCard from '../../FilterableMetricCard'

const FRAMEWORK_META = {
  'PCI-DSS': { field: 'rule.pci_dss', accent: '#e8681a', label: 'PCI-DSS', reqs: [{ req: '11.5', desc: 'Integrity Controls' }, { req: '6.4.2', desc: 'Web App Firewall' }, { req: '10.5.5', desc: 'Log Integrity' }, { req: '8.2.3', desc: 'Password Complexity' }, { req: '3.4.1', desc: 'Key Rotation' }] },
  'HIPAA': { field: 'rule.hipaa', accent: '#3fb950', label: 'HIPAA', reqs: [{ req: '164.312', desc: 'Access Control' }, { req: '164.308', desc: 'Security Management' }, { req: '164.310', desc: 'Physical Safeguards' }, { req: '164.312.e', desc: 'Integrity Controls' }, { req: '164.312.d', desc: 'Person/Entity Auth' }] },
  'GDPR': { field: 'rule.gdpr', accent: '#a371f7', label: 'GDPR', reqs: [{ req: 'Art.5', desc: 'Processing Principles' }, { req: 'Art.6', desc: 'Lawful Processing' }, { req: 'Art.7', desc: 'Consent' }, { req: 'Art.17', desc: 'Right to Erasure' }, { req: 'Art.33', desc: 'Breach Notification' }] },
  'TSC (SOC 2)': { field: 'rule.tsc', accent: '#58a6ff', label: 'TSC', reqs: [{ req: 'CC6.1', desc: 'Logical Access' }, { req: 'CC7.1', desc: 'Monitoring' }, { req: 'CC6.6', desc: 'Change Management' }, { req: 'CC2.1', desc: 'Communication' }, { req: 'CC3.1', desc: 'Risk Assessment' }] },
  'NIST 800-53': { field: 'rule.nist_800_53', accent: '#f97316', label: 'NIST', reqs: [{ req: 'AC-2', desc: 'Account Management' }, { req: 'AU-3', desc: 'Audit Records' }, { req: 'SC-7', desc: 'Boundary Protection' }, { req: 'SI-4', desc: 'Monitoring' }, { req: 'CM-2', desc: 'Baseline Config' }] },
}

const SEV_COLORS = { Critical: '#f85149', High: '#e8681a', Medium: '#d29922', Low: '#3fb950' }
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low']

export default function ComplianceMetricPanel({ panel }) {
  const framework = panel.vizConfig?.framework || 'PCI-DSS'
  const meta = FRAMEWORK_META[framework] || FRAMEWORK_META['PCI-DSS']
  const { data, loading, error, refresh } = useCompliance(framework)
  const isDark = document.documentElement.classList.contains('dark')

  const severitySource = data?.severity || {}
  const totalEvents = data?.count24 || 0
  const controlMap = {}
  for (const c of (data?.topControls || [])) {
    const id = c.control || c.key || ''
    controlMap[id] = (controlMap[id] || 0) + (c.count || c.doc_count || 0)
  }
  const controlsViolated = meta.reqs.filter(r => (controlMap[r.req] || 0) > 0).length
  const topControl = meta.reqs.map(r => ({ ...r, count: controlMap[r.req] || 0 })).sort((a, b) => b.count - a.count)[0]

  const cards = [
    { key: 'm-events', label: `${meta.label} Events`, val: totalEvents.toLocaleString(), icon: 'certificate', iconBg: `${meta.accent}1a`, iconColor: meta.accent },
    { key: 'm-crit', label: 'Critical Violations', val: (severitySource?.Critical || 0).toLocaleString(), icon: 'alert-triangle', iconBg: '#e0525218', iconColor: '#ff6b6b', valColor: '#ff6b6b' },
    { key: 'm-high', label: 'High Severity', val: (severitySource?.High || 0).toLocaleString(), icon: 'alert-circle', iconBg: '#e8893a18', iconColor: '#e8893a', valColor: '#e8893a' },
    { key: 'm-assets', label: 'Active Agents', val: data?.topAgents?.length || 0, sub: 'Active agents', icon: 'device-desktop', iconBg: '#58a6ff1a', iconColor: '#58a6ff' },
    { key: 'm-controls', label: 'Controls Triggered', val: controlsViolated, sub: `Unique ${meta.label} requirements`, icon: 'list-check', iconBg: '#3fb95018', iconColor: '#3fb950' },
    { key: 'm-top-ctrl', label: 'Top Control', val: topControl?.count > 0 ? topControl.req : '--', sub: topControl?.count > 0 ? `${topControl.desc} · ${topControl.count} Events` : '', icon: 'award', iconBg: `${meta.accent}1a`, iconColor: meta.accent, valColor: meta.accent, valSize: 'text-base' },
  ]

  if (loading) return (
    <div className="p-3">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="bg-[#f0f2f4] dark:bg-[#2d3140] rounded-xl p-2.5 animate-pulse">
            <div className="h-3 w-16 bg-[#d0d7de] dark:bg-[#30363d] rounded mb-2" />
            <div className="h-6 w-12 bg-[#d0d7de] dark:bg-[#30363d] rounded" />
          </div>
        ))}
      </div>
    </div>
  )
  if (error) return <div className="flex items-center justify-center h-full text-[10px] text-red-400">Error: {error}</div>
  if (!data) return <div className="flex items-center justify-center h-full text-[10px] text-zinc-400">No {meta.label} data</div>

  return (
    <div className="p-2">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {cards.map(card => (
          <FilterableMetricCard
            key={card.key}
            card={card}
            isDark={isDark}
            filterField={card.filterField}
            filterValue={card.filterValue}
          />
        ))}
      </div>
    </div>
  )
}
