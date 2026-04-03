import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, patch, PORTS } from '../helpers/client.js'

const P = PORTS.catalog

// Stub prices from sap-integration-service stubData.js
const STUB_PRICES = {
  STANDARD: { 'P-RT-001': 18.50, 'P-RT-002': 22.00, 'P-RT-003': 55.00, 'P-SN-001': 15.00, 'P-SN-002': 14.00, 'P-BN-001': 24.00 },
  PREMIUM:  { 'P-RT-001': 16.00, 'P-RT-002': 19.00, 'P-RT-003': 48.00, 'P-SN-001': 13.00, 'P-SN-002': 12.00, 'P-BN-001': 21.00 },
  VIP:      { 'P-RT-001': 14.50, 'P-RT-002': 17.00, 'P-RT-003': 43.00, 'P-SN-001': 11.50, 'P-SN-002': 10.50, 'P-BN-001': 18.50 },
}

describe('catalog-service — integration', () => {
  let tokenPremium
  let tokenVip
  let tokenStandard

  before(async () => {
    // Reset SDA-00387 to STANDARD in case a prior test run mutated it
    await patch(PORTS.sap, '/internal/customers/SDA-00387', { body: { profile: 'STANDARD' } })
    tokenPremium  = await login('SDA-00423', 'demo1234')
    tokenVip      = await login('SDA-00521', 'demo1234')
    tokenStandard = await login('SDA-00387', 'demo1234')
  })

  // ── HU-07 — Families ──────────────────────────────────────────
  describe('GET /catalog/families', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/catalog/families')
      assert.equal(status, 401)
    })

    test('returns 3 families', async () => {
      const { status, body } = await get(P, '/catalog/families', { token: tokenPremium })
      assert.equal(status, 200)
      assert.equal(body.length, 3)
    })

    test('each family has id, name, description', async () => {
      const { body } = await get(P, '/catalog/families', { token: tokenPremium })
      for (const f of body) {
        assert.ok('id' in f)
        assert.ok('name' in f)
        assert.ok('description' in f)
      }
    })

    test('includes F01, F02, F03', async () => {
      const { body } = await get(P, '/catalog/families', { token: tokenPremium })
      const ids = body.map(f => f.id)
      assert.ok(ids.includes('F01'))
      assert.ok(ids.includes('F02'))
      assert.ok(ids.includes('F03'))
    })
  })

  // ── HU-08 — Products ──────────────────────────────────────────
  describe('GET /catalog/products', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/catalog/products')
      assert.equal(status, 401)
    })

    test('returns product list', async () => {
      const { status, body } = await get(P, '/catalog/products', { token: tokenPremium })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
      assert.ok(body.length > 0)
    })

    test('each product has sapCode, name, familyId, price, stock', async () => {
      const { body } = await get(P, '/catalog/products', { token: tokenPremium })
      for (const p of body) {
        assert.ok('sapCode' in p)
        assert.ok('name' in p)
        assert.ok('familyId' in p)
        assert.ok('price' in p)
        assert.ok('stock' in p)
      }
    })

    test('PREMIUM price for P-RT-001 is 16.00', async () => {
      const { body } = await get(P, '/catalog/products', { token: tokenPremium })
      const p = body.find(x => x.sapCode === 'P-RT-001')
      assert.ok(p)
      assert.equal(p.price, STUB_PRICES.PREMIUM['P-RT-001'])
    })

    test('VIP price for P-RT-001 is lower than PREMIUM', async () => {
      const { body: bodyVip }     = await get(P, '/catalog/products', { token: tokenVip })
      const { body: bodyPremium } = await get(P, '/catalog/products', { token: tokenPremium })
      const vipPrice     = bodyVip.find(x => x.sapCode === 'P-RT-001')?.price
      const premiumPrice = bodyPremium.find(x => x.sapCode === 'P-RT-001')?.price
      assert.ok(vipPrice < premiumPrice)
    })

    test('STANDARD price is highest', async () => {
      const { body } = await get(P, '/catalog/products', { token: tokenStandard })
      const p = body.find(x => x.sapCode === 'P-RT-001')
      assert.equal(p.price, STUB_PRICES.STANDARD['P-RT-001'])
    })

    test('filter by familyId returns only matching products', async () => {
      const { status, body } = await get(P, '/catalog/products?familyId=F01', { token: tokenPremium })
      assert.equal(status, 200)
      for (const p of body) assert.equal(p.familyId, 'F01')
    })

    test('P-RT-002 has stock > 0', async () => {
      const { body } = await get(P, '/catalog/products', { token: tokenPremium })
      const p = body.find(x => x.sapCode === 'P-RT-002')
      assert.ok(p.stock > 0)
    })
  })

  // ── HU-09 — Product detail ────────────────────────────────────
  describe('GET /catalog/products/:sapCode', () => {
    test('returns detail for P-RT-001', async () => {
      const { status, body } = await get(P, '/catalog/products/P-RT-001', { token: tokenPremium })
      assert.equal(status, 200)
      assert.equal(body.sapCode, 'P-RT-001')
      assert.ok(body.price)
    })

    test('unknown product returns 404', async () => {
      const { status } = await get(P, '/catalog/products/UNKNOWN-CODE', { token: tokenPremium })
      assert.equal(status, 404)
    })

    test('no token returns 401', async () => {
      const { status } = await get(P, '/catalog/products/P-RT-001')
      assert.equal(status, 401)
    })
  })
})
