const WebSocket = require('ws')

class RealtimeManager {
  constructor(httpServer, api, db, ruleEngine, decoderEngine) {
    this.api = api
    this.db = db
    this.re = ruleEngine
    this.de = decoderEngine
    this.wss = new WebSocket.Server({ server: httpServer, path: '/ws' })
    this.channels = { alerts: new Set(), timeseries: new Set(), dashboard: new Map() }
    this.sseClients = { alerts: new Set(), timeseries: new Set(), dashboard: new Map() }
    this.pollTimers = {}
    this.lastData = { alerts: null, timeseries: null, dashboard: {} }
    this.pollFailCount = 0
    this.alertCount = 0
    this.matchCount = 0
    this.debounceTimers = {}

    this.setupWebSocket()
    this.startPolling()
    console.log('✔ RealtimeManager: WebSocket + SSE ready')
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      const url = req.url || '/ws'
      const channel = url.includes('/ws/alerts') ? '/ws/alerts'
        : url.includes('/ws/timeseries') ? '/ws/timeseries'
        : url.includes('/ws/dashboard') ? '/ws/dashboard'
        : '/ws'

      if (channel === '/ws/dashboard') {
        const dashId = url.split('/ws/dashboard/')[1] || 'default'
        if (!this.channels.dashboard.has(dashId)) this.channels.dashboard.set(dashId, new Set())
        this.channels.dashboard.get(dashId).add(ws)
        ws.dashId = dashId
        this.sendSnapshot(ws, 'dashboard', { dashboardId: dashId })
      } else if (channel === '/ws/timeseries') {
        this.channels.timeseries.add(ws)
        this.sendSnapshot(ws, 'timeseries')
      } else {
        this.channels.alerts.add(ws)
        this.sendSnapshot(ws, 'alerts')
      }

      ws.send(JSON.stringify({ type: 'status', channel, message: 'Connected', alertCount: this.alertCount, clients: this.wss.clients.size }))

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw)
          if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
          if (msg.type === 'subscribe' && msg.channel) {
            ws.send(JSON.stringify({ type: 'subscribed', channel: msg.channel }))
          }
          if (msg.type === 'filter' && msg.filters) {
            ws.filters = msg.filters
          }
        } catch {}
      })

      ws.on('close', () => {
        this.channels.alerts.delete(ws)
        this.channels.timeseries.delete(ws)
        if (ws.dashId && this.channels.dashboard.has(ws.dashId)) {
          this.channels.dashboard.get(ws.dashId).delete(ws)
        }
      })
    })
  }

  async sendSnapshot(ws, type, extra = {}) {
    try {
      let data
      switch (type) {
        case 'alerts': {
          const res = await this.api.get('/search', { params: { index: 'unishield360-alerts-4.x-*', limit: 50, sort: '@timestamp', order: 'desc', start_date: 'now-24h', end_date: 'now' } })
          data = { type: 'alerts_snapshot', total: res.data.total || 0, alerts: (res.data.results || []).slice(0, 20) }
          break
        }
        case 'timeseries': {
          const res = await this.api.get('/aggregate', { params: { index: 'unishield360-alerts-4.x-*', field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48, start_date: 'now-24h', end_date: 'now' } })
          data = { type: 'timeseries_snapshot', buckets: (res.data.buckets || []).map(b => ({ time: b.key_as_string || b.key, count: b.doc_count || 0 })) }
          break
        }
        case 'dashboard': {
          const dashId = extra.dashboardId || 'default'
          const dashboards = JSON.parse(localStorage.getItem('unishield_dashboards') || '[]')
          const dashboard = dashboards.find(d => d.id === dashId) || {}
          data = { type: 'dashboard_snapshot', dashboardId: dashId, panels: dashboard.panels || [] }
          break
        }
      }
      if (data && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data))
    } catch {}
  }

  broadcast(channel, data, dashId) {
    const msg = JSON.stringify(data)
    let clients
    if (channel === 'dashboard' && dashId) {
      clients = this.channels.dashboard.get(dashId)
    } else if (channel === 'timeseries') {
      clients = this.channels.timeseries
    } else {
      clients = this.channels.alerts
    }
    if (clients) {
      for (const c of clients) {
        if (c.readyState === WebSocket.OPEN) c.send(msg)
      }
    }
  }

  startPolling(intervalMs = 10000) {
    // Alert polling
    this.pollTimers.alerts = setInterval(async () => {
      try {
        const res = await this.api.get('/search', { params: { index: 'unishield360-alerts-4.x-*', limit: 10, sort: '@timestamp', order: 'desc', start_date: 'now-1m', end_date: 'now' } })
        const results = res.data.results || []
        if (!results.length) { this.pollFailCount = 0; return }
        this.pollFailCount = 0

        for (const doc of results.slice(0, 5)) {
          this.alertCount++
          const fullLog = doc.full_log || ''
          const decoded = this.de ? this.de.decodeLog(fullLog) : { fields: {}, format: 'unknown' }
          const enriched = { ...doc, decoded: decoded.fields, decoded_format: decoded.format }

          const rules = this.db ? this.db.getAllRules().filter(r => r.enabled) : []
          const evalResult = rules.length && this.re ? this.re.evaluateAllRules(rules, enriched) : { matched: false, matches: [] }

          const payload = {
            type: 'alert',
            id: this.alertCount,
            timestamp: new Date().toISOString(),
            alertTimestamp: doc['@timestamp'] || doc.timestamp,
            title: doc.rule?.description || 'Alert',
            level: doc.rule?.level || 0,
            severity: doc.rule?.level >= 12 ? 'critical' : doc.rule?.level >= 8 ? 'high' : doc.rule?.level >= 5 ? 'medium' : 'low',
            agent: doc.agent?.name || 'unknown',
            agentId: doc.agent?.id || '',
            source: doc.decoder?.name || doc.location || '',
            ruleId: doc.rule?.id || '',
            description: doc.full_log || '',
            decoded: decoded.fields,
            matched: evalResult.matched,
            matches: evalResult.matches?.slice(0, 3).map(m => ({ ruleId: m.rule?.id, ruleName: m.rule?.name, severity: m.actions?.[0]?.params?.severity })) || [],
          }
          this.broadcast('alerts', payload)
        }

        this.lastData.alerts = { count: this.alertCount, lastTs: new Date().toISOString() }
      } catch (e) {
        this.pollFailCount++
        if (this.pollFailCount === 1 || this.pollFailCount % 10 === 0) console.error('✖ Alert poll error:', e.message)
      }
    }, intervalMs)

    // Timeseries polling (less frequent)
    this.pollTimers.timeseries = setInterval(async () => {
      try {
        const res = await this.api.get('/aggregate', { params: { index: 'unishield360-alerts-4.x-*', field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48, start_date: 'now-24h', end_date: 'now' } })
        const buckets = (res.data.buckets || []).map(b => ({ time: b.key_as_string || b.key, count: b.doc_count || 0 }))
        this.broadcast('timeseries', { type: 'timeseries_update', buckets, timestamp: new Date().toISOString() })
        this.lastData.timeseries = buckets
      } catch {}
    }, intervalMs * 6)

    console.log(`✔ Realtime polling started (${intervalMs}ms alerts, ${intervalMs * 6}ms timeseries)`)
  }

  stop() {
    for (const t of Object.values(this.pollTimers)) clearInterval(t)
    this.wss.close()
  }

  getStats() {
    return {
      alertCount: this.alertCount,
      matchCount: this.matchCount,
      wsClients: this.wss?.clients?.size || 0,
      channels: {
        alerts: this.channels.alerts.size,
        timeseries: this.channels.timeseries.size,
        dashboard: [...this.channels.dashboard.entries()].map(([id, s]) => ({ id, clients: s.size })),
      },
      pollFailCount: this.pollFailCount,
      lastData: this.lastData,
    }
  }
}

module.exports = RealtimeManager
