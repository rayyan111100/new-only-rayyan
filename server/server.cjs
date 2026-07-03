require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
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

async function authenticate() {
  if (!WUSER || !WPASS) {
    console.warn('⚠ UNISHIELD360_USER or UNISHIELD360_PASSWORD not set — using no auth');
    return;
  }
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
    console.error('✖ Auth failed:', err.response?.data?.message || err.message);
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

// In-memory cache for compliance endpoint
const complianceCache = new Map();
const COMPLIANCE_CACHE_TTL = 25000;

const FRAMEWORK_FIELDS = {
  'PCI-DSS': 'rule.pci_dss',
  'HIPAA': 'rule.hipaa',
  'GDPR': 'rule.gdpr',
  'TSC (SOC 2)': 'rule.tsc',
  'MITRE ATT&CK': 'rule.mitre',
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

const SEV_LEVELS = { Critical: { gte: 12 }, High: { gte: 7, lte: 11 }, Medium: { gte: 4, lte: 6 }, Low: { gte: 1, lte: 3 } };

// Compliance Dashboard Aggregation Endpoint
app.get('/api/compliance', async (req, res) => {
  const { index, start_date, end_date, framework, severity } = req.query;
  const idx = index || 'unishield360-alerts-4.x-*';
  const sd = start_date || 'now-24h';
  const ed = end_date || 'now';
  const cacheKey = `compliance:${framework || '__all__'}:${sd}:${ed}`;

  const skipCache = req.query._t;
  const cached = complianceCache.get(cacheKey);
  if (!skipCache && cached && Date.now() - cached.ts < COMPLIANCE_CACHE_TTL) {
    return res.json(cached.data);
  }

  const fwField = framework ? FRAMEWORK_FIELDS[framework] : null;
  const fwQ = fwField ? '_exists_:' + fwField : null;
  // Wazuh OR query limit ~4 fields; split into batches of 3
  const overviewQ = !fwField ? (() => {
    const fields = FRAMEWORK_NAMES.map(f => '_exists_:' + FRAMEWORK_FIELDS[f]);
    const batches = [];
    for (let i = 0; i < fields.length; i += 3) batches.push(fields.slice(i, i + 3).join(' OR '));
    return batches;
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
          Promise.all(overviewQ.map(q => api.get('/search', { params: { index: idx, q, limit: 200, sort: '@timestamp', order: 'desc', start_date: sd, end_date: ed } }).catch(() => ({ data: { results: [], total: 0 } })))).then(responses => {
            const seen = new Set();
            const merged = [];
            for (const r of responses) {
              for (const doc of (r.data.results || [])) {
                const id = doc._id || doc['@timestamp'] + (doc.agent?.name || '');
                if (!seen.has(id)) { seen.add(id); merged.push(doc); }
              }
            }
            merged.sort((a, b) => (b['@timestamp'] || '').localeCompare(a['@timestamp'] || ''));
            return { data: { results: merged.slice(0, 500), total: { value: merged.length } } };
          }),
          Promise.all(overviewQ.map(q => aggOne(q, frameworkField || 'rule.gdpr'))).then(mergeBuckets).then(buckets => ({ data: { buckets } })),
        ])
      : await Promise.all([
          aggOne(fwQ, 'rule.level'),
          aggOne(fwQ, 'rule.id'),
          aggOne(fwQ, 'agent.name', 10),
          api.get('/aggregate', { params: { index: idx, q: fwQ, field: '@timestamp', type: 'date_histogram', interval: '1h', start_date: sd, end_date: ed, limit: 48 } }).catch(() => ({ data: { buckets: [] } })),
          aggOne(fwQ, 'rule.category'),
          api.get('/search', { params: { index: idx, q: fwQ, limit: 500, sort: '@timestamp', order: 'desc', start_date: sd, end_date: ed } }).catch(() => ({ data: { results: [], total: 0 } })),
          frameworkField ? aggOne(fwQ, frameworkField) : Promise.resolve({ data: { buckets: [] } }),
        ]);

    let count24v = 0, count7dv = 0;
    if (!fwField) {
      const c24results = await Promise.all(FRAMEWORK_NAMES.map(fw => api.get('/count', { params: { index: idx, q: '_exists_:' + FRAMEWORK_FIELDS[fw], start_date: sd, end_date: ed } }).catch(() => ({ data: { count: 0 } }))));
      for (const r of c24results) count24v += r.data?.count || 0;
      const c7dresults = await Promise.all(FRAMEWORK_NAMES.map(fw => api.get('/count', { params: { index: idx, q: '_exists_:' + FRAMEWORK_FIELDS[fw], start_date: 'now-7d', end_date: 'now' } }).catch(() => ({ data: { count: 0 } }))));
      for (const r of c7dresults) count7dv += r.data?.count || 0;
    } else {
      count24v = (await api.get('/count', { params: { index: idx, q: fwQ, start_date: sd, end_date: ed } }).catch(() => ({ data: { count: 0 } }))).data?.count || 0;
      count7dv = (await api.get('/count', { params: { index: idx, q: fwQ, start_date: 'now-7d', end_date: 'now' } }).catch(() => ({ data: { count: 0 } }))).data?.count || 0;
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
        const q = '_exists_:' + FRAMEWORK_FIELDS[fw];
        return api.get('/count', { params: { index: idx, q, start_date: sd, end_date: ed } }).catch(() => ({ data: { count: 0 } }));
      })
    ) : [];

    const rawRecent = recent.data?.results || [];
    const recentDocs = rawRecent.map(doc => ({
      ...doc,
      _frameworks: classifyDocFrameworks(doc)
    }));
    const filteredRecent = framework ? recentDocs.filter(d => d._frameworks.includes(framework)) : recentDocs;

    const recentTotalVal = recent.data?.total;
    const recentActualTotal = recentTotalVal != null ? (typeof recentTotalVal === 'object' ? (recentTotalVal.value || 0) : recentTotalVal) : rawRecent.length;

    // Apply severity filter server-side (Wazuh API doesn't support _exists_ + range in q string)
    let finalSeverity = severityMap;
    let finalCount24 = count24v;
    let finalCount7d = count7dv;
    let finalRecent = filteredRecent;
    let finalRecentTotal = recentActualTotal;
    if (severity) {
      const sevKeys = severity.split(',').filter(s => SEV_LEVELS[s]);
      if (sevKeys.length) {
        const kept = {};
        for (const s of sevKeys) kept[s] = true;
        finalSeverity = {};
        for (const [s, c] of Object.entries(severityMap)) {
          finalSeverity[s] = kept[s] ? c : 0;
        }
        finalCount24 = Object.values(finalSeverity).reduce((a, b) => a + b, 0);
        finalCount7d = finalCount24;
        // Filter recent events by severity level
        const levelSets = sevKeys.map(s => SEV_LEVELS[s]);
        finalRecent = filteredRecent.filter(doc => {
          const lvl = parseInt(doc.rule?.level) || 0;
          return levelSets.some(({ gte, lte }) => lvl >= gte && (lte === undefined || lvl <= lte));
        });
        finalRecentTotal = finalRecent.length;
      }
    }

    const body = {
      count24: finalCount24,
      count7d: finalCount7d,
      severity: finalSeverity,
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
      recent: finalRecent,
      recentTotal: finalRecentTotal
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

// ─── MITRE ATT&CK Knowledge Base (fetched from MITRE CTI) ───
const MITRE_TACTIC_ORDER = ['reconnaissance', 'resource-development', 'initial-access', 'execution', 'persistence', 'privilege-escalation', 'defense-evasion', 'credential-access', 'discovery', 'lateral-movement', 'collection', 'command-and-control', 'exfiltration', 'impact']
const MITRE_TACTIC_NAMES = ['Reconnaissance', 'Resource Development', 'Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Defense Evasion', 'Credential Access', 'Discovery', 'Lateral Movement', 'Collection', 'Command and Control', 'Exfiltration', 'Impact']

let mitreCache = null
let mitreCacheTime = 0

app.get('/api/mitre-data', async (req, res) => {
  try {
    if (mitreCache && Date.now() - mitreCacheTime < 3600000) return res.json(mitreCache)

    console.log('⬇ Fetching MITRE ATT&CK data from CTI repository...')
    const { data: stix } = await axios.get('https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json', { timeout: 120000 })
    const objects = stix.objects || []

    const groups = objects.filter(o => o.type === 'intrusion-set').map(o => ({
      id: o.external_references?.find(r => r.source_name === 'mitre-attack')?.external_id || '',
      name: o.name,
      type: 'Threat Actor',
      country: o.x_mitre_aliases?.[0] || '',
      countryName: o.aliases?.[0] || (o.description?.match(/[A-Z][a-z]+/)?.[0] || 'Unknown'),
      firstSeen: o.first_seen?.split('T')[0] || o.created?.split('T')[0] || '',
      lastSeen: o.last_seen?.split('T')[0] || o.modified?.split('T')[0] || '',
      status: 'Active',
      aliases: o.aliases || [],
      campaigns: o.external_references?.length || 0,
      techniques: (o.kill_chain_phases || []).length || o.external_references?.length || 0,
      software: [],
      sectors: o.x_mitre_target_sectors || [],
      confidence: 75,
      actorType: o.x_mitre_resource_level || 'Unknown',
      motivation: (o.x_mitre_primary_motivations || [o.x_mitre_motivation])?.[0] || 'Unknown',
      desc: o.description?.substring(0, 500) || '',
      citation: o.external_references?.[0]?.source_name || '',
      notes: ''
    }))

    const software = objects.filter(o => o.type === 'malware' || o.type === 'tool').map(o => ({
      id: o.external_references?.find(r => r.source_name === 'mitre-attack')?.external_id || '',
      name: o.name,
      type: o.type === 'malware' ? 'Malware' : 'Tool',
      platforms: o.x_mitre_platforms || [],
      techniquesUsed: (o.kill_chain_phases || []).length || 0,
      groupsUsing: [],
      desc: o.description?.substring(0, 300) || ''
    }))

    const mitigations = objects.filter(o => o.type === 'course-of-action').map(o => ({
      id: o.external_references?.find(r => r.source_name === 'mitre-attack')?.external_id || '',
      name: o.name,
      desc: o.description?.substring(0, 300) || '',
      techniquesAddressed: (o.kill_chain_phases || []).length || 0,
      domain: 'Enterprise'
    }))

    const shortToName = {}
    MITRE_TACTIC_ORDER.forEach((s, i) => { shortToName[s] = MITRE_TACTIC_NAMES[i] })

    const tacticsLookup = {}
    objects.filter(o => o.type === 'x-mitre-tactic').forEach(o => {
      const short = o.x_mitre_shortname
      const name = shortToName[short] || o.name
      tacticsLookup[short] = {
        id: o.external_references?.find(r => r.source_name === 'mitre-attack')?.external_id || '',
        name,
        shortDesc: o.description?.split('.')[0] || '',
        techniqueCount: 0,
        order: MITRE_TACTIC_ORDER.indexOf(short) + 1 || 99
      }
    })

    objects.filter(o => o.type === 'attack-pattern').forEach(o => {
      const phases = o.kill_chain_phases || []
      phases.forEach(p => {
        if (tacticsLookup[p.phase_name]) tacticsLookup[p.phase_name].techniqueCount++
      })
    })

    const tactics = Object.values(tacticsLookup).sort((a, b) => a.order - b.order)

    const techniques = objects.filter(o => o.type === 'attack-pattern').map(o => ({
      id: o.external_references?.find(r => r.source_name === 'mitre-attack')?.external_id || '',
      name: o.name,
      tactic: shortToName[o.kill_chain_phases?.[0]?.phase_name] || o.kill_chain_phases?.[0]?.phase_name || '',
      platforms: o.x_mitre_platforms || [],
      subCount: o.x_mitre_is_subtechnique ? 0 : (o.x_mitre_techniques?.length || 0),
      desc: o.description?.substring(0, 300) || ''
    }))

    const result = { groups, software, mitigations, tactics, techniques }
    mitreCache = result
    mitreCacheTime = Date.now()
    console.log(`✔ MITRE data loaded: ${groups.length} groups, ${software.length} software, ${mitigations.length} mitigations, ${tactics.length} tactics, ${techniques.length} techniques`)
    res.json(result)
  } catch (err) {
    console.error('✖ MITRE data fetch error:', err.message)
    if (mitreCache) return res.json(mitreCache)
    res.status(502).json({ error: 'Failed to fetch MITRE data: ' + err.message })
  }
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
