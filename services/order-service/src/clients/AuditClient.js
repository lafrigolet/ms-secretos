import { HttpClient } from './HttpClient.js'

const STUB_MODE = process.env.NODE_ENV !== 'production'
const isDev = STUB_MODE

export class AuditClient {
  constructor () {
    this.http = new HttpClient(
      process.env.AUDIT_SERVICE_URL ?? 'http://audit-service:3009',
      { timeout: 2000 }
    )
  }

  log (action, sapCode, data = {}) {
    if (STUB_MODE) {
      if (isDev) console.log(`[stub] AuditClient.log(${action}, ${sapCode})`)
      return
    }
    this.http.post('/audit', { action, sapCode, data })
      .catch(() => {})
  }
}
