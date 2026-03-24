import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { sustainabilityRoutes }   from './routes/sustainability.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler }           from './middleware/errorHandler.js'

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
  await app.register(sustainabilityRoutes, { prefix: '/sustainability' })
  app.get('/health', async () => ({ status: 'ok', service: 'sda-sustainability-service' }))
  return app
}

const token = (app, sub = 'SDA-00423') =>
  app.jwt.sign({ sub, profile: 'PREMIUM', role: 'CUSTOMER' })
const adminToken    = (app) => app.jwt.sign({ sub: 'ADMIN-001', profile: 'ADMIN', role: 'ADMIN' })
const expiredToken  = (app) => app.jwt.sign({ sub: 'EXP-USER', profile: 'STANDARD', role: 'CUSTOMER', exp: Math.floor(Date.now() / 1000) - 3600 })

// Stub data reference:
// Products: P-RT-001 (score=88, natural=98.5%, 7 ingredients, carbon=0.42kg, COSMOS/CrueltyFree/Vegan)
//           P-RT-002 (score=92, natural=97.0%, 7 ingredients, carbon=0.61kg, refillable=true)
//           P-SN-001 (score=85, natural=99.2%, 5 ingredients, carbon=0.38kg)
// Emission factors: STANDARD=0.52, EXPRESS=1.85, ECO=0.28, PICKUP=0.05
// Product weights:  P-RT-001=0.30, P-RT-002=0.25, P-RT-003=0.18, P-SN-001=0.30, P-BN-001=0.15, DEFAULT=0.25
// groupingPreferences: {} (start empty, per-user state)
// NOTE: existing HU-55 tests mutate SDA-00423 preferences:
//   "activa agrupación" → {acceptDelay:true, maxDelayDays:5}
//   "desactiva agrupación" → {acceptDelay:false, maxDelayDays:3}

