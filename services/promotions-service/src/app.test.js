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

// ── Helpers para crear promos desechables en tests de mutación ────
async function createPromo (app, overrides = {}) {
  const res = await app.inject({
    method: 'POST', url: '/promotions/admin',
    headers: { authorization: `Bearer ${adminToken(app)}` },
    payload: {
      name: 'Promo Test Temporal',
      type: 'GIFT',
      profiles: ['VIP'],
      condition: { minOrderTotal: 500 },
      benefit: { type: 'GIFT', description: 'Regalo temporal' },
      ...overrides
    }
  })
  return res.json()
}

// ══════════════════════════════════════════════════════════════════
// HU-10 — Promociones activas por perfil
// ══════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════
// HU-12, HU-13 — Cálculo de beneficios
// ══════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════
// HU-11 — Gestión de promociones (admin)
// ══════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════
// GET /promotions — Autenticación (cobertura adicional)
// NOTA: en este punto PROMO-001 está inactiva (toggled en el bloque anterior)
// ══════════════════════════════════════════════════════════════════
describe('GET /promotions — Autenticación (cobertura adicional)', () => {
  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/promotions' })).json().error, 'UNAUTHORIZED')
  })

  test('token manipulado devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions', headers: { authorization: 'Bearer token.invalido.xyz' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado devuelve 401', async () => {
    const app = await buildApp()
    const expired = app.jwt.sign({ sub: 'SDA-00423', profile: 'PREMIUM', role: 'CUSTOMER' }, { expiresIn: '1ms' })
    await new Promise(r => setTimeout(r, 50))
    const res = await app.inject({ method: 'GET', url: '/promotions', headers: { authorization: `Bearer ${expired}` } })
    assert.equal(res.statusCode, 401)
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-10 — Estructura y filtrado de promociones (cobertura adicional)
// ══════════════════════════════════════════════════════════════════
describe('HU-10 — Estructura y filtrado por perfil (cobertura adicional)', () => {
  test('la respuesta es un array', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(Array.isArray(res.json()))
  })

  test('cada promoción tiene id, name, type, profiles, active, condition, benefit', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions', headers: { authorization: `Bearer ${token(app)}` } })
    for (const p of res.json()) {
      for (const field of ['id', 'name', 'type', 'profiles', 'active', 'condition', 'benefit']) {
        assert.ok(field in p, `promo ${p.id} falta campo ${field}`)
      }
    }
  })

  test('solo se devuelven promociones activas', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(res.json().every(p => p.active === true))
  })

  test('STANDARD recibe PROMO-002 (descuento en P-BN-001)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions', headers: { authorization: `Bearer ${token(app, 'STANDARD')}` } })
    assert.ok(res.json().some(p => p.id === 'PROMO-002'))
  })

  test('STANDARD no recibe PROMO-003 (solo PREMIUM y VIP)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions', headers: { authorization: `Bearer ${token(app, 'STANDARD')}` } })
    assert.ok(!res.json().some(p => p.id === 'PROMO-003'))
  })

  test('PREMIUM recibe PROMO-002 y PROMO-003', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions', headers: { authorization: `Bearer ${token(app, 'PREMIUM')}` } })
    const ids = res.json().map(p => p.id)
    assert.ok(ids.includes('PROMO-002'), 'PREMIUM debe recibir PROMO-002')
    assert.ok(ids.includes('PROMO-003'), 'PREMIUM debe recibir PROMO-003')
  })

  test('PREMIUM no recibe PROMO-001 (está inactiva)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions', headers: { authorization: `Bearer ${token(app, 'PREMIUM')}` } })
    assert.ok(!res.json().some(p => p.id === 'PROMO-001'))
  })

  test('VIP recibe PROMO-002 y PROMO-003', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions', headers: { authorization: `Bearer ${token(app, 'VIP')}` } })
    const ids = res.json().map(p => p.id)
    assert.ok(ids.includes('PROMO-002'), 'VIP debe recibir PROMO-002')
    assert.ok(ids.includes('PROMO-003'), 'VIP debe recibir PROMO-003')
  })
})

