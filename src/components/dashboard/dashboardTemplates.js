export const DASHBOARD_TEMPLATES = {
  'soc-overview-v2': {
    name: 'SOC Overview',
    description: 'Real-time SOC overview with alert metrics, EPS, ingestion, top rules, event timeline, and agent logs',
    category: 'soc',
    icon: 'SO',
    timeRange: { from: 'now-24h', to: 'now' },
    refreshInterval: 60,
    panels: [
      // Row 1: Alert Metrics (h=4 = 100px)
      { id: 'tpl_soc_total', title: 'Total Alerts', type: 'metric', x: 0, y: 0, w: 2, h: 4, query: { language: 'lucene', query: '', aggregation: { type: 'count' } }, vizConfig: { suffix: 'alerts', accent: '#8b5cf6' } },
      { id: 'tpl_soc_agents', title: 'Active Agents', type: 'metric', x: 2, y: 0, w: 2, h: 4, query: { language: 'lucene', query: '', aggregation: { field: 'agent.name', type: 'cardinality' } }, vizConfig: { suffix: 'agents', accent: '#10b981' } },
      { id: 'tpl_soc_crit', title: 'Critical', type: 'metric', x: 4, y: 0, w: 2, h: 4, query: { language: 'lucene', query: 'rule.level:[15 TO *]', aggregation: { type: 'count' } }, vizConfig: { suffix: 'alerts', accent: '#ef4444' } },
      { id: 'tpl_soc_high', title: 'High', type: 'metric', x: 6, y: 0, w: 2, h: 4, query: { language: 'lucene', query: 'rule.level:[12 TO 14]', aggregation: { type: 'count' } }, vizConfig: { suffix: 'alerts', accent: '#f59e0b' } },
      { id: 'tpl_soc_med', title: 'Medium', type: 'metric', x: 8, y: 0, w: 2, h: 4, query: { language: 'lucene', query: 'rule.level:[7 TO 11]', aggregation: { type: 'count' } }, vizConfig: { suffix: 'alerts', accent: '#d29922' } },
      { id: 'tpl_soc_low', title: 'Low', type: 'metric', x: 10, y: 0, w: 2, h: 4, query: { language: 'lucene', query: 'rule.level:[0 TO 6]', aggregation: { type: 'count' } }, vizConfig: { suffix: 'alerts', accent: '#3fb950' } },
      // Row 2: EPS & Ingestion (h=4 = 100px)
      { id: 'tpl_soc_eps', title: 'EPS Count', type: 'metric', dataSource: 'eps-stats', x: 0, y: 4, w: 3, h: 4, query: {}, vizConfig: { metricKey: 'eps60', accent: '#06b6d4', suffix: 'eps' } },
      { id: 'tpl_soc_ingest', title: 'Ingestion Volume', type: 'metric', dataSource: 'eps-stats', x: 3, y: 4, w: 3, h: 4, query: {}, vizConfig: { metricKey: 'totalIngestGB', accent: '#10b981', suffix: 'GB' } },
      { id: 'tpl_soc_minIngest', title: 'Min Ingest Rate', type: 'metric', dataSource: 'eps-stats', x: 6, y: 4, w: 3, h: 4, query: {}, vizConfig: { metricKey: 'minIngestRate', accent: '#8b5cf6', suffix: 'KB/s' } },
      { id: 'tpl_soc_maxIngest', title: 'Max Ingest Rate', type: 'metric', dataSource: 'eps-stats', x: 9, y: 4, w: 3, h: 4, query: {}, vizConfig: { metricKey: 'maxIngestRate', accent: '#ef4444', suffix: 'KB/s' } },
      // Row 3: Top 5 Rules (h=5 = 125px)
      { id: 'tpl_soc_toprules', title: 'Top 5 Rules', type: 'table', x: 0, y: 8, w: 12, h: 5, query: { language: 'lucene', query: '', aggregation: { field: 'rule.id', type: 'terms', limit: 5 } }, vizConfig: { tableColumns: ['#', 'key', 'doc_count'], accent: '#EF843C' } },
      // Row 4: Charts (h=6 = 150px matching GDPR h-[150px])
      { id: 'tpl_soc_timeline', title: 'Event Timeline', type: 'area', dataSource: 'eps-stats', x: 0, y: 13, w: 4, h: 6, query: {}, vizConfig: { chartKey: 'eventRate', fill: 'tozeroy', accent: '#EF843C' } },
      { id: 'tpl_soc_epsTrend', title: 'EPS Trend', type: 'line', dataSource: 'eps-stats', x: 4, y: 13, w: 4, h: 6, query: {}, vizConfig: { chartKey: 'epsTrend', accent: '#06b6d4' } },
      { id: 'tpl_soc_combined', title: 'Combined View', type: 'bar', dataSource: 'eps-stats', x: 8, y: 13, w: 4, h: 6, query: {}, vizConfig: { chartKey: 'combinedTrend', accent: '#8b5cf6' } },
      // Row 5: Tables & Bar (h=5 = 125px)
      { id: 'tpl_soc_events', title: 'Events (Rule Description)', type: 'table', x: 0, y: 19, w: 6, h: 5, query: { language: 'lucene', query: '', aggregation: { field: 'rule.description', type: 'terms', limit: 6 } }, vizConfig: { tableColumns: ['#', 'key', 'doc_count'], accent: '#8b5cf6' } },
      { id: 'tpl_soc_agentLogs', title: 'Agents - Logs', type: 'bar', x: 6, y: 19, w: 6, h: 5, query: { language: 'lucene', query: '', aggregation: { field: 'agent.name', type: 'terms', limit: 10 } }, vizConfig: { palette: 'warm', accent: '#EF843C' } },
    ]
  },
}
export const TEMPLATE_CATEGORIES = [
  { id: 'soc', label: 'SOC', icon: 'SO', desc: 'Security Operations Center views' },
  { id: 'executive', label: 'Executive', icon: 'ED', desc: 'Executive summary and KPIs' },
  { id: 'security', label: 'Security', icon: 'SE', desc: 'Security monitoring dashboards' },
  { id: 'platform', label: 'Platform', icon: 'PL', desc: 'Platform-specific monitoring' },
  { id: 'network', label: 'Network', icon: 'FW', desc: 'Network security dashboards' },
  { id: 'user', label: 'My Templates', icon: 'CU', desc: 'Your saved dashboard templates' },
]

