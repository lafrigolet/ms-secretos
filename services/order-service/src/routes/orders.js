import { SapIntegrationClient } from '../clients/SapIntegrationClient.js'
import { NotificationClient } from '../clients/NotificationClient.js'
import { AuditClient } from '../clients/AuditClient.js'

const sap          = new SapIntegrationClient()
const notification = new NotificationClient()
const audit        = new AuditClient()

export async function orderRoutes (fastify) {

  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Historial de pedidos del cliente (HU-18)', tags: ['orders'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const orders = await sap.getOrders(request.user.sub)
    return reply.send(orders ?? [])
  })

  fastify.get('/:orderId', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Estado actualizado de un pedido (HU-21)', tags: ['orders'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const order = await sap.getOrder(request.params.orderId)
    if (!order) return reply.status(404).send({ error: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado' })
    if (order.sapCode !== request.user.sub && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'No tienes acceso a este pedido' })
    }
    return reply.send(order)
  })

  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Confirma el pedido y lo envía a SAP (HU-17)', tags: ['orders'], security: [{ bearerAuth: [] }],
      body: {
        type: 'object', required: ['items'],
        properties: { items: { type: 'array', minItems: 1, items: { type: 'object', required: ['productCode', 'quantity', 'unitPrice'], properties: { productCode: { type: 'string' }, name: { type: 'string' }, quantity: { type: 'integer', minimum: 1 }, unitPrice: { type: 'number' } } } } }
      }
    }
  }, async (request, reply) => {
    const order = await sap.createOrder(request.user.sub, request.body.items)

    // Fire-and-forget — no bloqueamos la respuesta
    notification.orderConfirmed(order, request.user)
    audit.log('ORDER_CREATED', request.user.sub, { orderId: order.orderId })

    return reply.status(201).send(order)
  })

  fastify.post('/:orderId/repeat', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Carga productos de un pedido anterior en la cesta (HU-19)', tags: ['orders'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const order = await sap.getOrder(request.params.orderId)
    if (!order) return reply.status(404).send({ error: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado' })
    if (order.sapCode !== request.user.sub) return reply.status(403).send({ error: 'FORBIDDEN', message: 'No tienes acceso a este pedido' })
    return reply.send({ items: order.items, message: 'Items listos para cargar en la cesta' })
  })
}
