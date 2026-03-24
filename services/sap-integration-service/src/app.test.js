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

  test('respuesta incluye campo timestamp', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.ok('timestamp' in res.json())
    assert.ok(!isNaN(Date.parse(res.json().timestamp)))
  })

  test('respuesta incluye campo cache', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.ok('cache' in res.json())
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

  test('GET /internal/customers — devuelve 6 clientes', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/customers' })
    assert.equal(res.json().length, 6)
  })

  test('GET /internal/customers — cada cliente tiene los campos requeridos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/customers' })
    for (const c of res.json()) {
      assert.ok('sapCode'      in c)
      assert.ok('name'         in c)
      assert.ok('profile'      in c)
      assert.ok('status'       in c)
      assert.ok('role'         in c)
      assert.ok('email'        in c)
      assert.ok('businessName' in c)
      assert.equal(c.password, undefined)
    }
  })

  test('GET /internal/customers — ADMIN-001 está en la lista', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/customers' })
    assert.ok(res.json().some(c => c.sapCode === 'ADMIN-001'))
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

  test('GET /internal/customers/SDA-00423 — campos completos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/customers/SDA-00423' })
    const body = res.json()
    assert.equal(body.name,         'Rosa Canals')
    assert.equal(body.businessName, 'Salón Canals Barcelona')
    assert.equal(body.email,        'rosa@saloncanals.com')
    assert.equal(body.status,       'ACTIVE')
    assert.equal(body.role,         'CUSTOMER')
    assert.equal(body.creditLimit,  5000)
  })

  test('GET /internal/customers/SDA-00521 — cliente VIP', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/customers/SDA-00521' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.profile, 'VIP')
    assert.equal(body.status,  'ACTIVE')
    assert.equal(body.name,    'Lidia Puig')
  })

  test('GET /internal/customers/ADMIN-001 — administrador', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/customers/ADMIN-001' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.role,    'ADMIN')
    assert.equal(body.profile, 'ADMIN')
    assert.equal(body.status,  'ACTIVE')
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
    assert.equal(body.status,  'ACTIVE')
    assert.equal(body.profile, 'PREMIUM')
  })

  test('POST /internal/customers/verify — respuesta incluye nombre y email', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers/verify',
      payload: { sapCode: 'SDA-00423', password: 'demo1234' }
    })
    const body = res.json()
    assert.ok(body.name)
    assert.ok(body.email)
    assert.equal(body.password, undefined)
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

  test('POST /internal/customers/verify — ADMIN-001 contraseña correcta', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers/verify',
      payload: { sapCode: 'ADMIN-001', password: 'admin1234' }
    })
    assert.equal(res.json().authenticated, true)
    assert.equal(res.json().role, 'ADMIN')
  })

  test('POST /internal/customers/verify — ADMIN-001 contraseña incorrecta', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers/verify',
      payload: { sapCode: 'ADMIN-001', password: 'demo1234' }
    })
    assert.equal(res.json().authenticated, false)
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

  test('POST /internal/customers/verify — validación: password requerido', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers/verify',
      payload: { sapCode: 'SDA-00423' }
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

  test('familias tienen id, name y description', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/families' })
    for (const f of res.json()) {
      assert.ok('id'          in f)
      assert.ok('name'        in f)
      assert.ok('description' in f)
    }
  })

  test('IDs de familias son F01, F02, F03', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/families' })
    const ids = res.json().map(f => f.id)
    assert.ok(ids.includes('F01'))
    assert.ok(ids.includes('F02'))
    assert.ok(ids.includes('F03'))
  })

  test('F01 es Ritual Timeless, F02 es Sensitivo, F03 es Brillo & Nutrición', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/families' })
    const byId = Object.fromEntries(res.json().map(f => [f.id, f.name]))
    assert.equal(byId['F01'], 'Ritual Timeless')
    assert.equal(byId['F02'], 'Sensitivo')
    assert.equal(byId['F03'], 'Brillo & Nutrición')
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

  test('catálogo tiene 8 productos en total', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/products' })
    assert.equal(res.json().length, 8)
  })

  test('cada producto tiene sapCode, name, familyId, description, format, active', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/products' })
    for (const p of res.json()) {
      assert.ok('sapCode'     in p)
      assert.ok('name'        in p)
      assert.ok('familyId'    in p)
      assert.ok('description' in p)
      assert.ok('format'      in p)
      assert.ok('active'      in p)
    }
  })

  test('GET /internal/catalog/products?familyId=F01 — filtra por familia', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/products?familyId=F01' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(body.length > 0)
    assert.ok(body.every(p => p.familyId === 'F01'))
  })

  test('F01 tiene 4 productos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/products?familyId=F01' })
    assert.equal(res.json().length, 4)
  })

  test('F02 tiene 2 productos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/products?familyId=F02' })
    assert.equal(res.json().length, 2)
  })

  test('F03 tiene 2 productos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/products?familyId=F03' })
    assert.equal(res.json().length, 2)
  })

  test('F02 productos pertenecen a Sensitivo', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/products?familyId=F02' })
    const codes = res.json().map(p => p.sapCode)
    assert.ok(codes.includes('P-SN-001'))
    assert.ok(codes.includes('P-SN-002'))
  })

  test('GET /internal/catalog/products/:sapCode — producto existente', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/products/P-RT-001' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.sapCode, 'P-RT-001')
    assert.ok(body.name)
  })

  test('P-RT-001 tiene campos correctos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/products/P-RT-001' })
    const body = res.json()
    assert.equal(body.sapCode,   'P-RT-001')
    assert.equal(body.familyId,  'F01')
    assert.equal(body.name,      'Champú Restaurador Timeless')
    assert.equal(body.format,    '250ml')
    assert.equal(body.active,    true)
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

  test('precios STANDARD contienen los 8 productos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/prices/STANDARD' })
    assert.equal(Object.keys(res.json()).length, 8)
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

  test('Los precios PREMIUM son menores que STANDARD', async () => {
    const app = await buildApp()
    const [stdRes, preRes] = await Promise.all([
      app.inject({ method: 'GET', url: '/internal/catalog/prices/STANDARD' }),
      app.inject({ method: 'GET', url: '/internal/catalog/prices/PREMIUM' })
    ])
    const std = stdRes.json()
    const pre = preRes.json()
    for (const code of Object.keys(std)) {
      assert.ok(pre[code] <= std[code], `PREMIUM price for ${code} should be ≤ STANDARD`)
    }
  })

  test('P-RT-001 STANDARD=18.50, PREMIUM=16.00, VIP=14.50', async () => {
    const app = await buildApp()
    const [stdR, preR, vipR] = await Promise.all([
      app.inject({ method: 'GET', url: '/internal/catalog/prices/STANDARD/P-RT-001' }),
      app.inject({ method: 'GET', url: '/internal/catalog/prices/PREMIUM/P-RT-001' }),
      app.inject({ method: 'GET', url: '/internal/catalog/prices/VIP/P-RT-001' })
    ])
    assert.equal(stdR.json().price, 18.50)
    assert.equal(preR.json().price, 16.00)
    assert.equal(vipR.json().price, 14.50)
  })

  test('GET /internal/catalog/prices/:profile/:productCode — precio individual', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/prices/PREMIUM/P-RT-001' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.productCode, 'P-RT-001')
    assert.equal(body.profile,     'PREMIUM')
    assert.ok(typeof body.price === 'number')
  })

  test('precio individual incluye productCode y profile', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/prices/VIP/P-BN-001' })
    assert.equal(res.json().productCode, 'P-BN-001')
    assert.equal(res.json().profile,     'VIP')
    assert.equal(res.json().price,       18.50)
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

  test('stock contiene los 8 productos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/stock' })
    assert.equal(Object.keys(res.json()).length, 8)
  })

  test('stock exacto: P-RT-001=240, P-SN-001=310, P-BN-001=160', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/stock' })
    const stock = res.json()
    assert.equal(stock['P-RT-001'], 240)
    assert.equal(stock['P-SN-001'], 310)
    assert.equal(stock['P-BN-001'], 160)
  })

  test('GET /internal/catalog/stock/:productCode — stock de un producto', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/stock/P-RT-001' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.productCode, 'P-RT-001')
    assert.ok(typeof body.stock === 'number')
  })

  test('P-RT-001 stock = 240', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/stock/P-RT-001' })
    assert.equal(res.json().stock, 240)
  })

  test('P-SN-001 stock = 310 (mayor del catálogo)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/stock/P-SN-001' })
    assert.equal(res.json().stock, 310)
  })

  test('P-RT-003 stock = 95 (menor del catálogo)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/catalog/stock/P-RT-003' })
    assert.equal(res.json().stock, 95)
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

  test('SDA-00423 tiene 5 pedidos en el stub', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/SDA-00423' })
    assert.equal(res.json().length, 5)
  })

  test('cada pedido tiene los campos requeridos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/SDA-00423' })
    for (const o of res.json()) {
      assert.ok('orderId'  in o)
      assert.ok('sapCode'  in o)
      assert.ok('date'     in o)
      assert.ok('status'   in o)
      assert.ok('items'    in o)
      assert.ok('total'    in o)
    }
  })

  test('pedidos incluyen invoiceId', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/SDA-00423' })
    assert.ok(res.json().every(o => o.invoiceId))
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

  test('SDA-2025-0890 tiene los datos correctos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/order/SDA-2025-0890' })
    const body = res.json()
    assert.equal(body.sapCode, 'SDA-00423')
    assert.equal(body.status,  'SHIPPED')
    assert.equal(body.total,   134.00)
    assert.equal(body.date,    '2025-03-08')
  })

  test('items del pedido tienen productCode, name, quantity, unitPrice', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/order/SDA-2025-0890' })
    const item = res.json().items[0]
    assert.ok('productCode' in item)
    assert.ok('name'        in item)
    assert.ok('quantity'    in item)
    assert.ok('unitPrice'   in item)
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

  test('pedido creado tiene sapCode correcto', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/orders',
      payload: {
        sapCode: 'SDA-00521',
        items: [{ productCode: 'P-RT-001', quantity: 2, unitPrice: 14.50 }]
      }
    })
    assert.equal(res.json().sapCode, 'SDA-00521')
  })

  test('total del pedido creado es la suma de unitPrice × quantity', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/orders',
      payload: {
        sapCode: 'SDA-00423',
        items: [
          { productCode: 'P-RT-001', quantity: 3, unitPrice: 16.00 },
          { productCode: 'P-RT-002', quantity: 2, unitPrice: 19.00 }
        ]
      }
    })
    // 3 × 16 + 2 × 19 = 48 + 38 = 86
    assert.equal(res.json().total, 86)
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

  test('POST /internal/orders — validación: sapCode requerido', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/orders',
      payload: { items: [{ productCode: 'P-RT-001', quantity: 1, unitPrice: 16 }] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('POST /internal/orders — item sin unitPrice → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/orders',
      payload: {
        sapCode: 'SDA-00423',
        items: [{ productCode: 'P-RT-001', quantity: 1 }]
      }
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

  test('FAC-2025-0890 tiene los campos correctos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/invoice/FAC-2025-0890' })
    const body = res.json()
    assert.equal(body.orderId,   'SDA-2025-0890')
    assert.equal(body.sapCode,   'SDA-00423')
    assert.equal(body.total,     134.00)
    assert.ok(Array.isArray(body.items))
  })

  test('FAC-2025-0812 tiene total 289.00', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/invoice/FAC-2025-0812' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().total, 289.00)
  })

  test('GET /internal/orders/invoice/:invoiceId — factura no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/invoice/FAC-NO-EXISTE' })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'INVOICE_NOT_FOUND')
  })
})

