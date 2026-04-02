/**
 * SapIntegrationClient
 * Cliente HTTP hacia el SAP Integration Service.
 * En modo desarrollo usa datos locales (STUB) si SAP no está disponible.
 */

const isStubMode = () => process.env.NODE_ENV !== 'production'

const STUB_CUSTOMERS = [
  {
    sapCode: 'SDA-00423',
    name: 'Rosa Canals',
    businessName: 'Salón Canals Barcelona',
    email: 'rosa@saloncanals.com',
    profile: 'PREMIUM',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    permissions: ['ORDER', 'VIEW_PROMOTIONS', 'VIEW_PRICES']
  },
  {
    sapCode: 'SDA-00387',
    name: 'Jorge Martínez',
    businessName: 'Studio JM Madrid',
    email: 'jorge@studiojm.com',
    profile: 'STANDARD',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    permissions: ['ORDER', 'VIEW_PRICES']
  },
  {
    sapCode: 'SDA-00187',
    name: 'Ana Ferrer',
    businessName: 'Ferrer Beauty Valencia',
    email: 'ana@ferrerbeauty.com',
    profile: 'STANDARD',
    role: 'CUSTOMER',
    status: 'BLOCKED',
    permissions: []
  },
  {
    sapCode: 'SDA-00521',
    name: 'Lidia Puig',
    businessName: 'Puig Estilistes Girona',
    email: 'lidia@puigestilistes.com',
    profile: 'VIP',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    permissions: ['ORDER', 'VIEW_PROMOTIONS', 'VIEW_PRICES', 'SPECIAL_CONDITIONS']
  },
  {
    sapCode: 'SDA-00098',
    name: 'Marcos Gil',
    businessName: 'Gil Peluqueros Sevilla',
    email: 'marcos@gilpeluqueros.com',
    profile: 'STANDARD',
    role: 'CUSTOMER',
    status: 'BLOCKED',
    permissions: []
  },
  {
    sapCode: 'ADMIN-001',
    name: 'Administrador',
    businessName: 'Secretos del Agua',
    email: 'admin@secretosdelagua.com',
    profile: 'ADMIN',
    role: 'ADMIN',
    status: 'ACTIVE',
    permissions: ['ORDER', 'VIEW_PROMOTIONS', 'VIEW_PRICES', 'SPECIAL_CONDITIONS', 'MANAGE_PROFILES', 'MANAGE_PROMOTIONS']
  }
]

export class SapIntegrationClient {
  constructor () {
    this.baseUrl = process.env.SAP_INTEGRATION_URL ?? 'http://sap-integration-service:3010'
  }

  async getCustomer (sapCode) {
    if (isStubMode()) return this.#stubGetCustomer(sapCode)

    const res = await fetch(`${this.baseUrl}/internal/customers/${sapCode}`, {
      signal: AbortSignal.timeout(5000)
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`SAP Integration respondió con ${res.status}`)
    return res.json()
  }

  async getAllCustomers () {
    if (isStubMode()) return STUB_CUSTOMERS.map(c => ({ ...c }))

    const res = await fetch(`${this.baseUrl}/internal/customers`, {
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) throw new Error(`SAP Integration respondió con ${res.status}`)
    return res.json()
  }

  async updateProfile (sapCode, profile) {
    if (isStubMode()) return this.#stubUpdateProfile(sapCode, profile)

    const res = await fetch(`${this.baseUrl}/internal/customers/${sapCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) throw new Error(`SAP Integration respondió con ${res.status}`)
    return res.json()
  }

  // ── STUB ──────────────────────────────────────────────────────

  #stubGetCustomer (sapCode) {
    const customer = STUB_CUSTOMERS.find(c => c.sapCode === sapCode)
    return customer ? { ...customer } : null
  }

  #stubUpdateProfile (sapCode, profile) {
    const customer = STUB_CUSTOMERS.find(c => c.sapCode === sapCode)
    if (!customer) return null
    customer.profile = profile
    customer.permissions = this.#permissionsForProfile(profile)
    return { ...customer }
  }

  #permissionsForProfile (profile) {
    const map = {
      STANDARD: ['ORDER', 'VIEW_PRICES'],
      PREMIUM:  ['ORDER', 'VIEW_PROMOTIONS', 'VIEW_PRICES'],
      VIP:      ['ORDER', 'VIEW_PROMOTIONS', 'VIEW_PRICES', 'SPECIAL_CONDITIONS'],
      ADMIN:    ['ORDER', 'VIEW_PROMOTIONS', 'VIEW_PRICES', 'SPECIAL_CONDITIONS', 'MANAGE_PROFILES', 'MANAGE_PROMOTIONS']
    }
    return map[profile] ?? map.STANDARD
  }
}
