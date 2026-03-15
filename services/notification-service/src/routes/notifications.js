// Registro en memoria de notificaciones enviadas (en producción: cola de mensajes o BD)
const SENT = []

/**
 * En producción este servicio usaría nodemailer, SendGrid, AWS SES, etc.
 * Por ahora registra las notificaciones y las expone via API.
 */
async function sendEmail ({ to, subject, body }) {
  const notification = {
    id: `NOTIF-${Date.now()}`,
    to,
    subject,
    body,
    sentAt: new Date().toISOString(),
    status: 'SENT'
  }
  SENT.push(notification)

  // En producción:
  // await transporter.sendMail({ from: 'noreply@secretosdelagua.com', to, subject, html: body })

  return notification
}

export async function notificationRoutes (fastify) {

  // HU-17 — Confirmación tras crear un pedido
  fastify.post('/order-confirmed', {
    schema: {
      description: 'Envía confirmación por email tras confirmar un pedido (HU-17)',
      tags: ['notifications'],
      body: {
        type: 'object',
        required: ['order', 'user'],
        properties: {
          order: { type: 'object' },
          user:  { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const { order, user } = request.body

    const notification = await sendEmail({
      to: user.email ?? `${user.sub}@secretosdelagua.com`,
      subject: `Confirmación de pedido ${order.orderId}`,
      body: `
        <h2>Tu pedido ha sido confirmado</h2>
        <p>Hola ${user.name ?? user.sub},</p>
        <p>Tu pedido <strong>${order.orderId}</strong> ha sido registrado correctamente.</p>
        <p>Total: <strong>${order.total}€</strong></p>
        <p>Recibirás una notificación cuando sea enviado.</p>
      `
    })

    fastify.log.info({ orderId: order.orderId, to: notification.to }, 'Notificación enviada')
    return reply.status(201).send(notification)
  })

  // Historial de notificaciones — solo admins
  fastify.get('/', {
    preHandler: [fastify.authenticate, fastify.requireAdmin],
    schema: {
      description: 'Historial de notificaciones enviadas — solo administradores',
      tags: ['notifications'],
      security: [{ bearerAuth: [] }]
    }
  }, async (_req, reply) => reply.send(SENT)
  )
}
