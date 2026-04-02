import 'dotenv/config'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { catalogRoutes } from './routes/catalog.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = Fastify({
  logger: {
    level: 'info',
    transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty', options: { colorize: true } } : undefined
  }
})

await app.register(corsPlugin, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? (process.env.NODE_ENV === 'production' ? false : true)
})
await app.register(jwtPlugin, { secret: process.env.JWT_SECRET })
await app.register(swaggerPlugin, {
  openapi: {
    info: { title: 'Secretos del Agua — Catalog Service', description: 'Catálogo de productos (HU-07, HU-08, HU-09)', version: '1.0.0' },
    tags: [{ name: 'catalog', description: 'Productos, familias y recomendaciones' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } }
  }
})
await app.register(swaggerUiPlugin, { routePrefix: '/docs' })

registerAuthDecorators(app)
app.setErrorHandler(errorHandler)

await app.register(catalogRoutes, { prefix: '/catalog' })
app.get('/health', async () => ({ status: 'ok', service: 'sda-catalog-service', uptime: process.uptime(), timestamp: new Date().toISOString() }))

const PORT = Number(process.env.PORT ?? 3002)
try {
  await app.listen({ port: PORT, host: process.env.HOST ?? '0.0.0.0' })
  app.log.info(`Catalog Service en puerto ${PORT}`)
} catch (err) { app.log.error(err); process.exit(1) }
