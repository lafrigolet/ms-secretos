import { HttpClient } from './HttpClient.js'

const STUB_MODE = process.env.NODE_ENV !== 'production'

const STUB_CUSTOMERS = [
  { sapCode: 'SDA-00423', name: 'Rosa Canals', businessName: 'Salón Canals Barcelona', email: 'rosa@saloncanals.com', profile: 'PREMIUM', role: 'CUSTOMER', status: 'ACTIVE' },
  { sapCode: 'SDA-00387', name: 'Jorge Martínez', businessName: 'Studio JM Madrid', email: 'jorge@studiojm.com', profile: 'STANDARD', role: 'CUSTOMER', status: 'ACTIVE' },
  { sapCode: 'SDA-00187', name: 'Ana Ferrer', businessName: 'Ferrer Beauty Valencia', email: 'ana@ferrerbeauty.com', profile: 'STANDARD', role: 'CUSTOMER', status: 'BLOCKED' },
  { sapCode: 'SDA-00521', name: 'Lidia Puig', businessName: 'Puig Estilistes Girona', email: 'lidia@puigestilistes.com', profile: 'VIP', role: 'CUSTOMER', status: 'ACTIVE' },
  { sapCode: 'SDA-00098', name: 'Marcos Gil', businessName: 'Gil Peluqueros Sevilla', email: 'marcos@gilpeluqueros.com', profile: 'STANDARD', role: 'CUSTOMER', status: 'BLOCKED' },
  { sapCode: 'ADMIN-001', name: 'Administrador', businessName: 'Secretos del Agua', email: 'admin@secretosdelagua.com', profile: 'ADMIN', role: 'ADMIN', status: 'ACTIVE' }
]

/**
 * SapIntegrationClient — customer-profile-service
 * Obtiene y actualiza perfiles de cliente desde el SAP Integration Service.
 */
export class SapIntegrationClient {
  constructor () {
    this.http = new HttpClient(
      process.env.SAP_INTEGRATION_URL ?? 'http://sap-integration-service:3010',
      { timeout: 5000 }
    )
  }

  async getCustomer (sapCode) {
    if (STUB_MODE) return STUB_CUSTOMERS.find(c => c.sapCode === sapCode) ?? null
    return this.http.get(`/internal/customers/${sapCode}`)
  }

  async getAllCustomers () {
    if (STUB_MODE) return [...STUB_CUSTOMERS]
    return this.http.get('/internal/customers')
  }

  async updateProfile (sapCode, profile) {
    if (STUB_MODE) {
      const customer = STUB_CUSTOMERS.find(c => c.sapCode === sapCode)
      if (customer) customer.profile = profile
      return customer ?? null
    }
    return this.http.patch(`/internal/customers/${sapCode}`, { profile })
  }
}
