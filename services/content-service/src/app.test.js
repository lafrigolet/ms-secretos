import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { contentRoutes }      from './routes/content.js'
import { adminContentRoutes } from './routes/admin.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler }       from './middleware/errorHandler.js'

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
  await app.register(contentRoutes,      { prefix: '/content' })
  await app.register(adminContentRoutes, { prefix: '/admin/content' })
  app.get('/health', async () => ({ status: 'ok', service: 'sda-content-service' }))
  return app
}

const customerToken = (app) => app.jwt.sign({ sub: 'SDA-00423', profile: 'PREMIUM', role: 'CUSTOMER' })
const adminToken    = (app) => app.jwt.sign({ sub: 'ADMIN-001', profile: 'ADMIN',   role: 'ADMIN' })
const expiredToken  = (app) => app.jwt.sign({ sub: 'EXP-USER', profile: 'STANDARD', role: 'CUSTOMER', exp: Math.floor(Date.now() / 1000) - 3600 })

// Stub data (module-level, shared across all buildApp() calls):
// datasheets: DS-001 (F01,P-RT-001), DS-002 (F01,P-RT-002), DS-003 (F01,null), DS-004 (F02,P-SN-001) — all active=true initially
// videos:     VID-001 (F01,P-RT-001), VID-002 (F01,null), VID-003 (F02,null) — all active=true
// news:       NEWS-001 (featured=true, 2025-03-01), NEWS-002 (featured=false, 2025-02-10), NEWS-003 (featured=false)
// NOTE: The HU-39 describe block below mutates shared state:
//   DS-001 → active=false, DS-002 → active=false, NEWS-002 → featured=true
//   Creates DS-005, VID-004, NEWS-004
// Tests in HU-36/37/38 run BEFORE those mutations.

