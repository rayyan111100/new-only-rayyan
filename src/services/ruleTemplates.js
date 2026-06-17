const RULE_TEMPLATES = [
  // --- FIREWALL & NETWORK ---
  {
    id: 'tpl_fw_blocked', category: 'Firewall & Network', name: 'Blocked Connection',
    desc: 'Detects when firewall blocks a network connection',
    conditions: [{ field: 'data.action', operator: 'equals', value: 'block', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'medium', level: 7, message: 'Firewall blocked {{data.srcip}} \u2192 {{data.dstip}}' } }]
  },
  {
    id: 'tpl_fw_blocked_subnet', category: 'Firewall & Network', name: 'Blocked from Specific Subnet',
    desc: 'Detects blocked traffic from a specific IP range',
    conditions: [
      { field: 'data.srcip', operator: 'equals', value: '10.0.0.0/24', logic: 'AND' },
      { field: 'data.action', operator: 'equals', value: 'block', logic: 'AND' }
    ],
    actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'Blocked traffic from subnet {{data.srcip}}' } }]
  },
  {
    id: 'tpl_fw_port_scan', category: 'Firewall & Network', name: 'Port Scan Detected',
    desc: 'Multiple connections detected — possible port scan',
    conditions: [{ field: 'decoded.protocol', operator: 'equals', value: 'TCP', logic: 'AND' }],
    frequency: 10, timeframe: 1, timeframeUnit: 'm',
    actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'Port scan detected from {{decoded.src_ip}}' } }]
  },
  {
    id: 'tpl_fw_ssh_brute', category: 'Firewall & Network', name: 'SSH Brute Force',
    desc: 'Multiple SSH failed logins in short time',
    conditions: [{ field: 'decoded.format', operator: 'equals', value: 'ssh_failed', logic: 'AND' }],
    frequency: 5, timeframe: 5, timeframeUnit: 'm',
    actions: [{ type: 'alert', params: { severity: 'critical', level: 14, message: 'SSH brute force from {{decoded.src_ip}}' } }]
  },
  {
    id: 'tpl_fw_dns_suspicious', category: 'Firewall & Network', name: 'Suspicious DNS Query',
    desc: 'Detects DNS queries to suspicious TLDs',
    conditions: [{ field: 'data.url', operator: 'regex', value: '\\.(xyz|top|gq|tk|ml|cf)$', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'Suspicious DNS: {{data.url}}' } }]
  },
  {
    id: 'tpl_fw_large_transfer', category: 'Firewall & Network', name: 'Large Data Transfer',
    desc: 'Detects large data transfers (possible exfiltration)',
    conditions: [{ field: 'decoded.bytes', operator: 'gt', value: '10000000', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'medium', level: 8, message: 'Large data transfer: {{decoded.bytes}} bytes' } }]
  },
  {
    id: 'tpl_fw_icmp_flood', category: 'Firewall & Network', name: 'ICMP Flood',
    desc: 'High volume of ICMP packets — possible DDoS',
    conditions: [{ field: 'decoded.protocol', operator: 'equals', value: 'ICMP', logic: 'AND' }],
    frequency: 50, timeframe: 1, timeframeUnit: 'm',
    actions: [{ type: 'alert', params: { severity: 'high', level: 11, message: 'ICMP flood detected' } }]
  },
  {
    id: 'tpl_fw_nonstandard_port', category: 'Firewall & Network', name: 'Non-Standard Port Traffic',
    desc: 'Traffic on non-standard service ports',
    conditions: [{ field: 'decoded.dst_port', operator: 'gte', value: '1024', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'low', level: 3, message: 'Traffic on port {{decoded.dst_port}}' } }]
  },
  {
    id: 'tpl_fw_multiple_blocked', category: 'Firewall & Network', name: 'Multiple Blocked IPs',
    desc: 'Many blocked connections from different sources',
    conditions: [{ field: 'data.action', operator: 'equals', value: 'block', logic: 'AND' }],
    frequency: 20, timeframe: 5, timeframeUnit: 'm',
    actions: [{ type: 'alert', params: { severity: 'critical', level: 13, message: 'Multiple blocked connections detected' } }]
  },
  {
    id: 'tpl_fw_vpn_connect', category: 'Firewall & Network', name: 'VPN Connection',
    desc: 'Detects VPN connection events',
    conditions: [{ field: 'data.action', operator: 'equals', value: 'connect', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'low', level: 3, message: 'VPN connection from {{data.user}}' } }]
  },

  // --- WINDOWS SECURITY ---
  {
    id: 'tpl_win_failed_logon', category: 'Windows Security', name: 'Failed Logon (4625)',
    desc: 'Failed logon attempt on Windows system',
    conditions: [{ field: 'data.win.system.eventID', operator: 'equals', value: '4625', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'Failed logon from {{data.win.eventdata.ipAddress}}' } }]
  },
  {
    id: 'tpl_win_brute_force', category: 'Windows Security', name: 'Brute Force Attack (4625)',
    desc: 'Multiple failed logons in short time — brute force',
    conditions: [{ field: 'data.win.system.eventID', operator: 'equals', value: '4625', logic: 'AND' }],
    frequency: 5, timeframe: 5, timeframeUnit: 'm',
    actions: [{ type: 'alert', params: { severity: 'critical', level: 14, message: 'Brute force from {{data.win.eventdata.ipAddress}}' } }]
  },
  {
    id: 'tpl_win_rdp_logon', category: 'Windows Security', name: 'Remote Desktop Logon (4624)',
    desc: 'Remote interactive logon (RDP)',
    conditions: [
      { field: 'data.win.system.eventID', operator: 'equals', value: '4624', logic: 'AND' },
      { field: 'data.win.eventdata.logonType', operator: 'equals', value: '10', logic: 'AND' }
    ],
    actions: [{ type: 'alert', params: { severity: 'high', level: 9, message: 'RDP logon: {{data.win.eventdata.ipAddress}}' } }]
  },
  {
    id: 'tpl_win_admin_logon', category: 'Windows Security', name: 'Admin Console Logon (4624)',
    desc: 'Interactive console logon (type 2)',
    conditions: [
      { field: 'data.win.system.eventID', operator: 'equals', value: '4624', logic: 'AND' },
      { field: 'data.win.eventdata.logonType', operator: 'equals', value: '2', logic: 'AND' }
    ],
    actions: [{ type: 'alert', params: { severity: 'medium', level: 5, message: 'Console logon by {{data.win.eventdata.ipAddress}}' } }]
  },
  {
    id: 'tpl_win_process_create', category: 'Windows Security', name: 'Process Created (4688)',
    desc: 'New process creation event',
    conditions: [{ field: 'data.win.system.eventID', operator: 'equals', value: '4688', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'medium', level: 5, message: 'Process created: {{data.win.eventdata.processName}}' } }]
  },
  {
    id: 'tpl_win_powershell', category: 'Windows Security', name: 'PowerShell Executed (4688)',
    desc: 'PowerShell process creation',
    conditions: [
      { field: 'data.win.system.eventID', operator: 'equals', value: '4688', logic: 'AND' },
      { field: 'data.win.eventdata.processName', operator: 'contains', value: 'powershell', logic: 'AND' }
    ],
    actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'PowerShell execution detected' } }]
  },
  {
    id: 'tpl_win_user_created', category: 'Windows Security', name: 'New User Account (4720)',
    desc: 'New user account created',
    conditions: [{ field: 'data.win.system.eventID', operator: 'equals', value: '4720', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'New user account created' } }]
  },
  {
    id: 'tpl_win_log_cleared', category: 'Windows Security', name: 'Security Log Cleared (1102)',
    desc: 'Windows security log was cleared',
    conditions: [{ field: 'data.win.system.eventID', operator: 'equals', value: '1102', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'critical', level: 14, message: 'Security log cleared on {{agent.name}}' } }]
  },
  {
    id: 'tpl_win_service_install', category: 'Windows Security', name: 'Service Installed (7045)',
    desc: 'New service installed on system',
    conditions: [{ field: 'data.win.system.eventID', operator: 'equals', value: '7045', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'New service installed' } }]
  },
  {
    id: 'tpl_win_account_locked', category: 'Windows Security', name: 'Account Locked (4740)',
    desc: 'User account locked out',
    conditions: [{ field: 'data.win.system.eventID', operator: 'equals', value: '4740', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'high', level: 9, message: 'Account locked: {{data.win.eventdata.ipAddress}}' } }]
  },

  // --- LINUX SECURITY ---
  {
    id: 'tpl_nix_ssh_failed', category: 'Linux Security', name: 'SSH Failed Login',
    desc: 'Failed SSH login attempt',
    conditions: [{ field: 'decoded.format', operator: 'equals', value: 'ssh_failed', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'high', level: 8, message: 'SSH failed: {{decoded.user}} from {{decoded.src_ip}}' } }]
  },
  {
    id: 'tpl_nix_ssh_root', category: 'Linux Security', name: 'SSH Root Login',
    desc: 'Successful SSH login as root',
    conditions: [
      { field: 'decoded.format', operator: 'equals', value: 'ssh_accepted', logic: 'AND' },
      { field: 'decoded.user', operator: 'equals', value: 'root', logic: 'AND' }
    ],
    actions: [{ type: 'alert', params: { severity: 'critical', level: 12, message: 'Root SSH login from {{decoded.src_ip}}' } }]
  },
  {
    id: 'tpl_nix_sudo', category: 'Linux Security', name: 'Sudo Command Executed',
    desc: 'Privileged command via sudo',
    conditions: [{ field: 'data.audit.command', operator: 'contains', value: 'sudo', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'high', level: 9, message: 'Sudo: {{data.audit.command}}' } }]
  },
  {
    id: 'tpl_nix_user_added', category: 'Linux Security', name: 'New User Added',
    desc: 'New user account created on Linux',
    conditions: [{ field: 'data.audit.command', operator: 'contains', value: 'useradd', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'User account created' } }]
  },
  {
    id: 'tpl_nix_cron', category: 'Linux Security', name: 'Cron Job Modified',
    desc: 'Cron configuration changed',
    conditions: [{ field: 'data.audit.command', operator: 'contains', value: 'crontab', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'medium', level: 7, message: 'Cron modified by {{data.audit.user}}' } }]
  },
  {
    id: 'tpl_nix_package', category: 'Linux Security', name: 'Package Installed',
    desc: 'New software package installed',
    conditions: [{ field: 'data.audit.command', operator: 'regex', value: 'apt-get|yum|dnf|pacman', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'medium', level: 6, message: 'Package installed: {{data.audit.command}}' } }]
  },
  {
    id: 'tpl_nix_permission_change', category: 'Linux Security', name: 'File Permission Changed',
    desc: 'File permissions or ownership changed',
    conditions: [{ field: 'data.audit.command', operator: 'regex', value: 'chmod|chown', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'medium', level: 7, message: 'Permission change: {{data.audit.command}}' } }]
  },
  {
    id: 'tpl_nix_ssh_invalid', category: 'Linux Security', name: 'SSH Invalid User',
    desc: 'SSH login attempt with non-existent user',
    conditions: [{ field: 'decoded.format', operator: 'equals', value: 'ssh_invalid_user', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'high', level: 9, message: 'SSH invalid user: {{decoded.user}} from {{decoded.src_ip}}' } }]
  },

  // --- FILE INTEGRITY (FIM) ---
  {
    id: 'tpl_fim_added', category: 'File Integrity (FIM)', name: 'File Added',
    desc: 'New file detected by syscheck',
    conditions: [{ field: 'syscheck.event', operator: 'equals', value: 'added', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'medium', level: 7, message: 'File added: {{syscheck.path}}' } }]
  },
  {
    id: 'tpl_fim_modified', category: 'File Integrity (FIM)', name: 'File Modified',
    desc: 'File content changed',
    conditions: [{ field: 'syscheck.event', operator: 'equals', value: 'modified', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'File modified: {{syscheck.path}}' } }]
  },
  {
    id: 'tpl_fim_deleted', category: 'File Integrity (FIM)', name: 'File Deleted',
    desc: 'File removed from system',
    conditions: [{ field: 'syscheck.event', operator: 'equals', value: 'deleted', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'File deleted: {{syscheck.path}}' } }]
  },
  {
    id: 'tpl_fim_registry', category: 'File Integrity (FIM)', name: 'Registry Changed',
    desc: 'Windows registry key modified',
    conditions: [
      { field: 'syscheck.event', operator: 'equals', value: 'modified', logic: 'AND' },
      { field: 'syscheck.path', operator: 'contains', value: 'HKLM', logic: 'AND' }
    ],
    actions: [{ type: 'alert', params: { severity: 'critical', level: 12, message: 'Registry changed: {{syscheck.path}}' } }]
  },
  {
    id: 'tpl_fim_critical_file', category: 'File Integrity (FIM)', name: 'Critical File Changed',
    desc: 'System critical file modified',
    conditions: [
      { field: 'syscheck.event', operator: 'equals', value: 'modified', logic: 'AND' },
      { field: 'syscheck.path', operator: 'regex', value: '/etc/passwd|/etc/shadow|/etc/sudoers', logic: 'AND' }
    ],
    actions: [{ type: 'alert', params: { severity: 'critical', level: 15, message: 'Critical file changed: {{syscheck.path}}' } }]
  },
  {
    id: 'tpl_fim_hash_change', category: 'File Integrity (FIM)', name: 'Integrity Checksum Changed',
    desc: 'File hash changed — possible tampering',
    conditions: [
      { field: 'syscheck.sha1_after', operator: 'exists', logic: 'AND' },
      { field: 'syscheck.sha1_before', operator: 'exists', logic: 'AND' }
    ],
    actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'File hash changed: {{syscheck.path}}' } }]
  },

  // --- AUTHENTICATION ---
  {
    id: 'tpl_auth_multiple_fail', category: 'Authentication', name: 'Multiple Auth Failures',
    desc: 'Multiple authentication failures across rules',
    conditions: [{ field: 'rule.level', operator: 'gte', value: '5', logic: 'AND' }],
    frequency: 5, timeframe: 5, timeframeUnit: 'm',
    actions: [{ type: 'alert', params: { severity: 'critical', level: 14, message: 'Multiple auth failures on {{agent.name}}' } }]
  },
  {
    id: 'tpl_auth_ssh_success', category: 'Authentication', name: 'Successful SSH Login',
    desc: 'Successful SSH authentication',
    conditions: [{ field: 'decoded.format', operator: 'equals', value: 'ssh_accepted', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'low', level: 3, message: 'SSH login: {{decoded.user}} from {{decoded.src_ip}}' } }]
  },
  {
    id: 'tpl_auth_privilege_esc', category: 'Authentication', name: 'Privilege Escalation',
    desc: 'User escalated privileges via su',
    conditions: [{ field: 'data.audit.command', operator: 'contains', value: 'su', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'critical', level: 12, message: 'Privilege escalation by {{data.audit.user}}' } }]
  },
  {
    id: 'tpl_auth_vpn', category: 'Authentication', name: 'VPN Connection',
    desc: 'VPN tunnel established',
    conditions: [{ field: 'data.action', operator: 'equals', value: 'connect', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'low', level: 3, message: 'VPN connect: {{data.user}}' } }]
  },
  {
    id: 'tpl_auth_api_fail', category: 'Authentication', name: 'API Authentication Failed',
    desc: 'Unauthorized API access attempt',
    conditions: [{ field: 'data.status', operator: 'equals', value: 'unauthorized', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'medium', level: 7, message: 'API auth failure from {{data.srcip}}' } }]
  },
  {
    id: 'tpl_auth_root_ssh_alert', category: 'Authentication', name: 'Root SSH Access Alert',
    desc: 'Root SSH access detected',
    conditions: [
      { field: 'decoded.format', operator: 'equals', value: 'ssh_accepted', logic: 'AND' },
      { field: 'decoded.user', operator: 'equals', value: 'root', logic: 'AND' }
    ],
    actions: [{ type: 'alert', params: { severity: 'critical', level: 13, message: 'Root SSH from {{decoded.src_ip}}' } }]
  },

  // --- WEB SECURITY ---
  {
    id: 'tpl_web_404_spike', category: 'Web Security', name: '404 Error Spike',
    desc: 'Multiple 404 errors — possible scanning',
    conditions: [{ field: 'decoded.status', operator: 'equals', value: '404', logic: 'AND' }],
    frequency: 10, timeframe: 5, timeframeUnit: 'm',
    actions: [{ type: 'alert', params: { severity: 'medium', level: 7, message: '404 spike from {{decoded.src_ip}}' } }]
  },
  {
    id: 'tpl_web_sqli', category: 'Web Security', name: 'SQL Injection Attempt',
    desc: 'SQL injection pattern in URL',
    conditions: [{ field: 'data.url', operator: 'regex', value: "'.*--.*|'.*union.*|'.*waitfor|'.*select.*from", logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'critical', level: 15, message: 'SQL injection attempt on {{data.url}}' } }]
  },
  {
    id: 'tpl_web_xss', category: 'Web Security', name: 'XSS Attempt',
    desc: 'Cross-site scripting pattern in URL',
    conditions: [{ field: 'data.url', operator: 'regex', value: '<script|<img|<iframe|alert\\(|onerror=', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'critical', level: 15, message: 'XSS attempt: {{data.url}}' } }]
  },
  {
    id: 'tpl_web_admin_access', category: 'Web Security', name: 'Admin Page Access',
    desc: 'Successful access to admin pages',
    conditions: [
      { field: 'data.url', operator: 'contains', value: '/admin', logic: 'AND' },
      { field: 'decoded.status', operator: 'equals', value: '200', logic: 'AND' }
    ],
    actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'Admin access from {{decoded.src_ip}}' } }]
  },
  {
    id: 'tpl_web_upload', category: 'Web Security', name: 'File Upload Detected',
    desc: 'File upload via web application',
    conditions: [
      { field: 'data.url', operator: 'contains', value: 'upload', logic: 'AND' },
      { field: 'decoded.method', operator: 'equals', value: 'POST', logic: 'AND' }
    ],
    actions: [{ type: 'alert', params: { severity: 'medium', level: 7, message: 'File upload: {{data.url}}' } }]
  },
  {
    id: 'tpl_web_traversal', category: 'Web Security', name: 'Directory Traversal',
    desc: 'Path traversal attack pattern',
    conditions: [{ field: 'data.url', operator: 'regex', value: '\\.\\./|\\.\\.\\\\|%2e%2e|%252e%252e', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'critical', level: 14, message: 'Path traversal: {{data.url}}' } }]
  },

  // --- GENERAL / COMPLIANCE ---
  {
    id: 'tpl_gen_critical', category: 'General / Compliance', name: 'Critical Alert Catcher',
    desc: 'Any alert with level >= 12',
    conditions: [{ field: 'rule.level', operator: 'gte', value: '12', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'critical', level: 12, message: 'Critical alert: {{rule.description}}' } }]
  },
  {
    id: 'tpl_gen_high', category: 'General / Compliance', name: 'High Alert Catcher',
    desc: 'Alerts with level 7-11',
    conditions: [
      { field: 'rule.level', operator: 'gte', value: '7', logic: 'AND' },
      { field: 'rule.level', operator: 'lt', value: '12', logic: 'AND' }
    ],
    actions: [{ type: 'alert', params: { severity: 'high', level: 8, message: 'High alert: {{rule.description}}' } }]
  },
  {
    id: 'tpl_gen_malware', category: 'General / Compliance', name: 'Malware Detected',
    desc: 'Any alert in malware rule group',
    conditions: [{ field: 'rule.groups', operator: 'contains', value: 'malware', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'critical', level: 15, message: 'Malware detected: {{rule.description}}' } }]
  },
  {
    id: 'tpl_gen_policy', category: 'General / Compliance', name: 'Policy Violation',
    desc: 'Policy group alert triggered',
    conditions: [{ field: 'rule.groups', operator: 'contains', value: 'policy', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'medium', level: 7, message: 'Policy violation: {{rule.description}}' } }]
  },
  {
    id: 'tpl_gen_pci', category: 'General / Compliance', name: 'PCI DSS Alert',
    desc: 'PCI DSS compliance alert',
    conditions: [{ field: 'rule.groups', operator: 'contains', value: 'pci', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'PCI DSS: {{rule.description}}' } }]
  },
  {
    id: 'tpl_gen_gdpr', category: 'General / Compliance', name: 'GDPR Alert',
    desc: 'GDPR compliance alert',
    conditions: [{ field: 'rule.groups', operator: 'contains', value: 'gdpr', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'high', level: 10, message: 'GDPR: {{rule.description}}' } }]
  },
  {
    id: 'tpl_gen_attack', category: 'General / Compliance', name: 'Known Attack Pattern',
    desc: 'Attack group rule triggered',
    conditions: [{ field: 'rule.groups', operator: 'contains', value: 'attack', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'critical', level: 14, message: 'Attack detected: {{rule.description}}' } }]
  },
  {
    id: 'tpl_gen_high_severity_freq', category: 'General / Compliance', name: 'High Severity Frequency',
    desc: 'Multiple high-severity alerts in time window',
    conditions: [{ field: 'rule.level', operator: 'gte', value: '10', logic: 'AND' }],
    frequency: 3, timeframe: 10, timeframeUnit: 'm',
    actions: [{ type: 'alert', params: { severity: 'critical', level: 14, message: 'High severity spike: {{rule.description}}' } }]
  },

  // --- DELIVERY LOG ---
  {
    id: 'tpl_notif_failed', category: 'Delivery Log', name: 'Notification Delivery Failed',
    desc: 'Webhook or email notification failed',
    conditions: [{ field: 'data.status', operator: 'equals', value: 'failed', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'high', level: 9, message: 'Notification delivery failed' } }]
  },
  {
    id: 'tpl_notif_pending', category: 'Delivery Log', name: 'Stuck Notification',
    desc: 'Notification stuck in pending state',
    conditions: [{ field: 'data.status', operator: 'equals', value: 'pending', logic: 'AND' }],
    actions: [{ type: 'alert', params: { severity: 'medium', level: 6, message: 'Notification stuck pending' } }]
  },
  {
    id: 'tpl_notif_multiple_fail', category: 'Delivery Log', name: 'Multiple Notification Failures',
    desc: 'Multiple notification failures in time window',
    conditions: [{ field: 'data.status', operator: 'equals', value: 'failed', logic: 'AND' }],
    frequency: 3, timeframe: 1, timeframeUnit: 'h',
    actions: [{ type: 'alert', params: { severity: 'critical', level: 12, message: 'Multiple notification failures' } }]
  }
]

export function getTemplatesByCategory() {
  const map = {}
  for (const t of RULE_TEMPLATES) {
    if (!map[t.category]) map[t.category] = []
    map[t.category].push(t)
  }
  return map
}

export function getTemplate(id) {
  return RULE_TEMPLATES.find(t => t.id === id) || null
}

export function getAllTemplates() {
  return RULE_TEMPLATES
}

export function getCategories() {
  return [...new Set(RULE_TEMPLATES.map(t => t.category))]
}

export function applyTemplate(rule, template) {
  return {
    ...rule,
    name: template.name,
    conditions: JSON.parse(JSON.stringify(template.conditions)),
    actions: JSON.parse(JSON.stringify(template.actions)),
    frequency: template.frequency || 0,
    timeframe: template.timeframe || 0,
    timeframeUnit: template.timeframeUnit || 'm'
  }
}

export default RULE_TEMPLATES
