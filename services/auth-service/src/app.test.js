import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'

import { authRoutes } from '../routes/auth.js'
import { healthRoutes } from '../routes/health.js'
import { registerAuthDecorator } from '../middleware/authenticate.js'
import { errorHandler } from '../middleware/errorHandler.js'

// ── Setup ─────────────────────────────────────────────────────────
process.env.NODE_ENV = 'development'  // activa el STUB en sapIntegrationClient
process.env.JWT_SECRET = 'test-secret-para-tests'

async function buildApp () {
  const app = Fastify({ logger: false })

  await app.register(corsPlugin)
  await app.register(jwtPlugin, {
    secret: process.env.JWT_SECRET,
    sign: { expiresIn: '1h' }
  })
  await app.register(swaggerPlugin, {
    openapi: {
      info: { title: 'test', version: '1.0.0' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
        }
      }
    }
  })
  await app.register(swaggerUiPlugin, { routePrefix: '/docs' })

  registerAuthDecorator(app)
  app.setErrorHandler(errorHandler)

  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(healthRoutes, { prefix: '/health' })

  return app
}

// Helper: hace login y devuelve el token
async function loginAndGetToken (app, sapCode = 'SDA-00423', password = 'demo1234') {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { sapCode, password }
  })
  return res.json().token
}

// ══════════════════════════════════════════════════════════════════
// HEALTH
// ══════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.status, 'ok')
    assert.equal(body.service, 'sda-auth-service')
    assert.ok(body.uptime >= 0)
    assert.ok(body.timestamp)
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-01 — Login correcto
// ══════════════════════════════════════════════════════════════════
describe('HU-01 — Login con código SAP', () => {
  test('login correcto devuelve token JWT', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00423', password: 'demo1234' }
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(body.token)
    assert.ok(body.expiresIn)
    assert.ok(body.customer)
  })

  test('login correcto devuelve datos del cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00423', password: 'demo1234' }
    })
    const { customer } = res.json()
    assert.equal(customer.sapCode, 'SDA-00423')
    assert.equal(customer.profile, 'PREMIUM')
    assert.equal(customer.role, 'CUSTOMER')
    assert.ok(customer.name)
    assert.ok(customer.businessName)
    // La contraseña nunca debe aparecer en la respuesta
    assert.equal(customer.password, undefined)
  })

  test('login correcto para perfil VIP', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00521', password: 'demo1234' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().customer.profile, 'VIP')
  })

  test('login como administrador devuelve role ADMIN', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'ADMIN-001', password: 'admin1234' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().customer.role, 'ADMIN')
  })

  test('el JWT contiene el payload correcto', async () => {
    const app = await buildApp()
    const token = await loginAndGetToken(app)
    const decoded = app.jwt.decode(token)
    assert.equal(decoded.sub, 'SDA-00423')
    assert.equal(decoded.profile, 'PREMIUM')
    assert.equal(decoded.role, 'CUSTOMER')
    assert.ok(decoded.exp > Date.now() / 1000)
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-02 — Bloqueo de acceso
// ══════════════════════════════════════════════════════════════════
describe('HU-02 — Bloqueo de cuenta suspendida', () => {
  test('cuenta bloqueada por deuda devuelve 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00187', password: 'demo1234' }
    })
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().error, 'ACCOUNT_BLOCKED')
  })

  test('cuenta bloqueada por admin devuelve 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00098', password: 'demo1234' }
    })
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().error, 'ACCOUNT_BLOCKED')
    assert.equal(res.json().reason, 'ADMIN')
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-03 — Mensaje informativo en bloqueo
// ══════════════════════════════════════════════════════════════════
describe('HU-03 — Mensaje informativo en caso de bloqueo', () => {
  test('respuesta de bloqueo incluye mensaje legible', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00187', password: 'demo1234' }
    })
    const body = res.json()
    assert.ok(body.message.length > 20, 'El mensaje debe ser descriptivo')
  })

  test('respuesta de bloqueo incluye contacto de soporte completo', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00187', password: 'demo1234' }
    })
    const { supportContact } = res.json()
    assert.ok(supportContact)
    assert.ok(supportContact.email)
    assert.ok(supportContact.phone)
    assert.ok(supportContact.hours)
  })

  test('el motivo de bloqueo está incluido en la respuesta', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00187', password: 'demo1234' }
    })
    assert.equal(res.json().reason, 'DEBT')
  })
})

// ══════════════════════════════════════════════════════════════════
// Credenciales incorrectas
// ══════════════════════════════════════════════════════════════════
describe('Credenciales incorrectas', () => {
  test('contraseña incorrecta devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00423', password: 'mal' }
    })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'INVALID_CREDENTIALS')
  })

  test('código SAP inexistente devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'NO-EXISTE', password: 'demo1234' }
    })
    assert.equal(res.statusCode, 401)
  })
})

// ══════════════════════════════════════════════════════════════════
// Validación de esquema
// ══════════════════════════════════════════════════════════════════
describe('Validación de esquema', () => {
  test('login sin sapCode devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { password: 'demo1234' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('login sin password devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00423' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('password demasiado corta devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00423', password: 'ab' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('body vacío devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {}
    })
    assert.equal(res.statusCode, 400)
  })
})

// ══════════════════════════════════════════════════════════════════
// GET /auth/me
// ══════════════════════════════════════════════════════════════════
describe('GET /auth/me', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    assert.equal(res.statusCode, 401)
  })

  test('con token válido devuelve datos del usuario', async () => {
    const app = await buildApp()
    const token = await loginAndGetToken(app)
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` }
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.sapCode, 'SDA-00423')
    assert.equal(body.profile, 'PREMIUM')
    assert.equal(body.role, 'CUSTOMER')
  })

  test('con token manipulado devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer token.manipulado.invalido' }
    })
    assert.equal(res.statusCode, 401)
  })
})

// ══════════════════════════════════════════════════════════════════
// POST /auth/verify
// ══════════════════════════════════════════════════════════════════
describe('POST /auth/verify', () => {
  test('token válido devuelve valid: true y el payload', async () => {
    const app = await buildApp()
    const token = await loginAndGetToken(app)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { token }
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.valid, true)
    assert.ok(body.payload)
    assert.equal(body.payload.sub, 'SDA-00423')
  })

  test('token inválido devuelve valid: false', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { token: 'token.invalido.xyz' }
    })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().valid, false)
  })
})

// ══════════════════════════════════════════════════════════════════
// POST /auth/logout
// ══════════════════════════════════════════════════════════════════
describe('POST /auth/logout', () => {
  test('logout con token válido devuelve 200', async () => {
    const app = await buildApp()
    const token = await loginAndGetToken(app)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${token}` }
    })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().message)
  })

  test('logout sin token devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/auth/logout' })
    assert.equal(res.statusCode, 401)
  })
})
