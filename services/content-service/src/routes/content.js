import { datasheets, videos, news } from '../data/contentStore.js'

/**
 * Rutas de contenido — vista cliente
 * HU-36 — fichas técnicas y protocolos descargables
 * HU-37 — vídeos formativos por producto/familia
 * HU-38 — novedades y lanzamientos
 */
export async function contentRoutes (fastify) {

  // ── HU-36 — Fichas técnicas ───────────────────────────────────

  fastify.get('/datasheets', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Lista fichas técnicas y protocolos descargables (HU-36)',
      tags: ['content'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          familyId:    { type: 'string' },
          productCode: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    let result = datasheets.filter(d => d.active)
    if (request.query.familyId)    result = result.filter(d => d.familyId    === request.query.familyId)
    if (request.query.productCode) result = result.filter(d => d.productCode === request.query.productCode)
    return reply.send(result)
  })

  fastify.get('/datasheets/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Obtiene los metadatos de una ficha técnica (HU-36)',
      tags: ['content'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const ds = datasheets.find(d => d.id === request.params.id && d.active)
    if (!ds) return reply.status(404).send({ error: 'DATASHEET_NOT_FOUND', message: 'Ficha técnica no encontrada' })
    return reply.send(ds)
  })

  // ── HU-37 — Vídeos formativos ─────────────────────────────────

  fastify.get('/videos', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Lista vídeos formativos por producto o familia (HU-37)',
      tags: ['content'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          familyId:    { type: 'string' },
          productCode: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    let result = videos.filter(v => v.active)
    if (request.query.familyId)    result = result.filter(v => v.familyId    === request.query.familyId)
    if (request.query.productCode) result = result.filter(v => v.productCode === request.query.productCode)
    return reply.send(result)
  })

  fastify.get('/videos/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Obtiene los datos de un vídeo formativo (HU-37)',
      tags: ['content'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const vid = videos.find(v => v.id === request.params.id && v.active)
    if (!vid) return reply.status(404).send({ error: 'VIDEO_NOT_FOUND', message: 'Vídeo no encontrado' })
    return reply.send(vid)
  })

  // ── HU-38 — Novedades y lanzamientos ─────────────────────────

  fastify.get('/news', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Lista novedades y lanzamientos (HU-38)',
      tags: ['content'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          featured: { type: 'string', enum: ['true', 'false'] }
        }
      }
    }
  }, async (request, reply) => {
    let result = news
      .filter(n => n.active)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    if (request.query.featured === 'true')  result = result.filter(n => n.featured)
    if (request.query.featured === 'false') result = result.filter(n => !n.featured)
    return reply.send(result)
  })

  fastify.get('/news/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Obtiene una novedad o lanzamiento completo (HU-38)',
      tags: ['content'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const item = news.find(n => n.id === request.params.id && n.active)
    if (!item) return reply.status(404).send({ error: 'NEWS_NOT_FOUND', message: 'Novedad no encontrada' })
    return reply.send(item)
  })
}
