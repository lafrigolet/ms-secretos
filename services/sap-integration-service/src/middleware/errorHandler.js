export function errorHandler (error, request, reply) {
  const log = request.log ?? console

  if (error.validation) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Los datos enviados no son válidos',
      details: error.validation
    })
  }

  if (error.message?.includes('SAP responded with')) {
    log.error({ err: error.message }, 'Error de SAP')
    return reply.status(502).send({
      error: 'SAP_ERROR',
      message: 'Error al comunicarse con SAP'
    })
  }

  if (error.code === 'ABORT_ERR' || error.name === 'TimeoutError') {
    return reply.status(504).send({
      error: 'SAP_TIMEOUT',
      message: 'SAP no respondió en el tiempo esperado'
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
