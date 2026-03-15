// Datos de promociones en memoria (en producción vendría de una BD o SAP)
let PROMOTIONS = [
  {
    id: 'PROMO-001',
    name: 'Promo Otoño — Ritual Timeless',
    type: 'GIFT',
    description: 'Compra ×6 Champú → muestra gratis',
    profiles: ['PREMIUM', 'VIP'],
    active: true,
    condition: { productCode: 'P-RT-001', minQuantity: 6 },
    benefit: { type: 'SAMPLE', description: 'Muestra Sérum Raíces' }
  },
  {
    id: 'PROMO-002',
    name: '−15% Aceite Brillo Argán',
    type: 'DISCOUNT',
    description: 'Descuento directo en Aceite Brillo',
    profiles: ['STANDARD', 'PREMIUM', 'VIP'],
    active: true,
    condition: { productCode: 'P-BN-001', minQuantity: 1 },
    benefit: { type: 'DISCOUNT', value: 15, unit: 'PERCENT' }
  },
  {
    id: 'PROMO-003',
    name: 'Tester Aceite Brillo ≥250€',
    type: 'GIFT',
    description: 'Regalo automático al superar 250€',
    profiles: ['PREMIUM', 'VIP'],
    active: true,
    condition: { minOrderTotal: 250 },
    benefit: { type: 'GIFT', description: 'Tester Aceite Brillo Argán 10ml' }
  }
]

export async function promotionsRoutes (fastify) {

  // HU-10 — Promociones activas para el perfil del cliente
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Promociones vigentes para el perfil del cliente (HU-10)',
      tags: ['promotions'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const { profile } = request.user
    const active = PROMOTIONS.filter(p => p.active && p.profiles.includes(profile))
    return reply.send(active)
  })

  // HU-12 — Beneficios que recibirá el cliente con su pedido
  fastify.post('/calculate', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Calcula beneficios aplicables al pedido actual (HU-12, HU-13)',
      tags: ['promotions'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['items', 'orderTotal'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productCode: { type: 'string' },
                quantity: { type: 'integer' }
              }
            }
          },
          orderTotal: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    const { profile } = request.user
    const { items, orderTotal } = request.body

    const applicable = PROMOTIONS.filter(p => p.active && p.profiles.includes(profile))
    const benefits = []

    for (const promo of applicable) {
      const { condition, benefit } = promo

      // Condición por producto
      if (condition.productCode) {
        const item = items.find(i => i.productCode === condition.productCode)
        if (item && item.quantity >= condition.minQuantity) {
          benefits.push({ promoId: promo.id, promoName: promo.name, benefit })
        }
      }

      // HU-13 — Condición por importe mínimo (aplicación automática)
      if (condition.minOrderTotal && orderTotal >= condition.minOrderTotal) {
        benefits.push({ promoId: promo.id, promoName: promo.name, benefit })
      }
    }

    return reply.send({ benefits, count: benefits.length })
  })

  // HU-11 — Todas las promociones — solo admins
  fastify.get('/admin', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Lista todas las promociones incluyendo inactivas — solo administradores (HU-11)',
      tags: ['promotions'],
      security: [{ bearerAuth: [] }]
    }
  }, async (_req, reply) => reply.send(PROMOTIONS))

  // HU-11 — Crear promoción — solo admins
  fastify.post('/admin', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Crea una nueva promoción (HU-11)',
      tags: ['promotions'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'type', 'profiles', 'condition', 'benefit'],
        properties: {
          name:        { type: 'string' },
          type:        { type: 'string', enum: ['DISCOUNT', 'GIFT'] },
          description: { type: 'string' },
          profiles:    { type: 'array', items: { type: 'string' } },
          condition:   { type: 'object' },
          benefit:     { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const promo = {
      id: `PROMO-${String(PROMOTIONS.length + 1).padStart(3, '0')}`,
      ...request.body,
      active: true
    }
    PROMOTIONS.push(promo)
    return reply.status(201).send(promo)
  })

  // HU-11 — Editar promoción — solo admins
  fastify.patch('/admin/:id', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: { description: 'Edita una promoción existente (HU-11)', tags: ['promotions'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const idx = PROMOTIONS.findIndex(p => p.id === request.params.id)
    if (idx === -1) return reply.status(404).send({ error: 'PROMO_NOT_FOUND', message: 'Promoción no encontrada' })
    PROMOTIONS[idx] = { ...PROMOTIONS[idx], ...request.body }
    return reply.send(PROMOTIONS[idx])
  })

  // HU-11 — Desactivar promoción — solo admins
  fastify.patch('/admin/:id/toggle', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: { description: 'Activa o desactiva una promoción (HU-11)', tags: ['promotions'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const promo = PROMOTIONS.find(p => p.id === request.params.id)
    if (!promo) return reply.status(404).send({ error: 'PROMO_NOT_FOUND', message: 'Promoción no encontrada' })
    promo.active = !promo.active
    return reply.send({ id: promo.id, active: promo.active })
  })
}
