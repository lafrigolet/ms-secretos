import { api } from './client.js'

export const subscriptionsApi = {
  getPlans:          ()                   => api.get('/subscriptions/plans'),
  getMySubscription: ()                   => api.get('/subscriptions/me'),
  subscribe:         (planId, paymentMethod) => api.post('/subscriptions', { planId, paymentMethod }),
  changePlan:        (planId)             => api.patch('/subscriptions/me', { planId }),
  cancel:            ()                   => api.delete('/subscriptions/me'),
  getBillingHistory: ()                   => api.get('/subscriptions/me/billing'),
  updatePaymentMethod: (paymentMethod)    => api.post('/subscriptions/me/payment-method', { paymentMethod }),

  // Admin
  getAllSubscriptions:  ()          => api.get('/subscriptions/admin'),
  getSubscription:     (sapCode)   => api.get(`/subscriptions/admin/${sapCode}`),
  overrideSubscription:(sapCode, data) => api.patch(`/subscriptions/admin/${sapCode}`, data),
}
