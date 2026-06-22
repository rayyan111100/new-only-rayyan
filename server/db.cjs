const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'data', 'dashboard.db')

let db

function initDB() {
  const fs = require('fs')
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  migrate()
  return db
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'New Rule',
      enabled INTEGER NOT NULL DEFAULT 1,
      overwrite INTEGER NOT NULL DEFAULT 1,
      conditionLogic TEXT NOT NULL DEFAULT 'AND',
      conditions TEXT NOT NULL DEFAULT '[]',
      actions TEXT NOT NULL DEFAULT '[{"type":"alert","params":{"severity":"high","message":""}}]',
      groupIds TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      priority INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rule_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#6b7280',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rule_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ruleId TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
      versionNumber INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      comment TEXT DEFAULT '',
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS decoders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'custom',
      programName TEXT DEFAULT '',
      regex TEXT DEFAULT '',
      fields TEXT NOT NULL DEFAULT '[]',
      "order" TEXT NOT NULL DEFAULT '[]',
      parentId TEXT DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS decoder_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      decoderId TEXT NOT NULL REFERENCES decoders(id) ON DELETE CASCADE,
      input TEXT NOT NULL,
      expected TEXT DEFAULT '{}',
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rule_versions_ruleId ON rule_versions(ruleId);
    CREATE INDEX IF NOT EXISTS idx_decoder_tests_decoderId ON decoder_tests(decoderId);
  `)

  // Migration: add columns for Phase 3 features (run-idempotent)
  try { db.exec(`ALTER TABLE rules ADD COLUMN frequency INTEGER DEFAULT 0`) } catch {}
  try { db.exec(`ALTER TABLE rules ADD COLUMN timeframe INTEGER DEFAULT 0`) } catch {}
  try { db.exec(`ALTER TABLE rules ADD COLUMN timeframeUnit TEXT DEFAULT 'm'`) } catch {}
  try { db.exec(`ALTER TABLE rules ADD COLUMN suppression INTEGER DEFAULT 0`) } catch {}
  try { db.exec(`ALTER TABLE rules ADD COLUMN suppressionMax INTEGER DEFAULT 0`) } catch {}
  try { db.exec(`ALTER TABLE rules ADD COLUMN suppressionField TEXT DEFAULT 'agent.name'`) } catch {}

  // Migration: Wazuh API tables
  try { db.exec(`ALTER TABLE agents ADD COLUMN groupConfig TEXT DEFAULT '[]'`) } catch {}
  try { db.exec(`ALTER TABLE agents ADD COLUMN mergedGroup TEXT DEFAULT ''`) } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ip TEXT DEFAULT '0.0.0.0',
      status TEXT DEFAULT 'active',
      os_name TEXT DEFAULT '',
      os_version TEXT DEFAULT '',
      os_platform TEXT DEFAULT '',
      version TEXT DEFAULT 'UniShield360 v3.0.0',
      lastKeepAlive TEXT NOT NULL,
      dateAdd TEXT NOT NULL,
      groupConfig TEXT NOT NULL DEFAULT '[]',
      mergedGroup TEXT DEFAULT 'default',
      node_name TEXT DEFAULT 'node01'
    );
    CREATE TABLE IF NOT EXISTS cdb_lists (
      filename TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mitre_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      techniques TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mitre_techniques (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      tactics TEXT NOT NULL DEFAULT '[]',
      platforms TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS syscheck_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      last_event TEXT NOT NULL,
      changes TEXT NOT NULL DEFAULT '[]',
      perm TEXT DEFAULT '',
      size INTEGER DEFAULT 0,
      owner TEXT DEFAULT '',
      group_name TEXT DEFAULT '',
      md5 TEXT DEFAULT '',
      sha1 TEXT DEFAULT '',
      sha256 TEXT DEFAULT '',
      date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vulnerabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      cve TEXT NOT NULL,
      title TEXT DEFAULT '',
      severity TEXT DEFAULT 'medium',
      cvss2_score REAL DEFAULT 0,
      cvss3_score REAL DEFAULT 0,
      package_name TEXT DEFAULT '',
      package_version TEXT DEFAULT '',
      package_platform TEXT DEFAULT '',
      status TEXT DEFAULT 'Pending',
      published TEXT DEFAULT '',
      updated TEXT DEFAULT '',
      created TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sca_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      policy_id TEXT NOT NULL,
      policy_name TEXT DEFAULT '',
      title TEXT DEFAULT '',
      description TEXT DEFAULT '',
      rationale TEXT DEFAULT '',
      remediation TEXT DEFAULT '',
      condition TEXT DEFAULT '',
      result TEXT DEFAULT 'passed',
      status TEXT DEFAULT 'active',
      compliance TEXT DEFAULT '[]',
      created TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rootcheck_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      file_path TEXT DEFAULT '',
      issue TEXT DEFAULT '',
      description TEXT DEFAULT '',
      log TEXT DEFAULT '',
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS logtest_sessions (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS security_roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rules TEXT NOT NULL DEFAULT '[]',
      policies TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS security_policies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      policy JSON NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_syscheck_agent ON syscheck_entries(agent_id);
    CREATE INDEX IF NOT EXISTS idx_vuln_agent ON vulnerabilities(agent_id);
    CREATE INDEX IF NOT EXISTS idx_sca_agent ON sca_checks(agent_id);
    CREATE INDEX IF NOT EXISTS idx_rootcheck_agent ON rootcheck_entries(agent_id);
  `)

  // Seed agents if empty
  const agentCount = db.prepare('SELECT COUNT(*) as cnt FROM agents').get()
  if (agentCount.cnt === 0) {
    const now = new Date().toISOString()
    const seedAgents = [
      { id: '001', name: 'server-prod-01', ip: '192.168.1.101', os_name: 'Ubuntu', os_version: '22.04', os_platform: 'linux', status: 'active' },
      { id: '002', name: 'server-prod-02', ip: '192.168.1.102', os_name: 'Windows', os_version: '10.0.19045', os_platform: 'windows', status: 'active' },
      { id: '003', name: 'server-dev-01', ip: '192.168.1.201', os_name: 'CentOS', os_version: '7.9', os_platform: 'linux', status: 'active' },
      { id: '004', name: 'workstation-01', ip: '192.168.1.50', os_name: 'Windows', os_version: '10.0.19045', os_platform: 'windows', status: 'disconnected' },
      { id: '005', name: 'web-01', ip: '192.168.1.10', os_name: 'Ubuntu', os_version: '20.04', os_platform: 'linux', status: 'active' },
    ]
    const stmt = db.prepare(`INSERT INTO agents (id, name, ip, status, os_name, os_version, os_platform, version, lastKeepAlive, dateAdd, groupConfig, mergedGroup, node_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    for (const a of seedAgents) {
      stmt.run(a.id, a.name, a.ip, a.status, a.os_name, a.os_version, a.os_platform, 'UniShield360 v3.0.0', now, now, '[]', 'default', 'node01')
    }
    console.log(`✔ Seeded ${seedAgents.length} agents`)
  }

  // Seed MITRE data if empty
  const mitreCount = db.prepare('SELECT COUNT(*) as cnt FROM mitre_groups').get()
  if (mitreCount.cnt === 0) {
    const now = new Date().toISOString()
    const groups = [
      { id: 'G0001', name: 'APT1', description: 'Chinese cyber espionage group', techniques: JSON.stringify(['T1055', 'T1071', 'T1105']) },
      { id: 'G0002', name: 'Lazarus Group', description: 'North Korean state-sponsored group', techniques: JSON.stringify(['T1059', 'T1204', 'T1566']) },
      { id: 'G0003', name: 'FIN7', description: 'Financially motivated cybercrime group', techniques: JSON.stringify(['T1021', 'T1055', 'T1566']) },
      { id: 'G0004', name: 'Cobalt Group', description: 'Russian cybercrime group', techniques: JSON.stringify(['T1071', 'T1105', 'T1204']) },
    ]
    const gStmt = db.prepare('INSERT INTO mitre_groups (id, name, description, techniques, createdAt) VALUES (?, ?, ?, ?, ?)')
    for (const g of groups) gStmt.run(g.id, g.name, g.description, g.techniques, now)

    const techniques = [
      { id: 'T1055', name: 'Process Injection', description: 'Inject code into processes', tactics: JSON.stringify(['defense-evasion', 'privilege-escalation']), platforms: JSON.stringify(['Windows', 'Linux']) },
      { id: 'T1071', name: 'Application Layer Protocol', description: 'Use application layer protocols for C2', tactics: JSON.stringify(['command-and-control']), platforms: JSON.stringify(['Windows', 'Linux', 'macOS']) },
      { id: 'T1105', name: 'Ingress Tool Transfer', description: 'Copy files from external systems', tactics: JSON.stringify(['command-and-control']), platforms: JSON.stringify(['Windows', 'Linux', 'macOS']) },
      { id: 'T1059', name: 'Command-Line Interface', description: 'Use CLI for execution', tactics: JSON.stringify(['execution']), platforms: JSON.stringify(['Windows', 'Linux', 'macOS']) },
      { id: 'T1204', name: 'User Execution', description: 'User executes malicious file', tactics: JSON.stringify(['execution']), platforms: JSON.stringify(['Windows', 'Linux', 'macOS']) },
      { id: 'T1566', name: 'Phishing', description: 'Use phishing to gain access', tactics: JSON.stringify(['initial-access']), platforms: JSON.stringify(['Windows', 'Linux', 'macOS']) },
      { id: 'T1021', name: 'Remote Services', description: 'Use remote services for access', tactics: JSON.stringify(['lateral-movement']), platforms: JSON.stringify(['Windows', 'Linux']) },
      { id: 'T1003', name: 'OS Credential Dumping', description: 'Dump credentials from OS', tactics: JSON.stringify(['credential-access']), platforms: JSON.stringify(['Windows']) },
    ]
    const tStmt = db.prepare('INSERT INTO mitre_techniques (id, name, description, tactics, platforms, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
    for (const t of techniques) tStmt.run(t.id, t.name, t.description, t.tactics, t.platforms, now)
    console.log(`✔ Seeded MITRE groups (${groups.length}) + techniques (${techniques.length})`)
  }

  // Phase 5: reports + shares
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      dashboardId TEXT DEFAULT '',
      timeRange TEXT DEFAULT 'now-24h',
      format TEXT DEFAULT 'PDF',
      includeCharts INTEGER NOT NULL DEFAULT 1,
      includeTables INTEGER NOT NULL DEFAULT 1,
      includeMetrics INTEGER NOT NULL DEFAULT 1,
      scheduled INTEGER NOT NULL DEFAULT 0,
      frequency TEXT DEFAULT 'Daily',
      time TEXT DEFAULT '08:00',
      days TEXT DEFAULT '["Monday"]',
      emailTo TEXT DEFAULT '',
      emailFrom TEXT DEFAULT '',
      emailSubject TEXT DEFAULT '',
      includeInBody INTEGER NOT NULL DEFAULT 0,
      attachAsFile INTEGER NOT NULL DEFAULT 1,
      status TEXT DEFAULT 'created',
      lastRun TEXT,
      nextRun TEXT,
      lastEmailSent TEXT,
      error TEXT DEFAULT '',
      createdBy TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      dashboardId TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      isPublic INTEGER NOT NULL DEFAULT 0,
      includeTime INTEGER NOT NULL DEFAULT 1,
      includeFilters INTEGER NOT NULL DEFAULT 1,
      expiresAt TEXT,
      createdBy TEXT DEFAULT '',
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token);
    CREATE INDEX IF NOT EXISTS idx_shares_dashboardId ON shares(dashboardId);
    CREATE INDEX IF NOT EXISTS idx_reports_dashboardId ON reports(dashboardId);
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
  `)

  // Seed security roles/policies if empty
  const roleCount = db.prepare('SELECT COUNT(*) as cnt FROM security_roles').get()
  if (roleCount.cnt === 0) {
    const now = new Date().toISOString()
    db.prepare('INSERT INTO security_roles (id, name, rules, policies, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run('role_admin', 'Administrator', '["*"]', '["*"]', now, now)
    db.prepare('INSERT INTO security_roles (id, name, rules, policies, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run('role_analyst', 'Analyst', '["agents:read","rules:read","decoders:read"]', '["*"]', now, now)
    db.prepare('INSERT INTO security_roles (id, name, rules, policies, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run('role_viewer', 'Viewer', '["agents:read"]', '[]', now, now)
    db.prepare('INSERT INTO security_policies (id, name, policy, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('policy_default', 'Default Policy', JSON.stringify({ enabled: true, level: 'low' }), now, now)
  }

  // Phase 4: users + notifications
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'analyst',
      displayName TEXT DEFAULT '',
      email TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'webhook',
      name TEXT NOT NULL DEFAULT '',
      url TEXT DEFAULT '',
      secret TEXT DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      events TEXT NOT NULL DEFAULT '["rule.match"]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notificationId TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      response TEXT DEFAULT '',
      createdAt TEXT NOT NULL
    );
  `)

  // Seed default admin if no users exist
  const count = db.prepare('SELECT COUNT(*) as cnt FROM users').get()
  if (count.cnt === 0) {
    const bcrypt = require('bcryptjs')
    const hash = bcrypt.hashSync('admin', 10)
    const now = new Date().toISOString()
    db.prepare('INSERT INTO users (id, username, password, role, displayName, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      'user_admin', 'admin', hash, 'admin', 'Administrator', 'admin@localhost', now, now
    )
    console.log('✔ Default admin user created (admin / admin)')
  }
}

function closeDB() {
  if (db) db.close()
}

// ─── RULES CRUD ───

function getAllRules() {
  const rows = db.prepare('SELECT * FROM rules ORDER BY updatedAt DESC').all()
  return rows.map(deserializeRule)
}

function getRule(id) {
  const row = db.prepare('SELECT * FROM rules WHERE id = ?').get(id)
  return row ? deserializeRule(row) : null
}

function createRule(data) {
  const id = data.id || 'rule_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO rules (id, name, enabled, overwrite, conditionLogic, conditions, actions, groupIds, tags, priority, frequency, timeframe, timeframeUnit, suppression, suppressionMax, suppressionField, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    id, data.name || 'New Rule',
    data.enabled !== false ? 1 : 0,
    data.overwrite !== false ? 1 : 0,
    data.conditionLogic || 'AND',
    JSON.stringify(data.conditions || []),
    JSON.stringify(data.actions || [{ type: 'alert', params: { severity: 'high', message: '' } }]),
    JSON.stringify(data.groupIds || []),
    JSON.stringify(data.tags || []),
    data.priority || 0,
    data.frequency || 0, data.timeframe || 0, data.timeframeUnit || 'm',
    data.suppression || 0, data.suppressionMax || 0, data.suppressionField || 'agent.name',
    data.createdAt || now,
    data.updatedAt || now
  )
  return getRule(id)
}

function updateRule(id, data) {
  const existing = getRule(id)
  if (!existing) return null
  const merged = { ...existing, ...data, updatedAt: new Date().toISOString() }
  const stmt = db.prepare(`
    UPDATE rules SET name=?, enabled=?, overwrite=?, conditionLogic=?, conditions=?, actions=?, groupIds=?, tags=?, priority=?, frequency=?, timeframe=?, timeframeUnit=?, suppression=?, suppressionMax=?, suppressionField=?, updatedAt=?
    WHERE id=?
  `)
  stmt.run(
    merged.name, merged.enabled ? 1 : 0, merged.overwrite ? 1 : 0,
    merged.conditionLogic, JSON.stringify(merged.conditions),
    JSON.stringify(merged.actions), JSON.stringify(merged.groupIds),
    JSON.stringify(merged.tags), merged.priority,
    merged.frequency || 0, merged.timeframe || 0, merged.timeframeUnit || 'm',
    merged.suppression || 0, merged.suppressionMax || 0, merged.suppressionField || 'agent.name',
    merged.updatedAt, id
  )
  return getRule(id)
}

function deleteRule(id) {
  db.prepare('DELETE FROM rules WHERE id = ?').run(id)
  return true
}

function toggleRuleEnabled(id) {
  const r = getRule(id)
  if (!r) return null
  return updateRule(id, { enabled: !r.enabled })
}

// ─── RULE VERSIONS ───

function getVersionHistory(ruleId, maxVersions = 10) {
  return db.prepare('SELECT * FROM rule_versions WHERE ruleId = ? ORDER BY versionNumber DESC LIMIT ?').all(ruleId, maxVersions)
}

function saveVersion(ruleId, comment = '') {
  const rule = getRule(ruleId)
  if (!rule) return null
  const rows = db.prepare('SELECT COUNT(*) as cnt FROM rule_versions WHERE ruleId = ?').get(ruleId)
  const versionNumber = (rows.cnt || 0) + 1
  const maxVersions = 10
  const stmt = db.prepare('INSERT INTO rule_versions (ruleId, versionNumber, snapshot, comment, timestamp) VALUES (?, ?, ?, ?, ?)')
  stmt.run(ruleId, versionNumber, JSON.stringify(rule), comment, new Date().toISOString())
  // Trim old versions
  const excess = db.prepare('SELECT id FROM rule_versions WHERE ruleId = ? ORDER BY versionNumber DESC LIMIT 1 OFFSET ?').all(ruleId, maxVersions - 1)
  if (excess.length) {
    db.prepare('DELETE FROM rule_versions WHERE ruleId = ? AND id <= ?').run(ruleId, excess[excess.length - 1].id - 1)
  }
  return { versionNumber, timestamp: new Date().toISOString() }
}

function rollbackToVersion(ruleId, versionNumber) {
  const version = db.prepare('SELECT * FROM rule_versions WHERE ruleId = ? AND versionNumber = ?').get(ruleId, versionNumber)
  if (!version) return null
  const snapshot = JSON.parse(version.snapshot)
  return updateRule(ruleId, snapshot)
}

// ─── GROUPS CRUD ───

function getAllGroups() {
  return db.prepare('SELECT * FROM rule_groups ORDER BY name ASC').all()
}

function createGroup(data) {
  const id = data.id || 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  db.prepare('INSERT INTO rule_groups (id, name, description, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, data.name || 'New Group', data.description || '', data.color || '#6b7280', data.createdAt || now, data.updatedAt || now
  )
  return db.prepare('SELECT * FROM rule_groups WHERE id = ?').get(id)
}

function updateGroup(id, data) {
  const existing = db.prepare('SELECT * FROM rule_groups WHERE id = ?').get(id)
  if (!existing) return null
  const merged = { ...existing, ...data, updatedAt: new Date().toISOString() }
  db.prepare('UPDATE rule_groups SET name=?, description=?, color=?, updatedAt=? WHERE id=?').run(
    merged.name, merged.description, merged.color, merged.updatedAt, id
  )
  return db.prepare('SELECT * FROM rule_groups WHERE id = ?').get(id)
}

function deleteGroup(id) {
  db.prepare('DELETE FROM rule_groups WHERE id = ?').run(id)
  return true
}

// ─── DECODERS CRUD ───

function getAllDecoders() {
  return db.prepare('SELECT * FROM decoders ORDER BY updatedAt DESC').all()
}

function getDecoder(id) {
  return db.prepare('SELECT * FROM decoders WHERE id = ?').get(id) || null
}

function createDecoder(data) {
  const id = data.id || 'dec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO decoders (id, name, format, programName, regex, fields, "order", parentId, enabled, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, data.name || 'New Decoder', data.format || 'custom', data.programName || '',
    data.regex || '', JSON.stringify(data.fields || []), JSON.stringify(data.order || []),
    data.parentId || '', data.enabled !== false ? 1 : 0, data.createdAt || now, data.updatedAt || now
  )
  return getDecoder(id)
}

function updateDecoder(id, data) {
  const existing = getDecoder(id)
  if (!existing) return null
  const merged = { ...existing, ...data, updatedAt: new Date().toISOString() }
  db.prepare(`UPDATE decoders SET name=?, format=?, programName=?, regex=?, fields=?, "order"=?, parentId=?, enabled=?, updatedAt=? WHERE id=?`).run(
    merged.name, merged.format, merged.programName, merged.regex,
    JSON.stringify(merged.fields), JSON.stringify(merged.order),
    merged.parentId, merged.enabled ? 1 : 0, merged.updatedAt, id
  )
  return getDecoder(id)
}

function deleteDecoder(id) {
  db.prepare('DELETE FROM decoders WHERE id = ?').run(id)
  return true
}

// ─── USERS ───

function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null
}

function getUser(id) {
  return db.prepare('SELECT id, username, role, displayName, email, createdAt, updatedAt FROM users WHERE id = ?').get(id) || null
}

function getAllUsers() {
  return db.prepare('SELECT id, username, role, displayName, email, createdAt, updatedAt FROM users ORDER BY createdAt ASC').all()
}

function createUser(data) {
  const bcrypt = require('bcryptjs')
  const id = data.id || 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  const hash = bcrypt.hashSync(data.password || 'changeme', 10)
  db.prepare('INSERT INTO users (id, username, password, role, displayName, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, data.username, hash, data.role || 'analyst', data.displayName || '', data.email || '', now, now
  )
  return getUser(id)
}

function updateUser(id, data) {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  if (!existing) return null
  const merged = { ...existing, ...data, updatedAt: new Date().toISOString() }
  if (data.password) { const bcrypt = require('bcryptjs'); merged.password = bcrypt.hashSync(data.password, 10) }
  db.prepare('UPDATE users SET username=?, role=?, displayName=?, email=?, updatedAt=? WHERE id=?').run(
    merged.username, merged.role, merged.displayName, merged.email, merged.updatedAt, id
  )
  return getUser(id)
}

function deleteUser(id) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  return true
}

// ─── NOTIFICATIONS ───

function getAllNotifications() {
  return db.prepare('SELECT * FROM notifications ORDER BY createdAt DESC').all()
}

function getNotification(id) {
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) || null
}

function createNotification(data) {
  const id = data.id || 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  db.prepare('INSERT INTO notifications (id, type, name, url, secret, enabled, events, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, data.type || 'webhook', data.name || 'Webhook', data.url || '', data.secret || '',
    data.enabled !== false ? 1 : 0, JSON.stringify(data.events || ['rule.match']), now, now
  )
  return getNotification(id)
}

function updateNotification(id, data) {
  const existing = getNotification(id)
  if (!existing) return null
  const merged = { ...existing, ...data, updatedAt: new Date().toISOString() }
  db.prepare('UPDATE notifications SET type=?, name=?, url=?, secret=?, enabled=?, events=?, updatedAt=? WHERE id=?').run(
    merged.type, merged.name, merged.url, merged.secret, merged.enabled ? 1 : 0,
    JSON.stringify(merged.events || ['rule.match']), merged.updatedAt, id
  )
  return getNotification(id)
}

function deleteNotification(id) {
  db.prepare('DELETE FROM notifications WHERE id = ?').run(id)
  return true
}

function getNotificationLogs(limit = 50) {
  return db.prepare('SELECT * FROM notification_logs ORDER BY createdAt DESC LIMIT ?').all(limit)
}

function addNotificationLog(nid, event, status, response) {
  db.prepare('INSERT INTO notification_logs (notificationId, event, status, response, createdAt) VALUES (?, ?, ?, ?, ?)').run(
    nid, event, status, response || '', new Date().toISOString()
  )
}

// ─── WAZUH AGENTS CRUD ───

function getAgents(params = {}) {
  let sql = 'SELECT * FROM agents WHERE 1=1'
  const binds = []
  if (params.status) { sql += ' AND status=?'; binds.push(params.status) }
  if (params.q) { sql += ' AND (name LIKE ? OR ip LIKE ?)'; binds.push(`%${params.q}%`, `%${params.q}%`) }
  sql += ' ORDER BY name ASC'
  if (params.limit) { sql += ' LIMIT ?'; binds.push(parseInt(params.limit)) }
  if (params.offset) { sql += ' OFFSET ?'; binds.push(parseInt(params.offset)) }
  return db.prepare(sql).all(...binds)
}

function getAgent(id) {
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(id) || null
}

function getAgentSummary() {
  const total = db.prepare('SELECT COUNT(*) as total FROM agents').get().total
  const active = db.prepare("SELECT COUNT(*) as cnt FROM agents WHERE status='active'").get().cnt
  const disconnected = db.prepare("SELECT COUNT(*) as cnt FROM agents WHERE status='disconnected'").get().cnt
  const pending = db.prepare("SELECT COUNT(*) as cnt FROM agents WHERE status='pending'").get().cnt
  return { total, active, disconnected, pending, coverity: 0 }
}

function deleteAgent(id) {
  db.prepare('DELETE FROM agents WHERE id = ?').run(id)
  return true
}

function createAgent(data) {
  const now = new Date().toISOString()
  const id = data.id || String(Date.now())
  db.prepare(`INSERT INTO agents (id, name, ip, status, os_name, os_version, os_platform, version, lastKeepAlive, dateAdd, groupConfig, mergedGroup, node_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, data.name, data.ip || '0.0.0.0', data.status || 'active', data.os_name || '', data.os_version || '', data.os_platform || '',
    data.version || 'UniShield360 v3.0.0', now, now, JSON.stringify(data.groupConfig || []), data.mergedGroup || 'default', data.node_name || 'node01'
  )
  return getAgent(id)
}

// ─── CDB LISTS ───

function getCdbLists() {
  return db.prepare('SELECT filename, createdAt, updatedAt FROM cdb_lists ORDER BY filename ASC').all()
}

function getCdbList(filename) {
  return db.prepare('SELECT * FROM cdb_lists WHERE filename = ?').get(filename) || null
}

function upsertCdbList(filename, content) {
  const now = new Date().toISOString()
  const existing = getCdbList(filename)
  if (existing) {
    db.prepare('UPDATE cdb_lists SET content=?, updatedAt=? WHERE filename=?').run(content, now, filename)
  } else {
    db.prepare('INSERT INTO cdb_lists (filename, content, createdAt, updatedAt) VALUES (?,?,?,?)').run(filename, content, now, now)
  }
  return getCdbList(filename)
}

function deleteCdbList(filename) {
  db.prepare('DELETE FROM cdb_lists WHERE filename = ?').run(filename)
  return true
}

// ─── MITRE ───

function getMitreGroups() {
  return db.prepare('SELECT * FROM mitre_groups ORDER BY name ASC').all()
}

function getMitreTechniques() {
  return db.prepare('SELECT * FROM mitre_techniques ORDER BY name ASC').all()
}

function getMitreGroup(id) {
  return db.prepare('SELECT * FROM mitre_groups WHERE id = ?').get(id) || null
}

function getMitreTechnique(id) {
  return db.prepare('SELECT * FROM mitre_techniques WHERE id = ?').get(id) || null
}

// ─── SYSCHECK ───

function getSyscheckEntries(agentId, limit = 50) {
  return db.prepare('SELECT * FROM syscheck_entries WHERE agent_id = ? ORDER BY date DESC LIMIT ?').all(agentId, limit)
}

function getSyscheckLastScan(agentId) {
  const row = db.prepare('SELECT MAX(date) as last_scan FROM syscheck_entries WHERE agent_id = ?').get(agentId)
  return { last_scan: row?.last_scan || null, agent_id: agentId }
}

// ─── VULNERABILITIES ───

function getVulnerabilities(agentId, limit = 50) {
  return db.prepare('SELECT * FROM vulnerabilities WHERE agent_id = ? ORDER BY created DESC LIMIT ?').all(agentId, limit)
}

// ─── SCA ───

function getScaChecks(agentId, limit = 50) {
  return db.prepare('SELECT * FROM sca_checks WHERE agent_id = ? ORDER BY created DESC LIMIT ?').all(agentId, limit)
}

// ─── ROOTCHECK ───

function getRootcheckEntries(agentId, limit = 50) {
  return db.prepare('SELECT * FROM rootcheck_entries WHERE agent_id = ? ORDER BY last_seen DESC LIMIT ?').all(agentId, limit)
}

// ─── LOGTEST ───

function createLogtestSession() {
  const id = 'session_' + Date.now()
  const token = require('crypto').randomBytes(16).toString('hex')
  const now = new Date().toISOString()
  db.prepare('INSERT INTO logtest_sessions (id, token, created_at, last_used) VALUES (?,?,?,?)').run(id, token, now, now)
  return { id, token, created_at: now, last_used: now }
}

function deleteLogtestSession(id) {
  db.prepare('DELETE FROM logtest_sessions WHERE id = ?').run(id)
  return true
}

function getLogtestSessions() {
  return db.prepare('SELECT * FROM logtest_sessions ORDER BY created_at DESC').all()
}

// ─── SECURITY ROLES & POLICIES ───

function getSecurityRoles() {
  return db.prepare('SELECT * FROM security_roles ORDER BY name ASC').all()
}

function getSecurityRole(id) {
  return db.prepare('SELECT * FROM security_roles WHERE id = ?').get(id) || null
}

function getSecurityPolicies() {
  return db.prepare('SELECT * FROM security_policies ORDER BY name ASC').all()
}

// ─── Manager Info ───

function getManagerInfo() {
  return {
    name: 'unishield360-manager',
    type: 'master',
    version: 'UniShield360 v3.0.0',
    openssl_support: true,
    openssl_version: 'OpenSSL 1.1.1w',
    max_agents: 10000,
    installation_date: '2024-01-15',
    path: require('path').join(__dirname, '..'),
  }
}

function getManagerStatus() {
  return {
    'wazuh-analysisd': 'running',
    'wazuh-authd': 'running',
    'wazuh-db': 'running',
    'wazuh-email': 'running',
    'wazuh-execd': 'running',
    'wazuh-integratord': 'running',
    'wazuh-logcollector': 'running',
    'wazuh-maild': 'running',
    'wazuh-modulesd': 'running',
    'wazuh-monitord': 'running',
    'wazuh-remoted': 'running',
    'wazuh-syscheckd': 'running',
    'wazuh-agentlessd': 'running',
    'wazuh-csyslogd': 'running',
    'wazuh-clusterd': 'running',
  }
}

function getClusterStatus() {
  return { enabled: 'yes', running: 'yes', node_type: 'master', node_name: 'node01' }
}

function getClusterNodes() {
  return [{ name: 'node01', type: 'master', ip: '0.0.0.0', status: 'active', version: 'UniShield360 v3.0.0' }]
}

// ─── REPORTS CRUD ───

function getAllReports() {
  return db.prepare('SELECT * FROM reports ORDER BY updatedAt DESC').all()
}

function getReport(id) {
  return db.prepare('SELECT * FROM reports WHERE id = ?').get(id) || null
}

function createReport(data) {
  const id = data.id || 'rpt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO reports (id, name, description, dashboardId, timeRange, format, includeCharts, includeTables, includeMetrics, scheduled, frequency, time, days, emailTo, emailFrom, emailSubject, includeInBody, attachAsFile, status, createdBy, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.name || 'New Report', data.description || '', data.dashboardId || '',
    data.timeRange || 'now-24h', data.format || 'PDF',
    data.includeCharts !== false ? 1 : 0,
    data.includeTables !== false ? 1 : 0,
    data.includeMetrics !== false ? 1 : 0,
    data.scheduled ? 1 : 0, data.frequency || 'Daily', data.time || '08:00',
    JSON.stringify(data.days || ['Monday']),
    data.emailTo || '', data.emailFrom || '', data.emailSubject || '',
    data.includeInBody ? 1 : 0, data.attachAsFile !== false ? 1 : 0,
    data.status || 'created', data.createdBy || '',
    data.createdAt || now, data.updatedAt || now
  )
  return getReport(id)
}

function updateReport(id, data) {
  const existing = getReport(id)
  if (!existing) return null
  const merged = { ...existing, ...data, updatedAt: new Date().toISOString() }
  db.prepare(`
    UPDATE reports SET name=?, description=?, dashboardId=?, timeRange=?, format=?, includeCharts=?, includeTables=?, includeMetrics=?, scheduled=?, frequency=?, time=?, days=?, emailTo=?, emailFrom=?, emailSubject=?, includeInBody=?, attachAsFile=?, status=?, lastRun=?, nextRun=?, lastEmailSent=?, error=?, updatedAt=? WHERE id=?
  `).run(
    merged.name, merged.description, merged.dashboardId, merged.timeRange, merged.format,
    merged.includeCharts ? 1 : 0, merged.includeTables ? 1 : 0, merged.includeMetrics ? 1 : 0,
    merged.scheduled ? 1 : 0, merged.frequency, merged.time,
    JSON.stringify(merged.days || ['Monday']),
    merged.emailTo, merged.emailFrom, merged.emailSubject,
    merged.includeInBody ? 1 : 0, merged.attachAsFile !== false ? 1 : 0,
    merged.status, merged.lastRun || null, merged.nextRun || null,
    merged.lastEmailSent || null, merged.error || '',
    merged.updatedAt, id
  )
  return getReport(id)
}

function deleteReport(id) {
  db.prepare('DELETE FROM reports WHERE id = ?').run(id)
  return true
}

function getScheduledReports() {
  return db.prepare("SELECT * FROM reports WHERE scheduled = 1 AND status != 'disabled' ORDER BY nextRun ASC").all()
}

// ─── SHARES CRUD ───

function getAllShares() {
  return db.prepare('SELECT * FROM shares ORDER BY createdAt DESC').all()
}

function getSharesByDashboard(dashboardId) {
  return db.prepare('SELECT * FROM shares WHERE dashboardId = ? ORDER BY createdAt DESC').all(dashboardId)
}

function getShare(id) {
  return db.prepare('SELECT * FROM shares WHERE id = ?').get(id) || null
}

function getShareByToken(token) {
  return db.prepare('SELECT * FROM shares WHERE token = ?').get(token) || null
}

function createShare(data) {
  const id = data.id || 'shr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
  const token = data.token || require('crypto').randomBytes(16).toString('hex')
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO shares (id, dashboardId, token, isPublic, includeTime, includeFilters, expiresAt, createdBy, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.dashboardId, token,
    data.isPublic ? 1 : 0,
    data.includeTime !== false ? 1 : 0,
    data.includeFilters !== false ? 1 : 0,
    data.expiresAt || null,
    data.createdBy || '',
    data.createdAt || now
  )
  return getShare(id)
}

function updateShare(id, data) {
  const existing = getShare(id)
  if (!existing) return null
  const merged = { ...existing, ...data }
  db.prepare(`
    UPDATE shares SET isPublic=?, includeTime=?, includeFilters=?, expiresAt=?, createdAt=? WHERE id=?
  `).run(
    merged.isPublic ? 1 : 0,
    merged.includeTime !== false ? 1 : 0,
    merged.includeFilters !== false ? 1 : 0,
    merged.expiresAt || null,
    merged.createdAt || existing.createdAt,
    id
  )
  return getShare(id)
}

function deleteShare(id) {
  db.prepare('DELETE FROM shares WHERE id = ?').run(id)
  return true
}

// ─── HELPERS ───

function deserializeRule(row) {
  return {
    ...row,
    enabled: !!row.enabled,
    overwrite: !!row.overwrite,
    conditions: JSON.parse(row.conditions || '[]'),
    actions: JSON.parse(row.actions || '[]'),
    groupIds: JSON.parse(row.groupIds || '[]'),
    tags: JSON.parse(row.tags || '[]')
  }
}

module.exports = {
  initDB, closeDB,
  getAllRules, getRule, createRule, updateRule, deleteRule, toggleRuleEnabled,
  getVersionHistory, saveVersion, rollbackToVersion,
  getAllGroups, createGroup, updateGroup, deleteGroup,
  getAllDecoders, getDecoder, createDecoder, updateDecoder, deleteDecoder,
  getUserByUsername, getUser, getAllUsers, createUser, updateUser, deleteUser,
  getAllNotifications, getNotification, createNotification, updateNotification, deleteNotification,
  getNotificationLogs, addNotificationLog,
  getAgents, getAgent, getAgentSummary, deleteAgent, createAgent,
  getCdbLists, getCdbList, upsertCdbList, deleteCdbList,
  getMitreGroups, getMitreTechniques, getMitreGroup, getMitreTechnique,
  getSyscheckEntries, getSyscheckLastScan,
  getVulnerabilities,
  getScaChecks,
  getRootcheckEntries,
  createLogtestSession, deleteLogtestSession, getLogtestSessions,
  getSecurityRoles, getSecurityRole, getSecurityPolicies,
  getManagerInfo, getManagerStatus,
  getClusterStatus, getClusterNodes,
  getAllReports, getReport, createReport, updateReport, deleteReport, getScheduledReports,
  getAllShares, getSharesByDashboard, getShare, getShareByToken, createShare, updateShare, deleteShare
}