// ══════════════════════════════════════════════════════════════════
// PATCH customers — actualizar perfil y estado (HU-05, HU-28)
// NOTE: mutations persist (shared module state from stubData.js)
// ══════════════════════════════════════════════════════════════════
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

  test('PATCH /:sapCode — respuesta no incluye password', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/internal/customers/SDA-00521',
      payload: { profile: 'STANDARD' }
    })
    assert.equal(res.json().password, undefined)
  })

  test('PATCH /:sapCode — perfil inválido → 400 VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/internal/customers/SDA-00423',
      payload: { profile: 'INVALIDO' }
    })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json().error, 'VALIDATION_ERROR')
  })

  test('PATCH /:sapCode — body sin profile → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/internal/customers/SDA-00423',
      payload: {}
    })
    assert.equal(res.statusCode, 400)
  })

  test('PATCH /:sapCode — cliente no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/internal/customers/NO-EXISTE',
      payload: { profile: 'PREMIUM' }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'CUSTOMER_NOT_FOUND')
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

  test('PATCH /:sapCode/status — estado inválido → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/internal/customers/SDA-00423/status',
      payload: { status: 'SUSPENDED' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('PATCH /:sapCode/status — cliente no existente → 404 CUSTOMER_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/internal/customers/NO-EXISTE/status',
      payload: { status: 'ACTIVE' }
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'CUSTOMER_NOT_FOUND')
  })

  test('PATCH /:sapCode/status — respuesta no incluye password', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/internal/customers/SDA-00423/status',
      payload: { status: 'ACTIVE' }
    })
    assert.equal(res.json().password, undefined)
  })
})

