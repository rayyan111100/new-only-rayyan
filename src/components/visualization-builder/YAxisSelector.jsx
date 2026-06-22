import React from 'react'
import FieldSearch from './FieldSearch'

const METRICS = [
  { value: 'count', label: 'Count', needsField: false, group: 'Common' },
  { value: 'average', label: 'Average', needsField: true, group: 'Common' },
  { value: 'max', label: 'Max', needsField: true, group: 'Common' },
  { value: 'min', label: 'Min', needsField: true, group: 'Common' },
  { value: 'sum', label: 'Sum', needsField: true, group: 'Common' },
  { value: 'median', label: 'Median', needsField: true, group: 'Common' },
  { value: 'unique_count', label: 'Unique Count', needsField: true, group: 'Advanced' },
  { value: 'percentile', label: 'Percentile', needsField: true, group: 'Advanced' },
  { value: 'top_hit', label: 'Top Hit', needsField: true, group: 'Advanced' },
  { value: 'std_dev', label: 'Std Deviation', needsField: true, group: 'Advanced' },
  { value: 'weighted_avg', label: 'Weighted Avg', needsField: true, group: 'Advanced' },
]

const FIELD_SUGGESTIONS = [
  { value: 'rule.level', label: 'rule.level' },
  { value: 'rule.firedtimes', label: 'rule.firedtimes' },
  { value: 'rule.frequency', label: 'rule.frequency' },
  { value: '@timestamp', label: '@timestamp' },
  { value: 'agent.id', label: 'agent.id' },
  { value: 'timestamp', label: 'timestamp' },
  { value: 'data.vulnerability.cvss.cvss3.base_score', label: 'data.vulnerability.cvss.cvss3.base_score' },
  { value: 'data.vulnerability.cvss.cvss2.base_score', label: 'data.vulnerability.cvss.cvss2.base_score' },
  { value: 'data.vulnerability.cvss.cvss3.exploitability_score', label: 'data.vulnerability.cvss.cvss3.exploitability_score' },
  { value: 'data.vulnerability.cvss.cvss3.impact_score', label: 'data.vulnerability.cvss.cvss3.impact_score' },
  { value: 'data.win.eventId', label: 'data.win.eventId' },
  { value: 'rule.mitre.id', label: 'rule.mitre.id' },
  { value: 'data.process.pid', label: 'data.process.pid' },
  { value: 'data.process.ppid', label: 'data.process.ppid' },
  { value: 'data.srcport', label: 'data.srcport' },
  { value: 'data.dstport', label: 'data.dstport' },
  { value: 'data.port.local_port', label: 'data.port.local_port' },
  { value: 'data.port.remote_port', label: 'data.port.remote_port' },
  { value: 'data.port.pid', label: 'data.port.pid' },
  { value: 'data.aws.count', label: 'data.aws.count' },
  { value: 'data.aws.bytes', label: 'data.aws.bytes' },
  { value: 'data.osquery.name', label: 'data.osquery.name' },
  { value: 'data.sca.score', label: 'data.sca.score' },
  { value: 'data.sca.failed', label: 'data.sca.failed' },
  { value: 'data.sca.passed', label: 'data.sca.passed' },
  { value: 'data.cis.score', label: 'data.cis.score' },
  { value: 'data.cis.fail', label: 'data.cis.fail' },
  { value: 'data.cis.pass', label: 'data.cis.pass' },
  { value: 'data.hardware.cpu_cores', label: 'data.hardware.cpu_cores' },
  { value: 'data.hardware.ram_total', label: 'data.hardware.ram_total' },
  { value: 'data.hardware.ram_usage', label: 'data.hardware.ram_usage' },
  { value: 'syscheck.size_after', label: 'syscheck.size_after' },
  { value: 'syscheck.size_before', label: 'syscheck.size_before' },
  { value: 'decoder.accumulate', label: 'decoder.accumulate' },
  { value: 'decoder.fts', label: 'decoder.fts' },
  { value: 'offset', label: 'offset' },
]

