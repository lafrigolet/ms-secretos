import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'

import { ProfileService } from './services/ProfileService.js'
import { profileRoutes } from './routes/profile.js'
import { healthRoutes } from './routes/health.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

process.env.NODE_ENV = 'test'
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
  app.decorate('profileService', new ProfileService(app.log))
  app.setErrorHandler(errorHandler)
  await app.register(profileRoutes, { prefix: '/profile' })
  await app.register(healthRoutes, { prefix: '/health' })
  return app
}

const customerToken = (app, sapCode = 'SDA-00423', profile = 'PREMIUM') =>
  app.jwt.sign({ sub: sapCode, profile, role: 'CUSTOMER' })
const adminToken = (app) =>
  app.jwt.sign({ sub: 'ADMIN-001', profile: 'ADMIN', role: 'ADMIN' })
const expiredToken = (app, sapCode = 'SDA-00423') =>
  app.jwt.sign({ sub: sapCode, profile: 'PREMIUM', role: 'CUSTOMER', exp: Math.floor(Date.now() / 1000) - 3600 })

// ══════════════════════════════════════════════════════════════════
// GET /health
// ══════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'ok')
    assert.equal(res.json().service, 'sda-customer-profile-service')
  })

  test('timestamp es una fecha ISO válida', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.ok(!isNaN(Date.parse(res.json().timestamp)), 'timestamp debe ser fecha ISO')
  })

  test('uptime es un número no negativo', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    const { uptime } = res.json()
    assert.ok(typeof uptime === 'number' && uptime >= 0)
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-04 — GET /profile/me
// ══════════════════════════════════════════════════════════════════
describe('HU-04 — GET /profile/me', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/profile/me' })).statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/profile/me' })).json().error, 'UNAUTHORIZED')
  })

  test('token manipulado devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/me', headers: { authorization: 'Bearer token.invalido.xyz' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/me', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('cliente PREMIUM obtiene su perfil con permisos correctos', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/profile/me',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-00423', 'PREMIUM')}` }
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.sapCode, 'SDA-00423')
    assert.equal(body.profile, 'PREMIUM')
    assert.ok(body.permissions.includes('VIEW_PROMOTIONS'))
    assert.ok(body.permissions.includes('ORDER'))
    assert.equal(body.canViewPromotions, true)
    assert.equal(body.canOrder, true)
    assert.equal(body.hasSpecialConditions, false)
  })

  test('cliente STANDARD no tiene VIEW_PROMOTIONS', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/profile/me',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387', 'STANDARD')}` }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().canViewPromotions, false)
    assert.equal(res.json().hasSpecialConditions, false)
  })

  test('cliente VIP tiene condiciones especiales', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/profile/me',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-00521', 'VIP')}` }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().hasSpecialConditions, true)
    assert.equal(res.json().canViewPromotions, true)
  })

  test('el perfil no incluye la contraseña', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/me', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().password, undefined)
  })

  test('el perfil incluye todos los flags de conveniencia', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/me', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const body = res.json()
    assert.ok('canOrder' in body)
    assert.ok('canViewPromotions' in body)
    assert.ok('hasSpecialConditions' in body)
    assert.ok('isAdmin' in body)
  })

  test('el perfil incluye los campos name, businessName, email, role, status', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/me', headers: { authorization: `Bearer ${customerToken(app)}` } })
    const body = res.json()
    assert.ok('name' in body)
    assert.ok('businessName' in body)
    assert.ok('email' in body)
    assert.ok('role' in body)
    assert.ok('status' in body)
  })

  test('PREMIUM tiene permisos: ORDER, VIEW_PROMOTIONS, VIEW_PRICES', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/profile/me',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-00423', 'PREMIUM')}` }
    })
    const { permissions } = res.json()
    assert.ok(permissions.includes('ORDER'))
    assert.ok(permissions.includes('VIEW_PROMOTIONS'))
    assert.ok(permissions.includes('VIEW_PRICES'))
    assert.ok(!permissions.includes('SPECIAL_CONDITIONS'))
  })

  test('STANDARD tiene solo ORDER y VIEW_PRICES', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/profile/me',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387', 'STANDARD')}` }
    })
    const { permissions } = res.json()
    assert.ok(permissions.includes('ORDER'))
    assert.ok(permissions.includes('VIEW_PRICES'))
    assert.ok(!permissions.includes('VIEW_PROMOTIONS'))
    assert.ok(!permissions.includes('SPECIAL_CONDITIONS'))
  })

  test('VIP tiene permiso SPECIAL_CONDITIONS', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/profile/me',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-00521', 'VIP')}` }
    })
    assert.ok(res.json().permissions.includes('SPECIAL_CONDITIONS'))
  })

  test('isAdmin es false para clientes', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/me', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().isAdmin, false)
  })

  test('canOrder es true para perfil STANDARD', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/profile/me',
      headers: { authorization: `Bearer ${customerToken(app, 'SDA-00387', 'STANDARD')}` }
    })
    assert.equal(res.json().canOrder, true)
  })

  test('ADMIN accediendo a /profile/me devuelve isAdmin: true', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/me', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().isAdmin, true)
  })
})

// ══════════════════════════════════════════════════════════════════
// GET /profile/:sapCode — solo admins
// ══════════════════════════════════════════════════════════════════
describe('GET /profile/:sapCode — solo admins', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/profile/SDA-00423' })).statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/profile/SDA-00423' })).json().error, 'UNAUTHORIZED')
  })

  test('token expirado devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/SDA-00423', headers: { authorization: `Bearer ${expiredToken(app, 'ADMIN-001')}` } })
    assert.equal(res.statusCode, 401)
  })

  test('cliente normal no puede ver perfil de otro — 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/SDA-00387', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 403)
  })

  test('cliente normal devuelve error FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/SDA-00387', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('admin puede ver el perfil de cualquier cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/SDA-00423', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().sapCode, 'SDA-00423')
  })

  test('la respuesta incluye name, businessName, permissions, canOrder, isAdmin', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/SDA-00423', headers: { authorization: `Bearer ${adminToken(app)}` } })
    const body = res.json()
    for (const field of ['name', 'businessName', 'email', 'permissions', 'canOrder', 'isAdmin']) {
      assert.ok(field in body, `falta campo ${field}`)
    }
  })

  test('admin puede ver el perfil de un cliente VIP', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/SDA-00521', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().profile, 'VIP')
  })

  test('admin puede ver el perfil de un cliente BLOCKED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/SDA-00187', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'BLOCKED')
  })

  test('cliente no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/NO-EXISTE', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'PROFILE_NOT_FOUND')
  })
})

// ══════════════════════════════════════════════════════════════════
// GET /profile — lista todos — solo admins
// ══════════════════════════════════════════════════════════════════
describe('GET /profile — lista todos — solo admins', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/profile' })).statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/profile' })).json().error, 'UNAUTHORIZED')
  })

  test('token expirado devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('cliente normal no puede listar perfiles — 403', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'GET', url: '/profile', headers: { authorization: `Bearer ${customerToken(app)}` } })).statusCode,
      403
    )
  })

  test('admin obtiene lista de todos los perfiles', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length > 0)
    assert.ok(res.json().every(p => p.sapCode && p.profile && p.permissions))
  })

  test('devuelve 6 perfiles en total', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.json().length, 6)
  })

  test('cada perfil tiene sapCode, profile y permissions', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile', headers: { authorization: `Bearer ${adminToken(app)}` } })
    for (const p of res.json()) {
      assert.ok('sapCode' in p, 'falta sapCode')
      assert.ok('profile' in p, 'falta profile')
      assert.ok(Array.isArray(p.permissions), 'permissions debe ser array')
    }
  })

  test('la lista incluye al administrador ADMIN-001', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.ok(res.json().some(p => p.sapCode === 'ADMIN-001'))
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-05 — PATCH /profile/:sapCode
// ══════════════════════════════════════════════════════════════════
describe('HU-05 — PATCH /profile/:sapCode', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'PATCH', url: '/profile/SDA-00387', payload: { profile: 'PREMIUM' } })).statusCode,
      401
    )
  })

  test('token expirado devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/profile/SDA-00387', headers: { authorization: `Bearer ${expiredToken(app)}` }, payload: { profile: 'PREMIUM' } })
    assert.equal(res.statusCode, 401)
  })

  test('cliente normal no puede modificar perfiles — 403', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'PATCH', url: '/profile/SDA-00387', headers: { authorization: `Bearer ${customerToken(app)}` }, payload: { profile: 'PREMIUM' } })).statusCode,
      403
    )
  })

  test('admin puede cambiar STANDARD a PREMIUM', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/profile/SDA-00387',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { profile: 'PREMIUM' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().profile, 'PREMIUM')
    assert.equal(res.json().canViewPromotions, true)
  })

  test('admin puede cambiar a VIP', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/profile/SDA-00387',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { profile: 'VIP' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().hasSpecialConditions, true)
  })

  test('tras STANDARD→PREMIUM canViewPromotions cambia a true', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/profile/SDA-00387',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { profile: 'PREMIUM' }
    })
    assert.equal(res.json().canViewPromotions, true)
    assert.ok(res.json().permissions.includes('VIEW_PROMOTIONS'))
  })

  test('tras PREMIUM→STANDARD canViewPromotions cambia a false', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/profile/SDA-00423',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { profile: 'STANDARD' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().canViewPromotions, false)
    assert.ok(!res.json().permissions.includes('VIEW_PROMOTIONS'))
  })

  test('perfil inválido devuelve 400', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'PATCH', url: '/profile/SDA-00387', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { profile: 'SUPER_PREMIUM' } })).statusCode,
      400
    )
  })

  test('perfil inválido devuelve error VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/profile/SDA-00387',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { profile: 'INVALIDO' }
    })
    assert.equal(res.json().error, 'VALIDATION_ERROR')
  })

  test('cliente no existente devuelve 404', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'PATCH', url: '/profile/NO-EXISTE', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { profile: 'PREMIUM' } })).statusCode,
      404
    )
  })

  test('cliente no existente devuelve error CUSTOMER_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/profile/NO-EXISTE',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { profile: 'PREMIUM' }
    })
    assert.equal(res.json().error, 'CUSTOMER_NOT_FOUND')
  })

  test('body sin profile devuelve 400', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'PATCH', url: '/profile/SDA-00387', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: {} })).statusCode,
      400
    )
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-28 — PATCH /profile/:sapCode/status
// ══════════════════════════════════════════════════════════════════
describe('HU-28 — PATCH /profile/:sapCode/status', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/profile/SDA-00423/status', payload: { status: 'BLOCKED' } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('cliente normal devuelve 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/profile/SDA-00423/status',
      headers: { authorization: `Bearer ${customerToken(app)}` },
      payload: { status: 'BLOCKED' }
    })
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().error, 'FORBIDDEN')
  })

  test('admin puede bloquear una cuenta ACTIVE', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/profile/SDA-00423/status',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { status: 'BLOCKED' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'BLOCKED')
  })

  test('admin puede activar una cuenta BLOCKED', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/profile/SDA-00187/status',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { status: 'ACTIVE' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'ACTIVE')
  })

  test('se puede bloquear con blockReason', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/profile/SDA-00423/status',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { status: 'BLOCKED', blockReason: 'Impago de factura 2025-03' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'BLOCKED')
  })

  test('body sin status devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/profile/SDA-00423/status',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: {}
    })
    assert.equal(res.statusCode, 400)
  })

  test('status inválido devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/profile/SDA-00423/status',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { status: 'SUSPENDED' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('cliente no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/profile/NO-EXISTE/status',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { status: 'BLOCKED' }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'CUSTOMER_NOT_FOUND')
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-24 — GET /profile/search
// ══════════════════════════════════════════════════════════════════
describe('HU-24 — GET /profile/search', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/search?q=Rosa' })
    assert.equal(res.statusCode, 401)
  })

  test('cliente normal devuelve 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/search?q=Rosa', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 403)
  })

  test('sin parámetro q devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/search', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 400)
  })

  test('busca por sapCode exacto', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/search?q=SDA-00423', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().some(c => c.sapCode === 'SDA-00423'))
  })

  test('busca por nombre (Rosa)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/search?q=Rosa', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().some(c => c.sapCode === 'SDA-00423'))
  })

  test('busca por ciudad (Barcelona)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/search?q=Barcelona', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().some(c => c.sapCode === 'SDA-00423'))
  })

  test('busca por email parcial', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/search?q=rosa%40', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().some(c => c.sapCode === 'SDA-00423'))
  })

  test('busca por businessName (Canals)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/search?q=Canals', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().some(c => c.sapCode === 'SDA-00423'))
  })

  test('query sin resultados devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/search?q=XYZ_NO_EXISTE_NUNCA', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), [])
  })

  test('la respuesta es un array', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/search?q=Madrid', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.ok(Array.isArray(res.json()))
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-25 — GET /profile/filter
// ══════════════════════════════════════════════════════════════════
describe('HU-25 — GET /profile/filter', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/filter?status=ACTIVE' })
    assert.equal(res.statusCode, 401)
  })

  test('cliente normal devuelve 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/filter?status=ACTIVE', headers: { authorization: `Bearer ${customerToken(app)}` } })
    assert.equal(res.statusCode, 403)
  })

  test('sin filtros devuelve todos los clientes (6)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/filter', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().length, 6)
  })

  test('filtra por status=ACTIVE — no incluye cuentas BLOCKED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/filter?status=ACTIVE', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().every(c => c.status === 'ACTIVE'))
    assert.ok(!res.json().some(c => c.sapCode === 'SDA-00187'))
    assert.ok(!res.json().some(c => c.sapCode === 'SDA-00098'))
  })

  test('filtra por status=BLOCKED — devuelve SDA-00187 y SDA-00098', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/filter?status=BLOCKED', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().every(c => c.status === 'BLOCKED'))
    assert.ok(res.json().some(c => c.sapCode === 'SDA-00187'))
    assert.ok(res.json().some(c => c.sapCode === 'SDA-00098'))
  })

  test('filtra por profile=PREMIUM — devuelve solo SDA-00423', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/filter?profile=PREMIUM', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().every(c => c.profile === 'PREMIUM'))
    assert.ok(res.json().some(c => c.sapCode === 'SDA-00423'))
  })

  test('filtra por profile=VIP — devuelve solo SDA-00521', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/filter?profile=VIP', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().every(c => c.profile === 'VIP'))
    assert.equal(res.json().length, 1)
    assert.equal(res.json()[0].sapCode, 'SDA-00521')
  })

  test('filtra por city=Madrid', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/filter?city=Madrid', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().every(c => c.city?.toLowerCase().includes('madrid')))
  })

  test('combinación profile=STANDARD&status=ACTIVE', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/filter?profile=STANDARD&status=ACTIVE', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().every(c => c.profile === 'STANDARD' && c.status === 'ACTIVE'))
    assert.ok(res.json().some(c => c.sapCode === 'SDA-00387'))
    assert.ok(!res.json().some(c => c.sapCode === 'SDA-00187'))
  })

  test('status inválido devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/filter?status=SUSPENDED', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 400)
  })

  test('profile inválido devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/profile/filter?profile=SUPER', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 400)
  })
})

// ══════════════════════════════════════════════════════════════════
// POST /profile/check-permission
// ══════════════════════════════════════════════════════════════════
describe('POST /profile/check-permission', () => {
  test('cliente PREMIUM tiene permiso VIEW_PROMOTIONS', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/profile/check-permission', payload: { sapCode: 'SDA-00423', permission: 'VIEW_PROMOTIONS' } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().allowed, true)
  })

  test('cliente STANDARD no tiene permiso VIEW_PROMOTIONS', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/profile/check-permission', payload: { sapCode: 'SDA-00387', permission: 'VIEW_PROMOTIONS' } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().allowed, false)
  })

  test('cliente bloqueado no tiene ningún permiso', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/profile/check-permission', payload: { sapCode: 'SDA-00187', permission: 'ORDER' } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().allowed, false)
  })

  test('cliente VIP tiene permiso SPECIAL_CONDITIONS', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/profile/check-permission', payload: { sapCode: 'SDA-00521', permission: 'SPECIAL_CONDITIONS' } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().allowed, true)
  })

  test('ADMIN tiene permiso MANAGE_PROFILES', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/profile/check-permission', payload: { sapCode: 'ADMIN-001', permission: 'MANAGE_PROFILES' } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().allowed, true)
  })

  test('STANDARD tiene permiso ORDER', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/profile/check-permission', payload: { sapCode: 'SDA-00387', permission: 'ORDER' } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().allowed, true)
  })

  test('STANDARD no tiene permiso SPECIAL_CONDITIONS', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/profile/check-permission', payload: { sapCode: 'SDA-00387', permission: 'SPECIAL_CONDITIONS' } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().allowed, false)
  })

  test('sapCode inexistente devuelve allowed: false', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/profile/check-permission', payload: { sapCode: 'NO-EXISTE', permission: 'ORDER' } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().allowed, false)
  })

  test('la respuesta incluye los campos sapCode, permission y allowed', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/profile/check-permission', payload: { sapCode: 'SDA-00423', permission: 'ORDER' } })
    const body = res.json()
    assert.ok('sapCode' in body)
    assert.ok('permission' in body)
    assert.ok('allowed' in body)
  })

  test('validación: sapCode requerido', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'POST', url: '/profile/check-permission', payload: { permission: 'ORDER' } })).statusCode, 400)
  })

  test('validación: permission requerido', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'POST', url: '/profile/check-permission', payload: { sapCode: 'SDA-00423' } })).statusCode, 400)
  })
})
