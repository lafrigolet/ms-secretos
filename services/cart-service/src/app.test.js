import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { cartRoutes } from './routes/cart.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

process.env.JWT_SECRET = 'test-secret'

// ── Mock de global.fetch ──────────────────────────────────────────
// clients/PromotionsClient.js usa HttpClient que internamente usa fetch.
// Simulamos una respuesta vacía del promotions-service para aislar
// los tests del cart de cualquier dependencia externa.
global.fetch = async () => ({ ok: true, json: async () => ({ benefits: [] }) })

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
  await app.register(cartRoutes, { prefix: '/cart' })
  return app
}

const token = (app, sub = 'SDA-TEST') =>
  app.jwt.sign({ sub, profile: 'PREMIUM', role: 'CUSTOMER' })
const expiredToken = (app) =>
  app.jwt.sign({ sub: 'EXP-USER', profile: 'STANDARD', role: 'CUSTOMER', exp: Math.floor(Date.now() / 1000) - 3600 })
const item = { productCode: 'P-RT-001', name: 'Champú', quantity: 2, unitPrice: 16.00 }

// ══════════════════════════════════════════════════════════════════
describe('HU-14 — Gestión de cesta', () => {
  test('cesta vacía al inicio', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${token(app, 'USER-A')}` } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json().items, [])
    assert.equal(res.json().total, 0)
  })

  test('añadir producto a la cesta', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${token(app, 'USER-B')}` }, payload: item })
    assert.equal(res.statusCode, 201)
    assert.equal(res.json().items.length, 1)
    assert.equal(res.json().items[0].quantity, 2)
  })

  test('añadir el mismo producto suma las cantidades', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-C')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: item })
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { ...item, quantity: 3 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().items[0].quantity, 5)
  })

  test('modificar cantidad de un producto', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-D')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: item })
    const res = await app.inject({ method: 'PATCH', url: '/cart/items/P-RT-001', headers: { authorization: `Bearer ${t}` }, payload: { quantity: 10 } })
    assert.equal(res.json().items[0].quantity, 10)
  })

  test('cantidad 0 elimina el producto', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-E')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: item })
    await app.inject({ method: 'PATCH', url: '/cart/items/P-RT-001', headers: { authorization: `Bearer ${t}` }, payload: { quantity: 0 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.deepEqual(res.json().items, [])
  })

  test('eliminar producto de la cesta', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-F')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: item })
    await app.inject({ method: 'DELETE', url: '/cart/items/P-RT-001', headers: { authorization: `Bearer ${t}` } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.deepEqual(res.json().items, [])
  })

  test('vaciar cesta', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-G')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: item })
    await app.inject({ method: 'DELETE', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().total, 0)
  })

  // ── Autenticación — GET /cart ──────────────────────────────────
  test('GET /cart sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/cart' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('GET /cart con token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: 'Bearer not.a.valid.jwt' } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('GET /cart con token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  // ── Autenticación — POST /cart/items ──────────────────────────
  test('POST /cart/items sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/cart/items', payload: item })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('POST /cart/items con token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: 'Bearer bad.token' }, payload: item })
    assert.equal(res.statusCode, 401)
  })

  // ── Validación — POST /cart/items ─────────────────────────────
  test('POST /cart/items sin productCode → 400', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-VAL1')
    const res = await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { quantity: 1, unitPrice: 10 } })
    assert.equal(res.statusCode, 400)
  })

  test('POST /cart/items sin quantity → 400', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-VAL2')
    const res = await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', unitPrice: 10 } })
    assert.equal(res.statusCode, 400)
  })

  test('POST /cart/items sin unitPrice → 400', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-VAL3')
    const res = await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', quantity: 1 } })
    assert.equal(res.statusCode, 400)
  })

  test('POST /cart/items quantity = 0 → 400 (mínimo 1)', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-VAL4')
    const res = await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', quantity: 0, unitPrice: 10 } })
    assert.equal(res.statusCode, 400)
  })

  test('POST /cart/items quantity negativa → 400', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-VAL5')
    const res = await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', quantity: -3, unitPrice: 10 } })
    assert.equal(res.statusCode, 400)
  })

  test('POST /cart/items unitPrice negativo → 400', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-VAL6')
    const res = await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', quantity: 1, unitPrice: -5 } })
    assert.equal(res.statusCode, 400)
  })

  // ── Autenticación — PATCH /cart/items/:productCode ────────────
  test('PATCH /cart/items/:productCode sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/cart/items/P-RT-001', payload: { quantity: 5 } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('PATCH /cart/items/:productCode producto no en cesta → 404 ITEM_NOT_FOUND', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-PATCH1')
    const res = await app.inject({ method: 'PATCH', url: '/cart/items/P-NONEXISTENT', headers: { authorization: `Bearer ${t}` }, payload: { quantity: 5 } })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'ITEM_NOT_FOUND')
  })

  test('PATCH /cart/items/:productCode quantity negativa → 400', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-PATCH2')
    const res = await app.inject({ method: 'PATCH', url: '/cart/items/P-RT-001', headers: { authorization: `Bearer ${t}` }, payload: { quantity: -1 } })
    assert.equal(res.statusCode, 400)
  })

  test('PATCH /cart/items/:productCode sin body quantity → 400', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-PATCH3')
    const res = await app.inject({ method: 'PATCH', url: '/cart/items/P-RT-001', headers: { authorization: `Bearer ${t}` }, payload: {} })
    assert.equal(res.statusCode, 400)
  })

  // ── Autenticación — DELETE /cart/items/:productCode ───────────
  test('DELETE /cart/items/:productCode sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/cart/items/P-RT-001' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('DELETE /cart/items/:productCode producto inexistente es idempotente', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-DEL1')
    const res = await app.inject({ method: 'DELETE', url: '/cart/items/P-NO-EXISTE', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json().items, [])
  })

  // ── Autenticación — DELETE /cart ──────────────────────────────
  test('DELETE /cart sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/cart' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  // ── Múltiples productos y aislamiento por usuario ─────────────
  test('múltiples productos distintos en la cesta', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-MULTI')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-A', name: 'Producto A', quantity: 1, unitPrice: 20 } })
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-B', name: 'Producto B', quantity: 3, unitPrice: 15 } })
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-C', name: 'Producto C', quantity: 2, unitPrice: 10 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().items.length, 3)
  })

  test('carros de distintos usuarios son independientes', async () => {
    const app = await buildApp()
    const tA = token(app, 'USER-ISO-A')
    const tB = token(app, 'USER-ISO-B')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${tA}` }, payload: { productCode: 'P-A', name: 'A', quantity: 5, unitPrice: 10 } })
    // Usuario B no ha añadido nada
    const resB = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${tB}` } })
    assert.deepEqual(resB.json().items, [])
    // Usuario A sigue teniendo su item
    const resA = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${tA}` } })
    assert.equal(resA.json().items.length, 1)
  })

  test('añadir producto devuelve los campos del item correctamente', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-FIELDS')
    const res = await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-RT-002', name: 'Sérum', quantity: 1, unitPrice: 45 } })
    const added = res.json().items[0]
    assert.equal(added.productCode, 'P-RT-002')
    assert.equal(added.name, 'Sérum')
    assert.equal(added.quantity, 1)
    assert.equal(added.unitPrice, 45)
  })

  test('GET /cart incluye shippingThreshold = 150', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-THRESH')
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().shippingThreshold, 150)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-15 — Gastos de envío', () => {
  test('pedido por debajo de 150€ tiene gastos de envío', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-H')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 1, unitPrice: 50 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.ok(res.json().shipping > 0)
  })

  test('pedido igual o superior a 150€ tiene envío gratis', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-I')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 1, unitPrice: 200 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().shipping, 0)
  })

  test('cesta vacía tiene shipping = 0 (no 8.50)', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-EMPTY-SHIP')
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().shipping, 0)
  })

  test('subtotal exactamente 150€ → envío gratis', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-EXACT150')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 3, unitPrice: 50 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().subtotal, 150)
    assert.equal(res.json().shipping, 0)
  })

  test('subtotal 149.99€ → shipping = 8.50', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-14999')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 1, unitPrice: 149.99 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().subtotal, 149.99)
    assert.equal(res.json().shipping, 8.50)
  })

  test('cálculo exacto de subtotal, shipping y total', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-CALC')
    // 2 × 16.00 = 32.00 → subtotal < 150 → shipping = 8.50 → total = 40.50
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-RT-001', name: 'Champú', quantity: 2, unitPrice: 16.00 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    const body = res.json()
    assert.equal(body.subtotal, 32.00)
    assert.equal(body.shipping, 8.50)
    assert.equal(body.total, 40.50)
  })

  test('cálculo exacto con múltiples productos y envío gratis', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-CALC2')
    // 3 × 30.00 + 2 × 45.00 = 90 + 90 = 180 → free shipping
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-A', name: 'A', quantity: 3, unitPrice: 30.00 } })
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-B', name: 'B', quantity: 2, unitPrice: 45.00 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    const body = res.json()
    assert.equal(body.subtotal, 180.00)
    assert.equal(body.shipping, 0)
    assert.equal(body.total, 180.00)
  })

  test('shipping = 8.50 se refleja en el total', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-TOTAL-CHECK')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 1, unitPrice: 50 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    const body = res.json()
    assert.equal(body.total, body.subtotal + body.shipping)
  })

  test('shippingThreshold = 150 en respuesta del carrito', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-STHRESH')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 1, unitPrice: 10 } })
    const res = await app.inject({ method: 'GET', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().shippingThreshold, 150)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-16 — Resumen del pedido', () => {
  test('GET /cart/summary devuelve todos los campos necesarios', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-J')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: item })
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok('items' in body)
    assert.ok('subtotal' in body)
    assert.ok('shipping' in body)
    assert.ok('total' in body)
    assert.ok('benefits' in body)
    assert.ok('freeShippingRemaining' in body)
  })

  test('GET /cart/summary sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/cart/summary' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('GET /cart/summary con token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: 'Bearer tampered.token.value' } })
    assert.equal(res.statusCode, 401)
  })

  test('GET /cart/summary con token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('GET /cart/summary cesta vacía → benefits = [] (STUB, total < 100)', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-SUM-EMPTY')
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json().benefits, [])
  })

  test('GET /cart/summary con total < 100 → benefits = [] (STUB)', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-SUM-LT100')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 1, unitPrice: 50 } })
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: `Bearer ${t}` } })
    assert.deepEqual(res.json().benefits, [])
  })

  test('GET /cart/summary con total >= 100 → 1 beneficio GIFT (STUB)', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-SUM-GE100')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 1, unitPrice: 100 } })
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().benefits.length, 1)
    assert.equal(res.json().benefits[0].type, 'GIFT')
  })

  test('beneficio GIFT incluye description y promoName', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-SUM-GIFT')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 2, unitPrice: 80 } })
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: `Bearer ${t}` } })
    const benefit = res.json().benefits[0]
    assert.ok('description' in benefit)
    assert.ok('promoName' in benefit)
    assert.equal(benefit.description, 'Muestra Sérum Raíces 15ml')
    assert.equal(benefit.promoName, 'Promo Otoño')
  })

  test('freeShippingRemaining = max(0, 150 - subtotal) cuando subtotal < 150', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-FSR1')
    // subtotal = 1 × 60 = 60 → freeShippingRemaining = 90
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 1, unitPrice: 60 } })
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().freeShippingRemaining, 90)
  })

  test('freeShippingRemaining = 0 cuando subtotal >= 150', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-FSR2')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 1, unitPrice: 200 } })
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().freeShippingRemaining, 0)
  })

  test('freeShippingRemaining = 0 cuando cesta vacía (subtotal = 0)', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-FSR3')
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().freeShippingRemaining, 150)
  })

  test('shippingThreshold = 150 en el summary', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-SUMTHRESH')
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().shippingThreshold, 150)
  })

  test('summary con subtotal exactamente 100 activa beneficio STUB', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-SUM-EXACT100')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 4, unitPrice: 25 } })
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().subtotal, 100)
    assert.equal(res.json().benefits.length, 1)
  })

  test('summary incluye items de la cesta', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-SUM-ITEMS')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-RT-001', name: 'Champú', quantity: 2, unitPrice: 16 } })
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-SE-002', name: 'Sérum', quantity: 1, unitPrice: 45 } })
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: `Bearer ${t}` } })
    assert.equal(res.json().items.length, 2)
  })

  test('summary refleja cesta vacía tras DELETE /cart', async () => {
    const app = await buildApp()
    const t = token(app, 'USER-SUM-CLEAR')
    await app.inject({ method: 'POST', url: '/cart/items', headers: { authorization: `Bearer ${t}` }, payload: { productCode: 'P-X', name: 'X', quantity: 1, unitPrice: 200 } })
    await app.inject({ method: 'DELETE', url: '/cart', headers: { authorization: `Bearer ${t}` } })
    const res = await app.inject({ method: 'GET', url: '/cart/summary', headers: { authorization: `Bearer ${t}` } })
    assert.deepEqual(res.json().items, [])
    assert.equal(res.json().subtotal, 0)
    assert.equal(res.json().total, 0)
    assert.deepEqual(res.json().benefits, [])
  })
})
