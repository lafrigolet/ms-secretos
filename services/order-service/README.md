# order-service

Order lifecycle management service. Creates new orders in SAP, retrieves order history, tracks order status, and triggers email notifications and audit events on order creation.

**Port:** 3006
**User stories:** HU-17 (create order + confirmation email), HU-18 (order history), HU-19 (repeat order), HU-21 (order status tracking)

---

## Quick Start

```bash
cd services/order-service
npm install
npm run dev     # hot-reload on :3006
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3006/docs` while running.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3006` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level and stub mode |
| `JWT_SECRET` | — | **Yes** | Must match the secret used by `auth-service` |
| `SAP_INTEGRATION_URL` | `http://sap-integration-service:3010` | No | Base URL of the SAP Integration Service |
| `NOTIFICATION_URL` | `http://notification-service:3007` | No | Base URL of the Notification Service |
| `AUDIT_URL` | `http://audit-service:3009` | No | Base URL of the Audit Service |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/orders` | JWT | Order history for the authenticated customer |
| `GET` | `/orders/:orderId` | JWT | Order details. Returns 403 if the order belongs to another customer (admins can view all) |
| `POST` | `/orders` | JWT | Confirm and create an order in SAP. Triggers notification + audit as fire-and-forget |
| `POST` | `/orders/:orderId/repeat` | JWT | Return items from a previous order to load into the cart (HU-19) |
| `GET` | `/health` | Public | Health check |

### Create order request

```json
POST /orders
{
  "items": [
    { "productCode": "P-RT-001", "name": "Champú Ritual Timeless", "quantity": 2, "unitPrice": 24.50 }
  ]
}
```

### Order response shape

```json
{
  "orderId": "ORD-20241201-001",
  "sapCode": "SDA-00423",
  "date": "2024-12-01T10:00:00.000Z",
  "status": "CONFIRMED",
  "items": [...],
  "total": 49.00
}
```

**Order statuses:** `PENDING` | `CONFIRMED` | `PREPARING` | `SHIPPED` | `DELIVERED` | `CANCELLED`

---

## Inter-service Dependencies

| Service | Call | Mode | When |
|---|---|---|---|
| `sap-integration-service` | `GET /internal/orders/:sapCode` | Sync | List orders |
| `sap-integration-service` | `GET /internal/orders/order/:orderId` | Sync | Order detail + repeat order |
| `sap-integration-service` | `POST /internal/orders` | Sync | Create order |
| `notification-service` | `POST /notifications/order-confirmed` | **Fire-and-forget** | After order creation |
| `audit-service` | `POST /audit` | **Fire-and-forget** | After order creation (`ORDER_CREATED`) |

Fire-and-forget calls do not block the response — failures are logged but do not cause the order creation to fail.

---

## Internal Structure

```
src/
├── app.js
├── routes/
│   └── orders.js
├── clients/
│   ├── SapIntegrationClient.js
│   ├── NotificationClient.js    # Fire-and-forget POST /notifications/order-confirmed
│   ├── AuditClient.js           # Fire-and-forget POST /audit
│   └── HttpClient.js
└── middleware/
    ├── authenticate.js
    └── errorHandler.js
```
