import { HttpClient } from './HttpClient.js'

const isStubMode = () => process.env.NODE_ENV === 'test'

/**
 * PromotionsClient — cart-service
 * Calcula beneficios aplicables al pedido actual.
 * En modo STUB devuelve un ejemplo cuando el total >= 100.
 */
export class PromotionsClient {
  constructor () {
    this.http = new HttpClient(
      process.env.PROMOTIONS_SERVICE_URL ?? 'http://promotions-service:3004',
      { timeout: 3000 }
    )
  }

  async calculateBenefits (items, orderTotal, token) {
    if (isStubMode()) {
      console.log(`[stub] PromotionsClient.calculateBenefits(total:${orderTotal})`)
      if (orderTotal >= 100) {
        return [{ type: 'GIFT', description: 'Muestra Sérum Raíces 15ml', promoName: 'Promo Otoño' }]
      }
      return []
    }
    try {
      const result = await this.http.post(
        '/promotions/calculate',
        { items, orderTotal },
        { token }
      )
      return result?.benefits ?? []
    } catch {
      return []
    }
  }
}
