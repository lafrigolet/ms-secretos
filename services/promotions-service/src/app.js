import 'dotenv/config'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { promotionsRoutes } from './routes/promotions.js'
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
    info: { title: 'Secretos del Agua — Promotions Service', description: 'Promociones y beneficios (HU-10, HU-11, HU-12, HU-13)', version: '1.0.0' },
    tags: [{ name: 'promotions', description: 'Promociones y beneficios' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } }
  }
})
await app.register(swaggerUiPlugin, { routePrefix: '/docs' })

registerAuthDecorators(app)
app.setErrorHandler(errorHandler)
await app.register(promotionsRoutes, { prefix: '/promotions' })
app.get('/health', async () => ({ status: 'ok', service: 'sda-promotions-service', uptime: process.uptime(), timestamp: new Date().toISOString() }))

const PORT = Number(process.env.PORT ?? 3004)
try {
  await app.listen({ port: PORT, host: process.env.HOST ?? '0.0.0.0' })
  app.log.info(`Promotions Service en puerto ${PORT}`)
} catch (err) { app.log.error(err); process.exit(1) }
