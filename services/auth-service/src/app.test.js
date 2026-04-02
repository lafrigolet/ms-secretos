import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'

import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'
import { registerAuthDecorator } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

// ── Setup ─────────────────────────────────────────────────────────
process.env.NODE_ENV = 'test'  // activa el STUB en clients/SapIntegrationClient.js
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
      payload: { sapCode: 'SDA-00423', password: 'wrongpassword' }
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

// ══════════════════════════════════════════════════════════════════
// HU-01 — Login correcto (cobertura adicional)
// ══════════════════════════════════════════════════════════════════
describe('HU-01 — Login correcto (cobertura adicional)', () => {
  test('login correcto para perfil STANDARD', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00387', password: 'demo1234' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().customer.profile, 'STANDARD')
    assert.equal(res.json().customer.role, 'CUSTOMER')
  })

  test('el JWT incluye el campo name en el payload', async () => {
    const app = await buildApp()
    const token = await loginAndGetToken(app)
    const decoded = app.jwt.decode(token)
    assert.ok(decoded.name, 'El payload JWT debe incluir el nombre')
  })

  test('expiresIn está presente y es una cadena no vacía', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00423', password: 'demo1234' }
    })
    const { expiresIn } = res.json()
    assert.ok(typeof expiresIn === 'string' && expiresIn.length > 0)
  })

  test('la respuesta nunca incluye la contraseña del cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00423', password: 'demo1234' }
    })
    const bodyStr = JSON.stringify(res.json())
    assert.ok(!bodyStr.includes('demo1234'), 'La contraseña no debe estar en la respuesta')
  })

  test('la respuesta incluye name y businessName del cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00521', password: 'demo1234' }
    })
    const { customer } = res.json()
    assert.ok(typeof customer.name === 'string' && customer.name.length > 0)
    assert.ok(typeof customer.businessName === 'string' && customer.businessName.length > 0)
  })

  test('el JWT payload del ADMIN incluye role ADMIN y profile ADMIN', async () => {
    const app = await buildApp()
    const token = await loginAndGetToken(app, 'ADMIN-001', 'admin1234')
    const decoded = app.jwt.decode(token)
    assert.equal(decoded.sub, 'ADMIN-001')
    assert.equal(decoded.role, 'ADMIN')
    assert.equal(decoded.profile, 'ADMIN')
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-02 — Bloqueo de acceso (cobertura adicional)
// ══════════════════════════════════════════════════════════════════
describe('HU-02 — Bloqueo de acceso (cobertura adicional)', () => {
  test('cuenta bloqueada por deuda tiene reason DEBT', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00187', password: 'demo1234' }
    })
    assert.equal(res.json().reason, 'DEBT')
  })

  test('ambas cuentas bloqueadas devuelven error ACCOUNT_BLOCKED', async () => {
    const app = await buildApp()
    for (const sapCode of ['SDA-00187', 'SDA-00098']) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { sapCode, password: 'demo1234' }
      })
      assert.equal(res.json().error, 'ACCOUNT_BLOCKED', `${sapCode} debe retornar ACCOUNT_BLOCKED`)
    }
  })

  test('cuenta bloqueada con contraseña incorrecta sigue devolviendo 403', async () => {
    // El bloqueo tiene prioridad sobre la verificación de contraseña
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00187', password: 'wrongpassword' }
    })
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().error, 'ACCOUNT_BLOCKED')
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-03 — Mensaje informativo (cobertura adicional)
// ══════════════════════════════════════════════════════════════════
describe('HU-03 — Mensaje informativo (cobertura adicional)', () => {
  test('mensaje DEBT menciona pagos pendientes', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00187', password: 'demo1234' }
    })
    const { message } = res.json()
    assert.ok(
      message.toLowerCase().includes('pago') || message.toLowerCase().includes('deuda'),
      'El mensaje DEBT debe mencionar pagos o deuda'
    )
  })

  test('mensaje ADMIN menciona suspensión o administrador', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00098', password: 'demo1234' }
    })
    const { message } = res.json()
    assert.ok(
      message.toLowerCase().includes('suspend') || message.toLowerCase().includes('admin'),
      'El mensaje ADMIN debe mencionar suspensión o administrador'
    )
  })

  test('supportContact.email tiene formato de correo', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00187', password: 'demo1234' }
    })
    const { supportContact } = res.json()
    assert.ok(supportContact.email.includes('@'), 'El email debe contener @')
  })
})

