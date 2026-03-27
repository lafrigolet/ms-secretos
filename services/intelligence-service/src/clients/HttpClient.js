const isDev = process.env.NODE_ENV !== 'production'

export class HttpClient {
  constructor (baseUrl, options = {}) {
    this.baseUrl = baseUrl
    this.timeout = options.timeout ?? 5000
    this.defaultHeaders = { 'Content-Type': 'application/json', ...options.headers }
  }
  async request (method, path, { body, token } = {}) {
    const headers = { ...this.defaultHeaders }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${this.baseUrl}${path}`, {
      method, headers,
      signal: AbortSignal.timeout(this.timeout),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
    return res.json()
  }
  get  (path, opts)       { return this.request('GET',  path, opts) }
  post (path, body, opts) { return this.request('POST', path, { body, ...opts }) }
}
