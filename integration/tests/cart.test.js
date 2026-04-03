import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, post, patch, del, PORTS } from '../helpers/client.js'

const P = PORTS.cart

const ITEM = { productCode: 'P-RT-001', name: 'Champú Ritual', quantity: 2, unitPrice: 15.20 }

describe('cart-service — integration', () => {
  let token

  before(async () => {
    token = await login('SDA-00423', 'demo1234')
  })

  // ── Health ─────────────────────────────────────────────────────
  describe('GET /health', () => {
    test('returns 200', async () => {
      const { status, body } = await get(P, '/health')
      assert.equal(status, 200)
      assert.equal(body.status, 'ok')
    })
  })

  // ── HU-14 — Cart management ────────────────────────────────────
  describe('GET /cart', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/cart')
      assert.equal(status, 401)
    })

    test('returns cart (possibly empty)', async () => {
      const { status, body } = await get(P, '/cart', { token })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body.items))
      assert.ok(typeof body.total === 'number')
    })
  })

  describe('POST /cart/items', () => {
    test('no token returns 401', async () => {
      const { status } = await post(P, '/cart/items', { body: ITEM })
      assert.equal(status, 401)
    })

    test('adds item to cart', async () => {
      const { status, body } = await post(P, '/cart/items', { token, body: ITEM })
      assert.equal(status, 201)
      assert.ok(body.items.some(i => i.productCode === 'P-RT-001'))
    })

    test('missing productCode returns 400', async () => {
      const { status } = await post(P, '/cart/items', {
        token,
        body: { name: 'test', quantity: 1, unitPrice: 10 }
      })
      assert.equal(status, 400)
    })

    test('quantity 0 returns 400', async () => {
      const { status } = await post(P, '/cart/items', {
        token,
        body: { ...ITEM, quantity: 0 }
      })
      assert.equal(status, 400)
    })
  })

  describe('PATCH /cart/items/:productCode', () => {
    test('no token returns 401', async () => {
      const { status } = await patch(P, '/cart/items/P-RT-001', { body: { quantity: 5 } })
      assert.equal(status, 401)
    })

    test('updates item quantity', async () => {
      // Ensure item is in cart first
      await post(P, '/cart/items', { token, body: ITEM })
      const { status, body } = await patch(P, '/cart/items/P-RT-001', { token, body: { quantity: 5 } })
      assert.equal(status, 200)
      const item = body.items.find(i => i.productCode === 'P-RT-001')
      assert.equal(item.quantity, 5)
    })
  })

  describe('DELETE /cart/items/:productCode', () => {
    test('no token returns 401', async () => {
      const { status } = await del(P, '/cart/items/P-RT-001')
      assert.equal(status, 401)
    })

    test('removes item from cart', async () => {
      await post(P, '/cart/items', { token, body: ITEM })
      const { status, body } = await del(P, '/cart/items/P-RT-001', { token })
      assert.equal(status, 200)
      assert.ok(!body.items.some(i => i.productCode === 'P-RT-001'))
    })
  })

  describe('DELETE /cart', () => {
    test('clears the entire cart', async () => {
      await post(P, '/cart/items', { token, body: ITEM })
      const { status, body } = await del(P, '/cart', { token })
      assert.equal(status, 200)
      assert.deepEqual(body.items, [])
      assert.equal(body.total, 0)
    })
  })
})
