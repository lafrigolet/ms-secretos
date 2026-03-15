// Registro de auditoría en memoria (en producción: base de datos, ELK, etc.)
const AUDIT_LOG = []

const VALID_ACTIONS = [
  'LOGIN', 'LOGIN_FAILED', 'LOGIN_BLOCKED',
  'ORDER_CREATED', 'ORDER_VIEWED',
  'PROFILE_UPDATED', 'INVOICE_DOWNLOADED',
  'PROMO_CREATED', 'PROMO_UPDATED', 'PROMO_TOGGLED'
]

export async function auditRoutes (fastify) {

  // Registrar un evento de auditoría — uso interno entre servicios
  fastify.post('/', {
    schema: {
      description: 'Registra un evento de auditoría — uso interno entre servicios (HU-22)',
      tags: ['audit'],
      body: {
        type: 'object',
        required: ['action', 'sapCode'],
        properties: {
          action:  { type: 'string', enum: VALID_ACTIONS },
          sapCode: { type: 'string' },
          data:    { type: 'object' },
          ip:      { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const entry = {
      id:        `AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action:    request.body.action,
      sapCode:   request.body.sapCode,
      data:      request.body.data ?? {},
      ip:        request.body.ip ?? request.ip,
      timestamp: new Date().toISOString()
    }
    AUDIT_LOG.push(entry)
    fastify.log.info({ auditId: entry.id, action: entry.action, sapCode: entry.sapCode }, 'Evento registrado')
    return reply.status(201).send({ id: entry.id, timestamp: entry.timestamp })
  })

  // HU-22 — Consultar registro de auditoría — solo admins
  fastify.get('/', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Registro de accesos y pedidos para detectar incidencias (HU-22)',
      tags: ['audit'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          sapCode: { type: 'string', description: 'Filtrar por cliente' },
          action:  { type: 'string', description: 'Filtrar por acción' },
          limit:   { type: 'integer', default: 50, maximum: 200 }
        }
      }
    }
  }, async (request, reply) => {
    const { sapCode, action, limit = 50 } = request.query

    let results = [...AUDIT_LOG].reverse() // más reciente primero

    if (sapCode) results = results.filter(e => e.sapCode === sapCode)
    if (action)  results = results.filter(e => e.action === action)

    return reply.send(results.slice(0, limit))
  })

  // Estadísticas — solo admins
  fastify.get('/stats', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Estadísticas de actividad para el panel de administración',
      tags: ['audit'],
      security: [{ bearerAuth: [] }]
    }
  }, async (_req, reply) => {
    const stats = VALID_ACTIONS.reduce((acc, action) => {
      acc[action] = AUDIT_LOG.filter(e => e.action === action).length
      return acc
    }, {})

    return reply.send({
      total: AUDIT_LOG.length,
      byAction: stats,
      uniqueUsers: new Set(AUDIT_LOG.map(e => e.sapCode)).size
    })
  })
}
