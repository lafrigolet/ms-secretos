import {
  datasheets, videos, news,
  createDatasheet, updateDatasheet,
  createVideo,     updateVideo,
  createNews,      updateNews
} from '../data/contentStore.js'

/**
 * Rutas de administración de contenidos
 * HU-39 — subir, editar y retirar fichas técnicas, vídeos y noticias
 */
export async function adminContentRoutes (fastify) {

  // ── Fichas técnicas ───────────────────────────────────────────

  fastify.get('/datasheets', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: { description: 'Lista todas las fichas (incluyendo inactivas) — admin (HU-39)', tags: ['admin-content'], security: [{ bearerAuth: [] }] }
  }, async (_req, reply) => reply.send(datasheets))

  fastify.post('/datasheets', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Crea una nueva ficha técnica — admin (HU-39)',
      tags: ['admin-content'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'downloadUrl', 'fileType'],
        properties: {
          title:       { type: 'string' },
          description: { type: 'string' },
          productCode: { type: 'string' },
          familyId:    { type: 'string' },
          fileType:    { type: 'string', enum: ['PDF', 'DOCX', 'ZIP'] },
          fileSizeKb:  { type: 'number' },
          downloadUrl: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => reply.status(201).send(createDatasheet(request.body)))

  fastify.patch('/datasheets/:id', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Edita o retira una ficha técnica — admin (HU-39)',
      tags: ['admin-content'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          title:       { type: 'string' },
          description: { type: 'string' },
          downloadUrl: { type: 'string' },
          active:      { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const ds = updateDatasheet(request.params.id, request.body)
    if (!ds) return reply.status(404).send({ error: 'DATASHEET_NOT_FOUND', message: 'Ficha no encontrada' })
    return reply.send(ds)
  })

  // ── Vídeos ────────────────────────────────────────────────────

  fastify.get('/videos', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: { description: 'Lista todos los vídeos (incluyendo inactivos) — admin (HU-39)', tags: ['admin-content'], security: [{ bearerAuth: [] }] }
  }, async (_req, reply) => reply.send(videos))

  fastify.post('/videos', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Añade un vídeo formativo — admin (HU-39)',
      tags: ['admin-content'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'videoUrl', 'duration'],
        properties: {
          title:        { type: 'string' },
          description:  { type: 'string' },
          productCode:  { type: 'string' },
          familyId:     { type: 'string' },
          duration:     { type: 'string' },
          videoUrl:     { type: 'string' },
          thumbnailUrl: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => reply.status(201).send(createVideo(request.body)))

  fastify.patch('/videos/:id', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Edita o retira un vídeo — admin (HU-39)',
      tags: ['admin-content'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          title:       { type: 'string' },
          description: { type: 'string' },
          videoUrl:    { type: 'string' },
          active:      { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const vid = updateVideo(request.params.id, request.body)
    if (!vid) return reply.status(404).send({ error: 'VIDEO_NOT_FOUND', message: 'Vídeo no encontrado' })
    return reply.send(vid)
  })

  // ── Novedades ─────────────────────────────────────────────────

  fastify.get('/news', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: { description: 'Lista todas las novedades (incluyendo inactivas) — admin (HU-39)', tags: ['admin-content'], security: [{ bearerAuth: [] }] }
  }, async (_req, reply) => reply.send(news))

  fastify.post('/news', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Publica una novedad o lanzamiento — admin (HU-39)',
      tags: ['admin-content'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'summary'],
        properties: {
          title:    { type: 'string' },
          summary:  { type: 'string' },
          body:     { type: 'string' },
          imageUrl: { type: 'string' },
          tags:     { type: 'array', items: { type: 'string' } },
          featured: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => reply.status(201).send(createNews(request.body)))

  fastify.patch('/news/:id', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Edita o retira una novedad — admin (HU-39)',
      tags: ['admin-content'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          title:    { type: 'string' },
          summary:  { type: 'string' },
          body:     { type: 'string' },
          featured: { type: 'boolean' },
          active:   { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const item = updateNews(request.params.id, request.body)
    if (!item) return reply.status(404).send({ error: 'NEWS_NOT_FOUND', message: 'Novedad no encontrada' })
    return reply.send(item)
  })
}
