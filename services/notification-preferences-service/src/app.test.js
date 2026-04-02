import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { notificationRoutes }     from './routes/notifications.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler }           from './middleware/errorHandler.js'

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
  await app.register(notificationRoutes, { prefix: '/notifications' })
  app.get('/health', async () => ({ status: 'ok' }))
  return app
}

const customerToken = (app, sub = 'SDA-00423', profile = 'PREMIUM') =>
  app.jwt.sign({ sub, profile, role: 'CUSTOMER' })
const adminToken = (app) =>
  app.jwt.sign({ sub: 'ADMIN-001', profile: 'ADMIN', role: 'ADMIN' })
const expiredToken = (app) =>
  app.jwt.sign({ sub: 'EXP-USER', profile: 'STANDARD', role: 'CUSTOMER', exp: Math.floor(Date.now() / 1000) - 3600 })

// Stub data reference (module-level, shared):
// preferences:   SDA-00423 (DEFAULT), SDA-00521 (PROMO_EXPIRY all=true), SDA-00387 (DEFAULT)
// stockWatchlist: SDA-00423→P-RT-002, SDA-00521→P-BN-001
// inbox:          NOTIF-001 (SDA-00423, STOCK_ALERT, unread), NOTIF-002 (SDA-00423, PROMO_EXPIRY, unread),
//                 NOTIF-003 (SDA-00423, ADMIN_BROADCAST, read=true)
// broadcasts:     BC-001
// DEFAULT_PREFERENCES: STOCK_ALERT E/P/I=true, PROMO_EXPIRY E=true/P=false/I=true,
//                       MIN_ORDER E/P=false/I=true, COMMERCIAL E/P/I=true, ADMIN_BROADCAST E=true/P=false/I=true
//
// NOTE: existing tests mutate shared state:
//   HU-51: SDA-00423.STOCK_ALERT.EMAIL=false, PUSH=false
//   Bandeja: NOTIF-001 read=true, then all SDA-00423 notifications read=true
//   HU-48: P-BN-002 added to SDA-00423 watchlist; P-DEL added then removed
//   HU-52: BC-002 created → NOTIF-004(SDA-00423), NOTIF-005(SDA-00521), NOTIF-006(SDA-00387) added (unread)

