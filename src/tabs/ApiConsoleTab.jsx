import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useApp } from '../context/AppContext'

const METHODS = ['GET', 'POST', 'PUT', 'DELETE']
const CONTENT_TYPES = ['application/json', 'application/xml', 'application/x-www-form-urlencoded']

const SEARCH_GUIDE = [
  {
    category: 'Count Queries',
    queries: [
      { label: 'All Events Count', q: '*', note: 'All alerts — /api/count returns total count' },
      { label: 'Critical (Level 12)', q: 'rule.level:12', note: '~35 (24h) — use /api/count' },
      { label: 'High (Level 10)', q: 'rule.level:10', note: '~183 (24h) — pfSense blocks, MISP' },
      { label: 'Medium (Level 5)', q: 'rule.level:5', note: '~2,371 (24h) — registry, syscheck' },
      { label: 'Windows Events Count', q: 'rule.groups:windows', note: '~637 (24h) — all Windows events' },
      { label: 'PCI-DSS Tagged', q: '_exists_:rule.pci_dss', note: '~2,740 (24h) — compliance tagged' },
      { label: 'Agent COREGENIX', q: 'agent.name:COREGENIX', note: '~940 (24h) — SQL Server events' },
      { label: 'Agent root', q: 'agent.name:root', note: '~894 (24h) — pfSense, MISP, Action1' },
      { label: 'Rule Groups: syscheck', q: 'rule.groups:syscheck', note: '~47k (7d) — file integrity events' },
      { label: 'Rule Groups: authentication', q: 'rule.groups:authentication', note: '~1.1k (7d) — auth failures' },
    ]
  },
  {
    category: 'Overview',
    queries: [
      { label: 'All Events (24h)', q: '*', note: 'All alerts in last 24 hours' },
      { label: 'All Events (7d)', q: '*', start_date: 'now-7d', note: 'All alerts in last 7 days' },
      { label: 'Event Timeline', q: '*', sort: '@timestamp', order: 'asc', note: 'Chronological order' },
    ]
  },
  {
    category: 'Severity',
    queries: [
      { label: 'Critical (Level 12)', q: 'rule.level:12', note: 'Count: 35 (24h)' },
      { label: 'High (Level 10)', q: 'rule.level:10', note: 'Count: 184 (24h), 1,935 (7d) — pfSense blocks, MISP errors' },
      { label: 'Medium-High (Level 7-9)', q: 'rule.level:7 OR rule.level:8 OR rule.level:9', note: 'Syscheck, registry changes' },
      { label: 'Medium (Level 5)', q: 'rule.level:5', note: 'Count: 2,146 (24h) — System time changes, registry deletes' },
    ]
  },
  {
    category: 'Windows Security',
    queries: [
      { label: 'All Windows Events', q: 'rule.groups:windows', note: 'Count: 631 (24h), 2,960 (7d)' },
      { label: 'Windows Critical (L12)', q: 'rule.level:12 AND rule.groups:windows', note: 'Count: 30 (24h)' },
      { label: 'System Time Changed', q: 'rule.id:60132', note: 'Windows system time modification' },
      { label: 'Software Protection', q: 'rule.id:60642', note: 'Software protection service scheduled' },
    ]
  },
  {
    category: 'Firewall & Network',
    queries: [
      { label: 'pfSense Blocks (L10)', q: 'rule.id:87702', note: 'Multiple pfSense firewall blocks from same source' },
      { label: 'All Firewall Events', q: 'rule.groups:pfsense', note: 'pfSense firewall group events' },
    ]
  },
  {
    category: 'Compliance',
    queries: [
      { label: 'PCI-DSS Events', q: '_exists_:rule.pci_dss', note: '10,000+ results — PCI DSS tagged' },
      { label: 'HIPAA Events', q: '_exists_:rule.hipaa', note: 'HIPAA compliance tagged' },
      { label: 'GDPR Events', q: '_exists_:rule.gdpr', note: 'GDPR compliance tagged' },
      { label: 'MITRE ATT&CK', q: '_exists_:rule.mitre.id', note: 'MITRE ATT&CK mapped' },
    ]
  },
  {
    category: 'Agents',
    queries: [
      { label: 'Agent: COREGENIX', q: 'agent.name:COREGENIX', note: 'Windows SQL Server events (935 count)' },
      { label: 'Agent: Rayyan', q: 'agent.name:Rayyan', note: 'Windows EventChannel, syscheck (775 count)' },
      { label: 'Agent: suyash-window', q: 'agent.name:suyash-window', note: 'Windows events (855 count)' },
      { label: 'Server: root', q: 'agent.name:root', note: 'Server alerts — pfSense, MISP, Action1' },
    ]
  },
  {
    category: 'FIM (File Integrity)',
    queries: [
      { label: 'Registry Key Deleted', q: 'rule.id:597', note: 'Windows registry key deletions' },
      { label: 'File Added', q: 'syscheck.event:added', note: 'New files detected by syscheck' },
      { label: 'File Modified', q: 'syscheck.event:modified', note: 'File modifications detected' },
      { label: 'All Syscheck', q: 'rule.groups:syscheck', note: 'All syscheck events (47k in 7d)' },
    ]
  },
  {
    category: 'Threat Hunting',
    queries: [
      { label: 'MISP Threat Intel', q: 'rule.id:100621', note: 'MISP API connection errors / threat lookups' },
      { label: 'Action1 Logins', q: 'rule.groups:action1', note: 'Action1 remote management activity' },
      { label: 'MS SQL Logons', q: 'rule.id:18181', note: 'MS SQL Server logon success events' },
      { label: 'Multiple Blocks (Same IP)', q: 'data.srcip:36.255.10.162', note: 'pfSense blocks from 36.255.10.162 (Mumbai)' },
    ]
  }
]

