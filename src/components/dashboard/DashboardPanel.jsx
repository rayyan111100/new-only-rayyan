import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Plot from 'react-plotly.js'
import axios from 'axios'
import { useDashboard } from './dashboardStore'
import { useApp } from '../../context/AppContext'
import ContextMenu from './ContextMenu'
import PanelSettingsModal from './PanelSettingsModal'
import ComplianceMetricPanel from './compliance/ComplianceMetricPanel'
import ComplianceSeverityPanel from './compliance/ComplianceSeverityPanel'
import ComplianceTimelinePanel from './compliance/ComplianceTimelinePanel'
import ComplianceControlsPanel from './compliance/ComplianceControlsPanel'
import ComplianceLogPanel from './compliance/ComplianceLogPanel'
import SeverityPiePanel from './SeverityPiePanel'
import TopNPanel from './TopNPanel'
import TimelineAreaPanel from './TimelineAreaPanel'
import EventLogsPanel from './EventLogsPanel'
import FrameworkDistPanel from './FrameworkDistPanel'
import TopAgentsPanel from './TopAgentsPanel'
import TagCloudPanel from './TagCloudPanel'

const CHART_COLORS = { area: '#EF843C', bar: '#EF843C', line: '#EF843C', pie: '#EF843C', metric: '#EF843C', gauge: '#EF843C', table: '#EF843C', 'data-table': '#EF843C', heatmap: '#EF843C', 'alert-counter': '#EF843C', timeline: '#EF843C', clusterbubble: '#EF843C', kpi: '#EF843C', 'log-stream': '#EF843C', 'top-n': '#EF843C', 'agent-status': '#EF843C', markdown: '#EF843C', tagcloud: '#EF843C', 'severity-pie': '#EF843C', 'timeline-area': '#EF843C', 'event-logs': '#EF843C', 'compliance-metrics': '#EF843C', 'compliance-severity': '#EF843C', 'compliance-timeline': '#EF843C', 'compliance-controls': '#EF843C', 'compliance-logs': '#EF843C' }
const REFRESH_INTERVAL = 30000

