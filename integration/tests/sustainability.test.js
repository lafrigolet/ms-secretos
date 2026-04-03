import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, post, PORTS } from '../helpers/client.js'

const P = PORTS.sustainability

describe('sustainability-service — integration', () => {
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

  // ── HU-53 — Product list ──────────────────────────────────────
  describe('GET /sustainability/products', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/sustainability/products')
      assert.equal(status, 401)
    })

    test('returns product list', async () => {
      const { status, body } = await get(P, '/sustainability/products', { token })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
      assert.ok(body.length > 0)
    })

    test('each product has code and sustainabilityScore', async () => {
      const { body } = await get(P, '/sustainability/products', { token })
      for (const p of body) {
        assert.ok('productCode' in p || 'code' in p)
        assert.ok('sustainabilityScore' in p || 'score' in p)
      }
    })
  })

  // ── HU-53 — Product detail ────────────────────────────────────
  describe('GET /sustainability/products/:productCode', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/sustainability/products/P-RT-001')
      assert.equal(status, 401)
    })

    test('returns sustainability detail for P-RT-001', async () => {
      const { status, body } = await get(P, '/sustainability/products/P-RT-001', { token })
      assert.equal(status, 200)
      assert.ok(body.productCode === 'P-RT-001' || body.code === 'P-RT-001')
      assert.ok(body.sustainabilityScore ?? body.score)
      assert.ok(Array.isArray(body.certifications) || Array.isArray(body.ingredients))
    })

    test('P-RT-001 score is 88', async () => {
      const { body } = await get(P, '/sustainability/products/P-RT-001', { token })
      assert.equal(body.sustainabilityScore ?? body.score, 88)
    })

    test('unknown product returns 404', async () => {
      const { status } = await get(P, '/sustainability/products/UNKNOWN', { token })
      assert.equal(status, 404)
    })
  })

  // ── HU-54 — Carbon footprint ──────────────────────────────────
  describe('POST /sustainability/carbon-footprint', () => {
    test('no token returns 401', async () => {
      const { status } = await post(P, '/sustainability/carbon-footprint', {
        body: { items: [{ productCode: 'P-RT-001', quantity: 1 }], shippingMethod: 'STANDARD' }
      })
      assert.equal(status, 401)
    })

    test('calculates carbon footprint', async () => {
      const { status, body } = await post(P, '/sustainability/carbon-footprint', {
        token,
        body: {
          items: [{ productCode: 'P-RT-001', quantity: 2 }],
          shippingMethod: 'STANDARD'
        }
      })
      assert.equal(status, 200)
      assert.ok(typeof body.co2Kg === 'number' || typeof body.carbonKg === 'number')
    })

    test('ECO shipping has lower carbon than EXPRESS', async () => {
      const payload = { items: [{ productCode: 'P-RT-001', quantity: 1 }] }
      const { body: eco }     = await post(P, '/sustainability/carbon-footprint', { token, body: { ...payload, shippingMethod: 'ECO' } })
      const { body: express } = await post(P, '/sustainability/carbon-footprint', { token, body: { ...payload, shippingMethod: 'EXPRESS' } })
      const ecoCarbon     = eco.co2Kg ?? eco.carbonKg
      const expressCarbon = express.co2Kg ?? express.carbonKg
      assert.ok(ecoCarbon < expressCarbon)
    })

    test('missing items returns 400', async () => {
      const { status } = await post(P, '/sustainability/carbon-footprint', {
        token,
        body: { shippingMethod: 'STANDARD' }
      })
      assert.equal(status, 400)
    })
  })
})
