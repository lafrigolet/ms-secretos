import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { promotionsRoutes } from './routes/promotions.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

process.env.JWT_SECRET = 'test-secret'

async function buildApp () {
  const app = Fastify({ logger: false })
  await app.register(corsPlugin)
  await app.register(jwtPlugin, { secret: process.env.JWT_SECRET })
  await app.register(swaggerPlugin, { openapi: { info: { title: 'test', version: '1.0.0' }, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } } } })
  await app.register(swaggerUiPlugin, { routePrefix: '/docs' })
  registerAuthDecorators(app)
  app.setErrorHandler(errorHandler)
  await app.register(promotionsRoutes, { prefix: '/promotions' })
  return app
}

const token = (app, profile = 'PREMIUM', role = 'CUSTOMER') =>
  app.jwt.sign({ sub: 'SDA-00423', profile, role })
const adminToken = (app) => app.jwt.sign({ sub: 'ADMIN-001', profile: 'ADMIN', role: 'ADMIN' })

describe('HU-10 — Promociones activas por perfil', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/promotions' })).statusCode, 401)
  })

  test('PREMIUM recibe sus promociones', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().length > 0)
    assert.ok(res.json().every(p => p.active))
  })

  test('STANDARD no recibe promociones exclusivas de PREMIUM', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions', headers: { authorization: `Bearer ${token(app, 'STANDARD')}` } })
    const body = res.json()
    assert.ok(!body.some(p => p.id === 'PROMO-001'))
  })

  test('VIP recibe todas las promociones', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions', headers: { authorization: `Bearer ${token(app, 'VIP')}` } })
    assert.ok(res.json().length >= 2)
  })
})

describe('HU-12, HU-13 — Cálculo de beneficios', () => {
  test('pedido con 6 champús aplica regalo automáticamente (HU-13)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/calculate',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 6 }], orderTotal: 96 }
    })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().count > 0)
    assert.ok(res.json().benefits.some(b => b.promoId === 'PROMO-001'))
  })

  test('pedido superior a 250€ aplica regalo por importe (HU-13)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/calculate',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [], orderTotal: 300 }
    })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().benefits.some(b => b.promoId === 'PROMO-003'))
  })

  test('pedido por debajo del umbral no aplica regalo', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/calculate',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [], orderTotal: 100 }
    })
    assert.ok(!res.json().benefits.some(b => b.promoId === 'PROMO-003'))
  })

  test('pedido sin items ni importe devuelve 0 beneficios', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/calculate',
      headers: { authorization: `Bearer ${token(app, 'STANDARD')}` },
      payload: { items: [], orderTotal: 50 }
    })
    assert.equal(res.json().count, 0)
  })
})

describe('HU-11 — Gestión de promociones (admin)', () => {
  test('cliente no puede acceder a /admin — 403', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/promotions/admin', headers: { authorization: `Bearer ${token(app)}` } })).statusCode, 403)
  })

  test('admin lista todas las promociones incluyendo inactivas', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions/admin', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
  })

  test('admin crea una nueva promoción', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/admin',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { name: 'Test Promo', type: 'GIFT', profiles: ['VIP'], condition: { minOrderTotal: 100 }, benefit: { type: 'GIFT', description: 'Regalo test' } }
    })
    assert.equal(res.statusCode, 201)
    assert.ok(res.json().id)
  })

  test('admin desactiva una promoción', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/promotions/admin/PROMO-001/toggle', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().active, false)
  })
})
