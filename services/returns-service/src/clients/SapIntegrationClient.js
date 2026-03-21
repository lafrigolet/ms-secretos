import { HttpClient } from './HttpClient.js'

/**
 * SapIntegrationClient — returns-service
 * HU-35: genera el abono/nota de crédito en SAP cuando una devolución es aprobada.
 */
export class SapIntegrationClient {
  constructor () {
    this.http = new HttpClient(
      process.env.SAP_INTEGRATION_URL ?? 'http://sap-integration-service:3010',
      { timeout: 8000 }
    )
  }

  /**
   * HU-35 — Crea una nota de crédito en SAP para una devolución aprobada.
   * En modo stub devuelve un ID ficticio.
   */
  async createCreditNote ({ returnId, orderId, sapCode, items }) {
    if (process.env.NODE_ENV !== 'production') {
      // STUB: simula la creación en SAP
      return {
        creditNoteId: `CN-${new Date().getFullYear()}-${returnId.split('-').pop()}`,
        returnId,
        orderId,
        sapCode,
        status: 'CREATED',
        createdAt: new Date().toISOString()
      }
    }

    return this.http.post('/internal/returns/credit-note', {
      returnId, orderId, sapCode, items
    })
  }

  /**
   * Obtiene un pedido para validar que pertenece al cliente antes de crear la devolución.
   */
  async getOrder (orderId) {
    return this.http.get(`/internal/orders/order/${orderId}`)
  }
}
