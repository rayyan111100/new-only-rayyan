require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const API = process.env.UNISHIELD360_API_URL;
const WUSER = process.env.UNISHIELD360_USER;
const WPASS = process.env.UNISHIELD360_PASSWORD;

if (!process.env.JWT_SECRET) console.warn('⚠ JWT_SECRET not set — using insecure default. Set JWT_SECRET in .env for production.');

app.use(cors());
app.use(express.json());
app.use((req, res, next) => { res.setTimeout(120000); next(); });

// Serve built React app (dist/) in production, fallback to public/
const distPath = path.join(__dirname, '..', 'dist');
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(distPath));
app.use(express.static(publicPath));

// --- UniShield360 API JWT Auth ---
let token = null;
let tokenExpiry = 0;
let authBackoffUntil = 0;

async function authenticate() {
  if (!WUSER || !WPASS) {
    console.warn('⚠ UNISHIELD360_USER or UNISHIELD360_PASSWORD not set — using no auth');
    return;
  }
  if (Date.now() < authBackoffUntil) return;
  try {
    const creds = Buffer.from(`${WUSER}:${WPASS}`).toString('base64');
    const { data } = await axios.post(`${API}/security/user/authenticate`, null, {
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' },
      timeout: 10000
    });
    token = data.data?.token || data.token;
    tokenExpiry = Date.now() + 300000;
    console.log('✔ UniShield360 API authenticated');
  } catch (err) {
    token = null;
    const status = err.response?.status;
    if (status === 501) {
      authBackoffUntil = Date.now() + 86400000;
    } else {
      console.error('✖ Auth failed:', err.response?.data?.message || err.message);
    }
  }
}

const api = axios.create({ baseURL: API, timeout: 120000 });

