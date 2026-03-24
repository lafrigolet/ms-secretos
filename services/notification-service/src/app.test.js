import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { notificationRoutes } from './routes/notifications.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

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
  await app.register(notificationRoutes, { prefix: '/notifications' })
  return app
}

const adminToken = (app) => app.jwt.sign({ sub: 'ADMIN-001', role: 'ADMIN' })
const customerToken = (app, sub = 'SDA-00423') => app.jwt.sign({ sub, role: 'CUSTOMER' })
const expiredToken = (app) =>
  app.jwt.sign({ sub: 'EXP-USER', role: 'CUSTOMER', exp: Math.floor(Date.now() / 1000) - 3600 })

const order = { orderId: 'SDA-2025-9999', total: 96.00 }
const user  = { sub: 'SDA-00423', name: 'Rosa Canals', email: 'rosa@test.com' }

// ══════════════════════════════════════════════════════════════════
// NOTE: SENT is module-level — accumulates across all buildApp()
// calls within a run. History count assertions use >= instead of ===.
// ══════════════════════════════════════════════════════════════════

describe('HU-17 — Confirmación de pedido por email', () => {
  test('envía notificación de confirmación', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/order-confirmed',
      payload: { order, user }
    })
    assert.equal(res.statusCode, 201)
    const body = res.json()
    assert.ok(body.id)
    assert.equal(body.status, 'SENT')
    assert.ok(body.subject.includes(order.orderId))
    assert.equal(body.to, user.email)
  })

  test('id de notificación empieza por NOTIF-', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/notifications/order-confirmed', payload: { order, user } })
    assert.ok(res.json().id.startsWith('NOTIF-'))
  })

  test('sentAt es una fecha ISO válida', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/notifications/order-confirmed', payload: { order, user } })
    const sentAt = res.json().sentAt
    assert.ok(sentAt)
    assert.ok(!isNaN(Date.parse(sentAt)))
  })

  test('subject contiene el orderId', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/order-confirmed',
      payload: { order: { orderId: 'SDA-2025-1234', total: 50 }, user }
    })
    assert.ok(res.json().subject.includes('SDA-2025-1234'))
  })

  test('to usa email del usuario cuando está disponible', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/order-confirmed',
      payload: { order, user: { sub: 'SDA-00387', name: 'Luis', email: 'luis@example.com' } }
    })
    assert.equal(res.json().to, 'luis@example.com')
  })

  test('to usa sub@secretosdelagua.com cuando no hay email', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/order-confirmed',
      payload: { order, user: { sub: 'SDA-00521', name: 'Marta' } }
    })
    assert.equal(res.json().to, 'SDA-00521@secretosdelagua.com')
  })

  test('status de notificación siempre es SENT', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/notifications/order-confirmed', payload: { order, user } })
    assert.equal(res.json().status, 'SENT')
  })

  test('body contiene el orderId del pedido', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/order-confirmed',
      payload: { order: { orderId: 'SDA-2025-7777', total: 120 }, user }
    })
    assert.ok(res.json().body.includes('SDA-2025-7777'))
  })

  test('body contiene el total del pedido', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/order-confirmed',
      payload: { order: { orderId: 'SDA-2025-8888', total: 75.50 }, user }
    })
    assert.ok(res.json().body.includes('75.5'))
  })

  test('endpoint es público — funciona sin token', async () => {
    const app = await buildApp()
    // No Authorization header — should still return 201
    const res = await app.inject({ method: 'POST', url: '/notifications/order-confirmed', payload: { order, user } })
    assert.equal(res.statusCode, 201)
  })

  test('notificación sin body devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/notifications/order-confirmed', payload: {} })
    assert.equal(res.statusCode, 400)
  })

  test('400 devuelve error VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/notifications/order-confirmed', payload: {} })
    assert.equal(res.json().error, 'VALIDATION_ERROR')
  })

  test('sin campo order → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/notifications/order-confirmed', payload: { user } })
    assert.equal(res.statusCode, 400)
  })

  test('sin campo user → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/notifications/order-confirmed', payload: { order } })
    assert.equal(res.statusCode, 400)
  })

  test('se pueden enviar varias notificaciones para distintos pedidos', async () => {
    const app = await buildApp()
    const res1 = await app.inject({ method: 'POST', url: '/notifications/order-confirmed', payload: { order: { orderId: 'SDA-A', total: 10 }, user } })
    const res2 = await app.inject({ method: 'POST', url: '/notifications/order-confirmed', payload: { order: { orderId: 'SDA-B', total: 20 }, user } })
    assert.equal(res1.statusCode, 201)
    assert.equal(res2.statusCode, 201)
    assert.notEqual(res1.json().id, res2.json().id)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('GET /notifications — Historial (admin)', () => {
  test('historial de notificaciones visible para admin', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/notifications/order-confirmed', payload: { order, user } })
    const res = await app.inject({
      method: 'GET', url: '/notifications',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().length > 0)
  })

  test('historial es un array', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.ok(Array.isArray(res.json()))
  })

  test('cada notificación tiene id, to, subject, body, sentAt, status', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/notifications/order-confirmed', payload: { order, user } })
    const res = await app.inject({ method: 'GET', url: '/notifications', headers: { authorization: `Bearer ${adminToken(app)}` } })
    const notif = res.json()[0]
    assert.ok('id' in notif)
    assert.ok('to' in notif)
    assert.ok('subject' in notif)
    assert.ok('body' in notif)
    assert.ok('sentAt' in notif)
    assert.ok('status' in notif)
  })

  test('notificación enviada aparece en el historial', async () => {
    const app = await buildApp()
    const sendRes = await app.inject({
      method: 'POST', url: '/notifications/order-confirmed',
      payload: { order: { orderId: 'SDA-HIST-CHECK', total: 30 }, user }
    })
    const sentId = sendRes.json().id
    const histRes = await app.inject({ method: 'GET', url: '/notifications', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.ok(histRes.json().some(n => n.id === sentId))
  })

  test('historial no accesible para clientes — 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/notifications',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 403)
  })

  test('403 devuelve error FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/notifications',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications', headers: { authorization: 'Bearer bad.token.here' } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })
})
