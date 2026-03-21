import {
  NOTIFICATION_TYPES, CHANNELS,
  getPreferences, updatePreferences,
  getInbox, markAsRead, markAllAsRead, getUnreadCount,
  getWatchlist, addToWatchlist, removeFromWatchlist,
  getBroadcasts, createBroadcast
} from '../data/notificationsStore.js'

export async function notificationRoutes (fastify) {

  // ── Tipos y canales disponibles ───────────────────────────────
  fastify.get('/types', {
    schema: { description: 'Lista los tipos de notificación disponibles', tags: ['notifications'] }
  }, async (_req, reply) => reply.send({ types: NOTIFICATION_TYPES, channels: CHANNELS }))

  // ── HU-51 — Preferencias de notificación ─────────────────────
  fastify.get('/preferences', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Obtiene las preferencias de notificación del cliente (HU-51)',
      tags: ['notifications'], security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    return reply.send({
      sapCode: request.user.sub,
      preferences: getPreferences(request.user.sub),
      types: NOTIFICATION_TYPES,
      channels: CHANNELS
    })
  })

  fastify.patch('/preferences', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Actualiza las preferencias de notificación (HU-51)',
      tags: ['notifications'], security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        description: 'Mapa de tipo → { CANAL: boolean }. Solo los campos enviados se actualizan.',
        additionalProperties: {
          type: 'object',
          properties: {
            EMAIL:  { type: 'boolean' },
            PUSH:   { type: 'boolean' },
            IN_APP: { type: 'boolean' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const updated = updatePreferences(request.user.sub, request.body)
    return reply.send({ sapCode: request.user.sub, preferences: updated })
  })

  // ── Bandeja de entrada ────────────────────────────────────────
  fastify.get('/inbox', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Bandeja de entrada de notificaciones del cliente',
      tags: ['notifications'], security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const notifications = getInbox(request.user.sub)
    return reply.send({
      notifications,
      unread: getUnreadCount(request.user.sub),
      total: notifications.length
    })
  })

  fastify.patch('/inbox/:id/read', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Marca una notificación como leída',
      tags: ['notifications'], security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const notif = markAsRead(request.user.sub, request.params.id)
    if (!notif) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Notificación no encontrada' })
    return reply.send(notif)
  })

  fastify.patch('/inbox/read-all', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Marca todas las notificaciones como leídas',
      tags: ['notifications'], security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    markAllAsRead(request.user.sub)
    return reply.send({ message: 'Todas las notificaciones marcadas como leídas' })
  })

  // ── HU-48 — Watchlist de stock ────────────────────────────────
  fastify.get('/watchlist', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Lista los productos en seguimiento de stock (HU-48)',
      tags: ['notifications'], security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    return reply.send(getWatchlist(request.user.sub))
  })

  fastify.post('/watchlist', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Añade un producto al seguimiento de stock (HU-48)',
      tags: ['notifications'], security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['productCode', 'productName'],
        properties: {
          productCode: { type: 'string' },
          productName: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const entry = addToWatchlist(
      request.user.sub,
      request.body.productCode,
      request.body.productName
    )
    return reply.status(201).send(entry)
  })

  fastify.delete('/watchlist/:productCode', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Elimina un producto del seguimiento de stock (HU-48)',
      tags: ['notifications'], security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const removed = removeFromWatchlist(request.user.sub, request.params.productCode)
    if (!removed) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Producto no encontrado en tu seguimiento' })
    return reply.send({ message: 'Producto eliminado del seguimiento' })
  })

  // ── HU-49 — Alertas de promociones próximas a vencer ─────────
  // Simulación: en producción consultaría al promotions-service
  fastify.get('/alerts/expiring-promos', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Promociones aplicables al perfil del cliente que vencen en los próximos días (HU-49)',
      tags: ['notifications'], security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: { daysAhead: { type: 'integer', minimum: 1, maximum: 30, default: 7 } }
      }
    }
  }, async (request, reply) => {
    const daysAhead = request.query.daysAhead ?? 7
    const profile   = request.user.profile

    // Stub — en producción consultaría al promotions-service
    const STUB_EXPIRING = [
      {
        promoId: 'P001',
        name: 'Promo Otoño — Ritual Timeless',
        description: 'Compra ×6 unidades → muestra gratis',
        expiresAt: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
        daysLeft: 3,
        profiles: ['PREMIUM', 'VIP'],
        applicable: ['PREMIUM', 'VIP'].includes(profile)
      }
    ]

    return reply.send({
      daysAhead,
      promos: STUB_EXPIRING.filter(p => p.applicable)
    })
  })

  // ── HU-50 — Aviso de pedido mínimo ───────────────────────────
  fastify.post('/alerts/check-min-order', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Comprueba si el carrito actual alcanza el mínimo para envío gratis o promociones (HU-50)',
      tags: ['notifications'], security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['cartTotal'],
        properties: {
          cartTotal: { type: 'number', minimum: 0 }
        }
      }
    }
  }, async (request, reply) => {
    const { cartTotal } = request.body
    const FREE_SHIPPING_THRESHOLD = 150
    const PROMO_THRESHOLD         = 100

    const alerts = []

    if (cartTotal < FREE_SHIPPING_THRESHOLD) {
      alerts.push({
        type: 'MIN_ORDER',
        level: 'INFO',
        message: `Añade ${(FREE_SHIPPING_THRESHOLD - cartTotal).toFixed(2)}€ más para obtener envío gratuito`,
        threshold: FREE_SHIPPING_THRESHOLD,
        remaining: +(FREE_SHIPPING_THRESHOLD - cartTotal).toFixed(2)
      })
    }

    if (cartTotal < PROMO_THRESHOLD) {
      alerts.push({
        type: 'MIN_ORDER',
        level: 'INFO',
        message: `Añade ${(PROMO_THRESHOLD - cartTotal).toFixed(2)}€ más para activar las promociones de volumen`,
        threshold: PROMO_THRESHOLD,
        remaining: +(PROMO_THRESHOLD - cartTotal).toFixed(2)
      })
    }

    return reply.send({ cartTotal, alerts, hasAlerts: alerts.length > 0 })
  })

  // ── HU-52 — Comunicaciones segmentadas (admin) ────────────────
  fastify.get('/broadcasts', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Lista todas las comunicaciones enviadas (HU-52)',
      tags: ['notifications'], security: [{ bearerAuth: [] }]
    }
  }, async (_req, reply) => reply.send(getBroadcasts()))

  fastify.post('/broadcasts', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Envía una comunicación segmentada a clientes (HU-52)',
      tags: ['notifications'], security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'body'],
        properties: {
          title:    { type: 'string' },
          body:     { type: 'string' },
          channel:  { type: 'string', enum: ['EMAIL', 'PUSH', 'IN_APP'], default: 'EMAIL' },
          segments: {
            type: 'object',
            properties: {
              profiles: { type: 'array', items: { type: 'string', enum: ['STANDARD', 'PREMIUM', 'VIP'] } },
              status:   { type: 'string', enum: ['ACTIVE', 'BLOCKED', 'ALL'] }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const bc = createBroadcast(request.user.sub, request.body)
    fastify.log.info({ broadcastId: bc.id, adminId: request.user.sub, recipients: bc.recipientCount }, 'Broadcast enviado')
    return reply.status(201).send(bc)
  })
}
