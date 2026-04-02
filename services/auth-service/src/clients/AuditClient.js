import { HttpClient } from './HttpClient.js'

const isStubMode = () => process.env.NODE_ENV === 'test'

export class AuditClient {
  constructor () {
    this.http = new HttpClient(
      process.env.AUDIT_SERVICE_URL ?? 'http://audit-service:3009',
      { timeout: 2000 }
    )
  }

  log (action, sapCode, data = {}) {
    if (isStubMode()) {
      console.log(`[stub] AuditClient.log(${action}, ${sapCode})`)
      return
    }
    // Best effort — fire and forget, never throw
    this.http.post('/audit', { action, sapCode, data })
      .catch(() => {})
  }
}
