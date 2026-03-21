import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { returnsRoutes }      from './routes/returns.js'
import { adminReturnsRoutes } from './routes/admin.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

process.env.JWT_SECRET  = 'test-secret'
process.env.NODE_ENV    = 'development'

// Mock fetch para SapIntegrationClient
global.fetch = async (url) => {
  if (url.includes('/internal/orders/order/SDA-2025-0890')) {
    return { ok: true, json: async () => ({ orderId: 'SDA-2025-0890', sapCode: 'SDA-00423', total: 96 }) }
  }
  if (url.includes('/internal/orders/order/NO-EXISTE')) {
    return { ok: false, status: 404, json: async () => null }
  }
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
  await app.register(returnsRoutes,      { prefix: '/returns' })
  await app.register(adminReturnsRoutes, { prefix: '/admin/returns' })
  app.get('/health', async () => ({ status: 'ok' }))
  return app
}

const customerToken = (app, sub = 'SDA-00423') =>
  app.jwt.sign({ sub, profile: 'PREMIUM', role: 'CUSTOMER' })
const adminToken = (app) =>
  app.jwt.sign({ sub: 'ADMIN-001', profile: 'ADMIN', role: 'ADMIN' })

const validItem = { productCode: 'P-RT-001', name: 'Champú', quantity: 2, unitPrice: 16.00 }

// ══════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'ok')
  })
})

describe('GET /returns/reasons', () => {
  test('devuelve la lista de motivos de devolución', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/returns/reasons' })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length > 0)
    assert.ok(res.json().every(r => r.code && r.label))
  })
})

describe('HU-33 — GET /returns — mis reclamaciones', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/returns' })).statusCode, 401)
  })

  test('devuelve las reclamaciones del cliente autenticado', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().every(r => r.sapCode === 'SDA-00423'))
  })

  test('cliente sin reclamaciones devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387')}` }
    })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), [])
  })
})

describe('HU-31, HU-32 — POST /returns — crear devolución', () => {
  test('crea una devolución correctamente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: {
        orderId: 'SDA-2025-0890',
        reason: 'DAMAGED',
        notes: 'Producto llegó roto',
        items: [validItem]
      }
    })
    assert.equal(res.statusCode, 201)
    const body = res.json()
    assert.ok(body.id)
    assert.equal(body.status, 'PENDING')
    assert.equal(body.reason, 'DAMAGED')
    assert.ok(body.reasonLabel)
  })

  test('sin items devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { orderId: 'SDA-2025-0890', reason: 'DAMAGED', items: [] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('motivo inválido devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { orderId: 'SDA-2025-0890', reason: 'INVALID', items: [validItem] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('pedido de otro cliente devuelve 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-OTRO')}` },
      payload: { orderId: 'SDA-2025-0890', reason: 'DAMAGED', items: [validItem] }
    })
    assert.equal(res.statusCode, 403)
  })
})

describe('HU-33 — GET /returns/:id — detalle de reclamación', () => {
  test('cliente puede ver su propia reclamación', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/returns/RET-2025-001',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().id, 'RET-2025-001')
    assert.ok(res.json().status)
  })

  test('reclamación no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/returns/NO-EXISTE',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 404)
  })
})

describe('HU-34 — GET /admin/returns — listado admin', () => {
  test('cliente no puede acceder — 403', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'GET', url: '/admin/returns', headers: { authorization: `Bearer ${customerToken(app)}` } })).statusCode,
      403
    )
  })

  test('admin ve todas las devoluciones', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/returns',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length > 0)
  })

  test('admin filtra por estado', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/returns?status=REVIEWING',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.ok(res.json().every(r => r.status === 'REVIEWING'))
  })
})

describe('HU-34, HU-35 — PATCH /admin/returns/:id — cambiar estado', () => {
  test('admin puede marcar como REVIEWING', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/returns/RET-2025-001',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { status: 'REVIEWING', adminNotes: 'Revisando con el almacén' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'REVIEWING')
  })

  test('HU-35 — aprobar genera nota de crédito en SAP automáticamente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/returns/RET-2025-001',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { status: 'APPROVED', adminNotes: 'Aprobada' }
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.status, 'RESOLVED')
    assert.ok(body.creditNoteId)
    assert.ok(body.creditNoteId.startsWith('CN-'))
  })

  test('admin puede rechazar con motivo', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/returns/RET-2025-002',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { status: 'REJECTED', adminNotes: 'No cumple condiciones de devolución' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'REJECTED')
    assert.ok(res.json().adminNotes)
  })

  test('cliente no puede cambiar el estado — 403', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'PATCH', url: '/admin/returns/RET-2025-001', headers: { authorization: `Bearer ${customerToken(app)}` }, payload: { status: 'APPROVED' } })).statusCode,
      403
    )
  })
})
