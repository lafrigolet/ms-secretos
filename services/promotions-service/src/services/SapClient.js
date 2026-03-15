export class SapClient {
  constructor () {
    this.baseUrl = process.env.SAP_INTEGRATION_URL ?? 'http://sap-integration-service:3010'
  }
  async get (path) {
    const res = await fetch(`${this.baseUrl}${path}`, { signal: AbortSignal.timeout(5000) })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`SAP Integration error ${res.status}`)
    return res.json()
  }
  async post (path, body) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) throw new Error(`SAP Integration error ${res.status}`)
    return res.json()
  }
}
