/**
 * HttpClient
 * Cliente HTTP base usado por todos los API clients.
 * Gestiona timeout, errores de red y respuestas no-OK de forma centralizada.
 */
const isDev = process.env.NODE_ENV !== 'production'

export class HttpClient {
  constructor (baseUrl, options = {}) {
    this.baseUrl = baseUrl
    this.timeout = options.timeout ?? 5000
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers
    }
  }

  async request (method, path, { body, headers = {}, token } = {}) {
    const url = `${this.baseUrl}${path}`
    const reqHeaders = { ...this.defaultHeaders, ...headers }

    if (token) reqHeaders['Authorization'] = `Bearer ${token}`

    const options = {
      method,
      headers: reqHeaders,
      signal: AbortSignal.timeout(this.timeout)
    }

    if (body !== undefined) options.body = JSON.stringify(body)

    if (isDev) console.log(`[http] → ${method} ${url}`)
    const res = await fetch(url, options)
    if (isDev) console.log(`[http] ← ${method} ${url} ${res.status}`)

    if (res.status === 404) return null
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let body = null
      try { body = JSON.parse(text) } catch { /* body no es JSON */ }
      const err = new Error(body?.message ?? `${method} ${url} → ${res.status}: ${text}`)
      err.status = res.status
      if (body?.error)      err.code        = body.error
      if (body?.productCode !== undefined) err.productCode = body.productCode
      if (body?.requested  !== undefined)  err.requested   = body.requested
      if (body?.available  !== undefined)  err.available   = body.available
      throw err
    }

    return res.json()
  }

  get  (path, opts)        { return this.request('GET',    path, opts) }
  post (path, body, opts)  { return this.request('POST',   path, { body, ...opts }) }
  patch(path, body, opts)  { return this.request('PATCH',  path, { body, ...opts }) }
  del  (path, opts)        { return this.request('DELETE', path, opts) }
}
