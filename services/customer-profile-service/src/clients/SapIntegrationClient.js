import { HttpClient } from './HttpClient.js'

const STUB_MODE = process.env.NODE_ENV !== 'production'

const STUB_CUSTOMERS = [
  { sapCode: 'SDA-00423', name: 'Rosa Canals',    businessName: 'Salón Canals Barcelona',   email: 'rosa@saloncanals.com',   phone: '932 456 789', city: 'Barcelona', postalCode: '08001', profile: 'PREMIUM',  role: 'CUSTOMER', status: 'ACTIVE',  joinedAt: '2022-03-15', lastOrderAt: '2025-03-08' },
  { sapCode: 'SDA-00387', name: 'Jorge Martínez', businessName: 'Studio JM Madrid',         email: 'jorge@studiojm.com',     phone: '914 321 654', city: 'Madrid',    postalCode: '28001', profile: 'STANDARD', role: 'CUSTOMER', status: 'ACTIVE',  joinedAt: '2022-07-20', lastOrderAt: '2025-02-21' },
  { sapCode: 'SDA-00187', name: 'Ana Ferrer',     businessName: 'Ferrer Beauty Valencia',   email: 'ana@ferrerbeauty.com',   phone: '963 789 012', city: 'Valencia',  postalCode: '46001', profile: 'STANDARD', role: 'CUSTOMER', status: 'BLOCKED', blockReason: 'DEBT',  joinedAt: '2021-11-10', lastOrderAt: '2024-11-15' },
  { sapCode: 'SDA-00521', name: 'Lidia Puig',     businessName: 'Puig Estilistes Girona',   email: 'lidia@puigestilistes.com',phone: '972 654 321', city: 'Girona',    postalCode: '17001', profile: 'VIP',      role: 'CUSTOMER', status: 'ACTIVE',  joinedAt: '2020-05-03', lastOrderAt: '2025-03-12' },
  { sapCode: 'SDA-00098', name: 'Marcos Gil',     businessName: 'Gil Peluqueros Sevilla',   email: 'marcos@gilpeluqueros.com',phone: '954 123 456', city: 'Sevilla',   postalCode: '41001', profile: 'STANDARD', role: 'CUSTOMER', status: 'BLOCKED', blockReason: 'ADMIN', joinedAt: '2023-01-18', lastOrderAt: '2024-09-30' },
  { sapCode: 'ADMIN-001', name: 'Administrador',  businessName: 'Secretos del Agua',        email: 'admin@secretosdelagua.com',phone: '900 000 000', city: 'Madrid',   postalCode: '28001', profile: 'ADMIN',    role: 'ADMIN',    status: 'ACTIVE',  joinedAt: '2020-01-01', lastOrderAt: null }
]

/**
 * SapIntegrationClient — customer-profile-service
 * HU-24, HU-25, HU-27, HU-28: búsqueda, filtrado, ficha completa y activación/bloqueo.
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
      const c = STUB_CUSTOMERS.find(c => c.sapCode === sapCode)
      if (c) c.profile = profile
      return c ?? null
    }
    return this.http.patch(`/internal/customers/${sapCode}`, { profile })
  }

  // HU-28 — activar o bloquear una cuenta
  async updateStatus (sapCode, status, blockReason = null) {
    if (STUB_MODE) {
      const c = STUB_CUSTOMERS.find(c => c.sapCode === sapCode)
      if (c) { c.status = status; c.blockReason = blockReason }
      return c ?? null
    }
    return this.http.patch(`/internal/customers/${sapCode}/status`, { status, blockReason })
  }
}
