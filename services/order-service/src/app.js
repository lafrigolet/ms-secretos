import 'dotenv/config'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { orderRoutes } from './routes/orders.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = Fastify({
  logger: {
    level: 'info',
    transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty', options: { colorize: true } } : undefined
  }
})

await app.register(corsPlugin)
await app.register(jwtPlugin, { secret: process.env.JWT_SECRET })
await app.register(swaggerPlugin, {
  openapi: {
    info: { title: 'Secretos del Agua — Order Service', description: 'Ciclo de vida del pedido (HU-17, HU-18, HU-19, HU-21)', version: '1.0.0' },
    tags: [{ name: 'orders', description: 'Pedidos' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } }
  }
})
await app.register(swaggerUiPlugin, { routePrefix: '/docs' })

registerAuthDecorators(app)
app.setErrorHandler(errorHandler)
await app.register(orderRoutes, { prefix: '/orders' })
app.get('/health', async () => ({ status: 'ok', service: 'sda-order-service', uptime: process.uptime(), timestamp: new Date().toISOString() }))

const PORT = Number(process.env.PORT ?? 3006)
try {
  await app.listen({ port: PORT, host: process.env.HOST ?? '0.0.0.0' })
  app.log.info(`Order Service en puerto ${PORT}`)
} catch (err) { app.log.error(err); process.exit(1) }
