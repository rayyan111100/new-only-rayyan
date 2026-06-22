const express = require('express')
const router = express.Router()
const axios = require('axios')

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') })
const API_URL = process.env.UNISHIELD360_API_URL || 'http://192.168.1.77:9999'

function authHeaders(req) {
  const token = req.headers.authorization || req.query.token || ''
  if (token) return { Authorization: token, 'Content-Type': 'application/json' }
  return {}
}

function mapIndex(idx) {
  return idx ? String(idx).replace(/^unishield360-/i, 'wazuh-') : 'wazuh-alerts-4.x-*'
}

function unmapIndex(idx) {
  return idx ? String(idx).replace(/^wazuh-/i, 'unishield360-') : idx
}

// GET /api/realtime/alerts — latest alerts with pagination
router.get('/alerts', async (req, res) => {
  try {
    const { index, q, limit = 50, offset = 0, sort = '@timestamp', order = 'desc', start_date = 'now-24h', end_date = 'now', since } = req.query
    const params = {
      index: mapIndex(index),
      q: q || undefined,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort,
      order,
      start_date: since || start_date,
      end_date,
    }
    const { data } = await axios.get(`${API_URL}/search`, { params, headers: authHeaders(req), timeout: 30000 })
    const results = (data.results || []).map(doc => ({
      id: doc._id || doc.id,
      timestamp: doc['@timestamp'] || doc.timestamp,
      title: doc.rule?.description || 'Alert',
      level: doc.rule?.level || 0,
      severity: doc.rule?.level >= 12 ? 'critical' : doc.rule?.level >= 8 ? 'high' : doc.rule?.level >= 5 ? 'medium' : 'low',
      agent: doc.agent?.name || 'unknown',
      agentId: doc.agent?.id || '',
      source: doc.decoder?.name || doc.location || '',
      ruleId: doc.rule?.id || '',
      ruleGroups: doc.rule?.groups || [],
      description: (doc.full_log || '').substring(0, 500),
      location: doc.location || '',
      _index: unmapIndex(doc._index || ''),
    }))
    res.json({ total: data.total || 0, results, offset: parseInt(offset), limit: parseInt(limit) })
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.response?.data?.message || e.message })
  }
})

// POST /api/realtime/dynamic — dynamic query endpoint
router.post('/dynamic', async (req, res) => {
  try {
    const { index, q, aggregationType, field, interval, limit, start_date, end_date, filters } = req.body
    const idx = mapIndex(index)

    if (aggregationType) {
      const validTypes = ['terms', 'date_histogram', 'histogram', 'avg', 'min', 'max', 'sum', 'stats', 'percentiles', 'cardinality']
      const type = validTypes.includes(aggregationType) ? aggregationType : 'terms'
      const params = {
        index: idx,
        field: field || 'rule.level',
        type,
        interval: type === 'date_histogram' ? (interval || '1h') : undefined,
        limit: limit || 10,
        q: q || undefined,
        start_date: start_date || 'now-24h',
        end_date: end_date || 'now',
      }
      const { data } = await axios.get(`${API_URL}/aggregate`, { params, headers: authHeaders(req), timeout: 30000 })
      return res.json({
        success: true,
        aggregationType: type,
        field: field || 'rule.level',
        buckets: (data.buckets || []).map(b => ({
          key: b.key,
          key_as_string: b.key_as_string,
          count: b.doc_count || 0,
          ...(b.value !== undefined ? { value: b.value } : {}),
        })),
        total: data.count || data.total || 0,
      })
    }

    // Fallback to search
    const params = {
      index: idx,
      q: q || undefined,
      limit: limit || 50,
      sort: '@timestamp',
      order: 'desc',
      start_date: start_date || 'now-24h',
      end_date: end_date || 'now',
    }
    const { data } = await axios.get(`${API_URL}/search`, { params, headers: authHeaders(req), timeout: 30000 })
    res.json({
      success: true,
      total: data.total || 0,
      results: (data.results || []).slice(0, limit || 50),
    })
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.response?.data?.message || e.message })
  }
})

// GET /api/realtime/stats — realtime engine stats
router.get('/stats', (req, res) => {
  try {
    const rt = req.app.get('realtime')
    const stats = rt ? rt.getStats() : { alertCount: 0, matchCount: 0, wsClients: 0, pollFailCount: 0 }
    res.json(stats)
  } catch {
    res.json({ alertCount: 0, matchCount: 0, wsClients: 0, pollFailCount: 0 })
  }
})

module.exports = router
