import { HttpClient } from './HttpClient.js'

const STUB_MODE = process.env.NODE_ENV !== 'production'

export class AuditClient {
  constructor () {
    this.http = new HttpClient(
      process.env.AUDIT_SERVICE_URL ?? 'http://audit-service:3009',
      { timeout: 2000 }
    )
  }

  log (action, sapCode, data = {}) {
    if (STUB_MODE) return  // en tests no auditamos
    this.http.post('/audit', { action, sapCode, data })
      .catch(() => {})
  }
}
