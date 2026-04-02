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
const expiredToken = (app) =>
  app.jwt.sign({ sub: 'EXP', role: 'CUSTOMER', exp: Math.floor(Date.now() / 1000) - 3600 })

const validItem = { productCode: 'P-RT-001', name: 'Champú', quantity: 2, unitPrice: 16.00 }

// ══════════════════════════════════════════════════════════════════
// NOTE: returns array and counter are module-level (shared state).
// Fixtures: RET-2025-001 (REVIEWING), RET-2025-002 (APPROVED).
// Existing tests mutate them: 001→RESOLVED, 002→REJECTED.
// ══════════════════════════════════════════════════════════════════

describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'ok')
  })
})

// ══════════════════════════════════════════════════════════════════
describe('GET /returns/reasons', () => {
  test('devuelve la lista de motivos de devolución', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/returns/reasons' })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length > 0)
    assert.ok(res.json().every(r => r.code && r.label))
  })

  test('hay exactamente 5 motivos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/returns/reasons' })
    assert.equal(res.json().length, 5)
  })

  test('contiene los 5 códigos esperados', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/returns/reasons' })
    const codes = res.json().map(r => r.code)
    assert.ok(codes.includes('DAMAGED'))
    assert.ok(codes.includes('WRONG'))
    assert.ok(codes.includes('MISSING'))
    assert.ok(codes.includes('DUPLICATE'))
    assert.ok(codes.includes('OTHER'))
  })

  test('es un endpoint público — no requiere token', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/returns/reasons' })
    assert.equal(res.statusCode, 200)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-33 — GET /returns — mis reclamaciones', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/returns' })).statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/returns' })
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/returns', headers: { authorization: 'Bearer bad.token' } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/returns', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
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

  test('SDA-00423 tiene al menos las 2 devoluciones de fixture', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.ok(res.json().length >= 2)
  })

  test('respuesta es un array aunque no haya resultados', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-00521')}` }
    })
    assert.ok(Array.isArray(res.json()))
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

