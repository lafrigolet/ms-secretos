export async function healthRoutes (fastify) {
  fastify.get('/', {
    schema: {
      description: 'Health check del Auth Service',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            service: { type: 'string' },
            uptime: { type: 'number' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (_request, reply) => {
    return reply.send({
      status: 'ok',
      service: 'sda-auth-service',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    })
  })
}
