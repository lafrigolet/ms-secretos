/**
 * Rutas de clientes
 * Usadas internamente por auth-service y customer-profile-service
 */
export async function customerRoutes (fastify) {
  const sap = fastify.sap

  // Verificar credenciales (usado por auth-service)
  fastify.post('/verify', {
    schema: {
      description: 'Verifica credenciales de un cliente contra SAP',
      tags: ['customers'],
      body: {
        type: 'object',
        required: ['sapCode', 'password'],
        properties: {
          sapCode: { type: 'string' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const result = await sap.verifyCredentials(
      request.body.sapCode,
      request.body.password
    )
    return reply.send(result)
  })

  // Obtener un cliente por código SAP
  fastify.get('/:sapCode', {
    schema: {
      description: 'Obtiene los datos de un cliente por su código SAP',
      tags: ['customers'],
      params: {
        type: 'object',
        properties: { sapCode: { type: 'string' } }
      }
    }
  }, async (request, reply) => {
    const customer = await sap.getCustomer(request.params.sapCode)
    if (!customer) return reply.status(404).send({ error: 'CUSTOMER_NOT_FOUND', message: 'Cliente no encontrado' })
    return reply.send(customer)
  })

  // Obtener todos los clientes (usado por customer-profile-service)
  fastify.get('/', {
    schema: {
      description: 'Lista todos los clientes',
      tags: ['customers']
    }
  }, async (_request, reply) => {
    const customers = await sap.getAllCustomers()
    return reply.send(customers)
  })

  // Actualizar perfil de un cliente (HU-05)
  fastify.patch('/:sapCode', {
    schema: {
      description: 'Actualiza el perfil de un cliente',
      tags: ['customers'],
      params: { type: 'object', properties: { sapCode: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['profile'],
        properties: {
          profile: { type: 'string', enum: ['STANDARD', 'PREMIUM', 'VIP'] }
        }
      }
    }
  }, async (request, reply) => {
    const customer = await sap.updateProfile(request.params.sapCode, request.body.profile)
    if (!customer) return reply.status(404).send({ error: 'CUSTOMER_NOT_FOUND', message: 'Cliente no encontrado' })
    return reply.send(customer)
  })

  // Activar o bloquear cuenta (HU-28)
  fastify.patch('/:sapCode/status', {
    schema: {
      description: 'Activa o bloquea la cuenta de un cliente',
      tags: ['customers'],
      params: { type: 'object', properties: { sapCode: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status:      { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
          blockReason: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const customer = await sap.updateStatus(
      request.params.sapCode,
      request.body.status,
      request.body.blockReason ?? null
    )
    if (!customer) return reply.status(404).send({ error: 'CUSTOMER_NOT_FOUND', message: 'Cliente no encontrado' })
    return reply.send(customer)
  })
}
