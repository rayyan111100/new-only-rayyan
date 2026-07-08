const STORAGE_KEY = 'unishield_alerts'

let ws = null
let listeners = []

function getAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

function saveAll(alerts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
}

export const alertService = {
  list(filters = {}) {
    let alerts = getAll().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    if (filters.severity) alerts = alerts.filter(a => a.severity === filters.severity)
    if (filters.status) alerts = alerts.filter(a => a.status === filters.status)
    if (filters.source) alerts = alerts.filter(a => a.source === filters.source)
    if (filters.search) {
      const q = filters.search.toLowerCase()
      alerts = alerts.filter(a =>
        a.title?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.source?.toLowerCase().includes(q) ||
        a.ruleId?.toLowerCase().includes(q)
      )
    }
    if (filters.timeRange) {
      const cutoff = new Date()
      if (filters.timeRange === '1h') cutoff.setHours(cutoff.getHours() - 1)
      else if (filters.timeRange === '24h') cutoff.setDate(cutoff.getDate() - 1)
      else if (filters.timeRange === '7d') cutoff.setDate(cutoff.getDate() - 7)
      else if (filters.timeRange === '30d') cutoff.setDate(cutoff.getDate() - 30)
      alerts = alerts.filter(a => new Date(a.timestamp) >= cutoff)
    }
    return alerts
  },

  get(id) {
    return getAll().find(a => a.id === id) || null
  },

  add(alert) {
    const alerts = getAll()
    alerts.unshift({
      id: 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      timestamp: new Date().toISOString(),
      status: 'new',
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
      ...alert,
    })
    saveAll(alerts)
    listeners.forEach(l => l(alerts[0]))
    return alerts[0]
  },

  acknowledge(id, userId) {
    const alerts = getAll()
    const a = alerts.find(x => x.id === id)
    if (a) {
      a.status = 'acknowledged'
      a.acknowledged = true
      a.acknowledgedBy = userId || 'unknown'
      a.acknowledgedAt = new Date().toISOString()
      saveAll(alerts)
    }
    return a
  },

  resolve(id, note) {
    const alerts = getAll()
    const a = alerts.find(x => x.id === id)
    if (a) {
      a.status = 'resolved'
      a.resolvedAt = new Date().toISOString()
      a.resolutionNote = note || ''
      saveAll(alerts)
    }
    return a
  },

  suppress(id, duration = 3600000) {
    const alerts = getAll()
    const a = alerts.find(x => x.id === id)
    if (a) {
      a.status = 'suppressed'
      a.suppressedUntil = new Date(Date.now() + duration).toISOString()
      saveAll(alerts)
    }
    return a
  },

  delete(id) {
    saveAll(getAll().filter(a => a.id !== id))
  },

  clearAll() {
    saveAll([])
  },

  getStats() {
    const alerts = getAll()
    return {
      total: alerts.length,
      new: alerts.filter(a => a.status === 'new').length,
      acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
      resolved: alerts.filter(a => a.status === 'resolved').length,
      suppressed: alerts.filter(a => a.status === 'suppressed').length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length,
    }
  },

  connectWebSocket(url) {
    if (ws) ws.close()
    try {
      ws = new WebSocket(url || `ws://${window.location.hostname}:3000`)
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'alert' || data.type === 'match') {
            const alert = alertService.add({
              title: data.title || data.rule?.description || 'Alert',
              description: data.full_log || data.description || '',
              severity: data.rule?.level >= 15 ? 'critical' : data.rule?.level >= 12 ? 'high' : data.rule?.level >= 7 ? 'medium' : 'low',
              level: data.rule?.level || 0,
              source: data.decoder?.name || data.location || 'unknown',
              ruleId: String(data.rule?.id || ''),
              agentName: data.agent?.name || '',
              agentId: data.agent?.id || '',
              data: data,
            })
            listeners.forEach(l => l(alert))
          }
        } catch {}
      }
      ws.onclose = () => { ws = null }
    } catch {}
  },

  disconnectWebSocket() {
    if (ws) { ws.close(); ws = null }
  },

  subscribe(listener) {
    listeners.push(listener)
    return () => { listeners = listeners.filter(l => l !== listener) }
  },
}
