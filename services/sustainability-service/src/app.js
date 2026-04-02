import 'dotenv/config'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { sustainabilityRoutes }   from './routes/sustainability.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler }           from './middleware/errorHandler.js'

const app = Fastify({
  logger: {
    level: 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined
  }
})

await app.register(corsPlugin, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? (process.env.NODE_ENV === 'production' ? false : true)
})
await app.register(jwtPlugin, { secret: process.env.JWT_SECRET })
await app.register(swaggerPlugin, {
  openapi: {
    info: {
      title: 'Secretos del Agua — Sustainability Service',
      description: 'Origen, ingredientes, huella de carbono y agrupación de pedidos (HU-53 a HU-55)',
      version: '1.0.0'
    },
    tags: [
      { name: 'sustainability', description: 'Sostenibilidad y trazabilidad' },
      { name: 'health',         description: 'Estado del servicio' }
    ],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }
    }
  }
})
await app.register(swaggerUiPlugin, { routePrefix: '/docs' })

registerAuthDecorators(app)
app.setErrorHandler(errorHandler)

await app.register(sustainabilityRoutes, { prefix: '/sustainability' })

app.get('/health', async () => ({
  status: 'ok',
  service: 'sda-sustainability-service',
  uptime: process.uptime(),
  timestamp: new Date().toISOString()
}))

const PORT = Number(process.env.PORT ?? 3016)
try {
  await app.listen({ port: PORT, host: process.env.HOST ?? '0.0.0.0' })
  app.log.info(`Sustainability Service en puerto ${PORT}`)
} catch (err) { app.log.error(err); process.exit(1) }
