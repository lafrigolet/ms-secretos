import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { catalogRoutes } from './routes/catalog.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

process.env.NODE_ENV = 'test'
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
  await app.register(catalogRoutes, { prefix: '/catalog' })
  return app
}

const token = (app, profile = 'PREMIUM', role = 'CUSTOMER') =>
  app.jwt.sign({ sub: 'SDA-00423', profile, role })
const adminToken = (app) => app.jwt.sign({ sub: 'ADMIN-001', profile: 'ADMIN', role: 'ADMIN' })

// Stub data mirrors SapIntegrationClient.js — update if stub changes
const STUB_PRICES = {
  STANDARD: { 'P-RT-001': 16.00, 'P-RT-002': 19.00, 'P-RT-003': 31.00, 'P-SN-001': 13.00, 'P-SN-002': 14.00, 'P-BN-001': 26.00 },
  PREMIUM:  { 'P-RT-001': 15.20, 'P-RT-002': 18.05, 'P-RT-003': 29.45, 'P-SN-001': 12.35, 'P-SN-002': 13.30, 'P-BN-001': 24.70 },
  VIP:      { 'P-RT-001': 14.40, 'P-RT-002': 17.10, 'P-RT-003': 27.90, 'P-SN-001': 11.70, 'P-SN-002': 12.60, 'P-BN-001': 23.40 },
}
const STUB_STOCK = { 'P-RT-001': 240, 'P-RT-002': 0, 'P-RT-003': 85, 'P-SN-001': 310, 'P-SN-002': 150, 'P-BN-001': 45 }

