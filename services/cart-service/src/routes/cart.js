import { SapClient } from '../services/SapClient.js'

const sap = new SapClient()

// Cestas en memoria por usuario (en producción usaría Redis)
const CARTS = new Map()

const SHIPPING_THRESHOLD = 150  // envío gratis a partir de este importe
const SHIPPING_COST = 8.50

function getCart (sapCode) {
  if (!CARTS.has(sapCode)) CARTS.set(sapCode, { items: [] })
  return CARTS.get(sapCode)
}

function calculateTotals (items, benefits = []) {
  const subtotal = items.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0)
  const discounts = benefits
    .filter(b => b.benefit.type === 'DISCOUNT')
    .reduce((sum, b) => {
      if (b.benefit.unit === 'PERCENT') return sum + (subtotal * b.benefit.value / 100)
      return sum + b.benefit.value
    }, 0)
  const shipping = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
  const total = subtotal - discounts + shipping
  return { subtotal: +subtotal.toFixed(2), discounts: +discounts.toFixed(2), shipping, total: +total.toFixed(2) }
}

export async function cartRoutes (fastify) {

  // HU-14 — Ver cesta
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Obtiene la cesta del cliente (HU-14)', tags: ['cart'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const cart = getCart(request.user.sub)
    const totals = calculateTotals(cart.items)
    return reply.send({ ...cart, ...totals, shippingThreshold: SHIPPING_THRESHOLD })
  })

  // HU-14 — Añadir producto a la cesta
  fastify.post('/items', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Añade un producto a la cesta (HU-14)',
      tags: ['cart'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['productCode', 'quantity', 'unitPrice'],
        properties: {
          productCode: { type: 'string' },
          name:        { type: 'string' },
          quantity:    { type: 'integer', minimum: 1 },
          unitPrice:   { type: 'number', minimum: 0 }
        }
      }
    }
  }, async (request, reply) => {
    const cart = getCart(request.user.sub)
    const { productCode, quantity, unitPrice, name } = request.body

    const existing = cart.items.find(i => i.productCode === productCode)
    if (existing) {
      existing.quantity += quantity
    } else {
      cart.items.push({ productCode, name, quantity, unitPrice })
    }

    return reply.status(201).send({ ...cart, ...calculateTotals(cart.items) })
  })

  // HU-14 — Modificar cantidad de un producto
  fastify.patch('/items/:productCode', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Modifica la cantidad de un producto en la cesta (HU-14)',
      tags: ['cart'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['quantity'],
        properties: { quantity: { type: 'integer', minimum: 0 } }
      }
    }
  }, async (request, reply) => {
    const cart = getCart(request.user.sub)
    const { productCode } = request.params
    const { quantity } = request.body

    if (quantity === 0) {
      cart.items = cart.items.filter(i => i.productCode !== productCode)
    } else {
      const item = cart.items.find(i => i.productCode === productCode)
      if (!item) return reply.status(404).send({ error: 'ITEM_NOT_FOUND', message: 'Producto no encontrado en la cesta' })
      item.quantity = quantity
    }

    return reply.send({ ...cart, ...calculateTotals(cart.items) })
  })

  // HU-14 — Eliminar producto de la cesta
  fastify.delete('/items/:productCode', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Elimina un producto de la cesta (HU-14)', tags: ['cart'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const cart = getCart(request.user.sub)
    cart.items = cart.items.filter(i => i.productCode !== request.params.productCode)
    return reply.send({ ...cart, ...calculateTotals(cart.items) })
  })

  // HU-14 — Vaciar cesta
  fastify.delete('/', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Vacía la cesta completa (HU-14)', tags: ['cart'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    CARTS.set(request.user.sub, { items: [] })
    return reply.send({ items: [], subtotal: 0, discounts: 0, shipping: 0, total: 0 })
  })

  // HU-15 — Resumen con gastos de envío y beneficios
  fastify.get('/summary', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Resumen del pedido con totales, envío y beneficios aplicables (HU-15, HU-16)',
      tags: ['cart'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const cart = getCart(request.user.sub)
    const totals = calculateTotals(cart.items)

    // Consultar beneficios al promotions-service
    let benefits = []
    try {
      const promoUrl = process.env.PROMOTIONS_SERVICE_URL ?? 'http://promotions-service:3004'
      const token = request.headers.authorization
      const res = await fetch(`${promoUrl}/promotions/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ items: cart.items, orderTotal: totals.subtotal }),
        signal: AbortSignal.timeout(3000)
      })
      if (res.ok) benefits = (await res.json()).benefits ?? []
    } catch {
      // Si promotions-service no está disponible, continuamos sin beneficios
    }

    return reply.send({
      items: cart.items,
      ...totals,
      benefits,
      shippingThreshold: SHIPPING_THRESHOLD,
      freeShippingRemaining: Math.max(0, SHIPPING_THRESHOLD - totals.subtotal)
    })
  })
}
