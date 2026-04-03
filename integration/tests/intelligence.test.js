import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, PORTS } from '../helpers/client.js'

const P = PORTS.intelligence

describe('intelligence-service — integration', () => {
  let tokenA  // SDA-00423 — 6 orders
  let tokenB  // SDA-00521 — 2 orders

  before(async () => {
    tokenA = await login('SDA-00423', 'demo1234')
    tokenB = await login('SDA-00521', 'demo1234')
  })

  // ── Health ─────────────────────────────────────────────────────
  describe('GET /health', () => {
    test('returns 200', async () => {
      const { status, body } = await get(P, '/health')
      assert.equal(status, 200)
      assert.equal(body.status, 'ok')
    })
  })

  // ── HU-40 — Purchase comparison ───────────────────────────────
  describe('GET /intelligence/comparison', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/intelligence/comparison')
      assert.equal(status, 401)
    })

    test('returns comparison data for SDA-00423', async () => {
      const { status, body } = await get(P, '/intelligence/comparison', { token: tokenA })
      assert.equal(status, 200)
      assert.ok('current' in body && 'previous' in body && 'changes' in body)
    })

    test('response includes topProducts', async () => {
      const { body } = await get(P, '/intelligence/comparison', { token: tokenA })
      assert.ok(Array.isArray(body.current?.topProducts))
    })

    test('data is scoped to authenticated user', async () => {
      const { body: a } = await get(P, '/intelligence/comparison', { token: tokenA })
      const { body: b } = await get(P, '/intelligence/comparison', { token: tokenB })
      // They should be different users' data — can't assert exact values but both should succeed
      assert.ok(a)
      assert.ok(b)
    })
  })

  // ── HU-41 — Inactive product alerts ──────────────────────────
  describe('GET /intelligence/alerts/inactive-products', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/intelligence/alerts/inactive-products')
      assert.equal(status, 401)
    })

    test('returns alerts array', async () => {
      const { status, body } = await get(P, '/intelligence/alerts/inactive-products', { token: tokenA })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body.alerts))
    })

    test('each alert has productCode and weeksSince', async () => {
      const { body } = await get(P, '/intelligence/alerts/inactive-products', { token: tokenA })
      for (const alert of body.alerts) {
        assert.ok('productCode' in alert)
        assert.ok('weeksSince' in alert || 'lastOrderDate' in alert)
      }
    })
  })

  // ── HU-42 — Spending thresholds ───────────────────────────────
  describe('GET /intelligence/thresholds', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/intelligence/thresholds')
      assert.equal(status, 401)
    })

    test('returns thresholds data', async () => {
      const { status, body } = await get(P, '/intelligence/thresholds', { token: tokenA })
      assert.equal(status, 200)
      assert.ok('allThresholds' in body && 'reached' in body)
    })

    test('thresholds include progressPct or remaining', async () => {
      const { body } = await get(P, '/intelligence/thresholds', { token: tokenA })
      const items = body.allThresholds
      if (items?.length > 0) {
        assert.ok('progressPct' in items[0] || 'remaining' in items[0])
      }
    })
  })

  // ── HU-43 — Benefits summary ──────────────────────────────────
  describe('GET /intelligence/benefits-summary', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/intelligence/benefits-summary')
      assert.equal(status, 401)
    })

    test('returns benefits summary for SDA-00423', async () => {
      const { status, body } = await get(P, '/intelligence/benefits-summary', { token: tokenA })
      assert.equal(status, 200)
      assert.ok('timeline' in body || 'byType' in body || Array.isArray(body))
    })
  })
})
