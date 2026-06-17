import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { formatPretty } from '../utils'

const COMMON = [
  { label: 'Today', start: 'now/d', end: 'now' },
  { label: 'This week', start: 'now/w', end: 'now' },
  { label: 'Last 15 min', start: 'now-15m', end: 'now' },
  { label: 'Last 30 min', start: 'now-30m', end: 'now' },
  { label: 'Last 1 hour', start: 'now-1h', end: 'now' },
  { label: 'Last 24 hours', start: 'now-24h', end: 'now' },
  { label: 'Last 7 days', start: 'now-7d', end: 'now' },
  { label: 'Last 30 days', start: 'now-30d', end: 'now' },
  { label: 'Last 90 days', start: 'now-90d', end: 'now' },
  { label: 'Last 1 year', start: 'now-1y', end: 'now' }
]

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']
const UNITS = ['s','m','h','d','w','M','y']
const UNAMES = { s:'sec', m:'min', h:'hr', d:'day', w:'wk', M:'mo', y:'yr' }

function getCal(year, month) {
  const first = new Date(year, month, 1).getDay()
  const dim = new Date(year, month + 1, 0).getDate()
  const dip = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = first - 1; i >= 0; i--) {
    const d = dip - i, pm = month === 0 ? 11 : month - 1, py = month === 0 ? year - 1 : year
    cells.push({ day: d, month: pm, year: py, other: true })
  }
  for (let d = 1; d <= dim; d++) cells.push({ day: d, month, year, other: false })
  for (let d = 1; cells.length < 42; d++) {
    const nm = month === 11 ? 0 : month + 1, ny = month === 11 ? year + 1 : year
    cells.push({ day: d, month: nm, year: ny, other: true })
  }
  return cells
}

function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }

