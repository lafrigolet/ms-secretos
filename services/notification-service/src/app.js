import 'dotenv/config'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { notificationRoutes } from './routes/notifications.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty', options: { colorize: true } } : undefined
  }
})

await app.register(corsPlugin)
await app.register(jwtPlugin, { secret: process.env.JWT_SECRET })
await app.register(swaggerPlugin, {
  openapi: {
    info: { title: 'Secretos del Agua — Notification Service', description: 'Notificaciones por email (HU-17)', version: '1.0.0' },
    tags: [{ name: 'notifications', description: 'Notificaciones' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } }
  }
})
await app.register(swaggerUiPlugin, { routePrefix: '/docs' })

registerAuthDecorators(app)
app.setErrorHandler(errorHandler)
await app.register(notificationRoutes, { prefix: '/notifications' })
app.get('/health', async () => ({ status: 'ok', service: 'sda-notification-service', uptime: process.uptime(), timestamp: new Date().toISOString() }))

const PORT = Number(process.env.PORT ?? 3007)
try {
  await app.listen({ port: PORT, host: process.env.HOST ?? '0.0.0.0' })
  app.log.info(`Notification Service en puerto ${PORT}`)
} catch (err) { app.log.error(err); process.exit(1) }
