import {
  commercials, assignments,
  getCommercialByCustomer, getCustomersByCommercial,
  assign, createSuggestedOrder, respondSuggestedOrder,
  getSuggestedOrdersByCustomer, getSuggestedOrdersByCommercial
} from '../data/commercialStore.js'
import { SapIntegrationClient } from '../clients/SapIntegrationClient.js'

const sap = new SapIntegrationClient()

export async function commercialRoutes (fastify) {

  // ── HU-44 — Comercial asignado al cliente ─────────────────────
  fastify.get('/my-commercial', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Devuelve el comercial asignado al cliente autenticado (HU-44)',
      tags: ['commercial'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const commercial = getCommercialByCustomer(request.user.sub)
    if (!commercial) {
      return reply.status(404).send({ error: 'NO_COMMERCIAL_ASSIGNED', message: 'No tienes un comercial asignado' })
    }
    const assignment = assignments.find(a => a.sapCode === request.user.sub)
    return reply.send({ ...commercial, assignedAt: assignment?.assignedAt })
  })

  // ── HU-45 — Pedidos sugeridos para el cliente ─────────────────
  fastify.get('/suggested-orders', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Lista pedidos sugeridos por el comercial para el cliente (HU-45)',
      tags: ['commercial'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    return reply.send(getSuggestedOrdersByCustomer(request.user.sub))
  })

  fastify.patch('/suggested-orders/:id/respond', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Acepta o rechaza un pedido sugerido (HU-45)',
      tags: ['commercial'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['ACCEPTED', 'REJECTED'] }
        }
      }
    }
  }, async (request, reply) => {
    const sug = getSuggestedOrdersByCustomer(request.user.sub)
      .find(s => s.id === request.params.id)
    if (!sug) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Pedido sugerido no encontrado' })
    }
    if (sug.status !== 'PENDING') {
      return reply.status(400).send({ error: 'ALREADY_RESPONDED', message: 'Este pedido ya fue respondido' })
    }
    const updated = respondSuggestedOrder(request.params.id, request.body.status)
    return reply.send(updated)
  })

  // ── HU-46 — Vista del comercial: actividad de su cartera ──────
  fastify.get('/portfolio', {
    preHandler: [fastify.authenticate, fastify.requireCommercialOrAdmin],
    schema: {
      description: 'Lista los clientes de la cartera del comercial con su actividad (HU-46)',
      tags: ['commercial'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    // El comercial sólo ve su propia cartera; el admin ve todos
    const commercialId = request.user.role === 'ADMIN'
      ? request.query.commercialId
      : request.user.sub

    if (!commercialId) {
      return reply.status(400).send({ error: 'MISSING_COMMERCIAL_ID', message: 'Especifica un comercialId' })
    }

    const customerCodes = getCustomersByCommercial(commercialId)

    const portfolio = await Promise.all(
      customerCodes.map(async ({ sapCode, assignedAt }) => {
        const [customer, orders] = await Promise.all([
          sap.getCustomer(sapCode),
          sap.getOrders(sapCode)
        ])
        return {
          sapCode,
          assignedAt,
          ...(customer ?? {}),
          totalOrders: orders.length,
          lastOrderAt: orders.length > 0
            ? orders.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date
            : null,
          pendingSuggestions: getSuggestedOrdersByCustomer(sapCode)
            .filter(s => s.status === 'PENDING').length
        }
      })
    )

    return reply.send(portfolio)
  })

  // ── HU-46 — Historial de pedidos de un cliente específico ─────
  fastify.get('/portfolio/:sapCode/orders', {
    preHandler: [fastify.authenticate, fastify.requireCommercialOrAdmin],
    schema: {
      description: 'Historial de pedidos de un cliente de la cartera (HU-46)',
      tags: ['commercial'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const { sapCode } = request.params

    // Verificar que el cliente pertenece a la cartera del comercial
    if (request.user.role !== 'ADMIN') {
      const myCustomers = getCustomersByCommercial(request.user.sub).map(c => c.sapCode)
      if (!myCustomers.includes(sapCode)) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Este cliente no está en tu cartera' })
      }
    }

    const [customer, orders] = await Promise.all([
      sap.getCustomer(sapCode),
      sap.getOrders(sapCode)
    ])

    return reply.send({
      customer,
      orders: orders.sort((a, b) => new Date(b.date) - new Date(a.date)),
      suggestions: getSuggestedOrdersByCustomer(sapCode)
    })
  })

  // ── HU-45 — Crear pedido sugerido (comercial) ────────────────
  fastify.post('/suggested-orders', {
    preHandler: [fastify.authenticate, fastify.requireCommercialOrAdmin],
    schema: {
      description: 'El comercial crea un pedido sugerido para un cliente (HU-45)',
      tags: ['commercial'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['sapCode', 'items'],
        properties: {
          sapCode:  { type: 'string' },
          message:  { type: 'string', maxLength: 500 },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['productCode', 'quantity'],
              properties: {
                productCode: { type: 'string' },
                name:        { type: 'string' },
                quantity:    { type: 'integer', minimum: 1 },
                unitPrice:   { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { sapCode, items, message } = request.body
    const commercialId   = request.user.sub
    const commercialName = request.user.name ?? 'Comercial'

    // Verificar que el cliente es de la cartera del comercial (admins saltan la verificación)
    if (request.user.role !== 'ADMIN') {
      const myCustomers = getCustomersByCommercial(commercialId).map(c => c.sapCode)
      if (!myCustomers.includes(sapCode)) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Este cliente no está en tu cartera' })
      }
    }

    const sug = createSuggestedOrder(sapCode, commercialId, commercialName, items, message ?? '')
    return reply.status(201).send(sug)
  })

  // ── HU-47 — Asignar comercial (admin) ─────────────────────────
  fastify.get('/commercials', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Lista todos los comerciales disponibles (HU-47)',
      tags: ['commercial'],
      security: [{ bearerAuth: [] }]
    }
  }, async (_req, reply) => reply.send(commercials))

  fastify.get('/assignments', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Lista todas las asignaciones cliente-comercial (HU-47)',
      tags: ['commercial'],
      security: [{ bearerAuth: [] }]
    }
  }, async (_req, reply) => reply.send(assignments))

  fastify.patch('/assignments/:sapCode', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Asigna o cambia el comercial de un cliente (HU-47)',
      tags: ['commercial'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['commercialId'],
        properties: {
          commercialId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { sapCode } = request.params
    const { commercialId } = request.body
    const commercial = commercials.find(c => c.id === commercialId)
    if (!commercial) {
      return reply.status(404).send({ error: 'COMMERCIAL_NOT_FOUND', message: 'Comercial no encontrado' })
    }
    const result = assign(sapCode, commercialId, request.user.sub)
    fastify.log.info({ sapCode, commercialId, admin: request.user.sub }, 'Comercial asignado')
    return reply.send({ ...result, commercial })
  })
}
