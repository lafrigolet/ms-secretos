import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { auditRoutes } from './routes/audit.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

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
  await app.register(auditRoutes, { prefix: '/audit' })
  return app
}

const adminToken = (app) => app.jwt.sign({ sub: 'ADMIN-001', role: 'ADMIN' })
const customerToken = (app) => app.jwt.sign({ sub: 'SDA-00423', role: 'CUSTOMER' })

const VALID_ACTIONS = [
  'LOGIN', 'LOGIN_FAILED', 'LOGIN_BLOCKED',
  'ORDER_CREATED', 'ORDER_VIEWED',
  'PROFILE_UPDATED', 'INVOICE_DOWNLOADED',
  'PROMO_CREATED', 'PROMO_UPDATED', 'PROMO_TOGGLED'
]

// ══════════════════════════════════════════════════════════════════
// HU-22 — Auditoría de accesos y pedidos (básico)
// ══════════════════════════════════════════════════════════════════
describe('HU-22 — Auditoría de accesos y pedidos', () => {
  test('registra un evento de auditoría', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/audit',
      payload: { action: 'ORDER_CREATED', sapCode: 'SDA-00423', data: { orderId: 'SDA-2025-9999' } }
    })
    assert.equal(res.statusCode, 201)
    assert.ok(res.json().id)
    assert.ok(res.json().timestamp)
  })

  test('acción no válida devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/audit',
      payload: { action: 'ACCION_INVALIDA', sapCode: 'SDA-00423' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('admin puede consultar el registro', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode: 'SDA-00423' } })
    const res = await app.inject({ method: 'GET', url: '/audit', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length > 0)
  })

  test('cliente no puede consultar el registro — 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/audit', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 403)
  })

  test('filtra por sapCode', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode: 'SDA-00423' } })
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode: 'SDA-00387' } })
    const res = await app.inject({ method: 'GET', url: '/audit?sapCode=SDA-00423', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.ok(res.json().every(e => e.sapCode === 'SDA-00423'))
  })

  test('filtra por acción', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode: 'SDA-00423' } })
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'ORDER_CREATED', sapCode: 'SDA-00423' } })
    const res = await app.inject({ method: 'GET', url: '/audit?action=LOGIN', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.ok(res.json().every(e => e.action === 'LOGIN'))
  })

  test('GET /audit/stats devuelve estadísticas', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode: 'SDA-00423' } })
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'ORDER_CREATED', sapCode: 'SDA-00423' } })
    const res = await app.inject({ method: 'GET', url: '/audit/stats', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok('total' in body)
    assert.ok('byAction' in body)
    assert.ok('uniqueUsers' in body)
  })
})

// ══════════════════════════════════════════════════════════════════
// POST /audit — Validación de esquema
// ══════════════════════════════════════════════════════════════════
describe('POST /audit — Validación de esquema', () => {
  test('body vacío devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/audit', payload: {} })
    assert.equal(res.statusCode, 400)
  })

  test('action ausente devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/audit',
      payload: { sapCode: 'SDA-00423' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('sapCode ausente devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/audit',
      payload: { action: 'LOGIN' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('acción inválida devuelve error VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/audit',
      payload: { action: 'NO_EXISTE', sapCode: 'SDA-00423' }
    })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json().error, 'VALIDATION_ERROR')
  })

  test('error de validación incluye campo details como array', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/audit', payload: {} })
    const body = res.json()
    assert.ok(Array.isArray(body.details), 'details debe ser un array')
  })

  test('error de validación incluye campo message', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/audit', payload: { action: 'INVALIDA', sapCode: 'X' } })
    assert.ok(typeof res.json().message === 'string')
  })
})

// ══════════════════════════════════════════════════════════════════
// POST /audit — Todas las acciones válidas
// ══════════════════════════════════════════════════════════════════
describe('POST /audit — Todas las acciones válidas devuelven 201', () => {
  for (const action of VALID_ACTIONS) {
    test(`acción ${action} es aceptada`, async () => {
      const app = await buildApp()
      const res = await app.inject({
        method: 'POST', url: '/audit',
        payload: { action, sapCode: 'SDA-TEST-01' }
      })
      assert.equal(res.statusCode, 201, `${action} debe devolver 201`)
    })
  }
})

