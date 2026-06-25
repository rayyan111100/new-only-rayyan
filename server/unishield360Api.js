const axios = require('axios');

const API_URL = process.env.UNISHIELD360_API_URL;

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
});

async function scanAlerts(params = {}) {
  const res = await api.get('/scan', { params });
  return res.data;
}

module.exports = { scanAlerts };
