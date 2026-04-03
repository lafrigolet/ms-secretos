import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, PORTS } from '../helpers/client.js'

const P = PORTS.invoices

describe('invoice-service — integration', () => {
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

  // ── HU-20 — Invoice list ───────────────────────────────────────
  describe('GET /invoices', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/invoices')
      assert.equal(status, 401)
    })

    test('returns invoices for SDA-00423', async () => {
      const { status, body } = await get(P, '/invoices', { token: tokenA })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
      assert.ok(body.length >= 2)
    })

    test('each invoice has invoiceId, total, date', async () => {
      const { body } = await get(P, '/invoices', { token: tokenA })
      for (const inv of body) {
        assert.ok('invoiceId' in inv || 'id' in inv)
        assert.ok('total' in inv)
        assert.ok('date' in inv || 'issuedAt' in inv || 'createdAt' in inv)
      }
    })

    test('invoices are scoped to authenticated user', async () => {
      const { body: invA } = await get(P, '/invoices', { token: tokenA })
      const { body: invB } = await get(P, '/invoices', { token: tokenB })
      const idsA = invA.map(i => i.invoiceId ?? i.id)
      const idsB = invB.map(i => i.invoiceId ?? i.id)
      const overlap = idsA.filter(id => idsB.includes(id))
      assert.equal(overlap.length, 0)
    })
  })

  // ── HU-20 — Invoice detail ────────────────────────────────────
  describe('GET /invoices/:invoiceId', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/invoices/FAC-2025-0890')
      assert.equal(status, 401)
    })

    test('returns detail for FAC-2025-0890', async () => {
      const { status, body } = await get(P, '/invoices/FAC-2025-0890', { token: tokenA })
      assert.equal(status, 200)
      assert.equal(body.invoiceId ?? body.id, 'FAC-2025-0890')
      assert.ok(Array.isArray(body.items) || Array.isArray(body.lines))
    })

    test('customer B cannot access customer A invoice — 403 or 404', async () => {
      const { status } = await get(P, '/invoices/FAC-2025-0890', { token: tokenB })
      assert.ok(status === 403 || status === 404)
    })

    test('unknown invoice returns 404', async () => {
      const { status } = await get(P, '/invoices/FAC-UNKNOWN', { token: tokenA })
      assert.equal(status, 404)
    })
  })

  // ── HU-20 — Download ──────────────────────────────────────────
  describe('GET /invoices/:invoiceId/download', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/invoices/FAC-2025-0890/download')
      assert.equal(status, 401)
    })

    test('returns download response for valid invoice', async () => {
      const { status } = await get(P, '/invoices/FAC-2025-0890/download', { token: tokenA })
      assert.ok(status === 200 || status === 302)
    })
  })
})
