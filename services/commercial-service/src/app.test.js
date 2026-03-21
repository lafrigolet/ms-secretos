import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { commercialRoutes }       from './routes/commercial.js'
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
  await app.register(commercialRoutes, { prefix: '/commercial' })
  app.get('/health', async () => ({ status: 'ok', service: 'sda-commercial-service' }))
  return app
}

const customerToken    = (app, sub = 'SDA-00423') => app.jwt.sign({ sub, profile: 'PREMIUM',    role: 'CUSTOMER' })
const commercialToken  = (app, sub = 'COM-001')   => app.jwt.sign({ sub, name: 'Marta Soler',   role: 'COMMERCIAL' })
const adminToken       = (app)                     => app.jwt.sign({ sub: 'ADMIN-001',            role: 'ADMIN' })

describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
  })
})

describe('HU-44 — Comercial asignado al cliente', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/commercial/my-commercial' })).statusCode, 401)
  })

  test('cliente con comercial asignado recibe sus datos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/my-commercial', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(body.name)
    assert.ok(body.email)
    assert.ok(body.phone)
    assert.ok(body.zone)
    assert.ok(body.assignedAt)
  })

  test('cliente sin comercial asignado devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/my-commercial', headers: { authorization: `Bearer ${customerToken(app, 'SDA-NUEVO')}` } })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'NO_COMMERCIAL_ASSIGNED')
  })
})

describe('HU-45 — Pedidos sugeridos', () => {
  test('cliente ve sus pedidos sugeridos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/suggested-orders', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length > 0)
  })

  test('comercial crea un pedido sugerido', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/commercial/suggested-orders',
      headers: { authorization: `Bearer ${commercialToken(app)}` },
      payload: {
        sapCode: 'SDA-00423',
        message: 'Te sugiero este pedido de primavera',
        items: [{ productCode: 'P-RT-001', name: 'Champú Restaurador', quantity: 6, unitPrice: 16.00 }]
      }
    })
    assert.equal(res.statusCode, 201)
    assert.ok(res.json().id.startsWith('SUG-'))
    assert.equal(res.json().status, 'PENDING')
  })

  test('comercial no puede sugerir pedido a cliente de otra cartera', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/commercial/suggested-orders',
      headers: { authorization: `Bearer ${commercialToken(app, 'COM-002')}` },
      payload: { sapCode: 'SDA-00423', items: [{ productCode: 'P-RT-001', quantity: 1 }] }
    })
    assert.equal(res.statusCode, 403)
  })

  test('cliente acepta un pedido sugerido', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/commercial/suggested-orders/SUG-001/respond',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { status: 'ACCEPTED' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'ACCEPTED')
    assert.ok(res.json().respondedAt)
  })

  test('cliente no puede responder pedido que no es suyo', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/commercial/suggested-orders/SUG-001/respond',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387')}` },
      payload: { status: 'ACCEPTED' }
    })
    assert.equal(res.statusCode, 404)
  })
})

describe('HU-46 — Cartera del comercial', () => {
  test('cliente no puede ver la cartera — 403', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/commercial/portfolio', headers: { authorization: `Bearer ${customerToken(app)}` } })).statusCode, 403)
  })

  test('comercial ve su cartera de clientes', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio', headers: { authorization: `Bearer ${commercialToken(app)}` } })
    assert.equal(res.statusCode, 200)
    const portfolio = res.json()
    assert.ok(Array.isArray(portfolio))
    assert.ok(portfolio.length > 0)
    assert.ok(portfolio.every(c => c.sapCode && c.assignedAt))
  })

  test('comercial ve historial de un cliente de su cartera', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio/SDA-00423/orders', headers: { authorization: `Bearer ${commercialToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().customer)
    assert.ok(Array.isArray(res.json().orders))
  })

  test('comercial no puede ver clientes de otra cartera', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio/SDA-00387/orders', headers: { authorization: `Bearer ${commercialToken(app)}` } })
    assert.equal(res.statusCode, 403)
  })

  test('admin puede ver cualquier cartera', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio/SDA-00423/orders', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
  })
})

describe('HU-47 — Asignación de comerciales (admin)', () => {
  test('cliente no puede listar comerciales — 403', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/commercial/commercials', headers: { authorization: `Bearer ${customerToken(app)}` } })).statusCode, 403)
  })

  test('admin lista todos los comerciales', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/commercials', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().length >= 3)
  })

  test('admin asigna comercial a un cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/commercial/assignments/SDA-00387',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { commercialId: 'COM-001' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().sapCode, 'SDA-00387')
    assert.equal(res.json().commercialId, 'COM-001')
    assert.ok(res.json().commercial.name)
  })

  test('comercial no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/commercial/assignments/SDA-00387',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { commercialId: 'COM-999' }
    })
    assert.equal(res.statusCode, 404)
  })

  test('admin lista todas las asignaciones', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/assignments', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
  })
})
