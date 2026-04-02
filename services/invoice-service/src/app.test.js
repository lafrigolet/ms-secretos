import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { invoiceRoutes } from './routes/invoices.js'
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
  await app.register(invoiceRoutes, { prefix: '/invoices' })
  return app
}

const token = (app, sub = 'SDA-00423', role = 'CUSTOMER') =>
  app.jwt.sign({ sub, role })
const adminToken = (app) =>
  app.jwt.sign({ sub: 'ADMIN-001', role: 'ADMIN' })
const expiredToken = (app) =>
  app.jwt.sign({ sub: 'EXP-USER', role: 'CUSTOMER', exp: Math.floor(Date.now() / 1000) - 3600 })

// Stub data reference:
// SDA-00423 → [FAC-2025-0890 (total 96, 1 item), FAC-2025-0812 (total 289, 2 items)]
// All other sapCodes → []

// ══════════════════════════════════════════════════════════════════
describe('HU-20 — Lista de facturas (GET /invoices)', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/invoices' })).statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices' })
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices', headers: { authorization: 'Bearer bad.token.here' } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('lista facturas del cliente autenticado', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(Array.isArray(body))
    assert.ok(body.length > 0)
    assert.ok(body.every(i => i.invoiceId && i.orderId && i.total))
  })

  test('SDA-00423 tiene exactamente 2 facturas', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().length, 2)
  })

  test('lista contiene FAC-2025-0890 y FAC-2025-0812', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices', headers: { authorization: `Bearer ${token(app)}` } })
    const ids = res.json().map(i => i.invoiceId)
    assert.ok(ids.includes('FAC-2025-0890'))
    assert.ok(ids.includes('FAC-2025-0812'))
  })

  test('cada factura tiene invoiceId, orderId, date, total, status', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices', headers: { authorization: `Bearer ${token(app)}` } })
    for (const inv of res.json()) {
      assert.ok('invoiceId' in inv)
      assert.ok('orderId'   in inv)
      assert.ok('date'      in inv)
      assert.ok('total'     in inv)
      assert.ok('status'    in inv)
    }
  })

  test('lista NO expone sapCode ni items (campos internos)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices', headers: { authorization: `Bearer ${token(app)}` } })
    for (const inv of res.json()) {
      assert.ok(!('sapCode' in inv))
      assert.ok(!('items'   in inv))
    }
  })

  test('FAC-2025-0890 tiene total 96.00', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices', headers: { authorization: `Bearer ${token(app)}` } })
    const fac = res.json().find(i => i.invoiceId === 'FAC-2025-0890')
    assert.equal(fac.total, 96.00)
  })

  test('FAC-2025-0812 tiene total 289.00', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices', headers: { authorization: `Bearer ${token(app)}` } })
    const fac = res.json().find(i => i.invoiceId === 'FAC-2025-0812')
    assert.equal(fac.total, 289.00)
  })

  test('cliente sin facturas devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices', headers: { authorization: `Bearer ${token(app, 'SDA-OTRO')}` } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), [])
  })

  test('admin puede listar sus facturas (ADMIN-001 no tiene → [])', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-20 — Detalle de factura (GET /invoices/:invoiceId)', () => {
  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890', headers: { authorization: 'Bearer tampered.token' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('obtiene datos de una factura concreta', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().invoiceId, 'FAC-2025-0890')
    assert.ok(res.json().items)
  })

  test('FAC-2025-0890 tiene todos sus campos correctos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890', headers: { authorization: `Bearer ${token(app)}` } })
    const body = res.json()
    assert.equal(body.invoiceId, 'FAC-2025-0890')
    assert.equal(body.orderId,   'SDA-2025-0890')
    assert.equal(body.sapCode,   'SDA-00423')
    assert.equal(body.total,     96.00)
    assert.equal(body.date,      '2025-03-08')
  })

  test('FAC-2025-0890 tiene 1 item con datos correctos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890', headers: { authorization: `Bearer ${token(app)}` } })
    const items = res.json().items
    assert.equal(items.length, 1)
    assert.equal(items[0].productCode, 'P-RT-001')
    assert.equal(items[0].name,        'Champú Restaurador')
    assert.equal(items[0].quantity,    6)
    assert.equal(items[0].unitPrice,   16.00)
  })

  test('FAC-2025-0812 tiene 2 items y total 289.00', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0812', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().total, 289.00)
    assert.equal(res.json().items.length, 2)
  })

  test('FAC-2025-0812 incluye P-RT-002 y P-RT-003', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0812', headers: { authorization: `Bearer ${token(app)}` } })
    const codes = res.json().items.map(i => i.productCode)
    assert.ok(codes.includes('P-RT-002'))
    assert.ok(codes.includes('P-RT-003'))
  })

  test('factura no existente devuelve 404', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/invoices/NO-EXISTE', headers: { authorization: `Bearer ${token(app)}` } })).statusCode, 404)
  })

  test('404 devuelve error INVOICE_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/NO-EXISTE', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().error, 'INVOICE_NOT_FOUND')
  })

  test('cliente no puede ver factura de otro — 403', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890', headers: { authorization: `Bearer ${token(app, 'SDA-OTRO')}` } })).statusCode,
      403
    )
  })

  test('403 devuelve error FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890', headers: { authorization: `Bearer ${token(app, 'SDA-OTRO')}` } })
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('admin puede ver cualquier factura', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890', headers: { authorization: `Bearer ${adminToken(app)}` } })).statusCode,
      200
    )
  })

  test('admin puede ver FAC-2025-0812', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0812', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().invoiceId, 'FAC-2025-0812')
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-20 — Descarga de factura (GET /invoices/:invoiceId/download)', () => {
  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890/download' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890/download', headers: { authorization: 'Bearer bad.token' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890/download', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('endpoint de descarga devuelve URL del PDF', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890/download', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().downloadUrl)
  })

  test('downloadUrl contiene el invoiceId', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890/download', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(res.json().downloadUrl.includes('FAC-2025-0890'))
  })

  test('respuesta incluye invoiceId y message', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890/download', headers: { authorization: `Bearer ${token(app)}` } })
    const body = res.json()
    assert.ok('invoiceId' in body)
    assert.ok('message'   in body)
    assert.equal(body.invoiceId, 'FAC-2025-0890')
  })

  test('factura no existente → 404 INVOICE_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/NO-EXISTE/download', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'INVOICE_NOT_FOUND')
  })

  test('cliente no puede descargar factura ajena — 403 FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890/download', headers: { authorization: `Bearer ${token(app, 'SDA-OTRO')}` } })
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('admin puede descargar cualquier factura', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890/download', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().downloadUrl)
  })

  test('admin puede descargar FAC-2025-0812', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0812/download', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().downloadUrl.includes('FAC-2025-0812'))
  })
})
