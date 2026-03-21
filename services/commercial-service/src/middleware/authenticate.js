export function registerAuthDecorators (fastify) {
  fastify.decorate('authenticate', async function (request, reply) {
    try { await request.jwtVerify() }
    catch { reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Token inválido o expirado' }) }
  })
  fastify.decorate('requireAdmin', async function (request, reply) {
    if (request.user?.role !== 'ADMIN') {
      reply.status(403).send({ error: 'FORBIDDEN', message: 'Se requiere rol de administrador' })
    }
  })
  fastify.decorate('requireCommercialOrAdmin', async function (request, reply) {
    if (!['COMMERCIAL', 'ADMIN'].includes(request.user?.role)) {
      reply.status(403).send({ error: 'FORBIDDEN', message: 'Se requiere rol de comercial o administrador' })
    }
  })
}
