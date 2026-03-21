import { api } from './client.js'

export const notifApi = {
  getTypes:          ()                            => api.get('/notifications/types', { auth: false }),
  getPreferences:    ()                            => api.get('/notifications/preferences'),
  updatePreferences: (updates)                     => api.patch('/notifications/preferences', updates),
  getInbox:          ()                            => api.get('/notifications/inbox'),
  markRead:          (id)                          => api.patch(`/notifications/inbox/${id}/read`, {}),
  markAllRead:       ()                            => api.patch('/notifications/inbox/read-all', {}),
  getWatchlist:      ()                            => api.get('/notifications/watchlist'),
  addToWatchlist:    (productCode, productName)    => api.post('/notifications/watchlist', { productCode, productName }),
  removeFromWatchlist: (productCode)               => api.delete(`/notifications/watchlist/${productCode}`),
  getExpiringPromos: (daysAhead = 7)               => api.get(`/notifications/alerts/expiring-promos?daysAhead=${daysAhead}`),
  checkMinOrder:     (cartTotal)                   => api.post('/notifications/alerts/check-min-order', { cartTotal }),
  getBroadcasts:     ()                            => api.get('/notifications/broadcasts'),
  sendBroadcast:     (data)                        => api.post('/notifications/broadcasts', data),
}
