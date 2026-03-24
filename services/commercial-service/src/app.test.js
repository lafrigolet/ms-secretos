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
const expiredToken     = (app)                     => app.jwt.sign({ sub: 'EXP-USER',             role: 'CUSTOMER', exp: Math.floor(Date.now() / 1000) - 3600 })

// Stub data reference:
// commercials: COM-001 (Marta Soler, Cataluña y Baleares), COM-002 (Javier Ruiz), COM-003 (Laura Pérez)
// assignments: SDA-00423→COM-001, SDA-00521→COM-001, SDA-00387→COM-002, SDA-00187→COM-003, SDA-00098→COM-003
// suggestedOrders: SUG-001 (SDA-00423, COM-001, PENDING)
// NOTE: existing tests mutate shared state:
//   HU-45: "comercial crea pedido sugerido" → SUG-002 created (PENDING, SDA-00423)
//   HU-45: "cliente acepta SUG-001" → SUG-001.status=ACCEPTED
//   HU-47: "admin asigna COM-001 a SDA-00387" → SDA-00387.commercialId=COM-001

// ══════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
  })

  test('devuelve service name que incluye commercial', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.ok(res.json().service.includes('commercial'))
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-44 — Comercial asignado al cliente', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/commercial/my-commercial' })).statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/my-commercial' })
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/my-commercial', headers: { authorization: 'Bearer bad.token.here' } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/my-commercial', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
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

  test('SDA-00423 → COM-001 (Marta Soler, Cataluña y Baleares)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/my-commercial', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const body = res.json()
    assert.equal(body.name, 'Marta Soler')
    assert.equal(body.zone, 'Cataluña y Baleares')
    assert.ok(body.email.includes('@secretosdelagua.com'))
  })

  test('SDA-00423 response incluye id, name, email, phone, zone, assignedAt', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/my-commercial', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const body = res.json()
    assert.ok('id'         in body)
    assert.ok('name'       in body)
    assert.ok('email'      in body)
    assert.ok('phone'      in body)
    assert.ok('zone'       in body)
    assert.ok('assignedAt' in body)
  })

  test('SDA-00521 → también COM-001', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/my-commercial', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00521')}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().id, 'COM-001')
  })

  test('SDA-00187 → COM-003 (Laura Pérez, Levante y Andalucía)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/my-commercial', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00187')}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().id, 'COM-003')
    assert.equal(res.json().name, 'Laura Pérez')
  })

  test('cliente sin comercial asignado devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/my-commercial', headers: { authorization: `Bearer ${customerToken(app, 'SDA-NUEVO')}` } })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'NO_COMMERCIAL_ASSIGNED')
  })

  test('admin sin asignación → 404 NO_COMMERCIAL_ASSIGNED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/my-commercial', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'NO_COMMERCIAL_ASSIGNED')
  })
})

