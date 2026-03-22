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

// ── Setup ─────────────────────────────────────────────────────────
// NODE_ENV=development activa el STUB en clients/SapIntegrationClient.js
// evitando llamadas reales al sap-integration-service durante los tests
process.env.NODE_ENV = 'development'
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

// ══════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'ok')
    assert.equal(res.json().service, 'sda-customer-profile-service')
  })
})

describe('HU-04 — GET /profile/me', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/profile/me' })).statusCode, 401)
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
    const res = await app.inject({
      method: 'GET', url: '/profile/me',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.json().password, undefined)
  })

  test('el perfil incluye todos los flags de conveniencia', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/profile/me',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    const body = res.json()
    assert.ok('canOrder' in body)
    assert.ok('canViewPromotions' in body)
    assert.ok('hasSpecialConditions' in body)
    assert.ok('isAdmin' in body)
  })
})

describe('GET /profile/:sapCode — solo admins', () => {
  test('cliente normal no puede ver perfil de otro — 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/profile/SDA-00387',
      headers: { authorization: `Bearer ${customerToken(app)}` }
    })
    assert.equal(res.statusCode, 403)
  })

  test('admin puede ver el perfil de cualquier cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/profile/SDA-00423',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().sapCode, 'SDA-00423')
  })

  test('cliente no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/profile/NO-EXISTE',
      headers: { authorization: `Bearer ${adminToken(app)}` }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'PROFILE_NOT_FOUND')
  })
})

describe('GET /profile — lista todos — solo admins', () => {
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
})

describe('HU-05 — PATCH /profile/:sapCode', () => {
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

  test('perfil inválido devuelve 400', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'PATCH', url: '/profile/SDA-00387', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { profile: 'SUPER_PREMIUM' } })).statusCode,
      400
    )
  })

  test('cliente no existente devuelve 404', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'PATCH', url: '/profile/NO-EXISTE', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: { profile: 'PREMIUM' } })).statusCode,
      404
    )
  })

  test('body sin profile devuelve 400', async () => {
    const app = await buildApp()
    assert.equal(
      (await app.inject({ method: 'PATCH', url: '/profile/SDA-00387', headers: { authorization: `Bearer ${adminToken(app)}` }, payload: {} })).statusCode,
      400
    )
  })
})

describe('POST /profile/check-permission — uso interno entre servicios', () => {
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

  test('validación: sapCode requerido', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'POST', url: '/profile/check-permission', payload: { permission: 'ORDER' } })).statusCode, 400)
  })
})
