import React from 'react'
import FieldSearch from './FieldSearch'

const BUCKET_TYPES = [
  { value: 'date_histogram', label: 'Date Histogram', needsField: true, interval: true, desc: 'Group by time intervals' },
  { value: 'terms', label: 'Terms', needsField: true, interval: false, desc: 'Group by field values' },
  { value: 'histogram', label: 'Histogram', needsField: true, interval: true, desc: 'Group by numeric ranges' },
  { value: 'range', label: 'Range', needsField: true, interval: false, desc: 'Group by custom ranges' },
  { value: 'filters', label: 'Filters', needsField: false, interval: false, desc: 'Group by query filters' },
  { value: 'geohash', label: 'Geohash', needsField: true, interval: false, desc: 'Group by geo grid' },
  { value: 'nested', label: 'Nested', needsField: true, interval: false, desc: 'Group by nested objects' },
  { value: 'reverse_nested', label: 'Reverse Nested', needsField: false, interval: false, desc: 'Reverse nested grouping' },
]

const FIELD_SUGGESTIONS = [
  { value: '@timestamp', label: '@timestamp' },
  { value: 'rule.id', label: 'rule.id' },
  { value: 'rule.level', label: 'rule.level' },
  { value: 'rule.description', label: 'rule.description' },
  { value: 'rule.groups', label: 'rule.groups' },
  { value: 'rule.firedtimes', label: 'rule.firedtimes' },
  { value: 'rule.frequency', label: 'rule.frequency' },
  { value: 'rule.mitre.id', label: 'rule.mitre.id' },
  { value: 'rule.mitre.tactic', label: 'rule.mitre.tactic' },
  { value: 'rule.mitre.technique', label: 'rule.mitre.technique' },
  { value: 'rule.pci_dss', label: 'rule.pci_dss' },
  { value: 'rule.hipaa', label: 'rule.hipaa' },
  { value: 'rule.gdpr', label: 'rule.gdpr' },
  { value: 'rule.tsc', label: 'rule.tsc' },
  { value: 'rule.cve', label: 'rule.cve' },
  { value: 'agent.name', label: 'agent.name' },
  { value: 'agent.id', label: 'agent.id' },
  { value: 'agent.ip', label: 'agent.ip' },
  { value: 'location', label: 'location' },
  { value: 'decoder.name', label: 'decoder.name' },
  { value: 'decoder.parent', label: 'decoder.parent' },
  { value: 'data.action', label: 'data.action' },
  { value: 'data.srcip', label: 'data.srcip' },
  { value: 'data.dstip', label: 'data.dstip' },
  { value: 'data.srcport', label: 'data.srcport' },
  { value: 'data.dstport', label: 'data.dstport' },
  { value: 'data.protocol', label: 'data.protocol' },
  { value: 'data.url', label: 'data.url' },
  { value: 'full_log', label: 'full_log' },
  { value: 'message', label: 'message' },
  { value: 'syscheck.event', label: 'syscheck.event' },
  { value: 'syscheck.path', label: 'syscheck.path' },
  { value: 'syscheck.md5_after', label: 'syscheck.md5_after' },
  { value: 'syscheck.sha1_after', label: 'syscheck.sha1_after' },
  { value: 'syscheck.sha256_after', label: 'syscheck.sha256_after' },
  { value: 'GeoLocation.country_name', label: 'GeoLocation.country_name' },
  { value: 'GeoLocation.city_name', label: 'GeoLocation.city_name' },
  { value: 'GeoLocation.region_name', label: 'GeoLocation.region_name' },
  { value: 'program_name', label: 'program_name' },
  { value: 'predecoder.program_name', label: 'predecoder.program_name' },
  { value: 'predecoder.hostname', label: 'predecoder.hostname' },
  { value: 'data.vulnerability.severity', label: 'data.vulnerability.severity' },
  { value: 'data.vulnerability.cve', label: 'data.vulnerability.cve' },
  { value: 'data.vulnerability.title', label: 'data.vulnerability.title' },
  { value: 'data.vulnerability.cvss.cvss3.base_score', label: 'data.vulnerability.cvss.cvss3.base_score' },
  { value: 'data.vulnerability.status', label: 'data.vulnerability.status' },
  { value: 'manager.name', label: 'manager.name' },
  { value: 'input.type', label: 'input.type' },
  { value: 'host', label: 'host' },
  { value: 'data.integration', label: 'data.integration' },
  { value: 'data.audit.type', label: 'data.audit.type' },
  { value: 'data.audit.key', label: 'data.audit.key' },
  { value: 'data.audit.command', label: 'data.audit.command' },
  { value: 'data.process.name', label: 'data.process.name' },
  { value: 'data.process.pid', label: 'data.process.pid' },
  { value: 'data.win.eventId', label: 'data.win.eventId' },
  { value: 'data.os.name', label: 'data.os.name' },
  { value: 'data.os.platform', label: 'data.os.platform' },
  { value: 'data.os.version', label: 'data.os.version' },
  { value: 'data.package', label: 'data.package' },
  { value: 'data.program.name', label: 'data.program.name' },
  { value: 'data.program.version', label: 'data.program.version' },
  { value: 'data.title', label: 'data.title' },
  { value: 'data.dstuser', label: 'data.dstuser' },
  { value: 'data.srcuser', label: 'data.srcuser' },
  { value: 'data.file', label: 'data.file' },
  { value: 'data.command', label: 'data.command' },
  { value: 'timestamp', label: 'timestamp' },
  { value: 'id', label: 'id' },
  { value: 'type', label: 'type' },
  { value: 'title', label: 'title' },
  { value: 'offset', label: 'offset' },
  { value: 'cluster.name', label: 'cluster.name' },
  { value: 'cluster.node', label: 'cluster.node' },
]

