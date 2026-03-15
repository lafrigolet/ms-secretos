export function errorHandler (error, request, reply) {
  const log = request.log ?? console
  if (error.validation) {
    return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Los datos enviados no son válidos', details: error.validation })
  }
  log.error({ err: error }, 'Error no controlado')
  return reply.status(error.statusCode ?? 500).send({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : error.message
  })
}
