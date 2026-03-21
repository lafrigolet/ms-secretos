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

// ══════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'ok')
  })
})

describe('HU-36 — Fichas técnicas', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/content/datasheets' })).statusCode, 401)
  })

  test('cliente autenticado obtiene las fichas activas', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length > 0)
    assert.ok(res.json().every(d => d.active))
  })

  test('filtro por familia', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets?familyId=F01', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.ok(res.json().every(d => d.familyId === 'F01'))
  })

  test('filtro por producto', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets?productCode=P-RT-001', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.ok(res.json().every(d => d.productCode === 'P-RT-001'))
  })

  test('obtiene ficha por id', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/datasheets/DS-001', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().id, 'DS-001')
    assert.ok(res.json().downloadUrl)
  })

  test('ficha no existente devuelve 404', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/content/datasheets/NO-EXISTE', headers: { authorization: `Bearer ${customerToken(app)}` } })).statusCode, 404)
  })
})

describe('HU-37 — Vídeos formativos', () => {
  test('lista vídeos activos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().length > 0)
    assert.ok(res.json().every(v => v.videoUrl))
  })

  test('filtro por familia', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos?familyId=F01', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.ok(res.json().every(v => v.familyId === 'F01'))
  })

  test('obtiene vídeo por id con URL', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/videos/VID-001', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().videoUrl)
    assert.ok(res.json().duration)
  })
})

describe('HU-38 — Novedades y lanzamientos', () => {
  test('lista novedades ordenadas por fecha descendente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    const items = res.json()
    assert.ok(items.length > 0)
    // Verificar orden descendente
    for (let i = 1; i < items.length; i++) {
      assert.ok(new Date(items[i-1].publishedAt) >= new Date(items[i].publishedAt))
    }
  })

  test('filtro featured devuelve solo destacadas', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news?featured=true', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.ok(res.json().every(n => n.featured === true))
  })

  test('obtiene novedad completa por id', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/content/news/NEWS-001', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().title)
    assert.ok(res.json().body)
    assert.ok(Array.isArray(res.json().tags))
  })
})

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
