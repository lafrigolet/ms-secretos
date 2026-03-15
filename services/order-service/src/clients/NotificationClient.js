import { HttpClient } from './HttpClient.js'

/**
 * NotificationClient — order-service
 * Dispara notificaciones al notification-service de forma asíncrona.
 * Los errores se ignoran deliberadamente para no bloquear la confirmación del pedido.
 */
export class NotificationClient {
  constructor () {
    this.http = new HttpClient(
      process.env.NOTIFICATION_SERVICE_URL ?? 'http://notification-service:3007',
      { timeout: 3000 }
    )
  }

  /**
   * Notifica la confirmación de un pedido.
   * Fire-and-forget: no esperamos la respuesta ni propagamos errores.
   */
  orderConfirmed (order, user) {
    this.http.post('/notifications/order-confirmed', { order, user })
      .catch(() => {}) // intencional — no bloquear el flujo del pedido
  }
}
