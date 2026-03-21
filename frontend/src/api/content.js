import { api } from './client.js'

export const contentApi = {
  // HU-36 — Fichas técnicas
  getDatasheets:  (params) => api.get(`/content/datasheets${params ? `?${new URLSearchParams(params)}` : ''}`),
  getDatasheet:   (id)     => api.get(`/content/datasheets/${id}`),

  // HU-37 — Vídeos
  getVideos:      (params) => api.get(`/content/videos${params ? `?${new URLSearchParams(params)}` : ''}`),
  getVideo:       (id)     => api.get(`/content/videos/${id}`),

  // HU-38 — Novedades
  getNews:        (featured) => api.get(`/content/news${featured ? '?featured=true' : ''}`),
  getNewsItem:    (id)       => api.get(`/content/news/${id}`),

  // HU-39 — Admin
  adminGetDatasheets: ()          => api.get('/admin/content/datasheets'),
  adminCreateDatasheet: (data)    => api.post('/admin/content/datasheets', data),
  adminUpdateDatasheet: (id, data)=> api.patch(`/admin/content/datasheets/${id}`, data),

  adminGetVideos: ()              => api.get('/admin/content/videos'),
  adminCreateVideo: (data)        => api.post('/admin/content/videos', data),
  adminUpdateVideo: (id, data)    => api.patch(`/admin/content/videos/${id}`, data),

  adminGetNews: ()                => api.get('/admin/content/news'),
  adminCreateNews: (data)         => api.post('/admin/content/news', data),
  adminUpdateNews: (id, data)     => api.patch(`/admin/content/news/${id}`, data),
}
