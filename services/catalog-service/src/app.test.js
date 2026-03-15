import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { catalogRoutes } from './routes/catalog.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

process.env.NODE_ENV = 'development'
process.env.JWT_SECRET = 'test-secret'
process.env.SAP_INTEGRATION_URL = 'http://localhost:3010'

// ── Mock de global.fetch ──────────────────────────────────────────
// Los clientes en clients/SapIntegrationClient.js usan HttpClient,
// que internamente usa fetch. Mockeamos fetch para interceptar
// todas las llamadas al sap-integration-service.
const FAMILIES = [
  { id: 'F01', name: 'Ritual Timeless' },
  { id: 'F02', name: 'Sensitivo' },
  { id: 'F03', name: 'Brillo & Nutrición' }
]
const PRODUCTS = [
  { sapCode: 'P-RT-001', familyId: 'F01', name: 'Champú Restaurador', format: '250ml', active: true },
  { sapCode: 'P-RT-002', familyId: 'F01', name: 'Mascarilla Timeless', format: '200ml', active: true },
  { sapCode: 'P-SN-001', familyId: 'F02', name: 'Champú Sensitivo', format: '250ml', active: true }
]
const PRICES  = { 'P-RT-001': 16.00, 'P-RT-002': 19.00, 'P-SN-001': 13.00 }
const STOCK   = { 'P-RT-001': 240,   'P-RT-002': 0,      'P-SN-001': 310 }

global.fetch = async (url) => {
  const path = url.replace('http://localhost:3010', '')
  if (path === '/internal/catalog/families')
    return { ok: true, status: 200, json: async () => FAMILIES }
  if (path === '/internal/catalog/products?familyId=F01')
    return { ok: true, status: 200, json: async () => PRODUCTS.filter(p => p.familyId === 'F01') }
  if (path === '/internal/catalog/products')
    return { ok: true, status: 200, json: async () => PRODUCTS }
  if (path === '/internal/catalog/products/P-RT-001')
    return { ok: true, status: 200, json: async () => PRODUCTS[0] }
  if (path === '/internal/catalog/products/NO-EXISTE')
    return { ok: false, status: 404, json: async () => ({}) }
  if (path === '/internal/catalog/prices/PREMIUM/P-RT-001')
    return { ok: true, status: 200, json: async () => ({ price: 16.00 }) }
  if (path === '/internal/catalog/prices/PREMIUM')
    return { ok: true, status: 200, json: async () => PRICES }
  if (path === '/internal/catalog/stock')
    return { ok: true, status: 200, json: async () => STOCK }
  if (path === '/internal/catalog/stock/P-RT-001')
    return { ok: true, status: 200, json: async () => ({ stock: 240 }) }
  return { ok: false, status: 404, json: async () => ({}) }
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
  await app.register(catalogRoutes, { prefix: '/catalog' })
  return app
}

const token = (app, profile = 'PREMIUM') =>
  app.jwt.sign({ sub: 'SDA-00423', profile, role: 'CUSTOMER' })

// ══════════════════════════════════════════════════════════════════
describe('HU-07 — Familias de productos', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/catalog/families' })).statusCode, 401)
  })

  test('devuelve las 3 familias', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/families', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().length, 3)
  })
})

describe('HU-07, HU-08 — Productos', () => {
  test('lista todos los productos con precio y stock del perfil', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().every(p => p.price !== undefined && p.stock !== undefined && p.inStock !== undefined))
  })

  test('filtra productos por familia', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products?familyId=F01', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().every(p => p.familyId === 'F01'))
  })

  test('producto sin stock tiene inStock: false', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app)}` } })
    const mascarilla = res.json().find(p => p.sapCode === 'P-RT-002')
    assert.equal(mascarilla.inStock, false)
  })

  test('HU-08 — ficha de producto individual con precio y stock', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products/P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.sapCode, 'P-RT-001')
    assert.ok(body.price > 0)
    assert.ok(body.stock >= 0)
  })

  test('producto no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products/NO-EXISTE', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 404)
  })
})

describe('HU-09 — Recomendaciones', () => {
  test('devuelve productos de la misma familia no presentes en la cesta', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/recommendations?cartItems=P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(!body.some(p => p.sapCode === 'P-RT-001'))
    assert.ok(body.every(p => p.familyId === 'F01'))
  })

  test('sin items en cesta devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/recommendations', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), [])
  })
})
