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
process.env.SAP_INTEGRATION_URL = 'http://localhost:3010'

// ── Mock de global.fetch ──────────────────────────────────────────
// clients/SapIntegrationClient.js usa HttpClient que internamente
// usa fetch. Interceptamos las llamadas al sap-integration-service.
const ORDERS = [
  { orderId: 'SDA-2025-0890', sapCode: 'SDA-00423', date: '2025-03-08', status: 'DELIVERED', total: 96.00, invoiceId: 'FAC-2025-0890' },
  { orderId: 'SDA-2025-0812', sapCode: 'SDA-00423', date: '2025-02-21', status: 'DELIVERED', total: 289.00, invoiceId: 'FAC-2025-0812' }
]
const INVOICE = {
  invoiceId: 'FAC-2025-0890', orderId: 'SDA-2025-0890', sapCode: 'SDA-00423',
  date: '2025-03-08', total: 96.00,
  items: [{ productCode: 'P-RT-001', name: 'Champú', quantity: 6, unitPrice: 16.00 }],
  pdfUrl: '/invoices/FAC-2025-0890/download'
}

global.fetch = async (url) => {
  const path = url.replace('http://localhost:3010', '')
  if (path === '/internal/orders/SDA-00423') return { ok: true, json: async () => ORDERS }
  if (path === '/internal/orders/SDA-OTRO')  return { ok: true, json: async () => [] }
  if (path === '/internal/orders/invoice/FAC-2025-0890') return { ok: true, json: async () => INVOICE }
  if (path === '/internal/orders/invoice/NO-EXISTE') return { ok: false, status: 404, json: async () => null }
  return { ok: false, status: 404, json: async () => null }
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
  await app.register(invoiceRoutes, { prefix: '/invoices' })
  return app
}

const token = (app, sub = 'SDA-00423', role = 'CUSTOMER') =>
  app.jwt.sign({ sub, role })

// ══════════════════════════════════════════════════════════════════
describe('HU-20 — Facturas', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/invoices' })).statusCode, 401)
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

  test('cliente sin facturas devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices', headers: { authorization: `Bearer ${token(app, 'SDA-OTRO')}` } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), [])
  })

  test('obtiene datos de una factura concreta', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().invoiceId, 'FAC-2025-0890')
    assert.ok(res.json().items)
  })

  test('factura no existente devuelve 404', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/invoices/NO-EXISTE', headers: { authorization: `Bearer ${token(app)}` } })).statusCode, 404)
  })

  test('cliente no puede ver factura de otro — 403', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890', headers: { authorization: `Bearer ${token(app, 'SDA-OTRO')}` } })).statusCode,
      403
    )
  })

  test('admin puede ver cualquier factura', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890', headers: { authorization: `Bearer ${token(app, 'ADMIN-001', 'ADMIN')}` } })).statusCode,
      200
    )
  })

  test('endpoint de descarga devuelve URL del PDF', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/invoices/FAC-2025-0890/download', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().downloadUrl)
  })
})
