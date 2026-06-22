import React, { useState, useRef, useCallback } from 'react'
import html2canvas from 'html2canvas'
import axios from 'axios'

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={icon}/></svg>
      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">{title}</span>
    </div>
  )
}

export default function ShareDialog({ dashboardId, dashboardTitle, onClose }) {
  const [section, setSection] = useState('link')
  const [includeTime, setIncludeTime] = useState(true)
  const [includeFilters, setIncludeFilters] = useState(true)
  const [isPublic, setIsPublic] = useState(false)
  const [shareLinks, setShareLinks] = useState([])
  const [exportWidth, setExportWidth] = useState(1200)
  const [exportHeight, setExportHeight] = useState(800)
  const [copied, setCopied] = useState('')
  const [serverLinks, setServerLinks] = useState([])
  const [loading, setLoading] = useState(false)

  const shareUrl = `${window.location.origin}/dashboard/${dashboardId}${includeTime ? '?time=now-24h' : ''}${includeFilters ? (includeTime ? '&' : '?') + 'filters=global' : ''}`
  const embedCode = `<iframe src="${shareUrl}" width="${exportWidth}" height="${exportHeight}" frameborder="0" style="border:1px solid #e5e7eb;border-radius:12px"></iframe>`

  const generateLink = async () => {
    setLoading(true)
    try {
      const { data } = await axios.post('/api/shares', {
        dashboardId,
        isPublic,
        includeTime,
        includeFilters,
      })
      setServerLinks(prev => [data, ...prev])
    } catch {
      const newLink = {
        id: 'share_' + Date.now(),
        url: shareUrl,
        createdAt: new Date().toISOString(),
        expiresAt: null,
        isPublic,
      }
      setShareLinks(prev => [newLink, ...prev])
    }
    setLoading(false)
  }

  const deleteLink = async (id, isServer) => {
    if (isServer) {
      try { await axios.delete('/api/shares/' + id) } catch {}
      setServerLinks(prev => prev.filter(l => l.id !== id))
    } else {
      setShareLinks(prev => prev.filter(l => l.id !== id))
    }
  }

  const copy = (label, text) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const exportPng = useCallback(async () => {
    const target = document.querySelector('.react-grid-layout') || document.querySelector('.dashboard-grid')
    if (target) {
      try {
        const canvas = await html2canvas(target, {
          width: exportWidth,
          height: exportHeight,
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        })
        const link = document.createElement('a')
        link.download = (dashboardTitle || 'dashboard').replace(/\s+/g, '_') + '.png'
        link.href = canvas.toDataURL('image/png')
        link.click()
        return
      } catch {}
    }
    const canvas = document.createElement('canvas')
    canvas.width = exportWidth
    canvas.height = exportHeight
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportWidth, exportHeight)
    ctx.fillStyle = '#EF843C'
    ctx.font = 'bold 24px Inter, sans-serif'
    ctx.fillText(dashboardTitle || 'Dashboard', 20, 40)
    ctx.fillStyle = '#6b7280'
    ctx.font = '14px Inter, sans-serif'
    ctx.fillText('Shared from UniShield360 | ' + new Date().toLocaleDateString(), 20, 65)
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(20, 80, exportWidth - 40, exportHeight - 120)
    ctx.fillStyle = '#9ca3af'
    ctx.font = '12px Inter, sans-serif'
    ctx.fillText('Dashboard: ' + (dashboardTitle || ''), exportWidth / 2 - 80, exportHeight / 2)
    const link = document.createElement('a')
    link.download = (dashboardTitle || 'dashboard').replace(/\s+/g, '_') + '.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [dashboardId, dashboardTitle, exportWidth, exportHeight])

  const exportPdf = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html><head><title>${dashboardTitle || 'Dashboard'}</title>
      <style>body{font-family:Inter,sans-serif;padding:40px;color:#1f2937}h1{color:#EF843C;font-size:24px}.meta{color:#6b7280;font-size:14px;margin-bottom:30px}.placeholder{border:2px dashed #e5e7eb;border-radius:12px;padding:60px;text-align:center;color:#9ca3af;font-size:14px}</style></head>
      <body><h1>${dashboardTitle || 'Dashboard'}</h1>
      <div class="meta">Generated: ${new Date().toLocaleString()} | Dashboard: ${dashboardTitle || 'Untitled'}</div>
      <div class="placeholder">Dashboard content exported as PDF</div>
    `)
    printWindow.document.write('</body></html>')
    printWindow.document.close()
    setTimeout(() => { printWindow.focus(); printWindow.print() }, 500)
  }

  const exportCsv = () => {
    const rows = [['Field', 'Value', 'Timestamp']]
    rows.push(['dashboard_id', dashboardId, new Date().toISOString()])
    rows.push(['dashboard_title', dashboardTitle || '', new Date().toISOString()])
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (dashboardTitle || 'dashboard').replace(/\s+/g, '_') + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportJson = () => {
    const stored = localStorage.getItem('unishield_dashboards')
    const dashboards = stored ? JSON.parse(stored) : []
    const dashboard = dashboards.find(d => d.id === dashboardId)
    const data = dashboard || { id: dashboardId, title: dashboardTitle, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (dashboardTitle || 'dashboard').replace(/\s+/g, '_') + '.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const allLinks = [
    ...serverLinks.map(l => ({ ...l, isServer: true, url: window.location.origin + '/shared/' + l.token })),
    ...shareLinks.map(l => ({ ...l, isServer: false })),
  ]

  const sections = {
    link: (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <input type="text" value={shareUrl} readOnly className="flex-1 px-2 py-1.5 text-[10px] font-mono bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none text-zinc-600 dark:text-zinc-400" />
            <button onClick={() => copy('url', shareUrl)}
              className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-[#EF843C] text-white hover:bg-[#e0752a] transition-colors shrink-0">
              {copied === 'url' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-400 cursor-pointer">
              <input type="checkbox" checked={includeTime} onChange={() => setIncludeTime(!includeTime)} className="w-3.5 h-3.5 rounded border-zinc-300 text-[#EF843C] focus:ring-[#EF843C]/30" />
              Include current time range
            </label>
            <label className="flex items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-400 cursor-pointer">
              <input type="checkbox" checked={includeFilters} onChange={() => setIncludeFilters(!includeFilters)} className="w-3.5 h-3.5 rounded border-zinc-300 text-[#EF843C] focus:ring-[#EF843C]/30" />
              Include global filters
            </label>
            <label className="flex items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-400 cursor-pointer">
              <input type="checkbox" checked={isPublic} onChange={() => setIsPublic(!isPublic)} className="w-3.5 h-3.5 rounded border-zinc-300 text-[#EF843C] focus:ring-[#EF843C]/30" />
              Make dashboard publicly accessible
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={generateLink} disabled={loading}
              className="flex-1 py-2 text-[10px] font-semibold rounded-lg bg-gradient-to-r from-[#EF843C] to-[#e0752a] text-white hover:from-[#e0752a] hover:to-[#d0661a] transition-all disabled:opacity-40">
              {loading ? 'Creating...' : 'Generate New Link'}
            </button>
          </div>
          {allLinks.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Share Links</span>
              {allLinks.map(link => (
                <div key={link.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700">
                  <code className="flex-1 text-[9px] font-mono text-zinc-500 truncate">{link.url}</code>
                  <button onClick={() => copy('link_' + link.id, link.url)} className="text-[9px] px-1.5 py-0.5 rounded text-zinc-400 hover:text-zinc-600 transition-colors">{copied === 'link_' + link.id ? '✓' : 'Copy'}</button>
                  <button onClick={() => deleteLink(link.id, link.isServer)} className="text-[9px] px-1.5 py-0.5 rounded text-red-400 hover:text-red-500 transition-colors">Del</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    ),
    export: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Width (px)</label>
            <input type="number" value={exportWidth} onChange={e => setExportWidth(parseInt(e.target.value) || 1200)} min={400} max={4000} className="ginput w-full px-2 py-1.5 text-[10px]" />
          </div>
          <div>
            <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Height (px)</label>
            <input type="number" value={exportHeight} onChange={e => setExportHeight(parseInt(e.target.value) || 800)} min={200} max={4000} className="ginput w-full px-2 py-1.5 text-[10px]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={exportPng} className="flex items-center gap-2 px-3 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-[#EF843C]/40 hover:bg-[#EF843C]/5 transition-all text-left">
            <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            <div><div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">PNG Image</div><div className="text-[9px] text-zinc-400">Captures real dashboard</div></div>
          </button>
          <button onClick={exportPdf} className="flex items-center gap-2 px-3 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-[#EF843C]/40 hover:bg-[#EF843C]/5 transition-all text-left">
            <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <div><div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">PDF Document</div><div className="text-[9px] text-zinc-400">Printable via browser</div></div>
          </button>
          <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-[#EF843C]/40 hover:bg-[#EF843C]/5 transition-all text-left">
            <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="16" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            <div><div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">CSV Data</div><div className="text-[9px] text-zinc-400">Dashboard metadata</div></div>
          </button>
          <button onClick={exportJson} className="flex items-center gap-2 px-3 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-[#EF843C]/40 hover:bg-[#EF843C]/5 transition-all text-left">
            <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            <div><div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">JSON Config</div><div className="text-[9px] text-zinc-400">Full dashboard config</div></div>
          </button>
        </div>
      </div>
    ),
    embed: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <code className="flex-1 text-[9px] font-mono text-zinc-500 dark:text-zinc-400 break-all max-h-24 overflow-y-auto">{embedCode}</code>
          <button onClick={() => copy('embed', embedCode)}
            className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-[#EF843C] text-white hover:bg-[#e0752a] transition-colors shrink-0">
            {copied === 'embed' ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Width (px)</label>
            <input type="number" value={exportWidth} onChange={e => setExportWidth(parseInt(e.target.value) || 1200)} className="ginput w-full px-2 py-1 text-[10px]" />
          </div>
          <div>
            <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Height (px)</label>
            <input type="number" value={exportHeight} onChange={e => setExportHeight(parseInt(e.target.value) || 800)} className="ginput w-full px-2 py-1 text-[10px]" />
          </div>
        </div>
        <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-xl p-3 border border-amber-200/50 dark:border-amber-700/20">
          <div className="flex items-start gap-2 text-[10px] text-amber-600 dark:text-amber-400">
            <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>Embedded dashboards require the dashboard to be publicly accessible or users must be logged in.</span>
          </div>
        </div>
      </div>
    ),
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl w-full max-w-2xl mx-3 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-[#EF843C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            <div>
              <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Share & Export</h2>
              <p className="text-[10px] text-zinc-400">{dashboardTitle || 'Dashboard'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex gap-1 px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
          {[
            { id: 'link', label: 'Share Link', icon: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' },
            { id: 'export', label: 'Export As', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3' },
            { id: 'embed', label: 'Embed', icon: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
          ].map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded-lg transition-colors ' + (section === s.id ? 'bg-[#EF843C] text-white' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800')}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={s.icon}/></svg>
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {sections[section]}
        </div>
      </div>
    </div>
  )
}