// ══════════════════════════════════════════════════════════════════
// BENEFITS (HU-43)
// ══════════════════════════════════════════════════════════════════
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

  test('SDA-00423 tiene beneficios de tipo SAMPLE, GIFT y DISCOUNT', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/SDA-00423/benefits' })
    const types = res.json().map(b => b.benefit.type)
    assert.ok(types.includes('SAMPLE'))
    assert.ok(types.includes('GIFT'))
    assert.ok(types.includes('DISCOUNT'))
  })

  test('cada beneficio tiene promoName, benefit.type, benefit.description, date', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/SDA-00423/benefits' })
    for (const b of res.json()) {
      assert.ok('promoName'         in b)
      assert.ok('date'              in b)
      assert.ok(b.benefit?.type)
      assert.ok(b.benefit?.description)
    }
  })

  test('cliente sin beneficios devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/SDA-00521/benefits' })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), [])
  })

  test('cliente sin pedidos devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/internal/orders/SDA-00387/benefits' })
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.json()))
  })
})

// ══════════════════════════════════════════════════════════════════
// RETURNS (HU-35)
// ══════════════════════════════════════════════════════════════════
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
    assert.equal(body.sapCode,  'SDA-00423')
    assert.equal(body.status,   'CREATED')
    assert.ok(body.createdAt)
  })

  test('createdAt es una fecha ISO válida', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/internal/returns/credit-note',
      payload: {
        returnId: 'RET-002',
        orderId:  'SDA-2025-0890',
        sapCode:  'SDA-00423',
        items: [{ productCode: 'P-RT-001', quantity: 1 }]
      }
    })
    assert.ok(!isNaN(Date.parse(res.json().createdAt)))
  })

  test('respuesta incluye orderId y items', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/internal/returns/credit-note',
      payload: {
        returnId: 'RET-003',
        orderId:  'SDA-2025-0812',
        sapCode:  'SDA-00423',
        items: [{ productCode: 'P-BN-001', quantity: 1 }]
      }
    })
    const body = res.json()
    assert.ok('orderId' in body)
    assert.ok('items'   in body)
    assert.ok(Array.isArray(body.items))
  })

  test('body inválido devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/internal/returns/credit-note',
      payload: { returnId: 'RET-001' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('sin orderId → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/internal/returns/credit-note',
      payload: { returnId: 'RET-X', sapCode: 'SDA-00423', items: [{ productCode: 'P-RT-001', quantity: 1 }] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('sin sapCode → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/internal/returns/credit-note',
      payload: { returnId: 'RET-X', orderId: 'SDA-2025-0890', items: [{ productCode: 'P-RT-001', quantity: 1 }] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('sin items → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/internal/returns/credit-note',
      payload: { returnId: 'RET-X', orderId: 'SDA-2025-0890', sapCode: 'SDA-00423' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('item con quantity = 0 → 400 (mínimo 1)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/internal/returns/credit-note',
      payload: {
        returnId: 'RET-X',
        orderId:  'SDA-2025-0890',
        sapCode:  'SDA-00423',
        items: [{ productCode: 'P-RT-001', quantity: 0 }]
      }
    })
    assert.equal(res.statusCode, 400)
  })
})