// ══════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'ok')
  })

  test('devuelve service name que incluye content', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.ok(res.json().service.includes('content'))
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-36 — Fichas técnicas', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/content/datasheets' })).statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets' })
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets', headers: { authorization: 'Bearer bad.token.here' } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('cliente autenticado obtiene las fichas activas', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length > 0)
    assert.ok(res.json().every(d => d.active))
  })

  test('hay exactamente 4 fichas activas en el estado inicial', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().length, 4)
  })

  test('cada ficha tiene id, title, downloadUrl, fileType, familyId, active', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets', headers: { authorization: `Bearer ${customerToken(app)}` } })
    for (const ds of res.json()) {
      assert.ok('id' in ds)
      assert.ok('title' in ds)
      assert.ok('downloadUrl' in ds)
      assert.ok('fileType' in ds)
      assert.ok('familyId' in ds)
      assert.ok('active' in ds)
    }
  })

  test('filtro por familia', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets?familyId=F01', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.ok(res.json().every(d => d.familyId === 'F01'))
  })

  test('familia F01 tiene 3 fichas activas inicialmente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets?familyId=F01', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().length, 3)
  })

  test('familia F02 tiene 1 ficha activa (DS-004)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets?familyId=F02', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().length, 1)
    assert.equal(res.json()[0].id, 'DS-004')
  })

  test('filtro por producto', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets?productCode=P-RT-001', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.ok(res.json().every(d => d.productCode === 'P-RT-001'))
  })

  test('filtro productCode=P-RT-001 devuelve solo DS-001', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets?productCode=P-RT-001', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().length, 1)
    assert.equal(res.json()[0].id, 'DS-001')
  })

  test('obtiene ficha por id', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets/DS-001', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().id, 'DS-001')
    assert.ok(res.json().downloadUrl)
  })

  test('DS-001 tiene todos sus campos correctos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets/DS-001', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const body = res.json()
    assert.equal(body.id, 'DS-001')
    assert.equal(body.familyId, 'F01')
    assert.equal(body.productCode, 'P-RT-001')
    assert.equal(body.fileType, 'PDF')
    assert.equal(body.active, true)
    assert.ok(body.downloadUrl.includes('DS-001'))
  })

  test('ficha no existente devuelve 404', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/content/datasheets/NO-EXISTE', headers: { authorization: `Bearer ${customerToken(app)}` } })).statusCode, 404)
  })

  test('404 devuelve error DATASHEET_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets/NO-EXISTE', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().error, 'DATASHEET_NOT_FOUND')
  })

  test('GET /datasheets/:id sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets/DS-001' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('GET /datasheets/:id token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets/DS-001', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-37 — Vídeos formativos', () => {
  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos', headers: { authorization: 'Bearer bad.token' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('lista vídeos activos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().length > 0)
    assert.ok(res.json().every(v => v.videoUrl))
  })

  test('hay exactamente 3 vídeos activos en el estado inicial', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().length, 3)
  })

  test('cada vídeo tiene id, title, videoUrl, duration, thumbnailUrl, familyId', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos', headers: { authorization: `Bearer ${customerToken(app)}` } })
    for (const v of res.json()) {
      assert.ok('id' in v)
      assert.ok('title' in v)
      assert.ok('videoUrl' in v)
      assert.ok('duration' in v)
      assert.ok('thumbnailUrl' in v)
      assert.ok('familyId' in v)
    }
  })

  test('filtro por familia', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos?familyId=F01', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.ok(res.json().every(v => v.familyId === 'F01'))
  })

  test('familia F01 tiene 2 vídeos (VID-001, VID-002)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos?familyId=F01', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().length, 2)
    const ids = res.json().map(v => v.id)
    assert.ok(ids.includes('VID-001'))
    assert.ok(ids.includes('VID-002'))
  })

  test('filtro productCode=P-RT-001 devuelve VID-001', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos?productCode=P-RT-001', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().length, 1)
    assert.equal(res.json()[0].id, 'VID-001')
  })

  test('obtiene vídeo por id con URL', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos/VID-001', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().videoUrl)
    assert.ok(res.json().duration)
  })

  test('VID-001 tiene campos correctos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos/VID-001', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const body = res.json()
    assert.equal(body.id, 'VID-001')
    assert.equal(body.familyId, 'F01')
    assert.equal(body.productCode, 'P-RT-001')
    assert.equal(body.duration, '4:32')
    assert.ok(body.thumbnailUrl.includes('VID-001'))
  })

  test('vídeo no existente → 404 VIDEO_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos/NO-EXISTE', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'VIDEO_NOT_FOUND')
  })

  test('GET /videos/:id sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos/VID-001' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('GET /videos/:id token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos/VID-001', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-38 — Novedades y lanzamientos', () => {
  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news', headers: { authorization: 'Bearer bad.token' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('lista novedades ordenadas por fecha descendente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    const items = res.json()
    assert.ok(items.length > 0)
    for (let i = 1; i < items.length; i++) {
      assert.ok(new Date(items[i-1].publishedAt) >= new Date(items[i].publishedAt))
    }
  })

  test('hay exactamente 3 novedades activas en el estado inicial', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().length, 3)
  })

  test('cada novedad tiene id, title, summary, body, tags, publishedAt, featured', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news', headers: { authorization: `Bearer ${customerToken(app)}` } })
    for (const n of res.json()) {
      assert.ok('id' in n)
      assert.ok('title' in n)
      assert.ok('summary' in n)
      assert.ok('body' in n)
      assert.ok('tags' in n)
      assert.ok('publishedAt' in n)
      assert.ok('featured' in n)
      assert.ok(Array.isArray(n.tags))
    }
  })

  test('filtro featured devuelve solo destacadas', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news?featured=true', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.ok(res.json().every(n => n.featured === true))
  })

  test('filtro featured=true devuelve exactamente 1 (NEWS-001) en estado inicial', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news?featured=true', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().length, 1)
    assert.equal(res.json()[0].id, 'NEWS-001')
  })

  test('filtro featured=false devuelve solo no destacadas', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news?featured=false', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.ok(res.json().every(n => n.featured === false))
  })

  test('obtiene novedad completa por id', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news/NEWS-001', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().title)
    assert.ok(res.json().body)
    assert.ok(Array.isArray(res.json().tags))
  })

  test('NEWS-001 tiene campos correctos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news/NEWS-001', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const body = res.json()
    assert.equal(body.id, 'NEWS-001')
    assert.equal(body.featured, true)
    assert.ok(body.publishedAt.startsWith('2025-03-01'))
    assert.ok(Array.isArray(body.tags))
    assert.ok(body.tags.length > 0)
  })

  test('novedad no existente → 404 NEWS_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news/NO-EXISTE', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'NEWS_NOT_FOUND')
  })

  test('GET /news/:id sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news/NEWS-001' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('GET /news/:id token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news/NEWS-001', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })
})

