import { api } from './client.js'

export const intelligenceApi = {
  getComparison:       (windowDays = 90)       => api.get(`/intelligence/comparison?windowDays=${windowDays}`),
  getInactiveAlerts:   (weeksThreshold = 8)    => api.get(`/intelligence/alerts/inactive-products?weeksThreshold=${weeksThreshold}`),
  getThresholds:       ()                       => api.get('/intelligence/thresholds'),
  getBenefitsSummary:  (months = 6)            => api.get(`/intelligence/benefits-summary?months=${months}`),
}
