import { api } from './client.js'

export const cartApi = {
  getCart:       ()                                          => api.get('/cart/'),
  getSummary:    ()                                          => api.get('/cart/summary'),
  addItem:       (productCode, name, quantity, unitPrice)    => api.post('/cart/items', { productCode, name, quantity, unitPrice }),
  updateItem:    (productCode, quantity)                     => api.patch(`/cart/items/${productCode}`, { quantity }),
  removeItem:    (productCode)                               => api.delete(`/cart/items/${productCode}`),
  clearCart:     ()                                          => api.delete('/cart/'),
}
