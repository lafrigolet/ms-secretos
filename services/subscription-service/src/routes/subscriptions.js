import { PLANS, getPlan } from '../data/plans.js'
import {
  getSubscription, createSubscription, updateSubscription,
  getBillingHistory, addBillingRecord, getAllSubscriptions
} from '../data/subscriptionStore.js'
import { PaymentClient } from '../clients/PaymentClient.js'

const paymentClient = new PaymentClient()

export async function subscriptionRoutes (fastify) {
  // ── GET /subscriptions/plans ──────────────────────────────────────
  fastify.get('/plans', {
    schema: {
      tags: ['subscriptions'],
      summary: 'List available subscription plans',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              price: { type: 'number' },
              currency: { type: 'string' },
              interval: { type: 'string' },
              features: { type: 'array', items: { type: 'string' } },
              active: { type: 'boolean' }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    return reply.send(PLANS.filter(p => p.active))
  })

  // ── GET /subscriptions/me ─────────────────────────────────────────
  fastify.get('/me', {
    schema: {
      tags: ['subscriptions'],
      summary: 'Get current subscription',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const sub = getSubscription(request.user.sub)
    if (!sub) return reply.status(404).send({ error: 'NOT_FOUND', message: 'No active subscription found' })
    return reply.send(sub)
  })

  // ── POST /subscriptions ───────────────────────────────────────────
  fastify.post('/', {
    schema: {
      tags: ['subscriptions'],
      summary: 'Subscribe to a plan',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['planId'],
        properties: {
          planId: { type: 'string' },
          paymentMethod: { type: 'string' }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { planId, paymentMethod } = request.body
    const plan = getPlan(planId)
    if (!plan) return reply.status(404).send({ error: 'PLAN_NOT_FOUND', message: 'Plan not found' })

    const existing = getSubscription(request.user.sub)
    if (existing && existing.status === 'ACTIVE') {
      return reply.status(409).send({ error: 'ALREADY_SUBSCRIBED', message: 'Customer already has an active subscription' })
    }

    await paymentClient.charge({
      sapCode: request.user.sub,
      amount: plan.price,
      currency: plan.currency,
      planId,
      paymentMethod
    })

    const sub = createSubscription({ sapCode: request.user.sub, planId, paymentMethod })

    addBillingRecord({
      subscriptionId: sub.id,
      sapCode: request.user.sub,
      amount: plan.price,
      currency: plan.currency,
      period: { start: sub.currentPeriodStart, end: sub.currentPeriodEnd }
    })

    return reply.status(201).send(sub)
  })

  // ── PATCH /subscriptions/me ───────────────────────────────────────
  fastify.patch('/me', {
    schema: {
      tags: ['subscriptions'],
      summary: 'Upgrade or downgrade plan',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['planId'],
        properties: {
          planId: { type: 'string' }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const sub = getSubscription(request.user.sub)
    if (!sub) return reply.status(404).send({ error: 'NOT_FOUND', message: 'No active subscription found' })

    const plan = getPlan(request.body.planId)
    if (!plan) return reply.status(404).send({ error: 'PLAN_NOT_FOUND', message: 'Plan not found' })

    const updated = updateSubscription(request.user.sub, { planId: request.body.planId })
    return reply.send(updated)
  })

  // ── DELETE /subscriptions/me ──────────────────────────────────────
  fastify.delete('/me', {
    schema: {
      tags: ['subscriptions'],
      summary: 'Cancel subscription at period end',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const sub = getSubscription(request.user.sub)
    if (!sub) return reply.status(404).send({ error: 'NOT_FOUND', message: 'No active subscription found' })

    const updated = updateSubscription(request.user.sub, {
      status: 'CANCELLED',
      cancelAtPeriodEnd: true
    })
    return reply.send(updated)
  })

  // ── GET /subscriptions/me/billing ────────────────────────────────
  fastify.get('/me/billing', {
    schema: {
      tags: ['subscriptions'],
      summary: 'Get billing history',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const records = getBillingHistory(request.user.sub)
    return reply.send(records)
  })

  // ── POST /subscriptions/me/payment-method ────────────────────────
  fastify.post('/me/payment-method', {
    schema: {
      tags: ['subscriptions'],
      summary: 'Add or update payment method',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['paymentMethod'],
        properties: {
          paymentMethod: { type: 'string' }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const sub = getSubscription(request.user.sub)
    if (!sub) return reply.status(404).send({ error: 'NOT_FOUND', message: 'No active subscription found' })

    const updated = updateSubscription(request.user.sub, { paymentMethod: request.body.paymentMethod })
    return reply.send(updated)
  })

  // ── GET /subscriptions/admin ──────────────────────────────────────
  fastify.get('/admin', {
    schema: {
      tags: ['subscriptions-admin'],
      summary: 'List all subscriptions (admin)',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin]
  }, async (request, reply) => {
    return reply.send(getAllSubscriptions())
  })

  // ── GET /subscriptions/admin/:sapCode ────────────────────────────
  fastify.get('/admin/:sapCode', {
    schema: {
      tags: ['subscriptions-admin'],
      summary: 'Get subscription for a specific customer (admin)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['sapCode'],
        properties: { sapCode: { type: 'string' } }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin]
  }, async (request, reply) => {
    const sub = getSubscription(request.params.sapCode)
    if (!sub) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Subscription not found' })
    return reply.send(sub)
  })

  // ── PATCH /subscriptions/admin/:sapCode ──────────────────────────
  fastify.patch('/admin/:sapCode', {
    schema: {
      tags: ['subscriptions-admin'],
      summary: 'Override subscription for a customer (admin)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['sapCode'],
        properties: { sapCode: { type: 'string' } }
      },
      body: {
        type: 'object',
        properties: {
          planId: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'TRIALING', 'CANCELLED', 'PAST_DUE'] }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin]
  }, async (request, reply) => {
    const { sapCode } = request.params
    let sub = getSubscription(sapCode)

    if (!sub) {
      if (!request.body.planId) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'planId is required to create a subscription for a new customer' })
      }
      sub = createSubscription({ sapCode, planId: request.body.planId })
    }

    const updated = updateSubscription(sapCode, request.body)
    return reply.send(updated)
  })
}