api.interceptors.request.use(async config => {
  if (WUSER && WPASS) {
    if (!token || Date.now() > tokenExpiry) await authenticate();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  // Map unishield360-* index names to actual wazuh-* indices for the API
  if (config.params?.index) config.params.index = config.params.index.replace(/^unishield360-/i, 'wazuh-');
  return config;
});

// Whitelist of fields whose values should have "wazuh" replaced with "unishield360" in responses
const INDEX_FIELDS = new Set(['_index', 'index', 'index_name']);
function transformIndexNames(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(transformIndexNames);
  for (const key of Object.keys(obj)) {
    if (INDEX_FIELDS.has(key) && typeof obj[key] === 'string') {
      obj[key] = obj[key].replace(/wazuh/gi, 'unishield360');
    } else if (typeof obj[key] === 'object') {
      transformIndexNames(obj[key]);
    }
  }
  return obj;
}

api.interceptors.response.use(res => {
  if (res.data) transformIndexNames(res.data);
  return res;
});

if (WUSER && WPASS) authenticate();

// Universal proxy: forwards to UniShield360 API preserving HTTP method
async function proxy(method, endpoint, data, res) {
  if (!API) return res.status(503).json({ error: 'UNISHIELD360_API_URL not configured in .env' })
  try {
    const config = { timeout: 120000 }
    let response
    switch (method) {
      case 'GET': response = await api.get(endpoint, { params: data }); break
      case 'POST': response = await api.post(endpoint, data, config); break
      case 'PUT': response = await api.put(endpoint, data, config); break
      case 'DELETE': response = await api.delete(endpoint, config); break
      default: response = await api.get(endpoint, { params: data })
    }
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const msg = err.response?.data || err.message;
    res.status(status).json({ error: typeof msg === 'string' ? msg : JSON.stringify(msg) });
  }
}

const ENDPOINTS = ['health', 'indices', 'index-stats', 'fields', 'search', 'count', 'scan', 'aggregate', 'geo'];
for (const ep of ENDPOINTS) {
  app.get(`/api/${ep}`, (req, res) => proxy('GET', `/${ep}`, req.query, res));
}
// UniShield360 Manager rules/decoders (separate prefix from local DB CRUD)
const UNISHIELD360_ENDPOINTS = { 'wazuh-rules': 'rules', 'wazuh-decoders': 'decoders' };
for (const [local, remote] of Object.entries(UNISHIELD360_ENDPOINTS)) {
  app.get(`/api/${local}`, (req, res) => proxy('GET', `/${remote}`, req.query, res));
  app.post(`/api/${local}`, (req, res) => proxy('POST', `/${remote}`, req.body, res));
  app.put(`/api/${local}/:id`, (req, res) => proxy('PUT', `/${remote}/${req.params.id}`, req.body, res));
  app.delete(`/api/${local}/:id`, (req, res) => proxy('DELETE', `/${remote}/${req.params.id}`, {}, res));
}

app.post('/api/scan', (req, res) => proxy('POST', '/scan', req.body, res));
app.post('/api/search', (req, res) => proxy('POST', '/search', req.body, res));



// ─── Database ───
const db = require('./db.cjs');
db.initDB();
console.log('✔ SQLite database initialized');

// ─── Rule Engine (server-side) ───
const re = require('./ruleEngine.cjs');

// ─── Groups API (MUST be before /:id routes) ───
app.get('/api/rules/groups', (req, res) => res.json(db.getAllGroups()));
app.post('/api/rules/groups', (req, res) => { try { const g = db.createGroup(req.body); res.status(201).json(g) } catch (e) { res.status(400).json({ error: e.message }) } });
app.put('/api/rules/groups/:id', (req, res) => { const g = db.updateGroup(req.params.id, req.body); g ? res.json(g) : res.status(404).json({ error: 'Group not found' }) });
app.delete('/api/rules/groups/:id', (req, res) => { db.deleteGroup(req.params.id); res.json({ ok: true }) });

// ─── Decoders API ───
app.get('/api/decoders', (req, res) => res.json(db.getAllDecoders()));
app.get('/api/decoders/:id', (req, res) => { const d = db.getDecoder(req.params.id); d ? res.json(d) : res.status(404).json({ error: 'Decoder not found' }) });
app.post('/api/decoders', (req, res) => { try { const d = db.createDecoder(req.body); res.status(201).json(d) } catch (e) { res.status(400).json({ error: e.message }) } });
app.put('/api/decoders/:id', (req, res) => { const d = db.updateDecoder(req.params.id, req.body); d ? res.json(d) : res.status(404).json({ error: 'Decoder not found' }) });
app.delete('/api/decoders/:id', (req, res) => { db.deleteDecoder(req.params.id); res.json({ ok: true }) });

// ─── Rules CRUD (groups/export routes already defined above — these use :id param) ───
app.get('/api/rules/export-wazuh', (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',') : []
  const rules = ids.length ? ids.map(id => db.getRule(id)).filter(Boolean) : db.getAllRules()
  if (!rules.length) return res.status(404).json({ error: 'No rules to export' })
  const xml = xmlConv.rulesToUnishield360Xml(rules)
  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Content-Disposition', `attachment; filename="custom-rules-${Date.now()}.xml"`)
  res.send(xml)
})
app.post('/api/rules/import-wazuh', (req, res) => {
  try {
    const xmlStr = req.body.xml || req.body
    if (!xmlStr || typeof xmlStr !== 'string') return res.status(400).json({ error: 'XML string required' })
    const rules = xmlConv.parseUnishield360Xml(xmlStr)
    const created = rules.map(r => db.createRule(r))
    res.status(201).json({ imported: created.length, rules: created })
  } catch (e) { res.status(400).json({ error: e.message }) }
})
app.get('/api/rules', (req, res) => res.json(db.getAllRules()));
app.post('/api/rules', (req, res) => { try { const r = db.createRule(req.body); res.status(201).json(r) } catch (e) { res.status(400).json({ error: e.message }) } });
app.get('/api/rules/:id', (req, res) => { const r = db.getRule(req.params.id); r ? res.json(r) : res.status(404).json({ error: 'Rule not found' }) });
app.get('/api/rules/:id/export-wazuh', (req, res) => { const rule = db.getRule(req.params.id); if (!rule) return res.status(404).json({ error: 'Rule not found' }); const xml = xmlConv.ruleToUnishield360Xml(rule); res.setHeader('Content-Type', 'application/xml'); res.send(xml) });
app.put('/api/rules/:id', (req, res) => { const r = db.updateRule(req.params.id, req.body); r ? res.json(r) : res.status(404).json({ error: 'Rule not found' }) });
app.delete('/api/rules/:id', (req, res) => { db.deleteRule(req.params.id); res.json({ ok: true }) });
app.post('/api/rules/:id/toggle', (req, res) => { const r = db.toggleRuleEnabled(req.params.id); r ? res.json(r) : res.status(404).json({ error: 'Rule not found' }) });
app.get('/api/rules/:id/versions', (req, res) => res.json(db.getVersionHistory(req.params.id)));
app.post('/api/rules/:id/versions', (req, res) => { const v = db.saveVersion(req.params.id, req.body.comment); v ? res.status(201).json(v) : res.status(404).json({ error: 'Rule not found' }) });
app.post('/api/rules/:id/rollback/:version', (req, res) => { const r = db.rollbackToVersion(req.params.id, parseInt(req.params.version)); r ? res.json(r) : res.status(404).json({ error: 'Version or rule not found' }) });
app.post('/api/rules/:id/evaluate', (req, res) => { const rule = db.getRule(req.params.id); if (!rule) return res.status(404).json({ error: 'Rule not found' }); const result = re.evalRule(rule, req.body.doc || {}); res.json({ rule: rule.name, ...result }) });
app.post('/api/rules/evaluate-all', (req, res) => { const rules = db.getAllRules().filter(r => r.enabled); const result = re.evaluateAllRules(rules, req.body.doc || {}); res.json(result) });
app.post('/api/rules/batch-evaluate', (req, res) => {
  const rules = db.getAllRules().filter(r => r.enabled);
  const docs = req.body.docs || [];
  const results = docs.map((doc, i) => { const result = re.evaluateAllRules(rules, doc); return { index: i, matched: result.matched, matches: result.matches.map(m => ({ ruleId: m.rule.id, ruleName: m.rule.name })) } });
  res.json({ total: docs.length, matched: results.filter(r => r.matched).length, results });
});

