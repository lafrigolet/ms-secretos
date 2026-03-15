import { api } from './client.js'

export const profileApi = {
  getMe:           ()                    => api.get('/profile/me'),
  getAll:          ()                    => api.get('/profile/'),
  getProfile:      (sapCode)             => api.get(`/profile/${sapCode}`),
  updateProfile:   (sapCode, profile)    => api.patch(`/profile/${sapCode}`, { profile }),
  checkPermission: (sapCode, permission) => api.post('/profile/check-permission', { sapCode, permission }),
}
