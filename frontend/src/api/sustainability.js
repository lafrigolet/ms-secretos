import { api } from './client.js'

export const sustainabilityApi = {
  getProducts:          ()                     => api.get('/sustainability/products'),
  getProduct:           (productCode)          => api.get(`/sustainability/products/${productCode}`),
  getCarbonFootprint:   (items, shippingMethod)=> api.post('/sustainability/carbon-footprint', { items, shippingMethod }),
  getGroupingPref:      ()                     => api.get('/sustainability/grouping-preference'),
  updateGroupingPref:   (data)                 => api.patch('/sustainability/grouping-preference', data),
}
