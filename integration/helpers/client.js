// Shared HTTP client for integration tests.
// Tests call services directly on their ports (bypassing nginx) to avoid
// rate-limiting interference. Each test file logs in once via before() and
// reuses the token throughout.

export const PORTS = {
  auth:           3001,
  catalog:        3002,
  profile:        3003,
  promotions:     3004,
  cart:           3005,
  orders:         3006,
  notifications:  3007,
  invoices:       3008,
  audit:          3009,
  sap:            3010,
  returns:        3011,
  content:        3012,
  intelligence:   3013,
  commercial:     3014,
  notifPrefs:     3015,
  sustainability: 3016,
}

const HOST = process.env.INTEGRATION_HOST ?? 'localhost'

function base (port) {
  return `http://${HOST}:${port}`
}

/**
 * Login via auth-service and return the JWT.
 */
export async function login (sapCode = 'SDA-00423', password = 'demo1234') {
  const res = await fetch(`${base(PORTS.auth)}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sapCode, password })
  })
  const data = await res.json()
  if (!data.token) throw new Error(`Login failed for ${sapCode}: ${JSON.stringify(data)}`)
  return data.token
}

/**
 * Make an HTTP request to a service.
 * @param {number} port - Service port from PORTS
 * @param {string} method - HTTP method
 * @param {string} path - Path (e.g. '/catalog/families')
 * @param {object} opts - { token, body }
 * @returns {{ status: number, body: any }}
 */
export async function request (port, method, path, { token, body } = {}) {
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${base(port)}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  let responseBody
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    responseBody = await res.json()
  } else {
    responseBody = await res.text()
  }

  return { status: res.status, body: responseBody }
}

export const get  = (port, path, opts) => request(port, 'GET',   path, opts)
export const post = (port, path, opts) => request(port, 'POST',  path, opts)
export const patch = (port, path, opts) => request(port, 'PATCH', path, opts)
export const del  = (port, path, opts) => request(port, 'DELETE', path, opts)
