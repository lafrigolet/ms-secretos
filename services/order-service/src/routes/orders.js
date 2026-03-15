import { SapClient } from '../services/SapClient.js'

const sap = new SapClient()

export async function orderRoutes (fastify) {

  // HU-18 — Historial de pedidos
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Historial de pedidos del cliente (HU-18)', tags: ['orders'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const orders = await sap.get(`/internal/orders/${request.user.sub}`)
    return reply.send(orders ?? [])
  })

  // HU-21 — Estado de un pedido en tiempo real
  fastify.get('/:orderId', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Estado actualizado de un pedido (HU-21)', tags: ['orders'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const order = await sap.get(`/internal/orders/order/${request.params.orderId}`)
    if (!order) return reply.status(404).send({ error: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado' })
    // Verificar que el pedido pertenece al usuario autenticado
    if (order.sapCode !== request.user.sub && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'No tienes acceso a este pedido' })
    }
    return reply.send(order)
  })

  // HU-17 — Confirmar pedido
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Confirma el pedido y lo envía a SAP (HU-17)',
      tags: ['orders'],
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
              required: ['productCode', 'quantity', 'unitPrice'],
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
    const order = await sap.post('/internal/orders', {
      sapCode: request.user.sub,
      items: request.body.items
    })

    // Notificar al notification-service de forma asíncrona (sin esperar)
    const notifUrl = process.env.NOTIFICATION_SERVICE_URL ?? 'http://notification-service:3007'
    fetch(`${notifUrl}/notifications/order-confirmed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order, user: request.user })
    }).catch(() => {}) // No bloqueamos si falla

    // Notificar al audit-service
    const auditUrl = process.env.AUDIT_SERVICE_URL ?? 'http://audit-service:3009'
    fetch(`${auditUrl}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ORDER_CREATED', sapCode: request.user.sub, data: { orderId: order.orderId } })
    }).catch(() => {})

    return reply.status(201).send(order)
  })

  // HU-19 — Repetir pedido anterior
  fastify.post('/:orderId/repeat', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Carga los productos de un pedido anterior en la cesta (HU-19)', tags: ['orders'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const order = await sap.get(`/internal/orders/order/${request.params.orderId}`)
    if (!order) return reply.status(404).send({ error: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado' })
    if (order.sapCode !== request.user.sub) return reply.status(403).send({ error: 'FORBIDDEN', message: 'No tienes acceso a este pedido' })

    // Devolvemos los items para que el frontend los cargue en el cart-service
    return reply.send({ items: order.items, message: 'Items listos para cargar en la cesta' })
  })
}