// ─── Decoder Engine (server-side) ───
const de = require('./decoderEngine.cjs');

// Enriched search: fetch + decode full_log + evaluate rules
app.post('/api/search/enriched', async (req, res) => {
  try {
    const query = { ...req.body, limit: req.body.limit || 50, sort: req.body.sort || '@timestamp', order: req.body.order || 'desc' }
    const [searchRes, countRes] = await Promise.all([
      api.get('/search', { params: query }).catch(() => ({ data: { results: [], total: 0 } })),
      api.get('/count', { params: { index: query.index, q: query.q || '*', start_date: query.start_date, end_date: query.end_date } }).catch(() => ({ data: { count: 0 } }))
    ])
    let results = searchRes.data.results || []
    const total = countRes.data.count || searchRes.data.total || 0
    results = results.map(doc => { const fullLog = doc.full_log || ''; const decoded = de.decodeLog(fullLog); return { ...doc, decoded: decoded.fields, decoded_format: decoded.format, decoded_raw: decoded.raw } })
    const rules = db.getAllRules().filter(r => r.enabled)
    const evaluation = rules.length > 0 ? results.map((doc, i) => { const result = re.evaluateAllRules(rules, doc); return result.matched ? { index: i, matched: true, ruleIds: result.matches.map(m => m.rule.id), ruleNames: result.matches.map(m => m.rule.name) } : null }).filter(Boolean) : []
    res.json({ total, results, decoded: true, evaluated: evaluation.length, ruleMatches: evaluation })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Map UniShield360 index names to actual Wazuh index names for API calls
function mapIndex(idx) {
  if (!idx) return idx;
  return idx.replace(/^unishield360-/i, 'wazuh-');
}

// ─── UniShield360 XML Converter ───
const xmlConv = require('./unishield360Xml.cjs');

// SOC Dashboard Aggregation Endpoint
app.get('/api/dashboard', async (req, res) => {
  const { index, start_date, end_date } = req.query;
  const idx = index || 'unishield360-alerts-4.x-*';
  const sd = start_date || 'now-24h';
  const ed = end_date || 'now';
  try {
    const [
      count24, count7d, count30d,
      byLevel, topRules, topAgents,
      timeline, categories, recent
    ] = await Promise.all([
      api.get('/count', { params: { index: idx, start_date: sd, end_date: ed } }).catch(() => ({ data: { count: 0 } })),
      api.get('/count', { params: { index: idx, start_date: 'now-7d', end_date: 'now' } }).catch(() => ({ data: { count: 0 } })),
      api.get('/count', { params: { index: idx, start_date: 'now-30d', end_date: 'now' } }).catch(() => ({ data: { count: 0 } })),
      api.get('/aggregate', { params: { index: idx, field: 'rule.level', type: 'terms', start_date: sd, end_date: ed, limit: 20 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, field: 'rule.id', type: 'terms', start_date: sd, end_date: ed, limit: 10 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, field: 'agent.name', type: 'terms', start_date: sd, end_date: ed, limit: 10 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, field: '@timestamp', type: 'date_histogram', interval: '1h', start_date: sd, end_date: ed, limit: 48 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, field: 'rule.category', type: 'terms', start_date: sd, end_date: ed, limit: 10 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/search', { params: { index: idx, limit: 10, sort: '@timestamp', order: 'desc', start_date: sd, end_date: ed, q: '' } }).catch(() => ({ data: { results: [], total: 0 } }))
    ]);
    res.json({
      count24: count24.data.count || 0,
      count7d: count7d.data.count || 0,
      count30d: count30d.data.count || 0,
      byLevel: byLevel.data.buckets || [],
      topRules: topRules.data.buckets || [],
      topAgents: topAgents.data.buckets || [],
      timeline: timeline.data.buckets || [],
      categories: categories.data.buckets || [],
      recent: recent.data.results || [],
      recentTotal: recent.data.total || 0
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Windows Events Dashboard Aggregation Endpoint
app.get('/api/windows-dashboard', async (req, res) => {
  const { index, start_date, end_date } = req.query;
  const idx = index || 'unishield360-alerts-4.x-*';
  const sd = start_date || 'now-24h';
  const ed = end_date || 'now';
  const winQ = 'rule.groups:windows';
  try {
    const [
      count24, count7d, count30d,
      byLevel, topEventIds, topAgents,
      timeline, recent, logonFailed,
      processes
    ] = await Promise.all([
      api.get('/count', { params: { index: idx, q: winQ, start_date: sd, end_date: ed } }).catch(() => ({ data: { count: 0 } })),
      api.get('/count', { params: { index: idx, q: winQ, start_date: 'now-7d', end_date: 'now' } }).catch(() => ({ data: { count: 0 } })),
      api.get('/count', { params: { index: idx, q: winQ, start_date: 'now-30d', end_date: 'now' } }).catch(() => ({ data: { count: 0 } })),
      api.get('/aggregate', { params: { index: idx, q: winQ, field: 'rule.level', type: 'terms', start_date: sd, end_date: ed, limit: 20 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, q: winQ, field: 'data.win.system.eventId', type: 'terms', start_date: sd, end_date: ed, limit: 10 } }).catch(() => {
        return api.get('/aggregate', { params: { index: idx, q: winQ, field: 'win.event_id', type: 'terms', start_date: sd, end_date: ed, limit: 10 } }).catch(() => ({ data: { buckets: [] } }))
      }),
      api.get('/aggregate', { params: { index: idx, q: winQ, field: 'agent.name', type: 'terms', start_date: sd, end_date: ed, limit: 10 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, q: winQ, field: '@timestamp', type: 'date_histogram', interval: '1h', start_date: sd, end_date: ed, limit: 48 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/search', { params: { index: idx, q: winQ, limit: 10, sort: '@timestamp', order: 'desc', start_date: sd, end_date: ed } }).catch(() => ({ data: { results: [], total: 0 } })),
      api.get('/count', { params: { index: idx, q: '(' + winQ + ') AND data.win.eventId:4625', start_date: sd, end_date: ed } }).catch(() => ({ data: { count: 0 } })),
      api.get('/aggregate', { params: { index: idx, q: winQ, field: 'data.win.process.name', type: 'terms', start_date: sd, end_date: ed, limit: 8 } }).catch(() => ({ data: { buckets: [] } }))
    ]);
    res.json({
      count24: count24.data.count || 0,
      count7d: count7d.data.count || 0,
      count30d: count30d.data.count || 0,
      byLevel: byLevel.data.buckets || [],
      topEventIds: topEventIds.data.buckets || [],
      topAgents: topAgents.data.buckets || [],
      timeline: timeline.data.buckets || [],
      recent: recent.data.results || [],
      recentTotal: recent.data.total || 0,
      logonFailed: logonFailed.data.count || 0,
      processes: processes.data.buckets || []
    });
  } catch (err) {
    console.error('Windows dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Compliance Dashboard Aggregation Endpoint
const COMPLIANCE_QUERIES = {
  'PCI-DSS': '_exists_:rule.pci_dss',
  'HIPAA': '_exists_:rule.hipaa',
  'GDPR': '_exists_:rule.gdpr',
  'TSC (SOC 2)': '_exists_:rule.tsc',
  'MITRE ATT&CK': '_exists_:rule.mitre',
}
const COMPLIANCE_FRAMEWORKS = Object.keys(COMPLIANCE_QUERIES)

app.get('/api/compliance', async (req, res) => {
  const { index, start_date, end_date, framework } = req.query;
  const idx = index || 'unishield360-alerts-4.x-*';
  const sd = start_date || 'now-24h';
  const ed = end_date || 'now';
  const compQ = framework ? COMPLIANCE_QUERIES[framework] || '_exists_:rule.' + framework.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() : Object.values(COMPLIANCE_QUERIES).join(' OR ');
  try {
    const [
      count24, count7d,
      byLevel, topRules, topAgents,
      timeline, categories, recent
    ] = await Promise.all([
      api.get('/count', { params: { index: idx, q: compQ, start_date: sd, end_date: ed } }).catch(() => ({ data: { count: 0 } })),
      api.get('/count', { params: { index: idx, q: compQ, start_date: 'now-7d', end_date: 'now' } }).catch(() => ({ data: { count: 0 } })),
      api.get('/aggregate', { params: { index: idx, q: compQ, field: 'rule.level', type: 'terms', start_date: sd, end_date: ed, limit: 20 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, q: compQ, field: 'rule.id', type: 'terms', start_date: sd, end_date: ed, limit: 20 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, q: compQ, field: 'agent.name', type: 'terms', start_date: sd, end_date: ed, limit: 10 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, q: compQ, field: '@timestamp', type: 'date_histogram', interval: '1h', start_date: sd, end_date: ed, limit: 48 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, q: compQ, field: 'rule.category', type: 'terms', start_date: sd, end_date: ed, limit: 10 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/search', { params: { index: idx, q: compQ, limit: 20, sort: '@timestamp', order: 'desc', start_date: sd, end_date: ed } }).catch(() => ({ data: { results: [], total: 0 } }))
    ]);

    const frameworkCounts = !framework ? await Promise.all(
      COMPLIANCE_FRAMEWORKS.map(fw => {
        return api.get('/count', { params: { index: idx, q: COMPLIANCE_QUERIES[fw], start_date: sd, end_date: ed } }).catch(() => ({ data: { count: 0 } }));
      })
    ) : [];

    const severityMap = {};
    for (const b of (byLevel.data.buckets || [])) {
      const level = parseInt(b.key) || 0;
      const cat = level >= 12 ? 'Critical' : level >= 7 ? 'High' : level >= 4 ? 'Medium' : 'Low';
      severityMap[cat] = (severityMap[cat] || 0) + b.doc_count;
    }

    res.json({
      count24: count24.data.count || 0,
      count7d: count7d.data.count || 0,
      severity: severityMap,
      frameworkCounts: !framework ? COMPLIANCE_FRAMEWORKS.map((fw, i) => ({
        framework: fw,
        count: frameworkCounts[i]?.data?.count || 0
      })) : [],
      topRules: (topRules.data.buckets || []).slice(0, 8).map(r => ({
        ruleId: r.key,
        count: r.doc_count || 0,
        description: r.description || ''
      })),
      topAgents: (topAgents.data.buckets || []).slice(0, 8),
      timeline: (timeline.data.buckets || []).map(b => ({ time: b.key, count: b.doc_count || 0 })),
      categories: (categories.data.buckets || []).slice(0, 8),
      recent: (recent.data.results || []).slice(0, 20),
      recentTotal: recent.data.total || 0
    });
  } catch (err) {
    console.error('Compliance error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Auth ───
const auth = require('./auth.cjs');

app.post('/api/auth/login', (req, res) => {
  const result = auth.login(db, req.body.username, req.body.password)
  result.ok ? res.json(result) : res.status(401).json(result)
})

app.get('/api/auth/me', auth.authMiddleware, (req, res) => {
  const user = db.getUser(req.user.sub)
  user ? res.json({ user }) : res.status(404).json({ error: 'User not found' })
})

app.post('/api/auth/logout', auth.authMiddleware, (req, res) => res.json({ ok: true }))

// ─── User Management (admin only) ───
app.get('/api/users', auth.authMiddleware, auth.roleMiddleware('admin'), (req, res) => res.json(db.getAllUsers()))
app.post('/api/users', auth.authMiddleware, auth.roleMiddleware('admin'), (req, res) => { try { res.status(201).json(db.createUser(req.body)) } catch (e) { res.status(400).json({ error: e.message }) } })
app.put('/api/users/:id', auth.authMiddleware, auth.roleMiddleware('admin'), (req, res) => { const u = db.updateUser(req.params.id, req.body); u ? res.json(u) : res.status(404).json({ error: 'User not found' }) })
app.delete('/api/users/:id', auth.authMiddleware, auth.roleMiddleware('admin'), (req, res) => { db.deleteUser(req.params.id); res.json({ ok: true }) })

// ─── Notifications (admin only) ───
app.get('/api/notifications', auth.authMiddleware, auth.roleMiddleware('admin'), (req, res) => res.json(db.getAllNotifications()))
app.post('/api/notifications', auth.authMiddleware, auth.roleMiddleware('admin'), (req, res) => { try { res.status(201).json(db.createNotification(req.body)) } catch (e) { res.status(400).json({ error: e.message }) } })
app.put('/api/notifications/:id', auth.authMiddleware, auth.roleMiddleware('admin'), (req, res) => { const n = db.updateNotification(req.params.id, req.body); n ? res.json(n) : res.status(404).json({ error: 'Notification not found' }) })
app.delete('/api/notifications/:id', auth.authMiddleware, auth.roleMiddleware('admin'), (req, res) => { db.deleteNotification(req.params.id); res.json({ ok: true }) })
app.get('/api/notifications/logs', auth.authMiddleware, auth.roleMiddleware('admin'), (req, res) => res.json(db.getNotificationLogs()))

// ─── Notifier integration ───
const notifier = require('./notifier.cjs');
notifier.initMailer();

// ─── Query API Routes ───
const queryRoutes = require('./services/queryRoutes.cjs');
app.use('/api/query', queryRoutes);

// ─── Realtime REST Routes ───
const realtimeRoutes = require('./services/realtimeRoutes.cjs');
app.use('/api/realtime', realtimeRoutes);

// ─── SSE (Server-Sent Events) Routes ───
const SSEService = require('./services/sseService.cjs');

// Send test webhook
app.post('/api/notifications/test', auth.authMiddleware, auth.roleMiddleware('admin'), async (req, res) => {
  const result = await notifier.sendWebhook(req.body, { type: 'test', message: 'Test notification from dashboard' })
  res.json(result)
})

// ─── Reports API ───
const cron = require('node-cron')

app.get('/api/reports', auth.authMiddleware, (req, res) => {
  res.json(db.getAllReports())
})

app.post('/api/reports', auth.authMiddleware, (req, res) => {
  try {
    const r = db.createReport(req.body)
    if (r.scheduled) {
      const nextRun = calculateNextRun(r)
      db.updateReport(r.id, { nextRun })
    }
    res.status(201).json(r)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.put('/api/reports/:id', auth.authMiddleware, (req, res) => {
  const r = db.updateReport(req.params.id, req.body)
  if (r) {
    if (r.scheduled) {
      const nextRun = calculateNextRun(r)
      db.updateReport(r.id, { nextRun })
    }
    res.json(r)
  } else {
    res.status(404).json({ error: 'Report not found' })
  }
})

app.delete('/api/reports/:id', auth.authMiddleware, (req, res) => {
  db.deleteReport(req.params.id)
  res.json({ ok: true })
})

app.post('/api/reports/:id/generate', auth.authMiddleware, async (req, res) => {
  try {
    const report = db.getReport(req.params.id)
    if (!report) return res.status(404).json({ error: 'Report not found' })

    db.updateReport(report.id, { status: 'generating', lastRun: new Date().toISOString() })

    // Fetch dashboard data for the report
    const fs = require('fs')
    const dashPath = require('path').join(__dirname, '..', 'data', 'dashboards.json')
    let dashboards = []
    if (fs.existsSync(dashPath)) {
      try { dashboards = JSON.parse(fs.readFileSync(dashPath, 'utf-8')) } catch {}
    }
    const dashboard = dashboards.find(d => d.id === report.dashboardId)
    const panelData = await Promise.all(
      (dashboard?.panels || []).slice(0, 20).map(async (panel) => {
        try {
          const params = {
            index: 'unishield360-alerts-4.x-*',
            limit: 20,
            start_date: report.timeRange || 'now-24h',
            end_date: 'now',
          }
          const resp = await api.get('/search', { params }).catch(() => ({ data: { results: [], total: 0 } }))
          return { id: panel.id, title: panel.title, vizType: panel.vizType, data: resp.data }
        } catch {
          return { id: panel.id, title: panel.title, vizType: panel.vizType, data: null }
        }
      })
    )

    const result = {
      reportId: report.id,
      reportName: report.name,
      dashboard: dashboard?.name || 'Unknown',
      panels: panelData,
      total: dashboard?.panels?.length || 0,
      generatedAt: new Date().toISOString(),
    }

    db.updateReport(report.id, {
      status: 'completed',
      lastRun: new Date().toISOString(),
    })

    // Send email if configured
    if (report.sendEmail && report.emailTo) {
      const emailResult = await notifier.sendEmail({
        to: report.emailTo,
        from: report.emailFrom || process.env.SMTP_FROM,
        subject: report.emailSubject || 'Report: ' + report.name,
        body: 'Report "' + report.name + '" has been generated.\nDashboard: ' + (dashboard?.name || report.dashboardId) + '\nPanels: ' + (dashboard?.panels?.length || 0) + '\nGenerated: ' + new Date().toLocaleString(),
      })
      db.updateReport(report.id, { lastEmailSent: new Date().toISOString() })
      result.emailResult = emailResult
    }

    res.json(result)
  } catch (e) {
    db.updateReport(req.params.id, { status: 'failed', error: e.message })
    res.status(500).json({ error: e.message })
  }
})

// Schedule checker — runs every minute
cron.schedule('* * * * *', () => {
  try {
    const reports = db.getScheduledReports()
    const now = new Date()
    for (const r of reports) {
      if (r.nextRun && new Date(r.nextRun) <= now) {
        const nextRun = calculateNextRun(r)
        db.updateReport(r.id, { status: 'scheduled', lastRun: new Date().toISOString(), nextRun })
        console.log('⏰ Report due: ' + r.name + ' (' + r.id + ') — next run: ' + nextRun)
      }
    }
  } catch (e) {
    console.error('Schedule check error:', e.message)
  }
})

function calculateNextRun(config) {
  const now = new Date()
  const [h, m] = (config.time || '08:00').split(':').map(Number)
  const next = new Date(now)
  next.setHours(h || 8, m || 0, 0, 0)
  if (config.frequency === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1)
  } else if (config.frequency === 'weekly') {
    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const days = (config.days || ['Monday']).map(d => dayMap.indexOf(d.toLowerCase()))
    const today = now.getDay()
    let nextDay = days.find(d => d > today)
    if (nextDay === undefined) nextDay = days[0] + 7
    next.setDate(next.getDate() + ((nextDay + 7 - today) % 7 || 7))
  } else if (config.frequency === 'monthly') {
    if (next <= now) next.setMonth(next.getMonth() + 1, 1)
  }
  return next.toISOString()
}

// ─── Shares API ───

app.get('/api/shares', auth.authMiddleware, (req, res) => {
  if (req.query.dashboardId) {
    res.json(db.getSharesByDashboard(req.query.dashboardId))
  } else {
    res.json(db.getAllShares())
  }
})

app.post('/api/shares', auth.authMiddleware, (req, res) => {
  try {
    const s = db.createShare({ ...req.body, createdBy: req.user?.sub || 'system' })
    res.status(201).json(s)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.put('/api/shares/:id', auth.authMiddleware, (req, res) => {
  const s = db.updateShare(req.params.id, req.body)
  s ? res.json(s) : res.status(404).json({ error: 'Share not found' })
})

app.delete('/api/shares/:id', auth.authMiddleware, (req, res) => {
  db.deleteShare(req.params.id)
  res.json({ ok: true })
})

app.get('/api/shared/:token', async (req, res) => {
  try {
    const share = db.getShareByToken(req.params.token)
    if (!share) return res.status(404).json({ error: 'Share not found' })
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Share has expired' })
    }
    // Return dashboard data from localStorage backup (stored as JSON file)
    const fs = require('fs')
    const path = require('path')
    const dashPath = path.join(__dirname, '..', 'data', 'dashboards.json')
    let dashboard = null
    if (fs.existsSync(dashPath)) {
      const all = JSON.parse(fs.readFileSync(dashPath, 'utf-8'))
      dashboard = all.find(d => d.id === share.dashboardId) || null
    }
    res.json({ share, dashboard })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Settings (auth-protected) ───
app.get('/api/settings', auth.authMiddleware, (req, res) => {
  res.json({
    pollInterval: parseInt(process.env.UNISHIELD360_POLL_INTERVAL || '15000'),
    jwtExpiry: process.env.JWT_EXPIRY || '24h',
    user: req.user
  })
})

// SPA fallback: serve index.html for any non-API route
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  const publicIndex = path.join(publicPath, 'index.html');
  if (require('fs').existsSync(indexPath)) return res.sendFile(indexPath);
  if (require('fs').existsSync(publicIndex)) return res.sendFile(publicIndex);
  res.status(404).send('Not found');
});

app.use((req, res, next) => { res.setTimeout(120000); next(); });

// ─── Realtime Engine ───
  const RealtimeEngine = require('./realtime.cjs');
  const RealtimeManager = require('./realtimeManager.cjs');

  function startServer(port) {
    const server = app.listen(port)
      .on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`✖ Port ${port} is already in use. Trying port ${port + 1}...`);
          startServer(port + 1);
        } else {
          console.error('✖ Server error:', err.message);
        }
      })
      .on('listening', () => {
        const addr = server.address();
        console.log(`✔ UniShield360 Dashboard at http://localhost:${addr.port}`);
        console.log(`✔ Proxy → ${API}`);

        // Initialize RealtimeManager (WebSocket + polling)
        const rt = new RealtimeManager(server, api, db, re, de);
        app.set('realtime', rt);
        const pollInterval = parseInt(process.env.UNISHIELD360_POLL_INTERVAL || '15000');
        rt.startPolling(pollInterval);

        // Initialize SSE service
        const sse = new SSEService(api);
        app.get('/sse/alerts', (req, res) => sse.handleAlerts(req, res));
        app.get('/sse/timeseries', (req, res) => sse.handleTimeseries(req, res));
        app.get('/sse/dashboard/:id', (req, res) => sse.handleDashboard(req, res, req.params.id));
        console.log(`✔ SSE endpoints at /sse/alerts, /sse/timeseries, /sse/dashboard/:id`);

        // Legacy realtime stats endpoint
        app.get('/api/realtime/stats', (req, res) => {
          const rtStats = rt.getStats();
          res.json(rtStats);
        });

        // Integrate notifier with realtime engine
        const origBroadcast = rt.broadcast.bind(rt);
        rt.broadcast = function(data) {
          origBroadcast(data);
          if (data.type === 'match' || data.type === 'alert') {
            notifier.processNotifications(db, data).catch(() => {});
          }
        };
      });
  }

startServer(PORT);
