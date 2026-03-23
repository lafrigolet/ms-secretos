import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'

import { SapService } from './services/SapService.js'
import { customerRoutes } from './routes/customers.js'
import { catalogRoutes } from './routes/catalog.js'
import { orderRoutes }   from './routes/orders.js'
import { returnsRoutes } from './routes/returns.js'
import { healthRoutes }  from './routes/health.js'
import { errorHandler } from './middleware/errorHandler.js'

// ── Setup ─────────────────────────────────────────────────────────
// Forzamos modo stub independientemente del .env
process.env.SAP_MODE = 'stub'
process.env.NODE_ENV = 'test'

async function buildApp () {
  const app = Fastify({ logger: false })
  await app.register(corsPlugin)
  await app.register(swaggerPlugin, {
    openapi: { info: { title: 'test', version: '1.0.0' } }
  })
  await app.register(swaggerUiPlugin, { routePrefix: '/docs' })
  app.decorate('sap', new SapService(app.log))
  app.setErrorHandler(errorHandler)
  await app.register(customerRoutes, { prefix: '/internal/customers' })
  await app.register(catalogRoutes,  { prefix: '/internal/catalog' })
  await app.register(orderRoutes,    { prefix: '/internal/orders' })
  await app.register(returnsRoutes,  { prefix: '/internal/returns' })
  await app.register(healthRoutes,   { prefix: '/health' })
  return app
}

// ══════════════════════════════════════════════════════════════════
// HEALTH
// ══════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  test('devuelve status ok y modo stub', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.status, 'ok')
    assert.equal(body.mode, 'stub')
    assert.ok(body.uptime >= 0)
  })

  test('POST /health/cache/invalidate limpia la caché', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/health/cache/invalidate' })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().message)
  })
})

// ══════════════════════════════════════════════════════════════════
// CUSTOMERS
// ══════════════════════════════════════════════════════════════════
describe('Customers', () => {
  test('GET /internal/customers — lista todos los clientes', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/customers' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(Array.isArray(body))
    assert.ok(body.length > 0)
    // Las contraseñas nunca deben exponerse
    body.forEach(c => assert.equal(c.password, undefined))
  })

  test('GET /internal/customers/:sapCode — cliente existente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/customers/SDA-00423' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.sapCode, 'SDA-00423')
    assert.equal(body.profile, 'PREMIUM')
    assert.equal(body.password, undefined)
  })

  test('GET /internal/customers/:sapCode — cliente no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/customers/NO-EXISTE' })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'CUSTOMER_NOT_FOUND')
  })

  test('POST /internal/customers/verify — credenciales correctas', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers/verify',
      payload: { sapCode: 'SDA-00423', password: 'demo1234' }
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.authenticated, true)
    assert.equal(body.status, 'ACTIVE')
    assert.equal(body.profile, 'PREMIUM')
  })

  test('POST /internal/customers/verify — contraseña incorrecta', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers/verify',
      payload: { sapCode: 'SDA-00423', password: 'incorrecta' }
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.authenticated, false)
    assert.equal(body.status, 'WRONG_PASSWORD')
  })

  test('POST /internal/customers/verify — cuenta bloqueada por deuda', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers/verify',
      payload: { sapCode: 'SDA-00187', password: 'demo1234' }
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.authenticated, false)
    assert.equal(body.status, 'BLOCKED')
    assert.equal(body.blockReason, 'DEBT')
  })

  test('POST /internal/customers/verify — cuenta bloqueada por admin', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers/verify',
      payload: { sapCode: 'SDA-00098', password: 'demo1234' }
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.authenticated, false)
    assert.equal(body.status, 'BLOCKED')
    assert.equal(body.blockReason, 'ADMIN')
  })

  test('POST /internal/customers/verify — código SAP no existe', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers/verify',
      payload: { sapCode: 'NO-EXISTE', password: 'demo1234' }
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.authenticated, false)
    assert.equal(body.status, 'NOT_FOUND')
  })

  test('POST /internal/customers/verify — validación: sapCode requerido', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers/verify',
      payload: { password: 'demo1234' }
    })
    assert.equal(res.statusCode, 400)
  })
})

