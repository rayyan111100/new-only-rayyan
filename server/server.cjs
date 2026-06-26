require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const https = require('https');
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
app.use(express.text({ type: 'application/x-ndjson' }));
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
      console.warn('⚠ UniShield360 API auth not supported (501) — running in no-auth mode');
      authBackoffUntil = Date.now() + 86400000;
    } else {
      console.error('✖ Auth failed:', err.response?.data?.message || err.message);
    }
  }
}

const api = axios.create({ baseURL: API, timeout: 120000 });

// Direct OpenSearch connection via OpenSearch Dashboards proxy (bypasses 10k max_result_window)
const OS_URL = process.env.UNISHIELD360_API_URL ? 'https://100.110.74.122:8443' : null;
const osApi = OS_URL ? axios.create({
  baseURL: OS_URL + '/api/console/proxy',
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
}) : null;
if (osApi) {
  osApi.interceptors.request.use(config => {
    config.headers['osd-xsrf'] = 'true';
    config.auth = { username: WUSER || 'admin', password: WPASS || '' };
    return config;
  });
}

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

// ─── Compliance Cache ───
const complianceCache = new Map();
const COMPLIANCE_CACHE_TTL = 25000;

const FRAMEWORK_FIELDS = {
  'PCI-DSS': 'rule.pci_dss',
  'HIPAA': 'rule.hipaa',
  'GDPR': 'rule.gdpr',
  'TSC (SOC 2)': 'rule.tsc',
  'MITRE ATT&CK': 'rule.mitre_attack',
  'NIST 800-53': 'rule.nist_800_53'
};
const FRAMEWORK_CONTROLS = {
  'PCI-DSS': { '11.5': 54, '6.4.2': 39, '10.5.5': 30, '8.2.3': 22, '3.4.1': 14 },
  'HIPAA': { '164.312(a)(1)': 42, '164.312(c)(1)': 28, '164.312(e)(1)': 18, '164.308(a)(1)': 14, '164.310(a)(1)': 11 },
  'GDPR': { 'II_5.1.f': 42, 'IV_35.7.d': 28, 'II_5.2.c': 18, 'III_32.1.b': 14, 'VI_30.1': 11 },
  'TSC (SOC 2)': { 'CC6.1': 42, 'CC6.8': 28, 'CC7.2': 18, 'CC7.3': 14, 'PI1.4': 11 },
  'MITRE ATT&CK': { 'T1078': 35, 'T1136': 22, 'T1098': 15, 'T1059': 12, 'T1053': 8 },
  'NIST 800-53': { 'AC-6': 42, 'AU-6': 28, 'CM-8': 18, 'SI-4': 14, 'RA-5': 11 }
};

const FRAMEWORK_NAMES = Object.keys(FRAMEWORK_FIELDS);
const allComplianceQ = FRAMEWORK_NAMES.map(f => '_exists_:' + FRAMEWORK_FIELDS[f]).join(' OR ');

function classifyDocFrameworks(doc) {
  const fws = [];
  for (const fw of FRAMEWORK_NAMES) {
    const field = FRAMEWORK_FIELDS[fw];
    const parts = field.split('.');
    let val = doc;
    for (const p of parts) { if (val) val = val[p]; }
    if (val && val.toString().trim()) fws.push(fw);
  }
  return fws;
}

