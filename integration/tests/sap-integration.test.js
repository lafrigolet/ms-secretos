import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { get, post, PORTS } from '../helpers/client.js'

const P = PORTS.sap

// Internal service — called by other services, not by the frontend.
// Tests verify that the stub data matches what other services expect.

describe('sap-integration-service — integration', () => {

  // ── Health ─────────────────────────────────────────────────────
  describe('GET /health', () => {
    test('returns 200 with mode stub', async () => {
      const { status, body } = await get(P, '/health')
      assert.equal(status, 200)
      assert.equal(body.status, 'ok')
      assert.equal(body.mode, 'stub')
    })
  })

  // ── Customers ─────────────────────────────────────────────────
  describe('GET /internal/customers', () => {
    test('returns customer list', async () => {
      const { status, body } = await get(P, '/internal/customers')
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
      assert.ok(body.length >= 6)
    })
  })

  describe('GET /internal/customers/:sapCode', () => {
    test('returns SDA-00423 with profile PREMIUM', async () => {
      const { status, body } = await get(P, '/internal/customers/SDA-00423')
      assert.equal(status, 200)
      assert.equal(body.sapCode, 'SDA-00423')
      assert.equal(body.profile, 'PREMIUM')
      assert.equal(body.status, 'ACTIVE')
    })

    test('returns SDA-00187 as BLOCKED with reason DEBT', async () => {
      const { body } = await get(P, '/internal/customers/SDA-00187')
      assert.equal(body.status, 'BLOCKED')
      assert.equal(body.blockReason, 'DEBT')
    })

    test('unknown customer returns 404', async () => {
      const { status } = await get(P, '/internal/customers/UNKNOWN-000')
      assert.equal(status, 404)
    })
  })

  describe('POST /internal/customers/verify', () => {
    test('correct credentials return customer data', async () => {
      const { status, body } = await post(P, '/internal/customers/verify', {
        body: { sapCode: 'SDA-00423', password: 'demo1234' }
      })
      assert.equal(status, 200)
      assert.equal(body.sapCode, 'SDA-00423')
    })

    test('wrong password returns 200 with status WRONG_PASSWORD', async () => {
      const { status, body } = await post(P, '/internal/customers/verify', {
        body: { sapCode: 'SDA-00423', password: 'wrongpassword' }
      })
      assert.equal(status, 200)
      assert.equal(body.status, 'WRONG_PASSWORD')
    })

    test('blocked account returns 200 with status BLOCKED and blockReason', async () => {
      const { status, body } = await post(P, '/internal/customers/verify', {
        body: { sapCode: 'SDA-00187', password: 'demo1234' }
      })
      assert.equal(status, 200)
      assert.equal(body.status, 'BLOCKED')
      assert.ok(body.blockReason)
    })
  })

  // ── Catalog ────────────────────────────────────────────────────
  describe('GET /internal/catalog/families', () => {
    test('returns 3 families', async () => {
      const { status, body } = await get(P, '/internal/catalog/families')
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
      assert.equal(body.length, 3)
    })
  })

  describe('GET /internal/catalog/products', () => {
    test('returns product catalog', async () => {
      const { status, body } = await get(P, '/internal/catalog/products')
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
      assert.ok(body.length > 0)
    })

    test('each product has code, name, familyId', async () => {
      const { body } = await get(P, '/internal/catalog/products')
      for (const p of body) {
        assert.ok('code' in p || 'sapCode' in p)
        assert.ok('name' in p)
        assert.ok('familyId' in p)
      }
    })
  })
})
