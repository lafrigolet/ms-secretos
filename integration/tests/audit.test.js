import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, post, PORTS } from '../helpers/client.js'

const P = PORTS.audit

describe('audit-service — integration', () => {
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

  // ── HU-22 — POST /audit (public) ──────────────────────────────
  describe('POST /audit', () => {
    test('records a valid event without token', async () => {
      const { status, body } = await post(P, '/audit', {
        body: { sapCode: 'SDA-00423', action: 'LOGIN', details: { ip: '127.0.0.1' } }
      })
      assert.equal(status, 201)
      assert.ok(body.id ?? body.auditId)
    })

    test('missing action returns 400', async () => {
      const { status } = await post(P, '/audit', {
        body: { sapCode: 'SDA-00423' }
      })
      assert.equal(status, 400)
    })

    test('missing sapCode returns 400', async () => {
      const { status } = await post(P, '/audit', {
        body: { action: 'LOGIN' }
      })
      assert.equal(status, 400)
    })

    test('invalid action returns 400', async () => {
      const { status } = await post(P, '/audit', {
        body: { sapCode: 'SDA-00423', action: 'NOT_A_REAL_ACTION' }
      })
      assert.equal(status, 400)
    })
  })

  // ── GET /audit — admin only ────────────────────────────────────
  describe('GET /audit', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/audit')
      assert.equal(status, 401)
    })

    test('customer cannot access audit log — 403', async () => {
      const { status } = await get(P, '/audit', { token: tokenCustomer })
      assert.equal(status, 403)
    })

    test('admin can read audit log', async () => {
      const { status, body } = await get(P, '/audit', { token: tokenAdmin })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
    })

    test('audit log includes the event we just posted', async () => {
      await post(P, '/audit', { body: { sapCode: 'SDA-INTTEST', action: 'ORDER_CREATED' } })
      const { body } = await get(P, '/audit', { token: tokenAdmin })
      assert.ok(body.some(e => e.sapCode === 'SDA-INTTEST'))
    })

    test('filter by sapCode works', async () => {
      const { body } = await get(P, '/audit?sapCode=SDA-INTTEST', { token: tokenAdmin })
      assert.ok(Array.isArray(body))
      for (const e of body) assert.equal(e.sapCode, 'SDA-INTTEST')
    })
  })

  // ── GET /audit/stats ──────────────────────────────────────────
  describe('GET /audit/stats', () => {
    test('customer cannot access stats — 403', async () => {
      const { status } = await get(P, '/audit/stats', { token: tokenCustomer })
      assert.equal(status, 403)
    })

    test('admin gets stats with total, byAction, uniqueUsers', async () => {
      const { status, body } = await get(P, '/audit/stats', { token: tokenAdmin })
      assert.equal(status, 200)
      assert.ok(typeof body.total === 'number')
      assert.ok(body.byAction)
      assert.ok(typeof body.uniqueUsers === 'number')
    })
  })
})
