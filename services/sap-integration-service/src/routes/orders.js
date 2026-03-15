/**
 * Rutas de pedidos y facturas
 * Usadas por order-service e invoice-service
 */
export async function orderRoutes (fastify) {
  const sap = fastify.sap

  // Pedidos de un cliente
  fastify.get('/:sapCode', {
    schema: {
      description: 'Obtiene todos los pedidos de un cliente',
      tags: ['orders'],
      params: {
        type: 'object',
        properties: { sapCode: { type: 'string' } }
      }
    }
  }, async (request, reply) => {
    const orders = await sap.getOrders(request.params.sapCode)
    return reply.send(orders)
  })

  // Pedido individual
  fastify.get('/order/:orderId', {
    schema: {
      description: 'Obtiene un pedido por su ID',
      tags: ['orders']
    }
  }, async (request, reply) => {
    const order = await sap.getOrder(request.params.orderId)
    if (!order) return reply.status(404).send({ error: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado' })
    return reply.send(order)
  })

  // Crear pedido en SAP
  fastify.post('/', {
    schema: {
      description: 'Crea un pedido en SAP',
      tags: ['orders'],
      body: {
        type: 'object',
        required: ['sapCode', 'items'],
        properties: {
          sapCode: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productCode', 'quantity', 'unitPrice'],
              properties: {
                productCode: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 },
                unitPrice: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { sapCode, items } = request.body
    const order = await sap.createOrder(sapCode, items)
    return reply.status(201).send(order)
  })

  // Factura de un pedido
  fastify.get('/invoice/:invoiceId', {
    schema: {
      description: 'Obtiene los datos de una factura desde SAP',
      tags: ['orders']
    }
  }, async (request, reply) => {
    const invoice = await sap.getInvoice(request.params.invoiceId)
    if (!invoice) return reply.status(404).send({ error: 'INVOICE_NOT_FOUND', message: 'Factura no encontrada' })
    return reply.send(invoice)
  })
}