export default function DateRangePicker({ startDate: propStart, onStartChange, endDate: propEnd, onEndChange, onSearch: propSearch } = {}) {
  const ctx = useApp()
  const isDark = ctx.isDark
  const startDate = propStart !== undefined ? propStart : ctx.startDate
  const endDate = propEnd !== undefined ? propEnd : ctx.endDate
  const setStartDate = onStartChange || ctx.setStartDate
  const setEndDate = onEndChange || ctx.setEndDate
  const doSearch = propSearch || ctx.doSearch
  const wrap = useRef(null)
  const timeRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('relative')
  const [relNum, setRelNum] = useState(24)
  const [relUnit, setRelUnit] = useState('h')
  const [activeEdge, setActiveEdge] = useState('start')
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [absSd, setAbsSd] = useState(new Date(Date.now() - 864e5))
  const [absEd, setAbsEd] = useState(new Date())
  const [absSt, setAbsSt] = useState('00:00')
  const [absEt, setAbsEt] = useState('00:00')

  useEffect(() => {
    if (!open) return
    const p = s => { if (!s || s === 'now') return new Date(); const d = new Date(s); return isNaN(d) ? new Date() : d }
    const sd = p(startDate), ed = p(endDate)
    setAbsSd(sd); setAbsEd(ed)
    setAbsSt(String(sd.getHours()).padStart(2,'0') + ':' + String(Math.floor(sd.getMinutes()/30)*30).padStart(2,'0'))
    setAbsEt(String(ed.getHours()).padStart(2,'0') + ':' + String(Math.floor(ed.getMinutes()/30)*30).padStart(2,'0'))
    setCalYear(sd.getFullYear()); setCalMonth(sd.getMonth())
  }, [open])

  useEffect(() => {
    if (!open) return
    const target = activeEdge === 'start' ? absSd : absEd
    if (target.getMonth() !== calMonth || target.getFullYear() !== calYear) {
      setCalYear(target.getFullYear()); setCalMonth(target.getMonth())
    }
  }, [open, activeEdge])

  useEffect(() => {
    function h(e) { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    if (open) { document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }
  }, [open])

  useEffect(() => {
    if (open && timeRef.current) {
      const sel = timeRef.current.querySelector('[data-sel="1"]')
      if (sel) sel.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [open, activeEdge, absSt, absEt])

  const label = formatPretty(startDate, endDate)
  const bg = isDark ? 'bg-soc-darkpanel border-soc-darkborder text-soc-darktext' : 'bg-white border-soc-border text-soc-text'
  const txt = isDark ? 'text-soc-darkstext' : 'text-soc-stext'
  const btn = isDark ? 'border-soc-darkborder text-soc-darkstext hover:bg-soc-darkborder/50' : 'border-soc-border text-soc-stext hover:bg-soc-bg'
  const tabCls = 'px-3 py-1.5 text-xs font-medium border-b-2 cursor-pointer transition-colors ' + (isDark ? 'text-soc-darkstext border-transparent hover:text-soc-darktext' : 'text-soc-stext border-transparent hover:text-soc-text')
  const tabAct = 'px-3 py-1.5 text-xs font-medium border-b-2 cursor-pointer transition-colors ' + (isDark ? 'text-[#EF843C] border-[#EF843C]' : 'text-[#EF843C] border-[#EF843C]')

  const cells = getCal(calYear, calMonth)
  const today = new Date()
  const selDate = activeEdge === 'start' ? absSd : absEd
  const selTime = activeEdge === 'start' ? absSt : absEt
  const setSelDate = d => { if (activeEdge === 'start') setAbsSd(d); else setAbsEd(d) }
  const setSelTime = t => { if (activeEdge === 'start') setAbsSt(t); else setAbsEt(t) }
  const timeSlots = []; for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 30) timeSlots.push(String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'))
  const nowTime = String(today.getHours()).padStart(2,'0')+':'+String(today.getMinutes()).padStart(2,'0')

  const apply = v => { setStartDate(v.start); setEndDate(v.end); setOpen(false); doSearch() }
  const applyRel = () => { setStartDate('now-' + relNum + relUnit); setEndDate('now'); setOpen(false); doSearch() }
  const applyNow = () => { setStartDate('now'); setEndDate('now'); setOpen(false); doSearch() }
  const applyAbs = () => {
    let sd = new Date(absSd), ed = new Date(absEd)
    const [sh, sm] = absSt.split(':').map(Number); sd.setHours(sh, sm, 0, 0)
    const [eh, em] = absEt.split(':').map(Number); ed.setHours(eh, em, 0, 0)
    if (ed <= sd) { ed = new Date(sd); ed.setDate(ed.getDate() + 1); ed.setHours(0, 0, 0, 0) }
    setStartDate(sd.toISOString()); setEndDate(ed.toISOString()); setOpen(false); doSearch()
  }

  return (
    <div className="relative" ref={wrap}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs border border-soc-border dark:border-soc-darkborder rounded whitespace-nowrap transition-colors bg-white dark:bg-[#2d2d2d] text-[#1f2328] dark:text-[#f0f6fc] font-medium`}
      >
        <span className="font-medium">{label}</span>
        <span className={`text-[10px] ${txt}`}>{open ? <svg className="w-2.5 h-2.5 inline" viewBox="0 0 24 24" fill="currentColor"><polyline points="18 15 12 9 6 15"/></svg> : <svg className="w-2.5 h-2.5 inline" viewBox="0 0 24 24" fill="currentColor"><polyline points="6 9 12 15 18 9"/></svg>}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scaleY: 0.96, y: -4 }}
            animate={{ opacity: 1, scaleY: 1, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.96, y: -4 }}
            transition={{ duration: 0.12 }}
            className={`gcard absolute top-full right-0 mt-1 z-[200] shadow-xl overflow-hidden`}
            style={{ width: tab === 'absolute' ? 580 : 360 }}
          >
            <div className={`flex border-b ${isDark ? 'border-soc-darkborder' : 'border-soc-border'}`}>
              {['relative','absolute','now'].map(t => (
                <div key={t} onClick={() => setTab(t)} className={tab === t ? tabAct : tabCls}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </div>
              ))}
            </div>

            {tab === 'relative' && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${txt}`}>Last</span>
                  <input type="number" min={1} value={relNum} onChange={e => setRelNum(parseInt(e.target.value) || 1)} className={`ginput w-16 px-2 py-1 text-xs text-center`} />
                  <select value={relUnit} onChange={e => setRelUnit(e.target.value)} className={`ginput px-2 py-1 text-xs`}>
                    {UNITS.map(u => <option key={u} value={u}>{UNAMES[u]}</option>)}
                  </select>
                  <span className={`text-xs ${txt}`}>to now</span>
                  <button onClick={applyRel} className="gbtn-primary ml-auto px-3 py-1 text-xs font-semibold rounded">Apply</button>
                </div>
                <div>
                  <div className="text-xs font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wide mb-2">Commonly used</div>
                  <div className="grid grid-cols-2 gap-x-2">
                    {COMMON.map((c, i) => (
                      <button key={i} onClick={() => apply(c)} className={`text-left px-2 py-1 text-xs rounded transition-colors ${isDark ? 'text-[#EF843C] hover:bg-soc-darkborder/50' : 'text-[#EF843C] hover:bg-soc-bg'}`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'absolute' && (
              <div className="p-3">
                <div className={`flex gap-2 mb-2 ${txt}`}>
                  <button onClick={() => setActiveEdge('start')} className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${activeEdge === 'start' ? 'gbtn-primary' : 'border rounded ' + btn}`}>Start</button>
                  <button onClick={() => setActiveEdge('end')} className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${activeEdge === 'end' ? 'gbtn-primary' : 'border rounded ' + btn}`}>End</button>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <div className={`flex items-center justify-between mb-1 ${txt}`}>
                      <button onClick={() => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) } else setCalMonth(m => m - 1) }} className="px-2 py-0.5 rounded hover:bg-[#EF843C]/20 transition-colors text-xs"><svg className="w-2.5 h-2.5 inline" viewBox="0 0 24 24" fill="currentColor"><polyline points="15 18 9 12 15 6"/></svg></button>
                      <span className="text-xs font-semibold">{MONTHS[calMonth]} {calYear}</span>
                      <button onClick={() => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) } else setCalMonth(m => m + 1) }} className="px-2 py-0.5 rounded hover:bg-[#EF843C]/20 transition-colors text-xs"><svg className="w-2.5 h-2.5 inline" viewBox="0 0 24 24" fill="currentColor"><polyline points="9 18 15 12 9 6"/></svg></button>
                    </div>
                    <div className="grid grid-cols-7 gap-0">
                      {DAYS.map(d => <div key={d} className={`text-center text-[10px] font-semibold py-0.5 ${txt}`}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-0">
                      {cells.map((cell, i) => {
                        const cd = new Date(cell.year, cell.month, cell.day)
                        const isT = sameDay(cd, today)
                        const isSel = sameDay(cd, selDate)
                        const cls = `text-center text-xs py-0.5 rounded transition-colors cursor-pointer ${
                          isSel ? 'bg-[#EF843C] text-white font-semibold' :
                          isT ? (isDark ? 'bg-blue-500/20 text-[#EF843C] font-semibold' : 'bg-blue-100 text-[#EF843C] font-semibold') :
                          cell.other ? (isDark ? 'text-soc-darkstext/40' : 'text-soc-stext/40') :
                          (isDark ? 'text-soc-darktext hover:bg-soc-darkborder/50' : 'text-soc-text hover:bg-soc-bg')
                        }`
                        return (
                          <button key={i} onClick={() => { const nd = new Date(cell.year, cell.month, cell.day); const [h, m] = selTime.split(':').map(Number); nd.setHours(h, m, 0, 0); setSelDate(nd) }} className={cls}>
                            {cell.day}
                          </button>
                        )
                      })}
                    </div>
                    <div className={`mt-2 pt-2 border-t text-xs ${isDark ? 'border-soc-darkborder' : 'border-soc-border'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-semibold ${txt}`}>S:</span>
                        <input type="datetime-local" value={absSd.getFullYear()+'-'+String(absSd.getMonth()+1).padStart(2,'0')+'-'+String(absSd.getDate()).padStart(2,'0')+'T'+absSt} onChange={e => { const v = e.target.value; if (v) { const [d, t] = v.split('T'); const [y, mo, da] = d.split('-').map(Number); setAbsSd(new Date(y, mo - 1, da)); setAbsSt(t) } }} className={`ginput flex-1 px-2 py-1 text-xs`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${txt}`}>E:</span>
                        <input type="datetime-local" value={absEd.getFullYear()+'-'+String(absEd.getMonth()+1).padStart(2,'0')+'-'+String(absEd.getDate()).padStart(2,'0')+'T'+absEt} onChange={e => { const v = e.target.value; if (v) { const [d, t] = v.split('T'); const [y, mo, da] = d.split('-').map(Number); setAbsEd(new Date(y, mo - 1, da)); setAbsEt(t) } }} className={`ginput flex-1 px-2 py-1 text-xs`} />
                      </div>
                    </div>
                  </div>
                  <div className={`w-[72px] border-l pl-2 ${isDark ? 'border-soc-darkborder' : 'border-soc-border'}`}>
                    <div className="text-[10px] font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wide mb-1 text-center">Time</div>
                    <div ref={timeRef} className="h-[240px] overflow-y-auto space-y-0.5">
                      {timeSlots.map(t => (
                        <button key={t} data-sel={t === selTime ? '1' : '0'} onClick={() => setSelTime(t)}
                          className={`block w-full text-center text-xs py-0.5 rounded transition-colors ${
                            t === selTime ? 'bg-[#EF843C] text-white font-semibold' :
                            t === nowTime ? (isDark ? 'text-[#EF843C]' : 'text-[#EF843C]') :
                            (isDark ? 'text-soc-darkstext hover:bg-soc-darkborder/50' : 'text-soc-stext hover:bg-soc-bg')
                          }`}
                        >{t}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={`flex justify-end gap-2 pt-2 mt-2 border-t ${isDark ? 'border-soc-darkborder' : 'border-soc-border'}`}>
                  <button onClick={() => setOpen(false)} className={`px-3 py-1 text-xs border rounded transition-colors ${btn}`}>Cancel</button>
                  <button onClick={applyAbs} className="gbtn-primary px-3 py-1 text-xs font-semibold rounded">Apply</button>
                </div>
              </div>
            )}

            {tab === 'now' && (
              <div className="p-5 text-center space-y-3">
                <div className="text-lg"><svg className="w-6 h-6 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                <div className={`text-sm font-medium ${txt}`}>Set start and end to now</div>
                <div className="flex justify-center gap-2">
                  <button onClick={() => setOpen(false)} className={`px-3 py-1 text-xs border rounded transition-colors ${btn}`}>Cancel</button>
                  <button onClick={applyNow} className="gbtn-primary px-3 py-1 text-xs font-semibold rounded">Apply</button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <input type="hidden" id="dStartDate" value={startDate} />
      <input type="hidden" id="dEndDate" value={endDate} />
    </div>
  )
}
