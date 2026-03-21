import {
  getAllReturns, getReturnById, updateReturn
} from '../data/returnsStore.js'
import { SapIntegrationClient } from '../clients/SapIntegrationClient.js'

const sap = new SapIntegrationClient()

/**
 * Rutas de administración de devoluciones
 * HU-34 — revisar, aprobar o rechazar devoluciones
 * HU-35 — generar abono/nota de crédito en SAP
 */
export async function adminReturnsRoutes (fastify) {

  // HU-34 — Listado completo de devoluciones
  fastify.get('/', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Lista todas las devoluciones — solo administradores (HU-34)',
      tags: ['admin-returns'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'RESOLVED'] }
        }
      }
    }
  }, async (request, reply) => {
    let results = getAllReturns()
    if (request.query.status) {
      results = results.filter(r => r.status === request.query.status)
    }
    return reply.send(results)
  })

  // HU-34 — Ver detalle de una devolución
  fastify.get('/:id', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Detalle de una devolución — solo administradores (HU-34)',
      tags: ['admin-returns'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const ret = getReturnById(request.params.id)
    if (!ret) return reply.status(404).send({ error: 'RETURN_NOT_FOUND', message: 'Devolución no encontrada' })
    return reply.send(ret)
  })

  // HU-34 — Cambiar estado (REVIEWING, APPROVED, REJECTED)
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Actualiza el estado de una devolución (HU-34)',
      tags: ['admin-returns'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status:     { type: 'string', enum: ['REVIEWING', 'APPROVED', 'REJECTED', 'RESOLVED'] },
          adminNotes: { type: 'string', maxLength: 500 }
        }
      }
    }
  }, async (request, reply) => {
    const ret = getReturnById(request.params.id)
    if (!ret) return reply.status(404).send({ error: 'RETURN_NOT_FOUND', message: 'Devolución no encontrada' })

    const { status, adminNotes } = request.body
    const updated = updateReturn(request.params.id, { status, adminNotes })

    fastify.log.info({ returnId: ret.id, status, admin: request.user.sub }, 'Estado de devolución actualizado')

    // HU-35 — Si se aprueba, generar nota de crédito en SAP automáticamente
    if (status === 'APPROVED' && !ret.creditNoteId) {
      try {
        const creditNote = await sap.createCreditNote({
          returnId: ret.id,
          orderId:  ret.orderId,
          sapCode:  ret.sapCode,
          items:    ret.items
        })
        updateReturn(ret.id, {
          status: 'RESOLVED',
          creditNoteId: creditNote.creditNoteId
        })
        fastify.log.info({ returnId: ret.id, creditNoteId: creditNote.creditNoteId }, 'Nota de crédito generada en SAP')

        return reply.send({
          ...updated,
          status: 'RESOLVED',
          creditNoteId: creditNote.creditNoteId,
          message: `Aprobada. Nota de crédito ${creditNote.creditNoteId} generada en SAP.`
        })
      } catch (err) {
        fastify.log.error({ returnId: ret.id, err: err.message }, 'Error al generar nota de crédito en SAP')
        // La devolución queda en APPROVED — se reintentará manualmente
        return reply.send({
          ...updated,
          warning: 'Devolución aprobada pero no se pudo generar la nota de crédito en SAP. Reintentar manualmente.'
        })
      }
    }

    return reply.send(updated)
  })

  // HU-35 — Reintentar generación de nota de crédito en SAP
  fastify.post('/:id/credit-note', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Genera o regenera la nota de crédito en SAP (HU-35)',
      tags: ['admin-returns'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const ret = getReturnById(request.params.id)
    if (!ret) return reply.status(404).send({ error: 'RETURN_NOT_FOUND', message: 'Devolución no encontrada' })
    if (!['APPROVED', 'RESOLVED'].includes(ret.status)) {
      return reply.status(400).send({ error: 'INVALID_STATUS', message: 'Solo se pueden generar notas de crédito para devoluciones aprobadas' })
    }

    const creditNote = await sap.createCreditNote({
      returnId: ret.id,
      orderId:  ret.orderId,
      sapCode:  ret.sapCode,
      items:    ret.items
    })

    const updated = updateReturn(ret.id, {
      status: 'RESOLVED',
      creditNoteId: creditNote.creditNoteId
    })

    return reply.send({ ...updated, creditNote })
  })
}
