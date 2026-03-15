import { SapClient } from '../services/SapClient.js'

const sap = new SapClient()

export async function catalogRoutes (fastify) {

  // HU-07 — Familias de productos
  fastify.get('/families', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Lista las familias de productos (HU-07)', tags: ['catalog'], security: [{ bearerAuth: [] }] }
  }, async (_req, reply) => {
    const families = await sap.get('/internal/catalog/families')
    return reply.send(families)
  })

  // HU-07 — Productos por familia
  fastify.get('/products', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Lista productos con precios del perfil del cliente (HU-07, HU-08)',
      tags: ['catalog'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: { familyId: { type: 'string' } }
      }
    }
  }, async (request, reply) => {
    const { familyId } = request.query
    const profile = request.user.profile

    const [products, prices, stock] = await Promise.all([
      sap.get(`/internal/catalog/products${familyId ? `?familyId=${familyId}` : ''}`),
      sap.get(`/internal/catalog/prices/${profile}`),
      sap.get('/internal/catalog/stock')
    ])

    const enriched = products.map(p => ({
      ...p,
      price: prices[p.sapCode] ?? null,
      stock: stock[p.sapCode] ?? 0,
      inStock: (stock[p.sapCode] ?? 0) > 0
    }))

    return reply.send(enriched)
  })

  // HU-08 — Ficha de producto detallada
  fastify.get('/products/:sapCode', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Ficha completa de un producto con precio y stock del perfil del cliente (HU-08)',
      tags: ['catalog'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const { sapCode } = request.params
    const profile = request.user.profile

    const [product, price, stock] = await Promise.all([
      sap.get(`/internal/catalog/products/${sapCode}`),
      sap.get(`/internal/catalog/prices/${profile}/${sapCode}`),
      sap.get(`/internal/catalog/stock/${sapCode}`)
    ])

    if (!product) return reply.status(404).send({ error: 'PRODUCT_NOT_FOUND', message: 'Producto no encontrado' })

    return reply.send({
      ...product,
      price: price?.price ?? null,
      stock: stock?.stock ?? 0,
      inStock: (stock?.stock ?? 0) > 0
    })
  })

  // HU-09 — Productos recomendados
  fastify.get('/recommendations', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Productos recomendados para completar tratamientos (HU-09)',
      tags: ['catalog'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          cartItems: { type: 'string', description: 'Códigos de productos en cesta separados por coma' }
        }
      }
    }
  }, async (request, reply) => {
    const cartCodes = request.query.cartItems?.split(',') ?? []
    const profile = request.user.profile

    const [allProducts, prices, stock] = await Promise.all([
      sap.get('/internal/catalog/products'),
      sap.get(`/internal/catalog/prices/${profile}`),
      sap.get('/internal/catalog/stock')
    ])

    // Familias ya presentes en la cesta
    const cartProducts = allProducts.filter(p => cartCodes.includes(p.sapCode))
    const cartFamilies = new Set(cartProducts.map(p => p.familyId))

    // Recomendar productos de las mismas familias que no estén en la cesta
    const recommendations = allProducts
      .filter(p => cartFamilies.has(p.familyId) && !cartCodes.includes(p.sapCode) && p.active)
      .slice(0, 4)
      .map(p => ({
        ...p,
        price: prices[p.sapCode] ?? null,
        stock: stock[p.sapCode] ?? 0,
        inStock: (stock[p.sapCode] ?? 0) > 0
      }))

    return reply.send(recommendations)
  })
}