const USER_TPL_KEY = 'unishield_user_templates'

export function getUserTemplates() {
  try { return JSON.parse(localStorage.getItem(USER_TPL_KEY) || '{}') } catch { return {} }
}

function saveUserTemplates(map) {
  localStorage.setItem(USER_TPL_KEY, JSON.stringify(map))
}

export function saveUserTemplate(name, dashboard) {
  const map = getUserTemplates()
  const id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)
  map[id] = {
    name: name || 'Custom Template',
    description: 'Saved on ' + new Date().toLocaleDateString(),
    category: 'user',
    icon: 'CU',
    timeRange: dashboard.timeRange || { from: 'now-24h', to: 'now' },
    refreshInterval: dashboard.refreshInterval || 0,
    panels: (dashboard.panels || []).map(p => ({ ...p })),
  }
  saveUserTemplates(map)
  return id
}

export function deleteUserTemplate(id) {
  const map = getUserTemplates()
  delete map[id]
  saveUserTemplates(map)
}

export function getTemplateList() {
  const builtIn = Object.entries(DASHBOARD_TEMPLATES).map(([id, tpl]) => ({
    id, name: tpl.name, description: tpl.description,
    category: tpl.category, icon: tpl.icon, panelCount: tpl.panels.length,
  }))
  const user = Object.entries(getUserTemplates()).map(([id, tpl]) => ({
    id, name: tpl.name, description: tpl.description,
    category: 'user', icon: tpl.icon, panelCount: tpl.panels.length,
  }))
  return [...builtIn, ...user]
}

export function getTemplate(id) {
  if (id.startsWith('user_')) return getUserTemplates()[id] || null
  return DASHBOARD_TEMPLATES[id] || null
}

export function createFromTemplate(templateId) {
  const tpl = getTemplate(templateId)
  if (!tpl) return null
  const now = new Date().toISOString()
  return {
    id: 'dash_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    name: tpl.name,
    description: tpl.description,
    category: tpl.category || 'general',
    tags: [],
    template: templateId,
    version: 1,
    starred: false,
    createdAt: now,
    updatedAt: now,
    timeRange: { ...tpl.timeRange },
    refreshInterval: tpl.refreshInterval || 0,
    globalFilters: [],
    panels: tpl.panels.map(p => ({
      ...p,
      id: 'panel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    })),
  }
}
