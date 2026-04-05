import { HttpClient } from './HttpClient.js'

const isStubMode = () => process.env.NODE_ENV === 'test'

const STUB_ORDERS = {
  'SDA-00423': [
    {
      orderId: 'SDA-2025-0890', sapCode: 'SDA-00423', date: '2025-03-08',
      status: 'SHIPPED', total: 96.00,
      items: [{ productCode: 'P-RT-001', name: 'Champú Restaurador', quantity: 6, unitPrice: 16.00 }]
    }
  ]
}

const STUB_ORDER_BY_ID = {
  'SDA-2025-0890': {
    orderId: 'SDA-2025-0890', sapCode: 'SDA-00423', date: '2025-03-08',
    status: 'SHIPPED', total: 96.00,
    items: [{ productCode: 'P-RT-001', name: 'Champú Restaurador', quantity: 6, unitPrice: 16.00 }]
  }
}

let stubCounter = 9000

export class SapIntegrationClient {
  constructor () {
    this.http = new HttpClient(
      process.env.SAP_INTEGRATION_URL ?? 'http://sap-integration-service:3010',
      { timeout: 5000 }
    )
  }

  getOrders (sapCode) {
    if (isStubMode()) {
      console.log(`[stub] SapIntegrationClient.getOrders(${sapCode})`)
      return Promise.resolve(STUB_ORDERS[sapCode] ?? [])
    }
    return this.http.get(`/internal/orders/${sapCode}`)
  }

  getOrder (orderId) {
    if (isStubMode()) {
      console.log(`[stub] SapIntegrationClient.getOrder(${orderId})`)
      return Promise.resolve(STUB_ORDER_BY_ID[orderId] ?? null)
    }
    return this.http.get(`/internal/orders/order/${orderId}`)
  }

  createOrder (sapCode, items) {
    if (isStubMode()) {
      console.log(`[stub] SapIntegrationClient.createOrder(${sapCode}, items:${items.length})`)
      // Simular OUT_OF_STOCK: cualquier item con productCode 'P-OUT-OF-STOCK'
      const oosItem = items.find(i => i.productCode === 'P-OUT-OF-STOCK')
      if (oosItem) {
        const err = new Error('Stock insuficiente para P-OUT-OF-STOCK')
        err.code = 'OUT_OF_STOCK'
        err.productCode = 'P-OUT-OF-STOCK'
        err.requested = oosItem.quantity
        err.available = 0
        return Promise.reject(err)
      }
      const total = items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantity, 0)
      const order = {
        orderId: `SDA-2025-${String(++stubCounter)}`,
        sapCode, date: new Date().toISOString().split('T')[0],
        status: 'CONFIRMED', items, total
      }
      STUB_ORDER_BY_ID[order.orderId] = order
      if (!STUB_ORDERS[sapCode]) STUB_ORDERS[sapCode] = []
      STUB_ORDERS[sapCode].unshift(order)
      return Promise.resolve(order)
    }
    return this.http.post('/internal/orders', { sapCode, items })
  }
}