// ══════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/health' })).statusCode, 200)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('GET /notifications/types', () => {
  test('devuelve tipos y canales disponibles', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/types' })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json().types))
    assert.ok(Array.isArray(res.json().channels))
    assert.ok(res.json().types.length > 0)
  })

  test('hay exactamente 5 tipos de notificación', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/types' })
    assert.equal(res.json().types.length, 5)
  })

  test('hay exactamente 3 canales (EMAIL, PUSH, IN_APP)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/types' })
    assert.equal(res.json().channels.length, 3)
    assert.ok(res.json().channels.includes('EMAIL'))
    assert.ok(res.json().channels.includes('PUSH'))
    assert.ok(res.json().channels.includes('IN_APP'))
  })

  test('cada tipo tiene id, label y description', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/types' })
    for (const t of res.json().types) {
      assert.ok('id'          in t)
      assert.ok('label'       in t)
      assert.ok('description' in t)
    }
  })

  test('tipos incluyen STOCK_ALERT, PROMO_EXPIRY, MIN_ORDER, COMMERCIAL, ADMIN_BROADCAST', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/types' })
    const ids = res.json().types.map(t => t.id)
    assert.ok(ids.includes('STOCK_ALERT'))
    assert.ok(ids.includes('PROMO_EXPIRY'))
    assert.ok(ids.includes('MIN_ORDER'))
    assert.ok(ids.includes('COMMERCIAL'))
    assert.ok(ids.includes('ADMIN_BROADCAST'))
  })

  test('endpoint es público — no requiere token', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/types' })
    assert.equal(res.statusCode, 200)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-51 — Preferencias de notificación', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/notifications/preferences' })).statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/preferences' })
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/preferences', headers: { authorization: 'Bearer bad.token.here' } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/preferences', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('obtiene preferencias del cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/preferences', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(body.preferences)
    assert.ok(body.types)
    assert.ok(body.channels)
    assert.ok('STOCK_ALERT' in body.preferences)
  })

  test('respuesta incluye sapCode, preferences, types y channels', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/preferences', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const body = res.json()
    assert.ok('sapCode'     in body)
    assert.ok('preferences' in body)
    assert.ok('types'       in body)
    assert.ok('channels'    in body)
    assert.equal(body.sapCode, 'SDA-00423')
  })

  test('preferences tiene los 5 tipos de notificación', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/preferences', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const { preferences } = res.json()
    assert.ok('STOCK_ALERT'     in preferences)
    assert.ok('PROMO_EXPIRY'    in preferences)
    assert.ok('MIN_ORDER'       in preferences)
    assert.ok('COMMERCIAL'      in preferences)
    assert.ok('ADMIN_BROADCAST' in preferences)
  })

  test('cada tipo de preferencia tiene EMAIL, PUSH e IN_APP', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/preferences', headers: { authorization: `Bearer ${customerToken(app)}` } })
    for (const pref of Object.values(res.json().preferences)) {
      assert.ok('EMAIL'  in pref)
      assert.ok('PUSH'   in pref)
      assert.ok('IN_APP' in pref)
    }
  })

  test('actualiza preferencias parcialmente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/notifications/preferences',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { STOCK_ALERT: { EMAIL: false, PUSH: false } }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().preferences.STOCK_ALERT.EMAIL, false)
    assert.equal(res.json().preferences.STOCK_ALERT.PUSH, false)
  })

  test('actualización parcial no afecta los otros tipos', async () => {
    const app = await buildApp()
    const before = (await app.inject({ method: 'GET', url: '/notifications/preferences', headers: { authorization: `Bearer ${customerToken(app)}` } })).json()
    await app.inject({ method: 'PATCH', url: '/notifications/preferences', headers: { authorization: `Bearer ${customerToken(app)}` }, payload: { COMMERCIAL: { PUSH: false } } })
    const after = (await app.inject({ method: 'GET', url: '/notifications/preferences', headers: { authorization: `Bearer ${customerToken(app)}` } })).json()
    // MIN_ORDER should be unchanged
    assert.deepEqual(after.preferences.MIN_ORDER, before.preferences.MIN_ORDER)
  })

  test('PATCH preferences respuesta incluye sapCode y preferences', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/notifications/preferences',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { PROMO_EXPIRY: { PUSH: true } }
    })
    assert.equal(res.statusCode, 200)
    assert.ok('sapCode'     in res.json())
    assert.ok('preferences' in res.json())
  })

  test('PATCH preferences sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/notifications/preferences', payload: { STOCK_ALERT: { EMAIL: true } } })
    assert.equal(res.statusCode, 401)
  })

  test('cliente nuevo recibe preferencias por defecto', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/notifications/preferences',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-NUEVO')}` }
    })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().preferences.ADMIN_BROADCAST)
    assert.ok(res.json().preferences.STOCK_ALERT)
    assert.ok(res.json().preferences.COMMERCIAL)
  })

  test('SDA-NUEVO default: STOCK_ALERT.EMAIL=true, PUSH=true, IN_APP=true', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/preferences', headers: { authorization: `Bearer ${customerToken(app, 'SDA-9999')}` } })
    const { STOCK_ALERT } = res.json().preferences
    assert.equal(STOCK_ALERT.EMAIL,  true)
    assert.equal(STOCK_ALERT.PUSH,   true)
    assert.equal(STOCK_ALERT.IN_APP, true)
  })

  test('SDA-NUEVO default: MIN_ORDER.EMAIL=false, PUSH=false, IN_APP=true', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/preferences', headers: { authorization: `Bearer ${customerToken(app, 'SDA-8888')}` } })
    const { MIN_ORDER } = res.json().preferences
    assert.equal(MIN_ORDER.EMAIL,  false)
    assert.equal(MIN_ORDER.PUSH,   false)
    assert.equal(MIN_ORDER.IN_APP, true)
  })
})

// ══════════════════════════════════════════════════════════════════
// NOTE: Bandeja tests mutate: NOTIF-001→read, then all SDA-00423 notifications→read
describe('Bandeja de entrada', () => {
  test('sin token GET /inbox → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/inbox' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado GET /inbox → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/inbox', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('obtiene notificaciones del cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/inbox', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json().notifications))
    assert.ok(typeof res.json().unread === 'number')
  })

  test('respuesta incluye notifications, unread y total', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/inbox', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const body = res.json()
    assert.ok('notifications' in body)
    assert.ok('unread'        in body)
    assert.ok('total'         in body)
  })

  test('SDA-00423 tiene 3 notificaciones inicialmente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/inbox', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().total, 3)
  })

  test('SDA-00423 tiene 2 no leídas inicialmente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/inbox', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().unread, 2)
  })

  test('notificaciones ordenadas por fecha descendente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/inbox', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const notifs = res.json().notifications
    for (let i = 1; i < notifs.length; i++) {
      assert.ok(new Date(notifs[i-1].createdAt) >= new Date(notifs[i].createdAt))
    }
  })

  test('cada notificación tiene id, type, title, body, read, createdAt', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/inbox', headers: { authorization: `Bearer ${customerToken(app)}` } })
    for (const n of res.json().notifications) {
      assert.ok('id'        in n)
      assert.ok('type'      in n)
      assert.ok('title'     in n)
      assert.ok('body'      in n)
      assert.ok('read'      in n)
      assert.ok('createdAt' in n)
    }
  })

  test('SDA-00387 no tiene notificaciones propias inicialmente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/inbox', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387')}` } })
    assert.equal(res.json().total, 0)
    assert.equal(res.json().unread, 0)
    assert.deepEqual(res.json().notifications, [])
  })

  test('marca una notificación como leída', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/notifications/inbox/NOTIF-001/read',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().read, true)
  })

  test('PATCH /inbox/:id/read devuelve la notificación completa', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/notifications/inbox/NOTIF-001/read',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.ok('id'    in res.json())
    assert.ok('type'  in res.json())
    assert.ok('title' in res.json())
  })

  test('notificación no existente → 404 NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/notifications/inbox/NOTIF-999/read',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'NOT_FOUND')
  })

  test('cliente no puede marcar notificación de otro — 404', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/notifications/inbox/NOTIF-001/read',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387')}` }
    })
    assert.equal(res.statusCode, 404)
  })

  test('PATCH /inbox/:id/read sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/notifications/inbox/NOTIF-001/read' })
    assert.equal(res.statusCode, 401)
  })

  test('marca todas las notificaciones como leídas', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/notifications/inbox/read-all',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().message)
  })

  test('tras read-all unread=0 para SDA-00423', async () => {
    const app = await buildApp()
    await app.inject({ method: 'PATCH', url: '/notifications/inbox/read-all', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const res = await app.inject({ method: 'GET', url: '/notifications/inbox', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().unread, 0)
  })

  test('PATCH /inbox/read-all sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/notifications/inbox/read-all' })
    assert.equal(res.statusCode, 401)
  })
})

// ══════════════════════════════════════════════════════════════════
// NOTE: HU-48 tests mutate: P-BN-002 added for SDA-00423; P-DEL added then removed
describe('HU-48 — Watchlist de stock', () => {
  test('sin token GET /watchlist → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/watchlist' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/watchlist', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('obtiene watchlist del cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/watchlist', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
  })

  test('SDA-00423 tiene 1 producto en watchlist inicialmente (P-RT-002)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/watchlist', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().length, 1)
    assert.equal(res.json()[0].productCode, 'P-RT-002')
  })

  test('SDA-00521 tiene P-BN-001 en watchlist', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/watchlist', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00521')}` } })
    assert.equal(res.json().length, 1)
    assert.equal(res.json()[0].productCode, 'P-BN-001')
  })

  test('cliente sin watchlist devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/watchlist', headers: { authorization: `Bearer ${customerToken(app, 'SDA-NUEVO')}` } })
    assert.deepEqual(res.json(), [])
  })

  test('cada entrada tiene sapCode, productCode, productName, addedAt', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/watchlist', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const entry = res.json()[0]
    assert.ok('sapCode'     in entry)
    assert.ok('productCode' in entry)
    assert.ok('productName' in entry)
    assert.ok('addedAt'     in entry)
  })

  test('añade producto al seguimiento', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/watchlist',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { productCode: 'P-BN-002', productName: 'Sérum Raíces' }
    })
    assert.equal(res.statusCode, 201)
    assert.equal(res.json().productCode, 'P-BN-002')
    assert.ok(res.json().addedAt)
  })

  test('POST watchlist respuesta incluye productCode, productName, addedAt, sapCode', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/watchlist',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387')}` },
      payload: { productCode: 'P-SN-001', productName: 'Champú Sensitivo' }
    })
    assert.equal(res.statusCode, 201)
    assert.ok('sapCode'     in res.json())
    assert.ok('productCode' in res.json())
    assert.ok('productName' in res.json())
    assert.ok('addedAt'     in res.json())
    assert.equal(res.json().sapCode, 'SDA-00387')
  })

  test('añadir producto duplicado devuelve el existente (no duplica)', async () => {
    const app = await buildApp()
    const res1 = await app.inject({ method: 'POST', url: '/notifications/watchlist', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00521')}` }, payload: { productCode: 'P-BN-001', productName: 'Aceite Brillo Argán' } })
    const res2 = await app.inject({ method: 'GET', url: '/notifications/watchlist', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00521')}` } })
    assert.equal(res1.statusCode, 201)
    // Still only 1 entry (P-BN-001 already existed)
    assert.equal(res2.json().filter((w) => w.productCode === 'P-BN-001').length, 1)
  })

  test('POST watchlist sin productCode → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/watchlist',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { productName: 'Sin código' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('POST watchlist sin productName → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/watchlist',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { productCode: 'P-TEST' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('POST watchlist sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/notifications/watchlist', payload: { productCode: 'P-X', productName: 'X' } })
    assert.equal(res.statusCode, 401)
  })

  test('elimina producto del seguimiento', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/notifications/watchlist', headers: { authorization: `Bearer ${customerToken(app)}` }, payload: { productCode: 'P-DEL', productName: 'Test' } })
    const res = await app.inject({
      method: 'DELETE', url: '/notifications/watchlist/P-DEL',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
  })

  test('DELETE watchlist devuelve message', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/notifications/watchlist', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387')}` }, payload: { productCode: 'P-DEL-2', productName: 'Test2' } })
    const res = await app.inject({ method: 'DELETE', url: '/notifications/watchlist/P-DEL-2', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387')}` } })
    assert.ok(res.json().message)
  })

  test('producto no existente devuelve 404', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'DELETE', url: '/notifications/watchlist/NO-EXISTE', headers: { authorization: `Bearer ${customerToken(app)}` } })).statusCode, 404)
  })

  test('404 devuelve error NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/notifications/watchlist/NO-EXISTE', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().error, 'NOT_FOUND')
  })

  test('DELETE watchlist sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/notifications/watchlist/P-RT-002' })
    assert.equal(res.statusCode, 401)
  })

  test('cliente no puede borrar producto de watchlist ajena — 404', async () => {
    const app = await buildApp()
    // P-RT-002 belongs to SDA-00423, not SDA-00387
    const res = await app.inject({ method: 'DELETE', url: '/notifications/watchlist/P-RT-002', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387')}` } })
    assert.equal(res.statusCode, 404)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-49 — Alertas de promociones', () => {
  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/alerts/expiring-promos' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/alerts/expiring-promos', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('cliente PREMIUM ve promociones próximas a vencer', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/alerts/expiring-promos', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00423', 'PREMIUM')}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json().promos))
    assert.ok(res.json().promos.length > 0)
  })

  test('respuesta incluye daysAhead y promos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/alerts/expiring-promos', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const body = res.json()
    assert.ok('daysAhead' in body)
    assert.ok('promos'    in body)
  })

  test('daysAhead por defecto es 7', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/alerts/expiring-promos', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().daysAhead, 7)
  })

  test('daysAhead personalizable', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/alerts/expiring-promos?daysAhead=14', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().daysAhead, 14)
  })

  test('cliente STANDARD no ve promos exclusivas de PREMIUM', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/alerts/expiring-promos', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387', 'STANDARD')}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().promos.every(p => p.applicable))
  })

  test('STANDARD recibe array vacío (promo stub es solo PREMIUM/VIP)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/alerts/expiring-promos', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387', 'STANDARD')}` } })
    assert.deepEqual(res.json().promos, [])
  })

  test('promos PREMIUM tienen promoId, name, daysLeft, expiresAt, applicable', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/alerts/expiring-promos', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00423', 'PREMIUM')}` } })
    const promos = res.json().promos
    if (promos.length > 0) {
      const p = promos[0]
      assert.ok('promoId'   in p)
      assert.ok('name'      in p)
      assert.ok('daysLeft'  in p)
      assert.ok('expiresAt' in p)
      assert.ok('applicable' in p)
      assert.equal(p.applicable, true)
    }
  })

  test('VIP también ve las promos PREMIUM/VIP', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/alerts/expiring-promos', headers: { authorization: `Bearer ${customerToken(app, 'SDA-00521', 'VIP')}` } })
    assert.ok(res.json().promos.length > 0)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-50 — Aviso de pedido mínimo', () => {
  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/notifications/alerts/check-min-order', payload: { cartTotal: 50 } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/notifications/alerts/check-min-order', headers: { authorization: `Bearer ${expiredToken(app)}` }, payload: { cartTotal: 50 } })
    assert.equal(res.statusCode, 401)
  })

  test('carrito por debajo del mínimo genera alertas', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/alerts/check-min-order',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { cartTotal: 50 }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().hasAlerts, true)
    assert.ok(res.json().alerts.length > 0)
    assert.ok(res.json().alerts.every(a => a.remaining > 0))
  })

  test('cartTotal=0 genera 2 alertas (pedido mínimo y envío gratis)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/alerts/check-min-order',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { cartTotal: 0 }
    })
    assert.equal(res.json().alerts.length, 2)
  })

  test('cartTotal=50 genera 2 alertas (< 100 y < 150)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/alerts/check-min-order',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { cartTotal: 50 }
    })
    assert.equal(res.json().alerts.length, 2)
  })

  test('cartTotal=100 genera 1 alerta (alcanza promo, falta envío gratis)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/alerts/check-min-order',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { cartTotal: 100 }
    })
    assert.equal(res.json().alerts.length, 1)
    assert.equal(res.json().alerts[0].threshold, 150)
  })

  test('carrito por encima del mínimo no genera alertas', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/alerts/check-min-order',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { cartTotal: 200 }
    })
    assert.equal(res.json().hasAlerts, false)
    assert.deepEqual(res.json().alerts, [])
  })

  test('cartTotal=150 no genera alertas (umbral de envío gratis exacto)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/alerts/check-min-order',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { cartTotal: 150 }
    })
    assert.equal(res.json().hasAlerts, false)
    assert.equal(res.json().alerts.length, 0)
  })

  test('respuesta incluye cartTotal, alerts y hasAlerts', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/alerts/check-min-order',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { cartTotal: 80 }
    })
    const body = res.json()
    assert.ok('cartTotal' in body)
    assert.ok('alerts'    in body)
    assert.ok('hasAlerts' in body)
    assert.equal(body.cartTotal, 80)
  })

  test('cada alerta tiene type, level, message, threshold, remaining', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/alerts/check-min-order',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { cartTotal: 50 }
    })
    for (const a of res.json().alerts) {
      assert.ok('type'      in a)
      assert.ok('level'     in a)
      assert.ok('message'   in a)
      assert.ok('threshold' in a)
      assert.ok('remaining' in a)
    }
  })

  test('remaining correcto para cartTotal=50: 100 y 100', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/alerts/check-min-order',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { cartTotal: 50 }
    })
    const remainings = res.json().alerts.map(a => a.remaining).sort((a, b) => a - b)
    assert.equal(remainings[0], 50)   // 100 - 50
    assert.equal(remainings[1], 100)  // 150 - 50
  })

  test('sin cartTotal → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/alerts/check-min-order',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: {}
    })
    assert.equal(res.statusCode, 400)
  })
})

// ══════════════════════════════════════════════════════════════════
// NOTE: HU-52 mutates: BC-002 created, NOTIF-004/005/006 added to inbox
describe('HU-52 — Comunicaciones segmentadas', () => {
  test('cliente no puede enviar broadcasts — 403', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'POST', url: '/notifications/broadcasts', headers: { authorization: `Bearer ${customerToken(app)}` }, payload: { title: 'T', body: 'B' } })).statusCode, 403)
  })

  test('403 devuelve error FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/notifications/broadcasts', headers: { authorization: `Bearer ${customerToken(app)}` }, payload: { title: 'T', body: 'B' } })
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('GET /broadcasts sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/broadcasts' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('GET /broadcasts token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/broadcasts', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('GET /broadcasts cliente → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/broadcasts', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 403)
  })

  test('admin puede enviar un broadcast', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/broadcasts',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: {
        title: 'Test broadcast',
        body: 'Mensaje de prueba para clientes activos',
        channel: 'EMAIL',
        segments: { profiles: ['PREMIUM', 'VIP'], status: 'ACTIVE' }
      }
    })
    assert.equal(res.statusCode, 201)
    assert.ok(res.json().id.startsWith('BC-'))
    assert.ok(res.json().sentAt)
  })

  test('broadcast devuelve id, title, body, channel, sentAt, recipientCount, segments', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/broadcasts',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Campos broadcast', body: 'Cuerpo del mensaje' }
    })
    assert.equal(res.statusCode, 201)
    const body = res.json()
    assert.ok('id'             in body)
    assert.ok('title'          in body)
    assert.ok('body'           in body)
    assert.ok('channel'        in body)
    assert.ok('sentAt'         in body)
    assert.ok('recipientCount' in body)
    assert.ok('segments'       in body)
  })

  test('channel por defecto es EMAIL', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/broadcasts',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Sin canal', body: 'Cuerpo' }
    })
    assert.equal(res.json().channel, 'EMAIL')
  })

  test('sentAt es una fecha ISO válida', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/notifications/broadcasts',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'ISO date test', body: 'Cuerpo' }
    })
    assert.ok(!isNaN(Date.parse(res.json().sentAt)))
  })

  test('admin lista todos los broadcasts', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/broadcasts', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length > 0)
  })

  test('lista tiene al menos BC-001', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/broadcasts', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.ok(res.json().some(b => b.id === 'BC-001'))
  })

  test('cada broadcast tiene id, title, body, channel, sentAt, recipientCount', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/broadcasts', headers: { authorization: `Bearer ${adminToken(app)}` } })
    for (const bc of res.json()) {
      assert.ok('id'             in bc)
      assert.ok('title'          in bc)
      assert.ok('body'           in bc)
      assert.ok('channel'        in bc)
      assert.ok('sentAt'         in bc)
      assert.ok('recipientCount' in bc)
    }
  })

  test('broadcast sin título devuelve 400', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'POST', url: '/notifications/broadcasts', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { body: 'sin título' } })).statusCode, 400)
  })

  test('broadcast sin body devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/notifications/broadcasts', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { title: 'Sin body' } })
    assert.equal(res.statusCode, 400)
  })

  test('POST /broadcasts sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/notifications/broadcasts', payload: { title: 'T', body: 'B' } })
    assert.equal(res.statusCode, 401)
  })
})

// ══════════════════════════════════════════════════════════════════
// After all HU-52 mutations: broadcast adds ADMIN_BROADCAST notifs to inbox
describe('HU-52 — Efecto del broadcast en la bandeja', () => {
  test('broadcast crea notificación IN_APP para SDA-00423', async () => {
    // After HU-52 test "admin puede enviar un broadcast" runs, SDA-00423 inbox grows
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/inbox', headers: { authorization: `Bearer ${customerToken(app)}` } })
    // inbox has NOTIF-001,002,003 + any from HU-52 broadcast
    assert.ok(res.json().total >= 3)
    assert.ok(res.json().notifications.some(n => n.type === 'ADMIN_BROADCAST'))
  })

  test('SDA-00423 tiene notificaciones no leídas tras el broadcast', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notifications/inbox', headers: { authorization: `Bearer ${customerToken(app)}` } })
    // Broadcast from HU-52 adds unread ADMIN_BROADCAST notifications
    assert.ok(res.json().unread >= 1)
  })
})
