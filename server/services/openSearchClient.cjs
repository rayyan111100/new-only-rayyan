const axios = require('axios')

const client = axios.create({
  baseURL: process.env.UNISHIELD360_API_URL || 'http://192.168.1.77:9999',
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
})

let token = null
let tokenExpiry = 0

async function authenticate() {
  const user = process.env.UNISHIELD360_USER
  const pass = process.env.UNISHIELD360_PASSWORD
  if (!user || !pass) return
  try {
    const creds = Buffer.from(`${user}:${pass}`).toString('base64')
    const { data } = await axios.post(`${client.defaults.baseURL}/security/user/authenticate`, null, {
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' },
      timeout: 10000,
    })
    token = data.data?.token || data.token
    tokenExpiry = Date.now() + 300000
  } catch {}
}

client.interceptors.request.use(async config => {
  if (!token || Date.now() > tokenExpiry) await authenticate()
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (config.params?.index) {
    config.params.index = String(config.params.index).replace(/^unishield360-/i, 'wazuh-')
  }
  return config
})

client.interceptors.response.use(res => {
  if (res.data && typeof res.data === 'object') {
    transformIndexNames(res.data)
  }
  return res
})

const INDEX_FIELDS = new Set(['_index', 'index', 'index_name'])
function transformIndexNames(obj) {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) { obj.forEach(transformIndexNames); return }
  for (const key of Object.keys(obj)) {
    if (INDEX_FIELDS.has(key) && typeof obj[key] === 'string') {
      obj[key] = obj[key].replace(/wazuh/gi, 'unishield360')
    } else if (typeof obj[key] === 'object') {
      transformIndexNames(obj[key])
    }
  }
}

module.exports = {
  async query(method, endpoint, data = {}) {
    let response
    switch (method.toUpperCase()) {
      case 'GET':
        response = await client.get(`/${endpoint}`, { params: data })
        break
      case 'POST':
        response = await client.post(`/${endpoint}`, data)
        break
      case 'PUT':
        response = await client.put(`/${endpoint}`, data)
        break
      case 'DELETE':
        response = await client.delete(`/${endpoint}`)
        break
      default:
        response = await client.get(`/${endpoint}`, { params: data })
    }
    return response.data
  },

  async search(endpoint, params) {
    const { data } = await client.get(`/${endpoint}`, { params })
    return data
  },

  async count(params) {
    const { data } = await client.get('/count', { params })
    return data.count || data.data?.count || 0
  },

  async aggregate(params) {
    const { data } = await client.get('/aggregate', { params })
    return data.buckets || data.data?.buckets || []
  },

  mapIndex(idx) {
    if (!idx) return idx
    return String(idx).replace(/^unishield360-/i, 'wazuh-')
  },

  unmapIndex(idx) {
    if (!idx) return idx
    return String(idx).replace(/^wazuh-/i, 'unishield360-')
  },
}