app.get('/api/compliance', async (req, res) => {
  const { index, start_date, end_date, framework, q: filterQ } = req.query;
  const idx = index || 'unishield360-alerts-4.x-*';
  const sd = start_date || 'now-24h';
  const ed = end_date || 'now';
  const fq = (filterQ || '').trim();
  const cacheKey = `compliance:${framework || '__all__'}:${sd}:${ed}:${fq}`;

  const cached = complianceCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < COMPLIANCE_CACHE_TTL) {
    return res.json(cached.data);
  }

  const fwField = framework ? FRAMEWORK_FIELDS[framework] : null;
  const fwQ = fwField ? '_exists_:' + fwField : null;
  const combinedQ = [fwQ, fq].filter(Boolean).join(' AND ');
  // Wazuh OR query limit ~4 fields; split into batches of 3
  const overviewQ = !fwField ? (() => {
    const fields = FRAMEWORK_NAMES.map(f => '_exists_:' + FRAMEWORK_FIELDS[f]);
    const batches = [];
    for (let i = 0; i < fields.length; i += 3) batches.push(fields.slice(i, i + 3).join(' OR '));
    return fq ? batches.map(b => '(' + b + ') AND (' + fq + ')') : batches;
  })() : null;
  const frameworkField = fwField;
  try {
    async function aggOne(q, field, limit = 20) {
      return api.get('/aggregate', { params: { index: idx, q, field, type: 'terms', start_date: sd, end_date: ed, limit } }).catch(() => ({ data: { buckets: [] } }));
    }
    function mergeBuckets(responses) {
      const map = {};
      for (const r of responses) {
        for (const b of (r.data.buckets || [])) {
          map[b.key] = (map[b.key] || 0) + (b.doc_count || 0);
        }
      }
      return Object.entries(map).map(([key, doc_count]) => ({ key, doc_count })).sort((a, b) => b.doc_count - a.doc_count);
    }

    const [byLevel, topRules, topAgents, timeline, categories, recent, topControls] = !fwField
      ? await Promise.all([
          Promise.all(overviewQ.map(q => aggOne(q, 'rule.level'))).then(mergeBuckets).then(buckets => ({ data: { buckets } })),
          Promise.all(overviewQ.map(q => aggOne(q, 'rule.id'))).then(mergeBuckets).then(buckets => ({ data: { buckets } })),
          Promise.all(overviewQ.map(q => aggOne(q, 'agent.name', 10))).then(mergeBuckets).then(buckets => ({ data: { buckets } })),
          Promise.all(overviewQ.map(q => api.get('/aggregate', { params: { index: idx, q, field: '@timestamp', type: 'date_histogram', interval: '1h', start_date: sd, end_date: ed, limit: 48 } }).catch(() => ({ data: { buckets: [] } })))).then(responses => {
            const map = {};
            for (const r of responses) {
              for (const b of (r.data.buckets || [])) {
                map[b.key] = (map[b.key] || 0) + (b.doc_count || 0);
              }
            }
            return { data: { buckets: Object.entries(map).map(([key, doc_count]) => ({ key, doc_count })).sort((a, b) => a.key - b.key) } };
          }),
          Promise.all(overviewQ.map(q => aggOne(q, 'rule.category'))).then(mergeBuckets).then(buckets => ({ data: { buckets } })),
          Promise.all(overviewQ.map(q => api.get('/search', { params: { index: idx, q, limit: 1000, sort: '@timestamp', order: 'desc', start_date: sd, end_date: ed } }).catch(() => ({ data: { results: [], total: 0 } })))).then(responses => {
            const seen = new Set();
            const merged = [];
            for (const r of responses) {
              for (const doc of (r.data.results || [])) {
                const id = doc._id || doc['@timestamp'] + (doc.agent?.name || '');
                if (!seen.has(id)) { seen.add(id); merged.push(doc); }
              }
            }
            merged.sort((a, b) => (b['@timestamp'] || '').localeCompare(a['@timestamp'] || ''));
            return { data: { results: merged.slice(0, 1000), total: { value: merged.length } } };
          }),
          Promise.all(overviewQ.map(q => aggOne(q, frameworkField || 'rule.gdpr'))).then(mergeBuckets).then(buckets => ({ data: { buckets } })),
        ])
      : await Promise.all([
          aggOne(combinedQ, 'rule.level'),
          aggOne(combinedQ, 'rule.id'),
          aggOne(combinedQ, 'agent.name', 10),
          api.get('/aggregate', { params: { index: idx, q: combinedQ, field: '@timestamp', type: 'date_histogram', interval: '1h', start_date: sd, end_date: ed, limit: 48 } }).catch(() => ({ data: { buckets: [] } })),
          aggOne(combinedQ, 'rule.category'),
          api.get('/search', { params: { index: idx, q: combinedQ, limit: 1000, sort: '@timestamp', order: 'desc', start_date: sd, end_date: ed } }).catch(() => ({ data: { results: [], total: 0 } })),
          frameworkField ? aggOne(combinedQ, frameworkField) : Promise.resolve({ data: { buckets: [] } }),
        ]);

    let count24v = 0, count7dv = 0;
    if (!fwField) {
      const c24results = await Promise.all(FRAMEWORK_NAMES.map(fw => {
        let q = '_exists_:' + FRAMEWORK_FIELDS[fw];
        if (fq) q = '(' + q + ') AND (' + fq + ')';
        return api.get('/count', { params: { index: idx, q, start_date: sd, end_date: ed } }).catch(() => ({ data: { count: 0 } }));
      }));
      for (const r of c24results) count24v += r.data?.count || 0;
      const c7dresults = await Promise.all(FRAMEWORK_NAMES.map(fw => {
        let q = '_exists_:' + FRAMEWORK_FIELDS[fw];
        if (fq) q = '(' + q + ') AND (' + fq + ')';
        return api.get('/count', { params: { index: idx, q, start_date: 'now-7d', end_date: 'now' } }).catch(() => ({ data: { count: 0 } }));
      }));
      for (const r of c7dresults) count7dv += r.data?.count || 0;
    } else {
      count24v = (await api.get('/count', { params: { index: idx, q: combinedQ, start_date: sd, end_date: ed } }).catch(() => ({ data: { count: 0 } }))).data?.count || 0;
      count7dv = (await api.get('/count', { params: { index: idx, q: combinedQ, start_date: 'now-7d', end_date: 'now' } }).catch(() => ({ data: { count: 0 } }))).data?.count || 0;
    }

    const severityMap = {};
    for (const b of (byLevel.data?.buckets || [])) {
      const level = parseInt(b.key) || 0;
      const cat = level >= 12 ? 'Critical' : level >= 7 ? 'High' : level >= 4 ? 'Medium' : 'Low';
      severityMap[cat] = (severityMap[cat] || 0) + b.doc_count;
    }

    const controls = FRAMEWORK_CONTROLS[framework] || FRAMEWORK_CONTROLS['PCI-DSS'];
    const controlKeys = Object.keys(controls);
    const resolvedControls = (topRules.data.buckets || []).slice(0, 8).map((r, i) => ({
      control: controlKeys[i % controlKeys.length],
      ruleId: r.key,
      count: r.doc_count || 0,
      description: r.description || 'Control violation'
    }));

    const frameworkCounts = !framework ? await Promise.all(
      FRAMEWORK_NAMES.map(fw => {
        let q = '_exists_:' + FRAMEWORK_FIELDS[fw];
        if (fq) q = '(' + q + ') AND (' + fq + ')';
        return api.get('/count', { params: { index: idx, q, start_date: sd, end_date: ed } }).catch(() => ({ data: { count: 0 } }));
      })
    ) : [];

    const rawRecent = recent.data?.results || [];
    const recentDocs = rawRecent.map(doc => ({
      ...doc,
      _frameworks: classifyDocFrameworks(doc)
    }));
    const filteredRecent = framework ? recentDocs.filter(d => d._frameworks.includes(framework)) : recentDocs;

    const recentActualTotal = recent.data?.total?.value || rawRecent.length;

    const body = {
      count24: count24v,
      count7d: count7dv,
      severity: severityMap,
      frameworkCounts: !framework ? FRAMEWORK_NAMES.map((fw, i) => ({
        framework: fw,
        count: frameworkCounts[i]?.data?.count || 0
      })) : [],
      topRules: resolvedControls,
      topAgents: (topAgents.data.buckets || []).slice(0, 8),
      timeline: (timeline.data.buckets || []).map(b => ({
        time: b.key,
        count: b.doc_count || 0
      })),
      categories: (categories.data.buckets || []).slice(0, 8),
      topControls: (topControls.data.buckets || []).map(b => ({
        control: b.key,
        count: b.doc_count || 0
      })),
      recent: filteredRecent,
      recentTotal: recentActualTotal
    };

    complianceCache.set(cacheKey, { data: body, ts: Date.now() });
    res.json(body);
  } catch (err) {
    console.error('Compliance error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GDPR Dashboard Aggregation Endpoint
app.get('/api/gdpr-dashboard', async (req, res) => {
  const { index, start_date, end_date } = req.query;
  const idx = index || 'unishield360-alerts-4.x-*';
  const sd = start_date || 'now-1y';
  const ed = end_date || 'now';
  const gdprQ = '_exists_:rule.gdpr';
  try {
    const [
      countRes,
      sevAgg,
      articleAgg,
      agentAgg,
      trendAgg
    ] = await Promise.all([
      api.get('/count', { params: { index: idx, q: gdprQ, start_date: sd, end_date: ed } }).catch(() => ({ data: { count: 0 } })),
      api.get('/aggregate', { params: { index: idx, q: gdprQ, field: 'rule.level', type: 'terms', limit: 20, start_date: sd, end_date: ed } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, q: gdprQ, field: 'rule.gdpr', type: 'terms', limit: 50, start_date: sd, end_date: ed } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, q: gdprQ, field: 'agent.name', type: 'terms', limit: 100, start_date: sd, end_date: ed } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, q: gdprQ, field: '@timestamp', type: 'date_histogram', interval: '1d', limit: 365, start_date: sd, end_date: ed } }).catch(() => ({ data: { buckets: [] } }))
    ]);

    const total = countRes.data.count || 0;
    const sevBuckets = sevAgg.data.buckets || [];
    const articleBuckets = articleAgg.data.buckets || [];
    const agentBuckets = agentAgg.data.buckets || [];
    const trendBuckets = trendAgg.data.buckets || [];

    let sevCritical = 0, sevHigh = 0, sevMedium = 0, sevLow = 0;
    for (const b of sevBuckets) {
      const lvl = parseInt(b.key) || 0;
      const cnt = b.doc_count || 0;
      if (lvl >= 12) sevCritical += cnt;
      else if (lvl >= 7) sevHigh += cnt;
      else if (lvl >= 4) sevMedium += cnt;
      else sevLow += cnt;
    }

    res.json({
      total,
      severity: { critical: sevCritical, high: sevHigh, medium: sevMedium, low: sevLow },
      sevBuckets,
      articleBuckets,
      agentBuckets,
      trendBuckets
    });
  } catch (err) {
    console.error('GDPR dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GDPR Paginated Events Endpoint (uses structured OpenSearch queries for proper field handling)
app.get('/api/gdpr-events', async (req, res) => {
  const { index, start_date, end_date, limit, offset, search_after, search, severity, article } = req.query;
  const idx = (index || 'unishield360-alerts-4.x-*').replace(/^unishield360-/i, 'wazuh-');
  const sd = start_date || 'now-1y';
  const ed = end_date || 'now';
  const lim = Math.min(parseInt(limit) || 20, 10000);
  const off = Math.min(parseInt(offset) || 0, 9999);

  const filters = [{ "exists": { "field": "rule.gdpr" } }];
  const timeRange = {};
  if (sd && sd !== 'now') timeRange.gte = sd;
  if (ed && ed !== 'now') timeRange.lte = ed;
  if (Object.keys(timeRange).length) filters.push({ "range": { "@timestamp": timeRange } });

  // Search text → wildcard across agent.name, rule.id, agent.ip, rule.description
  if (search) {
    const s = search.replace(/[^a-zA-Z0-9_.\- ]/g, '');
    const wc = '*' + s + '*';
    filters.push({ "bool": { "should": [
      { "wildcard": { "agent.name": wc } },
      { "wildcard": { "rule.id": wc } },
      { "wildcard": { "agent.ip": wc } },
      { "wildcard": { "rule.description": wc } }
    ] } });
  }

  // Severity filter → range on rule.level
  if (severity) {
    const sevRanges = { 'Critical': { gte: 12 }, 'High': { gte: 7, lte: 11 }, 'Medium': { gte: 4, lte: 6 }, 'Low': { gte: 1, lte: 3 } };
    const range = sevRanges[severity];
    if (range) filters.push({ "range": { "rule.level": range } });
  }

  // Article filter → term on rule.gdpr
  if (article) {
    filters.push({ "term": { "rule.gdpr": article } });
  }

  const body = {
    size: lim,
    track_total_hits: true,
    query: { "bool": { "must": filters } },
    sort: [{ "@timestamp": { "order": "desc" } }, { "_id": { "order": "desc" } }]
  };

  let sa = null;
  if (search_after) { try { sa = JSON.parse(search_after); } catch {} }
  if (sa && Array.isArray(sa)) {
    body.search_after = sa;
  } else if (off > 0) {
    body.from = off;
  }

  async function queryWazuhApi() {
    const fb = await api.get('/search', {
      params: { index: idx, q: '_exists_:rule.gdpr', limit: lim, offset: 0, sort: '@timestamp', order: 'desc', start_date: sd, end_date: ed }
    });
    return { results: fb.data.results || [], total: fb.data.total || 0 };
  }

  try {
    if (!osApi) { const r = await queryWazuhApi(); return res.json(r); }
    const osRes = await osApi.post('', body, {
      params: { path: idx + '/_search', method: 'POST' }
    });
    const hits = osRes.data?.hits || {};
    const results = (hits.hits || []).map(h => ({ ...h._source, _id: h._id }));
    const lastSort = hits.hits?.length > 0 ? hits.hits[hits.hits.length - 1].sort : null;
    res.json({ results, total: hits.total?.value || 0, sort: lastSort });
  } catch (err) {
    console.error('OS proxy search failed, falling back:', err.message);
    try { const r = await queryWazuhApi(); res.json(r); }
    catch (e2) { res.status(500).json({ error: e2.message }); }
  }
});

// ─── EPS & Ingestion Stats Endpoint ───
app.get('/api/eps-stats', async (req, res) => {
  const { index, q, start_date, end_date } = req.query;
  const idx = index || 'unishield360-alerts-4.x-*';
  const sd = start_date || 'now-24h';
  const ed = end_date || 'now';
  const filterQ = q || '';
  try {
    const [
      indexStats, eps60Res, eps5mRes, eps1hRes,
      agentAgg, recentAgg, eventRateRes, indicesRes
    ] = await Promise.all([
      api.get('/index-stats', { params: { index: idx } }).catch(() => ({ data: { docs_count: 0, size_bytes: 0 } })),
      api.get('/count', { params: { index: idx, q: filterQ, start_date: 'now-60s', end_date: 'now' } }).catch(() => ({ data: { count: 0 } })),
      api.get('/count', { params: { index: idx, q: filterQ, start_date: 'now-5m', end_date: 'now' } }).catch(() => ({ data: { count: 0 } })),
      api.get('/count', { params: { index: idx, q: filterQ, start_date: 'now-1h', end_date: 'now' } }).catch(() => ({ data: { count: 0 } })),
      api.get('/aggregate', { params: { index: idx, q: filterQ, field: 'agent.name', type: 'terms', limit: 20, start_date: sd, end_date: ed } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/search', { params: { index: idx, q: filterQ, limit: 100, sort: '@timestamp', order: 'desc', start_date: 'now-5m', end_date: 'now' } }).catch(() => ({ data: { results: [] } })),
      api.get('/aggregate', { params: { index: idx, q: filterQ, field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48, start_date: sd, end_date: ed } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/indices', { params: { index: 'wazuh-alerts-4.x-*' } }).catch(() => ({ data: { patterns: [] } })),
    ]);

    const docsCount = indexStats.data?.docs_count || 0;
    const sizeBytes = indexStats.data?.size_bytes || 0;

    const eps60 = ((eps60Res.data?.count || 0) / 60);
    const eps5m = ((eps5mRes.data?.count || 0) / 300);
    const eps1h = ((eps1hRes.data?.count || 0) / 3600);
    const avgDocSize = docsCount > 0 ? sizeBytes / docsCount : 0;

    const agentBuckets = agentAgg.data?.buckets || [];
    const recentAgents = new Set(
      (recentAgg.data?.results || []).map(d => d.agent?.name).filter(Boolean)
    );

    const agentLastEventPromises = agentBuckets.slice(0, 20).map(b =>
      api.get('/search', {
        params: {
          index: idx, q: (filterQ ? `(${filterQ}) AND ` : '') + `agent.name:"${b.key}"`,
          limit: 1, sort: '@timestamp', order: 'desc', start_date: sd, end_date: ed,
        }
      }).catch(() => ({ data: { results: [] } }))
    );
    const agentLastEventResults = await Promise.all(agentLastEventPromises);

    const perAsset = agentBuckets.map((b, i) => {
      const count = b.doc_count || 0;
      const lastEvent = agentLastEventResults[i]?.data?.results?.[0]?.['@timestamp'] || null;
      return {
        agent: b.key,
        doc_count: count,
        eps: +(count / 86400).toFixed(2),
        estimated_size_bytes: Math.round(avgDocSize * count),
        last_event: lastEvent,
        status: recentAgents.has(b.key) ? 'active' : 'stopped',
      };
    });

    const logStop = perAsset.filter(a => a.status === 'stopped' && a.doc_count > 0);

    const eventRate = (eventRateRes.data?.buckets || []).map(b => ({
      time: b.key_as_string || b.key,
      count: b.doc_count || 0,
    }));

    const alertIndices = (indicesRes.data?.patterns || [])
      .find(p => p.pattern === 'wazuh-*')?.indices || [];
    const dailySizes = alertIndices
      .filter(i => i.name && i.name.match(/wazuh-alerts-4\.x-\d{4}\.\d{2}\.\d{2}/))
      .map(i => {
        const match = i.name.match(/(\d{4})\.(\d{2})\.(\d{2})/);
        return {
          date: match ? `${match[1]}-${match[2]}-${match[3]}` : i.name,
          size_bytes: parseInt(i.store_size) || 0,
          docs_count: i.docs_count || 0,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    const epsTrend = eventRate.map(b => ({
      time: b.time,
      eps: +(b.count / 3600).toFixed(2),
    }));

    // Min/Max ingest rate (KB/s) from daily sizes
    const daySizes = dailySizes.filter(d => d.size_bytes > 0)
    const rates = daySizes.map(d => d.size_bytes / 86400 / 1024)
    const minRate = rates.length > 0 ? Math.min(...rates) : 0
    const maxRate = rates.length > 0 ? Math.max(...rates) : 0

    res.json({
      success: true,
      eps: { '60s': +eps60.toFixed(2), '5m': +eps5m.toFixed(2), '1h': +eps1h.toFixed(2) },
      ingestion: {
        total_docs: docsCount,
        total_size_bytes: sizeBytes,
        total_size_mb: +(sizeBytes / 1048576).toFixed(1),
        total_size_gb: +(sizeBytes / 1073741824).toFixed(2),
        avg_doc_size_bytes: Math.round(avgDocSize),
        daily_sizes: dailySizes,
        min_rate: +(minRate).toFixed(2),
        max_rate: +(maxRate).toFixed(2),
      },
      per_asset: perAsset,
      event_rate: eventRate,
      eps_trend: epsTrend,
      log_stop: logStop,
    });
  } catch (err) {
    console.error('EPS stats error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Malware Detection Dashboard Endpoint ───
const MALWARE_GROUPS = ['audit', 'audit_command', 'audit_selinux', 'ciscat', 'rootcheck', 'virustotal', 'wazuh', 'sca', 'yara', 'misp', 'multiple_blocks', 'reconnaissance', 'malware', 'ransomware', 'ransomware_pre_detection', 'vulnerability-detector'];
const dashCache = new Map();
const CACHE_TTL = 10000;

function osBody(sd, ed) {
  const body = { size: 0, track_total_hits: true };
  const filters = [];
  if (sd && sd !== 'now') filters.push({ range: { '@timestamp': { gte: sd } } });
  if (ed && ed !== 'now') filters.push({ range: { '@timestamp': { lte: ed } } });
  filters.push({ terms: { 'rule.groups': MALWARE_GROUPS } });
  body.query = { bool: { filter: filters } };
  return body;
}

async function osQuery(idx, body) {
  if (!osApi) return null;
  const res = await osApi.post('', body, { params: { path: `${idx}/_search`, method: 'POST' }, timeout: 120000 });
  return { aggs: res.data?.aggregations || null, total: res.data?.hits?.total?.value || 0 };
}

async function wazuhAggregate(idx, field, type, opts = {}) {
  try {
    const params = { index: idx, field, type, limit: opts.limit || 50, start_date: opts.start_date || 'now-24h', end_date: opts.end_date || 'now' };
    if (opts.q) params.q = opts.q;
    if (opts.interval) params.interval = opts.interval;
    const res = await api.get('/aggregate', { params, timeout: 120000 });
    return res.data?.buckets || [];
  } catch { return []; }
}

app.get('/api/malware-dashboard', async (req, res) => {
  const { index, start_date, end_date } = req.query;
  const idx = index || 'wazuh-alerts-4.x-*,-wazuh-alerts-4.x-sample-auditing-policy-monitoring';
  const sd = start_date || 'now-24h';
  const ed = end_date || 'now';
  const cacheKey = `${idx}:${sd}:${ed}`;

  const cached = dashCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return res.json(cached.data);

  try {
    function di(hr) { return hr <= 24 ? '30m' : hr <= 72 ? '1h' : hr <= 336 ? '6h' : hr <= 720 ? '12h' : '1d'; }
    const sdMatch = sd?.match(/now-(\d+)([hdwMy])/);
    let totalH = 24;
    if (sdMatch) { const n = parseInt(sdMatch[1]), u = sdMatch[2]; totalH = u === 'h' ? n : u === 'd' ? n * 24 : u === 'w' ? n * 168 : u === 'M' ? n * 720 : u === 'y' ? n * 8760 : 24; }
    const evInt = di(totalH);

    const q1 = osBody(sd, ed);
    q1.aggs = { groups: { terms: { field: 'rule.groups', size: 20 }, aggs: {
      levels: { terms: { field: 'rule.level', size: 20 } },
      agents: { terms: { field: 'agent.name', size: 100 } },
      timeline: { date_histogram: { field: '@timestamp', fixed_interval: evInt, min_doc_count: 1 } }
    } } };

    const q2 = osBody(sd, ed);
    q2.aggs = { agents: { terms: { field: 'agent.name', size: 7, order: { _count: 'desc' } }, aggs: {
      timeline: { date_histogram: { field: '@timestamp', fixed_interval: evInt } }
    } } };

    const q3 = osBody(sd, ed);
    q3.aggs = { agents: { terms: { field: 'agent.name', size: 10, order: { _count: 'desc' } }, aggs: {
      groups: { terms: { field: 'rule.groups', size: 20 } }
    } } };

    function simpleAgg(field) { const b = osBody(sd, ed); b.aggs = { result: { terms: { field, size: 10 } } }; return b; }
    function simpleAggFiltered(field, filterQ) { const b = osBody(sd, ed); const p = filterQ.split(':'); if (p[0] && p[1]) { if (!b.query) b.query = { bool: { filter: [] } }; b.query.bool.filter.push({ term: { [p[0]]: p[1] } }); } b.aggs = { result: { terms: { field, size: 10 } } }; return b; }

    const [r1, r2, r3, r4, r5, r6, r7, r8] = await Promise.all([
      osQuery(idx, q1),
      osQuery(idx, q2),
      osQuery(idx, q3),
      osQuery(idx, simpleAgg('data.file')),
      osQuery(idx, simpleAggFiltered('data.virustotal.source.file', 'rule.groups:virustotal')),
      osQuery(idx, simpleAggFiltered('data.YARA.scanned_file', 'rule.groups:yara')),
      osQuery(idx, simpleAggFiltered('data.title', 'rule.groups:rootcheck')),
      osQuery(idx, simpleAgg('rule.description'))
    ]);

    if (!r1) {
      const [gBuckets, lBuckets, aBuckets, tBuckets] = await Promise.all([
        wazuhAggregate(idx, 'rule.groups', 'terms', { limit: 20, start_date: sd, end_date: ed }),
        Promise.all(MALWARE_GROUPS.map(g => wazuhAggregate(idx, 'rule.level', 'terms', { q: `rule.groups:${g}`, limit: 20, start_date: sd, end_date: ed }))),
        Promise.all(MALWARE_GROUPS.map(g => wazuhAggregate(idx, 'agent.name', 'terms', { q: `rule.groups:${g}`, limit: 100, start_date: sd, end_date: ed }))),
        Promise.all(MALWARE_GROUPS.map(g => wazuhAggregate(idx, '@timestamp', 'date_histogram', { q: `rule.groups:${g}`, interval: '1h', limit: 72, start_date: sd, end_date: ed })))
      ]);
      const validGroups = gBuckets.filter(b => b.key && b.doc_count > 0 && MALWARE_GROUPS.includes(b.key));
      const total = validGroups.reduce((s, b) => s + (b.doc_count || 0), 0);
      const sevMap = {};
      for (const buckets of lBuckets) for (const b of (buckets || [])) { const lvl = parseInt(b.key) || 0; sevMap[lvl] = (sevMap[lvl] || 0) + (b.doc_count || 0); }
      const sevBuckets = Object.entries(sevMap).map(([k, v]) => ({ key: k, doc_count: v }));
      let sevCritical = 0, sevHigh = 0, sevMedium = 0, sevLow = 0;
      for (const b of sevBuckets) { const lvl = parseInt(b.key) || 0, cnt = b.doc_count || 0; if (lvl >= 12) sevCritical += cnt; else if (lvl >= 7) sevHigh += cnt; else if (lvl >= 4) sevMedium += cnt; else sevLow += cnt; }
      const agentMap = {};
      for (const buckets of aBuckets) for (const b of (buckets || [])) agentMap[b.key] = (agentMap[b.key] || 0) + (b.doc_count || 0);
      const agentBuckets = Object.entries(agentMap).map(([k, v]) => ({ key: k, doc_count: v }));
      const timelineMap = {};
      for (const buckets of tBuckets) for (const b of (buckets || [])) { const k = b.key_as_string || b.key; timelineMap[k] = (timelineMap[k] || 0) + (b.doc_count || 0); }
      const trendBuckets = Object.entries(timelineMap).map(([k, v]) => ({ key: k, key_as_string: k, doc_count: v }));
      const data = { total, severity: { critical: sevCritical, high: sevHigh, medium: sevMedium, low: sevLow }, sevBuckets, agentBuckets, groupBuckets: validGroups, trendBuckets, sourceFiles: [], yaraFiles: [], rootcheckTitles: [], ruleDescriptions: [], agentsEvolution: [], agentsByGroup: [] };
      dashCache.set(cacheKey, { ts: Date.now(), data });
      if (dashCache.size > 50) { const fk = dashCache.keys().next().value; dashCache.delete(fk); }
      return res.json(data);
    }

    const groupBuckets = (r1.aggs?.groups?.buckets || []).filter(b => b.key && b.doc_count > 0 && MALWARE_GROUPS.includes(b.key));
    const total = r1.total || 0;
    const sevMap = {};
    for (const gb of (r1.aggs?.groups?.buckets || [])) for (const b of (gb.levels?.buckets || [])) { const lvl = parseInt(b.key) || 0; sevMap[lvl] = (sevMap[lvl] || 0) + (b.doc_count || 0); }
    const sevBuckets = Object.entries(sevMap).map(([k, v]) => ({ key: k, doc_count: v }));
    let sevCritical = 0, sevHigh = 0, sevMedium = 0, sevLow = 0;
    for (const b of sevBuckets) { const lvl = parseInt(b.key) || 0, cnt = b.doc_count || 0; if (lvl >= 12) sevCritical += cnt; else if (lvl >= 7) sevHigh += cnt; else if (lvl >= 4) sevMedium += cnt; else sevLow += cnt; }
    const agentMap = {};
    for (const gb of (r1.aggs?.groups?.buckets || [])) for (const b of (gb.agents?.buckets || [])) agentMap[b.key] = (agentMap[b.key] || 0) + (b.doc_count || 0);
    const agentBuckets = Object.entries(agentMap).map(([k, v]) => ({ key: k, doc_count: v }));
    const timelineMap = {};
    for (const gb of (r1.aggs?.groups?.buckets || [])) for (const b of (gb.timeline?.buckets || [])) { const k = b.key_as_string || b.key; timelineMap[k] = (timelineMap[k] || 0) + (b.doc_count || 0); }
    const trendBuckets = Object.entries(timelineMap).map(([k, v]) => ({ key: k, key_as_string: k, doc_count: v }));

    const agentsEvolution = (r2.aggs?.agents?.buckets || []).map(b => ({ agent: b.key, buckets: (b.timeline?.buckets || []).map(t => ({ key_as_string: t.key_as_string || t.key, doc_count: t.doc_count || 0 })) }));

    const agentsByGroup = (r3.aggs?.agents?.buckets || []).map(b => ({ agent: b.key, buckets: (b.groups?.buckets || []).filter(g => g.key).map(g => ({ key: g.key, doc_count: g.doc_count || 0 })) }));

    const sourceFileMap = new Map();
    for (const b of (r4?.aggs?.result?.buckets || [])) { if (b.key) sourceFileMap.set(b.key, (sourceFileMap.get(b.key) || 0) + (b.doc_count || 0)); }
    for (const b of (r5?.aggs?.result?.buckets || [])) { if (b.key) sourceFileMap.set(b.key, (sourceFileMap.get(b.key) || 0) + (b.doc_count || 0)); }
    const sourceFiles = [...sourceFileMap.entries()].map(([k, v]) => ({ key: k, doc_count: v })).sort((a, b) => b.doc_count - a.doc_count).slice(0, 10);
    const yaraFiles = (r6?.aggs?.result?.buckets || []).filter(b => b.key).map(b => ({ key: b.key, doc_count: b.doc_count }));
    const rootcheckTitles = (r7?.aggs?.result?.buckets || []).filter(b => b.key).map(b => ({ key: b.key, doc_count: b.doc_count }));
    const ruleDescriptions = (r8?.aggs?.result?.buckets || []).filter(b => b.key).map(b => ({ key: b.key, doc_count: b.doc_count }));

    const data = {
      total, severity: { critical: sevCritical, high: sevHigh, medium: sevMedium, low: sevLow },
      sevBuckets, agentBuckets, groupBuckets, trendBuckets,
      sourceFiles, yaraFiles, rootcheckTitles, ruleDescriptions,
      agentsEvolution, agentsByGroup
    };

    dashCache.set(cacheKey, { ts: Date.now(), data });
    if (dashCache.size > 50) { const fk = dashCache.keys().next().value; dashCache.delete(fk); }

    res.json(data);
  } catch (err) {
    console.error('Malware dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Malware Detection Paginated Events Endpoint
app.get('/api/malware-events', async (req, res) => {
  const { index, start_date, end_date, limit, offset, search_after, search, severity, type } = req.query;
  const idx = index || 'wazuh-alerts-4.x-*,-wazuh-alerts-4.x-sample-auditing-policy-monitoring';
  const sd = start_date || 'now-24h';
  const ed = end_date || 'now';
  const lim = Math.min(parseInt(limit) || 20, 10000);
  const off = Math.min(parseInt(offset) || 0, 9999);

  const filters = [];
  const timeRange = {};
  if (sd && sd !== 'now') timeRange.gte = sd;
  if (ed && ed !== 'now') timeRange.lte = ed;
  if (Object.keys(timeRange).length) filters.push({ "range": { "@timestamp": timeRange } });

  if (search) {
    const s = search.replace(/[^a-zA-Z0-9_.\- ]/g, '');
    const wc = '*' + s.toLowerCase() + '*';
    filters.push({ "bool": { "should": [
      { "wildcard": { "agent.name": { "value": wc, "case_insensitive": true } } },
      { "wildcard": { "rule.id": { "value": wc, "case_insensitive": true } } },
      { "wildcard": { "agent.ip": { "value": wc, "case_insensitive": true } } },
      { "wildcard": { "rule.description": { "value": wc, "case_insensitive": true } } },
      { "wildcard": { "rule.groups": { "value": wc, "case_insensitive": true } } }
    ] } });
  }

  if (severity) {
    const sevRanges = { 'Critical': { gte: 12 }, 'High': { gte: 7, lte: 11 }, 'Medium': { gte: 4, lte: 6 }, 'Low': { gte: 1, lte: 3 } };
    const range = sevRanges[severity];
    if (range) filters.push({ "range": { "rule.level": range } });
  }

  if (type) {
    const g = MALWARE_GROUPS.find(t => t === type)
    if (g) filters.push({ "term": { "rule.groups": g } });
  }

  if (filters.length === 0) {
    filters.push({ "bool": { "should": MALWARE_GROUPS.map(g => ({ "term": { "rule.groups": g } })) } });
  }

  const body = {
    size: lim,
    track_total_hits: true,
    query: { "bool": { "must": filters } },
    sort: [{ "@timestamp": { "order": "desc" } }, { "_id": { "order": "desc" } }]
  };

  let sa = null;
  if (search_after) { try { sa = JSON.parse(search_after); } catch {} }
  if (sa && Array.isArray(sa)) {
    body.search_after = sa;
  } else if (off > 0) {
    body.from = off;
  }

  async function queryWazuhApi() {
    const results = [];
    let total = 0;
    for (const g of MALWARE_GROUPS) {
      const fb = await api.get('/search', {
        params: { index: idx, q: `rule.groups:${g}`, limit: lim, offset: 0, sort: '@timestamp', order: 'desc', start_date: sd, end_date: ed }
      });
      const docs = (fb.data.results || []).filter(d => !results.some(r => r._id === d._id));
      results.push(...docs);
      total += fb.data.total || 0;
    }
    results.sort((a, b) => ((b['@timestamp'] || '') > (a['@timestamp'] || '') ? 1 : -1));
    return { results: results.slice(0, lim), total };
  }

  try {
    if (!osApi) { const r = await queryWazuhApi(); return res.json(r); }
    const osRes = await osApi.post('', body, {
      params: { path: idx + '/_search', method: 'POST' }
    });
    const hits = osRes.data?.hits || {};
    const results = (hits.hits || []).map(h => ({ ...h._source, _id: h._id }));
    const lastSort = hits.hits?.length > 0 ? hits.hits[hits.hits.length - 1].sort : null;
    res.json({ results, total: hits.total?.value || 0, sort: lastSort });
  } catch (err) {
    console.error('Malware OS proxy search failed, falling back:', err.message);
    try { const r = await queryWazuhApi(); res.json(r); }
    catch (e2) { res.status(500).json({ error: e2.message }); }
  }
});

// ─── FIM Dashboard Endpoint ───
const FIM_GROUPS = ['syscheck', 'syscheck_file', 'syscheck_registry', 'syscheck_entry_added', 'syscheck_entry_deleted', 'syscheck_entry_modified'];
const fimDashCache = new Map();

app.get('/api/fim-dashboard', async (req, res) => {
  const { index, start_date, end_date } = req.query;
  const idx = index || 'wazuh-alerts-4.x-*';
  const sd = start_date || 'now-24h';
  const ed = end_date || 'now';
  const cacheKey = 'fim:' + idx + ':' + sd + ':' + ed;
  const cached = fimDashCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return res.json(cached.data);
  try {
    function bd() { const b = { size: 0, track_total_hits: true }; const f = []; if (sd !== 'now') f.push({ range: { '@timestamp': { gte: sd } } }); if (ed !== 'now') f.push({ range: { '@timestamp': { lte: ed } } }); f.push({ terms: { 'rule.groups': FIM_GROUPS } }); b.query = { bool: { filter: f } }; return b; }
    async function osQ(body) { if (!osApi) return null; const r = await osApi.post('', body, { params: { path: idx + '/_search', method: 'POST' }, timeout: 120000 }); return { aggs: r.data?.aggregations || null, total: r.data?.hits?.total?.value || 0 }; }

    const sm = sd?.match(/now-(\d+)([hdwMy])/);
    let th = 24;
    if (sm) { const n = +sm[1], u = sm[2]; th = u === 'h' ? n : u === 'd' ? n * 24 : u === 'w' ? n * 168 : u === 'M' ? n * 720 : n * 8760; }
    const evInt = th <= 24 ? '30m' : th <= 72 ? '1h' : th <= 336 ? '6h' : th <= 720 ? '12h' : '1d';

    const q1 = bd(); q1.aggs = { groups: { terms: { field: 'rule.groups', size: 20 }, aggs: {
      levels: { terms: { field: 'rule.level', size: 20 } },
      agents: { terms: { field: 'agent.name', size: 100 } },
      timeline: { date_histogram: { field: '@timestamp', fixed_interval: evInt } }
    } } };

    const q2 = bd(); q2.aggs = { agents: { terms: { field: 'agent.name', size: 10, order: { _count: 'desc' } }, aggs: {
      events: { terms: { field: 'syscheck.event', size: 10 } }
    } } };

    function sa(field) { const b = bd(); b.aggs = { result: { terms: { field, size: 10 } } }; return b; }
    function saFiltered(field, filterQ) { const b = bd(); const p = filterQ.split(':'); if (p[0] && p[1]) b.query.bool.filter.push({ term: { [p[0]]: p[1] } }); b.aggs = { result: { terms: { field, size: 10 } } }; return b; }

    const [r1, r2, r3, r4, r5] = await Promise.all([
      osQ(q1), osQ(q2),
      osQ(sa('syscheck.path')),
      osQ(saFiltered('syscheck.path', 'rule.groups:syscheck_registry')),
      osQ(sa('rule.description'))
    ]);

    if (!r1) return res.json({ total:0, severity:{}, sevBuckets:[], agentBuckets:[], groupBuckets:[], trendBuckets:[], filePaths:[], registryPaths:[], ruleDescriptions:[], agentsEvolution:[], agentsByEvent:[] });

    const groupBuckets = (r1.aggs?.groups?.buckets || []).filter(b => b.key && b.doc_count > 0);
    const total = r1.total || 0;
    const sevMap = {};
    for (const gb of (r1.aggs?.groups?.buckets || [])) for (const b of (gb.levels?.buckets || [])) { const lvl = parseInt(b.key) || 0; sevMap[lvl] = (sevMap[lvl] || 0) + (b.doc_count || 0); }
    const sevBuckets = Object.entries(sevMap).map(([k, v]) => ({ key: k, doc_count: v }));
    let sevCritical = 0, sevHigh = 0, sevMedium = 0, sevLow = 0;
    for (const b of sevBuckets) { const lvl = parseInt(b.key) || 0, cnt = b.doc_count || 0; if (lvl >= 12) sevCritical += cnt; else if (lvl >= 7) sevHigh += cnt; else if (lvl >= 4) sevMedium += cnt; else sevLow += cnt; }
    const agentMap = {};
    for (const gb of (r1.aggs?.groups?.buckets || [])) for (const b of (gb.agents?.buckets || [])) agentMap[b.key] = (agentMap[b.key] || 0) + (b.doc_count || 0);
    const agentBuckets = Object.entries(agentMap).map(([k, v]) => ({ key: k, doc_count: v }));
    const timelineMap = {};
    for (const gb of (r1.aggs?.groups?.buckets || [])) for (const b of (gb.timeline?.buckets || [])) { const k = b.key_as_string || b.key; timelineMap[k] = (timelineMap[k] || 0) + (b.doc_count || 0); }
    const trendBuckets = Object.entries(timelineMap).map(([k, v]) => ({ key: k, key_as_string: k, doc_count: v }));

    const agentsByEvent = (r2.aggs?.agents?.buckets || []).map(b => {
      const row = { agent: b.key };
      for (const e of (b.events?.buckets || [])) row[e.key] = (row[e.key] || 0) + (e.doc_count || 0);
      return row;
    });

    const filePaths = (r3?.aggs?.result?.buckets || []).filter(b => b.key).map(b => ({ key: b.key, doc_count: b.doc_count }));
    const registryPaths = (r4?.aggs?.result?.buckets || []).filter(b => b.key).map(b => ({ key: b.key, doc_count: b.doc_count }));
    const ruleDescriptions = (r5?.aggs?.result?.buckets || []).filter(b => b.key).map(b => ({ key: b.key, doc_count: b.doc_count }));

    const data = { total, severity: { critical: sevCritical, high: sevHigh, medium: sevMedium, low: sevLow }, sevBuckets, agentBuckets, groupBuckets, trendBuckets, filePaths, registryPaths, ruleDescriptions, agentsByEvent };
    fimDashCache.set(cacheKey, { ts: Date.now(), data });
    if (fimDashCache.size > 50) { const fk = fimDashCache.keys().next().value; fimDashCache.delete(fk); }
    res.json(data);
  } catch (err) {
    console.error('FIM dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── FIM Paginated Events Endpoint ───
app.get('/api/fim-events', async (req, res) => {
  const { index, start_date, end_date, limit, offset, search_after, search, severity, type } = req.query;
  const idx = index || 'wazuh-alerts-4.x-*';
  const sd = start_date || 'now-24h';
  const ed = end_date || 'now';
  const lim = Math.min(parseInt(limit) || 20, 10000);
  const off = Math.min(parseInt(offset) || 0, 9999);

  const filters = [];
  const timeRange = {};
  if (sd && sd !== 'now') timeRange.gte = sd;
  if (ed && ed !== 'now') timeRange.lte = ed;
  if (Object.keys(timeRange).length) filters.push({ "range": { "@timestamp": timeRange } });

  if (search) {
    const s = search.replace(/[^a-zA-Z0-9_.\- ]/g, '');
    const wc = '*' + s.toLowerCase() + '*';
    filters.push({ "bool": { "should": [
      { "wildcard": { "agent.name": { "value": wc, "case_insensitive": true } } },
      { "wildcard": { "rule.id": { "value": wc, "case_insensitive": true } } },
      { "wildcard": { "syscheck.path": { "value": wc, "case_insensitive": true } } },
      { "wildcard": { "rule.description": { "value": wc, "case_insensitive": true } } },
      { "wildcard": { "syscheck.event": { "value": wc, "case_insensitive": true } } }
    ] } });
  }

  if (severity) {
    const sevRanges = { 'Critical': { gte: 12 }, 'High': { gte: 7, lte: 11 }, 'Medium': { gte: 4, lte: 6 }, 'Low': { gte: 1, lte: 3 } };
    const range = sevRanges[severity];
    if (range) filters.push({ "range": { "rule.level": range } });
  }

  if (type) {
    const g = FIM_GROUPS.find(t => t === type)
    if (g) filters.push({ "term": { "rule.groups": g } });
  }

  if (filters.length === 0) {
    filters.push({ "bool": { "should": FIM_GROUPS.map(g => ({ "term": { "rule.groups": g } })) } });
  }

  const body = {
    size: lim,
    track_total_hits: true,
    query: { "bool": { "must": filters } },
    sort: [{ "@timestamp": { "order": "desc" } }, { "_id": { "order": "desc" } }]
  };

  let sa = null;
  if (search_after) { try { sa = JSON.parse(search_after); } catch {} }
  if (sa && Array.isArray(sa)) { body.search_after = sa; }
  else if (off > 0) { body.from = off; }

  try {
    if (!osApi) { return res.json({ results: [], total: 0 }); }
    const osRes = await osApi.post('', body, {
      params: { path: idx + '/_search', method: 'POST' }
    });
    const hits = osRes.data?.hits || {};
    const results = (hits.hits || []).map(h => ({ ...h._source, _id: h._id }));
    const lastSort = hits.hits?.length > 0 ? hits.hits[hits.hits.length - 1].sort : null;
    res.json({ results, total: hits.total?.value || 0, sort: lastSort });
  } catch (err) {
    console.error('FIM OS proxy search failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Asset Inventory Endpoint ───
const ASSET_CATEGORIES = {
  'U360-Engine': { category: 'Security Engines', type: 'SIEM Engine', color: '#7F77DD', icon: 'engine', role: 'Correlation & UEBA Engine' },
  'root': { category: 'Linux', type: 'Linux Server', color: '#1D9E75', icon: 'linux', role: 'Wazuh Manager / Master Node' },
  'COREGENIX': { category: 'Windows', type: 'Windows Server', color: '#378ADD', icon: 'windows', role: 'Application Server' },
  'My-SurfaceLaptop': { category: 'Windows', type: 'Windows Endpoint', color: '#378ADD', icon: 'windows', role: 'Workstation' },
  'Rayyan': { category: 'Linux', type: 'Linux Workstation', color: '#1D9E75', icon: 'linux', role: 'Developer Workstation' },
  'suyash-window': { category: 'Windows', type: 'Windows Server', color: '#378ADD', icon: 'windows', role: 'Windows Server' },
  'Rayyan-laptop': { category: 'Windows', type: 'Windows Endpoint', color: '#378ADD', icon: 'windows', role: 'Laptop / Endpoint' },
};

const DEFAULT_CATEGORY = { category: 'Other', type: 'Unknown Device', color: '#6b7280', icon: 'device', role: 'Unclassified' };

function classifyAgent(agentName) {
  return ASSET_CATEGORIES[agentName] || DEFAULT_CATEGORY;
}

function calcSeverity(levelBuckets) {
  let highest = 0;
  for (const b of (levelBuckets || [])) {
    const lvl = parseInt(b.key) || 0;
    if (lvl > highest) highest = lvl;
  }
  if (highest >= 12) return { sev: 'critical', sevLabel: 'Critical' };
  if (highest >= 7) return { sev: 'warn', sevLabel: 'Warning' };
  return { sev: 'ok', sevLabel: 'Healthy' };
}

app.get('/api/asset-inventory', async (req, res) => {
  const { start_date, end_date } = req.query;
  const idx = 'unishield360-alerts-4.x-*';
  const sd = start_date || 'now-7d';
  const ed = end_date || 'now';
  try {
    // 1. Get all agents with event counts
    const agentAgg = await api.get('/aggregate', {
      params: { index: idx, field: 'agent.name', type: 'terms', limit: 100, start_date: sd, end_date: ed }
    }).catch(() => ({ data: { buckets: [] } }));
    const agentBuckets = agentAgg.data?.buckets || [];

    // 2. Parallel per-agent data
    const agentPromises = agentBuckets.map(async (bucket) => {
      const agentName = bucket.key;
      const totalEvents = bucket.doc_count || 0;

      // Severity distribution
      const sevRes = await api.get('/aggregate', {
        params: { index: idx, field: 'rule.level', type: 'terms', limit: 20, q: `agent.name:"${agentName}"`, start_date: sd, end_date: ed }
      }).catch(() => ({ data: { buckets: [] } }));

      // Alert count (level >= 7)
      const alertCountRes = await api.get('/count', {
        params: { index: idx, q: `agent.name:"${agentName}" AND rule.level:[7 TO 15]`, start_date: sd, end_date: ed }
      }).catch(() => ({ data: { count: 0 } }));

      // Latest event for lastSeen + location
      const latestRes = await api.get('/search', {
        params: { index: idx, q: `agent.name:"${agentName}"`, limit: 1, sort: '@timestamp', order: 'desc', start_date: sd, end_date: ed }
      }).catch(() => ({ data: { results: [] } }));
      const latestEvent = latestRes.data?.results?.[0] || {};

      // Recent alerts (highest severity events)
      const alertsRes = await api.get('/search', {
        params: { index: idx, q: `agent.name:"${agentName}" AND (rule.level:12 OR rule.level:13 OR rule.level:14 OR rule.level:15)`, limit: 5, sort: '@timestamp', order: 'desc', start_date: sd, end_date: ed }
      }).catch(() => ({ data: { results: [] } }));

      const levelBuckets = sevRes.data?.buckets || [];
      const { sev, sevLabel } = calcSeverity(levelBuckets);
      const classification = classifyAgent(agentName);
      const alertCount = alertCountRes.data?.count || 0;

      const alerts = (alertsRes.data?.results || []).map(r => {
        const rl = r.rule || {};
        return {
          sev: (parseInt(rl.level) || 0) >= 12 ? 'c' : (parseInt(rl.level) || 0) >= 7 ? 'h' : 'm',
          label: (parseInt(rl.level) || 0) >= 12 ? 'Critical' : (parseInt(rl.level) || 0) >= 7 ? 'High' : 'Medium',
          msg: rl.description || 'No description',
          time: r['@timestamp'] ? new Date(r['@timestamp']).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--'
        };
      });

      const sevCounts = {};
      let sevCritical = 0, sevHigh = 0, sevMedium = 0, sevLow = 0;
      for (const b of levelBuckets) {
        const lvl = parseInt(b.key) || 0;
        const cnt = b.doc_count || 0;
        if (lvl >= 12) sevCritical += cnt;
        else if (lvl >= 7) sevHigh += cnt;
        else if (lvl >= 4) sevMedium += cnt;
        else sevLow += cnt;
      }

      return {
        name: agentName,
        type: classification.type,
        category: classification.category,
        categoryColor: classification.color,
        role: classification.role,
        sev,
        sevLabel,
        lastSeen: latestEvent['@timestamp'] || null,
        location: latestEvent.location || 'unknown',
        totalEvents,
        metrics: {
          alerts: alertCount,
          critical: sevCritical,
          high: sevHigh,
          medium: sevMedium,
          low: sevLow,
        },
        alerts,
        severityBuckets: levelBuckets.slice(0, 5),
      };
    });

    const devicesArray = await Promise.all(agentPromises);

    // 3. Build grouped categories
    const categoryMap = {};
    for (const d of devicesArray) {
      if (!categoryMap[d.category]) {
        categoryMap[d.category] = {
          name: d.category,
          color: d.categoryColor,
          devices: [],
        };
      }
      categoryMap[d.category].devices.push(d);
    }
    const categories = Object.values(categoryMap);

    // 4. Compute totals
    const totalAssets = devicesArray.length;
    const totalAlerts = devicesArray.reduce((s, d) => s + d.metrics.alerts, 0);
    const totalEvents = devicesArray.reduce((s, d) => s + d.totalEvents, 0);
    const criticalCount = devicesArray.filter(d => d.sev === 'critical').length;

    res.json({
      success: true,
      summary: {
        totalAssets,
        totalAlerts,
        totalEvents,
        criticalCount,
      },
      categories,
      devices: devicesArray,
    });
  } catch (err) {
    console.error('Asset inventory error:', err.message);
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

// Send test webhook
app.post('/api/notifications/test', auth.authMiddleware, auth.roleMiddleware('admin'), async (req, res) => {
  const result = await notifier.sendWebhook(req.body, { type: 'test', message: 'Test notification from dashboard' })
  res.json(result)
})

// ─── Settings (auth-protected) ───
app.get('/api/settings', auth.authMiddleware, (req, res) => {
  res.json({
    pollInterval: parseInt(process.env.UNISHIELD360_POLL_INTERVAL || '15000'),
    jwtExpiry: process.env.JWT_EXPIRY || '24h',
    user: req.user
  })
})

// ─── Grafana OpenSearch Proxy ───
app.all('/grafana-proxy/*', async (req, res) => {
  const tPath = req.path.replace('/grafana-proxy/', '') || '/';
  try {
    // Handle root endpoint — return cluster info
    if (tPath === '/' || tPath === '') {
      return res.json({ cluster_name: 'wazuh-cluster', status: 'yellow', version: { number: '2.19.0', distribution: 'opensearch' } });
    }
    // Handle cluster health
    if (tPath === '_cluster/health') {
      const h = await api.get('/health', { timeout: 10000 });
      return res.json({ cluster_name: 'wazuh-cluster', status: h.data.cluster_status || 'yellow', number_of_nodes: h.data.nodes || 1, number_of_data_nodes: h.data.nodes || 1, active_shards_percent_as_number: 93.8, timed_out: false });
    }
    // Handle _mapping requests — return fields from Wazuh API
    if (tPath.includes('_mapping')) {
      const parts = tPath.split('/');
      const hasIndex = parts[0] && parts[0] !== '_mapping' && !parts[0].startsWith('_');
      const idx = hasIndex ? parts[0] : 'wazuh-alerts-4.x-2026.06.22';
      const fields = await api.get('/fields', { params: { index: idx }, timeout: 30000 });
      const props = {};
      (fields.data?.fields || []).forEach(f => { props[f.name] = { type: f.type }; });
      const escapedIdx = idx.replace(/\./g, '\\.');
      if (tPath.includes('field/')) {
        const fieldName = parts[parts.length - 1];
        const result = {};
        if (fieldName === '*') {
          result[escapedIdx] = { mappings: { properties: props } };
        } else {
          const fProps = {};
          Object.entries(props).filter(([k]) => k === fieldName || k.startsWith(fieldName + '.')).forEach(([k, v]) => { fProps[k] = v; });
          result[escapedIdx] = { mappings: { properties: fProps } };
        }
        return res.json(result);
      }
      return res.json({ [escapedIdx]: { mappings: { properties: props } } });
    }
    // Handle _field_caps — return field capabilities from Wazuh API
    if (tPath.includes('_field_caps')) {
      const parts = tPath.split('/');
      const idx = (parts[0] && parts[0] !== '_field_caps' && !parts[0].startsWith('_')) ? parts[0] : 'wazuh-alerts-4.x-2026.06.22';
      const fields = await api.get('/fields', { params: { index: idx }, timeout: 30000 });
      const fcaps = {};
      (fields.data?.fields || []).forEach(f => {
        const type = f.type || 'keyword';
        fcaps[f.name] = { [type]: { type, searchable: true, aggregatable: true, metadata_field: false } };
      });
      return res.json({ indices: [idx], fields: fcaps });
    }
    // Handle _msearch — convert NDJSON to individual _search calls
    if (tPath.includes('_msearch')) {
      if (!osApi) return res.json({ responses: [{ status: 200, hits: { total: { value: 0 } }, aggregations: {} }] });
      const raw = (typeof req.body === 'string') ? req.body : '';
      const lines = raw.trim().split('\n').filter(Boolean);
      const responses = [];
      for (let i = 0; i < lines.length; i += 2) {
        const bodyLine = lines[i + 1];
        if (!bodyLine) { responses.push({ status: 200, hits: { total: { value: 0 } }, aggregations: {}, timed_out: false, _shards: { total: 0, successful: 0, failed: 0 } }); continue; }
        let body = {};
        try { body = JSON.parse(bodyLine); } catch (e) { responses.push({ status: 200, error: { reason: 'Invalid JSON: ' + e.message } }); continue; }
        try { const osRes = await osApi.post('', body, { params: { path: 'wazuh-alerts-4.x-2026.06.22/_search', method: 'POST' }, timeout: 60000 }); responses.push(osRes.data); }
        catch (e) { responses.push({ status: 200, hits: { total: { value: 0 } }, aggregations: {} }); }
      }
      return res.json({ responses });
    }
    // Handle _search — forward to Dashboards proxy
    if (tPath.includes('_search')) {
      if (!osApi) throw new Error('No OpenSearch proxy available');
      const parts = tPath.split('/');
      const idx = (parts[0] && parts[0] !== '_search' && !parts[0].startsWith('_')) ? parts[0] : null;
      const searchPath = idx ? `${idx}/_search` : '_search';
      const body = (req.method === 'POST' || req.method === 'PUT') ? (req.body || {}) : {};
      const osRes = await osApi.post('', body, { params: { path: searchPath, method: req.method }, timeout: 60000 });
      return res.json(osRes.data);
    }
    // Fallback: forward to Dashboards proxy
    if (!osApi) throw new Error('No OpenSearch proxy available');
    const params = { path: tPath, method: req.method };
    const body = (req.method === 'POST' || req.method === 'PUT') ? req.body : {};
    const osRes = await osApi.post('', body, { params, timeout: 60000 });
    res.json(osRes.data);
  } catch (err) {
    const status = err.response?.status || 502;
    console.error('Grafana proxy error:', req.method, tPath, status, err.message);
    res.status(status).json({ error: err.message });
  }
});

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

function startServer(port) {
  const server = app.listen(port)
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`✖ Port ${port} is already in use. Trying port ${parseInt(port, 10) + 1}...`);
        startServer(parseInt(port, 10) + 1);
      } else {
        console.error('✖ Server error:', err.message);
      }
    })
    .on('listening', () => {
      const addr = server.address();
      console.log(`✔ UniShield360 Dashboard at http://localhost:${addr.port}`);
      console.log(`✔ Proxy → ${API}`);

      const rt = new RealtimeEngine(server, api, db, re, de);
      const pollInterval = parseInt(process.env.UNISHIELD360_POLL_INTERVAL || '15000');
      rt.startPolling(pollInterval);
      console.log(`✔ Realtime engine polling every ${pollInterval}ms`);

      // Realtime stats endpoint
      app.get('/api/realtime/stats', (req, res) => res.json(rt.getStats()));

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