const CATEGORIES = {
  'UniShield360 SIEM': [
    { method: 'GET', path: '/health', desc: 'API health check' },
    { method: 'GET', path: '/indices', desc: 'List available indices' },
    { method: 'GET', path: '/index-stats', desc: 'Index statistics' },
    { method: 'GET', path: '/fields', desc: 'Get field mapping', params: [{ name: 'index', type: 'text' }] },
    { method: 'GET', path: '/count', desc: 'Document count', params: [
      { name: 'q', type: 'text' }, { name: 'index', type: 'text' },
      { name: 'start_date', type: 'text' }, { name: 'end_date', type: 'text' },
    ]},
    { method: 'GET', path: '/search', desc: 'Search events', params: [
      { name: 'q', type: 'text' }, { name: 'index', type: 'text' }, { name: 'limit', type: 'number' },
      { name: 'start_date', type: 'text' }, { name: 'end_date', type: 'text' },
      { name: 'sort', type: 'text' }, { name: 'order', type: 'select', options: ['desc', 'asc'] },
    ]},
    { method: 'POST', path: '/search', desc: 'Search events (POST body)', hasBody: true },
    { method: 'POST', path: '/scan', desc: 'Deep pagination scan', hasBody: true },
    { method: 'GET', path: '/aggregate', desc: 'Field aggregations', params: [
      { name: 'field', type: 'text', required: true }, { name: 'type', type: 'select', options: ['terms', 'date_histogram'], required: true },
      { name: 'interval', type: 'text' }, { name: 'limit', type: 'number' }, { name: 'q', type: 'text' },
      { name: 'index', type: 'text' }, { name: 'start_date', type: 'text' }, { name: 'end_date', type: 'text' },
    ]},
    { method: 'GET', path: '/geo', desc: 'GeoIP aggregation', params: [
      { name: 'q', type: 'text' }, { name: 'index', type: 'text' }, { name: 'start_date', type: 'text' }, { name: 'end_date', type: 'text' },
    ]},
    { method: 'GET', path: '/dashboard', desc: 'SOC dashboard', params: [{ name: 'index', type: 'text' }, { name: 'start_date', type: 'text' }, { name: 'end_date', type: 'text' }]},
    { method: 'GET', path: '/compliance', desc: 'Compliance dashboard', params: [{ name: 'index', type: 'text' }, { name: 'start_date', type: 'text' }, { name: 'end_date', type: 'text' }, { name: 'framework', type: 'text' }]},
    { method: 'GET', path: '/windows-dashboard', desc: 'Windows dashboard', params: [{ name: 'index', type: 'text' }, { name: 'start_date', type: 'text' }, { name: 'end_date', type: 'text' }]},
    { method: 'GET', path: '/wazuh-rules', desc: 'Proxy: list rules from manager', params: [{ name: 'q', type: 'text' }, { name: 'limit', type: 'number' }]},
    { method: 'POST', path: '/wazuh-rules', desc: 'Proxy: create rule', hasBody: true },
    { method: 'PUT', path: '/wazuh-rules/:id', desc: 'Proxy: update rule', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/wazuh-rules/{id}', hasBody: true },
    { method: 'DELETE', path: '/wazuh-rules/:id', desc: 'Proxy: delete rule', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/wazuh-rules/{id}', noBody: true },
    { method: 'GET', path: '/wazuh-decoders', desc: 'Proxy: list decoders', params: [{ name: 'q', type: 'text' }, { name: 'limit', type: 'number' }]},
    { method: 'POST', path: '/wazuh-decoders', desc: 'Proxy: create decoder', hasBody: true },
    { method: 'PUT', path: '/wazuh-decoders/:id', desc: 'Proxy: update decoder', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/wazuh-decoders/{id}', hasBody: true },
    { method: 'DELETE', path: '/wazuh-decoders/:id', desc: 'Proxy: delete decoder', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/wazuh-decoders/{id}', noBody: true },
  ],
  'Local CRUD - Rules': [
    { method: 'GET', path: '/rules', desc: 'List all rules' },
    { method: 'POST', path: '/rules', desc: 'Create rule', hasBody: true },
    { method: 'GET', path: '/rules/:id', desc: 'Get rule', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/rules/{id}' },
    { method: 'PUT', path: '/rules/:id', desc: 'Update rule', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/rules/{id}', hasBody: true },
    { method: 'DELETE', path: '/rules/:id', desc: 'Delete rule', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/rules/{id}', noBody: true },
    { method: 'POST', path: '/rules/:id/toggle', desc: 'Toggle rule enabled', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/rules/{id}/toggle', noBody: true },
    { method: 'GET', path: '/rules/groups', desc: 'List rule groups' },
    { method: 'POST', path: '/rules/groups', desc: 'Create rule group', hasBody: true },
    { method: 'POST', path: '/rules/:id/evaluate', desc: 'Evaluate rule', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/rules/{id}/evaluate', hasBody: true },
    { method: 'POST', path: '/rules/evaluate-all', desc: 'Evaluate all rules', hasBody: true },
    { method: 'POST', path: '/rules/batch-evaluate', desc: 'Batch evaluate rules', hasBody: true },
    { method: 'GET', path: '/rules/export-wazuh', desc: 'Export rules as Wazuh XML', params: [{ name: 'ids', type: 'text' }]},
    { method: 'POST', path: '/rules/import-wazuh', desc: 'Import rules from Wazuh XML', hasBody: true },
    { method: 'GET', path: '/rules/:id/versions', desc: 'Get version history', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/rules/{id}/versions' },
    { method: 'POST', path: '/rules/:id/versions', desc: 'Save version snapshot', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/rules/{id}/versions', hasBody: true },
    { method: 'POST', path: '/rules/:id/rollback/:version', desc: 'Rollback to version', params: [{ name: 'id', type: 'text', required: true }, { name: 'version', type: 'text', required: true }], pathPattern: '/rules/{id}/rollback/{version}', noBody: true },
    { method: 'POST', path: '/search/enriched', desc: 'Enriched search + decode', hasBody: true },
  ],
  'Local CRUD - Decoders': [
    { method: 'GET', path: '/decoders', desc: 'List all decoders' },
    { method: 'POST', path: '/decoders', desc: 'Create decoder', hasBody: true },
    { method: 'GET', path: '/decoders/:id', desc: 'Get decoder', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/decoders/{id}' },
    { method: 'PUT', path: '/decoders/:id', desc: 'Update decoder', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/decoders/{id}', hasBody: true },
    { method: 'DELETE', path: '/decoders/:id', desc: 'Delete decoder', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/decoders/{id}', noBody: true },
  ],
  'Local CRUD - Users & Auth': [
    { method: 'POST', path: '/auth/login', desc: 'Login', hasBody: true, bodyExample: { username: 'admin', password: 'your-password' } },
    { method: 'GET', path: '/auth/me', desc: 'Get current user' },
    { method: 'POST', path: '/auth/logout', desc: 'Logout', noBody: true },
    { method: 'GET', path: '/users', desc: 'List users' },
    { method: 'POST', path: '/users', desc: 'Create user', hasBody: true },
    { method: 'PUT', path: '/users/:id', desc: 'Update user', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/users/{id}', hasBody: true },
    { method: 'DELETE', path: '/users/:id', desc: 'Delete user', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/users/{id}', noBody: true },
    { method: 'GET', path: '/settings', desc: 'Get settings' },
    { method: 'GET', path: '/notifications', desc: 'List notifications' },
    { method: 'POST', path: '/notifications', desc: 'Create notification', hasBody: true },
    { method: 'PUT', path: '/notifications/:id', desc: 'Update notification', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/notifications/{id}', hasBody: true },
    { method: 'DELETE', path: '/notifications/:id', desc: 'Delete notification', params: [{ name: 'id', type: 'text', required: true }], pathPattern: '/notifications/{id}', noBody: true },
    { method: 'POST', path: '/notifications/test', desc: 'Test notification webhook', hasBody: true },
    { method: 'GET', path: '/notifications/logs', desc: 'Notification delivery logs' },
    { method: 'GET', path: '/realtime/stats', desc: 'Realtime engine stats' },
  ],
}

const ALL_ENDPOINTS = []
const CATEGORY_MAP = {}
for (const [catName, eps] of Object.entries(CATEGORIES)) {
  for (const ep of eps) {
    CATEGORY_MAP[ALL_ENDPOINTS.length] = catName
    ALL_ENDPOINTS.push(ep)
  }
}

const DEFAULT_PARAMS = {
  index: 'unishield360-alerts-4.x-*',
  start_date: 'now-7d', end_date: 'now',
  limit: '10', sort: '@timestamp', order: 'desc',
  field: 'rule.level', type: 'terms', interval: '1h',
}

function initParams(ep) {
  const p = {}
  for (const pp of ep.params || []) {
    if (pp.value !== undefined) p[pp.name] = pp.value
    else if (pp.name in DEFAULT_PARAMS) p[pp.name] = DEFAULT_PARAMS[pp.name]
    else p[pp.name] = ''
  }
  if (!ep.params) return {}
  return p
}

function buildRequestPath(ep, params) {
  if (ep.pathPattern) {
    let path = ep.pathPattern
    for (const pp of ep.params || []) {
      if (params[pp.name]) path = path.replace(`{${pp.name}}`, params[pp.name])
    }
    return path
  }
  return ep.path
}

function flattenData(obj, prefix) {
  const result = []
  for (const [key, val] of Object.entries(obj)) {
    const k = prefix ? prefix + '.' + key : key
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result.push(...flattenData(val, k))
    } else if (Array.isArray(val)) {
      result.push({ key: k, value: JSON.stringify(val) })
    } else {
      result.push({ key: k, value: val === null || val === undefined ? '' : String(val) })
    }
  }
  return result
}

function ResponseTable({ data }) {
  const rows = []
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === 'object') {
        const cols = [...new Set(data.flatMap(d => Object.keys(d)))]
        return (
          <div className="overflow-auto max-h-96">
            <table className="w-full text-[11px] font-mono border-collapse">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-800">
                  {cols.map(c => <th key={c} className="text-left px-3 py-1.5 font-semibold text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 whitespace-nowrap">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 100).map((row, ri) => (
                  <tr key={ri} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    {cols.map(c => (
                      <td key={c} className="px-3 py-1 border-b border-zinc-100 dark:border-zinc-700/30 text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">
                        {typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 100 && <div className="text-[10px] text-zinc-400 px-3 py-2">Showing 100 of {data.length} rows</div>}
          </div>
        )
      }
      rows.push(...data.map((v, i) => ({ key: '[' + i + ']', value: typeof v === 'object' ? JSON.stringify(v) : String(v) })))
    } else {
      const hit = data.hits || data.results || data.data
      if (Array.isArray(hit) && hit.length > 0 && typeof hit[0] === 'object') {
        const cols = [...new Set(hit.flatMap(d => Object.keys(d)))]
        return (
          <div className="overflow-auto max-h-96">
            <table className="w-full text-[11px] font-mono border-collapse">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-800">
                  {cols.map(c => <th key={c} className="text-left px-3 py-1.5 font-semibold text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 whitespace-nowrap">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {hit.slice(0, 100).map((row, ri) => (
                  <tr key={ri} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    {cols.map(c => (
                      <td key={c} className="px-3 py-1 border-b border-zinc-100 dark:border-zinc-700/30 text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">
                        {typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {hit.length > 100 && <div className="text-[10px] text-zinc-400 px-3 py-2">Showing 100 of {hit.length} rows</div>}
          </div>
        )
      }
      const flat = flattenData(data, '')
      rows.push(...flat)
    }
  } else {
    rows.push({ key: 'value', value: String(data) })
  }
  return (
    <div className="overflow-auto max-h-96">
      <table className="w-full text-[11px] font-mono border-collapse">
        <thead>
          <tr className="bg-zinc-100 dark:bg-zinc-800">
            <th className="text-left px-3 py-1.5 font-semibold text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 w-1/3">Key</th>
            <th className="text-left px-3 py-1.5 font-semibold text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((r, i) => (
            <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
              <td className="px-3 py-1 border-b border-zinc-100 dark:border-zinc-700/30 text-[#EF843C] font-semibold truncate max-w-[250px]">{r.key}</td>
              <td className="px-3 py-1 border-b border-zinc-100 dark:border-zinc-700/30 text-zinc-700 dark:text-zinc-300 truncate max-w-[300px]">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 200 && <div className="text-[10px] text-zinc-400 px-3 py-2">Showing 200 of {rows.length} rows</div>}
    </div>
  )
}

export default function ApiConsoleTab() {
  const { pendingApiEndpoint, setPendingApiEndpoint } = useApp()
  const [viewMode, setViewMode] = useState('json')

  function findEndpointIdx(method, path) {
    return ALL_ENDPOINTS.findIndex(e => {
      if (e.method !== method) return false
      if (e.path === path) return true
      if (e.pathPattern === path) return true
      return false
    })
  }

  const [selected, setSelected] = useState(() => {
    if (pendingApiEndpoint) {
      const idx = findEndpointIdx(pendingApiEndpoint.method, pendingApiEndpoint.path)
      return idx >= 0 ? idx : 0
    }
    return 0
  })
  const [customMode, setCustomMode] = useState(() => {
    if (pendingApiEndpoint) {
      return findEndpointIdx(pendingApiEndpoint.method, pendingApiEndpoint.path) < 0
    }
    return false
  })
  const [customMethod, setCustomMethod] = useState(() => pendingApiEndpoint?.method || 'GET')
  const [customPath, setCustomPath] = useState(() => pendingApiEndpoint?.path || '/search')
  const [tryItOut, setTryItOut] = useState(!!pendingApiEndpoint)
  const [params, setParams] = useState(() => {
    if (pendingApiEndpoint) {
      const idx = findEndpointIdx(pendingApiEndpoint.method, pendingApiEndpoint.path)
      const base = idx >= 0 ? initParams(ALL_ENDPOINTS[idx]) : {}
      return { ...base, ...pendingApiEndpoint.params }
    }
    return initParams(ALL_ENDPOINTS[0])
  })
  const [body, setBody] = useState('')
  const [contentType, setContentType] = useState('application/json')
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('dashboard_token') || '')
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchFilter, setSearchFilter] = useState('')
  const [sections, setSections] = useState({})
  const [showGuide, setShowGuide] = useState(false)
  const [guideCat, setGuideCat] = useState(null)
  const [guideSearch, setGuideSearch] = useState('')

  const ep = ALL_ENDPOINTS[selected]
  const epCategory = CATEGORY_MAP[selected] || ''

  const filteredCategories = {}
  for (const [cat, eps] of Object.entries(CATEGORIES)) {
    const filtered = eps.filter(e =>
      e.path.toLowerCase().includes(searchFilter.toLowerCase()) ||
      e.desc.toLowerCase().includes(searchFilter.toLowerCase()) ||
      e.method.toLowerCase().includes(searchFilter.toLowerCase()) ||
      cat.toLowerCase().includes(searchFilter.toLowerCase())
    )
    if (filtered.length > 0) filteredCategories[cat] = filtered
  }

  useEffect(() => {
    if (pendingApiEndpoint) {
      const idx = findEndpointIdx(pendingApiEndpoint.method, pendingApiEndpoint.path)
      if (idx >= 0) {
        setSelected(idx)
        setCustomMode(false)
        setParams(prev => ({ ...initParams(ALL_ENDPOINTS[idx]), ...pendingApiEndpoint.params }))
      } else {
        setCustomMode(true)
        setCustomMethod(pendingApiEndpoint.method)
        setCustomPath(pendingApiEndpoint.path)
        setParams(pendingApiEndpoint.params || {})
      }
      setPendingApiEndpoint(null)
      setTryItOut(true)
      setResponse(null)
      setError(null)
      return
    }
  }, [])

  useEffect(() => {
    if (!ep || customMode) return
    setParams(initParams(ep))
    if (ep.hasBody) {
      const ex = ep.bodyExample
      setBody(JSON.stringify(ex || { query: { match_all: {} }, limit: 10 }, null, 2))
    } else {
      setBody('')
    }
    setResponse(null)
    setError(null)
    setSections({})
  }, [selected, customMode])

  function applyGuideQuery(item) {
    const searchIdx = ALL_ENDPOINTS.findIndex(e => e.path === '/search' && e.method === 'GET')
    if (searchIdx >= 0) {
      setSelected(searchIdx)
      setCustomMode(false)
    } else {
      setCustomMode(true)
      setCustomMethod('GET')
      setCustomPath('/search')
    }
    setTryItOut(true)
    const newParams = {
      index: 'unishield360-alerts-4.x-*',
      limit: '10',
      sort: '@timestamp',
      order: 'desc',
      start_date: item.start_date || 'now-24h',
      end_date: 'now',
      q: item.q || '*',
    }
    setParams(newParams)
    setResponse(null)
    setError(null)
    setTimeout(() => execute(), 50)
  }

  function toggleSection(title) {
    setSections(prev => ({ ...prev, [title]: !prev[title] }))
  }

  function isOpen(title) {
    return sections[title] !== undefined ? sections[title] : true
  }

  function CollapsibleSection({ title, children }) {
    const open = isOpen(title)
    return (
      <div className="border border-[#e8eaed] dark:border-[#2a3042] rounded-lg overflow-hidden">
        <button onClick={() => toggleSection(title)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-[#f8f9fa] dark:bg-[#111624] text-[11px] font-semibold text-soc-text dark:text-soc-darktext hover:bg-[#f1f3f4] dark:hover:bg-[#1a1f30] transition-colors"
        >
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          {title}
        </button>
        {open && <div className="p-3">{children}</div>}
      </div>
    )
  }

  function setParam(name, value) {
    setParams(prev => ({ ...prev, [name]: value }))
  }

  function getActiveEndpoint() {
    if (customMode) return { method: customMethod, path: customPath, hasBody: ['POST', 'PUT'].includes(customMethod) }
    return ep
  }

  async function execute() {
    const active = getActiveEndpoint()
    setLoading(true)
    setError(null)
    setResponse(null)
    try {
      const headers = { 'Content-Type': contentType }
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      let path
      if (customMode) {
        path = customPath
      } else {
        path = buildRequestPath(ep, params)
      }

      const url = '/api' + path
      let res

      if (['GET', 'DELETE'].includes(active.method)) {
        const queryParams = {}
        if (!customMode) {
          const pathParamNames = new Set(
            (ep.pathPattern && ep.params || [])
              .filter(p => ep.pathPattern?.includes(`{${p.name}}`))
              .map(p => p.name)
          )
          for (const [k, v] of Object.entries(params)) {
            if (v !== '' && v !== undefined && !pathParamNames.has(k)) {
              queryParams[k] = v
            }
          }
        } else {
          for (const [k, v] of Object.entries(params)) {
            if (v !== '' && v !== undefined) queryParams[k] = v
          }
        }
        const qs = new URLSearchParams(queryParams).toString()
        const fullUrl = url + (qs ? '?' + qs : '')

        if (active.method === 'GET') res = await axios.get(fullUrl, { headers, timeout: 60000 })
        else res = await axios.delete(fullUrl, { headers, timeout: 60000 })
      } else {
        let parsedBody
        try { parsedBody = JSON.parse(body) } catch { throw new Error('Invalid JSON in request body') }
        if (active.method === 'POST') res = await axios.post(url, parsedBody, { headers, timeout: 60000 })
        else res = await axios.put(url, parsedBody, { headers, timeout: 60000 })
      }
      setResponse({ status: res.status, data: res.data })
    } catch (e) {
      const msg = e.response?.data || e.message
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2))
      setResponse({ status: e.response?.status || 0, data: e.response?.data || e.message })
    } finally {
      setLoading(false)
    }
  }

  function getCurl() {
    const active = getActiveEndpoint()
    const path = customMode ? customPath : buildRequestPath(ep, params)
    let cmd = `curl -X ${active.method}`
    if (authToken) cmd += ` -H "Authorization: Bearer ${authToken}"`
    if (['GET', 'DELETE'].includes(active.method)) {
      const qp = {}
      if (!customMode) {
        const pathParamNames = new Set(
          (ep.pathPattern && ep.params || [])
            .filter(p => ep.pathPattern?.includes(`{${p.name}}`))
            .map(p => p.name)
        )
        for (const [k, v] of Object.entries(params)) {
          if (v !== '' && v !== undefined && !pathParamNames.has(k)) qp[k] = v
        }
      } else {
        for (const [k, v] of Object.entries(params)) if (v !== '' && v !== undefined) qp[k] = v
      }
      const qs = new URLSearchParams(qp).toString()
      cmd += ` "http://localhost:3000/api${path}${qs ? '?' + qs : ''}"`
    } else {
      cmd += ` -H "Content-Type: ${contentType}"`
      cmd += ` -d '${body}'`
      cmd += ` "http://localhost:3000/api${path}"`
    }
    return cmd
  }

  const active = getActiveEndpoint()

  return (
    <div className="flex h-full gap-3">
      <div className="w-64 shrink-0 flex flex-col">
        <div className="gcard p-3 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-soc-text dark:text-soc-darktext">Endpoints</span>
            <div className="flex gap-1">
              <button onClick={() => setShowGuide(!showGuide)}
                className={`text-[9px] px-2 py-1 rounded font-medium border transition-colors ${
                  showGuide ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]' : 'text-soc-stext border-[#e8eaed] dark:border-[#2a3042] hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042]'
                }`}
              >Guide</button>
              <button onClick={() => { setCustomMode(!customMode); setResponse(null); setError(null) }}
                className={`text-[9px] px-2 py-1 rounded font-medium border transition-colors ${
                  customMode ? 'bg-[#EF843C] text-white border-[#EF843C]' : 'text-soc-stext border-[#e8eaed] dark:border-[#2a3042] hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042]'
                }`}
              >Custom</button>
            </div>
          </div>
          {customMode ? (
            <div className="space-y-2">
              <div className="flex gap-1">
                <select value={customMethod} onChange={e => setCustomMethod(e.target.value)}
                  className="ginput w-20 px-1 py-1 text-[10px] font-bold">
                  {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input type="text" value={customPath} onChange={e => setCustomPath(e.target.value)}
                  placeholder="/path" className="ginput flex-1 px-2 py-1 text-[11px] font-mono"
                />
              </div>
              <button onClick={execute} disabled={loading}
                className="w-full py-1.5 text-[11px] font-semibold rounded bg-[#EF843C] text-white hover:bg-[#e0732a] transition-colors"
              >{loading ? 'Sending...' : 'Send'}</button>
            </div>
          ) : (
            <>
              <input type="text" value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
                placeholder="Search endpoints..." className="ginput px-2 py-1 text-[11px] mb-2"
              />
              <div className="flex-1 overflow-y-auto space-y-3">
                {Object.entries(filteredCategories).map(([cat, eps]) => (
                  <div key={cat}>
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-soc-stext/60 dark:text-soc-darkstext/60 mb-1 px-1">{cat}</div>
                    <div className="space-y-0.5">
                      {eps.map((e) => {
                        const idx = ALL_ENDPOINTS.indexOf(e)
                        return (
                          <button key={idx} onClick={() => { setSelected(idx); setCustomMode(false) }}
                            className={`w-full text-left px-2 py-1 rounded transition-colors ${
                              selected === idx && !customMode ? 'bg-[#EF843C]/10' : 'hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042]'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 ${
                                e.method === 'GET' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                e.method === 'POST' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                e.method === 'PUT' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}>{e.method}</span>
                              <span className="font-mono text-[10px] text-soc-text dark:text-soc-darktext truncate">{e.path}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto">
        <div className="gcard p-4">
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[#e8eaed] dark:border-[#2a3042]">
            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
              active.method === 'GET' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              active.method === 'POST' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
              active.method === 'PUT' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>{active.method}</span>
            <div>
              <code className="text-sm font-mono text-soc-text dark:text-soc-darktext">
                /api{active.path}
                {!customMode && ep.pathPattern && ep.pathPattern !== ep.path && (
                  <span className="text-soc-stext text-[10px] ml-2">→ {ep.pathPattern}</span>
                )}
              </code>
              {!customMode && <div className="text-[10px] text-soc-stext dark:text-soc-darkstext">{ep.desc}</div>}
              {customMode && <div className="text-[10px] text-soc-stext dark:text-soc-darkstext">Custom request</div>}
            </div>
            <div className="flex-1" />
            <button onClick={() => setTryItOut(!tryItOut)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded border transition-colors ${
                tryItOut
                  ? 'bg-[#EF843C] text-white border-[#EF843C]'
                  : 'bg-white dark:bg-transparent text-soc-text dark:text-soc-darktext border-[#e8eaed] dark:border-[#2a3042] hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042]'
              }`}
            >{tryItOut ? 'Cancel' : 'Try it out'}</button>
          </div>

          <div className="space-y-2">
            <CollapsibleSection title="Authorization">
              <div className="flex items-center gap-2">
                <select className="ginput w-28 px-2 py-1 text-[11px]" value="bearer" onChange={() => {}}>
                  <option value="bearer">Bearer</option>
                </select>
                <input type="text" value={authToken} onChange={e => {
                  setAuthToken(e.target.value)
                  localStorage.setItem('dashboard_token', e.target.value)
                }} placeholder="Enter Bearer token..."
                  className="ginput flex-1 px-2 py-1 text-[11px] font-mono"
                />
              </div>
              <div className="text-[10px] text-soc-stext dark:text-soc-darkstext mt-1">
                Token auto-attached from login. You can override it above.
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Parameters">
              {!customMode && (!ep.params || ep.params.length === 0) && !ep.hasBody ? (
                <div className="text-[11px] text-soc-stext dark:text-soc-darkstext italic">No parameters</div>
              ) : tryItOut && active.method !== 'POST' && active.method !== 'PUT' ? (
                <div className="grid grid-cols-2 gap-2">
                  {(customMode ? Object.keys(params).map(k => ({ name: k, type: 'text' })) : ep.params || []).map(p => (
                    <div key={p.name} className="flex items-center gap-2">
                      <label className="text-[11px] font-medium text-soc-stext dark:text-soc-darkstext w-28 shrink-0 flex items-center gap-1">
                        {p.name}
                        {p.required && <span className="text-red-500">*</span>}
                      </label>
                      {p.type === 'select' ? (
                        <select value={params[p.name] || ''} onChange={e => setParam(p.name, e.target.value)}
                          className="ginput flex-1 px-2 py-1 text-[11px] font-mono"
                        >
                          <option value="">--</option>
                          {p.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type={p.type} value={params[p.name] || ''} onChange={e => setParam(p.name, e.target.value)}
                          placeholder={p.name} className="ginput flex-1 px-2 py-1 text-[11px] font-mono"
                          disabled={!tryItOut}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-soc-stext dark:text-soc-darkstext">
                  {active.method === 'POST' || active.method === 'PUT'
                    ? 'This endpoint uses a request body.'
                    : 'Toggle "Try it out" to edit parameters.'}
                </div>
              )}
            </CollapsibleSection>

            {(active.method === 'POST' || active.method === 'PUT') && (
              <CollapsibleSection title="Request body">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-[10px] font-medium text-soc-stext dark:text-soc-darkstext">Content-Type:</label>
                  <select value={contentType} onChange={e => setContentType(e.target.value)}
                    className="ginput px-2 py-1 text-[11px] font-mono">
                    {CONTENT_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                  </select>
                  <div className="flex-1" />
                  {!customMode && ep.bodyExample && (
                    <button onClick={() => setBody(JSON.stringify(ep.bodyExample, null, 2))}
                      className="text-[10px] px-2 py-1 rounded text-soc-stext hover:text-soc-accent hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042] transition-colors"
                    >Load Example</button>
                  )}
                </div>
                <textarea value={body} onChange={e => setBody(e.target.value)}
                  className="ginput w-full px-3 py-2 text-[11px] font-mono resize-y"
                  rows={8} spellCheck={false} disabled={!tryItOut}
                  placeholder='{"key": "value"}'
                />
              </CollapsibleSection>
            )}

            {tryItOut && (
              <>
                {!customMode && active.method === 'GET' && ep.params && ep.params.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => setParams(initParams(ep))}
                      className="text-[10px] text-soc-stext hover:text-soc-accent transition-colors underline"
                    >Reset defaults</button>
                  </div>
                )}
                <button onClick={execute} disabled={loading}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                    active.method === 'GET' ? 'bg-green-600 hover:bg-green-700 text-white' :
                    active.method === 'POST' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                    active.method === 'PUT' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                    'bg-red-600 hover:bg-red-700 text-white'
                  } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {loading ? (
                    <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Sending request...</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Execute</>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="gcard p-3 border-l-4 border-red-500">
            <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Error</div>
            <pre className="text-[11px] text-red-500 dark:text-red-300 font-mono whitespace-pre-wrap overflow-auto max-h-32">{error}</pre>
          </div>
        )}

        {response && (
          <div className="gcard">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#e8eaed] dark:border-[#2a3042]">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-soc-text dark:text-soc-darktext">Response</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  response.status >= 200 && response.status < 300
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : response.status >= 400 && response.status < 500
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {response.status}
                  {response.status === 200 ? ' OK' : response.status === 201 ? ' Created' : response.status === 204 ? ' No Content' : response.status === 400 ? ' Bad Request' : response.status === 401 ? ' Unauthorized' : response.status === 403 ? ' Forbidden' : response.status === 404 ? ' Not Found' : response.status === 500 ? ' Server Error' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 mr-1">
                  <button onClick={() => setViewMode('json')}
                    className={`px-2 py-0.5 text-[9px] font-semibold rounded-md transition-colors ${viewMode === 'json' ? 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 shadow-sm' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600'}`}>JSON</button>
                  <button onClick={() => setViewMode('table')}
                    className={`px-2 py-0.5 text-[9px] font-semibold rounded-md transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 shadow-sm' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600'}`}>Table</button>
                </div>
                <button onClick={() => navigator.clipboard.writeText(JSON.stringify(response.data, null, 2))}
                  className="text-[10px] px-2 py-1 rounded text-soc-stext hover:text-soc-accent hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042] transition-colors"
                >Copy</button>
                <button onClick={() => navigator.clipboard.writeText(getCurl())}
                  className="text-[10px] px-2 py-1 rounded text-soc-stext hover:text-soc-accent hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042] transition-colors"
                >cURL</button>
              </div>
            </div>
            {viewMode === 'table' ? (
              <div className="p-1">
                <ResponseTable data={response.data} />
              </div>
            ) : (
              <pre className="text-[11px] text-soc-text dark:text-soc-darktext font-mono whitespace-pre-wrap overflow-auto max-h-96 p-4 bg-[#f8f9fa] dark:bg-[#111624]">
                {JSON.stringify(response.data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Search Guide Panel */}
      {showGuide && (
        <div className="w-72 shrink-0 flex flex-col border-l border-[#e8eaed] dark:border-[#2a3042] bg-white dark:bg-[#1a1d27] rounded-r-xl">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#e8eaed] dark:border-[#2a3042]">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-[#8b5cf6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <span className="text-[11px] font-semibold text-soc-text dark:text-soc-darktext">Query Guide</span>
            </div>
            <button onClick={() => setShowGuide(false)}
              className="p-1 rounded hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042] text-soc-stext transition-colors">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="px-3 py-2">
            <input type="text" value={guideSearch} onChange={e => setGuideSearch(e.target.value)}
              placeholder="Filter queries..." className="ginput w-full px-2 py-1 text-[10px]"
            />
          </div>
          <div className="flex flex-wrap gap-1 px-3 pb-2">
            <button onClick={() => setGuideCat(null)}
              className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${!guideCat ? 'bg-[#8b5cf6] text-white' : 'bg-[#f1f3f4] dark:bg-[#2a3042] text-soc-stext hover:bg-white dark:hover:bg-[#3d4152]'}`}>All</button>
            {SEARCH_GUIDE.map(sg => (
              <button key={sg.category} onClick={() => setGuideCat(guideCat === sg.category ? null : sg.category)}
                className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${guideCat === sg.category ? 'bg-[#8b5cf6] text-white' : 'bg-[#f1f3f4] dark:bg-[#2a3042] text-soc-stext hover:bg-white dark:hover:bg-[#3d4152]'}`}>{sg.category}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
            {SEARCH_GUIDE.filter(sg => !guideCat || sg.category === guideCat).map(sg => (
              <div key={sg.category}>
                <div className="text-[8px] font-semibold uppercase tracking-wider text-soc-stext/50 dark:text-soc-darkstext/50 mb-1 px-0.5">{sg.category}</div>
                {sg.queries.filter(q => !guideSearch || q.label.toLowerCase().includes(guideSearch.toLowerCase()) || q.q.toLowerCase().includes(guideSearch.toLowerCase())).map((q, i) => (
                  <button key={i} onClick={() => applyGuideQuery(q)}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042] transition-colors group border border-transparent hover:border-[#e8eaed] dark:hover:border-[#3d4152] mb-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <code className="text-[9px] font-mono font-semibold text-[#EF843C] group-hover:text-[#e0752a] transition-colors truncate flex-1">{q.q}</code>
                      <svg className="w-3 h-3 shrink-0 text-soc-stext/30 group-hover:text-[#EF843C] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-medium text-soc-text dark:text-soc-darktext truncate">{q.label}</span>
                    </div>
                    {q.note && <div className="text-[8px] text-soc-stext/50 dark:text-soc-darkstext/50 mt-0.5 leading-tight">{q.note}</div>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
