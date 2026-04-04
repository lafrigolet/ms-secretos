import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { subscriptionRoutes } from './routes/subscriptions.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret'

async function buildApp () {
  const app = Fastify({ logger: false })
  await app.register(corsPlugin)
  await app.register(jwtPlugin, { secret: process.env.JWT_SECRET })
  await app.register(swaggerPlugin, {
    openapi: {
      info: { title: 'test', version: '1.0.0' },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } }
    }
  })
  await app.register(swaggerUiPlugin, { routePrefix: '/docs' })
  registerAuthDecorators(app)
  app.setErrorHandler(errorHandler)
  await app.register(subscriptionRoutes, { prefix: '/subscriptions' })
  return app
}

const token = (app, sapCode = 'SDA-TEST-001', role = 'CUSTOMER') =>
  app.jwt.sign({ sub: sapCode, name: 'Test User', profile: 'STANDARD', role })
const adminToken = (app) =>
  app.jwt.sign({ sub: 'ADMIN-001', name: 'Admin', profile: 'ADMIN', role: 'ADMIN' })

// ══════════════════════════════════════════════════════════════════
// Plans
// ══════════════════════════════════════════════════════════════════
describe('GET /subscriptions/plans', () => {
  test('no token returns 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/subscriptions/plans' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('returns 3 active plans', async () => {
    const app = await buildApp()
    const tok = token(app)
    const res = await app.inject({ method: 'GET', url: '/subscriptions/plans', headers: { authorization: `Bearer ${tok}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.length, 3)
  })

  test('plans have required fields', async () => {
    const app = await buildApp()
    const tok = token(app)
    const res = await app.inject({ method: 'GET', url: '/subscriptions/plans', headers: { authorization: `Bearer ${tok}` } })
    for (const plan of res.json()) {
      assert.ok('id' in plan)
      assert.ok('name' in plan)
      assert.ok('price' in plan)
      assert.ok('currency' in plan)
      assert.ok('interval' in plan)
      assert.ok(Array.isArray(plan.features))
    }
  })

  test('includes plan-basic, plan-pro, plan-enterprise', async () => {
    const app = await buildApp()
    const tok = token(app)
    const res = await app.inject({ method: 'GET', url: '/subscriptions/plans', headers: { authorization: `Bearer ${tok}` } })
    const ids = res.json().map(p => p.id)
    assert.ok(ids.includes('plan-basic'))
    assert.ok(ids.includes('plan-pro'))
    assert.ok(ids.includes('plan-enterprise'))
  })
})

// ══════════════════════════════════════════════════════════════════
// Subscribe
// ══════════════════════════════════════════════════════════════════
describe('POST /subscriptions', () => {
  test('no token returns 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/subscriptions',
      payload: { planId: 'plan-basic' }
    })
    assert.equal(res.statusCode, 401)
  })

  test('missing planId returns 400', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-400')
    const res = await app.inject({
      method: 'POST', url: '/subscriptions',
      headers: { authorization: `Bearer ${tok}` },
      payload: {}
    })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json().error, 'VALIDATION_ERROR')
  })

  test('unknown plan returns 404', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-404P')
    const res = await app.inject({
      method: 'POST', url: '/subscriptions',
      headers: { authorization: `Bearer ${tok}` },
      payload: { planId: 'plan-nonexistent' }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'PLAN_NOT_FOUND')
  })

  test('subscribe to plan-basic returns 201 with subscription', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-SUB-001')
    const res = await app.inject({
      method: 'POST', url: '/subscriptions',
      headers: { authorization: `Bearer ${tok}` },
      payload: { planId: 'plan-basic' }
    })
    assert.equal(res.statusCode, 201)
    const body = res.json()
    assert.equal(body.sapCode, 'SDA-TEST-SUB-001')
    assert.equal(body.planId, 'plan-basic')
    assert.equal(body.status, 'ACTIVE')
    assert.ok('id' in body)
    assert.ok('currentPeriodStart' in body)
    assert.ok('currentPeriodEnd' in body)
  })

  test('duplicate subscription returns 409', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-DUP-001')
    await app.inject({
      method: 'POST', url: '/subscriptions',
      headers: { authorization: `Bearer ${tok}` },
      payload: { planId: 'plan-basic' }
    })
    const res = await app.inject({
      method: 'POST', url: '/subscriptions',
      headers: { authorization: `Bearer ${tok}` },
      payload: { planId: 'plan-pro' }
    })
    assert.equal(res.statusCode, 409)
    assert.equal(res.json().error, 'ALREADY_SUBSCRIBED')
  })
})

// ══════════════════════════════════════════════════════════════════
// Get current subscription
// ══════════════════════════════════════════════════════════════════
describe('GET /subscriptions/me', () => {
  test('no token returns 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/subscriptions/me' })
    assert.equal(res.statusCode, 401)
  })

  test('no subscription returns 404', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-NOSUB')
    const res = await app.inject({ method: 'GET', url: '/subscriptions/me', headers: { authorization: `Bearer ${tok}` } })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'NOT_FOUND')
  })

  test('returns subscription after subscribing', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-ME-001')
    await app.inject({
      method: 'POST', url: '/subscriptions',
      headers: { authorization: `Bearer ${tok}` },
      payload: { planId: 'plan-pro' }
    })
    const res = await app.inject({ method: 'GET', url: '/subscriptions/me', headers: { authorization: `Bearer ${tok}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().planId, 'plan-pro')
    assert.equal(res.json().status, 'ACTIVE')
  })
})

// ══════════════════════════════════════════════════════════════════
// Upgrade / downgrade
// ══════════════════════════════════════════════════════════════════
describe('PATCH /subscriptions/me', () => {
  test('no token returns 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/subscriptions/me', payload: { planId: 'plan-pro' } })
    assert.equal(res.statusCode, 401)
  })

  test('no subscription returns 404', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-PATCH-NOSUB')
    const res = await app.inject({
      method: 'PATCH', url: '/subscriptions/me',
      headers: { authorization: `Bearer ${tok}` },
      payload: { planId: 'plan-pro' }
    })
    assert.equal(res.statusCode, 404)
  })

  test('upgrades plan successfully', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-UPGRADE-001')
    await app.inject({
      method: 'POST', url: '/subscriptions',
      headers: { authorization: `Bearer ${tok}` },
      payload: { planId: 'plan-basic' }
    })
    const res = await app.inject({
      method: 'PATCH', url: '/subscriptions/me',
      headers: { authorization: `Bearer ${tok}` },
      payload: { planId: 'plan-enterprise' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().planId, 'plan-enterprise')
  })

  test('unknown plan returns 404', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-UPGRADE-002')
    await app.inject({
      method: 'POST', url: '/subscriptions',
      headers: { authorization: `Bearer ${tok}` },
      payload: { planId: 'plan-basic' }
    })
    const res = await app.inject({
      method: 'PATCH', url: '/subscriptions/me',
      headers: { authorization: `Bearer ${tok}` },
      payload: { planId: 'plan-unknown' }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'PLAN_NOT_FOUND')
  })
})

