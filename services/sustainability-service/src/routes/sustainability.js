import {
  productSustainability,
  estimateCarbonFootprint,
  getGroupingPreference,
  updateGroupingPreference
} from '../data/sustainabilityStore.js'

export async function sustainabilityRoutes (fastify) {

  // ── HU-53 — Origen e ingredientes por producto ─────────────────

  fastify.get('/products/:productCode', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Ficha de sostenibilidad, origen e ingredientes de un producto (HU-53)',
      tags: ['sustainability'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const data = productSustainability[request.params.productCode]
    if (!data) {
      return reply.status(404).send({
        error: 'SUSTAINABILITY_DATA_NOT_FOUND',
        message: 'Datos de sostenibilidad no disponibles para este producto'
      })
    }
    return reply.send(data)
  })

  fastify.get('/products', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Lista todos los productos con datos de sostenibilidad disponibles (HU-53)',
      tags: ['sustainability'],
      security: [{ bearerAuth: [] }]
    }
  }, async (_req, reply) => {
    const summary = Object.values(productSustainability).map(p => ({
      productCode:        p.productCode,
      name:               p.name,
      sustainabilityScore:p.sustainabilityScore,
      naturalPercentage:  p.naturalPercentage,
      certifications:     p.origin.certifications,
      ecoLabels:          p.ecoLabels,
      carbonFootprintKg:  p.carbonFootprintKg
    }))
    return reply.send(summary)
  })

  // ── HU-54 — Estimación de huella de carbono ────────────────────

  fastify.post('/carbon-footprint', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Calcula la huella de carbono estimada del envío de un pedido (HU-54)',
      tags: ['sustainability'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['productCode', 'quantity'],
              properties: {
                productCode: { type: 'string' },
                quantity:    { type: 'integer', minimum: 1 }
              }
            }
          },
          shippingMethod: {
            type: 'string',
            enum: ['STANDARD', 'EXPRESS', 'ECO', 'PICKUP'],
            default: 'STANDARD'
          }
        }
      }
    }
  }, async (request, reply) => {
    const { items, shippingMethod } = request.body
    const estimate = estimateCarbonFootprint(items, shippingMethod ?? 'STANDARD')
    return reply.send(estimate)
  })

  // ── HU-55 — Preferencias de agrupación de pedidos ─────────────

  fastify.get('/grouping-preference', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Obtiene la preferencia de agrupación de pedidos del cliente (HU-55)',
      tags: ['sustainability'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    return reply.send(getGroupingPreference(request.user.sub))
  })

  fastify.patch('/grouping-preference', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Actualiza la preferencia de agrupación de pedidos (HU-55)',
      tags: ['sustainability'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          acceptDelay:  { type: 'boolean' },
          maxDelayDays: { type: 'integer', minimum: 1, maximum: 14 }
        }
      }
    }
  }, async (request, reply) => {
    const updated = updateGroupingPreference(request.user.sub, request.body)
    return reply.send(updated)
  })
}
