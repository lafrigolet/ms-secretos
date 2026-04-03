import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, post, patch, PORTS } from '../helpers/client.js'

const P = PORTS.promotions

describe('promotions-service — integration', () => {
  let tokenPremium
  let tokenVip
  let tokenAdmin

  before(async () => {
    tokenPremium = await login('SDA-00423', 'demo1234')
    tokenVip     = await login('SDA-00521', 'demo1234')
    tokenAdmin   = await login('ADMIN-001', 'admin1234')
  })

  // ── Health ─────────────────────────────────────────────────────
  describe('GET /health', () => {
    test('returns 200', async () => {
      const { status, body } = await get(P, '/health')
      assert.equal(status, 200)
      assert.equal(body.status, 'ok')
    })
  })

  // ── HU-10 — GET /promotions ────────────────────────────────────
  describe('GET /promotions', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/promotions')
      assert.equal(status, 401)
    })

    test('returns promotions for PREMIUM', async () => {
      const { status, body } = await get(P, '/promotions', { token: tokenPremium })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
    })

    test('VIP sees VIP promotions', async () => {
      const { status, body } = await get(P, '/promotions', { token: tokenVip })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
      assert.ok(body.some(p => p.profiles?.includes('VIP') || p.targetProfiles?.includes('VIP')))
    })

    test('each promotion has id, name, type', async () => {
      const { body } = await get(P, '/promotions', { token: tokenPremium })
      for (const p of body) {
        assert.ok('id' in p || 'promoId' in p)
        assert.ok('name' in p || 'description' in p)
        assert.ok('type' in p)
      }
    })
  })

  // ── POST /promotions/calculate ─────────────────────────────────
  describe('POST /promotions/calculate', () => {
    test('no token returns 401', async () => {
      const { status } = await post(P, '/promotions/calculate', { body: { items: [], orderTotal: 0 } })
      assert.equal(status, 401)
    })

    test('order below threshold returns empty benefits', async () => {
      const { status, body } = await post(P, '/promotions/calculate', {
        token: tokenPremium,
        body: { items: [{ productCode: 'P-RT-001', quantity: 1 }], orderTotal: 15.20 }
      })
      assert.equal(status, 200)
      assert.ok('benefits' in body)
    })

    test('order above 100€ threshold returns benefits', async () => {
      const { status, body } = await post(P, '/promotions/calculate', {
        token: tokenVip,
        body: { items: [{ productCode: 'P-RT-001', quantity: 7 }], orderTotal: 100.80 }
      })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body.benefits))
    })
  })

  // ── HU-11 — Admin promotion management ────────────────────────
  describe('GET /promotions/admin', () => {
    test('customer cannot access admin — 403', async () => {
      const { status } = await get(P, '/promotions/admin', { token: tokenPremium })
      assert.equal(status, 403)
    })

    test('admin gets all promotions', async () => {
      const { status, body } = await get(P, '/promotions/admin', { token: tokenAdmin })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
      assert.ok(body.length >= 3)
    })
  })

  describe('POST /promotions/admin', () => {
    test('admin can create a promotion', async () => {
      const { status, body } = await post(P, '/promotions/admin', {
        token: tokenAdmin,
        body: {
          name: 'Integration Test Promo',
          type: 'DISCOUNT',
          profiles: ['STANDARD'],
          condition: { productCode: 'P-RT-001', minQuantity: 1 },
          benefit: { type: 'DISCOUNT', value: 5, unit: 'PERCENT' }
        }
      })
      assert.equal(status, 201)
      assert.ok(body.id || body.promoId)
    })

    test('customer cannot create promotions — 403', async () => {
      const { status } = await post(P, '/promotions/admin', {
        token: tokenPremium,
        body: {
          name: 'hack',
          type: 'DISCOUNT',
          profiles: ['VIP'],
          condition: { minOrderTotal: 1 },
          benefit: { type: 'DISCOUNT', value: 50, unit: 'PERCENT' }
        }
      })
      assert.equal(status, 403)
    })
  })
})