// ══════════════════════════════════════════════════════════════════
// Cancel
// ══════════════════════════════════════════════════════════════════
describe('DELETE /subscriptions/me', () => {
  test('no token returns 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/subscriptions/me' })
    assert.equal(res.statusCode, 401)
  })

  test('no subscription returns 404', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-DEL-NOSUB')
    const res = await app.inject({ method: 'DELETE', url: '/subscriptions/me', headers: { authorization: `Bearer ${tok}` } })
    assert.equal(res.statusCode, 404)
  })

  test('cancel sets status CANCELLED and cancelAtPeriodEnd true', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-CANCEL-001')
    await app.inject({
      method: 'POST', url: '/subscriptions',
      headers: { authorization: `Bearer ${tok}` },
      payload: { planId: 'plan-pro' }
    })
    const res = await app.inject({ method: 'DELETE', url: '/subscriptions/me', headers: { authorization: `Bearer ${tok}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.status, 'CANCELLED')
    assert.equal(body.cancelAtPeriodEnd, true)
  })
})

// ══════════════════════════════════════════════════════════════════
// Billing history
// ══════════════════════════════════════════════════════════════════
describe('GET /subscriptions/me/billing', () => {
  test('no token returns 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/subscriptions/me/billing' })
    assert.equal(res.statusCode, 401)
  })

  test('returns empty array before subscribing', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-BILLING-EMPTY')
    const res = await app.inject({ method: 'GET', url: '/subscriptions/me/billing', headers: { authorization: `Bearer ${tok}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.equal(res.json().length, 0)
  })

  test('returns billing record after subscribing', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-BILLING-001')
    await app.inject({
      method: 'POST', url: '/subscriptions',
      headers: { authorization: `Bearer ${tok}` },
      payload: { planId: 'plan-basic' }
    })
    const res = await app.inject({ method: 'GET', url: '/subscriptions/me/billing', headers: { authorization: `Bearer ${tok}` } })
    assert.equal(res.statusCode, 200)
    const records = res.json()
    assert.ok(records.length >= 1)
    assert.equal(records[0].sapCode, 'SDA-TEST-BILLING-001')
    assert.equal(records[0].amount, 29.99)
    assert.equal(records[0].status, 'PAID')
  })
})

