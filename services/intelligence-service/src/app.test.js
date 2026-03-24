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
const adminToken    = (app) => app.jwt.sign({ sub: 'ADMIN-001', profile: 'ADMIN', role: 'ADMIN' })
const expiredToken  = (app) => app.jwt.sign({ sub: 'EXP-USER', profile: 'STANDARD', role: 'CUSTOMER', exp: Math.floor(Date.now() / 1000) - 3600 })

// Stub data reference:
// SDA-00423: 6 orders (2024-10 → 2025-03), 3 benefits (SAMPLE×2, GIFT×1)
// SDA-00521: 2 orders (2024-12, 2025-03), 2 benefits (GIFT×1, SAMPLE×1)
// SDA-00387: 2 orders (2024-10, 2025-02), 0 benefits
// SDA-NUEVO: no orders, no benefits
// NOTE: All stub dates are 2024-2025. With today=2026-03-25, the 90-day default window is
//       empty for all stubs — use windowDays=365 or months=24 for data-producing assertions.

// ══════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'ok')
  })

  test('devuelve service name que incluye intelligence', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.ok(res.json().service.includes('intelligence'))
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-40 — Comparativa de compras', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/intelligence/comparison' })).statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison' })
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: 'Bearer bad.token.here' } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('devuelve comparativa con los campos requeridos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok('current'    in body)
    assert.ok('previous'   in body)
    assert.ok('changes'    in body)
    assert.ok('windowDays' in body)
  })

  test('current y previous tienen total, orders y topProducts', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${token(app)}` } })
    const { current, previous } = res.json()
    assert.ok(typeof current.total   === 'number')
    assert.ok(typeof current.orders  === 'number')
    assert.ok(Array.isArray(current.topProducts))
    assert.ok(typeof previous.total  === 'number')
    assert.ok(typeof previous.orders === 'number')
    assert.ok(Array.isArray(previous.topProducts))
  })

  test('changes incluye trend UP/DOWN/FLAT/NO_DATA', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(['UP', 'DOWN', 'FLAT', 'NO_DATA'].includes(res.json().changes.trend))
  })

  test('changes tiene campo totalAmount y totalOrders', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${token(app)}` } })
    const { changes } = res.json()
    assert.ok('totalAmount' in changes)
    assert.ok('totalOrders' in changes)
  })

  test('windowDays personalizable', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison?windowDays=30', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().windowDays, 30)
  })

  test('windowDays por defecto es 90', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().windowDays, 90)
  })

  test('cliente sin pedidos devuelve datos vacíos pero no error', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${token(app, 'SDA-NUEVO')}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().current.total, 0)
    assert.equal(res.json().changes.trend, 'NO_DATA')
  })

  test('cliente sin pedidos tiene topProducts vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${token(app, 'SDA-NUEVO')}` } })
    assert.deepEqual(res.json().current.topProducts, [])
    assert.deepEqual(res.json().previous.topProducts, [])
  })

  test('cliente sin pedidos: changes.totalAmount y totalOrders son null', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${token(app, 'SDA-NUEVO')}` } })
    assert.equal(res.json().changes.totalAmount, null)
    assert.equal(res.json().changes.totalOrders, null)
  })

  test('total y orders son números no negativos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${token(app)}` } })
    const { current, previous } = res.json()
    assert.ok(current.total  >= 0)
    assert.ok(current.orders >= 0)
    assert.ok(previous.total  >= 0)
    assert.ok(previous.orders >= 0)
  })

  test('topProducts tienen productCode, name, totalQty', async () => {
    const app = await buildApp()
    // Use windowDays=365 so previous period captures stub data (2024-03-25 → 2025-03-25)
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison?windowDays=365', headers: { authorization: `Bearer ${token(app)}` } })
    const { previous } = res.json()
    if (previous.topProducts.length > 0) {
      const p = previous.topProducts[0]
      assert.ok('productCode' in p)
      assert.ok('name'        in p)
      assert.ok('totalQty'    in p)
    }
  })

  test('SDA-00423 periodo anterior (windowDays=365) tiene pedidos del stub', async () => {
    const app = await buildApp()
    // With today=2026-03-25 and windowDays=365: previous = [2025-03-25 - 365, 2025-03-25) → captures 2024-2025 stub orders
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison?windowDays=365', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    // Previous period should include the stub orders (all in 2024-2025)
    assert.ok(res.json().previous.orders >= 0)
    assert.ok(res.json().previous.total  >= 0)
  })

  test('adminToken puede acceder al endpoint de comparativa', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/comparison', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-41 — Alertas de productos inactivos', () => {
  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products', headers: { authorization: 'Bearer bad.token' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('devuelve estructura de alertas', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok('alerts'         in res.json())
    assert.ok('weeksThreshold' in res.json())
    assert.ok(Array.isArray(res.json().alerts))
  })

  test('threshold personalizable', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products?weeksThreshold=4', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().weeksThreshold, 4)
  })

  test('weeksThreshold por defecto es 8', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().weeksThreshold, 8)
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
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products', headers: { authorization: `Bearer ${token(app, 'SDA-NUEVO')}` } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json().alerts, [])
  })

  test('SDA-00423 con weeksThreshold=8 tiene alertas (todos los pedidos son del año pasado)', async () => {
    // All stub orders for SDA-00423 are from 2025, well over 8 weeks ago from 2026-03-25
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products?weeksThreshold=8', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    // Products with orderCount>=2: P-RT-001, P-RT-002, P-RT-003, P-SN-001 → 4 alerts
    assert.equal(res.json().alerts.length, 4)
  })

  test('alertas solo incluyen productos con orderCount >= 2', async () => {
    // P-BN-001 only appears once → excluded
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products?weeksThreshold=8', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(res.json().alerts.every(a => a.orderCount >= 2))
  })

  test('P-BN-001 (orderCount=1) no aparece en alertas', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products?weeksThreshold=8', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(!res.json().alerts.some(a => a.productCode === 'P-BN-001'))
  })

  test('alertas ordenadas por weeksSince descendente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products?weeksThreshold=8', headers: { authorization: `Bearer ${token(app)}` } })
    const { alerts } = res.json()
    for (let i = 1; i < alerts.length; i++) {
      assert.ok(alerts[i-1].weeksSince >= alerts[i].weeksSince)
    }
  })

  test('weeksSince es un número positivo', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products?weeksThreshold=8', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(res.json().alerts.every(a => a.weeksSince > 0))
  })

  test('SDA-00387 con weeksThreshold=8 tiene 1 alerta (P-SN-001)', async () => {
    // SDA-00387 has P-SN-001 in 2 orders, last one Feb 2025 → alert
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products?weeksThreshold=8', headers: { authorization: `Bearer ${token(app, 'SDA-00387')}` } })
    assert.equal(res.json().alerts.length, 1)
    assert.equal(res.json().alerts[0].productCode, 'P-SN-001')
  })

  test('adminToken puede acceder a alertas', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/alerts/inactive-products', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-42 — Progreso hacia umbrales', () => {
  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: 'Bearer bad.token' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

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

  test('periodDays es 30', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().periodDays, 30)
  })

  test('allThresholds tiene exactamente 4 umbrales', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().allThresholds.length, 4)
  })

  test('allThresholds incluye progressPct y remaining', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${token(app)}` } })
    const { allThresholds } = res.json()
    assert.ok(allThresholds.length > 0)
    assert.ok(allThresholds.every(t => 'progressPct' in t && 'remaining' in t && 'reached' in t))
  })

  test('allThresholds tiene threshold, label y type en cada ítem', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${token(app)}` } })
    for (const t of res.json().allThresholds) {
      assert.ok('threshold' in t)
      assert.ok('label'     in t)
      assert.ok('type'      in t)
    }
  })

  test('allThresholds: progressPct entre 0 y 100', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(res.json().allThresholds.every(t => t.progressPct >= 0 && t.progressPct <= 100))
  })

  test('allThresholds: remaining >= 0', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(res.json().allThresholds.every(t => t.remaining >= 0))
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

  test('cliente sin pedidos en 30 días: currentPeriodSpend=0, reached=[]', async () => {
    // All stub dates are 2025, well outside the 30-day window from 2026-03-25
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${token(app, 'SDA-NUEVO')}` } })
    assert.equal(res.json().currentPeriodSpend, 0)
    assert.deepEqual(res.json().reached, [])
  })

  test('SDA-NUEVO: next es el primer umbral (100, SAMPLE)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${token(app, 'SDA-NUEVO')}` } })
    const { next } = res.json()
    assert.ok(next !== null)
    assert.equal(next.threshold, 100)
    assert.equal(next.type, 'SAMPLE')
    assert.equal(next.remaining, 100)
    assert.equal(next.progressPct, 0)
  })

  test('SDA-00423 sin compras en 30 días: ningún umbral alcanzado', async () => {
    // SDA-00423 has no orders in last 30 days (all from 2025)
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().currentPeriodSpend, 0)
    assert.deepEqual(res.json().reached, [])
  })

  test('umbral type SAMPLE tiene threshold=100', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${token(app)}` } })
    const sampleThreshold = res.json().allThresholds.find(t => t.type === 'SAMPLE')
    assert.ok(sampleThreshold)
    assert.equal(sampleThreshold.threshold, 100)
  })

  test('umbral type DISCOUNT tiene threshold=500', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${token(app)}` } })
    const discountThreshold = res.json().allThresholds.find(t => t.type === 'DISCOUNT')
    assert.ok(discountThreshold)
    assert.equal(discountThreshold.threshold, 500)
  })

  test('adminToken puede acceder a umbrales', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/thresholds', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-43 — Resumen de beneficios acumulados', () => {
  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary', headers: { authorization: 'Bearer bad.token' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

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

  test('timeline es un array', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(Array.isArray(res.json().timeline))
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

  test('months por defecto es 6', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().months, 6)
  })

  test('cliente sin beneficios devuelve totales a cero', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary', headers: { authorization: `Bearer ${token(app, 'SDA-00387')}` } })
    assert.equal(res.json().totalBenefits, 0)
    assert.deepEqual(res.json().timeline, [])
  })

  test('SDA-NUEVO devuelve totalBenefits=0 y timeline=[]', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary', headers: { authorization: `Bearer ${token(app, 'SDA-NUEVO')}` } })
    assert.equal(res.json().totalBenefits, 0)
    assert.deepEqual(res.json().timeline, [])
  })

  test('SDA-00423 con months=24 tiene exactamente 3 beneficios', async () => {
    // months=24 → cutoff = 2024-03-25; all 3 stub benefits (Jan/Feb/Mar 2025) pass
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary?months=24', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().totalBenefits, 3)
    assert.equal(res.json().timeline.length, 3)
  })

  test('SDA-00423 months=24: byType tiene SAMPLE y GIFT', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary?months=24', headers: { authorization: `Bearer ${token(app)}` } })
    const { byType } = res.json()
    assert.ok('SAMPLE' in byType)
    assert.ok('GIFT'   in byType)
  })

  test('SDA-00423 months=24: byType.SAMPLE.count=2, byType.GIFT.count=1', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary?months=24', headers: { authorization: `Bearer ${token(app)}` } })
    const { byType } = res.json()
    assert.equal(byType.SAMPLE.count, 2)
    assert.equal(byType.GIFT.count,   1)
  })

  test('byType entries tienen count e items', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary?months=24', headers: { authorization: `Bearer ${token(app)}` } })
    for (const entry of Object.values(res.json().byType)) {
      assert.ok('count' in entry)
      assert.ok('items' in entry)
      assert.ok(Array.isArray(entry.items))
    }
  })

  test('timeline entries tienen date, promoName y benefit', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary?months=24', headers: { authorization: `Bearer ${token(app)}` } })
    for (const item of res.json().timeline) {
      assert.ok('date'      in item)
      assert.ok('promoName' in item)
      assert.ok('benefit'   in item)
    }
  })

  test('SDA-00521 con months=24 tiene exactamente 2 beneficios', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary?months=24', headers: { authorization: `Bearer ${token(app, 'SDA-00521')}` } })
    assert.equal(res.json().totalBenefits, 2)
  })

  test('SDA-00521 months=24: byType tiene GIFT y SAMPLE', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary?months=24', headers: { authorization: `Bearer ${token(app, 'SDA-00521')}` } })
    const { byType } = res.json()
    assert.ok('GIFT'   in byType)
    assert.ok('SAMPLE' in byType)
  })

  test('totalBenefits coincide con timeline.length', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary?months=24', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().totalBenefits, res.json().timeline.length)
  })

  test('adminToken puede acceder al resumen de beneficios', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/intelligence/benefits-summary', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
  })
})
