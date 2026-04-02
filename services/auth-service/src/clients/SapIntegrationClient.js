import { HttpClient } from './HttpClient.js'

const isStubMode = () => process.env.NODE_ENV === 'test'

const STUB_CUSTOMERS = [
  { sapCode: 'SDA-00423', password: 'demo1234', name: 'Rosa Canals', businessName: 'Salón Canals Barcelona', profile: 'PREMIUM', role: 'CUSTOMER', status: 'ACTIVE' },
  { sapCode: 'SDA-00387', password: 'demo1234', name: 'Jorge Martínez', businessName: 'Studio JM Madrid', profile: 'STANDARD', role: 'CUSTOMER', status: 'ACTIVE' },
  { sapCode: 'SDA-00187', password: 'demo1234', name: 'Ana Ferrer', businessName: 'Ferrer Beauty Valencia', profile: 'STANDARD', role: 'CUSTOMER', status: 'BLOCKED', blockReason: 'DEBT' },
  { sapCode: 'SDA-00521', password: 'demo1234', name: 'Lidia Puig', businessName: 'Puig Estilistes Girona', profile: 'VIP', role: 'CUSTOMER', status: 'ACTIVE' },
  { sapCode: 'SDA-00098', password: 'demo1234', name: 'Marcos Gil', businessName: 'Gil Peluqueros Sevilla', profile: 'STANDARD', role: 'CUSTOMER', status: 'BLOCKED', blockReason: 'ADMIN' },
  { sapCode: 'ADMIN-001', password: 'admin1234', name: 'Administrador', businessName: 'Secretos del Agua', profile: 'ADMIN', role: 'ADMIN', status: 'ACTIVE' }
]

/**
 * SapIntegrationClient — auth-service
 * Verifica credenciales contra el SAP Integration Service.
 */
export class SapIntegrationClient {
  constructor () {
    this.http = new HttpClient(
      process.env.SAP_INTEGRATION_URL ?? 'http://sap-integration-service:3010',
      { timeout: 5000 }
    )
  }

  async verifyCredentials (sapCode, password) {
    if (isStubMode()) {
      console.log(`[stub] SapIntegrationClient.verifyCredentials(${sapCode})`)
      return this.#stubVerify(sapCode, password)
    }
    return this.http.post('/internal/customers/verify', { sapCode, password })
  }

  #stubVerify (sapCode, password) {
    const customer = STUB_CUSTOMERS.find(c => c.sapCode === sapCode)
    if (!customer) return { authenticated: false, status: 'NOT_FOUND' }
    if (customer.status === 'BLOCKED') return { authenticated: false, status: 'BLOCKED', blockReason: customer.blockReason, sapCode: customer.sapCode, name: customer.name }
    if (customer.password !== password) return { authenticated: false, status: 'WRONG_PASSWORD' }
    const { password: _, ...safe } = customer
    return { authenticated: true, status: 'ACTIVE', ...safe }
  }
}
