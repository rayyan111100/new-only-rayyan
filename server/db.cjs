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
  getNotificationLogs, addNotificationLog
}
