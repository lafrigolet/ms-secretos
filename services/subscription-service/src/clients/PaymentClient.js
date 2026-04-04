/**
 * PaymentClient
 * Adapter for payment processing.
 *
 * Modes:
 *   NODE_ENV=test          → built-in stub (no network, unit tests)
 *   PAYMENT_MODE=stub      → fake successful responses (development default)
 *   PAYMENT_MODE=stripe    → real Stripe API (future)
 */

const isStubMode = () => process.env.NODE_ENV === 'test' || process.env.PAYMENT_MODE !== 'stripe'

function generateId (prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export class PaymentClient {
  async charge ({ sapCode, amount, currency, planId, paymentMethod }) {
    if (isStubMode()) {
      return {
        id: generateId('pay'),
        status: 'SUCCEEDED',
        amount,
        currency,
        sapCode,
        planId,
        paymentMethod: paymentMethod ?? 'stub_card_4242',
        createdAt: new Date().toISOString()
      }
    }
    // Future: Stripe integration
    throw new Error('Stripe mode not yet implemented')
  }

  async refund ({ paymentId, amount, currency }) {
    if (isStubMode()) {
      return {
        id: generateId('ref'),
        paymentId,
        amount,
        currency,
        status: 'REFUNDED',
        createdAt: new Date().toISOString()
      }
    }
    throw new Error('Stripe mode not yet implemented')
  }
}
