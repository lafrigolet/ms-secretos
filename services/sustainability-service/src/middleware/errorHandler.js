export function errorHandler (error, request, reply) {
  if (error.validation) {
    return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Datos inválidos', details: error.validation })
  }
  request.log?.error({ err: error }, 'Error no controlado')
  return reply.status(error.statusCode ?? 500).send({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : error.message
  })
}
