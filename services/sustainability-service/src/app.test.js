import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { sustainabilityRoutes }   from './routes/sustainability.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler }           from './middleware/errorHandler.js'

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
  await app.register(sustainabilityRoutes, { prefix: '/sustainability' })
  app.get('/health', async () => ({ status: 'ok', service: 'sda-sustainability-service' }))
  return app
}

const token = (app, sub = 'SDA-00423') =>
  app.jwt.sign({ sub, profile: 'PREMIUM', role: 'CUSTOMER' })

describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/health' })).statusCode, 200)
  })
})

describe('HU-53 — Origen e ingredientes', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-001' })).statusCode, 401)
  })

  test('devuelve ficha completa de sostenibilidad de un producto', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/sustainability/products/P-RT-001',
      headers: { authorization: `Bearer ${token(app)}` }
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(body.origin)
    assert.ok(body.ingredients)
    assert.ok(Array.isArray(body.ingredients))
    assert.ok(body.ingredients.length > 0)
    assert.ok(typeof body.naturalPercentage === 'number')
    assert.ok(typeof body.sustainabilityScore === 'number')
    assert.ok(body.ecoLabels)
    assert.ok(body.packaging)
  })

  test('producto sin datos de sostenibilidad devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/sustainability/products/P-NO-EXISTE',
      headers: { authorization: `Bearer ${token(app)}` }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'SUSTAINABILITY_DATA_NOT_FOUND')
  })

  test('lista todos los productos con resumen de sostenibilidad', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/sustainability/products',
      headers: { authorization: `Bearer ${token(app)}` }
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(Array.isArray(body))
    assert.ok(body.length > 0)
    assert.ok(body.every(p => p.sustainabilityScore && p.naturalPercentage))
  })

  test('ingredientes tienen los campos requeridos', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/sustainability/products/P-RT-001',
      headers: { authorization: `Bearer ${token(app)}` }
    })
    const { ingredients } = res.json()
    assert.ok(ingredients.every(i => i.name && i.percentage !== undefined && i.origin && i.natural !== undefined))
  })
})

describe('HU-54 — Huella de carbono', () => {
  test('calcula la huella de carbono para un pedido estándar', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: {
        items: [
          { productCode: 'P-RT-001', quantity: 6 },
          { productCode: 'P-RT-002', quantity: 3 }
        ],
        shippingMethod: 'STANDARD'
      }
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(typeof body.co2Kg === 'number')
    assert.ok(body.co2Kg > 0)
    assert.ok(typeof body.totalWeightKg === 'number')
    assert.ok(Array.isArray(body.alternatives))
    assert.ok(body.alternatives.length > 0)
  })

  test('envío ECO tiene menos emisiones que STANDARD', async () => {
    const app = await buildApp()
    const items = [{ productCode: 'P-RT-001', quantity: 6 }]
    const [standard, eco] = await Promise.all([
      app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', headers: { authorization: `Bearer ${token(app)}` }, payload: { items, shippingMethod: 'STANDARD' } }),
      app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', headers: { authorization: `Bearer ${token(app)}` }, payload: { items, shippingMethod: 'ECO' } })
    ])
    assert.ok(eco.json().co2Kg < standard.json().co2Kg)
  })

  test('EXPRESS tiene más emisiones que STANDARD', async () => {
    const app = await buildApp()
    const items = [{ productCode: 'P-RT-001', quantity: 2 }]
    const [standard, express] = await Promise.all([
      app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', headers: { authorization: `Bearer ${token(app)}` }, payload: { items, shippingMethod: 'STANDARD' } }),
      app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', headers: { authorization: `Bearer ${token(app)}` }, payload: { items, shippingMethod: 'EXPRESS' } })
    ])
    assert.ok(express.json().co2Kg > standard.json().co2Kg)
  })

  test('alternatives incluye todas las modalidades excepto la seleccionada', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 1 }], shippingMethod: 'STANDARD' }
    })
    const { alternatives } = res.json()
    assert.ok(alternatives.every(a => a.method !== 'STANDARD'))
    assert.ok(alternatives.length === 3)
  })

  test('items vacíos devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [] }
    })
    assert.equal(res.statusCode, 400)
  })
})

describe('HU-55 — Preferencias de agrupación', () => {
  test('cliente nuevo tiene preferencia por defecto (sin agrupación)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/sustainability/grouping-preference',
      headers: { authorization: `Bearer ${token(app, 'SDA-NUEVO')}` }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().acceptDelay, false)
    assert.equal(res.json().maxDelayDays, 3)
  })

  test('cliente activa la agrupación de pedidos', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/sustainability/grouping-preference',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { acceptDelay: true, maxDelayDays: 5 }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().acceptDelay, true)
    assert.equal(res.json().maxDelayDays, 5)
    assert.ok(res.json().updatedAt)
  })

  test('cliente desactiva la agrupación', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/sustainability/grouping-preference',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { acceptDelay: false }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().acceptDelay, false)
  })

  test('maxDelayDays fuera de rango devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/sustainability/grouping-preference',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { acceptDelay: true, maxDelayDays: 30 }
    })
    assert.equal(res.statusCode, 400)
  })

  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/sustainability/grouping-preference' })).statusCode, 401)
  })
})
