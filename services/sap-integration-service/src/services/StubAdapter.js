import {
  CUSTOMERS, FAMILIES, PRODUCTS,
  PRICES, STOCK, ORDERS
} from '../data/stubData.js'

/**
 * StubAdapter
 * Implementa la misma interfaz que ODataAdapter pero con datos locales.
 * Se usa cuando SAP_MODE=stub (desarrollo y tests).
 */
export class StubAdapter {

  // ── Clientes ────────────────────────────────────────────────────

  async verifyCredentials (sapCode, password) {
    const customer = CUSTOMERS.find(c => c.sapCode === sapCode)

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
      email: customer.email,
      profile: customer.profile,
      role: customer.role
    }
  }

  async getCustomer (sapCode) {
    const customer = CUSTOMERS.find(c => c.sapCode === sapCode)
    if (!customer) return null

    const { password, ...safeCustomer } = customer
    return safeCustomer
  }

  async getAllCustomers () {
    return CUSTOMERS.map(({ password, ...c }) => c)
  }

  // ── Catálogo ────────────────────────────────────────────────────

  async getFamilies () {
    return FAMILIES
  }

  async getProducts (familyId = null) {
    const products = familyId
      ? PRODUCTS.filter(p => p.familyId === familyId && p.active)
      : PRODUCTS.filter(p => p.active)
    return products
  }

  async getProduct (sapCode) {
    return PRODUCTS.find(p => p.sapCode === sapCode) ?? null
  }

  // ── Precios ─────────────────────────────────────────────────────

  async getPrice (productCode, profile) {
    const productPrices = PRICES[productCode]
    if (!productPrices) return null
    return productPrices[profile] ?? productPrices['STANDARD']
  }

  async getPricesForProfile (profile) {
    return Object.entries(PRICES).reduce((acc, [productCode, prices]) => {
      acc[productCode] = prices[profile] ?? prices['STANDARD']
      return acc
    }, {})
  }

  // ── Stock ────────────────────────────────────────────────────────

  async getStock (productCode) {
    return STOCK[productCode] ?? 0
  }

  async getAllStock () {
    return STOCK
  }

  // ── Pedidos ──────────────────────────────────────────────────────

  async getOrders (sapCode) {
    return ORDERS.filter(o => o.sapCode === sapCode)
  }

  async getOrder (orderId) {
    return ORDERS.find(o => o.orderId === orderId) ?? null
  }

  async createOrder (sapCode, items) {
    // En modo stub simulamos la creación devolviendo un ID ficticio
    const orderId = `SDA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`
    return {
      orderId,
      sapCode,
      date: new Date().toISOString().split('T')[0],
      status: 'CONFIRMED',
      items,
      total: items.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0)
    }
  }

  async updateProfile (sapCode, profile) {
    const customer = CUSTOMERS.find(c => c.sapCode === sapCode)
    if (!customer) return null
    customer.profile = profile
    const { password, ...safeCustomer } = customer
    return safeCustomer
  }

  async updateStatus (sapCode, status, blockReason = null) {
    const customer = CUSTOMERS.find(c => c.sapCode === sapCode)
    if (!customer) return null
    customer.status = status
    customer.blockReason = blockReason
    const { password, ...safeCustomer } = customer
    return safeCustomer
  }

  async getBenefits (sapCode) {
    return ORDERS
      .filter(o => o.sapCode === sapCode && o.benefits?.length)
      .flatMap(o => o.benefits.map(b => ({ ...b, orderId: o.orderId, date: o.date })))
  }

  async createCreditNote ({ returnId, orderId, sapCode, items }) {
    return {
      creditNoteId: `CN-${new Date().getFullYear()}-${returnId.split('-').pop()}`,
      returnId,
      orderId,
      sapCode,
      items,
      status: 'CREATED',
      createdAt: new Date().toISOString()
    }
  }

  // ── Facturas ─────────────────────────────────────────────────────

  async getInvoice (invoiceId) {
    const order = ORDERS.find(o => o.invoiceId === invoiceId)
    if (!order) return null

    return {
      invoiceId: order.invoiceId,
      orderId: order.orderId,
      sapCode: order.sapCode,
      date: order.date,
      total: order.total,
      items: order.items,
      // En modo stub devolvemos un PDF simulado en base64
      pdfBase64: null,
      pdfUrl: `/invoices/${invoiceId}/download`
    }
  }
}
