import { SapIntegrationClient } from '../clients/SapIntegrationClient.js'

const sap = new SapIntegrationClient()

export async function invoiceRoutes (fastify) {

  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Lista facturas del cliente (HU-20)', tags: ['invoices'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const orders = await sap.getOrders(request.user.sub)
    if (!orders) return reply.send([])
    return reply.send(
      orders.filter(o => o.invoiceId).map(o => ({ invoiceId: o.invoiceId, orderId: o.orderId, date: o.date, total: o.total, status: o.status }))
    )
  })

  fastify.get('/:invoiceId', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Datos de una factura (HU-20)', tags: ['invoices'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const invoice = await sap.getInvoice(request.params.invoiceId)
    if (!invoice) return reply.status(404).send({ error: 'INVOICE_NOT_FOUND', message: 'Factura no encontrada' })
    if (invoice.sapCode !== request.user.sub && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'No tienes acceso a esta factura' })
    }
    return reply.send(invoice)
  })

  fastify.get('/:invoiceId/download', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Descarga PDF de una factura desde SAP (HU-20)', tags: ['invoices'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const invoice = await sap.getInvoice(request.params.invoiceId)
    if (!invoice) return reply.status(404).send({ error: 'INVOICE_NOT_FOUND', message: 'Factura no encontrada' })
    if (invoice.sapCode !== request.user.sub && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'No tienes acceso a esta factura' })
    }
    return reply.send({ invoiceId: invoice.invoiceId, downloadUrl: invoice.pdfUrl ?? `/invoices/${invoice.invoiceId}/download`, message: 'En producción aquí se devuelve el PDF desde SAP' })
  })
}
