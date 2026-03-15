import { api } from './client.js'

export const ordersApi = {
  getOrders:   ()          => api.get('/orders/'),
  getOrder:    (orderId)   => api.get(`/orders/${orderId}`),
  createOrder: (items)     => api.post('/orders/', { items }),
  repeatOrder: (orderId)   => api.post(`/orders/${orderId}/repeat`, {}),
}
