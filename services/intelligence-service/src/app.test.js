import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { intelligenceRoutes }     from './routes/intelligence.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler }           from './middleware/errorHandler.js'

process.env.JWT_SECRET = 'test-secret'
process.env.NODE_ENV   = 'development'

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
  await app.register(intelligenceRoutes, { prefix: '/intelligence' })
  app.get('/health', async () => ({ status: 'ok', service: 'sda-intelligence-service' }))
  return app
}

const token = (app, sub = 'SDA-00423') =>
  app.jwt.sign({ sub, profile: 'PREMIUM', role: 'CUSTOMER' })

// ══════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'ok')
  })
})

describe('HU-40 — Comparativa de compras', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/intelligence/comparison' })).statusCode, 401)
  })

  test('devuelve comparativa con los campos requeridos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok('current'  in body)
    assert.ok('previous' in body)
    assert.ok('changes'  in body)
    assert.ok('windowDays' in body)
  })

  test('current y previous tienen total, orders y topProducts', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${token(app)}` } })
    const { current, previous } = res.json()
    assert.ok(typeof current.total  === 'number')
    assert.ok(typeof current.orders === 'number')
    assert.ok(Array.isArray(current.topProducts))
    assert.ok(typeof previous.total  === 'number')
    assert.ok(typeof previous.orders === 'number')
  })

  test('changes incluye trend UP/DOWN/FLAT/NO_DATA', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(['UP', 'DOWN', 'FLAT', 'NO_DATA'].includes(res.json().changes.trend))
  })

  test('windowDays personalizable', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison?windowDays=30', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().windowDays, 30)
  })

  test('cliente sin pedidos devuelve datos vacíos pero no error', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${app.jwt.sign({ sub: 'SDA-NUEVO', profile: 'STANDARD', role: 'CUSTOMER' })}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().current.total, 0)
    assert.equal(res.json().changes.trend, 'NO_DATA')
  })
})

describe('HU-41 — Alertas de productos inactivos', () => {
  test('devuelve estructura de alertas', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok('alerts' in res.json())
    assert.ok('weeksThreshold' in res.json())
    assert.ok(Array.isArray(res.json().alerts))
  })

  test('threshold personalizable', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products?weeksThreshold=4', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().weeksThreshold, 4)
  })

  test('alertas tienen los campos requeridos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products?weeksThreshold=1', headers: { authorization: `Bearer ${token(app)}` } })
    const { alerts } = res.json()
    if (alerts.length > 0) {
      assert.ok('productCode'   in alerts[0])
      assert.ok('name'          in alerts[0])
      assert.ok('lastOrderDate' in alerts[0])
      assert.ok('weeksSince'    in alerts[0])
      assert.ok('orderCount'    in alerts[0])
    }
  })

  test('cliente sin pedidos devuelve alertas vacías', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products', headers: { authorization: `Bearer ${app.jwt.sign({ sub: 'SDA-NUEVO', profile: 'STANDARD', role: 'CUSTOMER' })}` } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json().alerts, [])
  })
})

describe('HU-42 — Progreso hacia umbrales', () => {
  test('devuelve estructura de umbrales', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok('currentPeriodSpend' in body)
    assert.ok('reached'            in body)
    assert.ok('next'               in body)
    assert.ok('allThresholds'      in body)
  })

  test('allThresholds incluye progressPct y remaining', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${token(app)}` } })
    const { allThresholds } = res.json()
    assert.ok(allThresholds.length > 0)
    assert.ok(allThresholds.every(t => 'progressPct' in t && 'remaining' in t && 'reached' in t))
  })

  test('next incluye remaining y progressPct cuando no se ha alcanzado el máximo', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${token(app)}` } })
    const { next } = res.json()
    if (next) {
      assert.ok('remaining'   in next)
      assert.ok('progressPct' in next)
      assert.ok(next.remaining >= 0)
    }
  })
})

describe('HU-43 — Resumen de beneficios acumulados', () => {
  test('devuelve estructura de beneficios', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok('months'        in body)
    assert.ok('totalBenefits' in body)
    assert.ok('byType'        in body)
    assert.ok('timeline'      in body)
  })

  test('timeline ordenado por fecha descendente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary', headers: { authorization: `Bearer ${token(app)}` } })
    const { timeline } = res.json()
    for (let i = 1; i < timeline.length; i++) {
      assert.ok(new Date(timeline[i-1].date) >= new Date(timeline[i].date))
    }
  })

  test('months personalizable', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary?months=3', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().months, 3)
  })

  test('cliente sin beneficios devuelve totales a cero', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary', headers: { authorization: `Bearer ${app.jwt.sign({ sub: 'SDA-00387', profile: 'STANDARD', role: 'CUSTOMER' })}` } })
    assert.equal(res.json().totalBenefits, 0)
    assert.deepEqual(res.json().timeline, [])
  })
})
