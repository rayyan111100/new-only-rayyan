const express = require('express')
const router = express.Router()
const qs = require('./dataQueryService.cjs')
const client = require('./openSearchClient.cjs')

function asyncWrap(fn) {
  return (req, res, next) => fn(req, res, next).catch(next)
}

// Helper: extract common query params
function extractParams(req) {
  return {
    index: req.query.index,
    q: req.query.q,
    field: req.query.field,
    start_date: req.query.start_date,
    end_date: req.query.end_date,
    limit: req.query.limit ? parseInt(req.query.limit) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset) : undefined,
    sort: req.query.sort,
    order: req.query.order,
    interval: req.query.interval,
  }
}

// ── Query Routes ──

router.get('/count', asyncWrap(async (req, res) => {
  const result = await qs.count(extractParams(req))
  res.json(result)
}))

router.get('/time-series', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.timeSeries(p)
  res.json(result)
}))

router.get('/average', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.average(p)
  res.json(result)
}))

router.get('/max', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.max(p)
  res.json(result)
}))

router.get('/min', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.min(p)
  res.json(result)
}))

router.get('/sum', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.sum(p)
  res.json(result)
}))

router.get('/terms', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  p.size = req.query.size ? parseInt(req.query.size) : 10
  const result = await qs.terms(p)
  res.json(result)
}))

router.get('/histogram', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  p.interval = req.query.interval ? parseFloat(req.query.interval) : 10
  const result = await qs.histogram(p)
  res.json(result)
}))

router.get('/range', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  let ranges = []
  try { ranges = req.query.ranges ? JSON.parse(req.query.ranges) : [] } catch {}
  p.ranges = ranges
  const result = await qs.rangeAgg(p)
  res.json(result)
}))

router.get('/geohash', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  p.precision = req.query.precision ? parseInt(req.query.precision) : 3
  const result = await qs.geohash(p)
  res.json(result)
}))

router.get('/filters', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  let filters = {}
  try { filters = req.query.filters ? JSON.parse(req.query.filters) : {} } catch {}
  p.filters = filters
  const result = await qs.filtersAgg(p)
  res.json(result)
}))

router.get('/cumulative-sum', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.cumulativeSum(p)
  res.json(result)
}))

router.get('/derivative', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.derivative(p)
  res.json(result)
}))

router.get('/moving-average', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  p.window = req.query.window ? parseInt(req.query.window) : 5
  const result = await qs.movingAverage(p)
  res.json(result)
}))

router.get('/heat-map', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.heatMap(p)
  res.json(result)
}))

router.get('/pie', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  p.size = req.query.size ? parseInt(req.query.size) : 10
  const result = await qs.pie(p)
  res.json(result)
}))

router.get('/metric', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.metric(p)
  res.json(result)
}))

router.get('/data-table', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  p.fields = req.query.fields ? req.query.fields.split(',') : undefined
  const result = await qs.dataTable(p)
  res.json(result)
}))

router.get('/kql-filter', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.kqlFilter(p)
  res.json(result)
}))

router.get('/realtime-alerts', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  p.since = req.query.since
  const result = await qs.realTimeAlerts(p)
  res.json(result)
}))

router.get('/dynamic-builder', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  p.aggregationType = req.query.aggregationType || 'terms'
  const result = await qs.dynamicBuilder(p)
  res.json(result)
}))

router.get('/percentile', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  let percents = [50, 95, 99]
  try { percents = req.query.percents ? req.query.percents.split(',').map(Number) : [50, 95, 99] } catch {}
  p.percents = percents
  const result = await qs.percentile(p)
  res.json(result)
}))

router.get('/cardinality', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.cardinality(p)
  res.json(result)
}))

router.get('/geo-query', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.geo(p)
  res.json(result)
}))

router.get('/dashboard', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.dashboard(p)
  res.json(result)
}))

// ── Generic proxy for all visualization queries ──
router.get('/viz/:type', asyncWrap(async (req, res) => {
  const type = req.params.type
  const p = extractParams(req)

  const typeMap = {
    'area': 'timeSeries',
    'line': 'timeSeries',
    'bar': 'terms',
    'column': 'terms',
    'pie': 'pie',
    'heatmap': 'heatMap',
    'metric': 'metric',
    'table': 'dataTable',
    'gauge': 'metric',
    'goal': 'metric',
    'timeline': 'timeSeries',
    'tsvb': 'timeSeries',
  }

  const method = typeMap[type]
  if (!method) {
    return res.status(400).json({ error: `Unknown viz type: ${type}. Supported: ${Object.keys(typeMap).join(', ')}` })
  }

  const result = await qs[method](p)
  res.json(result)
}))

// ── Search endpoint ──
router.get('/search', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.dataTable(p)
  res.json(result)
}))

// ── Aggregation proxy (backward compat) ──
router.get('/aggregate', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const type = req.query.type || 'terms'
  let result
  switch (type) {
    case 'date_histogram': result = await qs.timeSeries(p); break
    case 'terms': result = await qs.terms(p); break
    case 'avg': result = await qs.average(p); break
    case 'min': result = await qs.min(p); break
    case 'max': result = await qs.max(p); break
    case 'sum': result = await qs.sum(p); break
    case 'stats': result = await qs.metric(p); break
    case 'percentiles': result = await qs.percentile(p); break
    case 'cardinality': result = await qs.cardinality(p); break
    default: result = await qs.terms(p)
  }
  res.json(result)
}))

// ── Fields endpoint ──
router.get('/fields', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await client.query('GET', 'fields', { index: p.index })
  res.json(result)
}))

// ── Health ──
router.get('/health', asyncWrap(async (req, res) => {
  const result = await client.query('GET', 'health')
  res.json(result)
}))

// ── Indices ──
router.get('/indices', asyncWrap(async (req, res) => {
  const result = await client.query('GET', 'indices', { index: req.query.index })
  res.json(result)
}))

// ── Index stats ──
router.get('/index-stats', asyncWrap(async (req, res) => {
  const result = await client.query('GET', 'index-stats', { index: req.query.index })
  res.json(result)
}))

// ── Geo data ──
router.get('/geo-data', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.geo(p)
  res.json(result)
}))

// ── MITRE ATT&CK Stats ──
router.get('/mitre-stats', asyncWrap(async (req, res) => {
  const p = extractParams(req)
  const result = await qs.mitreStats(p)
  res.json(result)
}))

module.exports = router
