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
