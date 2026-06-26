const axios = require('axios')

class SSEService {
  constructor(api) {
    this.api = api
    this.clients = { alerts: new Set(), timeseries: new Set(), dashboard: new Map() }
    this.keepaliveTimers = {}
  }

  handleAlerts(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    res.write(`data: ${JSON.stringify({ type: 'connected', channel: 'alerts' })}\n\n`)

    this.clients.alerts.add(res)
    const keepalive = setInterval(() => res.write(':keepalive\n\n'), 15000)
    this.keepaliveTimers[res._id || Date.now()] = keepalive

    // Initial snapshot
    this.api.get('/search', { params: { index: 'unishield360-alerts-4.x-*', limit: 10, sort: '@timestamp', order: 'desc', start_date: 'now-24h', end_date: 'now' } })
      .then(r => res.write(`data: ${JSON.stringify({ type: 'alerts_snapshot', alerts: (r.data.results || []).slice(0, 10), total: r.data.total || 0 })}\n\n`))
      .catch(() => {})

    req.on('close', () => {
      this.clients.alerts.delete(res)
      clearInterval(keepalive)
    })
  }

  handleTimeseries(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    res.write(`data: ${JSON.stringify({ type: 'connected', channel: 'timeseries' })}\n\n`)

    this.clients.timeseries.add(res)
    const keepalive = setInterval(() => res.write(':keepalive\n\n'), 15000)
    this.keepaliveTimers[Date.now()] = keepalive

    this.api.get('/aggregate', { params: { index: 'unishield360-alerts-4.x-*', field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48, start_date: 'now-24h', end_date: 'now' } })
      .then(r => res.write(`data: ${JSON.stringify({ type: 'timeseries_snapshot', buckets: (r.data.buckets || []).map(b => ({ time: b.key_as_string || b.key, count: b.doc_count || 0 })) })}\n\n`))
      .catch(() => {})

    // Poll for updates
    const poll = setInterval(async () => {
      try {
        const r = await this.api.get('/aggregate', { params: { index: 'unishield360-alerts-4.x-*', field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48, start_date: 'now-24h', end_date: 'now' } })
        const buckets = (r.data.buckets || []).map(b => ({ time: b.key_as_string || b.key, count: b.doc_count || 0 }))
        res.write(`data: ${JSON.stringify({ type: 'timeseries_update', buckets, timestamp: new Date().toISOString() })}\n\n`)
      } catch {}
    }, 60000)

    req.on('close', () => {
      this.clients.timeseries.delete(res)
      clearInterval(keepalive)
      clearInterval(poll)
    })
  }

  handleDashboard(req, res, dashId) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    res.write(`data: ${JSON.stringify({ type: 'connected', channel: 'dashboard', dashboardId: dashId })}\n\n`)

    const keepalive = setInterval(() => res.write(':keepalive\n\n'), 15000)

    // Send initial dashboard data
    try {
      const dashboards = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'dashboards.json'), 'utf8'))
      const dashboard = dashboards.find(d => d.id === dashId) || {}
      res.write(`data: ${JSON.stringify({ type: 'dashboard_snapshot', dashboardId: dashId, panels: dashboard.panels || [] })}\n\n`)
    } catch {}

    req.on('close', () => { clearInterval(keepalive) })
  }

  broadcast(channel, data) {
    const clients = channel === 'timeseries' ? this.clients.timeseries : channel.startsWith('dashboard') ? (this.clients.dashboard.get(channel.split(':')[1]) || new Set()) : this.clients.alerts
    for (const c of clients) {
      try { c.write(`data: ${JSON.stringify(data)}\n\n`) } catch {}
    }
  }

  stop() {
    for (const t of Object.values(this.keepaliveTimers)) clearInterval(t)
    for (const c of this.clients.alerts) c.end()
    for (const c of this.clients.timeseries) c.end()
    for (const [, clients] of this.clients.dashboard) for (const c of clients) c.end()
  }
}

module.exports = SSEService
