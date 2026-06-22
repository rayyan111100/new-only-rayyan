export const DASHBOARD_TEMPLATES = {
  'soc-overview': {
    name: 'SOC Overview',
    description: 'Real-time SOC monitoring with key metrics, alert timeline, top rules, and recent alerts',
    category: 'soc',
    icon: 'SO',
    timeRange: { from: 'now-24h', to: 'now' },
    refreshInterval: 60,
    panels: [
      { id: 'tpl_metric1', title: 'Total Alerts', type: 'metric', dataSource: 'alerts', x: 0, y: 0, w: 6, h: 7, query: { language: 'lucene', query: '', aggregation: { type: 'count' } }, config: { suffix: 'events', color: '#8b5cf6' } },
      { id: 'tpl_metric2', title: 'Critical', type: 'metric', dataSource: 'alerts', x: 6, y: 0, w: 6, h: 7, query: { language: 'lucene', query: 'rule.level:12 OR rule.level:13 OR rule.level:14 OR rule.level:15', aggregation: { type: 'count' } }, config: { suffix: 'alerts', color: '#ef4444' } },
      { id: 'tpl_metric3', title: 'Active Agents', type: 'metric', dataSource: 'alerts', x: 12, y: 0, w: 6, h: 7, query: { language: 'lucene', query: '', aggregation: { field: 'agent.name', type: 'cardinality' } }, config: { suffix: 'agents', color: '#10b981' } },
      { id: 'tpl_metric4', title: 'Alert Rate', type: 'metric', dataSource: 'alerts', x: 18, y: 0, w: 6, h: 7, query: { language: 'lucene', query: '', aggregation: { type: 'count' } }, config: { suffix: '/hr', color: '#06b6d4' } },
      { id: 'tpl_timeline', title: 'Alert Timeline', type: 'area', dataSource: 'alerts', x: 0, y: 7, w: 12, h: 13, query: { language: 'lucene', query: '', aggregation: { field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48 } }, config: { fill: 'tozeroy', lineColor: '#EF843C' } },
      { id: 'tpl_rules', title: 'Top Rules', type: 'bar', dataSource: 'alerts', x: 12, y: 7, w: 6, h: 13, query: { language: 'lucene', query: '', aggregation: { field: 'rule.id', type: 'terms', limit: 10 } }, config: { palette: 'warm' } },
      { id: 'tpl_severity', title: 'Severity', type: 'pie', dataSource: 'alerts', x: 18, y: 7, w: 6, h: 13, query: { language: 'lucene', query: '', aggregation: { field: 'rule.level', type: 'terms', limit: 10 } }, config: { donut: true } },
      { id: 'tpl_recent', title: 'Recent Alerts', type: 'table', dataSource: 'alerts', x: 0, y: 20, w: 24, h: 13, query: { language: 'lucene', query: '', sort: { field: '@timestamp', order: 'desc' }, limit: 10 }, config: { sortable: true, pageSize: 10 } },
    ]
  },
  'executive': {
    name: 'Executive Dashboard',
    description: 'Executive summary with security posture, compliance status, and risk metrics',
    category: 'executive',
    icon: 'ED',
    timeRange: { from: 'now-7d', to: 'now' },
    refreshInterval: 300,
    panels: [
      { id: 'tpl_exe_metric1', title: 'Security Posture', type: 'gauge', dataSource: 'alerts', x: 0, y: 0, w: 6, h: 10, query: { language: 'lucene', query: 'rule.level:12 OR rule.level:13 OR rule.level:14 OR rule.level:15', aggregation: { type: 'count' } }, config: { max: 100, label: 'Score', ranges: [{ from: 0, to: 33, color: '#10b981' }, { from: 33, to: 66, color: '#f59e0b' }, { from: 66, to: 100, color: '#ef4444' }] } },
      { id: 'tpl_exe_trend', title: 'Event Trend', type: 'line', dataSource: 'alerts', x: 6, y: 0, w: 12, h: 10, query: { language: 'lucene', query: '', aggregation: { field: '@timestamp', type: 'date_histogram', interval: '1d', limit: 30 } }, config: { smoothing: true, showMarkers: true } },
      { id: 'tpl_exe_compliance', title: 'Compliance', type: 'pie', dataSource: 'alerts', x: 18, y: 0, w: 6, h: 10, query: { language: 'lucene', query: '_exists_:rule.pci_dss OR _exists_:rule.hipaa OR _exists_:rule.gdpr', aggregation: { field: 'rule.pci_dss', type: 'terms', limit: 5 } }, config: { donut: true } },
      { id: 'tpl_exe_threats', title: 'Top Threats', type: 'table', dataSource: 'alerts', x: 0, y: 10, w: 24, h: 13, query: { language: 'lucene', query: 'rule.level:10 OR rule.level:11 OR rule.level:12 OR rule.level:13 OR rule.level:14 OR rule.level:15', sort: { field: '@timestamp', order: 'desc' }, limit: 10 }, config: { sortable: true, pageSize: 10 } },
    ]
  },
  'authentication': {
    name: 'Authentication Dashboard',
    description: 'Monitor authentication events, failed logons, and user activity',
    category: 'security',
    icon: 'AU',
    timeRange: { from: 'now-24h', to: 'now' },
    refreshInterval: 60,
    panels: [
      { id: 'tpl_auth_m1', title: 'Auth Events', type: 'metric', dataSource: 'alerts', x: 0, y: 0, w: 6, h: 7, query: { language: 'lucene', query: 'rule.groups:authentication', aggregation: { type: 'count' } }, config: { suffix: 'events', color: '#8b5cf6' } },
      { id: 'tpl_auth_m2', title: 'Failed Logons', type: 'metric', dataSource: 'alerts', x: 6, y: 0, w: 6, h: 7, query: { language: 'lucene', query: 'data.win.eventId:4625', aggregation: { type: 'count' } }, config: { suffix: 'failed', color: '#ef4444' } },
      { id: 'tpl_auth_timeline', title: 'Logon Timeline', type: 'line', dataSource: 'alerts', x: 0, y: 7, w: 12, h: 13, query: { language: 'lucene', query: 'rule.groups:authentication', aggregation: { field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48 } }, config: {} },
      { id: 'tpl_auth_users', title: 'Top Failed Users', type: 'bar', dataSource: 'alerts', x: 12, y: 7, w: 6, h: 13, query: { language: 'lucene', query: 'data.win.eventId:4625', aggregation: { field: 'data.win.eventdata.targetUserName', type: 'terms', limit: 10 } }, config: {} },
      { id: 'tpl_auth_type', title: 'Auth by Type', type: 'pie', dataSource: 'alerts', x: 18, y: 7, w: 6, h: 13, query: { language: 'lucene', query: 'rule.groups:authentication', aggregation: { field: 'data.win.eventId', type: 'terms', limit: 5 } }, config: { donut: true } },
    ]
  },
  'threat-hunting': {
    name: 'Threat Hunting',
    description: 'Proactive threat hunting with IOC matching, MITRE techniques, and suspicious activity',
    category: 'security',
    icon: 'TH',
    timeRange: { from: 'now-7d', to: 'now' },
    refreshInterval: 120,
    panels: [
      { id: 'tpl_threat_m1', title: 'IOC Matches', type: 'metric', dataSource: 'alerts', x: 0, y: 0, w: 6, h: 7, query: { language: 'lucene', query: 'rule.groups:virustotal', aggregation: { type: 'count' } }, config: { suffix: 'matches', color: '#ef4444' } },
      { id: 'tpl_threat_m2', title: 'MITRE Events', type: 'metric', dataSource: 'alerts', x: 6, y: 0, w: 6, h: 7, query: { language: 'lucene', query: '_exists_:rule.mitre.id', aggregation: { type: 'count' } }, config: { suffix: 'events', color: '#8b5cf6' } },
      { id: 'tpl_threat_matrix', title: 'MITRE Matrix', type: 'heatmap', dataSource: 'alerts', x: 0, y: 7, w: 16, h: 20, query: { language: 'lucene', query: '_exists_:rule.mitre.id', aggregation: { field: 'rule.mitre.tactic', type: 'terms', limit: 14 } }, config: {} },
      { id: 'tpl_threat_recent', title: 'Recent Threats', type: 'table', dataSource: 'alerts', x: 16, y: 7, w: 8, h: 20, query: { language: 'lucene', query: 'rule.level:10 OR rule.level:11 OR rule.level:12 OR rule.level:13 OR rule.level:14 OR rule.level:15', sort: { field: '@timestamp', order: 'desc' }, limit: 15 }, config: { sortable: true, pageSize: 15 } },
    ]
  },
  'mitre': {
    name: 'MITRE ATT&CK',
    description: 'MITRE ATT&CK framework coverage, tactics, and techniques',
    category: 'security',
    icon: 'MA',
    timeRange: { from: 'now-7d', to: 'now' },
    refreshInterval: 300,
    panels: [
      { id: 'tpl_mitre_m1', title: 'Tactics Detected', type: 'metric', dataSource: 'alerts', x: 0, y: 0, w: 6, h: 7, query: { language: 'lucene', query: '_exists_:rule.mitre.tactic', aggregation: { field: 'rule.mitre.tactic', type: 'cardinality' } }, config: { suffix: 'tactics', color: '#7c3aed' } },
      { id: 'tpl_mitre_m2', title: 'Techniques', type: 'metric', dataSource: 'alerts', x: 6, y: 0, w: 6, h: 7, query: { language: 'lucene', query: '_exists_:rule.mitre.technique', aggregation: { field: 'rule.mitre.technique', type: 'cardinality' } }, config: { suffix: 'techniques', color: '#6d28d9' } },
      { id: 'tpl_mitre_tactics', title: 'Tactics Breakdown', type: 'pie', dataSource: 'alerts', x: 12, y: 0, w: 6, h: 7, query: { language: 'lucene', query: '_exists_:rule.mitre.id', aggregation: { field: 'rule.mitre.tactic', type: 'terms', limit: 10 } }, config: { donut: true } },
      { id: 'tpl_mitre_alerts', title: 'MITRE Alerts', type: 'table', dataSource: 'alerts', x: 0, y: 7, w: 24, h: 17, query: { language: 'lucene', query: '_exists_:rule.mitre.id', sort: { field: '@timestamp', order: 'desc' }, limit: 20 }, config: { sortable: true, pageSize: 20 } },
    ]
  },
  'vulnerability': {
    name: 'Vulnerability Dashboard',
    description: 'Vulnerability detection, CVEs, and affected assets',
    category: 'security',
    icon: 'VD',
    timeRange: { from: 'now-7d', to: 'now' },
    refreshInterval: 3600,
    panels: [
      { id: 'tpl_vuln_m1', title: 'Total Vulns', type: 'metric', dataSource: 'alerts', x: 0, y: 0, w: 6, h: 7, query: { language: 'lucene', query: '_exists_:data.vulnerability.severity', aggregation: { type: 'count' } }, config: { suffix: 'vulns', color: '#ef4444' } },
      { id: 'tpl_vuln_m2', title: 'Critical CVEs', type: 'metric', dataSource: 'alerts', x: 6, y: 0, w: 6, h: 7, query: { language: 'lucene', query: 'data.vulnerability.severity:Critical', aggregation: { type: 'count' } }, config: { suffix: 'critical', color: '#dc2626' } },
      { id: 'tpl_vuln_dist', title: 'Severity Distribution', type: 'pie', dataSource: 'alerts', x: 12, y: 0, w: 6, h: 7, query: { language: 'lucene', query: '_exists_:data.vulnerability.severity', aggregation: { field: 'data.vulnerability.severity', type: 'terms', limit: 5 } }, config: { donut: true } },
      { id: 'tpl_vuln_trend', title: 'Vuln Trend', type: 'area', dataSource: 'alerts', x: 0, y: 7, w: 12, h: 13, query: { language: 'lucene', query: '_exists_:data.vulnerability.severity', aggregation: { field: '@timestamp', type: 'date_histogram', interval: '1d', limit: 30 } }, config: {} },
      { id: 'tpl_vuln_top', title: 'Top CVEs', type: 'bar', dataSource: 'alerts', x: 12, y: 7, w: 6, h: 13, query: { language: 'lucene', query: '', aggregation: { field: 'data.vulnerability.cve', type: 'terms', limit: 10 } }, config: {} },
      { id: 'tpl_vuln_agents', title: 'Affected Agents', type: 'table', dataSource: 'alerts', x: 18, y: 7, w: 6, h: 13, query: { language: 'lucene', query: '_exists_:data.vulnerability.severity', aggregation: { field: 'agent.name', type: 'terms', limit: 10 } }, config: {} },
    ]
  },
  'windows-audit': {
    name: 'Windows Audit',
    description: 'Windows Event monitoring, security events, and system changes',
    category: 'platform',
    icon: 'WA',
    timeRange: { from: 'now-24h', to: 'now' },
    refreshInterval: 60,
    panels: [
      { id: 'tpl_win_m1', title: 'Windows Events', type: 'metric', dataSource: 'alerts', x: 0, y: 0, w: 6, h: 7, query: { language: 'lucene', query: 'rule.groups:windows', aggregation: { type: 'count' } }, config: { suffix: 'events', color: '#06b6d4' } },
      { id: 'tpl_win_m2', title: 'Security Events', type: 'metric', dataSource: 'alerts', x: 6, y: 0, w: 6, h: 7, query: { language: 'lucene', query: 'rule.groups:windows AND rule.level:10 OR rule.level:11 OR rule.level:12 OR rule.level:13 OR rule.level:14 OR rule.level:15', aggregation: { type: 'count' } }, config: { suffix: 'critical', color: '#ef4444' } },
      { id: 'tpl_win_ids', title: 'Event IDs', type: 'bar', dataSource: 'alerts', x: 12, y: 0, w: 6, h: 7, query: { language: 'lucene', query: 'rule.groups:windows', aggregation: { field: 'data.win.eventId', type: 'terms', limit: 10 } }, config: {} },
      { id: 'tpl_win_timeline', title: 'Windows Timeline', type: 'area', dataSource: 'alerts', x: 0, y: 7, w: 12, h: 13, query: { language: 'lucene', query: 'rule.groups:windows', aggregation: { field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48 } }, config: {} },
      { id: 'tpl_win_recent', title: 'Recent Events', type: 'table', dataSource: 'alerts', x: 12, y: 7, w: 12, h: 13, query: { language: 'lucene', query: 'rule.groups:windows', sort: { field: '@timestamp', order: 'desc' }, limit: 15 }, config: { sortable: true, pageSize: 15 } },
    ]
  },
  'firewall': {
    name: 'Firewall Dashboard',
    description: 'Firewall events, blocked traffic, and network activity',
    category: 'network',
    icon: 'SO',
    timeRange: { from: 'now-24h', to: 'now' },
    refreshInterval: 60,
    panels: [
      { id: 'tpl_fw_m1', title: 'Blocks', type: 'metric', dataSource: 'alerts', x: 0, y: 0, w: 6, h: 7, query: { language: 'lucene', query: 'data.action:block', aggregation: { type: 'count' } }, config: { suffix: 'blocked', color: '#ef4444' } },
      { id: 'tpl_fw_m2', title: 'Source IPs', type: 'metric', dataSource: 'alerts', x: 6, y: 0, w: 6, h: 7, query: { language: 'lucene', query: 'data.action:block', aggregation: { field: 'data.srcip', type: 'cardinality' } }, config: { suffix: 'unique IPs', color: '#f59e0b' } },
      { id: 'tpl_fw_topsrc', title: 'Top Sources', type: 'bar', dataSource: 'alerts', x: 0, y: 7, w: 8, h: 13, query: { language: 'lucene', query: 'data.action:block', aggregation: { field: 'data.srcip', type: 'terms', limit: 10 } }, config: {} },
      { id: 'tpl_fw_timeline', title: 'Firewall Events', type: 'area', dataSource: 'alerts', x: 8, y: 7, w: 8, h: 13, query: { language: 'lucene', query: 'rule.groups:pfsense', aggregation: { field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48 } }, config: {} },
      { id: 'tpl_fw_proto', title: 'By Protocol', type: 'pie', dataSource: 'alerts', x: 16, y: 7, w: 8, h: 13, query: { language: 'lucene', query: 'data.action:block', aggregation: { field: 'data.protocol', type: 'terms', limit: 5 } }, config: { donut: true } },
    ]
  },
  'ingestion-monitor': {
    name: 'EPS & Ingestion Monitor',
    description: 'Real-time EPS monitoring, nodes by EPS, event types breakdown, event rate trend, and log stop alerts',
    category: 'soc',
    icon: 'ED',
    timeRange: { from: 'now-1h', to: 'now' },
    refreshInterval: 30,
    panels: [
      {
        id: 'tpl_ie_eps60', title: 'EPS (60s avg)',
        type: 'metric', dataSource: 'alerts',
        x: 0, y: 0, w: 3, h: 5,
        query: { language: 'lucene', query: '', aggregation: { type: 'eps', interval: '60s' } },
        vizConfig: { suffix: 'eps', color: '#06b6d4' }
      },
      {
        id: 'tpl_ie_eps5m', title: 'EPS (5m avg)',
        type: 'metric', dataSource: 'alerts',
        x: 3, y: 0, w: 3, h: 5,
        query: { language: 'lucene', query: '', aggregation: { type: 'eps', interval: '300s' } },
        vizConfig: { suffix: 'eps', color: '#8b5cf6' }
      },
      {
        id: 'tpl_ie_agents', title: 'Active Agents',
        type: 'metric', dataSource: 'alerts',
        x: 6, y: 0, w: 3, h: 5,
        query: { language: 'lucene', query: '', aggregation: { field: 'agent.name', type: 'cardinality' } },
        vizConfig: { suffix: 'agents', color: '#10b981' }
      },
      {
        id: 'tpl_ie_eps_asset', title: 'EPS per Asset',
        type: 'table', dataSource: 'alerts',
        x: 9, y: 0, w: 3, h: 8,
        query: { language: 'lucene', query: '', aggregation: { field: 'agent.name', type: 'terms', limit: 20, interval: '60s', eps: true } },
        vizConfig: { tableColumns: ['#', 'agent', 'count', 'eps', 'status'] }
      },
      {
        id: 'tpl_ie_eventrate', title: 'Event Rate',
        type: 'area', dataSource: 'alerts',
        x: 0, y: 5, w: 6, h: 10,
        query: { language: 'lucene', query: '', aggregation: { field: '@timestamp', type: 'date_histogram', interval: '5m', limit: 60 } },
        vizConfig: { fill: 'tozeroy', lineColor: '#EF843C', smoothing: true }
      },
      {
        id: 'tpl_ie_topnodes', title: 'Top Nodes by EPS',
        type: 'bar', dataSource: 'alerts',
        x: 0, y: 15, w: 6, h: 10,
        query: { language: 'lucene', query: '', aggregation: { field: 'agent.name', type: 'terms', limit: 15 } },
        vizConfig: { palette: 'warm' }
      },
      {
        id: 'tpl_ie_inttypes', title: 'Internal Event Types',
        type: 'bar', dataSource: 'alerts',
        x: 6, y: 15, w: 6, h: 10,
        query: { language: 'lucene', query: 'rule.groups:(windows OR linux OR sysmon)', aggregation: { field: 'rule.description', type: 'terms', limit: 10 } },
        vizConfig: { palette: 'cool' }
      },
      {
        id: 'tpl_ie_devices', title: 'Reporting Devices',
        type: 'table', dataSource: 'alerts',
        x: 0, y: 25, w: 12, h: 10,
        query: { language: 'lucene', query: '', aggregation: { field: 'agent.name', type: 'terms', limit: 20 } },
        vizConfig: { tableColumns: ['#', 'key', 'count', 'pct'] }
      },
      {
        id: 'tpl_ie_exttypes', title: 'External Event Types',
        type: 'bar', dataSource: 'alerts',
        x: 0, y: 35, w: 6, h: 10,
        query: { language: 'lucene', query: 'rule.groups:(pfsense OR firewall OR network)', aggregation: { field: 'rule.description', type: 'terms', limit: 10 } },
        vizConfig: { palette: 'warm' }
      },
      {
        id: 'tpl_ie_logstop', title: 'Log Stop Alert',
        type: 'table', dataSource: 'alerts',
        x: 6, y: 35, w: 6, h: 10,
        query: { language: 'lucene', query: '', aggregation: { type: 'logstop', interval: '5m', field: 'agent.name', limit: 50 } },
        vizConfig: { tableColumns: ['#', 'agent', 'lastSeen', 'status'] }
      },
    ]
  },
}

export const TEMPLATE_CATEGORIES = [
  { id: 'soc', label: 'SOC', icon: 'SO', desc: 'Security Operations Center views' },
  { id: 'executive', label: 'Executive', icon: 'ED', desc: 'Executive summary and KPIs' },
  { id: 'security', label: 'Security', icon: 'SE', desc: 'Security monitoring dashboards' },
  { id: 'platform', label: 'Platform', icon: 'PL', desc: 'Platform-specific monitoring' },
  { id: 'network', label: 'Network', icon: 'FW', desc: 'Network security dashboards' },
]

export function getTemplateList() {
  return Object.entries(DASHBOARD_TEMPLATES).map(([id, tpl]) => ({
    id,
    name: tpl.name,
    description: tpl.description,
    category: tpl.category,
    icon: tpl.icon,
    panelCount: tpl.panels.length,
  }))
}

export function getTemplate(id) {
  return DASHBOARD_TEMPLATES[id] || null
}

export function createFromTemplate(templateId) {
  const tpl = DASHBOARD_TEMPLATES[templateId]
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
