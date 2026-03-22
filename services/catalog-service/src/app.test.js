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
