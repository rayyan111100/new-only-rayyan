import axios from 'axios'

const client = axios.create({ baseURL: '/api', timeout: 120000 })

// Attach JWT token automatically
client.interceptors.request.use(config => {
  const token = localStorage.getItem('dashboard_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export async function api(endpoint, params, extra = {}) {
  const { data } = await client.get('/' + endpoint, { params, ...extra })
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
  return data
}

export async function apiPost(endpoint, body) {
  const { data } = await client.post('/' + endpoint, body)
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
  return data
}

export async function apiPut(endpoint, body) {
  const { data } = await client.put('/' + endpoint, body)
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
  return data
}

export async function apiDelete(endpoint) {
  const { data } = await client.delete('/' + endpoint)
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
  return data
}
