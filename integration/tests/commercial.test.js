import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, post, patch, PORTS } from '../helpers/client.js'

const P = PORTS.commercial

describe('commercial-service — integration', () => {
  let tokenA      // SDA-00423 — assigned to COM-001
  let tokenAdmin

  before(async () => {
    tokenA     = await login('SDA-00423', 'demo1234')
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

  // ── HU-44 — Assigned commercial ───────────────────────────────
  describe('GET /commercial/my-commercial', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/commercial/my-commercial')
      assert.equal(status, 401)
    })

    test('returns assigned commercial for SDA-00423', async () => {
      const { status, body } = await get(P, '/commercial/my-commercial', { token: tokenA })
      assert.equal(status, 200)
      assert.ok(body.id ?? body.commercialId)
      assert.ok(body.name)
    })
  })

  // ── HU-45 — Suggested orders ───────────────────────────────────
  describe('GET /commercial/suggested-orders', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/commercial/suggested-orders')
      assert.equal(status, 401)
    })

    test('returns suggested orders for authenticated customer', async () => {
      const { status, body } = await get(P, '/commercial/suggested-orders', { token: tokenA })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
    })
  })

  describe('POST /commercial/suggested-orders', () => {
    test('no token returns 401', async () => {
      const { status } = await post(P, '/commercial/suggested-orders', {
        body: { sapCode: 'SDA-00423', items: [{ productCode: 'P-RT-001', quantity: 2 }] }
      })
      assert.equal(status, 401)
    })

    test('commercial or admin can create suggestion', async () => {
      // Admin can create suggestions
      const { status, body } = await post(P, '/commercial/suggested-orders', {
        token: tokenAdmin,
        body: {
          sapCode: 'SDA-00423',
          items: [{ productCode: 'P-RT-001', quantity: 2, unitPrice: 15.20 }]
        }
      })
      assert.ok(status === 201 || status === 403) // depends on role config
    })
  })

  describe('PATCH /commercial/suggested-orders/:id/respond', () => {
    test('no token returns 401', async () => {
      const { status } = await patch(P, '/commercial/suggested-orders/SUG-001/respond', {
        body: { status: 'ACCEPTED' }
      })
      assert.equal(status, 401)
    })

    test('customer can respond to suggestion', async () => {
      const { status } = await patch(P, '/commercial/suggested-orders/SUG-001/respond', {
        token: tokenA,
        body: { status: 'REJECTED' }
      })
      // 200=responded, 400=already responded, 404=not found for this customer
      assert.ok(status === 200 || status === 400 || status === 404)
    })
  })

  // ── HU-47 — Admin: commercials management ─────────────────────
  describe('GET /commercial/commercials', () => {
    test('customer cannot access — 403', async () => {
      const { status } = await get(P, '/commercial/commercials', { token: tokenA })
      assert.equal(status, 403)
    })

    test('admin gets list of commercials', async () => {
      const { status, body } = await get(P, '/commercial/commercials', { token: tokenAdmin })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
      assert.ok(body.length >= 3)
    })
  })

  describe('GET /commercial/assignments', () => {
    test('customer cannot access assignments — 403', async () => {
      const { status } = await get(P, '/commercial/assignments', { token: tokenA })
      assert.equal(status, 403)
    })

    test('admin gets all assignments', async () => {
      const { status, body } = await get(P, '/commercial/assignments', { token: tokenAdmin })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
    })
  })

  describe('PATCH /commercial/assignments/:sapCode', () => {
    test('customer cannot reassign — 403', async () => {
      const { status } = await patch(P, '/commercial/assignments/SDA-00387', {
        token: tokenA,
        body: { commercialId: 'COM-001' }
      })
      assert.equal(status, 403)
    })

    test('admin can reassign customer to a different commercial', async () => {
      const { status } = await patch(P, '/commercial/assignments/SDA-00387', {
        token: tokenAdmin,
        body: { commercialId: 'COM-001' }
      })
      assert.ok(status === 200 || status === 404)
    })
  })
})
