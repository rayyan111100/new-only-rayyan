import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'

function getValue(obj, accessor) {
  if (typeof accessor === 'function') return accessor(obj)
  if (typeof accessor !== 'string') return String(obj ?? '')
  const parts = accessor.split('.')
  let val = obj
  for (const p of parts) {
    if (val == null) return ''
    val = val[p]
  }
  return val == null ? '' : String(val)
}

export function prepareRows(logs, columns) {
  return logs.map(log => columns.map(col => getValue(log, col.accessor)))
}

export function exportExcel(logs, columns, filename = 'export.xlsx') {
  const rows = prepareRows(logs, columns)
  const header = columns.map(c => c.header)
  const data = [header, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Logs')
  ws['!cols'] = columns.map(() => ({ wch: 22 }))
  XLSX.writeFile(wb, filename)
}

function severityColor(level) {
  if (level === 'Critical') return [248, 81, 73]
  if (level === 'High') return [232, 104, 26]
  if (level === 'Medium') return [210, 153, 34]
  if (level === 'Low') return [63, 185, 80]
  return [100, 100, 100]
}

function severityBg(level) {
  if (level === 'Critical') return [255, 235, 235]
  if (level === 'High') return [255, 242, 230]
  if (level === 'Medium') return [255, 248, 225]
  if (level === 'Low') return [230, 250, 235]
  return [245, 245, 245]
}

export function exportPDFReport({
  filename = 'report.pdf',
  title = 'Event Report',
  dateRange = '',
  metrics = [],
  severity = [],
  topRules = [],
  topAgents = [],
  topArticles = [],
  frameworkCounts = [],
  categories = [],
  timeline = [],
  logHeaders = [],
  logRows = [],
}) {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const m = 14
    const cw = pageW - m * 2
    const orange = [232, 104, 26]
    const dark = [31, 35, 40]
    const gray = [108, 117, 125]
    const border = [208, 215, 222]
    let y = m

    function checkPage(needed) {
      if (y + needed > pageH - m) {
        doc.addPage()
        y = m
      }
    }

    function sectionLabel(label) {
      checkPage(14)
      doc.setFillColor(245, 247, 249)
      doc.roundedRect(m, y, cw, 8, 2, 2, 'F')
      doc.setFillColor(...orange)
      doc.rect(m, y, 3, 8, 'F')
      doc.setFontSize(10)
      doc.setTextColor(...dark)
      doc.setFont('helvetica', 'bold')
      doc.text(label, m + 7, y + 5.5)
      y += 14
    }

    // ── Branded Header ──
    doc.setFillColor(...orange)
    doc.rect(0, 0, pageW, 20, 'F')
    doc.setFontSize(14)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text('UniShield360', m, 13)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Security Operations Center', m + 35, 13, { align: 'left' })
    doc.setFontSize(7)
    doc.text(new Date().toLocaleString(), pageW - m, 13, { align: 'right' })

    // ── Report title block ──
    y = 30
    checkPage(30)
    doc.setFontSize(18)
    doc.setTextColor(...dark)
    doc.setFont('helvetica', 'bold')
    doc.text(title, m, y)
    y += 6
    doc.setFontSize(8)
    doc.setTextColor(...gray)
    doc.setFont('helvetica', 'normal')
    doc.text(`Time Range: ${dateRange}`, m, y)
    y += 4
    doc.text(`Generated: ${new Date().toLocaleString()}`, m, y)
    y += 4
    const totalEvents = severity.reduce((s, sev) => s + (sev.count || 0), 0)
    doc.text(`Total Events: ${totalEvents.toLocaleString()}`, m, y)
    y += 10

    // ── Summary Metrics ──
    if (metrics.length > 0) {
      sectionLabel('Executive Summary')
      const cols = Math.min(metrics.length, 4)
      const gap = 3
      const boxW = (cw - (cols - 1) * gap) / cols
      metrics.slice(0, cols).forEach((mtr, i) => {
        const cardH = 22
        checkPage(cardH + 4)
        const cx = m + i * (boxW + gap)
        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(...border)
        doc.roundedRect(cx, y, boxW, cardH, 3, 3, 'FD')
        doc.setFontSize(7)
        doc.setTextColor(...gray)
        doc.setFont('helvetica', 'normal')
        doc.text(mtr.label.toUpperCase(), cx + 4, y + 7)
        doc.setFontSize(16)
        doc.setTextColor(...orange)
        doc.setFont('helvetica', 'bold')
        doc.text(String(mtr.value), cx + 4, y + 18)
      })
      y += 28
    }

    // ── Timeline ──
    if (timeline.length > 0) {
      sectionLabel('Events Timeline')
      checkPage(40)
      const maxCnt = Math.max(...timeline.map(t => t.count || 0), 1)
      const visCount = Math.min(timeline.length, 48)
      const segW = cw / visCount
      doc.setDrawColor(...border)
      timeline.slice(0, visCount).forEach((t, i) => {
        const ratio = (t.count || 0) / maxCnt
        const bw = Math.max(segW - 0.5, 1)
        const bh = Math.max(ratio * 25, 1)
        doc.setFillColor(...orange)
        doc.rect(m + i * segW, y + 25 - bh, bw, bh, 'F')
      })
      doc.setFontSize(6)
      doc.setTextColor(...gray)
      doc.setFont('helvetica', 'normal')
      const step = Math.max(1, Math.floor(visCount / 6))
      for (let i = 0; i < visCount; i += step) {
        doc.text(String(timeline[i]?.count || ''), m + i * segW, y + 27)
      }
      y += 32
    }

    // ── Severity Distribution ──
    if (severity.length > 0) {
      sectionLabel('Severity Distribution')
      const maxSev = Math.max(...severity.map(s => s.count || 0), 1)
      severity.forEach((s) => {
        checkPage(10)
        const c = severityColor(s.level)
        const bg = severityBg(s.level)
        const barW = ((s.count || 0) / maxSev) * (cw - 100)
        doc.setFillColor(...bg)
        doc.roundedRect(m, y, cw - 24, 7, 2, 2, 'F')
        doc.setFillColor(...c)
        doc.roundedRect(m, y, Math.max(barW, 2), 7, 2, 2, 'F')
        doc.setFontSize(8)
        doc.setTextColor(...c)
        doc.setFont('helvetica', 'bold')
        doc.text(s.level, m + cw - 22, y + 5)
        doc.setFontSize(7)
        doc.setTextColor(...gray)
        doc.text(String(s.count || 0), m + cw - 22 + doc.getTextWidth(s.level) + 2, y + 5)
        y += 10
      })
      y += 2
    }

    // ── Top Rules ──
    const halfW = (cw - 4) / 2
    if (topRules.length > 0) {
      sectionLabel('Top Rules')
      const maxR = Math.max(...(topRules.map(r => r.count || r.doc_count || 0)), 1)
      topRules.slice(0, 8).forEach((r, i) => {
        checkPage(7)
        const cnt = r.count || r.doc_count || 0
        const pct = (cnt / maxR) * (halfW - 10)
        doc.setFillColor(245, 245, 245)
        doc.roundedRect(m, y, halfW - 10, 4, 1.5, 1.5, 'F')
        doc.setFillColor(...orange)
        doc.roundedRect(m, y, Math.max(pct, 1), 4, 1.5, 1.5, 'F')
        doc.setFontSize(6.5)
        doc.setTextColor(...dark)
        doc.setFont('helvetica', 'bold')
        const rLabel = `${i + 1}. ${r.key || r.ruleId || r.id || '--'}`
        doc.text(rLabel, m + halfW - 8, y + 3)
        doc.setTextColor(...orange)
        doc.setFont('helvetica', 'bold')
        doc.text(String(cnt), m + halfW - 8 + doc.getTextWidth(rLabel) + 2, y + 3)
        y += 6
      })
      y += 4
    }

    // ── Top Agents ──
    if (topAgents.length > 0) {
      sectionLabel('Top Agents')
      const maxA = Math.max(...(topAgents.map(a => a.count || a.doc_count || 0)), 1)
      topAgents.slice(0, 8).forEach((a, i) => {
        checkPage(7)
        const cnt = a.count || a.doc_count || 0
        const pct = (cnt / maxA) * (halfW - 10)
        doc.setFillColor(245, 245, 245)
        doc.roundedRect(m, y, halfW - 10, 4, 1.5, 1.5, 'F')
        doc.setFillColor(...orange)
        doc.roundedRect(m, y, Math.max(pct, 1), 4, 1.5, 1.5, 'F')
        doc.setFontSize(6.5)
        doc.setTextColor(...dark)
        doc.setFont('helvetica', 'bold')
        const aLabel = `${i + 1}. ${a.key || a.agent || a.name || '--'}`
        doc.text(aLabel, m + halfW - 8, y + 3)
        doc.setTextColor(...orange)
        doc.setFont('helvetica', 'bold')
        doc.text(String(cnt), m + halfW - 8 + doc.getTextWidth(aLabel) + 2, y + 3)
        y += 6
      })
      y += 4
    }

    // ── Top Articles / Controls ──
    if (topArticles.length > 0) {
      sectionLabel('Top Articles / Controls')
      const maxArt = Math.max(...(topArticles.map(a => a.count || a.doc_count || 0)), 1)
      topArticles.slice(0, 10).forEach((a, i) => {
        checkPage(7)
        const cnt = a.count || a.doc_count || 0
        const pct = (cnt / maxArt) * (cw - 60)
        doc.setFillColor(245, 245, 245)
        doc.roundedRect(m, y, cw - 60, 4, 1.5, 1.5, 'F')
        doc.setFillColor(...orange)
        doc.roundedRect(m, y, Math.max(pct, 1), 4, 1.5, 1.5, 'F')
        doc.setFontSize(6.5)
        doc.setTextColor(...dark)
        doc.setFont('helvetica', 'bold')
        const artLabel = `${i + 1}. ${a.key || a.code || a.article || '--'}`
        doc.text(artLabel, m + cw - 58, y + 3)
        doc.setTextColor(...orange)
        doc.setFont('helvetica', 'bold')
        doc.text(String(cnt), m + cw - 58 + doc.getTextWidth(artLabel) + 2, y + 3)
        y += 6
      })
      y += 4
    }

    // ── Event Logs Table ──
    if (logHeaders.length > 0 && logRows.length > 0) {
      checkPage(30)
      sectionLabel('Event Log Details')
      y += 1
      autoTable(doc, {
        head: [logHeaders.map(h => h.charAt(0).toUpperCase() + h.slice(1))],
        body: logRows.slice(0, 200),
        startY: y + 1,
        styles: { fontSize: 6, cellPadding: 1.2, lineColor: [220, 220, 225], lineWidth: 0.2 },
        headStyles: { fillColor: [232, 104, 26], fontSize: 6.5, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        bodyStyles: { textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        margin: { left: m, right: m },
        tableWidth: cw,
        didDrawPage: (data) => {
          if (data.pageCount > 1) {
            doc.setFillColor(...orange)
            doc.rect(0, 0, pageW, 14, 'F')
            doc.setFontSize(8)
            doc.setTextColor(255, 255, 255)
            doc.setFont('helvetica', 'bold')
            doc.text('UniShield360 — Event Log Details (cont.)', m, 9.5)
            doc.setFontSize(6)
            doc.setFont('helvetica', 'normal')
            doc.text(new Date().toLocaleString(), pageW - m, 9.5, { align: 'right' })
          }
        },
      })
    }

    // ── Footer on each page ──
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(5.5)
      doc.setTextColor(...gray)
      doc.setFont('helvetica', 'normal')
      doc.text(`UniShield360 SOC Dashboard | Page ${i}`, pageW / 2, pageH - 5, { align: 'center' })
    }

    doc.save(filename)
  } catch (e) { console.error('PDF error:', e); alert('PDF failed: ' + e.message) }
}