// ══════════════════════════════════════════════════════════════════
// NOTE: HU-45 tests below mutate shared state:
//   "comercial crea pedido sugerido" → SUG-002 created (PENDING, SDA-00423, COM-001)
//   "cliente acepta SUG-001"         → SUG-001.status = ACCEPTED, respondedAt set
describe('HU-45 — Pedidos sugeridos', () => {
  test('sin token GET /suggested-orders → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/suggested-orders' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado GET /suggested-orders → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/suggested-orders', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('cliente ve sus pedidos sugeridos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/suggested-orders', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length > 0)
  })

  test('pedidos sugeridos de SDA-00423 incluyen SUG-001', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/suggested-orders', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const ids = res.json().map(s => s.id)
    assert.ok(ids.includes('SUG-001'))
  })

  test('cliente sin sugerencias devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/suggested-orders', headers: { authorization: `Bearer ${customerToken(app, 'SDA-NUEVO')}` } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), [])
  })

  test('cada pedido sugerido tiene id, sapCode, items, status, createdAt', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/suggested-orders', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const sug = res.json()[0]
    assert.ok('id'          in sug)
    assert.ok('sapCode'     in sug)
    assert.ok('items'       in sug)
    assert.ok('status'      in sug)
    assert.ok('createdAt'   in sug)
    assert.ok('commercialId' in sug)
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

// ══════════════════════════════════════════════════════════════════
describe('HU-46 — Cartera del comercial', () => {
  test('cliente no puede ver la cartera — 403', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/commercial/portfolio', headers: { authorization: `Bearer ${customerToken(app)}` } })).statusCode, 403)
  })

  test('403 devuelve error FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().error, 'FORBIDDEN')
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

  test('cartera de COM-001 incluye SDA-00423 y SDA-00521', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio', headers: { authorization: `Bearer ${commercialToken(app)}` } })
    const codes = res.json().map(c => c.sapCode)
    assert.ok(codes.includes('SDA-00423'))
    assert.ok(codes.includes('SDA-00521'))
  })

  test('cada cliente en cartera tiene sapCode, assignedAt, totalOrders, pendingSuggestions', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio', headers: { authorization: `Bearer ${commercialToken(app)}` } })
    for (const c of res.json()) {
      assert.ok('sapCode'            in c)
      assert.ok('assignedAt'         in c)
      assert.ok('totalOrders'        in c)
      assert.ok('pendingSuggestions' in c)
    }
  })

  test('comercial ve historial de un cliente de su cartera', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio/SDA-00423/orders', headers: { authorization: `Bearer ${commercialToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().customer)
    assert.ok(Array.isArray(res.json().orders))
  })

  test('portfolio/:sapCode/orders tiene customer, orders y suggestions', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio/SDA-00423/orders', headers: { authorization: `Bearer ${commercialToken(app)}` } })
    const body = res.json()
    assert.ok('customer'    in body)
    assert.ok('orders'      in body)
    assert.ok('suggestions' in body)
    assert.ok(Array.isArray(body.orders))
    assert.ok(Array.isArray(body.suggestions))
  })

  test('customer de SDA-00423 tiene name=Rosa Canals', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio/SDA-00423/orders', headers: { authorization: `Bearer ${commercialToken(app)}` } })
    assert.equal(res.json().customer.name, 'Rosa Canals')
    assert.equal(res.json().customer.businessName, 'Salón Canals Barcelona')
  })

  test('comercial no puede ver clientes de otra cartera', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio/SDA-00387/orders', headers: { authorization: `Bearer ${commercialToken(app)}` } })
    assert.equal(res.statusCode, 403)
  })

  test('403 devuelve FORBIDDEN al ver cliente de otra cartera', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio/SDA-00387/orders', headers: { authorization: `Bearer ${commercialToken(app)}` } })
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('admin puede ver cualquier cartera', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio/SDA-00423/orders', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
  })

  test('admin sin commercialId → 400 MISSING_COMMERCIAL_ID en GET /portfolio', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json().error, 'MISSING_COMMERCIAL_ID')
  })

  test('admin con ?commercialId=COM-001 ve cartera de COM-001', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio?commercialId=COM-001', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().some(c => c.sapCode === 'SDA-00423'))
  })

  test('GET /portfolio sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('GET /portfolio token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('GET /portfolio/:sapCode/orders sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio/SDA-00423/orders' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })
})

// ══════════════════════════════════════════════════════════════════
// NOTE: HU-47 mutates: SDA-00387 gets reassigned to COM-001
describe('HU-47 — Asignación de comerciales (admin)', () => {
  test('cliente no puede listar comerciales — 403', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/commercial/commercials', headers: { authorization: `Bearer ${customerToken(app)}` } })).statusCode, 403)
  })

  test('GET /commercials sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/commercials' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('GET /commercials token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/commercials', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('admin lista todos los comerciales', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/commercials', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().length >= 3)
  })

  test('lista contiene exactamente 3 comerciales', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/commercials', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.json().length, 3)
  })

  test('cada comercial tiene id, name, email, phone, zone, role', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/commercials', headers: { authorization: `Bearer ${adminToken(app)}` } })
    for (const c of res.json()) {
      assert.ok('id'    in c)
      assert.ok('name'  in c)
      assert.ok('email' in c)
      assert.ok('phone' in c)
      assert.ok('zone'  in c)
      assert.ok('role'  in c)
    }
  })

  test('lista incluye COM-001 (Marta Soler)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/commercials', headers: { authorization: `Bearer ${adminToken(app)}` } })
    const com = res.json().find(c => c.id === 'COM-001')
    assert.ok(com)
    assert.equal(com.name, 'Marta Soler')
    assert.equal(com.zone, 'Cataluña y Baleares')
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

  test('404 devuelve COMMERCIAL_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/commercial/assignments/SDA-00387',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { commercialId: 'COM-999' }
    })
    assert.equal(res.json().error, 'COMMERCIAL_NOT_FOUND')
  })

  test('admin lista todas las asignaciones', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/assignments', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
  })

  test('PATCH /assignments sin commercialId → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/commercial/assignments/SDA-00423',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: {}
    })
    assert.equal(res.statusCode, 400)
  })

  test('PATCH /assignments sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/commercial/assignments/SDA-00423', payload: { commercialId: 'COM-001' } })
    assert.equal(res.statusCode, 401)
  })

  test('PATCH /assignments cliente → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/commercial/assignments/SDA-00423', headers: { authorization: `Bearer ${customerToken(app)}` }, payload: { commercialId: 'COM-001' } })
    assert.equal(res.statusCode, 403)
  })

  test('GET /assignments sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/assignments' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('GET /assignments cliente → 403 FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/assignments', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('asignaciones tienen sapCode y commercialId', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/assignments', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.ok(res.json().length > 0)
    for (const a of res.json()) {
      assert.ok('sapCode'      in a)
      assert.ok('commercialId' in a)
      assert.ok('assignedAt'   in a)
    }
  })

  test('asignaciones incluyen SDA-00423 → COM-001', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/assignments', headers: { authorization: `Bearer ${adminToken(app)}` } })
    const assignment = res.json().find(a => a.sapCode === 'SDA-00423')
    assert.ok(assignment)
    assert.equal(assignment.commercialId, 'COM-001')
  })
})

