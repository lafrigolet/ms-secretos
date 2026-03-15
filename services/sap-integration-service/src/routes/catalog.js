/**
 * Rutas de catálogo — productos, familias, precios y stock
 * Usadas por catalog-service
 */
export async function catalogRoutes (fastify) {
  const sap = fastify.sap

  // Familias de productos
  fastify.get('/families', {
    schema: {
      description: 'Lista las familias de productos',
      tags: ['catalog']
    }
  }, async (_request, reply) => {
    const families = await sap.getFamilies()
    return reply.send(families)
  })

  // Productos (opcionalmente filtrados por familia)
  fastify.get('/products', {
    schema: {
      description: 'Lista productos, opcionalmente filtrados por familia',
      tags: ['catalog'],
      querystring: {
        type: 'object',
        properties: {
          familyId: { type: 'string', description: 'Filtrar por familia (ej: F01)' }
        }
      }
    }
  }, async (request, reply) => {
    const { familyId } = request.query
    const products = await sap.getProducts(familyId ?? null)
    return reply.send(products)
  })

  // Producto individual
  fastify.get('/products/:sapCode', {
    schema: {
      description: 'Obtiene un producto por su código SAP',
      tags: ['catalog'],
      params: {
        type: 'object',
        properties: { sapCode: { type: 'string' } }
      }
    }
  }, async (request, reply) => {
    const product = await sap.getProduct(request.params.sapCode)
    if (!product) return reply.status(404).send({ error: 'PRODUCT_NOT_FOUND', message: 'Producto no encontrado' })
    return reply.send(product)
  })

  // Precios para un perfil concreto
  fastify.get('/prices/:profile', {
    schema: {
      description: 'Obtiene todos los precios para un perfil de cliente',
      tags: ['catalog'],
      params: {
        type: 'object',
        properties: {
          profile: { type: 'string', enum: ['STANDARD', 'PREMIUM', 'VIP'] }
        }
      }
    }
  }, async (request, reply) => {
    const prices = await sap.getPricesForProfile(request.params.profile)
    return reply.send(prices)
  })

  // Precio de un producto para un perfil
  fastify.get('/prices/:profile/:productCode', {
    schema: {
      description: 'Obtiene el precio de un producto para un perfil',
      tags: ['catalog']
    }
  }, async (request, reply) => {
    const { profile, productCode } = request.params
    const price = await sap.getPrice(productCode, profile)
    if (price === null) return reply.status(404).send({ error: 'PRICE_NOT_FOUND', message: 'Precio no encontrado' })
    return reply.send({ productCode, profile, price })
  })

  // Stock de todos los productos
  fastify.get('/stock', {
    schema: {
      description: 'Obtiene el stock de todos los productos',
      tags: ['catalog']
    }
  }, async (_request, reply) => {
    const stock = await sap.getAllStock()
    return reply.send(stock)
  })

  // Stock de un producto
  fastify.get('/stock/:productCode', {
    schema: {
      description: 'Obtiene el stock de un producto',
      tags: ['catalog']
    }
  }, async (request, reply) => {
    const stock = await sap.getStock(request.params.productCode)
    return reply.send({ productCode: request.params.productCode, stock })
  })
}
