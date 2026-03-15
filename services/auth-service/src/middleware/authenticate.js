/**
 * Decorador fastify.authenticate
 * Usado como preHandler en rutas protegidas.
 * Se registra en app.js tras el plugin JWT.
 *
 * Uso en rutas:
 *   preHandler: [fastify.authenticate]
 */
export function registerAuthDecorator (fastify) {
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Token inválido o expirado'
      })
    }
  })
}
