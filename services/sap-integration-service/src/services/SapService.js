import { StubAdapter } from './StubAdapter.js'
import { ODataAdapter } from './ODataAdapter.js'

/**
 * SapService
 * Factory que selecciona el adaptador según SAP_MODE y añade
 * una capa de caché en memoria para reducir llamadas a SAP.
 */
export class SapService {
  constructor (log) {
    this.log = log
    this.adapter = this.#createAdapter()
    this.cache = new Map()

    const mode = process.env.SAP_MODE ?? 'stub'
    this.log.info(`SAP Integration Service arrancando en modo: ${mode.toUpperCase()}`)
  }

  // ── Factory ──────────────────────────────────────────────────────

  #createAdapter () {
    const mode = process.env.SAP_MODE ?? 'stub'
    switch (mode) {
      case 'odata': return new ODataAdapter(this.log)
      case 'stub':
      default:      return new StubAdapter(this.log)
    }
  }

  // ── Caché ────────────────────────────────────────────────────────

  async #cached (key, ttlEnvVar, fn) {
    const ttl = Number(process.env[ttlEnvVar] ?? 0)
    if (ttl === 0) return fn()   // caché desactivada

    const entry = this.cache.get(key)
    if (entry && Date.now() < entry.expiresAt) {
      this.log.debug({ key }, 'Cache hit')
      return entry.value
    }

    const value = await fn()
    this.cache.set(key, { value, expiresAt: Date.now() + ttl * 1000 })
    return value
  }

  // ── API pública (delega al adaptador con caché) ───────────────────

  async verifyCredentials (sapCode, password) {
    // Las verificaciones de credenciales nunca se cachean
    return this.adapter.verifyCredentials(sapCode, password)
  }

  async getCustomer (sapCode) {
    return this.#cached(
      `customer:${sapCode}`,
      'CACHE_TTL_CUSTOMERS',
      () => this.adapter.getCustomer(sapCode)
    )
  }

  async getAllCustomers () {
    return this.#cached(
      'customers:all',
      'CACHE_TTL_CUSTOMERS',
      () => this.adapter.getAllCustomers()
    )
  }

  async getFamilies () {
    return this.#cached(
      'families:all',
      'CACHE_TTL_PRODUCTS',
      () => this.adapter.getFamilies()
    )
  }

  async getProducts (familyId = null) {
    return this.#cached(
      `products:${familyId ?? 'all'}`,
      'CACHE_TTL_PRODUCTS',
      () => this.adapter.getProducts(familyId)
    )
  }

  async getProduct (sapCode) {
    return this.#cached(
      `product:${sapCode}`,
      'CACHE_TTL_PRODUCTS',
      () => this.adapter.getProduct(sapCode)
    )
  }

  async getPrice (productCode, profile) {
    return this.#cached(
      `price:${productCode}:${profile}`,
      'CACHE_TTL_PRICES',
      () => this.adapter.getPrice(productCode, profile)
    )
  }

  async getPricesForProfile (profile) {
    return this.#cached(
      `prices:${profile}`,
      'CACHE_TTL_PRICES',
      () => this.adapter.getPricesForProfile(profile)
    )
  }

  async getStock (productCode) {
    return this.#cached(
      `stock:${productCode}`,
      'CACHE_TTL_STOCK',
      () => this.adapter.getStock(productCode)
    )
  }

  async getAllStock () {
    return this.#cached(
      'stock:all',
      'CACHE_TTL_STOCK',
      () => this.adapter.getAllStock()
    )
  }

  async getOrders (sapCode) {
    // Los pedidos no se cachean — siempre frescos
    return this.adapter.getOrders(sapCode)
  }

  async getOrder (orderId) {
    return this.adapter.getOrder(orderId)
  }

  async createOrder (sapCode, items) {
    // Crear pedido nunca se cachea + invalida caché de stock
    const result = await this.adapter.createOrder(sapCode, items)
    this.#invalidateStock()
    return result
  }

  async getInvoice (invoiceId) {
    return this.#cached(
      `invoice:${invoiceId}`,
      'CACHE_TTL_PRODUCTS',   // las facturas son inmutables, TTL largo
      () => this.adapter.getInvoice(invoiceId)
    )
  }

  // ── Utilidades ───────────────────────────────────────────────────

  #invalidateStock () {
    for (const key of this.cache.keys()) {
      if (key.startsWith('stock:')) this.cache.delete(key)
    }
  }

  async updateProfile (sapCode, profile) {
    const result = await this.adapter.updateProfile(sapCode, profile)
    // Invalidar caché del cliente al modificar su perfil
    this.cache.delete(`customer:${sapCode}`)
    this.cache.delete('customers')
    return result
  }

  async updateStatus (sapCode, status, blockReason = null) {
    const result = await this.adapter.updateStatus(sapCode, status, blockReason)
    this.cache.delete(`customer:${sapCode}`)
    this.cache.delete('customers')
    return result
  }

  async getBenefits (sapCode) {
    return this.adapter.getBenefits(sapCode)
  }

  async createCreditNote (data) {
    return this.adapter.createCreditNote(data)
  }

  invalidateAll () {
    this.cache.clear()
    this.log.info('Caché invalidada completamente')
  }

  getCacheStats () {
    return {
      entries: this.cache.size,
      keys: [...this.cache.keys()]
    }
  }
}
