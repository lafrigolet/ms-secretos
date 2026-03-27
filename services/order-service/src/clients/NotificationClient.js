import { HttpClient } from './HttpClient.js'

const STUB_MODE = process.env.NODE_ENV !== 'production'
const isDev = STUB_MODE

export class NotificationClient {
  constructor () {
    this.http = new HttpClient(
      process.env.NOTIFICATION_SERVICE_URL ?? 'http://notification-service:3007',
      { timeout: 3000 }
    )
  }

  orderConfirmed (order, user) {
    if (STUB_MODE) {
      if (isDev) console.log(`[stub] NotificationClient.orderConfirmed(orderId:${order?.orderId})`)
      return
    }
    this.http.post('/notifications/order-confirmed', { order, user })
      .catch(() => {})
  }
}
