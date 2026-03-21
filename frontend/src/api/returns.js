import { api } from './client.js'

export const returnsApi = {
  getReasons:    ()                              => api.get('/returns/reasons', { auth: false }),
  getMyReturns:  ()                              => api.get('/returns/'),
  getReturn:     (id)                            => api.get(`/returns/${id}`),
  createReturn:  (orderId, reason, notes, items) => api.post('/returns/', { orderId, reason, notes, items }),

  // Admin
  getAllReturns:  (status)                        => api.get(`/admin/returns${status ? `?status=${status}` : ''}`),
  updateReturn:  (id, status, adminNotes)        => api.patch(`/admin/returns/${id}`, { status, adminNotes }),
  generateCredit:(id)                            => api.post(`/admin/returns/${id}/credit-note`, {}),
}