// ══════════════════════════════════════════════════════════════════
// Credenciales incorrectas (cobertura adicional)
// ══════════════════════════════════════════════════════════════════
describe('Credenciales incorrectas (cobertura adicional)', () => {
  test('código SAP inexistente devuelve error INVALID_CREDENTIALS', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'NO-EXISTE', password: 'demo1234' }
    })
    assert.equal(res.json().error, 'INVALID_CREDENTIALS')
  })

  test('contraseña incorrecta no devuelve token ni datos del cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00423', password: 'wrongpassword' }
    })
    const body = res.json()
    assert.equal(body.token, undefined)
    assert.equal(body.customer, undefined)
  })
})

// ══════════════════════════════════════════════════════════════════
// Validación de esquema (cobertura adicional)
// ══════════════════════════════════════════════════════════════════
describe('Validación de esquema (cobertura adicional)', () => {
  test('sapCode demasiado corto (< 3 chars) devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'AB', password: 'demo1234' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('sapCode demasiado largo (> 20 chars) devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'A'.repeat(21), password: 'demo1234' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('password demasiado larga (> 64 chars) devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00423', password: 'a'.repeat(65) }
    })
    assert.equal(res.statusCode, 400)
  })

  test('error de validación devuelve error VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sapCode: 'SDA-00423' }
    })
    assert.equal(res.json().error, 'VALIDATION_ERROR')
  })

  test('error de validación incluye campo details como array', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {}
    })
    const body = res.json()
    assert.ok(Array.isArray(body.details), 'details debe ser un array')
  })
})

// ══════════════════════════════════════════════════════════════════
// GET /auth/me (cobertura adicional)
// ══════════════════════════════════════════════════════════════════
describe('GET /auth/me (cobertura adicional)', () => {
  test('respuesta incluye el campo name', async () => {
    const app = await buildApp()
    const token = await loginAndGetToken(app)
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` }
    })
    assert.ok(res.json().name, 'La respuesta debe incluir el campo name')
  })

  test('usuario VIP: /auth/me devuelve profile VIP', async () => {
    const app = await buildApp()
    const token = await loginAndGetToken(app, 'SDA-00521', 'demo1234')
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().profile, 'VIP')
  })

  test('administrador: /auth/me devuelve role ADMIN', async () => {
    const app = await buildApp()
    const token = await loginAndGetToken(app, 'ADMIN-001', 'admin1234')
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().role, 'ADMIN')
  })

  test('token expirado devuelve 401', async () => {
    const app = await buildApp()
    // expiresIn '1ms' → exp = iat + 0 → ya expirado al momento de verificar
    const expiredToken = app.jwt.sign(
      { sub: 'SDA-00423', name: 'Rosa Canals', profile: 'PREMIUM', role: 'CUSTOMER' },
      { expiresIn: '1ms' }
    )
    await new Promise(resolve => setTimeout(resolve, 50))
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${expiredToken}` }
    })
    assert.equal(res.statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })
})

// ══════════════════════════════════════════════════════════════════
// POST /auth/verify (cobertura adicional)
// ══════════════════════════════════════════════════════════════════
describe('POST /auth/verify (cobertura adicional)', () => {
  test('body sin campo token devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: {}
    })
    assert.equal(res.statusCode, 400)
  })

  test('token expirado devuelve valid: false', async () => {
    const app = await buildApp()
    const expiredToken = app.jwt.sign(
      { sub: 'SDA-00423', profile: 'PREMIUM', role: 'CUSTOMER' },
      { expiresIn: '1ms' }
    )
    await new Promise(resolve => setTimeout(resolve, 50))
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { token: expiredToken }
    })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().valid, false)
  })

  test('token inválido devuelve error TOKEN_INVALID_OR_EXPIRED', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { token: 'invalid.token.here' }
    })
    assert.equal(res.json().error, 'TOKEN_INVALID_OR_EXPIRED')
  })

  test('payload verificado incluye sub, profile, role, iat y exp', async () => {
    const app = await buildApp()
    const token = await loginAndGetToken(app)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { token }
    })
    const { payload } = res.json()
    assert.ok(payload.sub)
    assert.ok(payload.profile)
    assert.ok(payload.role)
    assert.ok(payload.iat)
    assert.ok(payload.exp)
  })
})

