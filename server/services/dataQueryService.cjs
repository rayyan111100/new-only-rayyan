const client = require('./openSearchClient.cjs')
const { AggregationBuilder } = require('./aggregationBuilder.cjs')

function normalizeIndex(idx) {
  return idx || 'unishield360-alerts-4.x-*'
}

function normalizeTimeRange(start, end) {
  return {
    start_date: start || 'now-24h',
    end_date: end || 'now',
  }
}

const dataQueryService = {

  // 1. Count — total document count
  async count({ index, q, start_date, end_date } = {}) {
    return client.count({
      index: normalizeIndex(index),
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 2. Time Series — date histogram aggregation
  async timeSeries({ index, field = '@timestamp', interval = '1h', q, start_date, end_date, limit = 100 } = {}) {
    const ab = new AggregationBuilder()
    ab.dateHistogram({ field, interval, size: limit })
    const params = {
      index: normalizeIndex(index),
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
      ...ab.build(),
    }
    const result = await client.search('search', params)
    return result
  },

  // 3. Average
  async average({ index, field, q, start_date, end_date } = {}) {
    return client.aggregate({
      index: normalizeIndex(index),
      field,
      type: 'avg',
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 4. Max
  async max({ index, field, q, start_date, end_date } = {}) {
    return client.aggregate({
      index: normalizeIndex(index),
      field,
      type: 'max',
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 5. Min
  async min({ index, field, q, start_date, end_date } = {}) {
    return client.aggregate({
      index: normalizeIndex(index),
      field,
      type: 'min',
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 6. Sum
  async sum({ index, field, q, start_date, end_date } = {}) {
    return client.aggregate({
      index: normalizeIndex(index),
      field,
      type: 'sum',
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 7. Terms — field value aggregation
  async terms({ index, field, size = 10, q, start_date, end_date } = {}) {
    return client.aggregate({
      index: normalizeIndex(index),
      field,
      type: 'terms',
      limit: size,
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 8. Histogram — numeric histogram
  async histogram({ index, field, interval = 10, q, start_date, end_date } = {}) {
    return client.search('search', {
      index: normalizeIndex(index),
      body: {
        size: 0,
        aggs: {
          histogram: {
            histogram: { field, interval, min_doc_count: 1 },
          },
        },
      },
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 9. Range — custom range aggregation
  async rangeAgg({ index, field, ranges = [], q, start_date, end_date } = {}) {
    const ab = new AggregationBuilder()
    ab.range({ field, ranges })
    const params = {
      index: normalizeIndex(index),
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    }
    return client.search('search', { ...params, body: JSON.stringify(ab.build()) })
  },

  // 10. Geohash — geo grid aggregation
  async geohash({ index, field = 'GeoLocation.location', precision = 3, size = 50, q, start_date, end_date } = {}) {
    const ab = new AggregationBuilder()
    ab.geohashGrid({ field, precision, size })
    ab.geoCentroid({ field })
    const params = {
      index: normalizeIndex(index),
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    }
    return client.search('search', { ...params, body: JSON.stringify(ab.build()) })
  },

  // 11. Filters — named filter aggregation
  async filtersAgg({ index, filters = {}, q, start_date, end_date } = {}) {
    const params = {
      index: normalizeIndex(index),
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    }
    return client.aggregate({
      ...params,
      field: '_index',
      type: 'terms',
      limit: 50,
    })
  },

  // 12. Cumulative Sum (pipeline)
  async cumulativeSum({ index, field = '@timestamp', interval = '1h', q, start_date, end_date } = {}) {
    return client.aggregate({
      index: normalizeIndex(index),
      field,
      type: 'date_histogram',
      interval,
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 13. Derivative (pipeline)
  async derivative({ index, field = '@timestamp', interval = '1h', q, start_date, end_date } = {}) {
    return client.aggregate({
      index: normalizeIndex(index),
      field,
      type: 'date_histogram',
      interval,
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 14. Moving Average (pipeline)
  async movingAverage({ index, field = '@timestamp', interval = '1h', window = 5, q, start_date, end_date } = {}) {
    return client.aggregate({
      index: normalizeIndex(index),
      field,
      type: 'date_histogram',
      interval,
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 15. Heat Map — MITRE ATT&CK style matrix
  async heatMap({ index, tacticField = 'rule.mitre.tactic', techniqueField = 'rule.mitre.technique', q, start_date, end_date } = {}) {
    const [tacticsRes, techniquesRes] = await Promise.all([
      client.aggregate({
        index: normalizeIndex(index),
        field: tacticField,
        type: 'terms',
        limit: 20,
        q: q || '_exists_:rule.mitre.id',
        start_date: normalizeTimeRange(start_date, end_date).start_date,
        end_date: normalizeTimeRange(start_date, end_date).end_date,
      }),
      client.aggregate({
        index: normalizeIndex(index),
        field: techniqueField,
        type: 'terms',
        limit: 50,
        q: q || '_exists_:rule.mitre.id',
        start_date: normalizeTimeRange(start_date, end_date).start_date,
        end_date: normalizeTimeRange(start_date, end_date).end_date,
      }),
    ])
    return { tactics: tacticsRes, techniques: techniquesRes }
  },

  // 16. Pie — proportional distribution
  async pie({ index, field, size = 10, q, start_date, end_date } = {}) {
    return client.aggregate({
      index: normalizeIndex(index),
      field,
      type: 'terms',
      limit: size,
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 17. Metric — single value stats
  async metric({ index, field, q, start_date, end_date } = {}) {
    const [countRes, statsRes] = await Promise.all([
      client.count({
        index: normalizeIndex(index),
        q: q || undefined,
        start_date: normalizeTimeRange(start_date, end_date).start_date,
        end_date: normalizeTimeRange(start_date, end_date).end_date,
      }),
      field ? client.aggregate({
        index: normalizeIndex(index),
        field,
        type: 'stats',
        q: q || undefined,
        start_date: normalizeTimeRange(start_date, end_date).start_date,
        end_date: normalizeTimeRange(start_date, end_date).end_date,
      }) : Promise.resolve(null),
    ])
    return { count: countRes, stats: statsRes }
  },

  // 18. Data Table — paginated raw results
  async dataTable({ index, q, fields, limit = 50, offset = 0, sort = '@timestamp', order = 'desc', start_date, end_date } = {}) {
    return client.search('search', {
      index: normalizeIndex(index),
      q: q || undefined,
      limit,
      offset,
      sort,
      order,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 19. KQL Filter — query with KQL syntax
  async kqlFilter({ index, q, limit = 10, start_date, end_date } = {}) {
    return client.search('search', {
      index: normalizeIndex(index),
      q: q || '*',
      limit,
      sort: '@timestamp',
      order: 'desc',
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 20. Real-Time Alerts — poll for latest alerts
  async realTimeAlerts({ index, q, since, limit = 50 } = {}) {
    return client.search('search', {
      index: normalizeIndex(index),
      q: q || undefined,
      limit,
      sort: '@timestamp',
      order: 'desc',
      start_date: since || 'now-5m',
      end_date: 'now',
    })
  },

  // 21. Dynamic Builder — extendable query construction
  async dynamicBuilder({ index, aggregationType, field, interval, limit, q, start_date, end_date } = {}) {
    const validTypes = ['terms', 'date_histogram', 'histogram', 'avg', 'min', 'max', 'sum', 'stats', 'percentiles']
    const type = validTypes.includes(aggregationType) ? aggregationType : 'terms'
    return client.aggregate({
      index: normalizeIndex(index),
      field: field || 'rule.level',
      type,
      interval: type === 'date_histogram' ? (interval || '1h') : undefined,
      limit: limit || 10,
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 22. Percentile
  async percentile({ index, field, percents = [50, 95, 99], q, start_date, end_date } = {}) {
    return client.aggregate({
      index: normalizeIndex(index),
      field,
      type: 'percentiles',
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 23. Cardinality (Unique Count)
  async cardinality({ index, field, q, start_date, end_date } = {}) {
    return client.aggregate({
      index: normalizeIndex(index),
      field,
      type: 'cardinality',
      q: q || undefined,
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 24. Geo — coordinate data with geo-point filtering
  async geo({ index, q, start_date, end_date, limit = 100 } = {}) {
    return client.search('search', {
      index: normalizeIndex(index),
      q: q ? `(${q}) AND _exists_:GeoLocation.location` : '_exists_:GeoLocation.location',
      limit,
      sort: '@timestamp',
      order: 'desc',
      start_date: normalizeTimeRange(start_date, end_date).start_date,
      end_date: normalizeTimeRange(start_date, end_date).end_date,
    })
  },

  // 25. Dashboard — multi-metric aggregation
  async dashboard({ index, start_date, end_date } = {}) {
    const idx = normalizeIndex(index)
    const tr = normalizeTimeRange(start_date, end_date)
    const sd = tr.start_date
    const ed = tr.end_date

    const [count24, byLevel, topRules, topAgents, timeline, recent] = await Promise.all([
      client.count({ index: idx, start_date: sd, end_date: ed }),
      client.aggregate({ index: idx, field: 'rule.level', type: 'terms', limit: 20, start_date: sd, end_date: ed }),
      client.aggregate({ index: idx, field: 'rule.id', type: 'terms', limit: 10, start_date: sd, end_date: ed }),
      client.aggregate({ index: idx, field: 'agent.name', type: 'terms', limit: 10, start_date: sd, end_date: ed }),
      client.aggregate({ index: idx, field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48, start_date: sd, end_date: ed }),
      client.search('search', { index: idx, limit: 10, sort: '@timestamp', order: 'desc', q: '', start_date: sd, end_date: ed }),
    ])

    return { count24, byLevel, topRules, topAgents, timeline, recent }
  },

  // 26. MITRE ATT&CK statistics
  async mitreStats({ index, start_date, end_date } = {}) {
    const idx = normalizeIndex(index)
    const tr = normalizeTimeRange(start_date, end_date)
    const qExists = '_exists_:rule.mitre.id'
    const [tactics, techniques, count] = await Promise.all([
      client.aggregate({ index: idx, field: 'rule.mitre.tactic', type: 'terms', limit: 20, q: qExists, start_date: tr.start_date, end_date: tr.end_date }),
      client.aggregate({ index: idx, field: 'rule.mitre.technique', type: 'terms', limit: 50, q: qExists, start_date: tr.start_date, end_date: tr.end_date }),
      client.count({ index: idx, q: qExists, start_date: tr.start_date, end_date: tr.end_date }),
    ])
    return { totalEvents: count, tactics, techniques }
  },
}

module.exports = dataQueryService