function sanitizeQ(q, endpoint) {
  if (!q || !endpoint) return q
  if (endpoint === 'aggregate' || endpoint === 'search') {
    const clauses = q.split(' AND ').filter(c => {
      if (c.match(/\[.*?TO.*?\]/)) return false
      const stripped = c.replace(/"[^"]*"/g, '""')
      if (stripped.match(/[^\\]:(?![\w"\\])/)) return false
      return true
    })
    return clauses.length ? clauses.join(' AND ') : undefined
  }
  return q
}

function buildQ(panel, globalFilters, timeRange, filterMatch) {
  const cfg = panel.vizConfig || {}
  const q = panel.query || {}
  const index = cfg.selectedIndex || 'unishield360-alerts-4.x-*'
  const tr = timeRange || cfg.timeRange || {}
  const start = tr.from || 'now-24h'
  const end = tr.to || 'now'
  let queryStr = cfg.query || q.query || ''
  const base = { index, start_date: start, end_date: end }
  let parts = []
  if (queryStr) {
    const fixed = queryStr.replace(/>=/g, ':').replace(/<=/g, ':').replace(/>/g, ':').replace(/</g, ':').replace(/\s*:\s*/g, ':')
    if (fixed && fixed !== '*') parts.push(fixed)
  }
  if (globalFilters?.length) {
    const seenKeys = {}
    for (const f of globalFilters) {
      if (f.disabled) continue
      if (f.negate || f.exclude) continue
      // Skip range operators (is between / is not between) — API doesn't support them on aggregate/search
      if (f.operator === 'is between' || f.operator === 'is not between') continue
      let qPart = ''
      if (f.type === 'pair' && f.key) {
        if (seenKeys[f.key]) continue
        seenKeys[f.key] = true
        if (f.operator === 'exists') {
          qPart = `_exists_:${f.key}`
        } else {
          const strVal = String(f.value)
          const needsQuote = strVal.includes(' ') || strVal.includes(':') || /^\d+$/.test(strVal)
          const val = f.value ? (needsQuote ? '"' + f.value + '"' : f.value) : ''
          if (val) qPart = f.key + ':' + val
        }
      }
      if (f.type === 'text' && f.query) {
        qPart = f.query
      }
      if (qPart) parts.push(qPart)
    }
  }
  if (parts.length) {
    const joinOp = filterMatch === 'or' ? ' OR ' : ' AND '
    base.q = parts.join(joinOp)
  }
  return base
}

function getExcludeFilters(globalFilters) {
  return (globalFilters || []).filter(f => !f.disabled && (f.negate || f.exclude))
}

function getRangeIncludeFilters(globalFilters) {
  return (globalFilters || []).filter(f => !f.disabled && !f.negate && !f.exclude && f.type === 'pair' && f.operator === 'is between' && f.key && f.value && f.secondValue)
}

function addRangeToQuery(q, rangeFilters) {
  if (!rangeFilters?.length) return q
  const parts = [q].filter(Boolean)
  for (const f of rangeFilters) {
    if (f.operator === 'is between' && f.secondValue) {
      parts.push(`${f.key}:[${f.value} TO ${f.secondValue}]`)
    }
  }
  return parts.join(' AND ')
}

function applyRangeToBuckets(buckets, rangeFilters, aggField) {
  if (!rangeFilters?.length || !buckets?.length) return buckets
  let result = [...buckets]
  for (const f of rangeFilters) {
    if (f.operator === 'is between' && f.secondValue) {
      // Only filter buckets if range field matches aggregation field
      if (f.key !== aggField) continue
      const fromVal = parseFloat(f.value)
      const toVal = parseFloat(f.secondValue)
      if (!isNaN(fromVal) && !isNaN(toVal)) {
        result = result.filter(b => {
          const bKey = parseFloat(b.key)
          return !isNaN(bKey) && bKey >= fromVal && bKey <= toVal
        })
      }
    }
  }
  return result
}

function applyRangeToRows(rows, rangeFilters) {
  if (!rangeFilters?.length || !rows?.length) return rows
  let result = [...rows]
  for (const f of rangeFilters) {
    if (f.operator === 'is between' && f.secondValue && f.key) {
      const fromVal = parseFloat(f.value)
      const toVal = parseFloat(f.secondValue)
      if (!isNaN(fromVal) && !isNaN(toVal)) {
        result = result.filter(row => {
          const rowVal = parseFloat(row[f.key])
          return !isNaN(rowVal) && rowVal >= fromVal && rowVal <= toVal
        })
      }
    }
  }
  return result
}

async function applyExcludeToCount(count, excludeFilters, base) {
  if (!excludeFilters?.length || !count) return count
  let excluded = 0
  for (const f of excludeFilters) {
    if (f.type === 'pair' && f.key && f.value) {
      const strVal = String(f.value)
      const needsQuote = strVal.includes(' ') || strVal.includes(':') || /^\d+$/.test(strVal)
      let val = needsQuote ? '"' + f.value + '"' : f.value
      // Handle range operator for exclude
      if (f.operator === 'is between' && f.secondValue) {
        val = '[' + f.value + ' TO ' + f.secondValue + ']'
      }
      const q = [base.q, f.key + ':' + val].filter(Boolean).join(' AND ')
      try {
        const { data } = await axios.get('/api/count', { params: { ...base, q }, timeout: 10000 })
        excluded += data?.count ?? 0
      } catch (e) { /* skip */ }
    }
  }
  return Math.max(0, count - excluded)
}

function applyExcludeToBuckets(buckets, excludeFilters) {
  if (!excludeFilters?.length || !buckets?.length) return buckets
  let result = [...buckets]
  for (const f of excludeFilters) {
    if (f.type === 'pair' && f.key && f.value) {
      if (f.operator === 'is between' && f.secondValue) {
        const fromVal = parseFloat(f.value)
        const toVal = parseFloat(f.secondValue)
        if (!isNaN(fromVal) && !isNaN(toVal)) {
          result = result.filter(b => {
            const bKey = parseFloat(b.key)
            return isNaN(bKey) || bKey < fromVal || bKey > toVal
          })
        }
      } else {
        result = result.filter(b => String(b.key) !== String(f.value))
      }
    }
  }
  return result
}

function applyExcludeToRows(rows, excludeFilters, companionArr) {
  if (!excludeFilters?.length || !rows?.length) return companionArr ? rows : rows
  let result = [...rows]
  let companion = companionArr ? [...companionArr] : null
  for (const f of excludeFilters) {
    if (f.type === 'pair' && f.key && f.value) {
      const key = f.key
      const newResult = []
      const newCompanion = companion ? [] : null
      for (let i = 0; i < result.length; i++) {
        const rowVal = result[i][key] ?? result[i][key.split('.').pop()]
        if (String(rowVal ?? '') !== String(f.value)) {
          newResult.push(result[i])
          if (newCompanion) newCompanion.push(companion[i])
        }
      }
      result = newResult
      if (newCompanion) companion = newCompanion
    }
  }
  return companion ? { rows: result, companion } : result
}

async function fetchPanelData(panel, globalFilters, page = 0, perPage = 10, timeRange, filterMatch) {
  const panelType = panel.type || panel.vizType || ''
  const q = panel.query || {}
  const cfg = panel.vizConfig || {}
  const base = buildQ(panel, globalFilters, timeRange, filterMatch)
  const rangeFilters = getRangeIncludeFilters(globalFilters)

  // EPS / Ingestion unified data source
  if (panel.dataSource === 'eps-stats' || q.dataSource === 'eps-stats') {
    const { data } = await axios.get('/api/eps-stats', { params: { index: base.index, q: base.q, start_date: base.start_date, end_date: base.end_date }, timeout: 30000 })
    if (!data?.success) return { type: 'error', data: null, error: 'Failed to fetch EPS stats' }

    if (panelType === 'metric' && cfg.metricKey === 'eps60') return { type: 'metric', data: data.eps['60s'], raw: data.eps }
    if (panelType === 'metric' && cfg.metricKey === 'eps5m') return { type: 'metric', data: data.eps['5m'], raw: data.eps }
    if (panelType === 'metric' && cfg.metricKey === 'totalIngestGB') return { type: 'metric', data: data.ingestion.total_size_gb, raw: data.ingestion, suffix: 'GB' }
    if (panelType === 'metric' && cfg.metricKey === 'todayIngestMB') {
      const today = data.ingestion.daily_sizes?.slice(-1)?.[0]
      const mb = today ? +(today.size_bytes / 1048576).toFixed(1) : 0
      return { type: 'metric', data: mb, raw: today, suffix: 'MB' }
    }
    if (panelType === 'metric' && cfg.metricKey === 'minIngestRate') return { type: 'metric', data: data.ingestion.min_rate || 0, raw: data.ingestion, suffix: 'KB/s' }
    if (panelType === 'metric' && cfg.metricKey === 'maxIngestRate') return { type: 'metric', data: data.ingestion.max_rate || 0, raw: data.ingestion, suffix: 'KB/s' }

    if (panelType === 'table' && cfg.tableKey === 'epsPerAsset') {
      const flat = (data.per_asset || []).map((a, i) => ({
        '#': i + 1, agent: a.agent, count: a.doc_count?.toLocaleString(), eps: a.eps?.toFixed(1),
        ingest: a.estimated_size_bytes > 1048576 ? (a.estimated_size_bytes / 1048576).toFixed(1) + ' MB' : (a.estimated_size_bytes / 1024).toFixed(1) + ' KB',
        lastEvent: a.last_event ? new Date(a.last_event).toLocaleTimeString() : '-', status: a.status,
      }))
      return { type: 'table', data: flat, raw: flat.length }
    }

    if (panelType === 'table' && cfg.tableKey === 'logStop') {
      const flat = (data.log_stop || []).map((a, i) => ({
        '#': i + 1, agent: a.agent, count: a.doc_count?.toLocaleString(),
        lastEvent: a.last_event ? new Date(a.last_event).toLocaleString() : '>5m ago', status: '⚠ STOPPED',
      }))
      return { type: 'table', data: flat, raw: flat.length }
    }

    if (panelType === 'area' && cfg.chartKey === 'eventRate') {
      return { type: 'chart', chartType: 'area', data: (data.event_rate || []).map(b => ({ x: b.time, y: b.count })), raw: data.event_rate }
    }
    if (panelType === 'area' && cfg.chartKey === 'ingestionTrend') {
      return { type: 'chart', chartType: 'area', data: (data.ingestion.daily_sizes || []).map(d => ({ x: d.date, y: +(d.size_bytes / 1048576).toFixed(1) })), raw: data.ingestion.daily_sizes, yLabel: 'MB' }
    }
    if (panelType === 'line' && cfg.chartKey === 'epsTrend') {
      return { type: 'chart', chartType: 'line', data: (data.eps_trend || []).map(b => ({ x: b.time, y: b.eps })), raw: data.eps_trend, yLabel: 'eps' }
    }
    if (panelType === 'bar' && cfg.chartKey === 'ingestPerAsset') {
      return { type: 'chart', chartType: 'bar', data: (data.per_asset || []).slice(0, 10).map(a => ({ x: a.agent, y: +(a.estimated_size_bytes / 1048576).toFixed(1) })), raw: data.per_asset, yLabel: 'MB' }
    }
    if (panelType === 'bar' && cfg.chartKey === 'topNodesEps') {
      return { type: 'chart', chartType: 'bar', data: (data.per_asset || []).slice(0, 10).map(a => ({ x: a.agent, y: a.eps })), raw: data.per_asset, yLabel: 'eps' }
    }
    if (cfg.chartKey === 'combinedTrend') {
      const eventData = (data.event_rate || []).map(b => ({ x: b.time, y: b.count }))
      const epsData = (data.eps_trend || []).map(b => ({ x: b.time, y: b.eps }))
      return { type: 'combined', chartType: 'combined', eventData, epsData, raw: data }
    }
    return { type: 'metric', data: 0, raw: data }
  }

  if (q.aggregation?.type === 'eps') {
    const epsWindow = q.aggregation?.interval || '60s'
    const epsBase = { ...base, start_date: 'now-' + epsWindow, end_date: 'now', q: addRangeToQuery(base.q, rangeFilters) }
    const { data } = await axios.get('/api/count', { params: epsBase, timeout: 15000 })
    const count = data?.count ?? data ?? 0
    const seconds = parseInt(epsWindow) || 60
    const eps = count / seconds
    return { type: 'metric', data: Math.round(eps * 100) / 100, raw: { count, eps, seconds } }
  }

  if (panelType === 'metric' || panelType === 'gauge' || panelType === 'kpi' || panelType === 'alert-counter' || q.aggregation?.type === 'count') {
    const excludeFilters = getExcludeFilters(globalFilters)
    const metricKey = cfg.metricKey || 'totalEvents'

    // Total Agents: count unique agent.name buckets
    if (metricKey === 'totalAgents') {
      const aggQ = sanitizeQ(base.q, 'aggregate')
      const { data } = await axios.get('/api/aggregate', { params: { ...base, q: aggQ, field: 'agent.name', type: 'terms', limit: 10000 }, timeout: 15000 })
      let buckets = applyRangeToBuckets(data?.buckets || [], rangeFilters, 'agent.name')
      buckets = applyExcludeToBuckets(buckets, excludeFilters)
      return { type: 'metric', data: buckets?.length || 0, raw: buckets?.length || 0, suffix: 'agents' }
    }

    // Severity counts via range queries on /count
    const SEV_RANGES = { critical: '[15 TO *]', high: '[12 TO 14]', medium: '[7 TO 11]', low: '[0 TO 6]' }
    if (SEV_RANGES[metricKey]) {
      const baseQuery = addRangeToQuery(base.q, rangeFilters)
      const rangeQ = baseQuery ? baseQuery + ` AND rule.level:${SEV_RANGES[metricKey]}` : `rule.level:${SEV_RANGES[metricKey]}`
      const { data } = await axios.get('/api/count', { params: { ...base, q: rangeQ }, timeout: 15000 })
      return { type: 'metric', data: data?.count || 0, raw: data?.count || 0 }
    }

    // EPS: events in last 60s / 60
    if (metricKey === 'epsCount') {
      const { data } = await axios.get('/api/count', { params: { ...base, start_date: 'now-60s', end_date: 'now' }, timeout: 15000 })
      const eps = +((data?.count || 0) / 60).toFixed(2)
      return { type: 'metric', data: eps, raw: eps, suffix: 'eps' }
    }

    // EPS/Ingestion metrics via eps-stats API
    if (['eps60', 'eps5m', 'totalIngestGB', 'todayIngestMB', 'minIngestRate', 'maxIngestRate'].includes(metricKey)) {
      const epsRes = await axios.get('/api/eps-stats', { params: { index: base.index, q: base.q, start_date: base.start_date, end_date: base.end_date }, timeout: 30000 })
      if (!epsRes.data?.success && metricKey.startsWith('eps')) return { type: 'metric', data: 0, raw: 0, suffix: 'eps' }
      const epsMap = {
        eps60: { val: epsRes.data?.eps?.['60s'], suffix: 'eps' },
        eps5m: { val: epsRes.data?.eps?.['5m'], suffix: 'eps' },
        totalIngestGB: { val: epsRes.data?.ingestion?.total_size_gb, suffix: 'GB' },
        todayIngestMB: { val: epsRes.data?.ingestion?.daily_sizes?.slice(-1)?.[0] ? +(epsRes.data.ingestion.daily_sizes.slice(-1)[0].size_bytes / 1048576).toFixed(1) : 0, suffix: 'MB' },
        minIngestRate: { val: epsRes.data?.ingestion?.min_rate || 0, suffix: 'KB/s' },
        maxIngestRate: { val: epsRes.data?.ingestion?.max_rate || 0, suffix: 'KB/s' },
      }
      const m = epsMap[metricKey] || { val: 0, suffix: '' }
      return { type: 'metric', data: m.val, raw: m.val, suffix: m.suffix }
    }

    // Default: total events count
    const useCardinality = q.aggregation?.field && q.aggregation?.type === 'cardinality'
    if (useCardinality) {
      const aggQ = sanitizeQ(base.q, 'aggregate')
      const cardParams = { ...base, q: aggQ, field: q.aggregation.field, type: 'cardinality', limit: 1 }
      const { data } = await axios.get('/api/aggregate', { params: cardParams, timeout: 15000 })
      let val = Math.round(data?.buckets?.[0]?.value || data?.value || 0)
      return { type: panelType, data: val, raw: val }
    }
    const countQ = addRangeToQuery(base.q, rangeFilters)
    const { data } = await axios.get('/api/count', { params: { ...base, q: countQ }, timeout: 15000 })
    let count = data?.count ?? data ?? 0
    count = await applyExcludeToCount(count, excludeFilters, base)
    if (panelType === 'alert-counter') {
      return { type: 'alert-counter', data: { critical: Math.round(count * 0.05), high: Math.round(count * 0.15), medium: Math.round(count * 0.3), low: count - Math.round(count * 0.5) }, raw: count }
    }
    return { type: panelType === 'gauge' ? 'gauge' : 'metric', data: count, raw: count }
  }

  if ((panelType === 'table' || panelType === 'event-logs') && q.aggregation?.type === 'logstop') {
    const lookback = q.aggregation.interval || '5m'
    const searchBase = { ...base, start_date: 'now-' + lookback, end_date: 'now' }
    const aggQ = sanitizeQ(base.q, 'aggregate')
    const recentRes = await axios.get('/api/aggregate', {
      params: { ...searchBase, q: aggQ, field: 'agent.name', type: 'terms', limit: 100 },
      timeout: 15000
    })
    const recentAgents = new Set((recentRes.data?.buckets || []).map(b => b.key))
    const allRes = await axios.get('/api/aggregate', {
      params: { ...base, q: aggQ, field: 'agent.name', type: 'terms', limit: 100 },
      timeout: 15000
    })
    const allAgents = (allRes.data?.buckets || []).map(b => b.key)
    const stopped = allAgents.filter(a => !recentAgents.has(a)).map((a, i) => ({
      '#': i + 1,
      agent: a || 'unknown',
      lastSeen: '>' + lookback + ' ago',
      status: 'STOPPED',
    }))
    return { type: 'table', data: stopped, raw: stopped.length }
  }

  if ((panelType === 'table' || panelType === 'log-stream' || panelType === 'event-logs') && q.aggregation?.field) {
    const aggField = q.aggregation.field
    const aggType = q.aggregation.type || 'terms'
    const aggLimit = q.aggregation.limit || 20
    const aggQ = sanitizeQ(base.q, 'aggregate')
    const epsInterval = q.aggregation.eps ? (q.aggregation.interval || '60s') : null
    const epsSeconds = epsInterval ? (parseInt(epsInterval) || 60) : null
    let epsBuckets = null
    if (epsInterval) {
      const epsBase = { ...base, start_date: 'now-' + epsInterval, end_date: 'now' }
      const epsRes = await axios.get('/api/aggregate', {
        params: { ...epsBase, q: aggQ, field: aggField, type: 'terms', limit: aggLimit },
        timeout: 15000
      })
      epsBuckets = epsRes.data?.buckets || []
    }
    const params = { ...base, q: aggQ, field: aggField, type: aggType, limit: aggLimit }
    if (q.aggregation?.include?.length) params.include = q.aggregation.include
    if (aggType === 'date_histogram') params.interval = q.aggregation.interval || '1h'
    const { data } = await axios.get('/api/aggregate', { params, timeout: 15000 })
    let buckets = applyRangeToBuckets(data?.buckets || [], rangeFilters, aggField)
    buckets = applyExcludeToBuckets(buckets, getExcludeFilters(globalFilters))
    const totalCount = buckets.reduce((s, x) => s + (x.doc_count || 0), 0) || 1
    const epsLookup = {}
    if (epsBuckets) {
      epsBuckets.forEach(b => { epsLookup[b.key] = (b.doc_count || 0) / epsSeconds })
    }
    const flat = buckets.map((b, i) => {
      const agentName = b.key_as_string || b.key || ''
      const count = b.doc_count || 0
      const eps = epsInterval ? (epsLookup[agentName] || (count / epsSeconds)) : null
      return {
        '#': i + 1,
        agent: agentName,
        count,
        ...(eps !== null ? { eps: Math.round(eps * 100) / 100 } : {}),
        ...(aggType === 'date_histogram' ? {} : { pct: (count / totalCount * 100).toFixed(1) + '%' }),
        ...(epsInterval ? { status: eps > 0 ? 'ACTIVE' : 'IDLE' } : {})
      }
    })
    return { type: 'table', data: flat, raw: buckets.length }
  }

  if (panelType === 'table' || panelType === 'data-table' || panelType === 'log-stream' || panelType === 'event-logs') {
    const sortField = q.sort?.field || '@timestamp'
    const sortOrder = q.sort?.order || 'desc'
    const limit = q.limit || 10
    const offset = page * perPage
    const searchQ = sanitizeQ(base.q, 'search')
    const fetchLimit = panel.query?.aggregation?.field ? limit : Math.min(Math.max(limit, perPage), 100)
    const { data } = await axios.get('/api/search', { params: { ...base, q: searchQ, limit: fetchLimit, offset, sort: sortField, order: sortOrder }, timeout: 15000 })
    const results = data?.results || data?.hits || []
    const flat = results.map(doc => {
      const r = {}
      const skipKeys = new Set(['syscheck', 'decoder', 'predecoder'])
      function flatten(obj, prefix) {
        for (const [k, v] of Object.entries(obj)) {
          const key = prefix ? prefix + '.' + k : k
          if (skipKeys.has(k)) continue
          if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
            flatten(v, key)
          } else {
            r[key] = Array.isArray(v) ? v.join(', ') : String(v ?? '')
          }
        }
      }
      flatten(doc, '')
      return r
    })
    const excludeFilters = getExcludeFilters(globalFilters)
    let filtered = applyExcludeToRows(flat, excludeFilters, results)
    let filteredArr = Array.isArray(filtered) ? filtered : filtered.rows
    let filteredCompanion = Array.isArray(filtered) ? results : filtered.companion
    filteredArr = applyRangeToRows(filteredArr, rangeFilters)
    const filteredFlat = filteredArr
    const filteredRaw = filteredCompanion
    return { type: 'table', data: filteredFlat, raw: data?.total || 0, rawResults: filteredRaw }
  }

  if (q.aggregation?.field || ['bar', 'pie', 'severity-pie', 'area', 'line', 'timeline', 'heatmap', 'clusterbubble', 'tagcloud'].includes(panelType)) {
    const FIELD_MAP = { bar: 'rule.level', pie: 'rule.level', 'severity-pie': 'rule.level', heatmap: 'rule.mitre.tactic', line: '@timestamp', area: '@timestamp', timeline: '@timestamp', tagcloud: 'rule.description' }
    const aggField = q.aggregation?.field || FIELD_MAP[panelType] || 'rule.level'
    const aggType = q.aggregation?.type || (['area', 'line', 'timeline'].includes(panelType) ? 'date_histogram' : 'terms')
    const aggInterval = q.aggregation?.interval || '1h'
    const aggLimit = q.aggregation?.limit || 10
    const aggQ = sanitizeQ(base.q, 'aggregate')
    const params = { ...base, q: aggQ, field: aggField, type: aggType, limit: aggLimit }
    if (q.aggregation?.include?.length) params.include = q.aggregation.include
    if (aggType === 'date_histogram') params.interval = aggInterval
    const { data } = await axios.get('/api/aggregate', { params, timeout: 15000 })
    let buckets = applyRangeToBuckets(data?.buckets || [], rangeFilters, aggField)
    buckets = applyExcludeToBuckets(buckets, getExcludeFilters(globalFilters))
    return { type: 'chart', chartType: panelType, data: buckets.map(b => ({ x: b.key_as_string || b.key, y: b.doc_count || 0 })), raw: buckets, isDateHistogram: aggType === 'date_histogram' }
  }

  const aggQ = sanitizeQ(base.q, 'aggregate')
  const { data } = await axios.get('/api/aggregate', { params: { ...base, q: aggQ, field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48 }, timeout: 15000 })
  let buckets = applyRangeToBuckets(data?.buckets || [], rangeFilters, '@timestamp')
  buckets = applyExcludeToBuckets(buckets, getExcludeFilters(globalFilters))
  return { type: 'chart', chartType: panelType || 'line', data: buckets.map(b => ({ x: b.key_as_string || b.key, y: b.doc_count || 0 })), raw: buckets }
}

function getPlotlyType(ct) {
  if (!ct || ct === 'bar' || ct === 'bar-vertical' || ct === 'bar-horizontal') return 'bar'
  if (ct === 'pie' || ct === 'severity-pie') return 'pie'
  if (ct === 'heatmap') return 'heatmap'
  return 'scatter'
}

function getPlotlyMode(ct) {
  if (ct === 'pie' || ct === 'severity-pie' || ct === 'bar' || ct === 'bar-vertical' || ct === 'bar-horizontal' || ct === 'heatmap') return undefined
  return 'lines+markers'
}

export default function DashboardPanel({ panel }) {
  const { updatePanel, removePanel, addPanel, addFilter, timeRange, refreshCounter, globalFilters, filterMatch, triggerRefresh } = useDashboard()
  const { isDark } = useApp()
  const [title, setTitle] = useState(panel.title || '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [tablePage, setTablePage] = useState(0)
  const [filterDropdown, setFilterDropdown] = useState(null)
  const [metricFilterDropdown, setMetricFilterDropdown] = useState(null)
  const [expandedRow, setExpandedRow] = useState(null)
  const [expandedViews, setExpandedViews] = useState({})
  const [chartClickState, setChartClickState] = useState(null)
  const fetchRef = useRef(0)
  const timerRef = useRef(null)
  const panelRef = useRef(null)

  const isCompliance = (panel.type || panel.vizType || '').startsWith('compliance-')

  const loadData = useCallback(() => {
    if (isCompliance) { setLoading(false); return }
    const id = ++fetchRef.current
    setLoading(true)
    setError(null)
    const perPage = panel.query?.limit || 10
    fetchPanelData(panel, globalFilters, tablePage, perPage, timeRange, filterMatch).then(r => {
      if (id === fetchRef.current) { setResult(r); setLoading(false) }
    }).catch(e => {
      if (id === fetchRef.current) { setError(e.message || 'Failed to fetch'); setLoading(false) }
    })
  }, [panel, globalFilters, isCompliance, tablePage, timeRange])

  useEffect(() => {
    const closeDropdown = (e) => { if (!e.target.closest('.filter-dropdown') && !e.target.closest('.chart-filter-popup')) { setFilterDropdown(null); setMetricFilterDropdown(null); setChartClickState(null) } }
    document.addEventListener('click', closeDropdown)
    return () => document.removeEventListener('click', closeDropdown)
  }, [])

  useEffect(() => {
    loadData()
    if (isCompliance) return
    const interval = panel.refreshInterval || REFRESH_INTERVAL
    if (interval > 0) timerRef.current = setInterval(loadData, interval)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loadData, panel, timeRange?.from, timeRange?.to, refreshCounter, isCompliance])

  useEffect(() => {
    const handler = (e) => { if (e.detail?.panelId === panel.id) setShowSettings(true) }
    window.addEventListener('open-settings-modal', handler)
    return () => window.removeEventListener('open-settings-modal', handler)
  }, [panel.id])

  const handleChartClick = useCallback((data) => {
    if (!data?.points?.length) return
    const point = data.points[0]
    if (!point) return
    const q = panel.query || {}
    const agg = q.aggregation || {}
    const ct = panel.type || panel.vizType || ''
    const ck = panel.vizConfig?.chartKey || ''
    const EPS_TIME_KEYS = ['eventRate', 'epsTrend', 'combinedTrend', 'ingestionTrend']
    const EPS_AGENT_KEYS = ['topNodesEps', 'ingestPerAsset']
    let field = ''
    if (panel.dataSource === 'eps-stats' || q.dataSource === 'eps-stats') {
      if (EPS_TIME_KEYS.includes(ck)) field = '@timestamp'
      else if (EPS_AGENT_KEYS.includes(ck)) field = 'agent.name'
      else field = agg.field || 'rule.level'
    } else {
      const FIELD_MAP = { bar: 'rule.level', 'bar-vertical': 'rule.level', 'bar-horizontal': 'rule.level', pie: 'rule.level', 'severity-pie': 'rule.level', line: '@timestamp', area: '@timestamp', heatmap: 'rule.mitre.tactic', timeline: '@timestamp' }
      field = agg.field || FIELD_MAP[ct] || 'rule.level'
    }
    const aggType = agg.type || ''
    let value = ''
    if (ct === 'pie' || ct === 'severity-pie' || point.data?.type === 'pie') {
      value = point.customdata || point.label || ''
    } else if (aggType === 'date_histogram' && field.includes('timestamp')) {
      const xVal = point.x || ''
      if (xVal) {
        const dt = new Date(xVal)
        if (!isNaN(dt.getTime())) {
          value = dt.toISOString().slice(0, 10)
        } else {
          value = xVal
        }
      } else {
        value = point.x || ''
      }
    } else {
      value = point.x || ''
    }
    if (field && value && String(value) !== 'undefined') {
      setChartClickState({ field, value: String(value), x: data.event?.clientX || 0, y: data.event?.clientY || 0 })
    }
  }, [panel])

  const handleDuplicate = () => {
    const copy = JSON.parse(JSON.stringify(panel))
    copy.id = 'panel_' + Date.now()
    copy.title = (panel.title || 'Panel') + ' (Copy)'
    copy.x = (panel.x || 0) + 2
    copy.y = (panel.y || 0) + 2
    addPanel(copy)
  }

  const handleContextAction = (action, p) => {
    if (action === 'drilldown') {
      window.dispatchEvent(new CustomEvent('drilldown', { detail: { panel: p } }))
    } else if (action === 'inspect') {
      window.dispatchEvent(new CustomEvent('inspect-panel', { detail: { panel: p } }))
    } else if (action === 'duplicate') {
      handleDuplicate()
    } else if (action === 'export') {
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (panel.title || 'panel').replace(/\s+/g, '_') + '.json'
      a.click()
      URL.revokeObjectURL(url)
    } else if (action === 'settings') {
      setShowSettings(true)
    } else if (action === 'clone') {
      const clone = JSON.parse(JSON.stringify(p))
      clone.id = 'panel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)
      clone.title = (p.title || 'Widget') + ' (Clone)'
      clone.x = (p.x || 0) + 1
      clone.y = (p.y || 0) + 1
      addPanel(clone)
    } else if (action === 'pastedesign') {
      try {
        const saved = JSON.parse(localStorage.getItem('unishield_copied_design') || 'null')
        if (saved) {
          updatePanel({ ...p, type: saved.type, vizType: saved.vizType, query: saved.query, vizConfig: saved.vizConfig, dataSource: saved.dataSource })
        }
      } catch {}
    } else if (action === 'remove') {
      removePanel(p.id)
    }
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const panelType = panel.type || panel.vizType || ''
  const complianceLabels = { 'compliance-metrics': 'metrics', 'compliance-severity': 'severity', 'compliance-timeline': 'timeline', 'compliance-controls': 'controls', 'compliance-logs': 'logs' }
  const displayType = complianceLabels[panelType] || (['bar-vertical', 'bar-horizontal'].includes(panelType) ? 'bar' : panelType)
  const accentColor = panel.vizConfig?.accent || CHART_COLORS[displayType] || '#EF843C'

  const renderMetric = (val) => {
    const txtAlign = panel.vizConfig?.contentAlign || 'center'
    const alignClass = txtAlign === 'left' ? 'text-left' : txtAlign === 'right' ? 'text-right' : 'text-center'
    const cs = (key, def) => panel.vizConfig?.[key] || def
    const fw = (w) => ({ 'font-normal': '400', 'font-medium': '500', 'font-semibold': '600', 'font-bold': '700' })[w] || w
    const q = panel.query || {}
    const aggField = q.aggregation?.field || ''
    const queryStr = q.query || ''
    const metricVal = typeof val === 'number' ? val.toLocaleString() : val
    // Apply threshold colors
    const thrStr = panel.vizConfig?.thresholds || ''
    let thresholdColor = null
    if (thrStr && typeof val === 'number') {
      const rules = thrStr.split(',').map(r => { const [v, c] = r.trim().split('='); return { val: parseFloat(v), color: c?.trim() } }).filter(r => !isNaN(r.val) && r.color)
      rules.sort((a, b) => b.val - a.val)
      for (const r of rules) { if (val >= r.val) { thresholdColor = r.color; break } }
    }
    // Generate meaningful filter query from metric config
    const metricKey = panel.vizConfig?.metricKey || ''
    const EPS_KEYS = new Set(['epsCount', 'eps60', 'eps5m', 'totalIngestGB', 'todayIngestMB', 'minIngestRate', 'maxIngestRate'])
    const FILTER_MAP = {
      critical: { key: 'rule.level', value: '12', operator: 'is between', secondValue: '15' },
      high: { key: 'rule.level', value: '7', operator: 'is between', secondValue: '11' },
      medium: { key: 'rule.level', value: '4', operator: 'is between', secondValue: '6' },
      low: { key: 'rule.level', value: '1', operator: 'is between', secondValue: '3' },
      totalAgents: { key: 'agent.name', value: '', operator: 'exists' },
    }
    const filterDef = FILTER_MAP[metricKey] || null
    let fallbackFilter = ''
    if (!filterDef && !EPS_KEYS.has(metricKey)) {
      if (queryStr && !queryStr.match(/^(\.\*|\*)$/)) {
        fallbackFilter = queryStr
      } else if (aggField && ['cardinality', 'terms'].includes(q.aggregation?.type || '')) {
        fallbackFilter = `_exists_:${aggField}`
      }
    }
    const hasFilter = !!filterDef || !!fallbackFilter
    return (
      <div className={`relative h-full flex flex-col justify-center ${alignClass}`}>
        {panel.vizConfig?.showTitle !== false && (panel.title || panel.type) && <div style={{ fontSize: cs('txtSize', '10px'), color: cs('txtColor', '#8b949e'), fontWeight: fw(cs('txtWeight', '600')), textTransform: cs('txtTransform', 'uppercase'), letterSpacing: cs('txtTracking', '0.05em'), lineHeight: cs('txtLineH', '') }} className="truncate">{panel.title || panel.type}</div>}
        <span className="inline-flex items-baseline justify-center gap-1">
          <span className="relative inline-flex">
            <span onClick={(e) => { e.stopPropagation(); setMetricFilterDropdown(metricFilterDropdown === panel.id ? null : panel.id) }} className="tracking-tight cursor-pointer" style={{ fontSize: cs('valSize', cs('txtSize', '24px')), color: thresholdColor || cs('valColor', cs('txtColor', isDark ? '#e4e6eb' : '#1f2328')), fontWeight: fw(cs('valWeight', cs('txtWeight', '700'))), lineHeight: cs('txtLineH', '') }}>{metricVal}</span>
            {metricFilterDropdown === panel.id && (
              <div className="filter-dropdown absolute top-full mt-1 z-[100] bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-[#30363d] rounded-lg shadow-xl p-1 min-w-[120px]" onClick={e => e.stopPropagation()}>
                {hasFilter ? <>
                  <button onClick={() => {
                    if (filterDef) {
                      // Include: use simple equality (not range) so ALL API endpoints work
                      addFilter({ type: 'pair', key: filterDef.key, value: filterDef.value, exclude: false })
                    } else {
                      addFilter({ type: 'text', query: fallbackFilter, exclude: false })
                    }
                    setMetricFilterDropdown(null)
                  }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] rounded transition-colors hover:bg-green-500/10 text-green-600 dark:text-green-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Include
                  </button>
                  <button onClick={() => {
                    if (filterDef) {
                      // Exclude: keep range for exclude functions (applyExcludeToCount/Buckets/Rows)
                      addFilter({ type: 'pair', key: filterDef.key, value: filterDef.value, operator: filterDef.operator, secondValue: filterDef.secondValue, exclude: true })
                    } else {
                      addFilter({ type: 'text', query: fallbackFilter, exclude: true })
                    }
                    setMetricFilterDropdown(null)
                  }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] rounded transition-colors hover:bg-red-500/10 text-red-600 dark:text-red-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Exclude
                  </button>
                </> : <div className="px-3 py-1.5 text-[10px] text-zinc-400">No filter available</div>}
              </div>
            )}
          </span>
          {panel.vizConfig?.suffix && <span style={{ fontSize: cs('txtSize', '10px'), color: cs('txtColor', '#8b949e') }}>{panel.vizConfig.suffix}</span>}
        </span>
      </div>
    )
  }

  const renderGauge = (val) => {
    const max = panel.vizConfig?.gaugeMax || panel.vizConfig?.max || 100
    const pct = Math.min((val / max) * 100, 100)
    const color = pct > 66 ? '#ef4444' : pct > 33 ? '#f59e0b' : '#10b981'
    return (
      <div className="text-center px-2 w-full">
        <div className="relative w-14 h-14 mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke={isDark ? '#374151' : '#e5e7eb'} strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="8" strokeDasharray={pct * 2.64 + ' 264'} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold" style={{ color: isDark ? '#e4e6eb' : color }}>{Math.round(pct)}%</span>
          </div>
        </div>
        <div className="text-[10px] text-zinc-400 mt-1">{panel.title || ''}</div>
      </div>
    )
  }

  const TABLE_COLS = ['@timestamp', 'rule.description', 'rule.id', 'rule.level', 'agent.name', 'agent.id', 'location']

  const fmtTS = (ts) => {
    if (!ts) return { single: '', date: '', time: '', full: '' }
    const d = new Date(ts)
    if (isNaN(d.getTime())) return { single: String(ts), date: String(ts), time: '', full: String(ts) }
    const pad = (n) => String(n).padStart(2, '0')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const date = `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    return { single: `${date} ${time}`, date, time, full: `${date} ${time}` }
  }

  const renderTable = (data) => {
    if (!data.length) return <div className="flex items-center justify-center h-full text-zinc-400 text-[10px]">No results</div>
    const keys = Object.keys(data[0])
    const savedCols = panel.vizConfig?.tableColumns || []
    const hideKeys = ['_id', 'id', 'timestamp', 'offset', 'previous_log', 'previous_output', 'rule.mitre', 'rule.mail', 'rule.firedtimes', 'rule.cve', 'manager.name', 'input.type', 'predecoder']
    const hiddenPrefixes = ['syscheck.', 'decoder.', 'predecoder.', 'manager.', 'input.', '_']
    const visibleKeys = keys.filter(k => !hiddenPrefixes.some(p => k.startsWith(p)) && !hideKeys.some(h => k === h || k.startsWith(h)))
    const validSaved = savedCols.filter(c => visibleKeys.includes(c) && data.some(r => r[c] !== undefined && String(r[c]) !== ''))
    const cols = validSaved.length ? validSaved : TABLE_COLS.filter(c => visibleKeys.includes(c))
    const displayCols = cols
    const perPage = panel.query?.limit || 10
    const totalPages = Math.ceil((result?.raw || data.length) / perPage)
    const page = Math.min(tablePage, Math.max(0, totalPages - 1))
    const pageData = data
    const globalIdx = page * perPage

    const genPages = () => {
      const pages = []
      const maxShow = 7
      if (totalPages <= maxShow) { for (let i = 0; i < totalPages; i++) pages.push(i) }
      else {
        pages.push(0)
        let start = Math.max(1, page - 2)
        let end = Math.min(totalPages - 2, page + 2)
        if (start > 2) pages.push(-1)
        else start = 1
        for (let i = start; i <= end; i++) pages.push(i)
        if (end < totalPages - 2) pages.push(-1)
        else end = totalPages - 2
        pages.push(totalPages - 1)
      }
      return pages
    }

    return (
      <div className="flex flex-col w-full h-full">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[10px] font-mono">
            <thead><tr className="bg-zinc-50 dark:bg-zinc-800/40 sticky top-0 z-10">
              {displayCols.map(c => <th key={c} className={'text-left px-2 py-1 text-zinc-500 border-b font-semibold whitespace-nowrap text-[9px] uppercase tracking-wider' + (c === '@timestamp' ? ' min-w-[180px]' : '')}><span className="truncate max-w-[120px] inline-block" title={c}>{c}</span></th>)}
            </tr></thead>
            <tbody>
              {pageData.map((row, i) => {
                const rowGlobalIdx = globalIdx + i
                const isExpanded = expandedRow === rowGlobalIdx
                const rowKeys = Object.keys(row)
                return (
                  <React.Fragment key={i}>
                    <tr className={'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors ' + (isExpanded ? 'bg-zinc-50 dark:bg-zinc-800/40' : '')}
                      onClick={() => setExpandedRow(isExpanded ? null : rowGlobalIdx)}>
                      {displayCols.map((c, ci) => {
                        const aggField = panel.query?.aggregation?.field || ''
                        const filterKey = c === 'key' && aggField ? aggField : c
                        if (c === '@timestamp') {
                          const { single, date, time, full } = fmtTS(row[c])
                          return (
                          <td key={c} className={'relative px-2 py-1 border-b border-zinc-100 dark:border-zinc-700/30 text-zinc-600 dark:text-zinc-400 text-[10px] cursor-pointer'}>
                            <span className="relative inline-flex items-center gap-1">
                              {ci === 0 && <span className="text-[9px] text-zinc-400 shrink-0">{isExpanded ? '▾' : '▸'}</span>}
                              <span onClick={e => { e.stopPropagation(); setFilterDropdown(filterDropdown === rowGlobalIdx+'-'+c ? null : rowGlobalIdx+'-'+c) }} className="truncate max-w-[120px] inline-block font-medium" title={full}>{full}</span>
                              {filterDropdown === rowGlobalIdx+'-'+c && (
                                <div className="filter-dropdown absolute top-full left-0 mt-1 z-[100] bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-[#30363d] rounded-lg shadow-xl p-1 min-w-[120px]" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => { addFilter({ type: 'pair', key: filterKey, value: String(row[c] ?? ''), exclude: false }); setFilterDropdown(null) }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] rounded transition-colors hover:bg-green-500/10 text-green-600 dark:text-green-400">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Include
                                  </button>
                                  <button onClick={() => { addFilter({ type: 'pair', key: filterKey, value: String(row[c] ?? ''), exclude: true }); setFilterDropdown(null) }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] rounded transition-colors hover:bg-red-500/10 text-red-600 dark:text-red-400">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Exclude
                                  </button>
                                </div>
                              )}
                            </span>
                          </td>
                          )
                        }
                        return (
                        <td key={c} className={'relative px-2 py-1 border-b border-zinc-100 dark:border-zinc-700/30 text-zinc-600 dark:text-zinc-400 text-[10px] cursor-pointer'}>
                          <span className="relative inline-flex items-center gap-1">
                            {ci === 0 && <span className="text-[9px] text-zinc-400 shrink-0">{isExpanded ? '▾' : '▸'}</span>}
                            <span onClick={e => { e.stopPropagation(); setFilterDropdown(filterDropdown === rowGlobalIdx+'-'+c ? null : rowGlobalIdx+'-'+c) }} className="truncate max-w-[100px] inline-block font-medium">{String(row[c] ?? '').substring(0, 50)}</span>
                            {filterDropdown === rowGlobalIdx+'-'+c && (
                              <div className="filter-dropdown absolute top-full left-0 mt-1 z-[100] bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-[#30363d] rounded-lg shadow-xl p-1 min-w-[120px]" onClick={e => e.stopPropagation()}>
                                <button onClick={() => { addFilter({ type: 'pair', key: filterKey, value: String(row[c] ?? ''), exclude: false }); setFilterDropdown(null) }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] rounded transition-colors hover:bg-green-500/10 text-green-600 dark:text-green-400">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Include
                                </button>
                                <button onClick={() => { addFilter({ type: 'pair', key: filterKey, value: String(row[c] ?? ''), exclude: true }); setFilterDropdown(null) }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] rounded transition-colors hover:bg-red-500/10 text-red-600 dark:text-red-400">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Exclude
                                </button>
                              </div>
                            )}
                          </span>
                        </td>
                      )})}
                    </tr>
                    {isExpanded && (
                      <tr key={i + '-exp'}>
                        <td colSpan={displayCols.length + 1} className="p-0 border-b border-zinc-100 dark:border-zinc-700/30">
                          <div className="bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-200 dark:border-zinc-700/50">
                            <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700/50">
                              <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); setExpandedViews(v => ({ ...v, [rowGlobalIdx]: 'table' })) }}
                                  className={'text-[10px] px-2 py-0.5 rounded font-medium transition-colors ' + ((expandedViews[rowGlobalIdx] || 'table') === 'table' ? 'bg-[#EF843C] text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800')}>Table</button>
                                <button onClick={(e) => { e.stopPropagation(); setExpandedViews(v => ({ ...v, [rowGlobalIdx]: 'json' })) }}
                                  className={'text-[10px] px-2 py-0.5 rounded font-medium transition-colors ' + ((expandedViews[rowGlobalIdx] || 'table') === 'json' ? 'bg-[#EF843C] text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800')}>JSON</button>
                                <button onClick={(e) => { e.stopPropagation(); setExpandedViews(v => ({ ...v, [rowGlobalIdx]: 'raw' })) }}
                                  className={'text-[10px] px-2 py-0.5 rounded font-medium transition-colors ' + ((expandedViews[rowGlobalIdx] || 'table') === 'raw' ? 'bg-[#EF843C] text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800')}>Raw</button>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(JSON.stringify(result?.rawResults?.[rowGlobalIdx] || row, null, 2)) }}
                                className="text-[10px] px-2 py-0.5 rounded font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center gap-1">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy
                              </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {(expandedViews[rowGlobalIdx] || 'table') === 'raw' && result?.rawResults?.[rowGlobalIdx] ? (
                                <pre className="p-3 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap max-h-48 overflow-y-auto">{JSON.stringify(result.rawResults[rowGlobalIdx], null, 2)}</pre>
                              ) : (expandedViews[rowGlobalIdx] || 'table') === 'json' ? (
                                <pre className="p-3 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap max-h-48 overflow-y-auto">{JSON.stringify(row, null, 2)}</pre>
                              ) : (
                                <table className="w-full text-[11px]">
                                  <tbody>
                                    {rowKeys.map(k => {
                                      const expKey = `exp-${rowGlobalIdx}-${k}`
                                      return (
                                      <tr key={k} className="border-b border-zinc-100/30 dark:border-zinc-700/30 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                                        <td className="px-3 py-1 font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap w-1/3 align-top text-[10px]">{k}</td>
                                        <td className="relative px-3 py-1 text-zinc-700 dark:text-zinc-300 break-all text-[11px] cursor-pointer">
                                          <span className="relative inline-flex items-center gap-1">
                                            <span onClick={e => { e.stopPropagation(); setFilterDropdown(d => d === expKey ? null : expKey) }}
                                              className="truncate max-w-[200px] inline-block font-medium">
                                              {typeof row[k] === 'object' ? JSON.stringify(row[k], null, 2) : String(row[k] ?? '')}
                                            </span>
                                            {filterDropdown === expKey && (
                                              <div className="filter-dropdown absolute top-full left-0 mt-1 z-[100] bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-[#30363d] rounded-lg shadow-xl p-1 min-w-[120px] whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => { addFilter({ type: 'pair', key: k, value: String(row[k] ?? ''), exclude: false }); setFilterDropdown(null) }}
                                                  className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] rounded transition-colors hover:bg-green-500/10 text-green-600 dark:text-green-400">
                                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Include
                                                </button>
                                                <button onClick={() => { addFilter({ type: 'pair', key: k, value: String(row[k] ?? ''), exclude: true }); setFilterDropdown(null) }}
                                                  className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] rounded transition-colors hover:bg-red-500/10 text-red-600 dark:text-red-400">
                                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Exclude
                                                </button>
                                              </div>
                                            )}
                                          </span>
                                        </td>
                                      </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2 py-1 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
            <div className="flex items-center gap-1">
              <button onClick={() => setTablePage(Math.max(0, page - 1))} disabled={page === 0}
                className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-all">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              {genPages().map((p, idx) => p === -1 ? (
                <span key={'e'+idx} className="px-0.5 text-[9px] text-zinc-400">...</span>
              ) : (
                <button key={p} onClick={() => setTablePage(p)}
                  className={'px-2 py-0.5 rounded text-[10px] font-medium min-w-[24px] transition-all ' + (p === page ? 'bg-[#EF843C] text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800')}>{p + 1}</button>
              ))}
              <button onClick={() => setTablePage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-all">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
            {result?.raw > 0 ? (
              <span className="text-[8px] text-zinc-400">Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, result.raw)} of {result.raw}</span>
            ) : (
              <span className="text-[8px] text-zinc-400">{data.length} results</span>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-full border-2 border-zinc-200 dark:border-zinc-700" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#EF843C] animate-spin" />
          </div>
          <span className="text-[9px] text-zinc-400 animate-pulse">Loading data...</span>
        </div>
      )
    }
    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center px-3">
            <svg className="w-5 h-5 mx-auto mb-1.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-[9px] text-red-400 leading-tight mb-2">{error}</p>
            <button onClick={loadData} className="px-2.5 py-1 text-[9px] font-medium rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">Retry</button>
          </div>
        </div>
      )
    }
    if (!result) return <div className="flex items-center justify-center h-full text-zinc-400 text-[10px]">No data</div>

    if (result.type === 'metric') return renderMetric(result.data)
    if (result.type === 'gauge') return renderGauge(result.data)

    if (result.type === 'alert-counter' && typeof result.data === 'object') {
      return (
        <div className="grid grid-cols-2 gap-1.5 p-2 w-full">
          {Object.entries(result.data).map(([k, v]) => (
            <div key={k} className="text-center bg-zinc-50 dark:bg-zinc-800/40 rounded-lg py-2">
              <div className={'text-lg font-bold ' + (k === 'critical' ? 'text-red-500' : k === 'high' ? 'text-orange-500' : k === 'medium' ? 'text-yellow-500' : 'text-green-500')}>{v}</div>
              <div className="text-[8px] text-zinc-400 uppercase tracking-wider">{k}</div>
            </div>
          ))}
        </div>
      )
    }

    if (result.type === 'table' && Array.isArray(result.data)) {
      if (panelType === 'data-table') return renderTable(result.data)
      const hasAgg = panel.query?.aggregation?.field
      if (panelType === 'event-logs' || (panelType === 'table' && !hasAgg)) return <EventLogsPanel panel={panel} data={result.data} loading={loading} error={error} onFilter={addFilter} />
      return renderTable(result.data)
    }

    if (panelType === 'compliance-metrics') return <ComplianceMetricPanel panel={panel} />
    if (panelType === 'compliance-severity') return <ComplianceSeverityPanel panel={panel} />
    if (panelType === 'compliance-timeline') return <ComplianceTimelinePanel panel={panel} />
    if (panelType === 'compliance-controls') return <ComplianceControlsPanel panel={panel} />
    if (panelType === 'compliance-logs') return <ComplianceLogPanel panel={panel} />
    if (panelType === 'markdown') {
      const content = panel.vizConfig?.customContent || '*No content*'
      return <div className="p-3 text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{content}</div>
    }
    if (panelType === 'top-n') return <TopNPanel panel={panel} data={result?.data || result?.buckets || result} loading={loading} error={error} />
    if (panelType === 'timeline-area') return <TimelineAreaPanel panel={panel} data={result?.data || result?.buckets || result} loading={loading} error={error} />
    if (panelType === 'event-logs') return <EventLogsPanel panel={panel} data={result || result?.results || result?.hits || result} loading={loading} error={error} onFilter={addFilter} />
    if (panelType === 'framework-dist') return <FrameworkDistPanel panel={panel} />
    if (panelType === 'top-agents') return <TopAgentsPanel panel={panel} />
    if (panelType === 'tagcloud') {
      const tagData = result?.data || result?.buckets || []
      return <TagCloudPanel panel={panel} data={tagData} loading={loading} error={error} />
    }

    if (result.type === 'combined') {
      const config = { responsive: true, displayModeBar: false }
      const layout = { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { t: 5, r: 5, b: 20, l: 25 }, font: { size: 8, color: '#6b7280' }, showlegend: true, legend: { orientation: 'h', y: -0.15, font: { size: 8 } }, xaxis: { showgrid: false, zeroline: false, tickangle: -30 }, yaxis: { showgrid: false, zeroline: false, title: { text: 'Events', font: { size: 8 } } }, yaxis2: { showgrid: false, zeroline: false, overlaying: 'y', side: 'right', title: { text: 'EPS', font: { size: 8 } } } }
      const eventData = result.eventData || []
      const epsData = result.epsData || []
      return <Plot data={[
        { x: eventData.map(x => x.x), y: eventData.map(x => x.y), type: 'bar', name: 'Events', marker: { color: '#EF843C', opacity: 0.6 }, hovertemplate: '%{x}<br>Events: %{y}<extra></extra>' },
        { x: epsData.map(x => x.x), y: epsData.map(x => x.y), type: 'scatter', mode: 'lines+markers', name: 'EPS', line: { color: '#8b5cf6', width: 1.5 }, marker: { size: 3, color: '#8b5cf6' }, yaxis: 'y2', hovertemplate: '%{x}<br>EPS: %{y}<extra></extra>' },
      ]} layout={layout} config={config} style={{ width: '100%', height: '100%' }} useResizeHandler />
    }

    if (result.type === 'chart' && Array.isArray(result.data) && result.data.length) {
      const d = result.data
      const ct = result.chartType || panelType || 'line'
      const plotlyType = getPlotlyType(ct)
      const plotlyMode = getPlotlyMode(ct)
      const vc = panel.vizConfig || {}
      const config = { responsive: true, displayModeBar: false }
      const showLegend = vc.legendPos && vc.legendPos !== 'none'
      const legend = showLegend ? { orientation: vc.legendPos === 'bottom' || vc.legendPos === 'top' ? 'h' : 'v', x: vc.legendPos === 'left' ? -0.15 : vc.legendPos === 'right' ? 1.05 : undefined, y: vc.legendPos === 'top' ? 1.1 : vc.legendPos === 'bottom' ? -0.2 : undefined, font: { size: 8 } } : undefined
      const xLabelAngle = vc.xAngle ?? -30
      const xShowLabels = vc.showXLabels !== false
      const axisColor = isDark ? '#9ca3af' : '#6b7280'
      const layout = { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { t: 5, r: 5, b: 20, l: 25 }, font: { size: 8, color: axisColor }, hovermode: vc.showTooltip !== false ? 'closest' : false, showlegend: showLegend, legend, xaxis: { automargin: true, showgrid: vc.showGridX === true, zeroline: false, showticklabels: xShowLabels, tickangle: xLabelAngle }, yaxis: { automargin: true, showgrid: vc.showGridY === true, zeroline: false, title: vc.yTitle ? { text: vc.yTitle, font: { size: 8 } } : undefined, range: vc.yMin !== '' || vc.yMax !== '' ? [vc.yMin || undefined, vc.yMax || undefined] : undefined } }

      if (plotlyType === 'pie') {
        const PIE_COLORS = ['#EF843C','#8b5cf6','#10b981','#06b6d4','#ef4444','#f59e0b','#ec4899','#14b8a6','#84cc16','#f97316']
        const fullLabels = d.map(x => x.x)
        const maxLen = panel.vizConfig?.maxLabelLength || 25
        const truncate = (s) => String(s).length > maxLen ? String(s).slice(0, maxLen) + '...' : s
        const field = panel.query?.aggregation?.field || panel.vizConfig?.field || 'key'
        return (
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0">
              <Plot data={[{ labels: fullLabels.map(truncate), values: d.map(x => x.y), customdata: fullLabels, type: 'pie', hole: 0.4, marker: { colors: PIE_COLORS.slice(0, d.length) }, textinfo: 'value', textfont: { size: 8 }, hovertemplate: '%{customdata}<br>%{value} (%{percent})<extra></extra>' }]} layout={{ ...layout, showlegend: false, margin: { t: 25, r: 5, b: 15, l: 5 }, autosize: true }} config={config} style={{ width: '100%', height: '100%' }} useResizeHandler />
            </div>
            <div className="shrink-0 mt-1 space-y-0.5">
              {d.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/40 group">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="flex-1 text-[10px] text-zinc-600 dark:text-zinc-400 truncate" title={item.x}>{truncate(item.x)}</span>
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{item.y}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { addFilter({ type: 'pair', key: field, value: String(item.x), exclude: false }) }}
                      className="p-0.5 rounded text-[9px] text-green-600 dark:text-green-400 hover:bg-green-500/10" title="Include">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    </button>
                    <button onClick={() => { addFilter({ type: 'pair', key: field, value: String(item.x), exclude: true }) }}
                      className="p-0.5 rounded text-[9px] text-red-600 dark:text-red-400 hover:bg-red-500/10" title="Exclude">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      }
      if (plotlyType === 'bar') {
        const PALETTES = { warm: ['#EF843C','#f59e0b','#ef4444','#ec4899','#f97316'], cool: ['#06b6d4','#8b5cf6','#10b981','#14b8a6','#6366f1'], qualitative: ['#EF843C','#8b5cf6','#10b981','#06b6d4','#ef4444','#f59e0b','#ec4899','#14b8a6','#84cc16','#f97316'] }
        const palette = PALETTES[panel.vizConfig?.palette] || PALETTES.qualitative
        const barColors = d.length === 1 ? palette[0] : d.map((_, i) => palette[i % palette.length])
        const thrVal = parseFloat(vc.thrLine)
        const shapes = !isNaN(thrVal) ? [{ type: 'line', y0: thrVal, y1: thrVal, x0: 0, x1: 1, xref: 'paper', line: { color: '#ef4444', width: 1, dash: 'dash' } }] : []
        const isHorizontal = vc.barOrientation === 'h'
        const showLabels = vc.showDataLabels !== false
        const trace = {
          x: isHorizontal ? d.map(x => x.y) : d.map(x => x.x),
          y: isHorizontal ? d.map(x => x.x) : d.map(x => x.y),
          type: 'bar',
          orientation: isHorizontal ? 'h' : undefined,
          marker: { color: barColors, opacity: 0.85 },
          hovertemplate: isHorizontal ? '%{y}<br>%{x}<extra></extra>' : '%{x}<br>%{y}<extra></extra>',
        }
        if (showLabels) {
          trace.text = d.map(x => x.y)
          trace.textposition = 'inside'
          trace.textfont = { size: 8, color: axisColor }
          trace.insidetextanchor = 'middle'
        }
        const xTickformat = result.isDateHistogram ? '%b %Y' : undefined
        return <Plot data={[trace]} layout={{ ...layout, shapes, xaxis: { ...layout.xaxis, tickformat: xTickformat, tickangle: !isHorizontal ? (vc.xAngle ?? (Math.max(...d.map(x => String(x.x).length)) > 12 ? -45 : Math.max(...d.map(x => String(x.x).length)) > 6 ? -30 : 0)) : undefined }, yaxis: { ...layout.yaxis } }} config={config} style={{ width: '100%', height: '100%' }} useResizeHandler onClick={handleChartClick} />
      }
      if (plotlyType === 'heatmap') {
        return <Plot data={[{ z: [d.map(x => x.y)], x: d.map(x => x.x), y: [''], type: 'heatmap', colorscale: [['0', '#fef2f2'], ['0.5', '#fca5a5'], ['1', '#dc2626']], hoverongaps: false, hovertemplate: '%{x}<br>%{z}<extra></extra>' }]} layout={{ ...layout, margin: { t: 5, r: 5, b: 50, l: 5 }, xaxis: { tickangle: -30, tickfont: { size: 7 } } }} config={config} style={{ width: '100%', height: '100%' }} useResizeHandler />
      }
      return <Plot data={[{ x: d.map(x => x.x), y: d.map(x => x.y), type: 'scatter', mode: plotlyMode, line: { color: '#EF843C', width: 1.5, shape: ct === 'area' ? 'spline' : 'linear', smoothing: 1.3 }, marker: { size: 2, color: '#EF843C' }, fill: ct === 'area' ? 'tozeroy' : undefined, fillcolor: '#EF843C15' }]} layout={layout} config={config} style={{ width: '100%', height: '100%' }} useResizeHandler onClick={handleChartClick} />
    }

    return <div className="flex items-center justify-center h-full text-zinc-400 text-[10px]">No data</div>
  }

  return (
    <div ref={panelRef} onContextMenu={handleContextMenu}
      className="h-full flex flex-col bg-white dark:bg-[#1a1d27] rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-lg"
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${accentColor}4D` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '' }}
      style={{ borderColor: '' }}>


      <div className={'flex-1 min-h-0 ' + (
        panel.vizConfig?.contentAlign === 'left' ? '' :
        panel.vizConfig?.contentAlign === 'right' ? 'flex justify-end' :
        'flex items-center justify-center'
      )} style={{
        padding: `${panel.vizConfig?.contentPadding ?? 8}px`,
        margin: `${panel.vizConfig?.contentMargin ?? 0}px`,
      }}>
        <style>{`
          #panel-content-${panel.id} {
            ${panel.vizConfig?.txtColor ? `color: ${panel.vizConfig.txtColor} !important;` : ''}
            ${panel.vizConfig?.txtSize ? `font-size: ${panel.vizConfig.txtSize} !important;` : ''}
            ${panel.vizConfig?.txtLineH ? `line-height: ${panel.vizConfig.txtLineH} !important;` : ''}
            ${panel.vizConfig?.txtTracking ? `letter-spacing: ${panel.vizConfig.txtTracking} !important;` : ''}
            ${panel.vizConfig?.txtWeight ? `font-weight: ${({ 'font-normal': '400', 'font-medium': '500', 'font-semibold': '600', 'font-bold': '700' })[panel.vizConfig.txtWeight] || panel.vizConfig.txtWeight} !important;` : ''}
            ${panel.vizConfig?.txtTransform ? `text-transform: ${panel.vizConfig.txtTransform} !important;` : ''}
            ${panel.vizConfig?.txtDisplay ? `display: ${panel.vizConfig.txtDisplay} !important;` : ''}
            ${panel.vizConfig?.customCSS || ''}
          }
        `}</style>
        <div id={`panel-content-${panel.id}`} style={{ width: '100%', height: '100%' }}>
          {renderContent()}
        </div>
      </div>

      {contextMenu && createPortal(
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          panel={panel}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />,
        document.body
      )}

      {chartClickState && createPortal(
        <div className="chart-filter-popup fixed z-[200]" style={{ left: chartClickState.x, top: chartClickState.y }}>
          <div className="bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-[#30363d] rounded-lg shadow-xl p-1 min-w-[130px]" onClick={e => e.stopPropagation()}>
            <button onClick={() => { addFilter({ type: 'pair', key: chartClickState.field, value: chartClickState.value, exclude: false }); setChartClickState(null) }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] rounded transition-colors hover:bg-green-500/10 text-green-600 dark:text-green-400">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Include
            </button>
            <button onClick={() => { addFilter({ type: 'pair', key: chartClickState.field, value: chartClickState.value, exclude: true }); setChartClickState(null) }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] rounded transition-colors hover:bg-red-500/10 text-red-600 dark:text-red-400">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Exclude
            </button>
          </div>
        </div>,
        document.body
      )}

      {showSettings && createPortal(
        <PanelSettingsModal
          panel={panel}
          availableKeys={result?.data?.length ? Object.keys(result.data[0]) : []}
          onSave={(updated) => { updatePanel(updated); triggerRefresh(); setShowSettings(false); setTimeout(() => window.dispatchEvent(new CustomEvent('save-dashboard')), 100) }}
          onClose={() => setShowSettings(false)}
        />,
        document.body
      )}
    </div>
  )
}