// ══════════════════════════════════════════════════════════════════
// HU-07 — Familias de productos
// ══════════════════════════════════════════════════════════════════
describe('HU-07 — Familias de productos', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/catalog/families' })).statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/families' })
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/families', headers: { authorization: 'Bearer token.invalido.xyz' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado devuelve 401', async () => {
    const app = await buildApp()
    const expired = app.jwt.sign({ sub: 'SDA-00423', profile: 'PREMIUM', role: 'CUSTOMER' }, { expiresIn: '1ms' })
    await new Promise(r => setTimeout(r, 50))
    const res = await app.inject({ method: 'GET', url: '/catalog/families', headers: { authorization: `Bearer ${expired}` } })
    assert.equal(res.statusCode, 401)
  })

  test('devuelve las 3 familias', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/families', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().length, 3)
  })

  test('la respuesta es un array', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/families', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(Array.isArray(res.json()))
  })

  test('cada familia tiene id, name y description', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/families', headers: { authorization: `Bearer ${token(app)}` } })
    for (const f of res.json()) {
      assert.ok('id' in f, 'falta id')
      assert.ok('name' in f, 'falta name')
      assert.ok('description' in f, 'falta description')
    }
  })

  test('incluye la familia F01 — Ritual Timeless', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/families', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(res.json().some(f => f.id === 'F01'), 'falta F01')
  })

  test('incluye la familia F02 — Sensitivo', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/families', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(res.json().some(f => f.id === 'F02'), 'falta F02')
  })

  test('incluye la familia F03 — Brillo & Nutrición', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/families', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(res.json().some(f => f.id === 'F03'), 'falta F03')
  })

  test('cliente VIP también puede ver las familias', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/families', headers: { authorization: `Bearer ${token(app, 'VIP')}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().length, 3)
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-07, HU-08 — Listado de productos
// ══════════════════════════════════════════════════════════════════
describe('HU-07, HU-08 — Listado de productos', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/catalog/products' })).statusCode, 401)
  })

  test('token manipulado devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: 'Bearer manipulado.token.x' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado devuelve 401', async () => {
    const app = await buildApp()
    const expired = app.jwt.sign({ sub: 'SDA-00423', profile: 'PREMIUM', role: 'CUSTOMER' }, { expiresIn: '1ms' })
    await new Promise(r => setTimeout(r, 50))
    const res = await app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${expired}` } })
    assert.equal(res.statusCode, 401)
  })

  test('lista todos los productos con precio y stock del perfil', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.ok(res.json().every(p => p.price !== undefined && p.stock !== undefined && p.inStock !== undefined))
  })

  test('devuelve 6 productos en total', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().length, 6)
  })

  test('cada producto tiene sapCode, familyId, name, format, active, price, stock, inStock', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app)}` } })
    const required = ['sapCode', 'familyId', 'name', 'format', 'active', 'price', 'stock', 'inStock']
    for (const p of res.json()) {
      for (const field of required) {
        assert.ok(field in p, `producto ${p.sapCode} falta campo ${field}`)
      }
    }
  })

  test('producto con stock > 0 tiene inStock: true', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app)}` } })
    const p = res.json().find(p => p.sapCode === 'P-RT-001')
    assert.equal(p.inStock, true)
  })

  test('producto sin stock (P-RT-002) tiene inStock: false', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app)}` } })
    const p = res.json().find(p => p.sapCode === 'P-RT-002')
    assert.equal(p.inStock, false)
    assert.equal(p.stock, 0)
  })

  test('filtra productos por familia F01 — devuelve 3 productos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products?familyId=F01', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().length, 3)
    assert.ok(res.json().every(p => p.familyId === 'F01'))
  })

  test('filtra productos por familia F02 — devuelve 2 productos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products?familyId=F02', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().length, 2)
    assert.ok(res.json().every(p => p.familyId === 'F02'))
  })

  test('filtra productos por familia F03 — devuelve 1 producto', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products?familyId=F03', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().length, 1)
    assert.equal(res.json()[0].sapCode, 'P-BN-001')
  })

  test('familyId inexistente devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products?familyId=F99', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), [])
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-08 — Precios por perfil en listado
// ══════════════════════════════════════════════════════════════════
describe('HU-08 — Precios por perfil de cliente', () => {
  test('perfil STANDARD recibe precios más altos que PREMIUM', async () => {
    const app = await buildApp()
    const [rS, rP] = await Promise.all([
      app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app, 'STANDARD')}` } }),
      app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app, 'PREMIUM')}` } })
    ])
    const stdPrice = rS.json().find(p => p.sapCode === 'P-RT-001').price
    const prePrice = rP.json().find(p => p.sapCode === 'P-RT-001').price
    assert.ok(stdPrice > prePrice, 'STANDARD debe tener precio mayor que PREMIUM')
  })

  test('perfil PREMIUM recibe precios más altos que VIP', async () => {
    const app = await buildApp()
    const [rP, rV] = await Promise.all([
      app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app, 'PREMIUM')}` } }),
      app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app, 'VIP')}` } })
    ])
    const prePrice = rP.json().find(p => p.sapCode === 'P-RT-001').price
    const vipPrice = rV.json().find(p => p.sapCode === 'P-RT-001').price
    assert.ok(prePrice > vipPrice, 'PREMIUM debe tener precio mayor que VIP')
  })

  test('perfil STANDARD: P-RT-001 cuesta 16.00', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app, 'STANDARD')}` } })
    const p = res.json().find(p => p.sapCode === 'P-RT-001')
    assert.equal(p.price, STUB_PRICES.STANDARD['P-RT-001'])
  })

  test('perfil PREMIUM: P-RT-001 cuesta 15.20', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app, 'PREMIUM')}` } })
    const p = res.json().find(p => p.sapCode === 'P-RT-001')
    assert.equal(p.price, STUB_PRICES.PREMIUM['P-RT-001'])
  })

  test('perfil VIP: P-RT-001 cuesta 14.40', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app, 'VIP')}` } })
    const p = res.json().find(p => p.sapCode === 'P-RT-001')
    assert.equal(p.price, STUB_PRICES.VIP['P-RT-001'])
  })

  test('perfil ADMIN recibe los mismos precios que VIP', async () => {
    const app = await buildApp()
    const [rA, rV] = await Promise.all([
      app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${adminToken(app)}` } }),
      app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app, 'VIP')}` } })
    ])
    for (const product of rA.json()) {
      const vipProduct = rV.json().find(p => p.sapCode === product.sapCode)
      assert.equal(product.price, vipProduct.price, `ADMIN y VIP deben tener el mismo precio para ${product.sapCode}`)
    }
  })

  test('el stock es correcto para todos los productos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products', headers: { authorization: `Bearer ${token(app)}` } })
    for (const p of res.json()) {
      assert.equal(p.stock, STUB_STOCK[p.sapCode], `stock incorrecto para ${p.sapCode}`)
    }
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-08 — Ficha individual de producto
// ══════════════════════════════════════════════════════════════════
describe('HU-08 — Ficha individual de producto', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/catalog/products/P-RT-001' })).statusCode, 401)
  })

  test('token manipulado devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products/P-RT-001', headers: { authorization: 'Bearer manipulado.x.y' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado devuelve 401', async () => {
    const app = await buildApp()
    const expired = app.jwt.sign({ sub: 'SDA-00423', profile: 'PREMIUM', role: 'CUSTOMER' }, { expiresIn: '1ms' })
    await new Promise(r => setTimeout(r, 50))
    const res = await app.inject({ method: 'GET', url: '/catalog/products/P-RT-001', headers: { authorization: `Bearer ${expired}` } })
    assert.equal(res.statusCode, 401)
  })

  test('devuelve la ficha completa de P-RT-001', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products/P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.sapCode, 'P-RT-001')
    assert.ok(body.price > 0)
    assert.ok(body.stock >= 0)
  })

  test('la ficha incluye sapCode, familyId, name, format, active, price, stock, inStock', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products/P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    const body = res.json()
    for (const field of ['sapCode', 'familyId', 'name', 'format', 'active', 'price', 'stock', 'inStock']) {
      assert.ok(field in body, `falta campo ${field}`)
    }
  })

  test('producto no existente devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products/NO-EXISTE', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 404)
  })

  test('producto no existente devuelve error PRODUCT_NOT_FOUND', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products/NO-EXISTE', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().error, 'PRODUCT_NOT_FOUND')
  })

  test('P-RT-002 tiene stock 0 e inStock: false', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products/P-RT-002', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().stock, 0)
    assert.equal(res.json().inStock, false)
  })

  test('P-RT-001 tiene stock 240 e inStock: true', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products/P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().stock, 240)
    assert.equal(res.json().inStock, true)
  })

  test('P-RT-001 pertenece a la familia F01', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products/P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().familyId, 'F01')
  })

  test('P-SN-001 pertenece a la familia F02', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products/P-SN-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().familyId, 'F02')
  })

  test('P-BN-001 pertenece a la familia F03', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products/P-BN-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().familyId, 'F03')
  })

  test('el precio de P-RT-001 varía según el perfil PREMIUM vs VIP', async () => {
    const app = await buildApp()
    const [rP, rV] = await Promise.all([
      app.inject({ method: 'GET', url: '/catalog/products/P-RT-001', headers: { authorization: `Bearer ${token(app, 'PREMIUM')}` } }),
      app.inject({ method: 'GET', url: '/catalog/products/P-RT-001', headers: { authorization: `Bearer ${token(app, 'VIP')}` } })
    ])
    assert.equal(rP.json().price, STUB_PRICES.PREMIUM['P-RT-001'])
    assert.equal(rV.json().price, STUB_PRICES.VIP['P-RT-001'])
    assert.ok(rP.json().price > rV.json().price)
  })

  test('el precio de P-BN-001 para perfil STANDARD es correcto', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/products/P-BN-001', headers: { authorization: `Bearer ${token(app, 'STANDARD')}` } })
    assert.equal(res.json().price, STUB_PRICES.STANDARD['P-BN-001'])
  })
})

// ══════════════════════════════════════════════════════════════════
// HU-09 — Recomendaciones
// ══════════════════════════════════════════════════════════════════
describe('HU-09 — Recomendaciones', () => {
  test('sin token devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/catalog/recommendations?cartItems=P-RT-001' })).statusCode, 401)
  })

  test('token manipulado devuelve 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/recommendations?cartItems=P-RT-001', headers: { authorization: 'Bearer invalido.x.y' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado devuelve 401', async () => {
    const app = await buildApp()
    const expired = app.jwt.sign({ sub: 'SDA-00423', profile: 'PREMIUM', role: 'CUSTOMER' }, { expiresIn: '1ms' })
    await new Promise(r => setTimeout(r, 50))
    const res = await app.inject({ method: 'GET', url: '/catalog/recommendations?cartItems=P-RT-001', headers: { authorization: `Bearer ${expired}` } })
    assert.equal(res.statusCode, 401)
  })

  test('sin items en cesta devuelve array vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/recommendations', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), [])
  })

  test('devuelve productos de la misma familia no presentes en la cesta', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/recommendations?cartItems=P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(!body.some(p => p.sapCode === 'P-RT-001'), 'P-RT-001 no debe aparecer en recomendaciones')
    assert.ok(body.every(p => p.familyId === 'F01'), 'todos deben ser de la familia F01')
  })

  test('los items del carrito no aparecen en las recomendaciones', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/recommendations?cartItems=P-RT-001,P-RT-002', headers: { authorization: `Bearer ${token(app)}` } })
    const body = res.json()
    assert.ok(!body.some(p => p.sapCode === 'P-RT-001'))
    assert.ok(!body.some(p => p.sapCode === 'P-RT-002'))
  })

  test('varios items de distintas familias recomiendan de ambas familias', async () => {
    const app = await buildApp()
    // P-RT-001 de F01, P-SN-001 de F02
    const res = await app.inject({ method: 'GET', url: '/catalog/recommendations?cartItems=P-RT-001,P-SN-001', headers: { authorization: `Bearer ${token(app)}` } })
    const families = new Set(res.json().map(p => p.familyId))
    assert.ok(families.has('F01'), 'debe recomendar de F01')
    assert.ok(families.has('F02'), 'debe recomendar de F02')
  })

  test('las recomendaciones están limitadas a 4 items', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/recommendations?cartItems=P-RT-001,P-SN-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(res.json().length <= 4)
  })

  test('la respuesta es un array', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/recommendations?cartItems=P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(Array.isArray(res.json()))
  })

  test('las recomendaciones incluyen price, stock e inStock', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/catalog/recommendations?cartItems=P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    for (const p of res.json()) {
      assert.ok('price' in p, 'falta price')
      assert.ok('stock' in p, 'falta stock')
      assert.ok('inStock' in p, 'falta inStock')
    }
  })

  test('el precio de las recomendaciones respeta el perfil del cliente', async () => {
    const app = await buildApp()
    const [rP, rV] = await Promise.all([
      app.inject({ method: 'GET', url: '/catalog/recommendations?cartItems=P-RT-001', headers: { authorization: `Bearer ${token(app, 'PREMIUM')}` } }),
      app.inject({ method: 'GET', url: '/catalog/recommendations?cartItems=P-RT-001', headers: { authorization: `Bearer ${token(app, 'VIP')}` } })
    ])
    const premiumItem = rP.json().find(p => p.sapCode === 'P-RT-003')
    const vipItem     = rV.json().find(p => p.sapCode === 'P-RT-003')
    if (premiumItem && vipItem) {
      assert.ok(premiumItem.price > vipItem.price, 'PREMIUM debe pagar más que VIP en recomendaciones')
    }
  })

  test('cuando el carrito tiene el único producto de F03 no hay recomendaciones de esa familia', async () => {
    const app = await buildApp()
    // P-BN-001 es el único de F03
    const res = await app.inject({ method: 'GET', url: '/catalog/recommendations?cartItems=P-BN-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(!res.json().some(p => p.familyId === 'F03'))
  })
})
