import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

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

function sectionHeader(doc, y, label) {
  doc.setFillColor(232, 104, 26)
  doc.rect(4, y, 2, 6, 'F')
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'bold')
  doc.text(label, 10, y + 5)
  return y + 9
}

function metricBox(doc, x, y, w, h, label, value, color) {
  doc.setFillColor(248, 249, 250)
  doc.setDrawColor(222, 226, 230)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text(label, x + 4, y + 7)
  doc.setFontSize(16)
  doc.setTextColor(color || 232, 104, 26)
  doc.setFont('helvetica', 'bold')
  doc.text(String(value), x + 4, y + 20)
}

function severityColor(level) {
  if (level === 'Critical') return [248, 81, 73]
  if (level === 'High') return [232, 104, 26]
  if (level === 'Medium') return [210, 153, 34]
  if (level === 'Low') return [63, 185, 80]
  return [100, 100, 100]
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
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentW = pageW - margin * 2
  const orange = [232, 104, 26]
  const dark = [30, 30, 30]
  const gray = [100, 100, 100]
  const lightGray = [200, 200, 200]
  let y = margin

  function checkPage(needed) {
    if (y + needed > pageH - margin) {
      doc.addPage()
      y = margin
    }
  }

  // Header
  doc.setFillColor(...orange)
  doc.rect(0, 0, pageW, 16, 'F')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text(title, margin, 11)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(`${dateRange} | ${new Date().toLocaleString()}`, pageW - margin, 11, { align: 'right' })
  y = 24

  // Metrics row
  if (metrics.length > 0) {
    const cols = Math.min(metrics.length, 4)
    const boxW = (contentW - (cols - 1) * 4) / cols
    metrics.slice(0, cols).forEach((m, i) => {
      const cx = margin + i * (boxW + 4)
      metricBox(doc, cx, y, boxW, 26, m.label, m.value, orange)
    })
    y += 34
  }

  const colW = (contentW - 4) / 2

  // Severity table
  if (severity.length > 0) {
    checkPage(50)
    y = sectionHeader(doc, y, 'Severity Distribution')
    severity.forEach((s, i) => {
      const c = severityColor(s.level)
      checkPage(8)
      const barW = (s.count / Math.max(...severity.map(x => x.count))) * 80
      doc.setFillColor(245, 245, 245)
      doc.rect(margin, y, 80, 5, 'F')
      doc.setFillColor(...c)
      doc.rect(margin, y, Math.max(barW, 2), 5, 'F')
      doc.setFontSize(8)
      doc.setTextColor(...dark)
      doc.setFont('helvetica', 'bold')
      doc.text(s.level, margin + 84, y + 4)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...gray)
      doc.text(String(s.count), margin + 84 + doc.getTextWidth(s.level) + 4, y + 4)
      y += 8
    })
    y += 4
  }

  // Two-column tables
  function renderTable(x, w, label, items, keyLabel, countLabel, maxCount) {
    checkPage(items.length * 7 + 20)
    doc.setFontSize(9)
    doc.setTextColor(...dark)
    doc.setFont('helvetica', 'bold')
    doc.text(label, x, y)
    y += 5
    items.forEach((item, i) => {
      checkPage(7)
      const name = item.key || item.name || item.id || '--'
      const cnt = item.count || item.doc_count || 0
      const pct = maxCount > 0 ? (cnt / maxCount) * 50 : 0
      doc.setFillColor(245, 245, 245)
      doc.rect(x, y, 50, 4, 'F')
      doc.setFillColor(...orange)
      doc.rect(x, y, Math.max(pct, 1), 4, 'F')
      doc.setFontSize(7)
      doc.setTextColor(...dark)
      doc.setFont('helvetica', 'bold')
      doc.text(`${i + 1}. ${name}`, x + 54, y + 3)
      doc.setTextColor(...orange)
      doc.setFont('helvetica', 'bold')
      doc.text(String(cnt), x + w - 4, y + 3, { align: 'right' })
      y += 6
    })
    y += 2
  }

  let maxRule = Math.max(...(topRules.map(r => r.count || r.doc_count || 0)), 1)
  let maxAgent = Math.max(...(topAgents.map(a => a.count || a.doc_count || 0)), 1)
  let maxArticle = Math.max(...(topArticles.map(a => a.count || a.doc_count || 0)), 1)

  if (topRules.length > 0 || topAgents.length > 0) {
    checkPage(40)
    const leftX = margin
    const rightX = margin + colW + 4
    y += 0
    const saveY = y
    let y1 = y, y2 = y

    if (topRules.length > 0) {
      const rulesLabel = 'Top Rules'
      const rulesStartY = y1
      doc.setFontSize(9)
      doc.setTextColor(...dark)
      doc.setFont('helvetica', 'bold')
      doc.text(rulesLabel, leftX, y1)
      y1 += 5
      topRules.slice(0, 8).forEach((r, i) => {
        const cnt = r.count || r.doc_count || 0
        const pct = (cnt / maxRule) * 50
        doc.setFillColor(245, 245, 245)
        doc.rect(leftX, y1, 50, 4, 'F')
        doc.setFillColor(...orange)
        doc.rect(leftX, y1, Math.max(pct, 1), 4, 'F')
        doc.setFontSize(7)
        doc.setTextColor(...dark)
        doc.setFont('helvetica', 'bold')
        doc.text(`${i + 1}. ${r.key || r.id || '--'}`, leftX + 54, y1 + 3)
        doc.setTextColor(...orange)
        doc.setFont('helvetica', 'bold')
        doc.text(String(cnt), leftX + colW - 4, y1 + 3, { align: 'right' })
        y1 += 6
      })
      y1 += 2
    }

    if (topAgents.length > 0) {
      const agentsLabel = 'Top Agents'
      doc.setFontSize(9)
      doc.setTextColor(...dark)
      doc.setFont('helvetica', 'bold')
      doc.text(agentsLabel, rightX, y2)
      y2 += 5
      topAgents.slice(0, 8).forEach((a, i) => {
        const cnt = a.count || a.doc_count || 0
        const pct = (cnt / maxAgent) * 50
        doc.setFillColor(245, 245, 245)
        doc.rect(rightX, y2, 50, 4, 'F')
        doc.setFillColor(...orange)
        doc.rect(rightX, y2, Math.max(pct, 1), 4, 'F')
        doc.setFontSize(7)
        doc.setTextColor(...dark)
        doc.setFont('helvetica', 'bold')
        doc.text(`${i + 1}. ${a.key || a.name || '--'}`, rightX + 54, y2 + 3)
        doc.setTextColor(...orange)
        doc.setFont('helvetica', 'bold')
        doc.text(String(cnt), rightX + colW - 4, y2 + 3, { align: 'right' })
        y2 += 6
      })
      y2 += 2
    }
    y = Math.max(y1, y2)
  }

  // Top Articles
  if (topArticles.length > 0) {
    checkPage(topArticles.length * 7 + 20)
    y = sectionHeader(doc, y, 'Top Articles / Controls')
    topArticles.slice(0, 10).forEach((a, i) => {
      checkPage(7)
      const name = a.key || a.code || a.article || '--'
      const cnt = a.count || a.doc_count || 0
      const pct = maxArticle > 0 ? (cnt / maxArticle) * 50 : 0
      doc.setFillColor(245, 245, 245)
      doc.rect(margin, y, 50, 4, 'F')
      doc.setFillColor(...orange)
      doc.rect(margin, y, Math.max(pct, 1), 4, 'F')
      doc.setFontSize(7)
      doc.setTextColor(...dark)
      doc.setFont('helvetica', 'bold')
      doc.text(`${i + 1}. ${name}`, margin + 54, y + 3)
      doc.setTextColor(...orange)
      doc.setFont('helvetica', 'bold')
      doc.text(String(cnt), margin + contentW - 4, y + 3, { align: 'right' })
      y += 6
    })
    y += 4
  }

  // Framework Distribution
  if (frameworkCounts.length > 0) {
    checkPage(frameworkCounts.length * 7 + 20)
    y = sectionHeader(doc, y, 'Framework Distribution')
    const maxFw = Math.max(...frameworkCounts.map(f => f.count || f.doc_count || 0), 1)
    frameworkCounts.forEach((fw, i) => {
      checkPage(7)
      const cnt = fw.count || fw.doc_count || 0
      const pct = (cnt / maxFw) * 80
      doc.setFillColor(245, 245, 245)
      doc.rect(margin, y, 80, 5, 'F')
      doc.setFillColor(163, 113, 247)
      doc.rect(margin, y, Math.max(pct, 1), 5, 'F')
      doc.setFontSize(8)
      doc.setTextColor(...dark)
      doc.setFont('helvetica', 'bold')
      doc.text(fw.framework || fw.key || '--', margin + 84, y + 4)
      doc.setTextColor(...gray)
      doc.setFont('helvetica', 'normal')
      doc.text(String(cnt), margin + contentW - 4, y + 4, { align: 'right' })
      y += 8
    })
    y += 4
  }

  // Event Logs Table
  if (logHeaders.length > 0 && logRows.length > 0) {
    checkPage(30)
    y = sectionHeader(doc, Math.max(y, 30), 'Event Logs')
    y += 2
    const tableStartY = y + 2
    doc.autoTable({
      head: [logHeaders.map(h => h.charAt(0).toUpperCase() + h.slice(1))],
      body: logRows.slice(0, 200),
      startY: tableStartY,
      styles: { fontSize: 6, cellPadding: 1.5, lineColor: [230, 230, 230], lineWidth: 0.3 },
      headStyles: { fillColor: [232, 104, 26], fontSize: 6, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      didDrawPage: (data) => {
        if (data.pageCount > 1) {
          doc.setFillColor(...orange)
          doc.rect(0, 0, pageW, 16, 'F')
          doc.setFontSize(9)
          doc.setTextColor(255, 255, 255)
          doc.setFont('helvetica', 'bold')
          doc.text(`${title} (cont.)`, margin, 11)
          doc.setFontSize(7)
          doc.setFont('helvetica', 'normal')
          doc.text(new Date().toLocaleString(), pageW - margin, 11, { align: 'right' })
        }
      },
    })
  }

  doc.save(filename)
}
