class AggregationBuilder {
  constructor() {
    this.aggs = {}
    this.size = 0
  }

  terms({ field, size = 10, order = { _count: 'desc' }, missing } = {}) {
    const agg = { terms: { field, size, order } }
    if (missing) agg.terms.missing = missing
    return this._add('terms', agg)
  }

  dateHistogram({ field = '@timestamp', interval = '1h', minDocCount = 1, extendedBounds, format = 'epoch_millis' } = {}) {
    const agg = { date_histogram: { field, interval, min_doc_count: minDocCount, format } }
    if (extendedBounds) agg.date_histogram.extended_bounds = extendedBounds
    return this._add('date_histogram', agg)
  }

  avg({ field }) {
    return this._add('avg', { avg: { field } })
  }

  min({ field }) {
    return this._add('min', { min: { field } })
  }

  max({ field }) {
    return this._add('max', { max: { field } })
  }

  sum({ field }) {
    return this._add('sum', { sum: { field } })
  }

  stats({ field }) {
    return this._add('stats', { stats: { field } })
  }

  extendedStats({ field, sigma = 2 } = {}) {
    return this._add('extended_stats', { extended_stats: { field, sigma } })
  }

  percentile({ field, percents = [1, 5, 25, 50, 75, 95, 99] } = {}) {
    return this._add('percentiles', { percentiles: { field, percents } })
  }

  cardinality({ field, precisionThreshold = 100 } = {}) {
    return this._add('cardinality', { cardinality: { field, precision_threshold: precisionThreshold } })
  }

  topHits({ size = 1, sort = [{ '@timestamp': { order: 'desc' } }], _source = ['*'] } = {}) {
    return this._add('top_hits', { top_hits: { size, sort, _source } })
  }

  filters(filters) {
    const named = {}
    for (const [name, query] of Object.entries(filters)) {
      named[name] = { query_string: { query: query || '*' } }
    }
    return this._add('filters', { filters: { filters: named } })
  }

  range({ field, ranges = [] }) {
    return this._add('range', { range: { field, ranges } })
  }

  histogram({ field, interval = 10, minDocCount = 1 } = {}) {
    return this._add('histogram', { histogram: { field, interval, min_doc_count: minDocCount } })
  }

  geohashGrid({ field, precision = 3, size = 100 } = {}) {
    return this._add('geohash', { geohash_grid: { field, precision, size } })
  }

  geoCentroid({ field }) {
    return this._add('centroid', { geo_centroid: { field } })
  }

  nested({ path, agg }) {
    return this._add('nested', { nested: { path }, aggs: agg })
  }

  reverseNested({ path } = {}) {
    const agg = { reverse_nested: {} }
    if (path) agg.reverse_nested.path = path
    return this._add('reverse_nested', agg)
  }

  weightedAvg({ valueField, weightField }) {
    return this._add('weighted_avg', {
      weighted_avg: {
        value: { field: valueField },
        weight: { field: weightField },
      },
    })
  }

  pipeline(name, type, params) {
    const pipelineAggs = {
      cumulative_sum: { cumulative_sum: { buckets_path: params.bucketsPath || '_count' } },
      derivative: { derivative: { buckets_path: params.bucketsPath || '_count' } },
      moving_avg: { moving_fn: { buckets_path: params.bucketsPath || '_count', window: params.window || 5, script: 'MovingFunctions.minMaxSum(values)' } },
      serial_diff: { serial_diff: { buckets_path: params.bucketsPath || '_count', lag: params.lag || 1 } },
      avg_bucket: { avg_bucket: { buckets_path: params.bucketsPath || '_count' } },
      sum_bucket: { sum_bucket: { buckets_path: params.bucketsPath || '_count' } },
      max_bucket: { max_bucket: { buckets_path: params.bucketsPath || '_count' } },
      min_bucket: { min_bucket: { buckets_path: params.bucketsPath || '_count' } },
    }
    const pipeline = pipelineAggs[type]
    if (!pipeline) throw new Error(`Unknown pipeline: ${type}`)
    return this._add(name || `pipeline_${type}`, pipeline)
  }

  _add(name, agg) {
    const key = name || `agg_${Object.keys(this.aggs).length + 1}`
    this.aggs[key] = agg
    return this
  }

  build() {
    const result = { size: this.size, aggs: this.aggs }
    if (Object.keys(this.aggs).length === 0) {
      result.size = 0
      result.track_total_hits = true
    }
    return result
  }

  reset() {
    this.aggs = {}
    this.size = 0
    return this
  }
}

module.exports = { AggregationBuilder }
