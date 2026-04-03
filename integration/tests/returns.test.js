import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, post, patch, PORTS } from '../helpers/client.js'

const P = PORTS.returns

const RETURN_PAYLOAD = {
  orderId: 'SDA-2025-0812',
  items: [{ productCode: 'P-RT-001', quantity: 1, reason: 'DAMAGED' }],
  reason: 'DAMAGED',
  description: 'Integration test return'
}

describe('returns-service — integration', () => {
  let tokenA
  let tokenB
  let tokenAdmin

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

  // ── Return reasons (public) ────────────────────────────────────
  describe('GET /returns/reasons', () => {
    test('returns list of reasons without token', async () => {
      const { status, body } = await get(P, '/returns/reasons')
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
      assert.ok(body.length > 0)
    })

    test('includes DAMAGED reason', async () => {
      const { body } = await get(P, '/returns/reasons')
      assert.ok(body.some(r => r.code === 'DAMAGED' || r === 'DAMAGED'))
    })
  })

  // ── HU-33 — Customer returns list ─────────────────────────────
  describe('GET /returns', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/returns')
      assert.equal(status, 401)
    })

    test('returns list for SDA-00423', async () => {
      const { status, body } = await get(P, '/returns', { token: tokenA })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
    })

    test('returns are scoped to authenticated user', async () => {
      const { body: retA } = await get(P, '/returns', { token: tokenA })
      const { body: retB } = await get(P, '/returns', { token: tokenB })
      const idsA = retA.map(r => r.id ?? r.returnId)
      const idsB = retB.map(r => r.id ?? r.returnId)
      const overlap = idsA.filter(id => idsB.includes(id))
      assert.equal(overlap.length, 0)
    })
  })

  // ── HU-34 — Create return ─────────────────────────────────────
  describe('POST /returns', () => {
    test('no token returns 401', async () => {
      const { status } = await post(P, '/returns', { body: RETURN_PAYLOAD })
      assert.equal(status, 401)
    })

    test('creates a return', async () => {
      const { status, body } = await post(P, '/returns', { token: tokenA, body: RETURN_PAYLOAD })
      assert.equal(status, 201)
      assert.ok(body.id ?? body.returnId)
      assert.ok(body.status)
    })

    test('missing reason returns 400', async () => {
      const { status } = await post(P, '/returns', {
        token: tokenA,
        body: { orderId: 'SDA-2025-0812', items: [{ productCode: 'P-RT-001', quantity: 1 }] }
      })
      assert.equal(status, 400)
    })
  })

  // ── HU-33 — Return detail ─────────────────────────────────────
  describe('GET /returns/:id', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/returns/RET-2025-001')
      assert.equal(status, 401)
    })

    test('returns detail for RET-2025-001', async () => {
      const { status } = await get(P, '/returns/RET-2025-001', { token: tokenA })
      assert.ok(status === 200 || status === 404) // may have been mutated in prior test runs
    })

    test('customer B cannot access customer A return — 403 or 404', async () => {
      const { status } = await get(P, '/returns/RET-2025-001', { token: tokenB })
      assert.ok(status === 403 || status === 404)
    })
  })

  // ── Admin returns ──────────────────────────────────────────────
  describe('GET /admin/returns', () => {
    test('customer cannot access admin route — 403', async () => {
      const { status } = await get(P, '/admin/returns', { token: tokenA })
      assert.equal(status, 403)
    })

    test('admin gets all returns', async () => {
      const { status, body } = await get(P, '/admin/returns', { token: tokenAdmin })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
    })
  })

  describe('PATCH /admin/returns/:id', () => {
    test('customer cannot update return status — 403', async () => {
      const { status } = await patch(P, '/admin/returns/RET-2025-001', {
        token: tokenA,
        body: { status: 'APPROVED' }
      })
      assert.equal(status, 403)
    })

    test('admin can update return status', async () => {
      const { status } = await patch(P, '/admin/returns/RET-2025-001', {
        token: tokenAdmin,
        body: { status: 'REVIEWING' }
      })
      assert.ok(status === 200 || status === 404)
    })
  })
})