// ══════════════════════════════════════════════════════════════════
// POST /auth/logout (cobertura adicional)
// ══════════════════════════════════════════════════════════════════
describe('POST /auth/logout (cobertura adicional)', () => {
  test('mensaje de confirmación es correcto', async () => {
    const app = await buildApp()
    const token = await loginAndGetToken(app)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${token}` }
    })
    assert.equal(res.json().message, 'Sesión cerrada correctamente')
  })

  test('logout con token manipulado devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: 'Bearer manipulated.token.value' }
    })
    assert.equal(res.statusCode, 401)
  })

  test('logout sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/auth/logout' })
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })
})

// ══════════════════════════════════════════════════════════════════
// SE-20 — Per-user login rate limiting
// NOTE: failedAttempts Map is module-level and shared across all
// buildApp() calls. Each sub-test uses a unique sapCode to avoid
// contaminating other test suites.
// ══════════════════════════════════════════════════════════════════
describe('SE-20 — Login rate limiting', () => {
  test('5 intentos fallidos → 6.º devuelve 429 TOO_MANY_ATTEMPTS', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-RATELIMIT-A'
    // Perform 5 failed attempts (wrong password, sapCode not in stub → 401 each time)
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST', url: '/auth/login',
        payload: { sapCode, password: 'wrongpassword' }
      })
      assert.equal(res.statusCode, 401, `intento ${i + 1} debe devolver 401`)
    }
    // 6th attempt must be locked
    const res = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { sapCode, password: 'wrongpassword' }
    })
    assert.equal(res.statusCode, 429)
    assert.equal(res.json().error, 'TOO_MANY_ATTEMPTS')
  })

  test('429 incluye campo retryAfter en segundos', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-RATELIMIT-B'
    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'POST', url: '/auth/login', payload: { sapCode, password: 'wrong' } })
    }
    const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { sapCode, password: 'wrong' } })
    assert.equal(res.statusCode, 429)
    const body = res.json()
    assert.ok(typeof body.retryAfter === 'number' && body.retryAfter > 0, 'retryAfter debe ser un número positivo')
    assert.ok(body.retryAfter <= 15 * 60, 'retryAfter no debe superar 900 segundos')
  })

  test('tras bloqueo, contraseña correcta también devuelve 429', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-RATELIMIT-C'
    // Lock the account
    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'POST', url: '/auth/login', payload: { sapCode, password: 'wrong' } })
    }
    // Now try with correct credentials for a known stub user (we use the sapCode directly
    // so it won't match STUB_CUSTOMERS, but the lock check happens before auth — still 429)
    const res = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { sapCode, password: 'demo1234' }
    })
    assert.equal(res.statusCode, 429)
    assert.equal(res.json().error, 'TOO_MANY_ATTEMPTS')
  })

  test('login correcto restablece el contador de intentos fallidos', async () => {
    const app = await buildApp()
    // Use a real stub user to test counter reset
    const sapCode = 'SDA-00521'  // VIP, valid credentials
    // 4 failed attempts (below lock threshold)
    for (let i = 0; i < 4; i++) {
      await app.inject({ method: 'POST', url: '/auth/login', payload: { sapCode, password: 'wrongpassword' } })
    }
    // Successful login resets counter
    const successRes = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { sapCode, password: 'demo1234' }
    })
    assert.equal(successRes.statusCode, 200, 'login correcto debe devolver 200')
    // After reset, a failed attempt is treated as attempt #1, not #5
    const failRes = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { sapCode, password: 'wrongpassword' }
    })
    assert.equal(failRes.statusCode, 401, 'primer intento fallido tras reset debe devolver 401, no 429')
  })

  test('429 devuelve campo message con información de tiempo de espera', async () => {
    const app = await buildApp()
    const sapCode = 'SDA-RATELIMIT-D'
    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'POST', url: '/auth/login', payload: { sapCode, password: 'wrong' } })
    }
    const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { sapCode, password: 'wrong' } })
    assert.equal(res.statusCode, 429)
    assert.ok(res.json().message.length > 0, 'message debe estar presente')
  })
})

// ══════════════════════════════════════════════════════════════════
// GET /health (cobertura adicional)
// ══════════════════════════════════════════════════════════════════
describe('GET /health (cobertura adicional)', () => {
  test('timestamp es una fecha ISO válida', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    const { timestamp } = res.json()
    assert.ok(!isNaN(Date.parse(timestamp)), 'timestamp debe ser una fecha ISO válida')
  })

  test('uptime es un número mayor o igual a cero', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    const { uptime } = res.json()
    assert.ok(typeof uptime === 'number' && uptime >= 0)
  })
})
