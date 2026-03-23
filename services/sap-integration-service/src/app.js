import 'dotenv/config'
import Fastify from 'fastify'
import corsPlugin from '@fastify/cors'
import swaggerPlugin from '@fastify/swagger'
import swaggerUiPlugin from '@fastify/swagger-ui'

import { SapService } from './services/SapService.js'
import { customerRoutes } from './routes/customers.js'
import { catalogRoutes } from './routes/catalog.js'
import { orderRoutes }   from './routes/orders.js'
import { returnsRoutes } from './routes/returns.js'
import { healthRoutes } from './routes/health.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined
  }
})

// ── Plugins ───────────────────────────────────────────────────────
await app.register(corsPlugin, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? true
})

await app.register(swaggerPlugin, {
  openapi: {
    info: {
      title: 'Secretos del Agua — SAP Integration Service',
      description: `Adaptador entre los microservicios y SAP.\nModo actual: **${process.env.SAP_MODE ?? 'stub'}**`,
      version: '1.0.0'
    },
    tags: [
      { name: 'customers', description: 'Clientes y autenticación' },
      { name: 'catalog',   description: 'Productos, precios y stock' },
      { name: 'orders',    description: 'Pedidos y facturas' },
      { name: 'health',    description: 'Estado del servicio y caché' }
    ]
  }
})

await app.register(swaggerUiPlugin, { routePrefix: '/docs' })

// ── SAP Service (singleton compartido entre rutas) ────────────────
const sapService = new SapService(app.log)
app.decorate('sap', sapService)

// ── Error handler ─────────────────────────────────────────────────
app.setErrorHandler(errorHandler)

// ── Rutas ─────────────────────────────────────────────────────────
await app.register(customerRoutes, { prefix: '/internal/customers' })
await app.register(catalogRoutes,  { prefix: '/internal/catalog' })
await app.register(orderRoutes,    { prefix: '/internal/orders' })
await app.register(returnsRoutes,  { prefix: '/internal/returns' })
await app.register(healthRoutes,   { prefix: '/health' })

// ── Arranque ──────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3010)
const HOST = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port: PORT, host: HOST })
  app.log.info(`SAP Integration Service escuchando en ${HOST}:${PORT}`)
  app.log.info(`Modo: ${process.env.SAP_MODE ?? 'stub'}`)
  app.log.info(`Documentación: http://localhost:${PORT}/docs`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
