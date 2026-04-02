/**
 * SapIntegrationClient
 *
 * Cliente HTTP que se comunica con el SAP Integration Service.
 * Por ahora incluye un STUB con datos de prueba para desarrollo.
 * En producción reemplazar STUB_MODE=false y apuntar a SAP_INTEGRATION_URL.
 */

const isStubMode = () => process.env.NODE_ENV !== 'production'

// ── Datos de prueba ───────────────────────────────────────────────────────────
const STUB_CUSTOMERS = [
  {
    sapCode: 'SDA-00423',
    password: 'demo1234',
    name: 'Rosa Canals',
    businessName: 'Salón Canals Barcelona',
    profile: 'PREMIUM',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    authenticated: true
  },
  {
    sapCode: 'SDA-00387',
    password: 'demo1234',
    name: 'Jorge Martínez',
    businessName: 'Studio JM Madrid',
    profile: 'STANDARD',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    authenticated: true
  },
  {
    sapCode: 'SDA-00187',
    password: 'demo1234',
    name: 'Ana Ferrer',
    businessName: 'Ferrer Beauty Valencia',
    profile: 'STANDARD',
    role: 'CUSTOMER',
    status: 'BLOCKED',
    blockReason: 'DEBT',
    authenticated: false
  },
  {
    sapCode: 'SDA-00521',
    password: 'demo1234',
    name: 'Lidia Puig',
    businessName: 'Puig Estilistes Girona',
    profile: 'VIP',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    authenticated: true
  },
  {
    sapCode: 'ADMIN-001',
    password: 'admin1234',
    name: 'Administrador',
    businessName: 'Secretos del Agua',
    profile: 'ADMIN',
    role: 'ADMIN',
    status: 'ACTIVE',
    authenticated: true
  }
]

export class SapIntegrationClient {
  constructor () {
    this.baseUrl = process.env.SAP_INTEGRATION_URL ?? 'http://sap-integration-service:3010'
  }

  /**
   * Verifica las credenciales contra SAP Integration Service.
   * @returns {object} datos del cliente con estado de autenticación y bloqueo
   */
  async verifyCredentials (sapCode, password) {
    if (isStubMode()) {
      return this.#stubVerify(sapCode, password)
    }

    const response = await fetch(`${this.baseUrl}/internal/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sapCode, password }),
      signal: AbortSignal.timeout(5000)   // timeout 5s
    })

    if (!response.ok) {
      throw new Error(`SAP Integration respondió con ${response.status}`)
    }

    return response.json()
  }

  // ── STUB ─────────────────────────────────────────────────────────────────────
  #stubVerify (sapCode, password) {
    const customer = STUB_CUSTOMERS.find(c => c.sapCode === sapCode)

    if (!customer) {
      return { authenticated: false, status: 'NOT_FOUND' }
    }

    if (customer.status === 'BLOCKED') {
      return {
        authenticated: false,
        status: 'BLOCKED',
        blockReason: customer.blockReason,
        sapCode: customer.sapCode,
        name: customer.name
      }
    }

    if (customer.password !== password) {
      return { authenticated: false, status: 'WRONG_PASSWORD' }
    }

    return {
      authenticated: true,
      status: 'ACTIVE',
      sapCode: customer.sapCode,
      name: customer.name,
      businessName: customer.businessName,
      profile: customer.profile,
      role: customer.role
    }
  }
}
