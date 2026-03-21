/**
 * Rutas de perfil de cliente
 * HU-04 — Perfil personalizado según SAP
 * HU-05 — Gestión de permisos por administrador
 */
export async function profileRoutes (fastify) {
  const profileService = fastify.profileService

  // ── GET /profile/me ────────────────────────────────────────────
  // HU-04: el cliente ve su propio perfil y permisos
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Devuelve el perfil y permisos del cliente autenticado (HU-04)',
      tags: ['profile'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            sapCode:             { type: 'string' },
            name:                { type: 'string' },
            businessName:        { type: 'string' },
            email:               { type: 'string' },
            profile:             { type: 'string', enum: ['STANDARD', 'PREMIUM', 'VIP', 'ADMIN'] },
            role:                { type: 'string', enum: ['CUSTOMER', 'ADMIN'] },
            status:              { type: 'string' },
            permissions:         { type: 'array', items: { type: 'string' } },
            canOrder:            { type: 'boolean' },
            canViewPromotions:   { type: 'boolean' },
            hasSpecialConditions:{ type: 'boolean' },
            isAdmin:             { type: 'boolean' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const profile = await profileService.getProfile(request.user.sub)
    if (!profile) {
      return reply.status(404).send({ error: 'PROFILE_NOT_FOUND', message: 'Perfil no encontrado' })
    }
    return reply.send(profile)
  })

  // ── GET /profile/:sapCode ──────────────────────────────────────
  // Perfil de cualquier cliente — solo admins
  fastify.get('/:sapCode', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Obtiene el perfil de un cliente por código SAP — solo administradores',
      tags: ['profile'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { sapCode: { type: 'string' } }
      }
    }
  }, async (request, reply) => {
    const profile = await profileService.getProfile(request.params.sapCode)
    if (!profile) {
      return reply.status(404).send({ error: 'PROFILE_NOT_FOUND', message: 'Perfil no encontrado' })
    }
    return reply.send(profile)
  })

  // ── GET /profile ───────────────────────────────────────────────
  // Lista todos los perfiles — solo admins
  fastify.get('/', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Lista todos los perfiles de cliente — solo administradores',
      tags: ['profile'],
      security: [{ bearerAuth: [] }]
    }
  }, async (_request, reply) => {
    const profiles = await profileService.getAllProfiles()
    return reply.send(profiles)
  })

  // ── PATCH /profile/:sapCode ────────────────────────────────────
  // HU-05: el administrador modifica el perfil de un cliente
  fastify.patch('/:sapCode', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Modifica el perfil de un cliente — solo administradores (HU-05)',
      tags: ['profile'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { sapCode: { type: 'string' } }
      },
      body: {
        type: 'object',
        required: ['profile'],
        properties: {
          profile: {
            type: 'string',
            enum: ['STANDARD', 'PREMIUM', 'VIP'],
            description: 'Nuevo perfil del cliente'
          }
        }
      }
    }
  }, async (request, reply) => {
    const result = await profileService.updateProfile(
      request.params.sapCode,
      request.body.profile,
      request.user.sub
    )

    if (!result.success) {
      const status = result.error === 'CUSTOMER_NOT_FOUND' ? 404 : 400
      return reply.status(status).send({ error: result.error, message: result.message })
    }

    return reply.send(result.profile)
  })

  // ── POST /profile/check-permission ────────────────────────────
  // Endpoint interno — usado por otros microservicios para verificar permisos
  fastify.post('/check-permission', {
    schema: {
      description: 'Verifica si un cliente tiene un permiso — uso interno entre servicios',
      tags: ['internal'],
      body: {
        type: 'object',
        required: ['sapCode', 'permission'],
        properties: {
          sapCode:    { type: 'string' },
          permission: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { sapCode, permission } = request.body
    const allowed = await profileService.hasPermission(sapCode, permission)
    return reply.send({ sapCode, permission, allowed })
  })
}

  // ── GET /profile/search ────────────────────────────────────────
  // HU-24 — Búsqueda de clientes por atributos
  fastify.get('/search', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Busca clientes por código SAP, nombre, tienda, ciudad o email (HU-24)',
      tags: ['profile'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['q'],
        properties: { q: { type: 'string', minLength: 1 } }
      }
    }
  }, async (request, reply) => {
    const results = await profileService.searchCustomers(request.query.q)
    return reply.send(results)
  })

  // ── GET /profile/filter ────────────────────────────────────────
  // HU-25 — Filtrado avanzado de clientes
  fastify.get('/filter', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Filtra clientes por estado, perfil o ciudad (HU-25)',
      tags: ['profile'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status:  { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
          profile: { type: 'string', enum: ['STANDARD', 'PREMIUM', 'VIP'] },
          city:    { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const results = await profileService.filterCustomers(request.query)
    return reply.send(results)
  })

  // ── PATCH /profile/:sapCode/status ────────────────────────────
  // HU-28 — Activar o bloquear manualmente una cuenta
  fastify.patch('/:sapCode/status', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Activa o bloquea manualmente una cuenta de cliente (HU-28)',
      tags: ['profile'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status:      { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
          blockReason: { type: 'string', maxLength: 200 }
        }
      }
    }
  }, async (request, reply) => {
    const result = await profileService.updateStatus(
      request.params.sapCode,
      request.body.status,
      request.body.blockReason,
      request.user.sub
    )
    if (!result.success) {
      return reply.status(result.error === 'CUSTOMER_NOT_FOUND' ? 404 : 400)
        .send({ error: result.error, message: result.message })
    }
    return reply.send(result.customer)
  })
