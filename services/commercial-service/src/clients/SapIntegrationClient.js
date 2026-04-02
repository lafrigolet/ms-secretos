import { HttpClient } from './HttpClient.js'

const isStubMode = () => process.env.NODE_ENV !== 'production'

const STUB_ORDERS = {
  'SDA-00423': [
    { orderId: 'SDA-2025-0890', date: '2025-03-08', status: 'SHIPPED',   total: 96.00 },
    { orderId: 'SDA-2025-0812', date: '2025-02-21', status: 'DELIVERED', total: 289.00 },
  ],
  'SDA-00521': [
    { orderId: 'SDA-2025-0901', date: '2025-03-12', status: 'CONFIRMED', total: 512.00 },
  ],
  'SDA-00387': [
    { orderId: 'SDA-2025-0788', date: '2025-02-10', status: 'DELIVERED', total: 104.00 },
  ],
  'SDA-00187': [],
  'SDA-00098': [],
}

const STUB_CUSTOMERS = {
  'SDA-00423': { name: 'Rosa Canals',    businessName: 'Salón Canals Barcelona',  status: 'ACTIVE',  profile: 'PREMIUM',  lastOrderAt: '2025-03-08' },
  'SDA-00521': { name: 'Lidia Puig',     businessName: 'Puig Estilistes Girona',  status: 'ACTIVE',  profile: 'VIP',      lastOrderAt: '2025-03-12' },
  'SDA-00387': { name: 'Jorge Martínez', businessName: 'Studio JM Madrid',        status: 'ACTIVE',  profile: 'STANDARD', lastOrderAt: '2025-02-10' },
  'SDA-00187': { name: 'Ana Ferrer',     businessName: 'Ferrer Beauty Valencia',  status: 'BLOCKED', profile: 'STANDARD', lastOrderAt: '2024-11-15' },
  'SDA-00098': { name: 'Marcos Gil',     businessName: 'Gil Peluqueros Sevilla',  status: 'BLOCKED', profile: 'STANDARD', lastOrderAt: '2024-09-30' },
}

export class SapIntegrationClient {
  constructor () {
    this.http = new HttpClient(
      process.env.SAP_INTEGRATION_URL ?? 'http://sap-integration-service:3010',
      { timeout: 5000 }
    )
  }

  async getOrders (sapCode) {
    if (isStubMode()) {
      console.log(`[stub] SapIntegrationClient.getOrders(${sapCode})`)
      return STUB_ORDERS[sapCode] ?? []
    }
    return this.http.get(`/internal/orders/${sapCode}`) ?? []
  }

  async getCustomer (sapCode) {
    if (isStubMode()) {
      console.log(`[stub] SapIntegrationClient.getCustomer(${sapCode})`)
      return STUB_CUSTOMERS[sapCode] ?? null
    }
    return this.http.get(`/internal/customers/${sapCode}`)
  }
}
