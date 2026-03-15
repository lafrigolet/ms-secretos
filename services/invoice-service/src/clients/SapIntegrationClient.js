import { HttpClient } from './HttpClient.js'

/**
 * SapIntegrationClient — invoice-service
 * Obtiene pedidos y facturas desde el SAP Integration Service.
 */
export class SapIntegrationClient {
  constructor () {
    this.http = new HttpClient(
      process.env.SAP_INTEGRATION_URL ?? 'http://sap-integration-service:3010',
      { timeout: 5000 }
    )
  }

  getOrders (sapCode)      { return this.http.get(`/internal/orders/${sapCode}`) }
  getInvoice (invoiceId)   { return this.http.get(`/internal/orders/invoice/${invoiceId}`) }
}
