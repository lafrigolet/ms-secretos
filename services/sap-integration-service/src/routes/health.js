export async function healthRoutes (fastify) {
  fastify.get('/', {
    schema: {
      description: 'Health check del SAP Integration Service',
      tags: ['health']
    }
  }, async (_request, reply) => {
    const mode = process.env.SAP_MODE ?? 'stub'
    return reply.send({
      status: 'ok',
      service: 'sda-sap-integration-service',
      mode,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      cache: fastify.sap.getCacheStats()
    })
  })

  // Invalidar caché manualmente (útil tras cambios en SAP)
  fastify.post('/cache/invalidate', {
    schema: {
      description: 'Invalida la caché en memoria — fuerza recarga desde SAP',
      tags: ['health']
    }
  }, async (_request, reply) => {
    fastify.sap.invalidateAll()
    return reply.send({ message: 'Caché invalidada correctamente' })
  })
}