const INTERVAL_OPTIONS = [
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '3h', label: '3 hours' },
  { value: '6h', label: '6 hours' },
  { value: '12h', label: '12 hours' },
  { value: '1d', label: '1 day' },
  { value: '1w', label: '1 week' },
  { value: '1M', label: '1 month' },
]

export default function XAxisSelector({ value = { bucket: 'date_histogram', field: '@timestamp', interval: '1h', size: 10 }, onChange }) {
  const selected = BUCKET_TYPES.find(b => b.value === value.bucket) || BUCKET_TYPES[0]

  const handleChange = (updates) => {
    onChange?.({ ...value, ...updates })
  }

  const addRange = () => {
    const ranges = value.ranges || []
    handleChange({ ranges: [...ranges, { from: '', to: '', label: '' }] })
  }

  const addFilter = () => {
    const filters = value.filters || []
    handleChange({ filters: [...filters, { query: '', label: '' }] })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">X-Axis Bucket</label>
        <span className="text-[9px] text-zinc-400 font-mono">{selected.desc}</span>
      </div>

      <select
        value={value.bucket}
        onChange={e => {
          const b = BUCKET_TYPES.find(bt => bt.value === e.target.value)
          handleChange({ bucket: e.target.value, field: b?.needsField ? '@timestamp' : '', interval: b?.interval ? '1h' : undefined })
        }}
        className="ginput w-full px-2 py-1.5 text-[10px] font-mono"
      >
        {BUCKET_TYPES.map(b => (
          <option key={b.value} value={b.value}>{b.label} — {b.desc}</option>
        ))}
      </select>

      {selected.needsField && (
        <div>
          <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 block">Field</label>
          <FieldSearch value={value.field || ''} onChange={(v) => handleChange({ field: v })} suggestions={FIELD_SUGGESTIONS} placeholder="Search 70+ fields..." color="#8b5cf6" />
          {value.field && (
            <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-[#8b5cf6]/5 border border-[#8b5cf6]/20 flex items-center gap-2">
              <svg className="w-3 h-3 text-[#8b5cf6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <code className="text-[10px] font-mono text-[#8b5cf6] font-semibold">{value.field}</code>
            </div>
          )}
        </div>
      )}

      {selected.interval && (
        <div>
          <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">Interval</label>
          <select value={value.interval || '1h'} onChange={e => handleChange({ interval: e.target.value })}
            className="ginput w-full px-2 py-1.5 text-[10px]">
            {INTERVAL_OPTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>
      )}

      {value.bucket !== 'date_histogram' && (
        <div>
          <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">Size (max buckets)</label>
          <input type="number" value={value.size || 10} onChange={e => handleChange({ size: parseInt(e.target.value) || 10 })}
            min={1} max={1000} className="ginput w-full px-2 py-1.5 text-[10px]" />
        </div>
      )}

      {value.bucket === 'range' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Ranges</label>
            <button onClick={addRange} className="text-[9px] text-[#EF843C] hover:underline">+ Add Range</button>
          </div>
          <div className="space-y-1">
            {(value.ranges || []).map((r, i) => (
              <div key={i} className="flex gap-1 items-center">
                <input type="text" value={r.from} onChange={e => { const nr = [...value.ranges]; nr[i] = { ...nr[i], from: e.target.value }; handleChange({ ranges: nr }) }}
                  placeholder="From" className="ginput flex-1 px-1.5 py-1 text-[9px]" />
                <span className="text-[9px] text-zinc-400">→</span>
                <input type="text" value={r.to} onChange={e => { const nr = [...value.ranges]; nr[i] = { ...nr[i], to: e.target.value }; handleChange({ ranges: nr }) }}
                  placeholder="To" className="ginput flex-1 px-1.5 py-1 text-[9px]" />
                <input type="text" value={r.label} onChange={e => { const nr = [...value.ranges]; nr[i] = { ...nr[i], label: e.target.value }; handleChange({ ranges: nr }) }}
                  placeholder="Label" className="ginput flex-1 px-1.5 py-1 text-[9px]" />
                <button onClick={() => handleChange({ ranges: value.ranges.filter((_, j) => j !== i) })}
                  className="p-1 text-red-400 hover:text-red-500"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {value.bucket === 'filters' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Filters</label>
            <button onClick={addFilter} className="text-[9px] text-[#EF843C] hover:underline">+ Add Filter</button>
          </div>
          <div className="space-y-1">
            {(value.filters || []).map((f, i) => (
              <div key={i} className="flex gap-1 items-center">
                <input type="text" value={f.query} onChange={e => { const nf = [...value.filters]; nf[i] = { ...nf[i], query: e.target.value }; handleChange({ filters: nf }) }}
                  placeholder="Query (e.g. rule.level:10)" className="ginput flex-1 px-1.5 py-1 text-[9px] font-mono" />
                <input type="text" value={f.label} onChange={e => { const nf = [...value.filters]; nf[i] = { ...nf[i], label: e.target.value }; handleChange({ filters: nf }) }}
                  placeholder="Label" className="ginput flex-1 px-1.5 py-1 text-[9px]" />
                <button onClick={() => handleChange({ filters: value.filters.filter((_, j) => j !== i) })}
                  className="p-1 text-red-400 hover:text-red-500"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
