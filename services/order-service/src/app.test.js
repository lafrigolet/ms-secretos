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
process.env.NODE_ENV = 'test'

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
const adminToken = (app) =>
  app.jwt.sign({ sub: 'ADMIN-001', profile: 'ADMIN', role: 'ADMIN' })
const expiredToken = (app) =>
  app.jwt.sign({ sub: 'EXP-USER', profile: 'STANDARD', role: 'CUSTOMER', exp: Math.floor(Date.now() / 1000) - 3600 })

// ══════════════════════════════════════════════════════════════════
// NOTE: sap/notification/audit are module-level singletons — stub
// state (STUB_ORDERS, STUB_ORDER_BY_ID, stubCounter) is shared across
// all tests. Read-only tests appear before mutation tests to allow
// exact assertions on initial stub data.
// ══════════════════════════════════════════════════════════════════

describe('HU-18 — Historial de pedidos', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/orders' })).statusCode, 401)
  })

  test('token manipulado → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders', headers: { authorization: 'Bearer bad.token.here' } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('devuelve historial del cliente autenticado', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length > 0)
  })

  test('SDA-00423 tiene al menos el pedido SDA-2025-0890', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders', headers: { authorization: `Bearer ${token(app, 'SDA-00423')}` } })
    const orders = res.json()
    assert.ok(orders.some(o => o.orderId === 'SDA-2025-0890'))
  })

  test('cliente sin pedidos devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders', headers: { authorization: `Bearer ${token(app, 'SDA-00387')}` } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), [])
  })

  test('cada pedido tiene los campos requeridos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders', headers: { authorization: `Bearer ${token(app, 'SDA-00423')}` } })
    const order = res.json()[0]
    assert.ok('orderId' in order)
    assert.ok('status' in order)
    assert.ok('total' in order)
    assert.ok('date' in order)
    assert.ok('items' in order)
  })

  test('admin también puede ver su propio historial', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-21 — Estado de pedido en tiempo real', () => {
  test('sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders/SDA-2025-0890' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders/SDA-2025-0890', headers: { authorization: 'Bearer tampered.token' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders/SDA-2025-0890', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('obtiene estado de un pedido propio', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders/SDA-2025-0890', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().orderId, 'SDA-2025-0890')
    assert.ok(res.json().status)
  })

  test('pedido no existente devuelve 404', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/orders/NO-EXISTE', headers: { authorization: `Bearer ${token(app)}` } })).statusCode, 404)
  })

  test('pedido no existente devuelve error ORDER_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders/NO-EXISTE', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().error, 'ORDER_NOT_FOUND')
  })

  test('cliente no puede ver pedido de otro — 403', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'GET', url: '/orders/SDA-2025-0890', headers: { authorization: `Bearer ${token(app, 'SDA-OTRO')}` } })).statusCode,
      403
    )
  })

  test('403 devuelve error FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders/SDA-2025-0890', headers: { authorization: `Bearer ${token(app, 'SDA-OTRO')}` } })
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('admin puede ver cualquier pedido', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'GET', url: '/orders/SDA-2025-0890', headers: { authorization: `Bearer ${adminToken(app)}` } })).statusCode,
      200
    )
  })

  test('respuesta incluye todos los campos del pedido', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders/SDA-2025-0890', headers: { authorization: `Bearer ${token(app)}` } })
    const body = res.json()
    assert.equal(body.orderId, 'SDA-2025-0890')
    assert.equal(body.sapCode, 'SDA-00423')
    assert.equal(body.status, 'SHIPPED')
    assert.equal(body.total, 96.00)
    assert.ok(Array.isArray(body.items))
    assert.ok(body.items.length > 0)
    assert.ok('date' in body)
  })

  test('items del pedido tienen productCode, name, quantity y unitPrice', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders/SDA-2025-0890', headers: { authorization: `Bearer ${token(app)}` } })
    const item = res.json().items[0]
    assert.ok('productCode' in item)
    assert.ok('name' in item)
    assert.ok('quantity' in item)
    assert.ok('unitPrice' in item)
  })

  test('status del pedido stub es SHIPPED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders/SDA-2025-0890', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().status, 'SHIPPED')
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-17 — Confirmar pedido', () => {
  test('sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/orders', payload: { items: [{ productCode: 'P-X', quantity: 1, unitPrice: 10 }] } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/orders', headers: { authorization: 'Bearer bad.token' }, payload: { items: [{ productCode: 'P-X', quantity: 1, unitPrice: 10 }] } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/orders', headers: { authorization: `Bearer ${expiredToken(app)}` }, payload: { items: [{ productCode: 'P-X', quantity: 1, unitPrice: 10 }] } })
    assert.equal(res.statusCode, 401)
  })

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

  test('orderId creado tiene formato SDA-2025-XXXX', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-X', quantity: 1, unitPrice: 10 }] }
    })
    assert.match(res.json().orderId, /^SDA-2025-\d+$/)
  })

  test('sapCode en pedido creado coincide con el usuario autenticado', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app, 'SDA-00387')}` },
      payload: { items: [{ productCode: 'P-X', quantity: 2, unitPrice: 20 }] }
    })
    assert.equal(res.json().sapCode, 'SDA-00387')
  })

  test('total calculado correctamente (6 × 16.00 = 96.00)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', name: 'Champú', quantity: 6, unitPrice: 16.00 }] }
    })
    assert.equal(res.json().total, 96.00)
  })

  test('total con múltiples productos (2 × 10 + 3 × 20 = 80)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app, 'SDA-00521')}` },
      payload: { items: [
        { productCode: 'P-A', quantity: 2, unitPrice: 10 },
        { productCode: 'P-B', quantity: 3, unitPrice: 20 }
      ] }
    })
    assert.equal(res.json().total, 80)
  })

  test('pedido creado tiene status CONFIRMED', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-X', quantity: 1, unitPrice: 5 }] }
    })
    assert.equal(res.json().status, 'CONFIRMED')
  })

  test('respuesta incluye items del pedido creado', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', name: 'Champú', quantity: 2, unitPrice: 16 }] }
    })
    assert.ok(Array.isArray(res.json().items))
    assert.equal(res.json().items[0].productCode, 'P-RT-001')
  })

  test('respuesta incluye date en formato YYYY-MM-DD', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-X', quantity: 1, unitPrice: 10 }] }
    })
    assert.match(res.json().date, /^\d{4}-\d{2}-\d{2}$/)
  })

  test('pedido creado aparece en GET /orders/:orderId', async () => {
    const app = await buildApp()
    const t = token(app, 'SDA-00423')
    const createRes = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${t}` },
      payload: { items: [{ productCode: 'P-NEW', name: 'Nuevo', quantity: 1, unitPrice: 25 }] }
    })
    const { orderId } = createRes.json()
    const getRes = await app.inject({ method: 'GET', url: `/orders/${orderId}`, headers: { authorization: `Bearer ${t}` } })
    assert.equal(getRes.statusCode, 200)
    assert.equal(getRes.json().orderId, orderId)
  })

  test('pedido creado aparece en el historial del cliente', async () => {
    const app = await buildApp()
    const t = token(app, 'SDA-00423')
    const createRes = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${t}` },
      payload: { items: [{ productCode: 'P-HIST', name: 'Test', quantity: 1, unitPrice: 10 }] }
    })
    const { orderId } = createRes.json()
    const histRes = await app.inject({ method: 'GET', url: '/orders', headers: { authorization: `Bearer ${t}` } })
    assert.ok(histRes.json().some(o => o.orderId === orderId))
  })

  test('pedido sin items devuelve 400', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'POST', url: '/orders', headers: { authorization: `Bearer ${token(app)}` }, payload: { items: [] } })).statusCode,
      400
    )
  })

  test('pedido sin body devuelve 400', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'POST', url: '/orders', headers: { authorization: `Bearer ${token(app)}` }, payload: {} })).statusCode,
      400
    )
  })

  test('item sin productCode → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ quantity: 1, unitPrice: 10 }] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('item sin quantity → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-X', unitPrice: 10 }] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('item sin unitPrice → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-X', quantity: 1 }] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('item con quantity = 0 → 400 (mínimo 1)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-X', quantity: 0, unitPrice: 10 }] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('400 devuelve error VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [] }
    })
    assert.equal(res.json().error, 'VALIDATION_ERROR')
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-19 — Repetir pedido anterior', () => {
  test('sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/orders/SDA-2025-0890/repeat' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/orders/SDA-2025-0890/repeat', headers: { authorization: 'Bearer bad.token' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/orders/SDA-2025-0890/repeat', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('devuelve items del pedido anterior', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/orders/SDA-2025-0890/repeat', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json().items))
    assert.ok(res.json().items.length > 0)
  })

  test('items coinciden con los del pedido original', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/orders/SDA-2025-0890/repeat', headers: { authorization: `Bearer ${token(app)}` } })
    const item = res.json().items[0]
    assert.equal(item.productCode, 'P-RT-001')
    assert.equal(item.quantity, 6)
    assert.equal(item.unitPrice, 16.00)
  })

  test('respuesta incluye campo message', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/orders/SDA-2025-0890/repeat', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok('message' in res.json())
  })

  test('no puede repetir pedido de otro cliente — 403', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'POST', url: '/orders/SDA-2025-0890/repeat', headers: { authorization: `Bearer ${token(app, 'SDA-OTRO')}` } })).statusCode,
      403
    )
  })

  test('403 devuelve error FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/orders/SDA-2025-0890/repeat', headers: { authorization: `Bearer ${token(app, 'SDA-OTRO')}` } })
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('admin no puede repetir pedido ajeno (ruta sólo verifica sapCode)', async () => {
    const app = await buildApp()
    // La ruta /repeat sólo comprueba sapCode === user.sub, no role === ADMIN
    const res = await app.inject({ method: 'POST', url: '/orders/SDA-2025-0890/repeat', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 403)
  })

  test('pedido no existente devuelve 404', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'POST', url: '/orders/NO-EXISTE/repeat', headers: { authorization: `Bearer ${token(app)}` } })).statusCode,
      404
    )
  })

  test('404 devuelve error ORDER_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/orders/NO-EXISTE/repeat', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().error, 'ORDER_NOT_FOUND')
  })

  test('puede repetir pedido recién creado', async () => {
    const app = await buildApp()
    const t = token(app, 'SDA-00423')
    const createRes = await app.inject({
      method: 'POST', url: '/orders',
      headers: { authorization: `Bearer ${t}` },
      payload: { items: [{ productCode: 'P-REPEAT-TEST', name: 'Test', quantity: 3, unitPrice: 9 }] }
    })
    const { orderId } = createRes.json()
    const repeatRes = await app.inject({ method: 'POST', url: `/orders/${orderId}/repeat`, headers: { authorization: `Bearer ${t}` } })
    assert.equal(repeatRes.statusCode, 200)
    assert.equal(repeatRes.json().items[0].productCode, 'P-REPEAT-TEST')
  })
})
