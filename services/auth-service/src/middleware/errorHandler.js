/**
 * Error handler global de Fastify.
 * Normaliza todos los errores a un formato JSON consistente.
 */
export function errorHandler (error, request, reply) {
  const log = request.log ?? console

  // Error de validación de esquema (Fastify lo genera automáticamente)
  if (error.validation) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Los datos enviados no son válidos',
      details: error.validation
    })
  }

  // SAP Integration no disponible
  if (error.message === 'SAP_INTEGRATION_UNAVAILABLE') {
    log.error('SAP Integration Service no disponible')
    return reply.status(503).send({
      error: 'SERVICE_UNAVAILABLE',
      message: 'El servicio de autenticación no está disponible temporalmente. Inténtalo de nuevo en unos minutos.'
    })
  }

  // Error genérico — no exponemos detalles internos en producción
  log.error({ err: error }, 'Error no controlado')
  const statusCode = error.statusCode ?? 500
  return reply.status(statusCode).send({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'Ha ocurrido un error inesperado'
      : error.message
  })
}