// ══════════════════════════════════════════════════════════════════
// CATALOG — familias
// ══════════════════════════════════════════════════════════════════
describe('Catalog — familias', () => {
  test('GET /internal/catalog/families — lista las 3 familias', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/families' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(Array.isArray(body))
    assert.equal(body.length, 3)
    assert.ok(body.every(f => f.id && f.name))
  })
})

// ══════════════════════════════════════════════════════════════════
// CATALOG — productos
// ══════════════════════════════════════════════════════════════════
describe('Catalog — productos', () => {
  test('GET /internal/catalog/products — lista todos los productos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/products' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(Array.isArray(body))
    assert.ok(body.length > 0)
    assert.ok(body.every(p => p.sapCode && p.name && p.familyId))
  })

  test('GET /internal/catalog/products?familyId=F01 — filtra por familia', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/products?familyId=F01' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(body.length > 0)
    assert.ok(body.every(p => p.familyId === 'F01'))
  })

  test('GET /internal/catalog/products/:sapCode — producto existente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/products/P-RT-001' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.sapCode, 'P-RT-001')
    assert.ok(body.name)
  })

  test('GET /internal/catalog/products/:sapCode — producto no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/products/NO-EXISTE' })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'PRODUCT_NOT_FOUND')
  })
})

// ══════════════════════════════════════════════════════════════════
// CATALOG — precios
// ══════════════════════════════════════════════════════════════════
describe('Catalog — precios', () => {
  test('GET /internal/catalog/prices/PREMIUM — devuelve precios PREMIUM', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/prices/PREMIUM' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(typeof body === 'object')
    assert.ok(Object.keys(body).length > 0)
    assert.ok(Object.values(body).every(p => typeof p === 'number'))
  })

  test('Los precios VIP son menores que STANDARD', async () => {
    const app = await buildApp()
    const [stdRes, vipRes] = await Promise.all([
      app.inject({ method: 'GET', url: '/internal/catalog/prices/STANDARD' }),
      app.inject({ method: 'GET', url: '/internal/catalog/prices/VIP' })
    ])
    const std = stdRes.json()
    const vip = vipRes.json()
    for (const code of Object.keys(std)) {
      assert.ok(vip[code] <= std[code], `VIP price for ${code} should be ≤ STANDARD`)
    }
  })

  test('GET /internal/catalog/prices/:profile/:productCode — precio individual', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/prices/PREMIUM/P-RT-001' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.productCode, 'P-RT-001')
    assert.equal(body.profile, 'PREMIUM')
    assert.ok(typeof body.price === 'number')
  })
})

// ══════════════════════════════════════════════════════════════════
// CATALOG — stock
// ══════════════════════════════════════════════════════════════════
describe('Catalog — stock', () => {
  test('GET /internal/catalog/stock — devuelve stock de todos los productos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/stock' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(typeof body === 'object')
    assert.ok(Object.values(body).every(s => typeof s === 'number' && s >= 0))
  })

  test('GET /internal/catalog/stock/:productCode — stock de un producto', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/stock/P-RT-001' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.productCode, 'P-RT-001')
    assert.ok(typeof body.stock === 'number')
  })
})

