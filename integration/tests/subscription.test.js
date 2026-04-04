import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, post, patch, del, PORTS } from '../helpers/client.js'

const P = PORTS.subscriptions

describe('subscription-service — integration', () => {
  let tokenCustomer
  let tokenAdmin
  let tokenOther

  before(async () => {
    tokenCustomer = await login('SDA-00423', 'demo1234')
    tokenAdmin    = await login('SDA-ADMIN-001', 'admin1234')
    tokenOther    = await login('SDA-00521', 'demo1234')
  })

  // ── Plans ─────────────────────────────────────────────────────────
  describe('GET /subscriptions/plans', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/subscriptions/plans')
      assert.equal(status, 401)
    })

    test('returns 3 active plans', async () => {
      const { status, body } = await get(P, '/subscriptions/plans', { token: tokenCustomer })
      assert.equal(status, 200)
      assert.equal(body.length, 3)
    })

    test('plans include basic, pro, enterprise', async () => {
      const { body } = await get(P, '/subscriptions/plans', { token: tokenCustomer })
      const ids = body.map(p => p.id)
      assert.ok(ids.includes('plan-basic'))
      assert.ok(ids.includes('plan-pro'))
      assert.ok(ids.includes('plan-enterprise'))
    })

    test('each plan has price and features', async () => {
      const { body } = await get(P, '/subscriptions/plans', { token: tokenCustomer })
      for (const plan of body) {
        assert.ok(typeof plan.price === 'number')
        assert.ok(Array.isArray(plan.features))
        assert.ok(plan.features.length > 0)
      }
    })
  })

  // ── Subscribe ─────────────────────────────────────────────────────
  describe('POST /subscriptions', () => {
    test('no token returns 401', async () => {
      const { status } = await post(P, '/subscriptions', { body: { planId: 'plan-basic' } })
      assert.equal(status, 401)
    })

    test('missing planId returns 400', async () => {
      const { status, body } = await post(P, '/subscriptions', { token: tokenOther, body: {} })
      assert.equal(status, 400)
      assert.equal(body.error, 'VALIDATION_ERROR')
    })

    test('unknown plan returns 404', async () => {
      const { status, body } = await post(P, '/subscriptions', { token: tokenOther, body: { planId: 'plan-nonexistent' } })
      assert.equal(status, 404)
      assert.equal(body.error, 'PLAN_NOT_FOUND')
    })

    test('SDA-00423 subscribes to plan-pro', async () => {
      // Cancel first if already subscribed from a previous run
      await del(P, '/subscriptions/me', { token: tokenCustomer })

      const { status, body } = await post(P, '/subscriptions', { token: tokenCustomer, body: { planId: 'plan-pro' } })
      assert.ok([201, 409].includes(status), `unexpected status ${status}`)
      if (status === 201) {
        assert.equal(body.planId, 'plan-pro')
        assert.equal(body.status, 'ACTIVE')
        assert.equal(body.sapCode, 'SDA-00423')
      }
    })
  })

  // ── Get current subscription ──────────────────────────────────────
  describe('GET /subscriptions/me', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/subscriptions/me')
      assert.equal(status, 401)
    })

    test('returns subscription for SDA-00423', async () => {
      const { status, body } = await get(P, '/subscriptions/me', { token: tokenCustomer })
      assert.ok([200, 404].includes(status))
      if (status === 200) {
        assert.equal(body.sapCode, 'SDA-00423')
        assert.ok('planId' in body)
        assert.ok('status' in body)
      }
    })
  })

  // ── Upgrade / downgrade ───────────────────────────────────────────
  describe('PATCH /subscriptions/me', () => {
    test('no token returns 401', async () => {
      const { status } = await patch(P, '/subscriptions/me', { body: { planId: 'plan-enterprise' } })
      assert.equal(status, 401)
    })

    test('upgrade SDA-00521 from basic to enterprise', async () => {
      // Ensure SDA-00521 has a subscription first
      await del(P, '/subscriptions/me', { token: tokenOther })
      await post(P, '/subscriptions', { token: tokenOther, body: { planId: 'plan-basic' } })

      const { status, body } = await patch(P, '/subscriptions/me', { token: tokenOther, body: { planId: 'plan-enterprise' } })
      assert.equal(status, 200)
      assert.equal(body.planId, 'plan-enterprise')
    })

    test('unknown plan returns 404', async () => {
      const { status } = await patch(P, '/subscriptions/me', { token: tokenOther, body: { planId: 'plan-bogus' } })
      assert.equal(status, 404)
    })
  })

  // ── Billing history ───────────────────────────────────────────────
  describe('GET /subscriptions/me/billing', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/subscriptions/me/billing')
      assert.equal(status, 401)
    })

    test('returns billing records array', async () => {
      const { status, body } = await get(P, '/subscriptions/me/billing', { token: tokenOther })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
    })

    test('billing record has required fields', async () => {
      const { body } = await get(P, '/subscriptions/me/billing', { token: tokenOther })
      if (body.length > 0) {
        const record = body[0]
        assert.ok('id' in record)
        assert.ok('amount' in record)
        assert.ok('currency' in record)
        assert.ok('status' in record)
        assert.ok('createdAt' in record)
      }
    })
  })

  // ── Payment method ────────────────────────────────────────────────
  describe('POST /subscriptions/me/payment-method', () => {
    test('no token returns 401', async () => {
      const { status } = await post(P, '/subscriptions/me/payment-method', { body: { paymentMethod: 'card_xyz' } })
      assert.equal(status, 401)
    })

    test('updates payment method on active subscription', async () => {
      const { status, body } = await post(P, '/subscriptions/me/payment-method', {
        token: tokenOther,
        body: { paymentMethod: 'card_updated_9999' }
      })
      assert.equal(status, 200)
      assert.equal(body.paymentMethod, 'card_updated_9999')
    })
  })

  // ── Cancel ────────────────────────────────────────────────────────
  describe('DELETE /subscriptions/me', () => {
    test('no token returns 401', async () => {
      const { status } = await del(P, '/subscriptions/me')
      assert.equal(status, 401)
    })

    test('cancel sets status to CANCELLED', async () => {
      const { status, body } = await del(P, '/subscriptions/me', { token: tokenOther })
      assert.ok([200, 404].includes(status))
      if (status === 200) {
        assert.equal(body.status, 'CANCELLED')
        assert.equal(body.cancelAtPeriodEnd, true)
      }
    })
  })

  // ── Admin ─────────────────────────────────────────────────────────
  describe('GET /subscriptions/admin', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/subscriptions/admin')
      assert.equal(status, 401)
    })

    test('customer role returns 403', async () => {
      const { status, body } = await get(P, '/subscriptions/admin', { token: tokenCustomer })
      assert.equal(status, 403)
      assert.equal(body.error, 'FORBIDDEN')
    })

    test('admin returns all subscriptions list', async () => {
      const { status, body } = await get(P, '/subscriptions/admin', { token: tokenAdmin })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
    })
  })

  describe('GET /subscriptions/admin/:sapCode', () => {
    test('customer role returns 403', async () => {
      const { status } = await get(P, '/subscriptions/admin/SDA-00423', { token: tokenCustomer })
      assert.equal(status, 403)
    })

    test('admin - unknown customer returns 404', async () => {
      const { status } = await get(P, '/subscriptions/admin/SDA-UNKNOWN-9999', { token: tokenAdmin })
      assert.equal(status, 404)
    })
  })

  describe('PATCH /subscriptions/admin/:sapCode', () => {
    test('customer role returns 403', async () => {
      const { status } = await patch(P, '/subscriptions/admin/SDA-00423', { token: tokenCustomer, body: { planId: 'plan-pro' } })
      assert.equal(status, 403)
    })

    test('admin can grant subscription to customer', async () => {
      const { status, body } = await patch(P, '/subscriptions/admin/SDA-00387', {
        token: tokenAdmin,
        body: { planId: 'plan-enterprise', status: 'TRIALING' }
      })
      assert.equal(status, 200)
      assert.equal(body.sapCode, 'SDA-00387')
      assert.equal(body.status, 'TRIALING')
    })

    test('admin override without planId for new customer returns 400', async () => {
      const { status } = await patch(P, '/subscriptions/admin/SDA-BRAND-NEW', {
        token: tokenAdmin,
        body: { status: 'ACTIVE' }
      })
      assert.equal(status, 400)
    })
  })

  // ── Health ────────────────────────────────────────────────────────
  describe('GET /health', () => {
    test('returns 200 with status ok', async () => {
      const { status, body } = await get(P, '/health')
      assert.equal(status, 200)
      assert.equal(body.status, 'ok')
    })
  })
})
