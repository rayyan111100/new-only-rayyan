const WebSocket = require('ws')

class RealtimeEngine {
  constructor(httpServer, api, db, ruleEngine, decoderEngine) {
    this.wss = new WebSocket.Server({ server: httpServer, path: '/ws' })
    this.api = api
    this.db = db
    this.re = ruleEngine
    this.de = decoderEngine
    this.pollTimer = null
    this.lastTimestamp = null
    this.lastOffset = 0
    this.freqTracker = {}
    this.suppTracker = {}
    this.cleanupTimer = null
    this.pollFailCount = 0
    this.alertCount = 0
    this.matchCount = 0
    this.clients = new Set()

    this.setupWebSocket()
    console.log('✔ WebSocket server ready at /ws')
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws)
      ws.send(JSON.stringify({
        type: 'status',
        message: 'Connected to realtime engine',
        alertCount: this.alertCount,
        matchCount: this.matchCount,
        clients: this.clients.size
      }))
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw)
          if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
          if (msg.type === 'subscribe' && msg.index) {
            ws.index = msg.index
            ws.send(JSON.stringify({ type: 'subscribed', index: msg.index }))
          }
        } catch {}
      })
      ws.on('close', () => this.clients.delete(ws))
    })
  }

  broadcast(data) {
    const msg = JSON.stringify(data)
    for (const c of this.clients) {
      if (c.readyState === WebSocket.OPEN) c.send(msg)
    }
  }

  startPolling(intervalMs = 10000, index = 'unishield360-alerts-4.x-*') {
    if (this.pollTimer) return
    this.lastTimestamp = new Date().toISOString()

    this.pollTimer = setInterval(async () => {
      try {
        const startDate = this.lastTimestamp
        const params = { index, limit: 50, sort: '@timestamp', order: 'desc', start_date: startDate, end_date: new Date().toISOString() }
        const res = await this.api.get('/search', { params })
        const results = res.data.results || []
        if (!results.length) { this.pollFailCount = 0; return }
        this.pollFailCount = 0

        // Track newest timestamp + offset for duplicate prevention
        const newestDoc = results[0]
        const newestTs = newestDoc['@timestamp'] || newestDoc.timestamp
        if (newestTs && newestTs > this.lastTimestamp) {
          this.lastTimestamp = newestTs
          this.lastOffset = 0
        } else if (newestTs === this.lastTimestamp) {
          this.lastOffset++
        }

        const rules = this.db.getAllRules().filter(r => r.enabled)
        if (!rules.length) return

        for (const doc of results) {
          const docTs = doc['@timestamp'] || doc.timestamp
          if (docTs === this.lastTimestamp && this.lastOffset > 0) continue // skip exact duplicates

          this.alertCount++
          const fullLog = doc.full_log || ''
          const decoded = this.de.decodeLog(fullLog)
          const enriched = { ...doc, decoded: decoded.fields, decoded_format: decoded.format }

          // Broadcast every new alert as real-time data (with full doc)
          this.broadcast({
            type: 'alert',
            id: this.alertCount,
            timestamp: new Date().toISOString(),
            alertTimestamp: docTs,
            doc: enriched
          })

          const evalResult = this.re.evaluateAllRules(rules, enriched)
          if (evalResult.matched) {
            if (this.passesThresholds(rules, evalResult, enriched)) {
              this.matchCount++
              this.broadcast({
                type: 'match',
                id: this.matchCount,
                timestamp: new Date().toISOString(),
                alertTimestamp: docTs,
                agent: enriched.agent?.name || 'unknown',
                rule: enriched.rule?.id || '-',
                decoded_format: decoded.format,
                doc: enriched,
                matches: evalResult.matches.map(m => ({
                  ruleId: m.rule.id,
                  ruleName: m.rule.name,
                  severity: m.actions?.[0]?.params?.severity || 'info',
                  overwrite: m.rule.overwrite !== false
                }))
              })
            }
          }
        }

        // Periodic cleanup of stale tracker entries (every 100 polls)
        if (this.alertCount % 100 === 0) this.cleanupTrackers()

      } catch (e) {
        this.pollFailCount++
        if (this.pollFailCount === 1 || this.pollFailCount % 10 === 0) {
          console.error(`✖ Realtime poll error (${this.pollFailCount}):`, e.message)
        }
      }
    }, intervalMs)
  }

  stop() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
    if (this.cleanupTimer) { clearInterval(this.cleanupTimer); this.cleanupTimer = null }
    this.wss.close()
  }

  passesThresholds(rules, evalResult, doc) {
    for (const match of evalResult.matches) {
      const rule = match.rule

      // Suppression: ignore if exceeded max matches per source
      if (rule.suppression && rule.suppressionMax > 0) {
        const srcField = rule.suppressionField || 'agent.name'
        const srcVal = this.re.resolveField(doc, srcField)
        const key = `${rule.id}|${srcVal}`
        this.suppTracker[key] = (this.suppTracker[key] || 0) + 1
        if (this.suppTracker[key] > rule.suppressionMax) return false
      }

      // Frequency: N events in timeframe window
      if (rule.frequency > 0 && rule.timeframe > 0) {
        const srcField = rule.suppressionField || 'agent.name'
        const srcVal = this.re.resolveField(doc, srcField)
        const key = `${rule.id}|${srcVal}`
        const now = Date.now()
        const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[rule.timeframeUnit || 'm'] || 60000
        const windowMs = rule.timeframe * unitMs

        if (!this.freqTracker[key]) this.freqTracker[key] = []
        const window = this.freqTracker[key]
        window.push(now)
        while (window.length && window[0] < now - windowMs) window.shift()
        if (window.length > rule.frequency) return false
      }
    }
    return true
  }

  cleanupTrackers() {
    const now = Date.now()
    // Clean freqTracker: remove entries with empty/expired windows
    for (const key of Object.keys(this.freqTracker)) {
      const window = this.freqTracker[key]
      while (window.length && window[0] < now - 86400000) window.shift() // remove entries older than 24h
      if (window.length === 0) delete this.freqTracker[key]
    }
    // Clean suppTracker: decrement or remove stale entries
    for (const key of Object.keys(this.suppTracker)) {
      this.suppTracker[key] = Math.max(0, this.suppTracker[key] - 1)
      if (this.suppTracker[key] === 0) delete this.suppTracker[key]
    }
  }

  getStats() {
    return {
      alertCount: this.alertCount, matchCount: this.matchCount,
      clients: this.clients.size,
      pollFailCount: this.pollFailCount,
      freqTrackers: Object.keys(this.freqTracker).length,
      suppTrackers: Object.keys(this.suppTracker).length
    }
  }
}

module.exports = RealtimeEngine
