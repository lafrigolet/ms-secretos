# notification-service

Email notification service. Receives internal events from other microservices and sends transactional emails. Currently a stub implementation that records notifications in memory.

**Port:** 3007
**User stories:** HU-17 (order confirmation email)

---

## Quick Start

```bash
cd services/notification-service
npm install
npm run dev     # hot-reload on :3007
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3007/docs` while running.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3007` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level |
| `JWT_SECRET` | — | **Yes** | Required for the admin history endpoint |

> **Production configuration:** When integrating a real email provider, add the relevant credentials here (e.g. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` for nodemailer, or `SENDGRID_API_KEY` for SendGrid, or AWS SES credentials).

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/notifications/order-confirmed` | Internal (no JWT) | Send order confirmation email — called by `order-service` after order creation |
| `GET` | `/notifications` | JWT + Admin | List all sent notifications (history) |
| `GET` | `/health` | Public | Health check |

### order-confirmed request (called by order-service)

```json
POST /notifications/order-confirmed
{
  "order": { "orderId": "ORD-20241201-001", "total": 49.00 },
  "user": { "sub": "SDA-00423", "name": "Rosa Canals", "email": "rosa@salon.com" }
}
```

### Notification object

```json
{
  "id": "NOTIF-1701428000000",
  "to": "rosa@salon.com",
  "subject": "Confirmación de pedido ORD-20241201-001",
  "body": "<h2>Tu pedido ha sido confirmado</h2>...",
  "sentAt": "2024-12-01T10:00:00.000Z",
  "status": "SENT"
}
```

---

## Inter-service Dependencies

None. This service only receives calls from other services — it does not call any other service.

---

## Stub vs Production

The `sendEmail` function currently stores notifications in a module-level array. In production, replace it with a real email transport:

```js
// nodemailer example:
await transporter.sendMail({ from: 'noreply@secretosdelagua.com', to, subject, html: body })

// SendGrid example:
await sgMail.send({ to, from: 'noreply@secretosdelagua.com', subject, html: body })
```

---

## Storage

Sent notifications are stored **in memory**. Data is lost on restart.

> **Production note:** Replace with a database or message queue (RabbitMQ, SQS) for durability and retry support.

---

## Internal Structure

```
src/
├── app.js
├── routes/
│   └── notifications.js    # POST /order-confirmed + GET /
└── middleware/
    ├── authenticate.js
    └── errorHandler.js
```
