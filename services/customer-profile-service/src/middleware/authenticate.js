/**
 * Decoradores de autenticación y autorización.
 *
 * fastify.authenticate  — verifica que el JWT es válido
 * fastify.requireAdmin  — verifica que el usuario tiene rol ADMIN
 *
 * Uso en rutas:
 *   preHandler: [fastify.authenticate]
 *   preHandler: [fastify.authenticate, fastify.requireAdmin]
 */
export function registerAuthDecorators (fastify) {
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Token inválido o expirado' })
    }
  })

  fastify.decorate('requireAdmin', async function (request, reply) {
    if (request.user?.role !== 'ADMIN') {
      reply.status(403).send({ error: 'FORBIDDEN', message: 'Se requiere rol de administrador' })
    }
  })
}