// ══════════════════════════════════════════════════════════════════
// POST /promotions/calculate — Validación de esquema
// ══════════════════════════════════════════════════════════════════
describe('POST /promotions/calculate — Validación de esquema', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/promotions/calculate', payload: { items: [], orderTotal: 100 } })
    assert.equal(res.statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/promotions/calculate', payload: { items: [], orderTotal: 100 } })
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/promotions/calculate', headers: { authorization: 'Bearer invalido.x.y' }, payload: { items: [], orderTotal: 100 } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado devuelve 401', async () => {
    const app = await buildApp()
    const expired = app.jwt.sign({ sub: 'SDA-00423', profile: 'PREMIUM', role: 'CUSTOMER' }, { expiresIn: '1ms' })
    await new Promise(r => setTimeout(r, 50))
    const res = await app.inject({ method: 'POST', url: '/promotions/calculate', headers: { authorization: `Bearer ${expired}` }, payload: { items: [], orderTotal: 100 } })
    assert.equal(res.statusCode, 401)
  })

  test('body sin items devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/promotions/calculate', headers: { authorization: `Bearer ${token(app)}` }, payload: { orderTotal: 100 } })
    assert.equal(res.statusCode, 400)
  })

  test('body sin orderTotal devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/promotions/calculate', headers: { authorization: `Bearer ${token(app)}` }, payload: { items: [] } })
    assert.equal(res.statusCode, 400)
  })

  test('body vacío devuelve 400 con VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/promotions/calculate', headers: { authorization: `Bearer ${token(app)}` }, payload: {} })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json().error, 'VALIDATION_ERROR')
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-12, HU-13 — Cálculo de beneficios (cobertura adicional)
// ══════════════════════════════════════════════════════════════════
describe('HU-12, HU-13 — Cálculo de beneficios (cobertura adicional)', () => {
  test('la respuesta tiene los campos benefits y count', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/calculate',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [], orderTotal: 0 }
    })
    assert.equal(res.statusCode, 200)
    assert.ok('benefits' in res.json())
    assert.ok('count' in res.json())
    assert.ok(Array.isArray(res.json().benefits))
  })

  test('count coincide con el número de benefits', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/calculate',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [], orderTotal: 300 }
    })
    assert.equal(res.json().count, res.json().benefits.length)
  })

  test('cada benefit tiene promoId, promoName y benefit', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/calculate',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [], orderTotal: 300 }
    })
    for (const b of res.json().benefits) {
      assert.ok('promoId' in b, 'falta promoId')
      assert.ok('promoName' in b, 'falta promoName')
      assert.ok('benefit' in b, 'falta benefit')
    }
  })

  test('STANDARD con 1× P-BN-001 recibe descuento PROMO-002', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/calculate',
      headers: { authorization: `Bearer ${token(app, 'STANDARD')}` },
      payload: { items: [{ productCode: 'P-BN-001', quantity: 1 }], orderTotal: 26 }
    })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().benefits.some(b => b.promoId === 'PROMO-002'))
  })

  test('PROMO-002 benefit es de tipo DISCOUNT con valor 15 PERCENT', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/calculate',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-BN-001', quantity: 1 }], orderTotal: 26 }
    })
    const promo2 = res.json().benefits.find(b => b.promoId === 'PROMO-002')
    assert.ok(promo2, 'PROMO-002 debe aplicarse')
    assert.equal(promo2.benefit.type, 'DISCOUNT')
    assert.equal(promo2.benefit.value, 15)
    assert.equal(promo2.benefit.unit, 'PERCENT')
  })

  test('PREMIUM con 6× P-RT-001 no recibe PROMO-001 (está inactiva)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/calculate',
      headers: { authorization: `Bearer ${token(app, 'PREMIUM')}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 6 }], orderTotal: 96 }
    })
    assert.ok(!res.json().benefits.some(b => b.promoId === 'PROMO-001'), 'PROMO-001 inactiva no debe aplicarse')
  })

  test('PREMIUM con 5× P-RT-001 (bajo umbral) no recibe PROMO-001', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/calculate',
      headers: { authorization: `Bearer ${token(app, 'PREMIUM')}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 5 }], orderTotal: 80 }
    })
    assert.ok(!res.json().benefits.some(b => b.promoId === 'PROMO-001'))
  })

  test('STANDARD no recibe PROMO-003 aunque supere 250€', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/calculate',
      headers: { authorization: `Bearer ${token(app, 'STANDARD')}` },
      payload: { items: [], orderTotal: 300 }
    })
    assert.ok(!res.json().benefits.some(b => b.promoId === 'PROMO-003'), 'STANDARD no tiene acceso a PROMO-003')
  })

  test('PREMIUM con 300€ recibe PROMO-003', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/calculate',
      headers: { authorization: `Bearer ${token(app, 'PREMIUM')}` },
      payload: { items: [], orderTotal: 300 }
    })
    assert.ok(res.json().benefits.some(b => b.promoId === 'PROMO-003'))
  })

  test('PREMIUM con P-BN-001 y 300€ recibe PROMO-002 y PROMO-003', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/calculate',
      headers: { authorization: `Bearer ${token(app, 'PREMIUM')}` },
      payload: { items: [{ productCode: 'P-BN-001', quantity: 2 }], orderTotal: 300 }
    })
    const ids = res.json().benefits.map(b => b.promoId)
    assert.ok(ids.includes('PROMO-002'), 'debe incluir PROMO-002')
    assert.ok(ids.includes('PROMO-003'), 'debe incluir PROMO-003')
  })
})

