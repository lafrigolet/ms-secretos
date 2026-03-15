export async function healthRoutes (fastify) {
  fastify.get('/', {
    schema: {
      description: 'Health check del Customer Profile Service',
      tags: ['health']
    }
  }, async (_request, reply) => {
    return reply.send({
      status: 'ok',
      service: 'sda-customer-profile-service',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    })
  })
}
