import { loginSchema, refreshSchema, meSchema } from '../schemas/auth.js'
import { AuthService } from '../services/authService.js'

/**
 * Rutas de autenticación
 * HU-01 — Login con código SAP
 * HU-02 — Bloqueo de cuenta suspendida
 * HU-03 — Mensaje informativo en caso de bloqueo
 */
export async function authRoutes (fastify) {
  const authService = new AuthService(fastify)

  // ── POST /auth/login ──────────────────────────────────
  fastify.post('/login', {
    schema: loginSchema,
    config: { public: true }
  }, async (request, reply) => {
    const { sapCode, password } = request.body

    const result = await authService.login(sapCode, password)

    if (result.blocked) {
      // HU-02 y HU-03: cuenta bloqueada → 403 con mensaje claro
      return reply.status(403).send({
        error: 'ACCOUNT_BLOCKED',
        message: result.message,
        reason: result.reason,        // 'DEBT' | 'ADMIN' | 'SUSPENDED'
        supportContact: result.supportContact
      })
    }

    if (!result.success) {
      return reply.status(401).send({
        error: 'INVALID_CREDENTIALS',
        message: 'Código SAP o contraseña incorrectos'
      })
    }

    // HU-01: login correcto → devolvemos JWT + datos de sesión
    const token = fastify.jwt.sign({
      sub: result.customer.sapCode,
      name: result.customer.name,
      profile: result.customer.profile,   // 'STANDARD' | 'PREMIUM' | 'VIP'
      role: result.customer.role          // 'CUSTOMER' | 'ADMIN'
    })

    return reply.status(200).send({
      token,
      expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
      customer: {
        sapCode: result.customer.sapCode,
        name: result.customer.name,
        businessName: result.customer.businessName,
        profile: result.customer.profile,
        role: result.customer.role
      }
    })
  })

  // ── GET /auth/me ──────────────────────────────────────
  // Devuelve los datos del usuario autenticado a partir del JWT
  fastify.get('/me', {
    schema: meSchema,
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    return reply.send({
      sapCode: request.user.sub,
      name: request.user.name,
      profile: request.user.profile,
      role: request.user.role
    })
  })

  // ── POST /auth/logout ─────────────────────────────────
  // Con JWT stateless el logout es responsabilidad del cliente.
  // Este endpoint existe para registrar el evento y permitir
  // en el futuro implementar una blacklist de tokens.
  fastify.post('/logout', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    fastify.log.info({ sapCode: request.user.sub }, 'Usuario desconectado')
    return reply.status(200).send({ message: 'Sesión cerrada correctamente' })
  })

  // ── POST /auth/verify ─────────────────────────────────
  // Usado por otros microservicios para validar un JWT
  fastify.post('/verify', {
    schema: {
      description: 'Verifica un JWT — usado internamente por otros microservicios',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string' } }
      }
    }
  }, async (request, reply) => {
    try {
      const decoded = fastify.jwt.verify(request.body.token)
      return reply.send({ valid: true, payload: decoded })
    } catch {
      return reply.status(401).send({ valid: false, error: 'TOKEN_INVALID_OR_EXPIRED' })
    }
  })
}
