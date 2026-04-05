import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, post, PORTS } from '../helpers/client.js'

const P = PORTS.orders

const ORDER_PAYLOAD = {
  items: [
    { productCode: 'P-RT-001', name: 'Champú Ritual', quantity: 2, unitPrice: 15.20 },
    { productCode: 'P-SN-001', name: 'Sérum Sensitivo', quantity: 1, unitPrice: 12.35 }
  ],
  deliveryAddress: { street: 'Calle Mayor 1', city: 'Barcelona', zip: '08001', country: 'ES' },
  notes: 'Integration test order'
}

describe('order-service — integration', () => {
  let tokenA
  let tokenB
  let tokenAdmin
  let createdOrderId

  before(async () => {
    tokenA     = await login('SDA-00423', 'demo1234')
    tokenB     = await login('SDA-00521', 'demo1234')
    tokenAdmin = await login('ADMIN-001', 'admin1234')
  })

  // ── Health ─────────────────────────────────────────────────────
  describe('GET /health', () => {
    test('returns 200', async () => {
      const { status, body } = await get(P, '/health')
      assert.equal(status, 200)
      assert.equal(body.status, 'ok')
    })
  })

  // ── HU-18 — Order history ──────────────────────────────────────
  describe('GET /orders', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/orders')
      assert.equal(status, 401)
    })

    test('returns orders for authenticated customer', async () => {
      const { status, body } = await get(P, '/orders', { token: tokenA })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
    })

    test('customer A does not see customer B orders', async () => {
      const { body: ordersA } = await get(P, '/orders', { token: tokenA })
      const { body: ordersB } = await get(P, '/orders', { token: tokenB })
      const idsA = ordersA.map(o => o.orderId)
      const idsB = ordersB.map(o => o.orderId)
      // No overlap between orders lists
      const overlap = idsA.filter(id => idsB.includes(id))
      assert.equal(overlap.length, 0)
    })
  })

  // ── HU-16 — Create order ───────────────────────────────────────
  describe('POST /orders', () => {
    test('no token returns 401', async () => {
      const { status } = await post(P, '/orders', { body: ORDER_PAYLOAD })
      assert.equal(status, 401)
    })

    test('creates a new order', async () => {
      const { status, body } = await post(P, '/orders', { token: tokenA, body: ORDER_PAYLOAD })
      assert.equal(status, 201)
      assert.ok(body.orderId)
      assert.ok(body.status)
      assert.ok(body.total > 0)
      createdOrderId = body.orderId
    })

    test('missing items returns 400', async () => {
      const { status } = await post(P, '/orders', {
        token: tokenA,
        body: { deliveryAddress: ORDER_PAYLOAD.deliveryAddress }
      })
      assert.equal(status, 400)
    })

    test('empty items array returns 400', async () => {
      const { status } = await post(P, '/orders', {
        token: tokenA,
        body: { ...ORDER_PAYLOAD, items: [] }
      })
      assert.equal(status, 400)
    })

    test('quantity exceeding stock returns 409 OUT_OF_STOCK', async () => {
      const { status, body } = await post(P, '/orders', {
        token: tokenA,
        body: {
          items: [{ productCode: 'P-RT-001', name: 'Champú', quantity: 99999, unitPrice: 16.00 }]
        }
      })
      assert.equal(status, 409)
      assert.equal(body.error, 'OUT_OF_STOCK')
      assert.equal(body.productCode, 'P-RT-001')
    })

    test('OUT_OF_STOCK response includes available quantity', async () => {
      const { body } = await post(P, '/orders', {
        token: tokenA,
        body: {
          items: [{ productCode: 'P-RT-001', name: 'Champú', quantity: 99999, unitPrice: 16.00 }]
        }
      })
      assert.ok(typeof body.available === 'number')
      assert.ok(body.available < 99999)
    })
  })

  // ── HU-19 — Order detail ───────────────────────────────────────
  // Use a known static order from sap-integration-service (stub doesn't persist created orders)
  const KNOWN_ORDER_ID = 'SDA-2025-0890' // belongs to SDA-00423

  describe('GET /orders/:orderId', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, `/orders/${KNOWN_ORDER_ID}`)
      assert.equal(status, 401)
    })

    test('returns order detail for known order', async () => {
      const { status, body } = await get(P, `/orders/${KNOWN_ORDER_ID}`, { token: tokenA })
      assert.equal(status, 200)
      assert.equal(body.orderId, KNOWN_ORDER_ID)
      assert.ok(Array.isArray(body.items))
    })

    test('customer B cannot access customer A order — 403 or 404', async () => {
      const { status } = await get(P, `/orders/${KNOWN_ORDER_ID}`, { token: tokenB })
      assert.ok(status === 403 || status === 404)
    })

    test('unknown order returns 404', async () => {
      const { status } = await get(P, '/orders/NONEXISTENT-ORDER', { token: tokenA })
      assert.equal(status, 404)
    })
  })
})
