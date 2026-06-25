import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { useAuth } from '../context/AuthContext'
import NotificationSettings from './NotificationSettings'

const Btn = ({ onClick, title, children, active }) => (
  <button onClick={onClick} title={title}
    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 border border-transparent
      ${active
        ? 'bg-[#EF843C]/10 text-[#EF843C] dark:bg-[#EF843C]/15 dark:text-[#EF843C] border-[#EF843C]/20 dark:border-[#EF843C]/20 shadow-sm'
        : 'text-soc-stext/80 dark:text-soc-darkstext/80 hover:bg-white/60 dark:hover:bg-[#2a3042]/60 hover:border-soc-border/50 dark:hover:border-soc-darkborder/50 hover:text-soc-text dark:hover:text-soc-darktext'
      }`}>
    {children}
  </button>
)

const Dropdown = ({ show, onClose, children, width = 220 }) => (
  <>
    {show && <div className="fixed inset-0 z-30" onClick={onClose} />}
    {show && (
      <div className={`absolute top-full left-0 mt-1.5 z-40 bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg shadow-xl shadow-black/5 dark:shadow-black/20`}
        style={{ width, minWidth: width }}>
        {children}
      </div>
    )}
  </>
)

function Clock() {
  const [t, setT] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
  useEffect(() => { const id = setInterval(() => setT(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000); return () => clearInterval(id) }, [])
  return <span className="text-[10px] font-mono text-soc-stext/70 dark:text-soc-darkstext/70 tabular-nums">{t}</span>
}

const Navbar = React.memo(function Navbar() {
  const { theme, setTheme, isDark, tab, doSearch, dql, setDql, filters, filterMatch, clearAllFilters, results, columns, total, addFilter, setFilterMatch } = useApp()
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark')
  const [showSave, setShowSave] = useState(false)
  const [showOpen, setShowOpen] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [savedList, setSavedList] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const { user, setShowLogin, logout, hasRole } = useAuth()

  useEffect(() => {
    if (showOpen) setSavedList(JSON.parse(localStorage.getItem('savedFilters') || '[]'))
  }, [showOpen])

  const handleNew = () => { setDql(''); clearAllFilters(); setTimeout(() => doSearch(), 0) }

  const handleSave = () => {
    if (!saveName.trim()) return
    const list = JSON.parse(localStorage.getItem('savedFilters') || '[]')
    list.push({ name: saveName.trim(), filters: JSON.parse(JSON.stringify(filters)), dql, filterMatch, date: new Date().toISOString() })
    localStorage.setItem('savedFilters', JSON.stringify(list))
    setSaveName(''); setShowSave(false)
  }

  const handleLoad = (sf) => {
    setShowOpen(false)
    if (!sf.filters?.length && !sf.dql) return
    clearAllFilters()
    setDql(sf.dql || '')
    if (sf.filterMatch) setFilterMatch(sf.filterMatch)
    ;(sf.filters || []).forEach(f => addFilter(f.field, f.value, f.negate, f.operator, f.params))
    setTimeout(() => doSearch(), 0)
  }

  const downloadCSV = () => {
    if (!results.length) return
    const headers = columns
    const rows = results.map(r => headers.map(h => {
      const v = h.split('.').reduce((o, k) => o?.[k], r)
      return v !== null && v !== undefined ? String(v).replace(/"/g, '""') : ''
    }))
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `unishield360-results-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
    setShowReport(false)
  }

  const downloadPDF = () => {
    if (!results.length) return
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const body = results.map(r => columns.map(c => {
        const v = c.split('.').reduce((o, k) => o?.[k], r)
        return v !== null && v !== undefined ? String(v) : ''
      }))
      doc.setFontSize(8)
      doc.text(`UniShield SOC - Results Report (${new Date().toLocaleString()})`, 14, 10)
      autoTable(doc, {
        head: [columns],
        body,
        startY: 16,
        styles: { fontSize: 6, cellPadding: 1.5, lineColor: [200, 200, 200], lineWidth: 0.1 },
        headStyles: { fillColor: [26, 115, 232], textColor: 255, fontSize: 7, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        margin: { top: 14 }
      })
      doc.save(`unishield360-results-${Date.now()}.pdf`)
      setShowReport(false)
    } catch (e) { console.error('PDF download failed:', e) }
  }

  const handleDeleteSaved = (idx) => {
    const list = JSON.parse(localStorage.getItem('savedFilters') || '[]')
    list.splice(idx, 1); localStorage.setItem('savedFilters', JSON.stringify(list)); setSavedList(list)
  }

  const Divider = () => <span className="w-px h-4 bg-soc-border/40 dark:bg-soc-darkborder/40 mx-1.5 shrink-0" />

  return (
    <header className="bg-[#f5f6fa] dark:bg-[#1a1f2e] rounded-none flex items-center justify-between px-4 h-11 shrink-0 border-b border-soc-border/50 dark:border-soc-darkborder/50 relative z-10">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <img src="https://unishield360.com/wp-content/uploads/2024/08/Unishield-logo-Favicon-e1723102667824.png"
            alt="UniShield" className="w-6 h-6 rounded-full ring-2 ring-[#EF843C]/40"
            style={{filter: 'drop-shadow(0 0 6px rgba(239,132,60,0.5)) drop-shadow(0 0 14px rgba(239,132,60,0.25))'}} />
          <span className="text-sm font-bold text-soc-text dark:text-[#EF843C] tracking-tight" style={{textShadow: '0 0 8px rgba(239,132,60,0.35)'}}>UniShield 360</span>
        </div>
        <a href="https://unishield360.com" target="_blank" rel="noopener noreferrer"
          className="text-[9px] font-semibold text-soc-accent bg-soc-accent/10 dark:bg-soc-accent/15 px-1.5 py-0.5 rounded uppercase tracking-wider hover:bg-soc-accent/20 transition-colors">SOC</a>
        <Divider />
        <span className="text-[11px] font-medium text-soc-stext/70 dark:text-soc-darkstext/70 capitalize">{tab}</span>
      </div>

      <div className="flex items-center gap-0.5">

        <Btn onClick={handleNew} title="Clear all filters and start a new search">
          <svg className="w-3.5 h-3.5 mr-1 inline-block -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          New
        </Btn>

        <div className="relative">
          <Btn onClick={() => { setShowSave(s => !s); setShowOpen(false) }} title="Save current search">
            <svg className="w-3.5 h-3.5 mr-1 inline-block -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>
            Save
          </Btn>
          <Dropdown show={showSave} onClose={() => setShowSave(false)}>
            <div className="p-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-soc-stext/40 dark:text-soc-darkstext/40 mb-1.5">Save Search</div>
              <input autoFocus value={saveName} onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                placeholder="Enter a name..." className="w-full px-2.5 py-1.5 text-[11px] bg-[#f1f3f4] dark:bg-[#2a3042] rounded-md outline-none text-soc-text dark:text-soc-darktext placeholder:text-soc-stext/30 dark:placeholder:text-soc-darkstext/30 border border-transparent focus:border-[#EF843C]/30 dark:focus:border-[#EF843C]/30 transition-colors" />
              <button onClick={handleSave}
                className="w-full mt-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-[#EF843C] text-white hover:bg-[#e0752a] dark:bg-[#EF843C] dark:text-white dark:hover:bg-[#e0752a] transition-all shadow-sm">
                Save
              </button>
            </div>
          </Dropdown>
        </div>

        <div className="relative">
          <Btn onClick={() => { setShowOpen(o => !o); setShowSave(false) }} title="Open a saved search">
            <svg className="w-3.5 h-3.5 mr-1 inline-block -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            Open
          </Btn>
          <Dropdown show={showOpen} onClose={() => setShowOpen(false)}>
            <div className="py-1 max-h-52 overflow-y-auto">
              <div className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-soc-stext/40 dark:text-soc-darkstext/40">Saved Searches</div>
              {savedList.length === 0 && <div className="px-3 py-3 text-[10px] text-soc-stext/40 dark:text-soc-darkstext/40 italic text-center">No saved searches</div>}
              {savedList.map((sf, i) => (
                <div key={i} className="flex items-center gap-1 px-2 py-1 mx-1.5 rounded-md hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] group cursor-pointer transition-colors"
                  onClick={() => handleLoad(sf)}>
                  <svg className="w-3 h-3 shrink-0 text-soc-stext/30 dark:text-soc-darkstext/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                  <span className="flex-1 text-[11px] text-soc-stext dark:text-soc-darkstext truncate">{sf.name}</span>
                  <span className="text-[9px] text-soc-stext/30 dark:text-soc-darkstext/30">{new Date(sf.date).toLocaleDateString()}</span>
                  <button onClick={e => { e.stopPropagation(); if (confirm('Delete this saved search?')) handleDeleteSaved(i) }}
                    className="ml-1 text-[9px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                </div>
              ))}
            </div>
          </Dropdown>
        </div>

        <Divider />

        <Btn onClick={() => setShowReport(true)} title="Download results as CSV">
          <svg className="w-3.5 h-3.5 mr-1 inline-block -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          Reporting
        </Btn>

        <Divider />

        <div className="flex items-center gap-1 pl-1">
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-soc-bg/50 dark:bg-soc-darkbg/50">
            <svg className="w-3 h-3 text-soc-stext/40 dark:text-soc-darkstext/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
            <Clock />
          </div>
          <button onClick={toggleTheme} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 rounded-md hover:bg-white/60 dark:hover:bg-[#2d3140]/60 transition-colors text-soc-stext/60 dark:text-soc-darkstext/60 hover:text-soc-text dark:hover:text-soc-darktext">
            {isDark
              ? <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            }
          </button>

          {user ? (
            <div className="flex items-center gap-1">
              {hasRole('admin') && (
                <button onClick={() => setShowNotifications(true)} title="Notification settings"
                  className="p-1.5 rounded-md hover:bg-white/60 dark:hover:bg-[#2d3140]/60 transition-colors text-soc-stext/60 dark:text-soc-darkstext/60 hover:text-soc-text dark:hover:text-soc-darktext">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                </button>
              )}
              <button onClick={logout} title="Sign out"
                className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/60 dark:hover:bg-[#2d3140]/60 transition-colors">
                <div className="w-5 h-5 rounded-full bg-[#EF843C]/10 dark:bg-[#EF843C]/10 flex items-center justify-center text-[9px] font-bold text-[#EF843C] dark:text-[#EF843C] uppercase">
                  {user.displayName?.[0] || user.username?.[0] || 'U'}
                </div>
                <span className="text-[9px] text-soc-stext/70 dark:text-soc-darkstext/70 hidden sm:inline">{user.displayName || user.username}</span>
              </button>
            </div>
          ) : (
            <button onClick={() => setShowLogin(true)} title="Sign in"
              className="p-1.5 rounded-md hover:bg-white/60 dark:hover:bg-[#2d3140]/60 transition-colors text-soc-stext/60 dark:text-soc-darkstext/60">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13 12H3"/></svg>
            </button>
          )}
        </div>
      </div>

      {showNotifications && <NotificationSettings onClose={() => setShowNotifications(false)} />}

      {showReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowReport(false)}>
          <div className="bg-white dark:bg-[#1a1d27] rounded-xl shadow-2xl border border-[#e5e7eb] dark:border-[#2d3140] p-5 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-soc-text dark:text-soc-darktext">Download Report</h3>
              <button onClick={() => setShowReport(false)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext/50 hover:text-soc-text dark:hover:text-soc-darktext transition-colors">&times;</button>
            </div>
            <button onClick={downloadCSV} disabled={!results.length}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext disabled:opacity-40 transition-colors border border-transparent hover:border-soc-border/30 dark:hover:border-soc-darkborder/30">
              <svg className="w-5 h-5 text-[#34a853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              <span className="flex-1 text-left"><span className="font-medium">CSV</span><br /><span className="text-[10px] text-soc-stext/50 dark:text-soc-darkstext/50">{results.length} rows, {columns.length} columns</span></span>
            </button>
            <button onClick={downloadPDF} disabled={!results.length}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext disabled:opacity-40 transition-colors border border-transparent hover:border-soc-border/30 dark:hover:border-soc-darkborder/30">
              <svg className="w-5 h-5 text-[#ea4335]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6M9 12h6M9 18h3"/></svg>
              <span className="flex-1 text-left"><span className="font-medium">PDF</span><br /><span className="text-[10px] text-soc-stext/50 dark:text-soc-darkstext/50">{results.length} rows, landscape A4</span></span>
            </button>
            <button onClick={() => setShowReport(false)} className="mt-2 w-full text-center text-[10px] py-2 text-soc-stext/50 dark:text-soc-darkstext/50 hover:text-soc-text dark:hover:text-soc-darktext transition-colors rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]">Cancel</button>
          </div>
        </div>
      )}

    </header>
  )
})

export default Navbar
