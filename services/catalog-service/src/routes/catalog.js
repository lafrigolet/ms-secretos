import { SapIntegrationClient } from '../clients/SapIntegrationClient.js'

const sap = new SapIntegrationClient()

export async function catalogRoutes (fastify) {

  fastify.get('/families', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Lista las familias de productos (HU-07)', tags: ['catalog'], security: [{ bearerAuth: [] }] }
  }, async (_req, reply) => reply.send(await sap.getFamilies()))

  fastify.get('/products', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Productos con precios del perfil del cliente (HU-07, HU-08)',
      tags: ['catalog'], security: [{ bearerAuth: [] }],
      querystring: { type: 'object', properties: { familyId: { type: 'string' } } }
    }
  }, async (request, reply) => {
    const [products, prices, stock] = await Promise.all([
      sap.getProducts(request.query.familyId ?? null),
      sap.getPricesForProfile(request.user.profile),
      sap.getAllStock()
    ])
    return reply.send(products.map(p => ({
      ...p, price: prices[p.sapCode] ?? null,
      stock: stock[p.sapCode] ?? 0, inStock: (stock[p.sapCode] ?? 0) > 0
    })))
  })

  fastify.get('/products/:sapCode', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Ficha completa de producto (HU-08)', tags: ['catalog'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const [product, priceData, stockData] = await Promise.all([
      sap.getProduct(request.params.sapCode),
      sap.getPrice(request.user.profile, request.params.sapCode),
      sap.getStock(request.params.sapCode)
    ])
    if (!product) return reply.status(404).send({ error: 'PRODUCT_NOT_FOUND', message: 'Producto no encontrado' })
    return reply.send({ ...product, price: priceData?.price ?? null, stock: stockData?.stock ?? 0, inStock: (stockData?.stock ?? 0) > 0 })
  })

  fastify.get('/recommendations', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Productos recomendados (HU-09)', tags: ['catalog'], security: [{ bearerAuth: [] }],
      querystring: { type: 'object', properties: { cartItems: { type: 'string' } } }
    }
  }, async (request, reply) => {
    const cartCodes = request.query.cartItems?.split(',') ?? []
    const [allProducts, prices, stock] = await Promise.all([
      sap.getProducts(), sap.getPricesForProfile(request.user.profile), sap.getAllStock()
    ])
    const cartFamilies = new Set(allProducts.filter(p => cartCodes.includes(p.sapCode)).map(p => p.familyId))
    return reply.send(
      allProducts
        .filter(p => cartFamilies.has(p.familyId) && !cartCodes.includes(p.sapCode) && p.active)
        .slice(0, 4)
        .map(p => ({ ...p, price: prices[p.sapCode] ?? null, stock: stock[p.sapCode] ?? 0, inStock: (stock[p.sapCode] ?? 0) > 0 }))
    )
  })
}
