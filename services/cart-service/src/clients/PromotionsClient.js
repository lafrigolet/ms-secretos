import { HttpClient } from './HttpClient.js'

/**
 * PromotionsClient — cart-service
 * Calcula beneficios aplicables al pedido actual
 * llamando al promotions-service.
 */
export class PromotionsClient {
  constructor () {
    this.http = new HttpClient(
      process.env.PROMOTIONS_SERVICE_URL ?? 'http://promotions-service:3004',
      { timeout: 3000 }  // timeout más bajo — si no responde, continuamos sin beneficios
    )
  }

  /**
   * Calcula los beneficios aplicables para un pedido.
   * Devuelve un array vacío si el servicio no está disponible,
   * para no bloquear el flujo de la cesta.
   */
  async calculateBenefits (items, orderTotal, token) {
    try {
      const result = await this.http.post(
        '/promotions/calculate',
        { items, orderTotal },
        { token }
      )
      return result?.benefits ?? []
    } catch {
      // Degradación elegante: si promotions-service no responde,
      // devolvemos array vacío sin romper el carrito
      return []
    }
  }
}