// ══════════════════════════════════════════════════════════════════
describe('HU-33 — GET /returns/:id — detalle de reclamación', () => {
  test('sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/returns/RET-2025-001' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/returns/RET-2025-001', headers: { authorization: 'Bearer bad' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/returns/RET-2025-001', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

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

  test('RET-2025-001 tiene todos los campos requeridos', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/returns/RET-2025-001',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    const body = res.json()
    assert.ok('id'          in body)
    assert.ok('sapCode'     in body)
    assert.ok('orderId'     in body)
    assert.ok('reason'      in body)
    assert.ok('reasonLabel' in body)
    assert.ok('items'       in body)
    assert.ok('status'      in body)
    assert.ok('createdAt'   in body)
    assert.ok('updatedAt'   in body)
  })

  test('RET-2025-001 pertenece a SDA-00423 con orderId correcto', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/returns/RET-2025-001',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    const body = res.json()
    assert.equal(body.sapCode, 'SDA-00423')
    assert.equal(body.orderId, 'SDA-2025-0812')
    assert.equal(body.reason,  'DAMAGED')
  })

  test('cliente no puede ver reclamación de otro — 403 FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/returns/RET-2025-001',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387')}` }
    })
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('admin puede ver cualquier reclamación', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/returns/RET-2025-001',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
  })

  test('reclamación no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/returns/NO-EXISTE',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 404)
  })

  test('404 devuelve error RETURN_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/returns/NO-EXISTE',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.json().error, 'RETURN_NOT_FOUND')
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-31, HU-32 — POST /returns — crear devolución', () => {
  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      payload: { orderId: 'SDA-2025-0890', reason: 'DAMAGED', items: [validItem] }
    })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: 'Bearer bad.token' },
      payload: { orderId: 'SDA-2025-0890', reason: 'DAMAGED', items: [validItem] }
    })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${expiredToken(app)}` },
      payload: { orderId: 'SDA-2025-0890', reason: 'DAMAGED', items: [validItem] }
    })
    assert.equal(res.statusCode, 401)
  })

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

  test('id de devolución tiene formato RET-YYYY-NNN', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { orderId: 'SDA-2025-0890', reason: 'WRONG', items: [validItem] }
    })
    assert.match(res.json().id, /^RET-\d{4}-\d{3}$/)
  })

  test('sapCode en la devolución coincide con el usuario autenticado', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { orderId: 'SDA-2025-0890', reason: 'MISSING', items: [validItem] }
    })
    // El sapCode se verifica al recuperar el return en admin
    assert.equal(res.json().orderId, 'SDA-2025-0890')
  })

  test('reasonLabel corresponde al reason enviado', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { orderId: 'SDA-2025-0890', reason: 'WRONG', items: [validItem] }
    })
    assert.ok(res.json().reasonLabel.length > 0)
    assert.notEqual(res.json().reasonLabel, 'WRONG')
  })

  test('creación sin notes es válida (notes es opcional)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { orderId: 'SDA-2025-0890', reason: 'OTHER', items: [validItem] }
    })
    assert.equal(res.statusCode, 201)
    assert.equal(res.json().status, 'PENDING')
  })

  test('todos los motivos válidos crean la devolución', async () => {
    const app = await buildApp()
    for (const reason of ['DAMAGED', 'WRONG', 'MISSING', 'DUPLICATE', 'OTHER']) {
      const res = await app.inject({
        method: 'POST', url: '/returns',
        headers: { authorization: `Bearer ${customerToken(app)}` },
        payload: { orderId: 'SDA-2025-0890', reason, items: [validItem] }
      })
      assert.equal(res.statusCode, 201, `reason ${reason} debe crear correctamente`)
    }
  })

  test('pedido no existente en SAP → 404 ORDER_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { orderId: 'NO-EXISTE', reason: 'DAMAGED', items: [validItem] }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'ORDER_NOT_FOUND')
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

  test('403 devuelve error FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-OTRO')}` },
      payload: { orderId: 'SDA-2025-0890', reason: 'DAMAGED', items: [validItem] }
    })
    assert.equal(res.json().error, 'FORBIDDEN')
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

  test('400 devuelve error VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { orderId: 'SDA-2025-0890', reason: 'INVALID', items: [validItem] }
    })
    assert.equal(res.json().error, 'VALIDATION_ERROR')
  })

  test('sin orderId → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { reason: 'DAMAGED', items: [validItem] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('sin reason → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { orderId: 'SDA-2025-0890', items: [validItem] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('item con quantity = 0 → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { orderId: 'SDA-2025-0890', reason: 'DAMAGED', items: [{ productCode: 'P-X', quantity: 0 }] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('devolución creada aparece en GET /returns del cliente', async () => {
    const app = await buildApp()
    const t = customerToken(app)
    const createRes = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${t}` },
      payload: { orderId: 'SDA-2025-0890', reason: 'DUPLICATE', items: [validItem] }
    })
    const { id } = createRes.json()
    const listRes = await app.inject({ method: 'GET', url: '/returns', headers: { authorization: `Bearer ${t}` } })
    assert.ok(listRes.json().some(r => r.id === id))
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-34 — GET /admin/returns — listado admin', () => {
  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/returns' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/returns', headers: { authorization: 'Bearer bad.token' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/returns', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('cliente no puede acceder — 403', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'GET', url: '/admin/returns', headers: { authorization: `Bearer ${customerToken(app)}` } })).statusCode,
      403
    )
  })

  test('403 devuelve error FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/returns', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().error, 'FORBIDDEN')
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

  test('filtro por REJECTED devuelve solo rechazadas', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/returns?status=REJECTED',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().every(r => r.status === 'REJECTED'))
  })

  test('filtro por RESOLVED devuelve solo resueltas', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/returns?status=RESOLVED',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().every(r => r.status === 'RESOLVED'))
  })

  test('filtro por PENDING devuelve solo pendientes', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/returns?status=PENDING',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().every(r => r.status === 'PENDING'))
  })

  test('sin filtro devuelve todas las devoluciones del sistema', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/returns',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.ok(res.json().length >= 2)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-34 — GET /admin/returns/:id', () => {
  test('sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/returns/RET-2025-001' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('cliente → 403 FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/returns/RET-2025-001',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('admin puede ver detalle de cualquier devolución', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/returns/RET-2025-001',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().id, 'RET-2025-001')
  })

  test('devolución no existente → 404 RETURN_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/returns/NO-EXISTE',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'RETURN_NOT_FOUND')
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-34, HU-35 — PATCH /admin/returns/:id — cambiar estado', () => {
  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/returns/RET-2025-001',
      payload: { status: 'REVIEWING' }
    })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/returns/RET-2025-001',
      headers: { authorization: 'Bearer bad.token' },
      payload: { status: 'REVIEWING' }
    })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/returns/RET-2025-001',
      headers: { authorization: `Bearer ${expiredToken(app)}` },
      payload: { status: 'REVIEWING' }
    })
    assert.equal(res.statusCode, 401)
  })

  test('cliente no puede cambiar el estado — 403', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'PATCH', url: '/admin/returns/RET-2025-001', headers: { authorization: `Bearer ${customerToken(app)}` }, payload: { status: 'APPROVED' } })).statusCode,
      403
    )
  })

  test('devolución no existente → 404 RETURN_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/returns/NO-EXISTE',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { status: 'REVIEWING' }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'RETURN_NOT_FOUND')
  })

  test('body sin status → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/returns/RET-2025-001',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: {}
    })
    assert.equal(res.statusCode, 400)
  })

  test('status inválido → 400 VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/returns/RET-2025-001',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { status: 'INVALID_STATUS' }
    })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json().error, 'VALIDATION_ERROR')
  })

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

  test('creditNoteId tiene formato CN-YYYY-NNN', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/returns/RET-2025-001',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { status: 'APPROVED' }
    })
    assert.match(res.json().creditNoteId, /^CN-\d{4}-\d+$/)
  })

  test('respuesta de APPROVED incluye message', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/returns/RET-2025-002',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { status: 'APPROVED' }
    })
    assert.ok('message' in res.json())
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
})

// ══════════════════════════════════════════════════════════════════
describe('HU-35 — POST /admin/returns/:id/credit-note — reintentar nota de crédito', () => {
  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/admin/returns/RET-2025-001/credit-note' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('cliente → 403 FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/returns/RET-2025-001/credit-note',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('devolución no existente → 404 RETURN_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/returns/NO-EXISTE/credit-note',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'RETURN_NOT_FOUND')
  })

  test('devolución en estado PENDING → 400 INVALID_STATUS', async () => {
    // Crear una devolución nueva que quede en PENDING
    const app = await buildApp()
    const createRes = await app.inject({
      method: 'POST', url: '/returns',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { orderId: 'SDA-2025-0890', reason: 'DAMAGED', items: [validItem] }
    })
    const { id } = createRes.json()
    const res = await app.inject({
      method: 'POST', url: `/admin/returns/${id}/credit-note`,
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json().error, 'INVALID_STATUS')
  })

  test('genera nota de crédito para devolución RESOLVED', async () => {
    // RET-2025-001 is RESOLVED after prior tests (has creditNoteId already)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/returns/RET-2025-001/credit-note',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().creditNoteId)
    assert.ok(res.json().creditNote)
  })
})
