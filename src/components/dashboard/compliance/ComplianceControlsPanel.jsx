import React, { useMemo } from 'react'
import useCompliance from '../../../hooks/useCompliance'

const FRAMEWORK_META = {
  'PCI-DSS': { accent: '#e8681a', reqs: [{ req: '11.5', desc: 'Integrity Controls' }, { req: '6.4.2', desc: 'Web App Firewall' }, { req: '10.5.5', desc: 'Log Integrity' }, { req: '8.2.3', desc: 'Password Complexity' }, { req: '3.4.1', desc: 'Key Rotation' }] },
  'HIPAA': { accent: '#3fb950', reqs: [{ req: '164.312', desc: 'Access Control' }, { req: '164.308', desc: 'Security Management' }, { req: '164.310', desc: 'Physical Safeguards' }, { req: '164.312.e', desc: 'Integrity Controls' }, { req: '164.312.d', desc: 'Person/Entity Auth' }] },
  'GDPR': { accent: '#a371f7', reqs: [{ req: 'Art.5', desc: 'Processing Principles' }, { req: 'Art.6', desc: 'Lawful Processing' }, { req: 'Art.7', desc: 'Consent' }, { req: 'Art.17', desc: 'Right to Erasure' }, { req: 'Art.33', desc: 'Breach Notification' }] },
  'TSC (SOC 2)': { accent: '#58a6ff', reqs: [{ req: 'CC6.1', desc: 'Logical Access' }, { req: 'CC7.1', desc: 'Monitoring' }, { req: 'CC6.6', desc: 'Change Management' }, { req: 'CC2.1', desc: 'Communication' }, { req: 'CC3.1', desc: 'Risk Assessment' }] },
  'NIST 800-53': { accent: '#f97316', reqs: [{ req: 'AC-2', desc: 'Account Management' }, { req: 'AU-3', desc: 'Audit Records' }, { req: 'SC-7', desc: 'Boundary Protection' }, { req: 'SI-4', desc: 'Monitoring' }, { req: 'CM-2', desc: 'Baseline Config' }] },
}

export default function ComplianceControlsPanel({ panel }) {
  const framework = panel.vizConfig?.framework || 'PCI-DSS'
  const meta = FRAMEWORK_META[framework] || FRAMEWORK_META['PCI-DSS']
  const { data, loading, error } = useCompliance(framework)

  const topControls = useMemo(() => {
    return (data?.topControls || []).slice(0, panel.vizConfig?.maxControls || 8)
  }, [data, panel.vizConfig?.maxControls])

  if (loading) return (
    <div className="bg-white dark:bg-[#16181f] rounded-xl p-3 h-full flex flex-col">
      <div className="h-3 w-36 bg-[#d0d7de] dark:bg-[#30363d] rounded mb-3 animate-pulse" />
      <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-4 bg-[#d0d7de] dark:bg-[#30363d] rounded animate-pulse" />)}</div>
    </div>
  )
  if (error) return <div className="flex items-center justify-center h-full text-[10px] text-red-400">{error}</div>
  if (!data) return null

  const maxCount = Math.max(...topControls.map(c => c.count || c.doc_count || 0), 1)

  return (
    <div className="bg-white dark:bg-[#16181f] rounded-xl p-3 h-full flex flex-col">
      <div className="text-[11px] font-bold text-[#1f2328] dark:text-[#f0f6fc] uppercase tracking-wide mb-2.5" style={{ color: meta.accent }}>Top Control Requirements</div>
      <div className="flex-1 space-y-1.5">
        {topControls.map((c, i) => {
          const count = c.count || c.doc_count || 0
          const pct = (count / maxCount) * 100
          return (
            <div key={c.control || c.key || i} className="flex items-center gap-2 py-0.5 px-1 rounded text-[11px]">
              <span className="w-[95px] text-[#36454f] dark:text-[#c9d1d9] font-medium truncate shrink-0">{c.control || c.key}</span>
              <div className="flex-1 h-2 bg-[#d0d7de] dark:bg-[#30363d] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg,${meta.accent},${meta.accent}cc)` }} />
              </div>
              <span className="w-7 text-right text-[#1f2328] dark:text-[#f0f6fc] font-bold">{count}</span>
            </div>
          )
        })}
        {topControls.length === 0 && <div className="text-center py-4 text-[10px] text-zinc-400">No control data</div>}
      </div>
      <div className="flex justify-between text-[9px] text-[#8b949e] mt-1">
        <span>0</span><span>{Math.round(maxCount / 2)}</span><span>{maxCount}</span>
      </div>
    </div>
  )
}