// ══════════════════════════════════════════════════════════════════
// POST /audit — Estructura de respuesta
// ══════════════════════════════════════════════════════════════════
describe('POST /audit — Estructura de respuesta', () => {
  test('el id tiene el prefijo AUDIT-', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/audit',
      payload: { action: 'LOGIN', sapCode: 'SDA-00423' }
    })
    assert.ok(res.json().id.startsWith('AUDIT-'), 'El id debe comenzar con AUDIT-')
  })

  test('el timestamp es una fecha ISO válida', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/audit',
      payload: { action: 'LOGIN', sapCode: 'SDA-00423' }
    })
    const { timestamp } = res.json()
    assert.ok(!isNaN(Date.parse(timestamp)), 'timestamp debe ser una fecha ISO válida')
  })

  test('dos eventos consecutivos tienen ids distintos', async () => {
    const app = await buildApp()
    const r1 = await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode: 'SDA-00423' } })
    const r2 = await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode: 'SDA-00423' } })
    assert.notEqual(r1.json().id, r2.json().id)
  })

  test('el campo data se almacena y se recupera correctamente', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-DATA-TEST'
    await app.inject({
      method: 'POST', url: '/audit',
      payload: { action: 'ORDER_CREATED', sapCode, data: { orderId: 'SDA-2025-8888', items: 3 } }
    })
    const res = await app.inject({
      method: 'GET', url: `/audit?sapCode=${sapCode}`,
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    const entry = res.json()[0]
    assert.equal(entry.data.orderId, 'SDA-2025-8888')
    assert.equal(entry.data.items, 3)
  })

  test('data omitido por defecto es objeto vacío', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-NODATA-TEST'
    await app.inject({
      method: 'POST', url: '/audit',
      payload: { action: 'LOGIN', sapCode }
    })
    const res = await app.inject({
      method: 'GET', url: `/audit?sapCode=${sapCode}`,
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    const entry = res.json()[0]
    assert.deepEqual(entry.data, {})
  })

  test('el campo ip se almacena cuando se envía', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-IP-TEST'
    await app.inject({
      method: 'POST', url: '/audit',
      payload: { action: 'LOGIN', sapCode, ip: '192.168.1.100' }
    })
    const res = await app.inject({
      method: 'GET', url: `/audit?sapCode=${sapCode}`,
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.json()[0].ip, '192.168.1.100')
  })
})

// ══════════════════════════════════════════════════════════════════
// GET /audit — Autenticación y autorización
// ══════════════════════════════════════════════════════════════════
describe('GET /audit — Autenticación y autorización', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/audit' })
    assert.equal(res.statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/audit' })
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/audit',
      headers: { authorization: 'Bearer token.manipulado.invalido' }
    })
    assert.equal(res.statusCode, 401)
  })

  test('token de cliente devuelve 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/audit',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('token expirado devuelve 401', async () => {
    const app = await buildApp()
    const expiredToken = app.jwt.sign(
      { sub: 'ADMIN-001', role: 'ADMIN' },
      { expiresIn: '1ms' }
    )
    await new Promise(resolve => setTimeout(resolve, 50))
    const res = await app.inject({
      method: 'GET', url: '/audit',
      headers: { authorization: `Bearer ${expiredToken}` }
    })
    assert.equal(res.statusCode, 401)
  })
})

// ══════════════════════════════════════════════════════════════════
// GET /audit — Estructura de cada entrada
// ══════════════════════════════════════════════════════════════════
describe('GET /audit — Estructura de cada entrada', () => {
  test('cada entrada tiene los campos id, action, sapCode, data, ip, timestamp', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-STRUCT-TEST'
    await app.inject({
      method: 'POST', url: '/audit',
      payload: { action: 'LOGIN', sapCode }
    })
    const res = await app.inject({
      method: 'GET', url: `/audit?sapCode=${sapCode}`,
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    const entry = res.json()[0]
    assert.ok('id' in entry)
    assert.ok('action' in entry)
    assert.ok('sapCode' in entry)
    assert.ok('data' in entry)
    assert.ok('ip' in entry)
    assert.ok('timestamp' in entry)
  })

  test('el campo action coincide con el enviado', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-ACTION-VERIFY'
    await app.inject({
      method: 'POST', url: '/audit',
      payload: { action: 'INVOICE_DOWNLOADED', sapCode }
    })
    const res = await app.inject({
      method: 'GET', url: `/audit?sapCode=${sapCode}`,
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.json()[0].action, 'INVOICE_DOWNLOADED')
  })

  test('el campo sapCode coincide con el enviado', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-SAPCODE-VERIFY'
    await app.inject({
      method: 'POST', url: '/audit',
      payload: { action: 'LOGIN', sapCode }
    })
    const res = await app.inject({
      method: 'GET', url: `/audit?sapCode=${sapCode}`,
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.json()[0].sapCode, sapCode)
  })
})

// ══════════════════════════════════════════════════════════════════
// GET /audit — Filtros avanzados
// ══════════════════════════════════════════════════════════════════
describe('GET /audit — Filtros avanzados', () => {
  test('sapCode inexistente devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/audit?sapCode=SDA-NEVER-EXISTS-XYZ',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), [])
  })

  test('filtro de acción sin coincidencias devuelve array vacío', async () => {
    const app = await buildApp()
    // Registramos solo LOGIN para un usuario único
    const sapCode = 'SDA-NO-PROMO'
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode } })
    const res = await app.inject({
      method: 'GET', url: `/audit?sapCode=${sapCode}&action=PROMO_CREATED`,
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.deepEqual(res.json(), [])
  })

  test('combinación sapCode + action filtra correctamente', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-COMBO-TEST'
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode } })
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'ORDER_CREATED', sapCode } })
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode: 'SDA-OTRO' } })
    const res = await app.inject({
      method: 'GET', url: `/audit?sapCode=${sapCode}&action=LOGIN`,
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    const results = res.json()
    assert.ok(results.every(e => e.sapCode === sapCode && e.action === 'LOGIN'))
  })

  test('parámetro limit restringe la cantidad de resultados', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-LIMIT-TEST'
    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode } })
    }
    const res = await app.inject({
      method: 'GET', url: `/audit?sapCode=${sapCode}&limit=2`,
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.ok(res.json().length <= 2)
  })

  test('limit=1 devuelve exactamente un resultado', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-LIMIT1-TEST'
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode } })
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'ORDER_CREATED', sapCode } })
    const res = await app.inject({
      method: 'GET', url: `/audit?sapCode=${sapCode}&limit=1`,
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.json().length, 1)
  })

  test('los resultados se devuelven en orden descendente (más reciente primero)', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-ORDER-TEST'
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode } })
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'ORDER_CREATED', sapCode } })
    const res = await app.inject({
      method: 'GET', url: `/audit?sapCode=${sapCode}`,
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    const entries = res.json()
    if (entries.length >= 2) {
      const t1 = Date.parse(entries[0].timestamp)
      const t2 = Date.parse(entries[1].timestamp)
      assert.ok(t1 >= t2, 'El primero debe ser tan reciente o más que el segundo')
    }
  })

  test('respuesta es un array aunque haya un único resultado', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-SINGLE-TEST'
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode } })
    const res = await app.inject({
      method: 'GET', url: `/audit?sapCode=${sapCode}`,
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.ok(Array.isArray(res.json()))
    assert.equal(res.json().length, 1)
  })
})

