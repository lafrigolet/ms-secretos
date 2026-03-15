import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { cartRoutes } from './routes/cart.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

process.env.JWT_SECRET = 'test-secret'
// Mock promotions-service
global.fetch = async () => ({ ok: true, json: async () => ({ benefits: [] }) })

async function buildApp () {
  const app = Fastify({ logger: false })
  await app.register(corsPlugin)
  await app.register(jwtPlugin, { secret: process.env.JWT_SECRET })
  await app.register(swaggerPlugin, { openapi: { info: { title: 'test', version: '1.0.0' }, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } } } })
  await app.register(swaggerUiPlugin, { routePrefix: '/docs' })
  registerAuthDecorators(app)
  app.setErrorHandler(errorHandler)
  await app.register(cartRoutes, { prefix: '/cart' })
  return app
}

const token = (app, sub = 'SDA-TEST') => app.jwt.sign({ sub, profile: 'PREMIUM', role: 'CUSTOMER' })
const item = { productCode: 'P-RT-001', name: 'Champú', quantity: 2, unitPrice: 16.00 }

describe('HU-14 — Gestión de cesta', () => {
  test('cesta vacía al inicio', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${token(app, 'USER-A')}` } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json().items, [])
    assert.equal(res.json().total, 0)
  })

  test('añadir producto a la cesta', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${token(app, 'USER-B')}` }, payload: item })
    assert.equal(res.statusCode, 201)
    assert.equal(res.json().items.length, 1)
    assert.equal(res.json().items[0].quantity, 2)
  })

  test('añadir el mismo producto suma las cantidades', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-C')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: item })
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { ...item, quantity: 3 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().items[0].quantity, 5)
  })

  test('modificar cantidad de un producto', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-D')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: item })
    const res = await app.inject({ method: 'PATCH', url: '/cart/items/P-RT-001', headers: { authorization: `Bearer ${t}` }, payload: { quantity: 10 } })
    assert.equal(res.json().items[0].quantity, 10)
  })

  test('cantidad 0 elimina el producto', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-E')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: item })
    await app.inject({ method: 'PATCH', url: '/cart/items/P-RT-001', headers: { authorization: `Bearer ${t}` }, payload: { quantity: 0 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.deepEqual(res.json().items, [])
  })

  test('eliminar producto de la cesta', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-F')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: item })
    await app.inject({ method: 'DELETE', url: '/cart/items/P-RT-001', headers: { authorization: `Bearer ${t}` } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.deepEqual(res.json().items, [])
  })

  test('vaciar cesta', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-G')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: item })
    await app.inject({ method: 'DELETE', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().total, 0)
  })
})

describe('HU-15 — Gastos de envío', () => {
  test('pedido por debajo de 150€ tiene gastos de envío', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-H')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 1, unitPrice: 50 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.ok(res.json().shipping > 0)
  })

  test('pedido igual o superior a 150€ tiene envío gratis', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-I')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 1, unitPrice: 200 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().shipping, 0)
  })
})

describe('HU-16 — Resumen del pedido', () => {
  test('GET /cart/summary devuelve todos los campos necesarios', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-J')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: item })
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok('items' in body)
    assert.ok('subtotal' in body)
    assert.ok('shipping' in body)
    assert.ok('total' in body)
    assert.ok('benefits' in body)
    assert.ok('freeShippingRemaining' in body)
  })
})
