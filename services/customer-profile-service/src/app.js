import 'dotenv/config'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'

import { ProfileService } from './services/ProfileService.js'
import { profileRoutes } from './routes/profile.js'
import { healthRoutes } from './routes/health.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = Fastify({
  logger: {
    level: 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined
  }
})

// ── Plugins ───────────────────────────────────────────────────────
await app.register(corsPlugin, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? true
})

await app.register(jwtPlugin, {
  secret: process.env.JWT_SECRET
})

await app.register(swaggerPlugin, {
  openapi: {
    info: {
      title: 'Secretos del Agua — Customer Profile Service',
      description: 'Gestión de perfiles y permisos de cliente (HU-04, HU-05)',
      version: '1.0.0'
    },
    tags: [
      { name: 'profile',  description: 'Perfil y permisos de cliente' },
      { name: 'internal', description: 'Endpoints de uso interno entre servicios' },
      { name: 'health',   description: 'Estado del servicio' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    }
  }
})

await app.register(swaggerUiPlugin, { routePrefix: '/docs' })

// ── Decoradores y servicios ───────────────────────────────────────
registerAuthDecorators(app)
app.decorate('profileService', new ProfileService(app.log))

// ── Error handler ─────────────────────────────────────────────────
app.setErrorHandler(errorHandler)

// ── Rutas ─────────────────────────────────────────────────────────
await app.register(profileRoutes, { prefix: '/profile' })
await app.register(healthRoutes,  { prefix: '/health' })

// ── Arranque ──────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3003)
const HOST = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port: PORT, host: HOST })
  app.log.info(`Customer Profile Service escuchando en ${HOST}:${PORT}`)
  app.log.info(`Documentación: http://localhost:${PORT}/docs`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
