import * as XLSX from 'xlsx'
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate'
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'

let logoData = null
const logoImg = new Image()
logoImg.onload = () => { logoData = logoImg }
logoImg.src = '/unishield-logo.png'

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
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: columns.length - 1 } }) }

  const buf = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
  const files = unzipSync(buf)

  files['xl/styles.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF1F2328"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFC6EFCE"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border/>
    <border>
      <left style="thin"><color auto="1"/></left>
      <right style="thin"><color auto="1"/></right>
      <top style="thin"><color auto="1"/></top>
      <bottom style="thin"><color auto="1"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`)

  const sheetStr = strFromU8(files['xl/worksheets/sheet1.xml'])
  const sheetModified = sheetStr.replace(
    /(<row r="1">[\s\S]*?<\/row>)/,
    m => m.replace(/<c\s/g, '<c s="1" ')
  )
  files['xl/worksheets/sheet1.xml'] = strToU8(sheetModified)

  const output = zipSync(files, { level: 9 })
  const blob = new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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
  recentEvents = [],
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
    const border = [210, 214, 220]
    const cardBg = [247, 248, 250]
    const innerPad = 5
    let y = m

    function checkPage(needed) {
      if (y + needed > pageH - m) {
        doc.addPage()
        y = m + 4
      }
    }

    function sectionLabel(label) {
      checkPage(16)
      doc.setFontSize(10)
      doc.setTextColor(...dark)
      doc.setFont('helvetica', 'bold')
      doc.text(label, m, y)
      y += 8
    }

    function drawCard(cx, cy, cw, ch) {
      doc.setFillColor(...cardBg)
      doc.setDrawColor(...border)
      doc.roundedRect(cx, cy, cw, ch, 2, 2, 'FD')
    }

    // ── Orange Header Bar ──
    doc.setFillColor(...orange)
    doc.rect(0, 0, pageW, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(255, 255, 255)
    doc.circle(m + 9, 11, 9, 'F')
    if (logoData) {
      doc.addImage(logoData, 'PNG', m + 3, 5, 12, 12)
    }
    doc.setFontSize(14)
    doc.text('UniShield 360', m + 21, 11)
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.text('SOC Dashboard Report · ' + new Date().toLocaleString(), pageW - m, 11, { align: 'right' })
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(0.5)
    doc.line(m, 22, pageW - m, 22)

    // ── Report title block ──
    y = 30
    checkPage(30)
    doc.setFontSize(18)
    doc.setTextColor(...dark)
    doc.setFont('helvetica', 'bold')
    doc.text(title, m, y)
    y += 8
    doc.setFontSize(8)
    doc.setTextColor(...gray)
    doc.setFont('helvetica', 'normal')
    doc.text(`Time Range: ${dateRange}`, m, y)
    y += 4
    const totalEvents = severity.reduce((s, sev) => s + (sev.count || 0), 0)
    doc.text(`Total Events: ${totalEvents.toLocaleString()}`, m, y)
    y += 12

    // ── Summary Metrics ──
    if (metrics.length > 0) {
      sectionLabel('Executive Summary')
      const cols = Math.min(metrics.length, 4)
      const gap = 4
      const boxW = (cw - (cols - 1) * gap) / cols
      metrics.slice(0, cols).forEach((mtr, i) => {
        const cardH = 24
        checkPage(cardH + 4)
        const cx = m + i * (boxW + gap)
        doc.setFillColor(...cardBg)
        doc.setDrawColor(...border)
        doc.roundedRect(cx, y, boxW, cardH, 3, 3, 'FD')
        doc.setFillColor(...orange)
        doc.rect(cx, y, boxW, 2.5, 'F')
        doc.setFontSize(6.5)
        doc.setTextColor(...gray)
        doc.setFont('helvetica', 'normal')
        doc.text(mtr.label.toUpperCase(), cx + 5, y + 9)
        doc.setFontSize(16)
        doc.setTextColor(...dark)
        doc.setFont('helvetica', 'bold')
        doc.text(String(mtr.value), cx + 5, y + 21)
      })
      y += 32
      const totalSrc = metrics.find(m => /source|agent/i.test(m.label))?.value || 0
      doc.setFontSize(6.5)
      doc.setTextColor(...gray)
      doc.setFont('helvetica', 'italic')
      doc.text(`Total of ${(metrics[0]?.value || 0).toLocaleString()} events analyzed across ${totalSrc} active sources.`, m + 1, y + 3)
      y += 14
    }

    // ── Timeline ──
    if (timeline.length > 0) {
      sectionLabel('Events Timeline')
      const chartH = 28
      const boxH = chartH + 14
      checkPage(boxH + 6)
      const sy = y
      drawCard(m, sy, cw, boxH)
      const ix = m + innerPad
      const iw = cw - innerPad * 2
      const iy = sy + innerPad
      const maxCnt = Math.max(...timeline.map(t => t.count || 0), 1)
      const visCount = Math.min(timeline.length, 48)
      const segW = iw / visCount
      doc.setDrawColor(...border)
      timeline.slice(0, visCount).forEach((t, i) => {
        const ratio = (t.count || 0) / maxCnt
        const bw = Math.max(segW - 0.4, 1)
        const bh = Math.max(ratio * chartH, 1)
        doc.setFillColor(...orange)
        doc.rect(ix + i * segW, iy + chartH - bh, bw, bh, 'F')
      })
      doc.setFontSize(5.5)
      doc.setTextColor(...gray)
      doc.setFont('helvetica', 'normal')
      const step = Math.max(1, Math.floor(visCount / 6))
      for (let i = 0; i < visCount; i += step) {
        doc.text(String(timeline[i]?.count || ''), ix + i * segW, iy + chartH + 4)
      }
      const peakT = timeline.reduce((a, b) => (a.count || 0) > (b.count || 0) ? a : b, { count: 0 })
      const avgT = Math.round(timeline.reduce((s, t) => s + (t.count || 0), 0) / Math.max(timeline.length, 1))
      doc.setFontSize(6.5)
      doc.setTextColor(...gray)
      doc.setFont('helvetica', 'italic')
      doc.text(`Peak: ${(peakT.count || 0).toLocaleString()} events/hr  \u00B7  Average: ${avgT.toLocaleString()} events/hr`, ix, iy + chartH + 10)
      y = sy + boxH + 8
    }

    // ── Severity Distribution ──
    if (severity.length > 0) {
      sectionLabel('Severity Distribution')
      const rows = severity.length
      const boxH = rows * 9 + 12
      checkPage(boxH + 6)
      const sy = y
      drawCard(m, sy, cw, boxH)
      const ix = m + innerPad
      const iw = cw - innerPad * 2
      const labelW = 24
      const barAreaW = iw - labelW - 2
      let iy = sy + innerPad
      const maxSev = Math.max(...severity.map(s => s.count || 0), 1)
      severity.forEach((s) => {
        const c = severityColor(s.level)
        const bg = severityBg(s.level)
        const barW = ((s.count || 0) / maxSev) * barAreaW
        doc.setFillColor(...bg)
        doc.roundedRect(ix, iy, barAreaW, 6, 1, 1, 'F')
        doc.setFillColor(...c)
        doc.roundedRect(ix, iy, Math.max(barW, 2), 6, 1, 1, 'F')
        doc.setFontSize(7)
        doc.setTextColor(...c)
        doc.setFont('helvetica', 'bold')
        doc.text(s.level, ix + barAreaW + 3, iy + 4.5)
        doc.setFontSize(6.5)
        doc.setTextColor(...gray)
        doc.text(String(s.count || 0), ix + barAreaW + 3 + doc.getTextWidth(s.level) + 3, iy + 4.5)
        iy += 9
      })
      doc.setFontSize(6.5)
      doc.setTextColor(...gray)
      doc.setFont('helvetica', 'italic')
      doc.text(`Critical: ${(severity.find(s => s.level === 'Critical')?.count || 0).toLocaleString()}  \u00B7  High: ${(severity.find(s => s.level === 'High')?.count || 0).toLocaleString()}  \u00B7  Medium: ${(severity.find(s => s.level === 'Medium')?.count || 0).toLocaleString()}  \u00B7  Low: ${(severity.find(s => s.level === 'Low')?.count || 0).toLocaleString()}`, ix, iy + 4)
      y = sy + boxH + 8
    }

    // ── Top Rules ──
    const halfW = (cw - 4) / 2
    const ruleDescs = {}
    recentEvents.forEach(e => { const id = e.rule?.id; if (id && e.rule?.description) ruleDescs[id] = e.rule.description })
    if (topRules.length > 0) {
      sectionLabel('Top Rules')
      const rows = Math.min(topRules.length, 8)
      const boxH = rows * 6 + 12
      checkPage(boxH + 6)
      const sy = y
      drawCard(m, sy, cw, boxH)
      const ix = m + innerPad
      const iw = cw - innerPad * 2
      const barW = iw * 0.3
      const labelX = ix + barW + 5
      let iy = sy + innerPad
      const maxR = Math.max(...(topRules.map(r => r.count || r.doc_count || 0)), 1)
      topRules.slice(0, rows).forEach((r, i) => {
        const cnt = r.count || r.doc_count || 0
        const pct = (cnt / maxR) * barW
        doc.setFillColor(240, 242, 246)
        doc.roundedRect(ix, iy, barW, 4, 1, 1, 'F')
        doc.setFillColor(...orange)
        doc.roundedRect(ix, iy, Math.max(pct, 1), 4, 1, 1, 'F')
        doc.setFontSize(6.5)
        doc.setTextColor(...dark)
        doc.setFont('helvetica', 'bold')
        const rId = r.key || r.ruleId || r.id || '--'
        const rDesc = ruleDescs[rId] || r.description || ''
        const finalLabel = `${i + 1}. ${rId}${rDesc ? ' \u2014 ' + rDesc : ''}`
        const maxLabel = iw - barW - 5 - doc.getTextWidth(String(cnt)) - 5
        let truncLabel = finalLabel
        while (doc.getTextWidth(truncLabel) > maxLabel && truncLabel.length > 8) {
          truncLabel = truncLabel.slice(0, -4) + '...'
        }
        doc.text(truncLabel, labelX, iy + 3)
        doc.setTextColor(...gray)
        doc.setFont('helvetica', 'normal')
        doc.text(String(cnt), labelX + doc.getTextWidth(truncLabel) + 4, iy + 3)
        iy += 6
      })
      const topR = topRules[0] || {}
      const rCnt = topR.count || topR.doc_count || 0
      doc.setFontSize(6.5)
      doc.setTextColor(...gray)
      doc.setFont('helvetica', 'italic')
      doc.text(`Top rule "${topR.key || topR.ruleId || '--'}" triggered ${rCnt.toLocaleString()} times across ${topRules.length} active rules.`, ix, iy + 4)
      y = sy + boxH + 8
    }

    // ── Top Agents ──
    if (topAgents.length > 0) {
      sectionLabel('Top Agents')
      const rows = Math.min(topAgents.length, 8)
      const boxH = rows * 6 + 12
      checkPage(boxH + 6)
      const sy = y
      drawCard(m, sy, cw, boxH)
      const ix = m + innerPad
      const iw = cw - innerPad * 2
      const barW = iw * 0.3
      const labelX = ix + barW + 5
      let iy = sy + innerPad
      const maxA = Math.max(...(topAgents.map(a => a.count || a.doc_count || 0)), 1)
      topAgents.slice(0, rows).forEach((a, i) => {
        const cnt = a.count || a.doc_count || 0
        const pct = (cnt / maxA) * barW
        doc.setFillColor(240, 242, 246)
        doc.roundedRect(ix, iy, barW, 4, 1, 1, 'F')
        doc.setFillColor(...orange)
        doc.roundedRect(ix, iy, Math.max(pct, 1), 4, 1, 1, 'F')
        doc.setFontSize(6.5)
        doc.setTextColor(...dark)
        doc.setFont('helvetica', 'bold')
        const aLabel = `${i + 1}. ${a.key || a.agent || a.name || '--'}`
        doc.text(aLabel, labelX, iy + 3)
        doc.setTextColor(...gray)
        doc.setFont('helvetica', 'normal')
        doc.text(String(cnt), labelX + doc.getTextWidth(aLabel) + 4, iy + 3)
        iy += 6
      })
      const topA = topAgents[0] || {}
      const aCnt = topA.count || topA.doc_count || 0
      doc.setFontSize(6.5)
      doc.setTextColor(...gray)
      doc.setFont('helvetica', 'italic')
      doc.text(`Top source "${topA.key || topA.agent || '--'}" generated ${aCnt.toLocaleString()} events out of ${topAgents.length} active sources.`, ix, iy + 4)
      y = sy + boxH + 8
    }

    // ── Top Articles / Controls ──
    if (topArticles.length > 0) {
      sectionLabel('Top Articles / Controls')
      const rows = Math.min(topArticles.length, 10)
      const boxH = rows * 6 + 12
      checkPage(boxH + 6)
      const sy = y
      drawCard(m, sy, cw, boxH)
      const ix = m + innerPad
      const iw = cw - innerPad * 2
      const barW = iw * 0.25
      const labelX = ix + barW + 5
      let iy = sy + innerPad
      const maxArt = Math.max(...(topArticles.map(a => a.count || a.doc_count || 0)), 1)
      topArticles.slice(0, rows).forEach((a, i) => {
        const cnt = a.count || a.doc_count || 0
        const pct = (cnt / maxArt) * barW
        doc.setFillColor(240, 242, 246)
        doc.roundedRect(ix, iy, barW, 4, 1, 1, 'F')
        doc.setFillColor(...orange)
        doc.roundedRect(ix, iy, Math.max(pct, 1), 4, 1, 1, 'F')
        doc.setFontSize(6.5)
        doc.setTextColor(...dark)
        doc.setFont('helvetica', 'bold')
        const artLabel = `${i + 1}. ${a.key || a.code || a.article || '--'}`
        doc.text(artLabel, labelX, iy + 3)
        doc.setTextColor(...gray)
        doc.setFont('helvetica', 'normal')
        doc.text(String(cnt), labelX + doc.getTextWidth(artLabel) + 4, iy + 3)
        iy += 6
      })
      const topArt = topArticles[0] || {}
      const artCnt = topArt.count || topArt.doc_count || 0
      doc.setFontSize(6.5)
      doc.setTextColor(...gray)
      doc.setFont('helvetica', 'italic')
      doc.text(`Top control "${topArt.key || topArt.code || '--'}" mapped to ${artCnt.toLocaleString()} events across ${topArticles.length} requirements.`, ix, iy + 4)
      y = sy + boxH + 8
    }

    // ── Event Logs Table ──
    if (logHeaders.length > 0 && logRows.length > 0) {
      checkPage(30)
      sectionLabel('Event Log Details')
      y += 4
      drawCard(m, y - 4, cw, 8)
      autoTable(doc, {
        head: [logHeaders.map(h => h.charAt(0).toUpperCase() + h.slice(1))],
        body: logRows.slice(0, 200),
        startY: y + 2,
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
            doc.text('360 \u2014 Event Log Details (cont.)', m, 9.5)
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
      doc.setDrawColor(...border)
      doc.line(m, pageH - 8, pageW - m, pageH - 8)
      doc.setFontSize(5.5)
      doc.setTextColor(...gray)
      doc.setFont('helvetica', 'normal')
      doc.text('360', m, pageH - 4)
      doc.text(`Page ${i} of ${pageCount}`, pageW - m, pageH - 4, { align: 'right' })
    }

    doc.save(filename)
  } catch (e) { console.error('PDF error:', e); alert('PDF failed: ' + e.message) }
}
