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
  constructor (log = null) {
    this.log = log
  }

  #logStub (method, args = '') {
    this.log?.info(`[stub] StubAdapter.${method}(${args})`)
  }

  // ── Clientes ────────────────────────────────────────────────────

  async verifyCredentials (sapCode, password) {
    this.#logStub('verifyCredentials', sapCode)
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
    this.#logStub('getCustomer', sapCode)
    const customer = CUSTOMERS.find(c => c.sapCode === sapCode)
    if (!customer) return null

    const { password, ...safeCustomer } = customer
    return safeCustomer
  }

  async getAllCustomers () {
    this.#logStub('getAllCustomers')
    return CUSTOMERS.map(({ password, ...c }) => c)
  }

  // ── Catálogo ────────────────────────────────────────────────────

  async getFamilies () {
    this.#logStub('getFamilies')
    return FAMILIES
  }

  async getProducts (familyId = null) {
    this.#logStub('getProducts', familyId ?? 'all')
    const products = familyId
      ? PRODUCTS.filter(p => p.familyId === familyId && p.active)
      : PRODUCTS.filter(p => p.active)
    return products
  }

  async getProduct (sapCode) {
    this.#logStub('getProduct', sapCode)
    return PRODUCTS.find(p => p.sapCode === sapCode) ?? null
  }

  // ── Precios ─────────────────────────────────────────────────────

  async getPrice (productCode, profile) {
    this.#logStub('getPrice', `${productCode}, ${profile}`)
    const productPrices = PRICES[productCode]
    if (!productPrices) return null
    return productPrices[profile] ?? productPrices['STANDARD']
  }

  async getPricesForProfile (profile) {
    this.#logStub('getPricesForProfile', profile)
    return Object.entries(PRICES).reduce((acc, [productCode, prices]) => {
      acc[productCode] = prices[profile] ?? prices['STANDARD']
      return acc
    }, {})
  }

  // ── Stock ────────────────────────────────────────────────────────

  async getStock (productCode) {
    this.#logStub('getStock', productCode)
    return STOCK[productCode] ?? 0
  }

  async getAllStock () {
    this.#logStub('getAllStock')
    return STOCK
  }

  // ── Pedidos ──────────────────────────────────────────────────────

  async getOrders (sapCode) {
    this.#logStub('getOrders', sapCode)
    return ORDERS.filter(o => o.sapCode === sapCode)
  }

  async getOrder (orderId) {
    this.#logStub('getOrder', orderId)
    return ORDERS.find(o => o.orderId === orderId) ?? null
  }

  async createOrder (sapCode, items) {
    this.#logStub('createOrder', `${sapCode}, items:${items.length}`)
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
    this.#logStub('updateProfile', `${sapCode}, ${profile}`)
    const customer = CUSTOMERS.find(c => c.sapCode === sapCode)
    if (!customer) return null
    customer.profile = profile
    const { password, ...safeCustomer } = customer
    return safeCustomer
  }

  async updateStatus (sapCode, status, blockReason = null) {
    this.#logStub('updateStatus', `${sapCode}, ${status}`)
    const customer = CUSTOMERS.find(c => c.sapCode === sapCode)
    if (!customer) return null
    customer.status = status
    customer.blockReason = blockReason
    const { password, ...safeCustomer } = customer
    return safeCustomer
  }

  async getBenefits (sapCode) {
    this.#logStub('getBenefits', sapCode)
    return ORDERS
      .filter(o => o.sapCode === sapCode && o.benefits?.length)
      .flatMap(o => o.benefits.map(b => ({ ...b, orderId: o.orderId, date: o.date })))
  }

  async createCreditNote ({ returnId, orderId, sapCode, items }) {
    this.#logStub('createCreditNote', `returnId:${returnId}`)
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
    this.#logStub('getInvoice', invoiceId)
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
