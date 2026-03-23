import { SapIntegrationClient } from '../clients/SapIntegrationClient.js'

const sap = new SapIntegrationClient()

// Productos conocidos del catálogo (en producción vendría del catalog-service)
const KNOWN_PRODUCTS = ['P-RT-001', 'P-RT-002', 'P-RT-003', 'P-SN-001', 'P-BN-001']

// Umbrales de beneficios del promotions-service (en producción se consultaría)
const BENEFIT_THRESHOLDS = [
  { threshold: 100,  label: 'Muestra gratis',          type: 'SAMPLE' },
  { threshold: 200,  label: 'Envío prioritario',        type: 'SHIPPING' },
  { threshold: 350,  label: 'Tester exclusivo',          type: 'GIFT' },
  { threshold: 500,  label: 'Descuento 10% próx. pedido', type: 'DISCOUNT' },
]

/**
 * Divide los pedidos en periodo actual y anterior según días de ventana.
 */
function splitByPeriod (orders, windowDays = 90) {
  const now      = new Date()
  const cutCurrent  = new Date(now); cutCurrent.setDate(now.getDate() - windowDays)
  const cutPrevious = new Date(now); cutPrevious.setDate(now.getDate() - windowDays * 2)

  const current  = orders.filter(o => new Date(o.date) >= cutCurrent)
  const previous = orders.filter(o => new Date(o.date) >= cutPrevious && new Date(o.date) < cutCurrent)
  return { current, previous }
}

/**
 * Rutas de inteligencia comercial — HU-40, HU-41, HU-42, HU-43
 */
