import { api } from './client.js'

export const catalogApi = {
  getFamilies:       ()           => api.get('/catalog/families'),
  getProducts:       (familyId)   => api.get(`/catalog/products${familyId ? `?familyId=${familyId}` : ''}`),
  getProduct:        (sapCode)    => api.get(`/catalog/products/${sapCode}`),
  getRecommendations:(cartItems)  => api.get(`/catalog/recommendations${cartItems?.length ? `?cartItems=${cartItems.join(',')}` : ''}`),
}
