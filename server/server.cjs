require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const API = process.env.WAZUH_API_URL;

app.use(cors());
app.use(express.json());

// Serve built React app (dist/) in production, fallback to public/
const distPath = path.join(__dirname, '..', 'dist');
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(distPath));
app.use(express.static(publicPath));

const api = axios.create({ baseURL: API, timeout: 30000 });

async function proxy(endpoint, params, res) {
  try {
    const { data } = await api.get(endpoint, { params });
    res.json(data);
  } catch (err) {
    const msg = err.response?.data || err.message;
    res.status(500).json({ error: msg });
  }
}

const ENDPOINTS = ['health', 'indices', 'index-stats', 'fields', 'search', 'count', 'scan', 'aggregate', 'geo'];
for (const ep of ENDPOINTS) {
  app.get(`/api/${ep}`, (req, res) => proxy(`/${ep}`, req.query, res));
}

app.post('/api/scan', (req, res) => proxy('/scan', req.body, res));
app.post('/api/search', (req, res) => proxy('/search', req.body, res));

// SPA fallback: serve index.html for any non-API route
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  const publicIndex = path.join(publicPath, 'index.html');
  if (require('fs').existsSync(indexPath)) return res.sendFile(indexPath);
  if (require('fs').existsSync(publicIndex)) return res.sendFile(publicIndex);
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`✔ Wazuh Dashboard at http://localhost:${PORT}`);
  console.log(`✔ Proxy → ${API}`);
});
