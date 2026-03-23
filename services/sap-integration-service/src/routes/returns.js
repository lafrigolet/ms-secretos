/**
 * Rutas de devoluciones
 * Usadas por returns-service (HU-35)
 */
export async function returnsRoutes (fastify) {
  const sap = fastify.sap

  // Crear nota de crédito en SAP cuando una devolución es aprobada
  fastify.post('/credit-note', {
    schema: {
      description: 'Crea una nota de crédito en SAP para una devolución aprobada (HU-35)',
      tags: ['returns'],
      body: {
        type: 'object',
        required: ['returnId', 'orderId', 'sapCode', 'items'],
        properties: {
          returnId: { type: 'string' },
          orderId:  { type: 'string' },
          sapCode:  { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productCode', 'quantity'],
              properties: {
                productCode: { type: 'string' },
                name:        { type: 'string' },
                quantity:    { type: 'integer', minimum: 1 },
                reason:      { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const creditNote = await sap.createCreditNote(request.body)
    return reply.status(201).send(creditNote)
  })
}