// ══════════════════════════════════════════════════════════════════
// GET /audit/stats — Autenticación y autorización
// ══════════════════════════════════════════════════════════════════
describe('GET /audit/stats — Autenticación y autorización', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/audit/stats' })
    assert.equal(res.statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/audit/stats' })
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token de cliente devuelve 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/audit/stats',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('token expirado devuelve 401', async () => {
    const app = await buildApp()
    const expiredToken = app.jwt.sign(
      { sub: 'ADMIN-001', role: 'ADMIN' },
      { expiresIn: '1ms' }
    )
    await new Promise(resolve => setTimeout(resolve, 50))
    const res = await app.inject({
      method: 'GET', url: '/audit/stats',
      headers: { authorization: `Bearer ${expiredToken}` }
    })
    assert.equal(res.statusCode, 401)
  })
})

// ══════════════════════════════════════════════════════════════════
// GET /audit/stats — Contenido y corrección
// ══════════════════════════════════════════════════════════════════
describe('GET /audit/stats — Contenido', () => {
  test('byAction contiene todas las acciones válidas como claves', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/audit/stats',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    const { byAction } = res.json()
    for (const action of VALID_ACTIONS) {
      assert.ok(action in byAction, `byAction debe tener la clave ${action}`)
    }
  })

  test('los valores de byAction son números', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/audit/stats',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    const { byAction } = res.json()
    for (const [action, count] of Object.entries(byAction)) {
      assert.ok(typeof count === 'number', `byAction.${action} debe ser un número`)
    }
  })

  test('total es mayor o igual a la suma de eventos insertados', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-STATS-COUNT'
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode } })
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'ORDER_CREATED', sapCode } })
    const res = await app.inject({
      method: 'GET', url: '/audit/stats',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.ok(res.json().total >= 2)
  })

  test('uniqueUsers es un número entero no negativo', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/audit/stats',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    const { uniqueUsers } = res.json()
    assert.ok(Number.isInteger(uniqueUsers) && uniqueUsers >= 0)
  })

  test('uniqueUsers aumenta al registrar un usuario nuevo', async () => {
    const app = await buildApp()
    const res1 = await app.inject({
      method: 'GET', url: '/audit/stats',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    const before = res1.json().uniqueUsers

    // Usuario completamente nuevo
    await app.inject({
      method: 'POST', url: '/audit',
      payload: { action: 'LOGIN', sapCode: `SDA-NEW-${Date.now()}` }
    })

    const res2 = await app.inject({
      method: 'GET', url: '/audit/stats',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res2.json().uniqueUsers, before + 1)
  })

  test('byAction.LOGIN refleja exactamente el número de LOGINs registrados', async () => {
    const app = await buildApp()
    const res1 = await app.inject({
      method: 'GET', url: '/audit/stats',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    const loginsBefore = res1.json().byAction.LOGIN

    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode: 'SDA-00423' } })
    await app.inject({ method: 'POST', url: '/audit', payload: { action: 'LOGIN', sapCode: 'SDA-00387' } })

    const res2 = await app.inject({
      method: 'GET', url: '/audit/stats',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res2.json().byAction.LOGIN, loginsBefore + 2)
  })

  test('total es igual a la suma de todos los valores de byAction', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/audit/stats',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    const { total, byAction } = res.json()
    const sumByAction = Object.values(byAction).reduce((s, n) => s + n, 0)
    assert.equal(total, sumByAction)
  })
})
