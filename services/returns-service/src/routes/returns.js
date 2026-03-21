import {
  createReturn, updateReturn,
  getReturnsByCustomer, getReturnById,
  RETURN_REASONS
} from '../data/returnsStore.js'
import { SapIntegrationClient } from '../clients/SapIntegrationClient.js'

const sap = new SapIntegrationClient()

/**
 * Rutas para responsables de tienda
 * HU-31 — iniciar devolución desde historial
 * HU-32 — seleccionar motivo y líneas afectadas
 * HU-33 — seguimiento del estado de la reclamación
 */
export async function returnsRoutes (fastify) {

  // HU-32 — Motivos disponibles para devolución
  fastify.get('/reasons', {
    schema: {
      description: 'Lista los motivos de devolución disponibles',
      tags: ['returns']
    }
  }, async (_req, reply) => reply.send(RETURN_REASONS))

  // HU-33 — Mis reclamaciones
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Lista todas las devoluciones del cliente autenticado (HU-33)',
      tags: ['returns'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const returns = getReturnsByCustomer(request.user.sub)
    return reply.send(returns)
  })

  // HU-33 — Detalle de una reclamación
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Detalle de una solicitud de devolución (HU-33)',
      tags: ['returns'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const ret = getReturnById(request.params.id)
    if (!ret) return reply.status(404).send({ error: 'RETURN_NOT_FOUND', message: 'Reclamación no encontrada' })
    if (ret.sapCode !== request.user.sub && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Sin acceso a esta reclamación' })
    }
    return reply.send(ret)
  })

  // HU-31, HU-32 — Crear solicitud de devolución
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Inicia una solicitud de devolución desde el historial (HU-31, HU-32)',
      tags: ['returns'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['orderId', 'reason', 'items'],
        properties: {
          orderId: { type: 'string', description: 'ID del pedido a devolver' },
          reason:  { type: 'string', enum: ['DAMAGED', 'WRONG', 'MISSING', 'DUPLICATE', 'OTHER'] },
          notes:   { type: 'string', maxLength: 500 },
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
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id:          { type: 'string' },
            status:      { type: 'string' },
            orderId:     { type: 'string' },
            reason:      { type: 'string' },
            reasonLabel: { type: 'string' },
            createdAt:   { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { orderId, reason, notes, items } = request.body
    const sapCode = request.user.sub

    // Verificar que el pedido pertenece al cliente
    try {
      const order = await sap.getOrder(orderId)
      if (!order) {
        return reply.status(404).send({ error: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado' })
      }
      if (order.sapCode !== sapCode) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Este pedido no pertenece a tu cuenta' })
      }
    } catch {
      // Si SAP no está disponible, permitimos crear la devolución igualmente
      fastify.log.warn({ orderId }, 'No se pudo verificar el pedido en SAP — devolución creada igualmente')
    }

    const ret = createReturn({ sapCode, orderId, reason, notes, items })
    fastify.log.info({ returnId: ret.id, sapCode, orderId }, 'Devolución creada')

    return reply.status(201).send(ret)
  })
}
