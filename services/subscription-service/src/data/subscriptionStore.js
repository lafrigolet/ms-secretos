import { randomUUID } from 'node:crypto'

// In-memory stores — module-level, persist across requests within a run
export const SUBSCRIPTIONS = new Map() // sapCode → subscription
export const BILLING_RECORDS = []

export function getSubscription (sapCode) {
  return SUBSCRIPTIONS.get(sapCode) ?? null
}

export function createSubscription ({ sapCode, planId, paymentMethod = null }) {
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const subscription = {
    id: randomUUID(),
    sapCode,
    planId,
    status: 'ACTIVE',
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    cancelAtPeriodEnd: false,
    paymentMethod,
    createdAt: now.toISOString()
  }
  SUBSCRIPTIONS.set(sapCode, subscription)
  return subscription
}

export function updateSubscription (sapCode, updates) {
  const sub = SUBSCRIPTIONS.get(sapCode)
  if (!sub) return null
  const updated = { ...sub, ...updates }
  SUBSCRIPTIONS.set(sapCode, updated)
  return updated
}

export function getBillingHistory (sapCode) {
  return BILLING_RECORDS.filter(r => r.sapCode === sapCode)
}

export function addBillingRecord ({ subscriptionId, sapCode, amount, currency, period }) {
  const record = {
    id: randomUUID(),
    subscriptionId,
    sapCode,
    amount,
    currency,
    status: 'PAID',
    period,
    createdAt: new Date().toISOString()
  }
  BILLING_RECORDS.push(record)
  return record
}

export function getAllSubscriptions () {
  return Array.from(SUBSCRIPTIONS.values())
}
