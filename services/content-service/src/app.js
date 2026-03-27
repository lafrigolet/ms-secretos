import 'dotenv/config'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'
import { contentRoutes }      from './routes/content.js'
import { adminContentRoutes } from './routes/admin.js'
import { registerAuthDecorators } from './middleware/authenticate.js'
import { errorHandler }       from './middleware/errorHandler.js'

const app = Fastify({
  logger: {
    level: 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined
  }
})

await app.register(corsPlugin)
await app.register(jwtPlugin, { secret: process.env.JWT_SECRET })
await app.register(swaggerPlugin, {
  openapi: {
    info: {
      title: 'Secretos del Agua — Content Service',
      description: 'Fichas técnicas, vídeos formativos y novedades (HU-36 a HU-39)',
      version: '1.0.0'
    },
    tags: [
      { name: 'content',       description: 'Contenido — vista cliente' },
      { name: 'admin-content', description: 'Contenido — gestión admin' },
      { name: 'health',        description: 'Estado del servicio' }
    ],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }
    }
  }
})
await app.register(swaggerUiPlugin, { routePrefix: '/docs' })

registerAuthDecorators(app)
app.setErrorHandler(errorHandler)

await app.register(contentRoutes,      { prefix: '/content' })
await app.register(adminContentRoutes, { prefix: '/admin/content' })

app.get('/health', async () => ({
  status: 'ok',
  service: 'sda-content-service',
  uptime: process.uptime(),
  timestamp: new Date().toISOString()
}))

const PORT = Number(process.env.PORT ?? 3012)
try {
  await app.listen({ port: PORT, host: process.env.HOST ?? '0.0.0.0' })
  app.log.info(`Content Service en puerto ${PORT}`)
} catch (err) { app.log.error(err); process.exit(1) }
