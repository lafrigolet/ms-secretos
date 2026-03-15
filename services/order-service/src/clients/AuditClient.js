import { HttpClient } from './HttpClient.js'

/**
 * AuditClient — order-service
 * Registra eventos de auditoría en el audit-service.
 * Fire-and-forget: nunca bloquea el flujo principal.
 */
export class AuditClient {
  constructor () {
    this.http = new HttpClient(
      process.env.AUDIT_SERVICE_URL ?? 'http://audit-service:3009',
      { timeout: 2000 }
    )
  }

  log (action, sapCode, data = {}) {
    this.http.post('/audit', { action, sapCode, data })
      .catch(() => {}) // intencional — la auditoría nunca debe romper el flujo
  }
}
