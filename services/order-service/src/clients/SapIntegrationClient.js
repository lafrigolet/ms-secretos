import { HttpClient } from './HttpClient.js'

/**
 * SapIntegrationClient — order-service
 * Gestiona pedidos y facturas a través del SAP Integration Service.
 */
export class SapIntegrationClient {
  constructor () {
    this.http = new HttpClient(
      process.env.SAP_INTEGRATION_URL ?? 'http://sap-integration-service:3010',
      { timeout: 5000 }
    )
  }

  getOrders (sapCode)      { return this.http.get(`/internal/orders/${sapCode}`) }
  getOrder (orderId)       { return this.http.get(`/internal/orders/order/${orderId}`) }
  createOrder (sapCode, items) { return this.http.post('/internal/orders', { sapCode, items }) }
}
