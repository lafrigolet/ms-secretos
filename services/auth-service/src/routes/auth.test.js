import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import { authRoutes } from './auth.js'
import { registerAuthDecorator } from '../middleware/authenticate.js'
import { errorHandler } from '../middleware/errorHandler.js'

// ── Setup: crea una instancia de Fastify para tests ──────────────
async function buildApp () {
  const app = Fastify({ logger: false })
  await app.register(jwtPlugin, { secret: 'test-secret' })
  registerAuthDecorator(app)
  app.setErrorHandler(errorHandler)
  await app.register(authRoutes, { prefix: '/auth' })
  return app
}

// ── HU-01: login correcto ────────────────────────────────────────
test('HU-01 — login correcto devuelve token y datos del cliente', async () => {
  const app = await buildApp()

  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { sapCode: 'SDA-00423', password: 'demo1234' }
  })

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.ok(body.token)
  assert.equal(body.customer.sapCode, 'SDA-00423')
  assert.equal(body.customer.profile, 'PREMIUM')
})

// ── HU-02: cuenta bloqueada ──────────────────────────────────────
test('HU-02 — cuenta bloqueada devuelve 403', async () => {
  const app = await buildApp()

  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { sapCode: 'SDA-00187', password: 'demo1234' }
  })

  assert.equal(res.statusCode, 403)
  const body = res.json()
  assert.equal(body.error, 'ACCOUNT_BLOCKED')
  assert.equal(body.reason, 'DEBT')
})

// ── HU-03: mensaje informativo en bloqueo ────────────────────────
test('HU-03 — cuenta bloqueada incluye mensaje y contacto de soporte', async () => {
  const app = await buildApp()

  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { sapCode: 'SDA-00187', password: 'demo1234' }
  })

  const body = res.json()
  assert.ok(body.message.length > 0)
  assert.ok(body.supportContact.email)
  assert.ok(body.supportContact.phone)
})

// ── Credenciales incorrectas ─────────────────────────────────────
test('login con contraseña incorrecta devuelve 401', async () => {
  const app = await buildApp()

  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { sapCode: 'SDA-00423', password: 'incorrecta' }
  })

  assert.equal(res.statusCode, 401)
  assert.equal(res.json().error, 'INVALID_CREDENTIALS')
})

// ── Validación de esquema ────────────────────────────────────────
test('login sin sapCode devuelve 400', async () => {
  const app = await buildApp()

  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { password: 'demo1234' }
  })

  assert.equal(res.statusCode, 400)
})

// ── Endpoint protegido sin token ─────────────────────────────────
test('/auth/me sin token devuelve 401', async () => {
  const app = await buildApp()

  const res = await app.inject({
    method: 'GET',
    url: '/auth/me'
  })

  assert.equal(res.statusCode, 401)
})

// ── /auth/me con token válido ────────────────────────────────────
test('/auth/me con token válido devuelve datos del usuario', async () => {
  const app = await buildApp()

  // Primero hacemos login para obtener el token
  const loginRes = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { sapCode: 'SDA-00423', password: 'demo1234' }
  })
  const { token } = loginRes.json()

  // Luego llamamos a /me con ese token
  const meRes = await app.inject({
    method: 'GET',
    url: '/auth/me',
    headers: { authorization: `Bearer ${token}` }
  })

  assert.equal(meRes.statusCode, 200)
  assert.equal(meRes.json().sapCode, 'SDA-00423')
})
