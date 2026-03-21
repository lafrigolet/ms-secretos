import { api } from './client.js'

export const commercialApi = {
  // HU-44 — cliente
  getMyCommercial:      ()              => api.get('/commercial/my-commercial'),
  // HU-45 — cliente
  getSuggestedOrders:   ()              => api.get('/commercial/suggested-orders'),
  respondSuggested:     (id, status)    => api.patch(`/commercial/suggested-orders/${id}/respond`, { status }),
  // HU-45 — comercial
  createSuggested:      (data)          => api.post('/commercial/suggested-orders', data),
  // HU-46 — comercial
  getPortfolio:         ()              => api.get('/commercial/portfolio'),
  getPortfolioOrders:   (sapCode)       => api.get(`/commercial/portfolio/${sapCode}/orders`),
  // HU-47 — admin
  getCommercials:       ()              => api.get('/commercial/commercials'),
  getAssignments:       ()              => api.get('/commercial/assignments'),
  assignCommercial:     (sapCode, commercialId) => api.patch(`/commercial/assignments/${sapCode}`, { commercialId }),
}
