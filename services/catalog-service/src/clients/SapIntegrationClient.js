import { HttpClient } from './HttpClient.js'

const STUB_MODE = process.env.NODE_ENV !== 'production'

const STUB_FAMILIES = [
  { id: 'F01', name: 'Ritual Timeless',    description: 'Tratamiento restaurador intensivo' },
  { id: 'F02', name: 'Sensitivo',          description: 'Fórmula hipoalergénica para pieles reactivas' },
  { id: 'F03', name: 'Brillo & Nutrición', description: 'Nutrición profunda y brillo intenso' }
]

const STUB_PRODUCTS = [
  { sapCode: 'P-RT-001', familyId: 'F01', name: 'Champú Restaurador Timeless', format: '250ml', active: true },
  { sapCode: 'P-RT-002', familyId: 'F01', name: 'Mascarilla Timeless',         format: '200ml', active: true },
  { sapCode: 'P-RT-003', familyId: 'F01', name: 'Aceite Acabado Timeless',     format: '100ml', active: true },
  { sapCode: 'P-SN-001', familyId: 'F02', name: 'Champú Sensitivo',            format: '250ml', active: true },
  { sapCode: 'P-SN-002', familyId: 'F02', name: 'Acondicionador Sensitivo',    format: '200ml', active: true },
  { sapCode: 'P-BN-001', familyId: 'F03', name: 'Aceite Brillo Argán',         format: '100ml', active: true },
]

const STUB_PRICES = {
  STANDARD: { 'P-RT-001': 16.00, 'P-RT-002': 19.00, 'P-RT-003': 31.00, 'P-SN-001': 13.00, 'P-SN-002': 14.00, 'P-BN-001': 26.00 },
  PREMIUM:  { 'P-RT-001': 15.20, 'P-RT-002': 18.05, 'P-RT-003': 29.45, 'P-SN-001': 12.35, 'P-SN-002': 13.30, 'P-BN-001': 24.70 },
  VIP:      { 'P-RT-001': 14.40, 'P-RT-002': 17.10, 'P-RT-003': 27.90, 'P-SN-001': 11.70, 'P-SN-002': 12.60, 'P-BN-001': 23.40 },
  ADMIN:    { 'P-RT-001': 14.40, 'P-RT-002': 17.10, 'P-RT-003': 27.90, 'P-SN-001': 11.70, 'P-SN-002': 12.60, 'P-BN-001': 23.40 },
}

const STUB_STOCK = {
  'P-RT-001': 240, 'P-RT-002': 0, 'P-RT-003': 85,
  'P-SN-001': 310, 'P-SN-002': 150, 'P-BN-001': 45
}

export class SapIntegrationClient {
  constructor () {
    this.http = new HttpClient(
      process.env.SAP_INTEGRATION_URL ?? 'http://sap-integration-service:3010',
      { timeout: 5000 }
    )
  }

  getFamilies () {
    if (STUB_MODE) return Promise.resolve([...STUB_FAMILIES])
    return this.http.get('/internal/catalog/families')
  }

  getProducts (familyId = null) {
    if (STUB_MODE) {
      const products = familyId
        ? STUB_PRODUCTS.filter(p => p.familyId === familyId)
        : [...STUB_PRODUCTS]
      return Promise.resolve(products)
    }
    return this.http.get(`/internal/catalog/products${familyId ? `?familyId=${familyId}` : ''}`)
  }

  getProduct (sapCode) {
    if (STUB_MODE) return Promise.resolve(STUB_PRODUCTS.find(p => p.sapCode === sapCode) ?? null)
    return this.http.get(`/internal/catalog/products/${sapCode}`)
  }

  getPricesForProfile (profile) {
    if (STUB_MODE) return Promise.resolve({ ...(STUB_PRICES[profile] ?? STUB_PRICES.STANDARD) })
    return this.http.get(`/internal/catalog/prices/${profile}`)
  }

  getPrice (profile, productCode) {
    if (STUB_MODE) {
      const price = (STUB_PRICES[profile] ?? STUB_PRICES.STANDARD)[productCode] ?? null
      return Promise.resolve(price != null ? { price } : null)
    }
    return this.http.get(`/internal/catalog/prices/${profile}/${productCode}`)
  }

  getAllStock () {
    if (STUB_MODE) return Promise.resolve({ ...STUB_STOCK })
    return this.http.get('/internal/catalog/stock')
  }

  getStock (productCode) {
    if (STUB_MODE) {
      const s = STUB_STOCK[productCode] ?? 0
      return Promise.resolve({ stock: s })
    }
    return this.http.get(`/internal/catalog/stock/${productCode}`)
  }
}