// ══════════════════════════════════════════════════════════════════
// NOTE: HU-39 describe mutates shared module state:
//   "admin crea una ficha técnica"            → DS-005 created (active=true, F01)
//   "admin puede retirar una ficha"           → DS-001 active=false
//   "admin crea un vídeo"                     → VID-004 created (active=true)
//   "admin publica una novedad"               → NEWS-004 created (active=true, featured=false)
//   "admin puede destacar una novedad"        → NEWS-002 featured=true
//   "admin ve todas las fichas incl. inact."  → DS-002 active=false
describe('HU-39 — Gestión de contenidos (admin)', () => {
  test('cliente no puede acceder a admin — 403', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/admin/content/datasheets', headers: { authorization: `Bearer ${customerToken(app)}` } })).statusCode, 403)
  })

  test('admin crea una ficha técnica', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/datasheets',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Nueva ficha test', fileType: 'PDF', downloadUrl: '/test.pdf', familyId: 'F01' }
    })
    assert.equal(res.statusCode, 201)
    assert.ok(res.json().id.startsWith('DS-'))
    assert.equal(res.json().active, true)
  })

  test('admin puede retirar una ficha (active: false)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/content/datasheets/DS-001',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { active: false }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().active, false)
  })

  test('admin crea un vídeo', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/videos',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Nuevo vídeo test', videoUrl: 'https://youtube.com/embed/test', duration: '3:00', familyId: 'F02' }
    })
    assert.equal(res.statusCode, 201)
    assert.ok(res.json().id.startsWith('VID-'))
  })

  test('admin publica una novedad', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/news',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Noticia de prueba', summary: 'Resumen de prueba', featured: false }
    })
    assert.equal(res.statusCode, 201)
    assert.ok(res.json().id.startsWith('NEWS-'))
    assert.ok(res.json().publishedAt)
  })

  test('admin puede destacar una novedad existente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/content/news/NEWS-002',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { featured: true }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().featured, true)
  })

  test('admin ve todas las fichas incluyendo inactivas', async () => {
    const app = await buildApp()
    // Primero retirar una
    await app.inject({ method: 'PATCH', url: '/admin/content/datasheets/DS-002', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { active: false } })
    const res = await app.inject({ method: 'GET', url: '/admin/content/datasheets', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.ok(res.json().some(d => d.active === false))
  })

  test('body inválido devuelve 400', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'POST', url: '/admin/content/datasheets', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: {} })).statusCode, 400)
  })
})

// ══════════════════════════════════════════════════════════════════
// State after HU-39:
// DS-001 active=false, DS-002 active=false, DS-003/004/005 active=true
// VID-001,002,003,004 active=true
// NEWS-001 featured=true, NEWS-002 featured=true, NEWS-003/004 featured=false

