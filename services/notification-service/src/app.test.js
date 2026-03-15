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
const order = { orderId: 'SDA-2025-9999', total: 96.00 }
const user  = { sub: 'SDA-00423', name: 'Rosa Canals', email: 'rosa@test.com' }

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

  test('notificación sin body devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/notifications/order-confirmed', payload: {} })
    assert.equal(res.statusCode, 400)
  })

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

  test('historial no accesible para clientes — 403', async () => {
    const app = await buildApp()
    const customerToken = app.jwt.sign({ sub: 'SDA-00423', role: 'CUSTOMER' })
    const res = await app.inject({
      method: 'GET', url: '/notifications',
      headers: { authorization: `Bearer ${customerToken}` }
    })
    assert.equal(res.statusCode, 403)
  })
})