// ══════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  test('devuelve status ok', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/health' })).statusCode, 200)
  })

  test('devuelve service name que incluye sustainability', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.ok(res.json().service.includes('sustainability'))
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-53 — Origen e ingredientes', () => {
  test('sin token GET /products/:productCode devuelve 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-001' })).statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-001' })
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-001', headers: { authorization: 'Bearer bad.token.here' } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-001', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('devuelve ficha completa de sostenibilidad de un producto', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(body.origin)
    assert.ok(body.ingredients)
    assert.ok(Array.isArray(body.ingredients))
    assert.ok(body.ingredients.length > 0)
    assert.ok(typeof body.naturalPercentage === 'number')
    assert.ok(typeof body.sustainabilityScore === 'number')
    assert.ok(body.ecoLabels)
    assert.ok(body.packaging)
  })

  test('respuesta incluye productCode, name, origin, ingredients, naturalPercentage, packaging, carbonFootprintKg, sustainabilityScore, ecoLabels', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    const body = res.json()
    assert.ok('productCode'         in body)
    assert.ok('name'                in body)
    assert.ok('origin'              in body)
    assert.ok('ingredients'         in body)
    assert.ok('naturalPercentage'   in body)
    assert.ok('packaging'           in body)
    assert.ok('carbonFootprintKg'   in body)
    assert.ok('sustainabilityScore' in body)
    assert.ok('ecoLabels'           in body)
  })

  test('P-RT-001 tiene datos correctos: score=88, natural=98.5, carbonKg=0.42', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    const body = res.json()
    assert.equal(body.productCode,         'P-RT-001')
    assert.equal(body.name,                'Champú Restaurador Timeless')
    assert.equal(body.sustainabilityScore, 88)
    assert.equal(body.naturalPercentage,   98.5)
    assert.equal(body.carbonFootprintKg,   0.42)
  })

  test('P-RT-001 origin: país España, proveedor, certificaciones', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    const { origin } = res.json()
    assert.ok('country'        in origin)
    assert.ok('region'         in origin)
    assert.ok('supplier'       in origin)
    assert.ok('certifications' in origin)
    assert.equal(origin.country, 'España')
    assert.ok(Array.isArray(origin.certifications))
    assert.ok(origin.certifications.includes('COSMOS Organic'))
  })

  test('P-RT-001 packaging: recyclable=true, refillable=false, material incluye reciclado', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    const { packaging } = res.json()
    assert.ok('material'   in packaging)
    assert.ok('recyclable' in packaging)
    assert.ok('refillable' in packaging)
    assert.equal(packaging.recyclable, true)
    assert.equal(packaging.refillable, false)
  })

  test('P-RT-001 tiene exactamente 7 ingredientes', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().ingredients.length, 7)
  })

  test('ingredientes tienen los campos requeridos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    const { ingredients } = res.json()
    assert.ok(ingredients.every(i => i.name && i.percentage !== undefined && i.origin && i.natural !== undefined))
  })

  test('todos los ingredientes de P-RT-001 son naturales', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(res.json().ingredients.every(i => i.natural === true))
  })

  test('P-RT-002: score=92, refillable=true', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-002', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().sustainabilityScore, 92)
    assert.equal(res.json().packaging.refillable, true)
  })

  test('P-SN-001: score=85, naturalPercentage=99.2', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-SN-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().sustainabilityScore, 85)
    assert.equal(res.json().naturalPercentage, 99.2)
  })

  test('P-SN-001 tiene 5 ingredientes', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-SN-001', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().ingredients.length, 5)
  })

  test('producto sin datos de sostenibilidad devuelve 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-NO-EXISTE', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'SUSTAINABILITY_DATA_NOT_FOUND')
  })

  test('sin token GET /products → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products' })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token expirado GET /products → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('lista todos los productos con resumen de sostenibilidad', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(Array.isArray(body))
    assert.ok(body.length > 0)
    assert.ok(body.every(p => p.sustainabilityScore && p.naturalPercentage))
  })

  test('lista tiene exactamente 3 productos', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products', headers: { authorization: `Bearer ${token(app)}` } })
    assert.equal(res.json().length, 3)
  })

  test('cada producto en la lista tiene productCode, name, sustainabilityScore, naturalPercentage, certifications, ecoLabels, carbonFootprintKg', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products', headers: { authorization: `Bearer ${token(app)}` } })
    for (const p of res.json()) {
      assert.ok('productCode'         in p)
      assert.ok('name'                in p)
      assert.ok('sustainabilityScore' in p)
      assert.ok('naturalPercentage'   in p)
      assert.ok('certifications'      in p)
      assert.ok('ecoLabels'           in p)
      assert.ok('carbonFootprintKg'   in p)
    }
  })

  test('lista incluye P-RT-001, P-RT-002 y P-SN-001', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products', headers: { authorization: `Bearer ${token(app)}` } })
    const codes = res.json().map(p => p.productCode)
    assert.ok(codes.includes('P-RT-001'))
    assert.ok(codes.includes('P-RT-002'))
    assert.ok(codes.includes('P-SN-001'))
  })

  test('lista NO incluye ingredients (es resumen)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products', headers: { authorization: `Bearer ${token(app)}` } })
    assert.ok(res.json().every(p => !('ingredients' in p)))
  })

  test('adminToken puede acceder a las fichas de sostenibilidad', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/products/P-RT-001', headers: { authorization: `Bearer ${adminToken(app)}` } })
    assert.equal(res.statusCode, 200)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('HU-54 — Huella de carbono', () => {
  test('sin token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', payload: { items: [{ productCode: 'P-RT-001', quantity: 1 }] } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', headers: { authorization: 'Bearer bad.token' }, payload: { items: [{ productCode: 'P-RT-001', quantity: 1 }] } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', headers: { authorization: `Bearer ${expiredToken(app)}` }, payload: { items: [{ productCode: 'P-RT-001', quantity: 1 }] } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('calcula la huella de carbono para un pedido estándar', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 6 }, { productCode: 'P-RT-002', quantity: 3 }], shippingMethod: 'STANDARD' }
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok(typeof body.co2Kg === 'number')
    assert.ok(body.co2Kg > 0)
    assert.ok(typeof body.totalWeightKg === 'number')
    assert.ok(Array.isArray(body.alternatives))
    assert.ok(body.alternatives.length > 0)
  })

  test('respuesta incluye shippingMethod, totalWeightKg, grossWeightKg, co2Kg, treeHours, alternatives', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 1 }], shippingMethod: 'STANDARD' }
    })
    const body = res.json()
    assert.ok('shippingMethod' in body)
    assert.ok('totalWeightKg'  in body)
    assert.ok('grossWeightKg'  in body)
    assert.ok('co2Kg'          in body)
    assert.ok('treeHours'      in body)
    assert.ok('alternatives'   in body)
  })

  test('shippingMethod en respuesta coincide con el solicitado', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 1 }], shippingMethod: 'ECO' }
    })
    assert.equal(res.json().shippingMethod, 'ECO')
  })

  test('P-RT-001 ×6 STANDARD: totalWeightKg=1.8, grossWeightKg=2.07, co2Kg=1.076', async () => {
    // totalWeight = 6 * 0.30 = 1.80; gross = 1.80 * 1.15 = 2.07; co2 = 2.07 * 0.52 = 1.0764 → 1.076
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 6 }], shippingMethod: 'STANDARD' }
    })
    const body = res.json()
    assert.equal(body.totalWeightKg, 1.80)
    assert.equal(body.grossWeightKg, 2.07)
    assert.equal(body.co2Kg, 1.076)
  })

  test('treeHours = co2Kg * 10', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 6 }], shippingMethod: 'STANDARD' }
    })
    const { co2Kg, treeHours } = res.json()
    assert.equal(treeHours, +(co2Kg * 10).toFixed(1))
  })

  test('envío ECO tiene menos emisiones que STANDARD', async () => {
    const app = await buildApp()
    const items = [{ productCode: 'P-RT-001', quantity: 6 }]
    const [standard, eco] = await Promise.all([
      app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', headers: { authorization: `Bearer ${token(app)}` }, payload: { items, shippingMethod: 'STANDARD' } }),
      app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', headers: { authorization: `Bearer ${token(app)}` }, payload: { items, shippingMethod: 'ECO' } })
    ])
    assert.ok(eco.json().co2Kg < standard.json().co2Kg)
  })

  test('EXPRESS tiene más emisiones que STANDARD', async () => {
    const app = await buildApp()
    const items = [{ productCode: 'P-RT-001', quantity: 2 }]
    const [standard, express] = await Promise.all([
      app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', headers: { authorization: `Bearer ${token(app)}` }, payload: { items, shippingMethod: 'STANDARD' } }),
      app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', headers: { authorization: `Bearer ${token(app)}` }, payload: { items, shippingMethod: 'EXPRESS' } })
    ])
    assert.ok(express.json().co2Kg > standard.json().co2Kg)
  })

  test('PICKUP tiene las menores emisiones de todos los métodos', async () => {
    const app = await buildApp()
    const items = [{ productCode: 'P-RT-001', quantity: 3 }]
    const [pickup, eco, standard, express] = await Promise.all([
      app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', headers: { authorization: `Bearer ${token(app)}` }, payload: { items, shippingMethod: 'PICKUP' } }),
      app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', headers: { authorization: `Bearer ${token(app)}` }, payload: { items, shippingMethod: 'ECO' } }),
      app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', headers: { authorization: `Bearer ${token(app)}` }, payload: { items, shippingMethod: 'STANDARD' } }),
      app.inject({ method: 'POST', url: '/sustainability/carbon-footprint', headers: { authorization: `Bearer ${token(app)}` }, payload: { items, shippingMethod: 'EXPRESS' } })
    ])
    const pCo2 = pickup.json().co2Kg
    assert.ok(pCo2 < eco.json().co2Kg)
    assert.ok(pCo2 < standard.json().co2Kg)
    assert.ok(pCo2 < express.json().co2Kg)
  })

  test('alternatives incluye todas las modalidades excepto la seleccionada', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 1 }], shippingMethod: 'STANDARD' }
    })
    const { alternatives } = res.json()
    assert.ok(alternatives.every(a => a.method !== 'STANDARD'))
    assert.equal(alternatives.length, 3)
  })

  test('alternatives ordenadas por co2Kg ascendente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 1 }], shippingMethod: 'STANDARD' }
    })
    const { alternatives } = res.json()
    for (let i = 1; i < alternatives.length; i++) {
      assert.ok(alternatives[i].co2Kg >= alternatives[i-1].co2Kg)
    }
  })

  test('alternatives tienen method, co2Kg y savings', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 1 }], shippingMethod: 'EXPRESS' }
    })
    for (const alt of res.json().alternatives) {
      assert.ok('method'  in alt)
      assert.ok('co2Kg'   in alt)
      assert.ok('savings' in alt)
    }
  })

  test('ECO savings vs STANDARD es positivo', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 6 }], shippingMethod: 'STANDARD' }
    })
    const ecoAlt = res.json().alternatives.find(a => a.method === 'ECO')
    assert.ok(ecoAlt)
    assert.ok(ecoAlt.savings > 0)
  })

  test('shippingMethod por defecto es STANDARD cuando no se especifica', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 1 }] }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().shippingMethod, 'STANDARD')
  })

  test('producto desconocido usa peso DEFAULT=0.25', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-UNKNOWN', quantity: 4 }], shippingMethod: 'STANDARD' }
    })
    // 4 * 0.25 = 1.00, gross = 1.15, co2 = 1.15 * 0.52 = 0.598
    assert.equal(res.json().totalWeightKg, 1.00)
  })

  test('items vacíos devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('sin items devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: {}
    })
    assert.equal(res.statusCode, 400)
  })

  test('item sin productCode → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ quantity: 3 }] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('item sin quantity → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001' }] }
    })
    assert.equal(res.statusCode, 400)
  })

  test('varios productos suman correctamente', async () => {
    // P-RT-001 x2 (0.30*2=0.60) + P-RT-002 x2 (0.25*2=0.50) = 1.10 totalWeight
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/sustainability/carbon-footprint',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ productCode: 'P-RT-001', quantity: 2 }, { productCode: 'P-RT-002', quantity: 2 }], shippingMethod: 'STANDARD' }
    })
    assert.equal(res.json().totalWeightKg, 1.10)
  })
})