describe('HU-39 — Auth errors (admin routes)', () => {
  test('GET /admin/content/datasheets sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/content/datasheets' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('GET /admin/content/datasheets token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/content/datasheets', headers: { authorization: 'Bearer bad.token' } })
    assert.equal(res.statusCode, 401)
  })

  test('GET /admin/content/datasheets token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/content/datasheets', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('GET /admin/content/datasheets cliente normal → 403 FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/content/datasheets', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('GET /admin/content/videos sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/content/videos' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('GET /admin/content/videos cliente normal → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/content/videos', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 403)
  })

  test('GET /admin/content/news sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/content/news' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('GET /admin/content/news cliente normal → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/content/news', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 403)
  })

  test('POST /admin/content/datasheets sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/admin/content/datasheets', payload: { title: 'x', fileType: 'PDF', downloadUrl: '/x.pdf' } })
    assert.equal(res.statusCode, 401)
  })

  test('POST /admin/content/datasheets cliente → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/admin/content/datasheets', headers: { authorization: `Bearer ${customerToken(app)}` }, payload: { title: 'x', fileType: 'PDF', downloadUrl: '/x.pdf' } })
    assert.equal(res.statusCode, 403)
  })

  test('PATCH /admin/content/datasheets/:id sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/admin/content/datasheets/DS-003', payload: { active: false } })
    assert.equal(res.statusCode, 401)
  })

  test('PATCH /admin/content/datasheets/:id cliente → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/admin/content/datasheets/DS-003', headers: { authorization: `Bearer ${customerToken(app)}` }, payload: { active: false } })
    assert.equal(res.statusCode, 403)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-39 — Admin ve contenido inactivo', () => {
  test('admin ve fichas incluyendo inactivas en GET /admin/content/datasheets', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/content/datasheets', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().some(d => d.active === false))
  })

  test('admin ve al menos 5 fichas (incluyendo inactivas)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/content/datasheets', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.ok(res.json().length >= 5)
  })

  test('DS-001 inactiva no aparece para el cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.ok(!res.json().some(d => d.id === 'DS-001'))
  })

  test('DS-002 inactiva no aparece para el cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.ok(!res.json().some(d => d.id === 'DS-002'))
  })

  test('DS-001 inactiva → 404 DATASHEET_NOT_FOUND para cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets/DS-001', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'DATASHEET_NOT_FOUND')
  })

  test('admin puede ver DS-001 inactiva en lista admin', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/content/datasheets', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.ok(res.json().some(d => d.id === 'DS-001' && d.active === false))
  })

  test('cliente ve 3 fichas activas después de HU-39 (DS-003, DS-004, DS-005)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().length, 3)
  })

  test('admin ve todos los vídeos incluyendo inactivos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/content/videos', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length >= 3)
  })

  test('admin ve todas las novedades incluyendo inactivas', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/content/news', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length >= 3)
  })

  test('NEWS-002 ahora tiene featured=true tras el PATCH de HU-39', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news?featured=true', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.ok(res.json().some(n => n.id === 'NEWS-002'))
  })

  test('featured=true devuelve al menos 2 (NEWS-001 y NEWS-002)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news?featured=true', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.ok(res.json().length >= 2)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-39 — Validación POST (admin)', () => {
  test('POST /datasheets sin title → 400 VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/datasheets',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { fileType: 'PDF', downloadUrl: '/test.pdf' }
    })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json().error, 'VALIDATION_ERROR')
  })

  test('POST /datasheets sin downloadUrl → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/datasheets',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Test', fileType: 'PDF' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('POST /datasheets sin fileType → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/datasheets',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Test', downloadUrl: '/test.pdf' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('POST /datasheets con body vacío → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/datasheets',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: {}
    })
    assert.equal(res.statusCode, 400)
  })

  test('POST /datasheets válido devuelve id DS-, active=true y createdAt', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/datasheets',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Ficha nueva', fileType: 'PDF', downloadUrl: '/nueva.pdf', familyId: 'F01' }
    })
    assert.equal(res.statusCode, 201)
    assert.ok(res.json().id.startsWith('DS-'))
    assert.equal(res.json().active, true)
    assert.ok(res.json().createdAt)
    assert.ok(!isNaN(Date.parse(res.json().createdAt)))
  })

  test('POST /videos sin title → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/videos',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { videoUrl: 'https://youtube.com/embed/x', duration: '1:00' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('POST /videos sin videoUrl → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/videos',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Vídeo nuevo', duration: '2:00' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('POST /videos sin duration → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/videos',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Vídeo nuevo', videoUrl: 'https://youtube.com/embed/x' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('POST /videos válido devuelve id VID-, active=true', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/videos',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Vídeo nuevo', videoUrl: 'https://youtube.com/embed/abc', duration: '5:00', familyId: 'F01' }
    })
    assert.equal(res.statusCode, 201)
    assert.ok(res.json().id.startsWith('VID-'))
    assert.equal(res.json().active, true)
  })

  test('POST /news sin title → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/news',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { summary: 'Resumen sin título' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('POST /news sin summary → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/news',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Título sin resumen' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('POST /news válido devuelve id NEWS-, publishedAt ISO y active=true', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/news',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Nueva noticia', summary: 'Resumen de prueba', featured: true }
    })
    assert.equal(res.statusCode, 201)
    assert.ok(res.json().id.startsWith('NEWS-'))
    assert.ok(res.json().publishedAt)
    assert.equal(res.json().active, true)
    assert.ok(!isNaN(Date.parse(res.json().publishedAt)))
  })

  test('POST /news sin featured lo crea con featured=false por defecto', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/content/news',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Sin campo featured', summary: 'Resumen' }
    })
    assert.equal(res.statusCode, 201)
    assert.equal(res.json().featured, false)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-39 — Admin PATCH (fichas, vídeos, novedades)', () => {
  test('PATCH /datasheets/NO-EXISTE → 404 DATASHEET_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/content/datasheets/NO-EXISTE',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { active: false }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'DATASHEET_NOT_FOUND')
  })

  test('PATCH /datasheets/:id admin puede reactivar ficha inactiva (DS-001)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/content/datasheets/DS-001',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { active: true }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().active, true)
  })

  test('PATCH /datasheets/:id puede actualizar title', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/content/datasheets/DS-003',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { title: 'Título actualizado DS-003' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().title, 'Título actualizado DS-003')
  })

  test('PATCH /videos/NO-EXISTE → 404 VIDEO_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/content/videos/NO-EXISTE',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { active: false }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'VIDEO_NOT_FOUND')
  })

  test('PATCH /videos/:id admin puede desactivar un vídeo', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/content/videos/VID-002',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { active: false }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().active, false)
  })

  test('PATCH /news/NO-EXISTE → 404 NEWS_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/content/news/NO-EXISTE',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { featured: true }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'NEWS_NOT_FOUND')
  })

  test('PATCH /news/:id admin puede quitar destacado', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/content/news/NEWS-001',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { featured: false }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().featured, false)
  })

  test('PATCH /news/:id admin puede desactivar una novedad', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/content/news/NEWS-003',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { active: false }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().active, false)
  })

  test('PATCH /news/:id sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/admin/content/news/NEWS-001', payload: { featured: false } })
    assert.equal(res.statusCode, 401)
  })

  test('PATCH /news/:id cliente → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/content/news/NEWS-001',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { featured: false }
    })
    assert.equal(res.statusCode, 403)
  })

  test('PATCH /videos/:id sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/admin/content/videos/VID-003', payload: { active: false } })
    assert.equal(res.statusCode, 401)
  })

  test('PATCH /videos/:id cliente → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/content/videos/VID-003',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { active: false }
    })
    assert.equal(res.statusCode, 403)
  })
})
