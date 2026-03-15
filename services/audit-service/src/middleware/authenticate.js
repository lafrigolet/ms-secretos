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
}
