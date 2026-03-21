import { api } from './client.js'

export const profileApi = {
  getMe:           ()                          => api.get('/profile/me'),
  getAll:          ()                          => api.get('/profile/'),
  getProfile:      (sapCode)                   => api.get(`/profile/${sapCode}`),
  updateProfile:   (sapCode, profile)          => api.patch(`/profile/${sapCode}`, { profile }),
  updateStatus:    (sapCode, status, reason)   => api.patch(`/profile/${sapCode}/status`, { status, ...(reason ? { blockReason: reason } : {}) }),
  checkPermission: (sapCode, permission)       => api.post('/profile/check-permission', { sapCode, permission }),
  search:          (q)                         => api.get(`/profile/search?q=${encodeURIComponent(q)}`),
  filter:          (params)                    => api.get(`/profile/filter?${new URLSearchParams(params)}`),
}
