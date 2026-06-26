import axios from 'axios'

const API = '/api/reports'

export const reportService = {
  async create(config) {
    const { data } = await axios.post(API, config)
    return data.id
  },

  async list() {
    const { data } = await axios.get(API)
    return data
  },

  async get(id) {
    const { data } = await axios.get(API + '/' + id)
    return data
  },

  async update(id, updates) {
    const { data } = await axios.put(API + '/' + id, updates)
    return data
  },

  async delete(id) {
    await axios.delete(API + '/' + id)
  },

  async generate(id) {
    const { data } = await axios.post(API + '/' + id + '/generate')
    return data
  },

  async preview(dashboardId, config) {
    try {
      const stored = localStorage.getItem('unishield_dashboards')
      const dashboards = stored ? JSON.parse(stored) : []
      const dashboard = dashboards.find(d => d.id === dashboardId)
      if (!dashboard) return { panels: [], dashboard: 'Unknown' }

      const panelData = await Promise.all(
        (dashboard.panels || []).slice(0, 5).map(async (panel) => {
          try {
            const params = {
              index: config?.index || 'unishield360-alerts-4.x-*',
              limit: 5,
              start_date: config?.timeRange || 'now-24h',
              end_date: 'now',
            }
            const res = await axios.get('/api/search', { params, timeout: 10000 })
            return { id: panel.id, title: panel.title, vizType: panel.vizType || 'bar', data: res.data }
          } catch {
            return { id: panel.id, title: panel.title, vizType: panel.vizType, data: null }
          }
        })
      )
      return { panels: panelData, total: dashboard.panels?.length || 0, dashboard: dashboard.name }
    } catch (e) {
      return { panels: [], error: e.message }
    }
  },

  async generatePdf(reportId) {
    const report = await reportService.get(reportId).catch(() => null)
    if (!report) return false
    try {
      const { jsPDF } = await import('jspdf')
      await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      doc.setFontSize(18)
      doc.text(report.name || 'Report', 14, 20)
      doc.setFontSize(10)
      doc.text('Generated: ' + new Date().toLocaleString(), 14, 28)
      doc.text('Dashboard: ' + (report.dashboardId || 'N/A'), 14, 34)
      if (report.description) {
        doc.setFontSize(11)
        doc.text(report.description, 14, 42)
      }
      const preview = await reportService.preview(report.dashboardId, report)
      let yPos = 50
      if (preview.panels?.length) {
        doc.setFontSize(14)
        doc.text('Panels', 14, yPos)
        yPos += 8
        for (const p of preview.panels) {
          if (yPos > 180) { doc.addPage(); yPos = 20 }
          doc.setFontSize(11)
          doc.text((p.title || 'Panel') + ' (' + (p.vizType || 'unknown') + ')', 14, yPos)
          yPos += 6
          if (p.data?.results?.length) {
            doc.setFontSize(8)
            for (const r of p.data.results.slice(0, 5)) {
              if (yPos > 190) { doc.addPage(); yPos = 20 }
              const line = JSON.stringify(r).substring(0, 160)
              doc.text(line, 18, yPos)
              yPos += 4
            }
          }
        }
      }
      doc.save((report.name || 'report').replace(/\s+/g, '_') + '.pdf')
      return true
    } catch (e) {
      console.error('PDF generation error:', e.message)
      return false
    }
  },

  async schedule(id, config) {
    return reportService.update(id, {
      scheduled: true,
      frequency: config.frequency,
      time: config.time,
      days: config.days,
      status: 'scheduled',
    })
  },

  async email(reportId, config) {
    if (!config.sendEmail) return
    return reportService.update(reportId, {
      emailTo: config.emailTo,
      emailFrom: config.emailFrom,
      emailSubject: config.emailSubject,
      includeInBody: config.includeInBody,
      attachAsFile: config.attachAsFile,
    })
  },
}
