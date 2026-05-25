import axios from 'axios'

const client = axios.create({ baseURL: '/api', timeout: 30000 })

export async function api(endpoint, params) {
  const { data } = await client.get('/' + endpoint, { params })
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
  return data
}

export async function apiPost(endpoint, body) {
  const { data } = await client.post('/' + endpoint, body)
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
  return data
}