// ══════════════════════════════════════════════════════════════════
// ORDERS
// ══════════════════════════════════════════════════════════════════
describe('Orders', () => {
  test('GET /internal/orders/:sapCode — devuelve pedidos del cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/SDA-00423' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(Array.isArray(body))
    assert.ok(body.length > 0)
    assert.ok(body.every(o => o.orderId && o.sapCode && o.status))
  })

  test('GET /internal/orders/:sapCode — cliente sin pedidos devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/SDA-00387' })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), [])
  })

  test('GET /internal/orders/order/:orderId — pedido existente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/order/SDA-2025-0890' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.orderId, 'SDA-2025-0890')
    assert.ok(Array.isArray(body.items))
    assert.ok(body.items.length > 0)
  })

  test('GET /internal/orders/order/:orderId — pedido no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/order/NO-EXISTE' })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'ORDER_NOT_FOUND')
  })

  test('POST /internal/orders — crea un pedido nuevo', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/orders',
      payload: {
        sapCode: 'SDA-00423',
        items: [
          { productCode: 'P-RT-001', quantity: 6, unitPrice: 16.00 },
          { productCode: 'P-BN-001', quantity: 2, unitPrice: 21.00 }
        ]
      }
    })
    assert.equal(res.statusCode, 201)
    const body = res.json()
    assert.ok(body.orderId)
    assert.equal(body.status, 'CONFIRMED')
    assert.ok(body.total > 0)
  })

  test('POST /internal/orders — validación: items requeridos', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/orders',
      payload: { sapCode: 'SDA-00423' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('GET /internal/orders/invoice/:invoiceId — factura existente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/invoice/FAC-2025-0890' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.invoiceId, 'FAC-2025-0890')
    assert.ok(body.orderId)
    assert.ok(body.total > 0)
  })

  test('GET /internal/orders/invoice/:invoiceId — factura no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/invoice/FAC-NO-EXISTE' })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'INVOICE_NOT_FOUND')
  })
})

describe('PATCH /internal/customers — actualizar perfil y estado (HU-05, HU-28)', () => {
  test('PATCH /:sapCode — actualiza el perfil de un cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/internal/customers/SDA-00387',
      payload: { profile: 'PREMIUM' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().profile, 'PREMIUM')
    assert.equal(res.json().sapCode, 'SDA-00387')
  })

  test('PATCH /:sapCode — cliente no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/internal/customers/NO-EXISTE',
      payload: { profile: 'PREMIUM' }
    })
    assert.equal(res.statusCode, 404)
  })

  test('PATCH /:sapCode/status — bloquea una cuenta', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/internal/customers/SDA-00387/status',
      payload: { status: 'BLOCKED', blockReason: 'DEBT' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'BLOCKED')
    assert.equal(res.json().blockReason, 'DEBT')
  })

  test('PATCH /:sapCode/status — activa una cuenta', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/internal/customers/SDA-00187/status',
      payload: { status: 'ACTIVE' }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().status, 'ACTIVE')
  })
})

describe('GET /internal/orders/:sapCode/benefits (HU-43)', () => {
  test('devuelve los beneficios acumulados de un cliente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/SDA-00423/benefits' })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
    assert.ok(res.json().length > 0)
    const b = res.json()[0]
    assert.ok(b.promoName)
    assert.ok(b.benefit?.type)
    assert.ok(b.date)
  })

  test('cliente sin beneficios devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/SDA-00521/benefits' })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), [])
  })
})

describe('POST /internal/returns/credit-note (HU-35)', () => {
  test('crea una nota de crédito correctamente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/internal/returns/credit-note',
      payload: {
        returnId: 'RET-001',
        orderId:  'SDA-2025-0890',
        sapCode:  'SDA-00423',
        items: [{ productCode: 'P-RT-001', name: 'Champú Restaurador', quantity: 2 }]
      }
    })
    assert.equal(res.statusCode, 201)
    const body = res.json()
    assert.ok(body.creditNoteId)
    assert.equal(body.returnId, 'RET-001')
    assert.equal(body.sapCode, 'SDA-00423')
    assert.equal(body.status, 'CREATED')
    assert.ok(body.createdAt)
  })

  test('body inválido devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/internal/returns/credit-note',
      payload: { returnId: 'RET-001' }
    })
    assert.equal(res.statusCode, 400)
  })
})
