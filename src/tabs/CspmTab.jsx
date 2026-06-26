import React from 'react'
import { useApp } from '../context/AppContext'

const VIEWS = {
  cspm: { title: 'Cloud Posture Management', icon: 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z' },
  docker: { title: 'Docker Security', icon: 'M4 17l6-6-6-6m8 14h8' },
  aws: { title: 'AWS Security', icon: 'M12 2a9 3 0 000 6 9 3 0 000-6zm0 0v18m9-15v12M3 5v12m0-6h18' },
  gcp: { title: 'GCP Security', icon: 'M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z' },
  github: { title: 'GitHub Security', icon: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22' },
  office365: { title: 'Office 365 Security', icon: 'M6.5 2h11l3 8-8.5 12L3 10l3.5-8z' },
}

export default function CspmTab() {
  const { tab, setTab } = useApp()
  const view = VIEWS[tab] || VIEWS.cspm

  const SUB_VIEWS = [
    { key: 'docker', label: 'Docker', desc: 'Container security, image scanning, runtime protection' },
    { key: 'aws', label: 'AWS', desc: 'IAM, S3, EC2, RDS security posture assessments' },
    { key: 'gcp', label: 'GCP', desc: 'Cloud IAM, GKE, Cloud Storage security audits' },
    { key: 'github', label: 'GitHub', desc: 'Repo scanning, secret detection, Dependabot alerts' },
    { key: 'office365', label: 'Office 365', desc: 'Exchange, SharePoint, Teams security compliance' },
  ]

  if (tab !== 'cspm') {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-[#EF843C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={view.icon} />
          </svg>
          <h1 className="text-base font-bold text-soc-text dark:text-soc-darktext">{view.title}</h1>
        </div>
        <div className="gcard p-6 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-soc-stext/30 dark:text-soc-darkstext/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d={view.icon} />
          </svg>
          <p className="text-sm text-soc-stext/60 dark:text-soc-darkstext/60">{view.title} dashboard coming soon</p>
          <p className="text-xs text-soc-stext/40 dark:text-soc-darkstext/40 mt-1">Real-time security posture data will appear here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-5 h-5 text-[#EF843C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d={view.icon} />
        </svg>
        <h1 className="text-base font-bold text-soc-text dark:text-soc-darktext">Cloud Posture Management</h1>
      </div>
      <p className="text-xs text-soc-stext/60 dark:text-soc-darkstext/60 mb-4">Assess and monitor your cloud environments for misconfigurations, compliance violations, and security risks.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SUB_VIEWS.map(sv => (
          <div key={sv.key} className="gcard p-4 cursor-pointer"
            onClick={() => setTab(sv.key)}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg bg-[#EF843C]/10 dark:bg-[#EF843C]/15 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#EF843C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={VIEWS[sv.key].icon} />
                </svg>
              </span>
              <span className="text-xs font-bold text-soc-text dark:text-soc-darktext">{sv.label}</span>
            </div>
            <p className="text-[10px] text-soc-stext/60 dark:text-soc-darkstext/60">{sv.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
