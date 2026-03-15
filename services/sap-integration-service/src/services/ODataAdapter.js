/**
 * ODataAdapter
 * Implementa la misma interfaz que StubAdapter pero contra SAP Gateway (OData/REST).
 *
 * Requiere SAP Gateway activo con los siguientes servicios OData:
 *   - /ZSD_CUSTOMERS_SRV    → clientes y autenticación
 *   - /ZSD_CATALOG_SRV      → productos, familias, precios y stock
 *   - /ZSD_ORDERS_SRV       → pedidos
 *   - /ZSD_INVOICES_SRV     → facturas
 *
 * Los nombres de los servicios OData son ilustrativos — ajustar
 * según la nomenclatura real del sistema SAP del cliente.
 */
export class ODataAdapter {
  constructor (log) {
    this.log = log
    this.baseUrl = process.env.SAP_BASE_URL
    this.auth = Buffer.from(
      `${process.env.SAP_USER}:${process.env.SAP_PASSWORD}`
    ).toString('base64')
    this.headers = {
      'Authorization': `Basic ${this.auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'sap-client': process.env.SAP_CLIENT ?? '100',
      'sap-language': process.env.SAP_LANGUAGE ?? 'ES'
    }
  }

  // ── Método base de petición ──────────────────────────────────────

  async #fetch (path, options = {}) {
    const url = `${this.baseUrl}${path}`
    this.log.debug({ url, method: options.method ?? 'GET' }, 'SAP OData request')

    const res = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...options.headers },
      signal: AbortSignal.timeout(10000)
    })

    if (!res.ok) {
      const text = await res.text()
      this.log.error({ url, status: res.status, body: text }, 'SAP OData error')
      throw new Error(`SAP responded with ${res.status}: ${text}`)
    }

    const data = await res.json()
    // OData envuelve los resultados en data.d o data.d.results
    return data?.d?.results ?? data?.d ?? data
  }

  // ── Clientes ─────────────────────────────────────────────────────

  async verifyCredentials (sapCode, password) {
    // SAP no expone un endpoint de verificación de contraseña estándar.
    // La autenticación se hace intentando una petición autenticada
    // con las credenciales del usuario.
    try {
      const userAuth = Buffer.from(`${sapCode}:${password}`).toString('base64')
      const res = await fetch(
        `${this.baseUrl}/ZSD_CUSTOMERS_SRV/CustomerSet('${sapCode}')`,
        {
          headers: {
            ...this.headers,
            Authorization: `Basic ${userAuth}`
          },
          signal: AbortSignal.timeout(10000)
        }
      )

      if (res.status === 401) {
        return { authenticated: false, status: 'WRONG_PASSWORD' }
      }

      if (res.status === 403) {
        const data = await res.json()
        return {
          authenticated: false,
          status: 'BLOCKED',
          blockReason: data?.d?.BlockReason ?? 'ADMIN'
        }
      }

      if (!res.ok) {
        return { authenticated: false, status: 'NOT_FOUND' }
      }

      const data = await res.json()
      const customer = data?.d

      return {
        authenticated: true,
        status: 'ACTIVE',
        sapCode: customer.CustomerCode,
        name: customer.Name,
        businessName: customer.BusinessName,
        email: customer.Email,
        profile: customer.Profile,   // STANDARD | PREMIUM | VIP
        role: customer.Role ?? 'CUSTOMER'
      }
    } catch (err) {
      this.log.error({ err: err.message }, 'SAP credentials verification failed')
      throw err
    }
  }

  async getCustomer (sapCode) {
    const data = await this.#fetch(
      `/ZSD_CUSTOMERS_SRV/CustomerSet('${sapCode}')`
    )
    return this.#mapCustomer(data)
  }

  async getAllCustomers () {
    const data = await this.#fetch('/ZSD_CUSTOMERS_SRV/CustomerSet')
    return data.map(c => this.#mapCustomer(c))
  }

  // ── Catálogo ─────────────────────────────────────────────────────

  async getFamilies () {
    const data = await this.#fetch('/ZSD_CATALOG_SRV/FamilySet')
    return data.map(f => ({
      id: f.FamilyId,
      name: f.Name,
      description: f.Description
    }))
  }

  async getProducts (familyId = null) {
    const filter = familyId ? `?$filter=FamilyId eq '${familyId}'` : ''
    const data = await this.#fetch(`/ZSD_CATALOG_SRV/ProductSet${filter}`)
    return data.map(p => this.#mapProduct(p))
  }

  async getProduct (sapCode) {
    const data = await this.#fetch(
      `/ZSD_CATALOG_SRV/ProductSet('${sapCode}')`
    )
    return this.#mapProduct(data)
  }

  // ── Precios ──────────────────────────────────────────────────────

  async getPrice (productCode, profile) {
    const data = await this.#fetch(
      `/ZSD_CATALOG_SRV/PriceSet(ProductCode='${productCode}',Profile='${profile}')`
    )
    return data.Price
  }

  async getPricesForProfile (profile) {
    const data = await this.#fetch(
      `/ZSD_CATALOG_SRV/PriceSet?$filter=Profile eq '${profile}'`
    )
    return data.reduce((acc, p) => {
      acc[p.ProductCode] = p.Price
      return acc
    }, {})
  }

  // ── Stock ────────────────────────────────────────────────────────

  async getStock (productCode) {
    const data = await this.#fetch(
      `/ZSD_CATALOG_SRV/StockSet('${productCode}')`
    )
    return data.Quantity
  }

  async getAllStock () {
    const data = await this.#fetch('/ZSD_CATALOG_SRV/StockSet')
    return data.reduce((acc, s) => {
      acc[s.ProductCode] = s.Quantity
      return acc
    }, {})
  }

  // ── Pedidos ──────────────────────────────────────────────────────

  async getOrders (sapCode) {
    const data = await this.#fetch(
      `/ZSD_ORDERS_SRV/OrderSet?$filter=CustomerCode eq '${sapCode}'&$orderby=Date desc`
    )
    return data.map(o => this.#mapOrder(o))
  }

  async getOrder (orderId) {
    const data = await this.#fetch(
      `/ZSD_ORDERS_SRV/OrderSet('${orderId}')?$expand=Items`
    )
    return this.#mapOrder(data)
  }

  async createOrder (sapCode, items) {
    const data = await this.#fetch('/ZSD_ORDERS_SRV/OrderSet', {
      method: 'POST',
      body: JSON.stringify({
        CustomerCode: sapCode,
        Items: items.map(i => ({
          ProductCode: i.productCode,
          Quantity: i.quantity
        }))
      })
    })
    return this.#mapOrder(data)
  }

  // ── Facturas ─────────────────────────────────────────────────────

  async getInvoice (invoiceId) {
    const data = await this.#fetch(
      `/ZSD_INVOICES_SRV/InvoiceSet('${invoiceId}')`
    )
    return {
      invoiceId: data.InvoiceId,
      orderId: data.OrderId,
      sapCode: data.CustomerCode,
      date: data.Date,
      total: data.Total,
      items: data.Items?.map(i => ({
        productCode: i.ProductCode,
        name: i.Name,
        quantity: i.Quantity,
        unitPrice: i.UnitPrice
      })),
      pdfUrl: data.PdfUrl
    }
  }

  // ── Mappers (SAP → modelo interno) ──────────────────────────────

  #mapCustomer (c) {
    return {
      sapCode: c.CustomerCode,
      name: c.Name,
      businessName: c.BusinessName,
      email: c.Email,
      phone: c.Phone,
      profile: c.Profile,
      role: c.Role ?? 'CUSTOMER',
      status: c.Status,
      blockReason: c.BlockReason ?? null,
      creditLimit: c.CreditLimit,
      paymentTerms: c.PaymentTerms
    }
  }

  #mapProduct (p) {
    return {
      sapCode: p.ProductCode,
      familyId: p.FamilyId,
      name: p.Name,
      description: p.Description,
      format: p.Format,
      imageUrl: p.ImageUrl ?? null,
      active: p.Active === 'X'   // SAP usa 'X' para true
    }
  }

  #mapOrder (o) {
    return {
      orderId: o.OrderId,
      sapCode: o.CustomerCode,
      date: o.Date,
      status: o.Status,
      items: o.Items?.map(i => ({
        productCode: i.ProductCode,
        name: i.Name,
        quantity: i.Quantity,
        unitPrice: i.UnitPrice
      })),
      subtotal: o.Subtotal,
      shipping: o.Shipping,
      total: o.Total,
      invoiceId: o.InvoiceId ?? null
    }
  }
}