// ══════════════════════════════════════════════════════════════════
// Tests run AFTER all mutations:
// SUG-001 status=ACCEPTED, SUG-002 created (PENDING), SDA-00387 → COM-001

describe('HU-45 — Estado post-mutación de pedidos sugeridos', () => {
  test('SUG-001 ya respondido → 400 ALREADY_RESPONDED', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/commercial/suggested-orders/SUG-001/respond',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { status: 'REJECTED' }
    })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json().error, 'ALREADY_RESPONDED')
  })

  test('responder pedido inexistente → 404 NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/commercial/suggested-orders/SUG-999/respond',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { status: 'ACCEPTED' }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'NOT_FOUND')
  })

  test('PATCH /respond sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/commercial/suggested-orders/SUG-002/respond', payload: { status: 'ACCEPTED' } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('PATCH /respond token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/commercial/suggested-orders/SUG-002/respond',
      headers: { authorization: `Bearer ${expiredToken(app)}` },
      payload: { status: 'ACCEPTED' }
    })
    assert.equal(res.statusCode, 401)
  })

  test('cliente puede rechazar SUG-002 (aún PENDING)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/commercial/suggested-orders/SUG-002/respond',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { status: 'REJECTED' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'REJECTED')
    assert.ok(res.json().respondedAt)
  })

  test('SDA-00423 tiene al menos 2 pedidos sugeridos (SUG-001, SUG-002)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/suggested-orders', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.ok(res.json().length >= 2)
  })
})

describe('HU-45 — Validación POST /suggested-orders', () => {
  test('POST sin sapCode → 400 VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/commercial/suggested-orders',
      headers: { authorization: `Bearer ${commercialToken(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 1 }] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('POST sin items → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/commercial/suggested-orders',
      headers: { authorization: `Bearer ${commercialToken(app)}` },
      payload: { sapCode: 'SDA-00423' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('POST con items vacío → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/commercial/suggested-orders',
      headers: { authorization: `Bearer ${commercialToken(app)}` },
      payload: { sapCode: 'SDA-00423', items: [] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('POST sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/commercial/suggested-orders', payload: { sapCode: 'SDA-00423', items: [{ productCode: 'P-RT-001', quantity: 1 }] } })
    assert.equal(res.statusCode, 401)
  })

  test('POST cliente → 403 FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/commercial/suggested-orders',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { sapCode: 'SDA-00423', items: [{ productCode: 'P-RT-001', quantity: 1 }] }
    })
    assert.equal(res.statusCode, 403)
  })

  test('admin puede crear pedido sugerido para cualquier cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/commercial/suggested-orders',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { sapCode: 'SDA-00521', items: [{ productCode: 'P-RT-002', quantity: 3 }] }
    })
    assert.equal(res.statusCode, 201)
    assert.ok(res.json().id.startsWith('SUG-'))
    assert.equal(res.json().status, 'PENDING')
  })

  test('respuesta de POST incluye id, sapCode, items, status, commercialId, createdAt', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/commercial/suggested-orders',
      headers: { authorization: `Bearer ${commercialToken(app)}` },
      payload: { sapCode: 'SDA-00423', message: 'Nuevo pedido sugerido', items: [{ productCode: 'P-SN-001', quantity: 2 }] }
    })
    assert.equal(res.statusCode, 201)
    const body = res.json()
    assert.ok('id'           in body)
    assert.ok('sapCode'      in body)
    assert.ok('items'        in body)
    assert.ok('status'       in body)
    assert.ok('commercialId' in body)
    assert.ok('createdAt'    in body)
    assert.equal(body.sapCode, 'SDA-00423')
    assert.equal(body.respondedAt, null)
  })
})

describe('HU-47 — SDA-00387 reasignado a COM-001', () => {
  // After HU-47 tests: SDA-00387 is assigned to COM-001

  test('SDA-00387 ahora tiene COM-001 como comercial', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/my-commercial', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387')}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().id, 'COM-001')
  })

  test('COM-001 ahora puede ver SDA-00387 en su cartera', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/portfolio/SDA-00387/orders', headers: { authorization: `Bearer ${commercialToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().customer)
  })

  test('asignaciones reflejan la nueva asignación de SDA-00387', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/commercial/assignments', headers: { authorization: `Bearer ${adminToken(app)}` } })
    const assignment = res.json().find(a => a.sapCode === 'SDA-00387')
    assert.ok(assignment)
    assert.equal(assignment.commercialId, 'COM-001')
  })
})
