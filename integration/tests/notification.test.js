import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, post, PORTS } from '../helpers/client.js'

const P = PORTS.notifications

describe('notification-service — integration', () => {
  let tokenAdmin

  before(async () => {
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

  // ── HU-17 — Order confirmation (public endpoint) ───────────────
  describe('POST /notifications/order-confirmed', () => {
    test('sends notification without token', async () => {
      const { status, body } = await post(P, '/notifications/order-confirmed', {
        body: {
          order: { orderId: 'SDA-INT-0001', total: 100.00 },
          user:  { sub: 'SDA-00423', name: 'Rosa Canals', email: 'rosa@test.com' }
        }
      })
      assert.equal(status, 201)
      assert.ok(body.id)
      assert.ok(body.status)
    })

    test('missing order field returns 400', async () => {
      const { status } = await post(P, '/notifications/order-confirmed', {
        body: { user: { sub: 'SDA-00423' } }
      })
      assert.equal(status, 400)
    })

    test('missing user field returns 400', async () => {
      const { status } = await post(P, '/notifications/order-confirmed', {
        body: { order: { orderId: 'SDA-INT-0002', total: 50 } }
      })
      assert.equal(status, 400)
    })

    test('notification id is unique per request', async () => {
      const payload = {
        order: { orderId: 'SDA-INT-0003', total: 50 },
        user:  { sub: 'SDA-00423' }
      }
      const { body: b1 } = await post(P, '/notifications/order-confirmed', { body: payload })
      const { body: b2 } = await post(P, '/notifications/order-confirmed', { body: payload })
      assert.notEqual(b1.id, b2.id)
    })
  })

  // ── Notification history — admin only ──────────────────────────
  describe('GET /notifications', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/notifications')
      assert.equal(status, 401)
    })

    test('admin can view notification history', async () => {
      const { status, body } = await get(P, '/notifications', { token: tokenAdmin })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
    })
  })
})