// ══════════════════════════════════════════════════════════════════
// GET /promotions/admin — Autenticación y cobertura adicional
// ══════════════════════════════════════════════════════════════════
describe('GET /promotions/admin — Autenticación y cobertura adicional', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/promotions/admin' })).statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/promotions/admin' })).json().error, 'UNAUTHORIZED')
  })

  test('token expirado devuelve 401', async () => {
    const app = await buildApp()
    const expired = app.jwt.sign({ sub: 'ADMIN-001', profile: 'ADMIN', role: 'ADMIN' }, { expiresIn: '1ms' })
    await new Promise(r => setTimeout(r, 50))
    const res = await app.inject({ method: 'GET', url: '/promotions/admin', headers: { authorization: `Bearer ${expired}` } })
    assert.equal(res.statusCode, 401)
  })

  test('cliente normal devuelve 403 con error FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions/admin', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('incluye promociones inactivas en la lista', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions/admin', headers: { authorization: `Bearer ${adminToken(app)}` } })
    // PROMO-001 fue desactivada en los tests anteriores — debe seguir en la lista
    assert.ok(res.json().some(p => p.id === 'PROMO-001'))
    assert.ok(res.json().some(p => p.active === false))
  })

  test('lista tiene al menos las 3 promociones originales', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions/admin', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.ok(res.json().length >= 3)
  })

  test('cada promoción tiene id, name, type, active, profiles, condition, benefit', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promotions/admin', headers: { authorization: `Bearer ${adminToken(app)}` } })
    for (const p of res.json()) {
      for (const field of ['id', 'name', 'type', 'active', 'profiles', 'condition', 'benefit']) {
        assert.ok(field in p, `promo ${p.id} falta campo ${field}`)
      }
    }
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-11 — Crear promoción (cobertura adicional)
// ══════════════════════════════════════════════════════════════════
describe('HU-11 — Crear promoción (cobertura adicional)', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/promotions/admin', payload: { name: 'X', type: 'GIFT', profiles: ['VIP'], condition: {}, benefit: {} } })
    assert.equal(res.statusCode, 401)
  })

  test('cliente normal devuelve 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/promotions/admin', headers: { authorization: `Bearer ${token(app)}` }, payload: { name: 'X', type: 'GIFT', profiles: ['VIP'], condition: {}, benefit: {} } })
    assert.equal(res.statusCode, 403)
  })

  test('body sin name devuelve 400 VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/promotions/admin', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { type: 'GIFT', profiles: ['VIP'], condition: {}, benefit: {} } })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json().error, 'VALIDATION_ERROR')
  })

  test('body sin type devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/promotions/admin', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { name: 'X', profiles: ['VIP'], condition: {}, benefit: {} } })
    assert.equal(res.statusCode, 400)
  })

  test('type inválido devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/promotions/admin', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { name: 'X', type: 'INVALID', profiles: ['VIP'], condition: {}, benefit: {} } })
    assert.equal(res.statusCode, 400)
  })

  test('body sin profiles devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/promotions/admin', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { name: 'X', type: 'GIFT', condition: {}, benefit: {} } })
    assert.equal(res.statusCode, 400)
  })

  test('body sin condition devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/promotions/admin', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { name: 'X', type: 'GIFT', profiles: ['VIP'], benefit: {} } })
    assert.equal(res.statusCode, 400)
  })

  test('body sin benefit devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/promotions/admin', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { name: 'X', type: 'GIFT', profiles: ['VIP'], condition: {} } })
    assert.equal(res.statusCode, 400)
  })

  test('nueva promoción tiene active: true por defecto', async () => {
    const app = await buildApp()
    const promo = await createPromo(app)
    assert.equal(promo.active, true)
  })

  test('nueva promoción tiene un id generado que empieza por PROMO-', async () => {
    const app = await buildApp()
    const promo = await createPromo(app)
    assert.ok(promo.id.startsWith('PROMO-'), `id inesperado: ${promo.id}`)
  })

  test('la respuesta incluye todos los campos del payload enviado', async () => {
    const app = await buildApp()
    const payload = { name: 'Promo Validación', type: 'DISCOUNT', profiles: ['STANDARD'], condition: { minOrderTotal: 50 }, benefit: { type: 'DISCOUNT', value: 10, unit: 'PERCENT' } }
    const res = await app.inject({ method: 'POST', url: '/promotions/admin', headers: { authorization: `Bearer ${adminToken(app)}` }, payload })
    const body = res.json()
    assert.equal(body.name, payload.name)
    assert.equal(body.type, payload.type)
    assert.deepEqual(body.profiles, payload.profiles)
  })

  test('description es opcional — no devuelve 400 si falta', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/promotions/admin',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { name: 'Sin descripción', type: 'GIFT', profiles: ['VIP'], condition: {}, benefit: { type: 'GIFT', description: 'x' } }
    })
    assert.equal(res.statusCode, 201)
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-11 — Editar promoción
// ══════════════════════════════════════════════════════════════════
describe('HU-11 — Editar promoción', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/promotions/admin/PROMO-002', payload: { name: 'Nuevo nombre' } })
    assert.equal(res.statusCode, 401)
  })

  test('cliente normal devuelve 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/promotions/admin/PROMO-002', headers: { authorization: `Bearer ${token(app)}` }, payload: { name: 'Nuevo nombre' } })
    assert.equal(res.statusCode, 403)
  })

  test('id no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/promotions/admin/PROMO-INEXISTENTE', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { name: 'X' } })
    assert.equal(res.statusCode, 404)
  })

  test('id no existente devuelve error PROMO_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/promotions/admin/PROMO-INEXISTENTE', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { name: 'X' } })
    assert.equal(res.json().error, 'PROMO_NOT_FOUND')
  })

  test('admin actualiza el nombre de una promoción', async () => {
    const app = await buildApp()
    const promo = await createPromo(app, { name: 'Nombre original' })
    const res = await app.inject({
      method: 'PATCH', url: `/promotions/admin/${promo.id}`,
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { name: 'Nombre actualizado' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().name, 'Nombre actualizado')
  })

  test('admin actualiza description de una promoción', async () => {
    const app = await buildApp()
    const promo = await createPromo(app)
    const res = await app.inject({
      method: 'PATCH', url: `/promotions/admin/${promo.id}`,
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { description: 'Descripción actualizada' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().description, 'Descripción actualizada')
  })

  test('la respuesta devuelve la promoción completa actualizada', async () => {
    const app = await buildApp()
    const promo = await createPromo(app)
    const res = await app.inject({
      method: 'PATCH', url: `/promotions/admin/${promo.id}`,
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { name: 'Editada' }
    })
    const body = res.json()
    assert.ok('id' in body)
    assert.ok('active' in body)
    assert.ok('profiles' in body)
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-11 — Toggle de promoción (cobertura adicional)
// ══════════════════════════════════════════════════════════════════
describe('HU-11 — Toggle de promoción (cobertura adicional)', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/promotions/admin/PROMO-002/toggle' })
    assert.equal(res.statusCode, 401)
  })

  test('cliente normal devuelve 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/promotions/admin/PROMO-002/toggle', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 403)
  })

  test('id no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/promotions/admin/PROMO-INEXISTENTE/toggle', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 404)
  })

  test('id no existente devuelve error PROMO_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/promotions/admin/PROMO-INEXISTENTE/toggle', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.json().error, 'PROMO_NOT_FOUND')
  })

  test('toggle cambia active de true a false', async () => {
    const app = await buildApp()
    const promo = await createPromo(app) // active: true
    const res = await app.inject({ method: 'PATCH', url: `/promotions/admin/${promo.id}/toggle`, headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().active, false)
  })

  test('doble toggle vuelve al estado original (true)', async () => {
    const app = await buildApp()
    const promo = await createPromo(app) // active: true
    await app.inject({ method: 'PATCH', url: `/promotions/admin/${promo.id}/toggle`, headers: { authorization: `Bearer ${adminToken(app)}` } })
    const res = await app.inject({ method: 'PATCH', url: `/promotions/admin/${promo.id}/toggle`, headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.json().active, true)
  })

  test('la respuesta incluye los campos id y active', async () => {
    const app = await buildApp()
    const promo = await createPromo(app)
    const res = await app.inject({ method: 'PATCH', url: `/promotions/admin/${promo.id}/toggle`, headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.ok('id' in res.json())
    assert.ok('active' in res.json())
    assert.equal(res.json().id, promo.id)
  })
})
