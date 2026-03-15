import 'dotenv/config'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'

import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'
import { errorHandler } from './middleware/errorHandler.js'
import { registerAuthDecorator } from './middleware/authenticate.js'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined
  }
})

// ── Plugins ──────────────────────────────────────────────
await app.register(corsPlugin, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? true
})

await app.register(jwtPlugin, {
  secret: process.env.JWT_SECRET,
  sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' }
})

registerAuthDecorator(app)

await app.register(swaggerPlugin, {
  openapi: {
    info: {
      title: 'Secretos del Agua — Auth Service',
      description: 'Autenticación B2B con código SAP (HU-01, HU-02, HU-03)',
      version: '1.0.0'
    },
    tags: [
      { name: 'auth', description: 'Autenticación y sesión' },
      { name: 'health', description: 'Estado del servicio' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  }
})

await app.register(swaggerUiPlugin, {
  routePrefix: '/docs'
})

// ── Error handler global ─────────────────────────────────
app.setErrorHandler(errorHandler)

// ── Rutas ────────────────────────────────────────────────
await app.register(authRoutes, { prefix: '/auth' })
await app.register(healthRoutes, { prefix: '/health' })

// ── Arranque ─────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port: PORT, host: HOST })
  app.log.info(`Auth Service escuchando en ${HOST}:${PORT}`)
  app.log.info(`Documentación disponible en http://localhost:${PORT}/docs`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
