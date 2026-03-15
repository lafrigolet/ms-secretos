import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { orderRoutes } from './routes/orders.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

process.env.JWT_SECRET = 'test-secret'
process.env.SAP_INTEGRATION_URL = 'http://localhost:3010'

const ORDERS = [
  {
    orderId: 'SDA-2025-0890',
    sapCode: 'SDA-00423',
    date: '2025-03-08',
    status: 'SHIPPED',
    items: [
      { productCode: 'P-RT-001', name: 'Champú Restaurador', quantity: 6, unitPrice: 16.00 }
    ],
    total: 96.00
  }
]

// Mock fetch — simula sap-integration-service y servicios asíncronos
global.fetch = async (url, opts) => {
  const path = url.replace('http://localhost:3010', '').replace('http://notification-service:3007', '').replace('http://audit-service:3009', '')

  if (path.includes('/internal/orders/SDA-00423')) return { ok: true, json: async () => ORDERS }
  if (path.includes('/internal/orders/order/SDA-2025-0890')) return { ok: true, json: async () => ORDERS[0] }
  if (path.includes('/internal/orders/order/NO-EXISTE')) return { ok: false, status: 404, json: async () => null }
  if (path === '/internal/orders' && opts?.method === 'POST') {
    const body = JSON.parse(opts.body)
    return {
      ok: true,
      json: async () => ({
        orderId: 'SDA-2025-9999',
        sapCode: body.sapCode,
        date: new Date().toISOString().split('T')[0],
        status: 'CONFIRMED',
        items: body.items,
        total: body.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
      })
    }
  }
  // notification y audit — ignoramos
  return { ok: true, json: async () => ({}) }
}

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
  await app.register(orderRoutes, { prefix: '/orders' })
  return app
}

const token = (app, sub = 'SDA-00423', role = 'CUSTOMER') =>
  app.jwt.sign({ sub, profile: 'PREMIUM', role })

// ══════════════════════════════════════════════════════════════════
describe('HU-18 — Historial de pedidos', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/orders' })).statusCode, 401)
  })

  test('devuelve historial del cliente autenticado', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length > 0)
  })
})

describe('HU-21 — Estado de pedido en tiempo real', () => {
  test('obtiene estado de un pedido propio', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders/SDA-2025-0890', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().orderId, 'SDA-2025-0890')
    assert.ok(res.json().status)
  })

  test('pedido no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders/NO-EXISTE', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 404)
  })

  test('cliente no puede ver pedido de otro cliente — 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/orders/SDA-2025-0890',
      headers: { authorization: `Bearer ${token(app, 'SDA-OTRO')}` }
    })
    assert.equal(res.statusCode, 403)
  })

  test('admin puede ver cualquier pedido', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/orders/SDA-2025-0890',
      headers: { authorization: `Bearer ${token(app, 'ADMIN-001', 'ADMIN')}` }
    })
    assert.equal(res.statusCode, 200)
  })
})

describe('HU-17 — Confirmar pedido', () => {
  test('crea un pedido correctamente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', name: 'Champú', quantity: 6, unitPrice: 16.00 }] }
    })
    assert.equal(res.statusCode, 201)
    assert.ok(res.json().orderId)
    assert.equal(res.json().status, 'CONFIRMED')
  })

  test('pedido sin items devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('pedido sin body devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: {}
    })
    assert.equal(res.statusCode, 400)
  })
})

describe('HU-19 — Repetir pedido anterior', () => {
  test('devuelve items del pedido anterior', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders/SDA-2025-0890/repeat',
      headers: { authorization: `Bearer ${token(app)}` }
    })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json().items))
    assert.ok(res.json().items.length > 0)
  })

  test('no puede repetir pedido de otro cliente — 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders/SDA-2025-0890/repeat',
      headers: { authorization: `Bearer ${token(app, 'SDA-OTRO')}` }
    })
    assert.equal(res.statusCode, 403)
  })

  test('pedido no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders/NO-EXISTE/repeat',
      headers: { authorization: `Bearer ${token(app)}` }
    })
    assert.equal(res.statusCode, 404)
  })
})
