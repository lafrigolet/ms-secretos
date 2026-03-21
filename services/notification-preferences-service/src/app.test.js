import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { notificationRoutes }     from './routes/notifications.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler }           from './middleware/errorHandler.js'

process.env.JWT_SECRET = 'test-secret'
process.env.NODE_ENV   = 'development'

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
  app.get('/health', async () => ({ status: 'ok' }))
  return app
}

const customerToken = (app, sub = 'SDA-00423', profile = 'PREMIUM') =>
  app.jwt.sign({ sub, profile, role: 'CUSTOMER' })
const adminToken = (app) =>
  app.jwt.sign({ sub: 'ADMIN-001', profile: 'ADMIN', role: 'ADMIN' })

describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/health' })).statusCode, 200)
  })
})

describe('GET /notifications/types', () => {
  test('devuelve tipos y canales disponibles', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/types' })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json().types))
    assert.ok(Array.isArray(res.json().channels))
    assert.ok(res.json().types.length > 0)
  })
})

describe('HU-51 — Preferencias de notificación', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/notifications/preferences' })).statusCode, 401)
  })

  test('obtiene preferencias del cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/preferences', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(body.preferences)
    assert.ok(body.types)
    assert.ok(body.channels)
    assert.ok('STOCK_ALERT' in body.preferences)
  })

  test('actualiza preferencias parcialmente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/notifications/preferences',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { STOCK_ALERT: { EMAIL: false, PUSH: false } }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().preferences.STOCK_ALERT.EMAIL, false)
    assert.equal(res.json().preferences.STOCK_ALERT.PUSH, false)
  })

  test('cliente nuevo recibe preferencias por defecto', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/notifications/preferences',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-NUEVO')}` }
    })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().preferences.ADMIN_BROADCAST)
  })
})

describe('Bandeja de entrada', () => {
  test('obtiene notificaciones del cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/inbox', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json().notifications))
    assert.ok(typeof res.json().unread === 'number')
  })

  test('marca una notificación como leída', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/notifications/inbox/NOTIF-001/read',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().read, true)
  })

  test('marca todas las notificaciones como leídas', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/notifications/inbox/read-all',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().message)
  })
})

describe('HU-48 — Watchlist de stock', () => {
  test('obtiene watchlist del cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/watchlist', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
  })

  test('añade producto al seguimiento', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/watchlist',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { productCode: 'P-BN-002', productName: 'Sérum Raíces' }
    })
    assert.equal(res.statusCode, 201)
    assert.equal(res.json().productCode, 'P-BN-002')
    assert.ok(res.json().addedAt)
  })

  test('elimina producto del seguimiento', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/notifications/watchlist', headers: { authorization: `Bearer ${customerToken(app)}` }, payload: { productCode: 'P-DEL', productName: 'Test' } })
    const res = await app.inject({
      method: 'DELETE', url: '/notifications/watchlist/P-DEL',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
  })

  test('producto no existente devuelve 404', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'DELETE', url: '/notifications/watchlist/NO-EXISTE', headers: { authorization: `Bearer ${customerToken(app)}` } })).statusCode, 404)
  })
})

describe('HU-49 — Alertas de promociones', () => {
  test('cliente PREMIUM ve promociones próximas a vencer', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/alerts/expiring-promos', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00423', 'PREMIUM')}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json().promos))
    assert.ok(res.json().promos.length > 0)
  })

  test('cliente STANDARD no ve promos exclusivas de PREMIUM', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/alerts/expiring-promos', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387', 'STANDARD')}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().promos.every(p => p.applicable))
  })
})

describe('HU-50 — Aviso de pedido mínimo', () => {
  test('carrito por debajo del mínimo genera alertas', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/alerts/check-min-order',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { cartTotal: 50 }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().hasAlerts, true)
    assert.ok(res.json().alerts.length > 0)
    assert.ok(res.json().alerts.every(a => a.remaining > 0))
  })

  test('carrito por encima del mínimo no genera alertas', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/alerts/check-min-order',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { cartTotal: 200 }
    })
    assert.equal(res.json().hasAlerts, false)
    assert.deepEqual(res.json().alerts, [])
  })
})

describe('HU-52 — Comunicaciones segmentadas', () => {
  test('cliente no puede enviar broadcasts — 403', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'POST', url: '/notifications/broadcasts', headers: { authorization: `Bearer ${customerToken(app)}` }, payload: { title: 'T', body: 'B' } })).statusCode, 403)
  })

  test('admin puede enviar un broadcast', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/broadcasts',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: {
        title: 'Test broadcast',
        body: 'Mensaje de prueba para clientes activos',
        channel: 'EMAIL',
        segments: { profiles: ['PREMIUM', 'VIP'], status: 'ACTIVE' }
      }
    })
    assert.equal(res.statusCode, 201)
    assert.ok(res.json().id.startsWith('BC-'))
    assert.ok(res.json().sentAt)
  })

  test('admin lista todos los broadcasts', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/broadcasts', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length > 0)
  })

  test('broadcast sin título devuelve 400', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'POST', url: '/notifications/broadcasts', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { body: 'sin título' } })).statusCode, 400)
  })
})