// ══════════════════════════════════════════════════════════════════
// NOTE: existing tests mutate SDA-00423 grouping pref:
//   "activa agrupación" → {acceptDelay:true, maxDelayDays:5}
//   "desactiva agrupación" → {acceptDelay:false, maxDelayDays:3}
describe('HU-55 — Preferencias de agrupación', () => {
  test('sin token GET → 401', async () => {
    const app = await buildApp()
    assert.equal((await app.inject({ method: 'GET', url: '/sustainability/grouping-preference' })).statusCode, 401)
  })

  test('sin token devuelve error UNAUTHORIZED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/grouping-preference' })
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('token manipulado GET → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/grouping-preference', headers: { authorization: 'Bearer bad.token' } })
    assert.equal(res.statusCode, 401)
  })

  test('token expirado GET → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/grouping-preference', headers: { authorization: `Bearer ${expiredToken(app)}` } })
    assert.equal(res.statusCode, 401)
  })

  test('cliente nuevo tiene preferencia por defecto (sin agrupación)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/grouping-preference', headers: { authorization: `Bearer ${token(app, 'SDA-NUEVO')}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().acceptDelay, false)
    assert.equal(res.json().maxDelayDays, 3)
  })

  test('respuesta incluye sapCode, acceptDelay, maxDelayDays, updatedAt', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/grouping-preference', headers: { authorization: `Bearer ${token(app, 'SDA-NUEVO-2')}` } })
    const body = res.json()
    assert.ok('sapCode'      in body)
    assert.ok('acceptDelay'  in body)
    assert.ok('maxDelayDays' in body)
    assert.ok('updatedAt'    in body)
  })

  test('SDA-NUEVO default: updatedAt=null', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/grouping-preference', headers: { authorization: `Bearer ${token(app, 'SDA-NUEVO-3')}` } })
    assert.equal(res.json().updatedAt, null)
  })

  test('sapCode en respuesta coincide con el usuario autenticado', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/sustainability/grouping-preference', headers: { authorization: `Bearer ${token(app, 'SDA-00521')}` } })
    assert.equal(res.json().sapCode, 'SDA-00521')
  })

  test('cliente activa la agrupación de pedidos', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/sustainability/grouping-preference',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { acceptDelay: true, maxDelayDays: 5 }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().acceptDelay, true)
    assert.equal(res.json().maxDelayDays, 5)
    assert.ok(res.json().updatedAt)
  })

  test('cliente desactiva la agrupación', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/sustainability/grouping-preference',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { acceptDelay: false }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().acceptDelay, false)
  })

  test('maxDelayDays fuera de rango devuelve 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/sustainability/grouping-preference',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { acceptDelay: true, maxDelayDays: 30 }
    })
    assert.equal(res.statusCode, 400)
  })

  test('maxDelayDays=15 → 400 (máximo es 14)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/sustainability/grouping-preference',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { acceptDelay: true, maxDelayDays: 15 }
    })
    assert.equal(res.statusCode, 400)
  })

  test('maxDelayDays=14 → 200 (máximo válido)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/sustainability/grouping-preference',
      headers: { authorization: `Bearer ${token(app, 'SDA-00387')}` },
      payload: { acceptDelay: true, maxDelayDays: 14 }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().maxDelayDays, 14)
  })

  test('maxDelayDays=1 → 200 (mínimo válido)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/sustainability/grouping-preference',
      headers: { authorization: `Bearer ${token(app, 'SDA-00521')}` },
      payload: { acceptDelay: true, maxDelayDays: 1 }
    })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().maxDelayDays, 1)
  })

  test('maxDelayDays=0 → 400 (mínimo es 1)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/sustainability/grouping-preference',
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { acceptDelay: true, maxDelayDays: 0 }
    })
    assert.equal(res.statusCode, 400)
  })

  test('PATCH actualiza updatedAt con fecha ISO válida', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/sustainability/grouping-preference',
      headers: { authorization: `Bearer ${token(app, 'SDA-00187')}` },
      payload: { acceptDelay: true, maxDelayDays: 7 }
    })
    assert.ok(res.json().updatedAt)
    assert.ok(!isNaN(Date.parse(res.json().updatedAt)))
  })

  test('PATCH persiste los cambios en GET posterior', async () => {
    const app = await buildApp()
    await app.inject({
      method: 'PATCH', url: '/sustainability/grouping-preference',
      headers: { authorization: `Bearer ${token(app, 'SDA-PERSIST')}` },
      payload: { acceptDelay: true, maxDelayDays: 10 }
    })
    const res = await app.inject({ method: 'GET', url: '/sustainability/grouping-preference', headers: { authorization: `Bearer ${token(app, 'SDA-PERSIST')}` } })
    assert.equal(res.json().acceptDelay, true)
    assert.equal(res.json().maxDelayDays, 10)
  })

  test('PATCH sin token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/sustainability/grouping-preference', payload: { acceptDelay: true } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.json().error, 'UNAUTHORIZED')
  })

  test('PATCH token expirado → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/sustainability/grouping-preference', headers: { authorization: `Bearer ${expiredToken(app)}` }, payload: { acceptDelay: true } })
    assert.equal(res.statusCode, 401)
  })

  test('preferencias de clientes distintos son independientes', async () => {
    const app = await buildApp()
    await app.inject({ method: 'PATCH', url: '/sustainability/grouping-preference', headers: { authorization: `Bearer ${token(app, 'SDA-A')}` }, payload: { acceptDelay: true, maxDelayDays: 7 } })
    const resB = await app.inject({ method: 'GET', url: '/sustainability/grouping-preference', headers: { authorization: `Bearer ${token(app, 'SDA-B')}` } })
    assert.equal(resB.json().acceptDelay, false)
    assert.equal(resB.json().maxDelayDays, 3)
  })
})