export default function YAxisSelector({ value = { metric: 'count', field: '' }, onChange }) {
  const selected = METRICS.find(m => m.value === value.metric) || METRICS[0]

  const handleChange = (updates) => {
    onChange?.({ ...value, ...updates })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Y-Axis Metric</label>
        <span className="text-[9px] text-zinc-400 font-mono">{selected.group}</span>
      </div>

      <select
        value={value.metric}
        onChange={e => handleChange({ metric: e.target.value, field: '' })}
        className="ginput w-full px-2 py-1.5 text-[10px] font-mono"
      >
        {['Common', 'Advanced'].map(group => (
          <optgroup key={group} label={group}>
            {METRICS.filter(m => m.group === group).map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {selected.needsField && (
        <div>
          <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 block">Field</label>
          <FieldSearch value={value.field || ''} onChange={(v) => handleChange({ field: v })} suggestions={FIELD_SUGGESTIONS} placeholder="Search numeric fields..." color="#EF843C" />
          {value.field && (
            <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-[#EF843C]/5 border border-[#EF843C]/20 flex items-center gap-2">
              <svg className="w-3 h-3 text-[#EF843C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <code className="text-[10px] font-mono text-[#EF843C] font-semibold">{value.field}</code>
            </div>
          )}
        </div>
      )}

      <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-lg p-2 border border-zinc-200 dark:border-zinc-700">
        <label className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">Label</label>
        <input
          type="text"
          value={value.label || ''}
          onChange={e => handleChange({ label: e.target.value })}
          placeholder={`${selected.label}${value.field ? ' of ' + value.field : ''}`}
          className="ginput w-full px-2 py-1 text-[10px]"
        />
      </div>

      {value.metric === 'percentile' && (
        <div>
          <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">Percentile</label>
          <select
            value={value.percentile || 95}
            onChange={e => handleChange({ percentile: parseInt(e.target.value) })}
            className="ginput w-full px-2 py-1.5 text-[10px]"
          >
            {[1, 5, 10, 25, 50, 75, 90, 95, 99].map(p => (
              <option key={p} value={p}>p{p}</option>
            ))}
          </select>
        </div>
      )}

      {value.metric === 'top_hit' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Size</label>
            <input type="number" value={value.size || 1} onChange={e => handleChange({ size: parseInt(e.target.value) || 1 })}
              min={1} max={100} className="ginput w-full px-2 py-1 text-[10px]" />
          </div>
          <div>
            <label className="text-[9px] font-medium text-zinc-500 mb-1 block">Sort Order</label>
            <select value={value.sortOrder || 'desc'} onChange={e => handleChange({ sortOrder: e.target.value })}
              className="ginput w-full px-2 py-1 text-[10px]">
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
      )}

      {/* Pipeline Aggregations */}
      <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Pipeline Aggregation</label>
          {value.pipeline && (
            <button onClick={() => handleChange({ pipeline: undefined })}
              className="text-[8px] text-red-500 hover:text-red-600">Clear</button>
          )}
        </div>
        <select
          value={value.pipeline?.type || ''}
          onChange={e => {
            if (!e.target.value) return handleChange({ pipeline: undefined })
            handleChange({ pipeline: { type: e.target.value, params: {} } })
          }}
          className="ginput w-full px-2 py-1 text-[10px] mb-1"
        >
          <option value="">None</option>
          <option value="cumulative_sum">Cumulative Sum</option>
          <option value="derivative">Derivative</option>
          <option value="moving_avg">Moving Average</option>
          <option value="serial_diff">Serial Diff</option>
        </select>
        {value.pipeline?.type === 'moving_avg' && (
          <div>
            <label className="text-[8px] text-zinc-500 mb-0.5 block">Window</label>
            <input type="number" value={value.pipeline.params.window || 5} onChange={e => handleChange({ pipeline: { ...value.pipeline, params: { ...value.pipeline.params, window: parseInt(e.target.value) || 5 } } })}
              min={1} max={50} className="ginput w-full px-2 py-1 text-[10px]" />
          </div>
        )}
        {value.pipeline?.type === 'serial_diff' && (
          <div>
            <label className="text-[8px] text-zinc-500 mb-0.5 block">Lag</label>
            <input type="number" value={value.pipeline.params.lag || 1} onChange={e => handleChange({ pipeline: { ...value.pipeline, params: { ...value.pipeline.params, lag: parseInt(e.target.value) || 1 } } })}
              min={1} max={10} className="ginput w-full px-2 py-1 text-[10px]" />
          </div>
        )}
      </div>
    </div>
  )
}