// ══════════════════════════════════════════════════════════════════
// Payment method
// ══════════════════════════════════════════════════════════════════
describe('POST /subscriptions/me/payment-method', () => {
  test('no token returns 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/subscriptions/me/payment-method', payload: { paymentMethod: 'card_xyz' } })
    assert.equal(res.statusCode, 401)
  })

  test('no subscription returns 404', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-PM-NOSUB')
    const res = await app.inject({
      method: 'POST', url: '/subscriptions/me/payment-method',
      headers: { authorization: `Bearer ${tok}` },
      payload: { paymentMethod: 'card_xyz' }
    })
    assert.equal(res.statusCode, 404)
  })

  test('updates payment method', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-PM-001')
    await app.inject({
      method: 'POST', url: '/subscriptions',
      headers: { authorization: `Bearer ${tok}` },
      payload: { planId: 'plan-basic' }
    })
    const res = await app.inject({
      method: 'POST', url: '/subscriptions/me/payment-method',
      headers: { authorization: `Bearer ${tok}` },
      payload: { paymentMethod: 'card_new_4242' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().paymentMethod, 'card_new_4242')
  })
})

// ══════════════════════════════════════════════════════════════════
// Admin routes
// ══════════════════════════════════════════════════════════════════
describe('GET /subscriptions/admin', () => {
  test('no token returns 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/subscriptions/admin' })
    assert.equal(res.statusCode, 401)
  })

  test('customer role returns 403', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-ADMIN-403')
    const res = await app.inject({ method: 'GET', url: '/subscriptions/admin', headers: { authorization: `Bearer ${tok}` } })
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('admin returns list of subscriptions', async () => {
    const app = await buildApp()
    const tok = adminToken(app)
    const res = await app.inject({ method: 'GET', url: '/subscriptions/admin', headers: { authorization: `Bearer ${tok}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
  })
})

describe('GET /subscriptions/admin/:sapCode', () => {
  test('customer role returns 403', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-403')
    const res = await app.inject({ method: 'GET', url: '/subscriptions/admin/SDA-TEST-403', headers: { authorization: `Bearer ${tok}` } })
    assert.equal(res.statusCode, 403)
  })

  test('admin - not found returns 404', async () => {
    const app = await buildApp()
    const tok = adminToken(app)
    const res = await app.inject({ method: 'GET', url: '/subscriptions/admin/SDA-NONEXISTENT', headers: { authorization: `Bearer ${tok}` } })
    assert.equal(res.statusCode, 404)
  })

  test('admin can fetch subscription by sapCode', async () => {
    const app = await buildApp()
    const customerTok = token(app, 'SDA-TEST-ADMIN-FETCH')
    await app.inject({
      method: 'POST', url: '/subscriptions',
      headers: { authorization: `Bearer ${customerTok}` },
      payload: { planId: 'plan-enterprise' }
    })
    const tok = adminToken(app)
    const res = await app.inject({ method: 'GET', url: '/subscriptions/admin/SDA-TEST-ADMIN-FETCH', headers: { authorization: `Bearer ${tok}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().sapCode, 'SDA-TEST-ADMIN-FETCH')
    assert.equal(res.json().planId, 'plan-enterprise')
  })
})

describe('PATCH /subscriptions/admin/:sapCode', () => {
  test('customer role returns 403', async () => {
    const app = await buildApp()
    const tok = token(app, 'SDA-TEST-403B')
    const res = await app.inject({ method: 'PATCH', url: '/subscriptions/admin/SDA-TEST-403B', headers: { authorization: `Bearer ${tok}` }, payload: { planId: 'plan-pro' } })
    assert.equal(res.statusCode, 403)
  })

  test('admin can create subscription for new customer', async () => {
    const app = await buildApp()
    const tok = adminToken(app)
    const res = await app.inject({
      method: 'PATCH', url: '/subscriptions/admin/SDA-NEW-CUST',
      headers: { authorization: `Bearer ${tok}` },
      payload: { planId: 'plan-pro', status: 'TRIALING' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().sapCode, 'SDA-NEW-CUST')
    assert.equal(res.json().status, 'TRIALING')
  })

  test('admin override without planId for new customer returns 400', async () => {
    const app = await buildApp()
    const tok = adminToken(app)
    const res = await app.inject({
      method: 'PATCH', url: '/subscriptions/admin/SDA-NO-PLAN',
      headers: { authorization: `Bearer ${tok}` },
      payload: { status: 'ACTIVE' }
    })
    assert.equal(res.statusCode, 400)
  })
})

// ══════════════════════════════════════════════════════════════════
// Health
// ══════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  test('returns 200 with status ok', async () => {
    const app = await buildApp()
    app.get('/health', async () => ({ status: 'ok', service: 'sda-subscription-service' }))
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'ok')
  })
})
