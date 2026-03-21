export function registerAuthDecorators (fastify) {
  fastify.decorate('authenticate', async function (request, reply) {
    try { await request.jwtVerify() }
    catch { reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Token inválido o expirado' }) }
  })
}
