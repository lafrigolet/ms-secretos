/**
 * API Client base
 * Todas las llamadas al backend pasan por aquí.
 * Gestiona el JWT, los errores HTTP y el timeout.
 */

const BASE_URL = '/api'
const TIMEOUT  = 8000

function getToken () {
  return localStorage.getItem('sda_token')
}

async function request (method, path, { body, auth = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    signal: AbortSignal.timeout(TIMEOUT),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  })

  // 401 → sesión expirada, limpiar y redirigir
  if (res.status === 401) {
    localStorage.removeItem('sda_token')
    localStorage.removeItem('sda_user')
    window.location.href = '/login'
    throw new Error('SESSION_EXPIRED')
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data.message ?? `Error ${res.status}`)
    err.status  = res.status
    err.code    = data.error
    err.details = data
    throw err
  }

  return data
}

export const api = {
  get:    (path, opts)        => request('GET',    path, opts),
  post:   (path, body, opts)  => request('POST',   path, { body, ...opts }),
  patch:  (path, body, opts)  => request('PATCH',  path, { body, ...opts }),
  delete: (path, opts)        => request('DELETE', path, opts),
}
