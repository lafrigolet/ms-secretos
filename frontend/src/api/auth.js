import { api } from './client.js'

export const authApi = {
  login:  (sapCode, password) => api.post('/auth/login', { sapCode, password }, { auth: false }),
  me:     ()                  => api.get('/auth/me'),
  logout: ()                  => api.post('/auth/logout', {}),
  verify: (token)             => api.post('/auth/verify', { token }, { auth: false }),
}