export async function intelligenceRoutes (fastify) {

  // ── HU-40 — Comparativa de compras vs periodo anterior ────────
  fastify.get('/comparison', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Comparativa de volumen de compra vs periodo anterior (HU-40)',
      tags: ['intelligence'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          windowDays: { type: 'integer', minimum: 30, maximum: 365, default: 90 }
        }
      }
    }
  }, async (request, reply) => {
    const sapCode    = request.user.sub
    const windowDays = request.query.windowDays ?? 90
    const orders     = await sap.getOrders(sapCode)
    const { current, previous } = splitByPeriod(orders, windowDays)

    const currentTotal  = current.reduce((s, o)  => s + o.total, 0)
    const previousTotal = previous.reduce((s, o) => s + o.total, 0)
    const currentOrders  = current.length
    const previousOrders = previous.length

    const totalChange  = previousTotal  > 0 ? ((currentTotal  - previousTotal)  / previousTotal)  * 100 : null
    const ordersChange = previousOrders > 0 ? ((currentOrders - previousOrders) / previousOrders) * 100 : null

    // Productos más comprados en cada periodo
    const topProductsCurrent = topProducts(current)
    const topProductsPrevious = topProducts(previous)

    return reply.send({
      windowDays,
      current:  { total: +currentTotal.toFixed(2),  orders: currentOrders,  topProducts: topProductsCurrent },
      previous: { total: +previousTotal.toFixed(2), orders: previousOrders, topProducts: topProductsPrevious },
      changes: {
        totalAmount:  totalChange  != null ? +totalChange.toFixed(1)  : null,
        totalOrders:  ordersChange != null ? +ordersChange.toFixed(1) : null,
        trend: totalChange == null ? 'NO_DATA' : totalChange > 0 ? 'UP' : totalChange < 0 ? 'DOWN' : 'FLAT'
      }
    })
  })

  // ── HU-41 — Alertas de productos no pedidos recientemente ─────
  fastify.get('/alerts/inactive-products', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Productos que el cliente solía pedir y lleva X semanas sin repostar (HU-41)',
      tags: ['intelligence'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          weeksThreshold: { type: 'integer', minimum: 1, maximum: 52, default: 8 }
        }
      }
    }
  }, async (request, reply) => {
    const sapCode        = request.user.sub
    const weeksThreshold = request.query.weeksThreshold ?? 8
    const orders         = await sap.getOrders(sapCode)

    if (orders.length === 0) return reply.send({ alerts: [], weeksThreshold })

    // Fecha de corte: productos no pedidos desde hace X semanas
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - weeksThreshold * 7)

    // Todos los productos pedidos históricamente
    const productHistory = {}
    for (const order of orders) {
      for (const item of order.items ?? []) {
        if (!productHistory[item.productCode]) {
          productHistory[item.productCode] = { ...item, lastOrderDate: order.date, orderCount: 0 }
        }
        if (new Date(order.date) > new Date(productHistory[item.productCode].lastOrderDate)) {
          productHistory[item.productCode].lastOrderDate = order.date
        }
        productHistory[item.productCode].orderCount++
      }
    }

    // Productos con historial pero sin pedido reciente
    const alerts = Object.values(productHistory)
      .filter(p => p.orderCount >= 2 && new Date(p.lastOrderDate) < cutoff)
      .map(p => ({
        productCode:   p.productCode,
        name:          p.name,
        lastOrderDate: p.lastOrderDate,
        weeksSince:    Math.round((Date.now() - new Date(p.lastOrderDate)) / (7 * 24 * 3600 * 1000)),
        orderCount:    p.orderCount
      }))
      .sort((a, b) => b.weeksSince - a.weeksSince)

    return reply.send({ alerts, weeksThreshold })
  })

  // ── HU-42 — Progreso hacia el siguiente umbral de beneficios ──
  fastify.get('/thresholds', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Progreso hacia el siguiente umbral de beneficios (HU-42)',
      tags: ['intelligence'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const sapCode = request.user.sub
    const orders  = await sap.getOrders(sapCode)
    const { current } = splitByPeriod(orders, 30) // ventana de 30 días
    const currentSpend = current.reduce((s, o) => s + o.total, 0)

    const reached = BENEFIT_THRESHOLDS.filter(t => currentSpend >= t.threshold)
    const next    = BENEFIT_THRESHOLDS.find(t => currentSpend < t.threshold) ?? null

    return reply.send({
      currentPeriodSpend: +currentSpend.toFixed(2),
      periodDays: 30,
      reached,
      next: next ? {
        ...next,
        remaining:   +(next.threshold - currentSpend).toFixed(2),
        progressPct: +((currentSpend / next.threshold) * 100).toFixed(1)
      } : null,
      allThresholds: BENEFIT_THRESHOLDS.map(t => ({
        ...t,
        reached:     currentSpend >= t.threshold,
        remaining:   Math.max(0, +(t.threshold - currentSpend).toFixed(2)),
        progressPct: +Math.min(100, (currentSpend / t.threshold) * 100).toFixed(1)
      }))
    })
  })

  // ── HU-43 — Resumen de beneficios acumulados ─────────────────
  fastify.get('/benefits-summary', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Resumen de regalos, muestras y descuentos obtenidos en el periodo (HU-43)',
      tags: ['intelligence'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          months: { type: 'integer', minimum: 1, maximum: 24, default: 6 }
        }
      }
    }
  }, async (request, reply) => {
    const sapCode = request.user.sub
    const months  = request.query.months ?? 6
    const benefits = await sap.getBenefits(sapCode)

    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)

    const filtered = benefits.filter(b => new Date(b.date) >= cutoff)
    const byType   = filtered.reduce((acc, b) => {
      const type = b.benefit?.type ?? 'OTHER'
      if (!acc[type]) acc[type] = { count: 0, items: [] }
      acc[type].count++
      acc[type].items.push(b)
      return acc
    }, {})

    return reply.send({
      months,
      totalBenefits: filtered.length,
      byType,
      timeline: filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
    })
  })
}

// ── Helpers ───────────────────────────────────────────────────────
function topProducts (orders, limit = 3) {
  const counts = {}
  for (const order of orders) {
    for (const item of order.items ?? []) {
      if (!counts[item.productCode]) counts[item.productCode] = { ...item, totalQty: 0 }
      counts[item.productCode].totalQty += item.quantity
    }
  }
  return Object.values(counts)
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, limit)
    .map(p => ({ productCode: p.productCode, name: p.name, totalQty: p.totalQty }))
}
