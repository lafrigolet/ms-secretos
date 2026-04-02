import { HttpClient } from './HttpClient.js'

const isStubMode = () => process.env.NODE_ENV !== 'production'

export class NotificationClient {
  constructor () {
    this.http = new HttpClient(
      process.env.NOTIFICATION_SERVICE_URL ?? 'http://notification-service:3007',
      { timeout: 3000 }
    )
  }

  orderConfirmed (order, user) {
    if (isStubMode()) {
      console.log(`[stub] NotificationClient.orderConfirmed(orderId:${order?.orderId})`)
      return
    }
    this.http.post('/notifications/order-confirmed', { order, user })
      .catch(() => {})
  }
}
