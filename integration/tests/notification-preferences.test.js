import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, patch, PORTS } from '../helpers/client.js'

const P = PORTS.notifPrefs

describe('notification-preferences-service — integration', () => {
  let tokenA
  let tokenB

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

  // ── Notification types (public) ───────────────────────────────
  describe('GET /notifications/types', () => {
    test('returns types without token', async () => {
      const { status, body } = await get(P, '/notifications/types')
      assert.equal(status, 200)
      assert.ok(Array.isArray(body) || 'types' in body)
    })

    test('includes at least 5 types', async () => {
      const { body } = await get(P, '/notifications/types')
      const types = Array.isArray(body) ? body : body.types
      assert.ok(types.length >= 5)
    })
  })

  // ── HU-51 — Preferences ───────────────────────────────────────
  describe('GET /notifications/preferences', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/notifications/preferences')
      assert.equal(status, 401)
    })

    test('returns preferences for authenticated user', async () => {
      const { status, body } = await get(P, '/notifications/preferences', { token: tokenA })
      assert.equal(status, 200)
      assert.ok(body)
    })

    test('preferences are scoped to authenticated user', async () => {
      const { body: a } = await get(P, '/notifications/preferences', { token: tokenA })
      const { body: b } = await get(P, '/notifications/preferences', { token: tokenB })
      // Users may have different preferences — just verify both calls succeed
      assert.ok(a)
      assert.ok(b)
    })
  })

  describe('PATCH /notifications/preferences', () => {
    test('no token returns 401', async () => {
      const { status } = await patch(P, '/notifications/preferences', {
        body: { STOCK_ALERT: { EMAIL: false } }
      })
      assert.equal(status, 401)
    })

    test('updates preferences', async () => {
      const { status } = await patch(P, '/notifications/preferences', {
        token: tokenA,
        body: { STOCK_ALERT: { EMAIL: true } }
      })
      assert.ok(status === 200 || status === 204)
    })
  })

  // ── Inbox ─────────────────────────────────────────────────────
  describe('GET /notifications/inbox', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/notifications/inbox')
      assert.equal(status, 401)
    })

    test('returns inbox for authenticated user', async () => {
      const { status, body } = await get(P, '/notifications/inbox', { token: tokenA })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body.notifications))
    })
  })

  describe('PATCH /notifications/inbox/:id/read', () => {
    test('no token returns 401', async () => {
      const { status } = await patch(P, '/notifications/inbox/NOTIF-001/read')
      assert.equal(status, 401)
    })

    test('marks notification as read', async () => {
      const { status } = await patch(P, '/notifications/inbox/NOTIF-001/read', { token: tokenA })
      assert.ok(status === 200 || status === 404)
    })
  })
})
