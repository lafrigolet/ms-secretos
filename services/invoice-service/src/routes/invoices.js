import { SapClient } from '../services/SapClient.js'

const sap = new SapClient()

export async function invoiceRoutes (fastify) {

  // HU-20 — Listar facturas del cliente
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Lista las facturas del cliente autenticado (HU-20)',
      tags: ['invoices'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const orders = await sap.get(`/internal/orders/${request.user.sub}`)
    if (!orders) return reply.send([])

    // Solo devolvemos pedidos que tienen factura
    const invoices = orders
      .filter(o => o.invoiceId)
      .map(o => ({
        invoiceId: o.invoiceId,
        orderId: o.orderId,
        date: o.date,
        total: o.total,
        status: o.status
      }))

    return reply.send(invoices)
  })

  // HU-20 — Descargar factura
  fastify.get('/:invoiceId', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Obtiene los datos de una factura (HU-20)',
      tags: ['invoices'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const invoice = await sap.get(`/internal/orders/invoice/${request.params.invoiceId}`)
    if (!invoice) return reply.status(404).send({ error: 'INVOICE_NOT_FOUND', message: 'Factura no encontrada' })

    // Verificar que la factura pertenece al usuario autenticado
    if (invoice.sapCode !== request.user.sub && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'No tienes acceso a esta factura' })
    }

    return reply.send(invoice)
  })

  // HU-20 — Descarga PDF (simulado — en producción genera o descarga desde SAP)
  fastify.get('/:invoiceId/download', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Descarga el PDF de una factura desde SAP (HU-20)',
      tags: ['invoices'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const invoice = await sap.get(`/internal/orders/invoice/${request.params.invoiceId}`)
    if (!invoice) return reply.status(404).send({ error: 'INVOICE_NOT_FOUND', message: 'Factura no encontrada' })

    if (invoice.sapCode !== request.user.sub && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'No tienes acceso a esta factura' })
    }

    // En producción: obtener PDF de SAP y devolverlo como stream
    // Por ahora devolvemos la URL donde estaría disponible
    return reply.send({
      invoiceId: invoice.invoiceId,
      downloadUrl: invoice.pdfUrl ?? `/invoices/${invoice.invoiceId}/download`,
      message: 'En producción aquí se devuelve el PDF desde SAP'
    })
  })
}
