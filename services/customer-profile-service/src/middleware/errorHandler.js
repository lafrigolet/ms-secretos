export function errorHandler (error, request, reply) {
  const log = request.log ?? console

  if (error.validation) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Los datos enviados no son válidos',
      details: error.validation
    })
  }

  if (error.message === 'SAP_INTEGRATION_UNAVAILABLE') {
    return reply.status(503).send({
      error: 'SERVICE_UNAVAILABLE',
      message: 'El servicio de perfiles no está disponible temporalmente'
    })
  }

  log.error({ err: error }, 'Error no controlado')
  return reply.status(error.statusCode ?? 500).send({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : error.message
  })
}
