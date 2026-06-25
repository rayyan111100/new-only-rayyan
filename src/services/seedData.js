import { createRule, createGroup } from './ruleStorage'

export function seedDemoData() {
  const SEED_VERSION = 'v4'
  const seeded = localStorage.getItem('soc_seeded')
  if (seeded === SEED_VERSION) return 0
  if (seeded && seeded !== SEED_VERSION) {
    try { localStorage.removeItem('soc_rules'); localStorage.removeItem('soc_rule_groups') } catch {}
  }

  const groups = [
    { name: 'Severity', color: '#ef4444' },
    { name: 'File Integrity', color: '#8b5cf6' },
    { name: 'Windows Security', color: '#3b82f6' },
    { name: 'Authentication', color: '#f59e0b' },
    { name: 'Database', color: '#06b6d4' },
    { name: 'Firewall', color: '#f97316' },
    { name: 'Compliance', color: '#6b7280' }
  ]
  const g = groups.map(grp => createGroup(grp).id)

  // Rule IDs reference: g[0]=Severity, g[1]=FIM, g[2]=Windows, g[3]=Auth, g[4]=DB, g[5]=Firewall, g[6]=Compliance
  const RULES = [
    // --- SEVERITY-BASED ---
    {
      name: 'Critical Alert (level >= 12)',
      conditions: [{ field: 'rule.level', operator: 'gte', value: '12', logic: 'AND' }],
      groupIds: [g[0]],
      actions: [{ type: 'alert', params: { severity: 'critical', level: 12, message: 'CRITICAL: {{rule.description}}' } }]
    },
    {
      name: 'High Alert (level 7-11)',
      conditions: [
        { field: 'rule.level', operator: 'gte', value: '7', logic: 'AND' },
        { field: 'rule.level', operator: 'lt', value: '12', logic: 'AND' }
      ],
      groupIds: [g[0]],
      actions: [{ type: 'alert', params: { severity: 'high', level: 8, message: 'HIGH: {{rule.description}}' } }]
    },
    {
      name: 'Medium Alert (level 4-6)',
      conditions: [
        { field: 'rule.level', operator: 'gte', value: '4', logic: 'AND' },
        { field: 'rule.level', operator: 'lt', value: '7', logic: 'AND' }
      ],
      groupIds: [g[0]],
      actions: [{ type: 'alert', params: { severity: 'medium', level: 5, message: 'MEDIUM: {{rule.description}}' } }]
    },

    // --- FILE INTEGRITY (FIM) ---
    {
      name: 'File Added to System',
      conditions: [{ field: 'syscheck.event', operator: 'equals', value: 'added', logic: 'AND' }],
      groupIds: [g[1]],
      actions: [{ type: 'alert', params: { severity: 'medium', level: 7, message: 'File added: {{syscheck.path}}' } }]
    },
    {
      name: 'File Modified (Integrity Change)',
      conditions: [{ field: 'syscheck.event', operator: 'equals', value: 'modified', logic: 'AND' }],
      groupIds: [g[1]],
      actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'File modified: {{syscheck.path}}' } }]
    },
    {
      name: 'File Deleted',
      conditions: [{ field: 'syscheck.event', operator: 'equals', value: 'deleted', logic: 'AND' }],
      groupIds: [g[1]],
      actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'File deleted: {{syscheck.path}}' } }]
    },
    {
      name: 'Registry Key Modified',
      conditions: [
        { field: 'syscheck.event', operator: 'equals', value: 'modified', logic: 'AND' },
        { field: 'syscheck.path', operator: 'contains', value: 'HKLM', logic: 'AND' }
      ],
      groupIds: [g[1]],
      actions: [{ type: 'alert', params: { severity: 'critical', level: 12, message: 'Registry changed: {{syscheck.path}}' } }]
    },

    // --- WINDOWS SECURITY ---
    {
      name: 'Windows User Logoff',
      conditions: [{ field: 'rule.id', operator: 'equals', value: '60137', logic: 'AND' }],
      groupIds: [g[2]],
      actions: [{ type: 'alert', params: { severity: 'low', level: 3, message: 'User logoff' } }]
    },
    {
      name: 'Service Startup Changed',
      conditions: [{ field: 'rule.id', operator: 'equals', value: '61104', logic: 'AND' }],
      groupIds: [g[2]],
      actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'Service startup type changed - possible persistence' } }]
    },
    {
      name: 'Non-Service Account Logoff',
      conditions: [{ field: 'rule.id', operator: 'equals', value: '67023', logic: 'AND' }],
      groupIds: [g[2]],
      actions: [{ type: 'alert', params: { severity: 'medium', level: 5, message: 'Non-service account logoff' } }]
    },
    {
      name: 'Special Privileges Assigned',
      conditions: [{ field: 'rule.id', operator: 'equals', value: '67028', logic: 'AND' }],
      groupIds: [g[2]],
      actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'Special privileges assigned to new logon' } }]
    },
    {
      name: 'Software Protection Service',
      conditions: [{ field: 'rule.id', operator: 'equals', value: '60642', logic: 'AND' }],
      groupIds: [g[2]],
      actions: [{ type: 'alert', params: { severity: 'low', level: 3, message: 'Software protection service scheduled' } }]
    },

    // --- AUTHENTICATION ---
    {
      name: 'User Login Activity',
      conditions: [
        { field: 'rule.id', operator: 'gte', value: '120002', logic: 'AND' },
        { field: 'rule.id', operator: 'lte', value: '120006', logic: 'AND' }
      ],
      groupIds: [g[3]],
      actions: [{ type: 'alert', params: { severity: 'medium', level: 7, message: 'User activity: {{rule.description}}' } }]
    },
    {
      name: 'Remote Logon (NTLM - possible pass-the-hash)',
      conditions: [{ field: 'rule.id', operator: 'equals', value: '92657', logic: 'AND' }],
      groupIds: [g[3]],
      actions: [{ type: 'alert', params: { severity: 'critical', level: 14, message: 'NTLM remote logon - verify pass-the-hash: {{rule.description}}' } }]
    },
    {
      name: 'Successful Remote Logon',
      conditions: [{ field: 'rule.description', operator: 'contains', value: 'Remote Logon', logic: 'AND' }],
      groupIds: [g[3]],
      actions: [{ type: 'alert', params: { severity: 'high', level: 9, message: 'Remote logon detected' } }]
    },

    // --- DATABASE ---
    {
      name: 'MS SQL Server Logon',
      conditions: [{ field: 'rule.id', operator: 'equals', value: '18181', logic: 'AND' }],
      groupIds: [g[4]],
      actions: [{ type: 'alert', params: { severity: 'medium', level: 7, message: 'MS SQL Server logon: {{rule.description}}' } }]
    },

    // --- FIREWALL ---
    {
      name: 'Multiple Firewall Blocks (pfSense)',
      conditions: [{ field: 'rule.id', operator: 'equals', value: '87702', logic: 'AND' }],
      groupIds: [g[5]],
      frequency: 1, timeframe: 10, timeframeUnit: 'm',
      actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'Multiple pfSense firewall blocks from same source' } }]
    },

    // --- COMPLIANCE / THREAT ---
    {
      name: 'Malware Detected',
      conditions: [{ field: 'rule.groups', operator: 'contains', value: 'malware', logic: 'AND' }],
      groupIds: [g[6]],
      actions: [{ type: 'alert', params: { severity: 'critical', level: 15, message: 'MALWARE: {{rule.description}}' } }]
    },
    {
      name: 'MISP Threat Intelligence',
      conditions: [{ field: 'rule.id', operator: 'equals', value: '100621', logic: 'AND' }],
      groupIds: [g[6]],
      actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'MISP threat intel: {{rule.description}}' } }]
    },
    {
      name: 'PCI DSS Compliance',
      conditions: [{ field: 'rule.groups', operator: 'contains', value: 'pci_dss', logic: 'AND' }],
      groupIds: [g[6]],
      actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'PCI DSS: {{rule.description}}' } }]
    },
    {
      name: 'GDPR Compliance',
      conditions: [{ field: 'rule.groups', operator: 'contains', value: 'gdpr', logic: 'AND' }],
      groupIds: [g[6]],
      actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'GDPR: {{rule.description}}' } }]
    }
  ]

  for (const r of RULES) createRule(r)
  localStorage.setItem('soc_seeded', SEED_VERSION)
  return RULES.length + groups.length
}
