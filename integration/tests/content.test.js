import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, patch, PORTS } from '../helpers/client.js'

const P = PORTS.content

describe('content-service — integration', () => {
  let tokenCustomer
  let tokenAdmin

  before(async () => {
    tokenCustomer = await login('SDA-00423', 'demo1234')
    tokenAdmin    = await login('ADMIN-001', 'admin1234')
  })

  // ── Health ─────────────────────────────────────────────────────
  describe('GET /health', () => {
    test('returns 200', async () => {
      const { status, body } = await get(P, '/health')
      assert.equal(status, 200)
      assert.equal(body.status, 'ok')
    })
  })

  // ── HU-36 — Datasheets ────────────────────────────────────────
  describe('GET /content/datasheets', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/content/datasheets')
      assert.equal(status, 401)
    })

    test('returns datasheets', async () => {
      const { status, body } = await get(P, '/content/datasheets', { token: tokenCustomer })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
      assert.ok(body.length > 0)
    })

    test('each datasheet has id, title', async () => {
      const { body } = await get(P, '/content/datasheets', { token: tokenCustomer })
      for (const ds of body) {
        assert.ok('id' in ds)
        assert.ok('title' in ds || 'name' in ds)
      }
    })

    test('filter by family works', async () => {
      const { body } = await get(P, '/content/datasheets?familyId=F01', { token: tokenCustomer })
      for (const ds of body) assert.equal(ds.familyId, 'F01')
    })
  })

  describe('GET /content/datasheets/:id', () => {
    test('returns DS-001 detail', async () => {
      const { status, body } = await get(P, '/content/datasheets/DS-001', { token: tokenCustomer })
      assert.equal(status, 200)
      assert.equal(body.id, 'DS-001')
    })

    test('unknown id returns 404', async () => {
      const { status } = await get(P, '/content/datasheets/DS-UNKNOWN', { token: tokenCustomer })
      assert.equal(status, 404)
    })
  })

  // ── HU-37 — Videos ────────────────────────────────────────────
  describe('GET /content/videos', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/content/videos')
      assert.equal(status, 401)
    })

    test('returns video list', async () => {
      const { status, body } = await get(P, '/content/videos', { token: tokenCustomer })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
      assert.ok(body.length > 0)
    })
  })

  describe('GET /content/videos/:id', () => {
    test('returns VID-001 detail', async () => {
      const { status, body } = await get(P, '/content/videos/VID-001', { token: tokenCustomer })
      assert.equal(status, 200)
      assert.equal(body.id, 'VID-001')
    })

    test('unknown id returns 404', async () => {
      const { status } = await get(P, '/content/videos/VID-UNKNOWN', { token: tokenCustomer })
      assert.equal(status, 404)
    })
  })

  // ── HU-38 — News ─────────────────────────────────────────────
  describe('GET /content/news', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/content/news')
      assert.equal(status, 401)
    })

    test('returns news list', async () => {
      const { status, body } = await get(P, '/content/news', { token: tokenCustomer })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
    })

    test('filter featured=true returns only featured', async () => {
      const { body } = await get(P, '/content/news?featured=true', { token: tokenCustomer })
      for (const n of body) assert.equal(n.featured, true)
    })

    test('filter featured=false returns only non-featured', async () => {
      const { body } = await get(P, '/content/news?featured=false', { token: tokenCustomer })
      for (const n of body) assert.equal(n.featured, false)
    })
  })

  // ── Admin content management ───────────────────────────────────
  describe('PATCH /admin/content/datasheets/:id', () => {
    test('customer cannot update content — 403', async () => {
      const { status } = await patch(P, '/admin/content/datasheets/DS-001', {
        token: tokenCustomer,
        body: { active: false }
      })
      assert.equal(status, 403)
    })

    test('admin can update datasheet', async () => {
      const { status } = await patch(P, '/admin/content/datasheets/DS-001', {
        token: tokenAdmin,
        body: { active: true }
      })
      assert.ok(status === 200 || status === 404)
    })
  })
})
