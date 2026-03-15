import { api } from './client.js'

export const promotionsApi = {
  getActive:     ()                         => api.get('/promotions/'),
  calculate:     (items, orderTotal)        => api.post('/promotions/calculate', { items, orderTotal }),
  getAll:        ()                         => api.get('/promotions/admin'),
  create:        (promo)                    => api.post('/promotions/admin', promo),
  update:        (id, data)                 => api.patch(`/promotions/admin/${id}`, data),
  toggle:        (id)                       => api.patch(`/promotions/admin/${id}/toggle`, {}),
}
