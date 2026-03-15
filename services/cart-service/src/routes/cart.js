import { PromotionsClient } from '../clients/PromotionsClient.js'

const promotions = new PromotionsClient()

const CARTS = new Map()
const SHIPPING_THRESHOLD = 150
const SHIPPING_COST = 8.50

function getCart (sapCode) {
  if (!CARTS.has(sapCode)) CARTS.set(sapCode, { items: [] })
  return CARTS.get(sapCode)
}

function calculateTotals (items) {
  const subtotal = items.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0)
  const shipping = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
  return { subtotal: +subtotal.toFixed(2), shipping, total: +(subtotal + shipping).toFixed(2) }
}

export async function cartRoutes (fastify) {

  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Obtiene la cesta del cliente (HU-14)', tags: ['cart'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const cart = getCart(request.user.sub)
    return reply.send({ ...cart, ...calculateTotals(cart.items), shippingThreshold: SHIPPING_THRESHOLD })
  })

  fastify.post('/items', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Añade un producto a la cesta (HU-14)', tags: ['cart'], security: [{ bearerAuth: [] }],
      body: { type: 'object', required: ['productCode', 'quantity', 'unitPrice'], properties: { productCode: { type: 'string' }, name: { type: 'string' }, quantity: { type: 'integer', minimum: 1 }, unitPrice: { type: 'number', minimum: 0 } } }
    }
  }, async (request, reply) => {
    const cart = getCart(request.user.sub)
    const { productCode, quantity, unitPrice, name } = request.body
    const existing = cart.items.find(i => i.productCode === productCode)
    if (existing) { existing.quantity += quantity } else { cart.items.push({ productCode, name, quantity, unitPrice }) }
    return reply.status(201).send({ ...cart, ...calculateTotals(cart.items) })
  })

  fastify.patch('/items/:productCode', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Modifica la cantidad de un producto (HU-14)', tags: ['cart'], security: [{ bearerAuth: [] }],
      body: { type: 'object', required: ['quantity'], properties: { quantity: { type: 'integer', minimum: 0 } } }
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

  fastify.delete('/items/:productCode', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Elimina un producto de la cesta (HU-14)', tags: ['cart'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const cart = getCart(request.user.sub)
    cart.items = cart.items.filter(i => i.productCode !== request.params.productCode)
    return reply.send({ ...cart, ...calculateTotals(cart.items) })
  })

  fastify.delete('/', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Vacía la cesta (HU-14)', tags: ['cart'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    CARTS.set(request.user.sub, { items: [] })
    return reply.send({ items: [], subtotal: 0, shipping: 0, total: 0 })
  })

  fastify.get('/summary', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Resumen con totales, envío y beneficios (HU-15, HU-16)', tags: ['cart'], security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const cart = getCart(request.user.sub)
    const totals = calculateTotals(cart.items)
    const token = request.headers.authorization?.replace('Bearer ', '')
    const benefits = await promotions.calculateBenefits(cart.items, totals.subtotal, token)
    return reply.send({
      items: cart.items, ...totals, benefits,
      shippingThreshold: SHIPPING_THRESHOLD,
      freeShippingRemaining: Math.max(0, SHIPPING_THRESHOLD - totals.subtotal)
    })
  })
}
