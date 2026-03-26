# commercial-service

Commercial relationship management service. Links store managers to their assigned sales representative, manages suggested orders from the commercial team, and gives sales reps a portfolio view of their customers' activity.

**Port:** 3014
**User stories:** HU-44 (assigned commercial), HU-45 (suggested orders), HU-46 (commercial portfolio view), HU-47 (admin assignment management)

---

## Quick Start

```bash
cd services/commercial-service
npm install
npm run dev     # hot-reload on :3014
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3014/docs` while running.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3014` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level and stub mode |
| `JWT_SECRET` | — | **Yes** | Must match the secret used by `auth-service` |
| `SAP_INTEGRATION_URL` | `http://sap-integration-service:3010` | No | Base URL of the SAP Integration Service |

---

## API Endpoints

### Customer endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/commercial/my-commercial` | JWT | Assigned sales rep for the authenticated customer (HU-44) |
| `GET` | `/commercial/suggested-orders` | JWT | Suggested orders from the commercial (HU-45) |
| `PATCH` | `/commercial/suggested-orders/:id/respond` | JWT | Accept or reject a suggested order (HU-45) |

### Commercial / Admin endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/commercial/portfolio` | JWT + Commercial\|Admin | Customer portfolio with activity summary (HU-46). Admin can add `?commercialId=` |
| `GET` | `/commercial/portfolio/:sapCode/orders` | JWT + Commercial\|Admin | Order history + suggestions for a specific portfolio customer (HU-46) |
| `POST` | `/commercial/suggested-orders` | JWT + Commercial\|Admin | Create a suggested order for a customer (HU-45) |

### Admin-only endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/commercial/commercials` | JWT + Admin | List all sales representatives (HU-47) |
| `GET` | `/commercial/assignments` | JWT + Admin | List all customer-commercial assignments (HU-47) |
| `PATCH` | `/commercial/assignments/:sapCode` | JWT + Admin | Assign or change a customer's commercial (HU-47) |

### Create suggested order request

```json
POST /commercial/suggested-orders
{
  "sapCode": "SDA-00423",
  "message": "Te recomiendo reponer Champú Ritual",
  "items": [
    { "productCode": "P-RT-001", "name": "Champú Ritual Timeless", "quantity": 6, "unitPrice": 24.50 }
  ]
}
```

---

## Suggested Order Status Flow

```
PENDING → ACCEPTED
        ↘ REJECTED
```

---

## Data Models

### Commercial (sales rep)

```json
{ "id": "COM-001", "name": "Marta Soler", "email": "marta@secretosdelagua.com", "zone": "Cataluña" }
```

### Assignment

```json
{ "sapCode": "SDA-00423", "commercialId": "COM-001", "assignedAt": "2024-01-15T08:00:00.000Z", "assignedBy": "ADMIN-001" }
```

---

## Auth Roles

This service uses a custom `fastify.requireCommercialOrAdmin` decorator in addition to the standard `fastify.requireAdmin`:

| Endpoint group | Required role |
|---|---|
| Portfolio / suggested order creation | `COMMERCIAL` or `ADMIN` |
| Commercials list / assignment management | `ADMIN` only |

---

## Inter-service Dependencies

| Service | Call | When |
|---|---|---|
| `sap-integration-service` | `GET /internal/customers/:sapCode` | Build portfolio (customer master data) |
| `sap-integration-service` | `GET /internal/orders/:sapCode` | Build portfolio (order history + last order date) |

---

## Storage

Commercials, assignments, and suggested orders are stored **in memory** (`commercialStore.js`). Data is lost on restart.

> **Production note:** Replace with a persistent database. Assignments are a core business relationship and must be durable.

---

## Internal Structure

```
src/
├── app.js
├── routes/
│   └── commercial.js        # All endpoints (customer + commercial + admin)
├── data/
│   └── commercialStore.js   # In-memory store + helpers
├── clients/
│   ├── SapIntegrationClient.js
│   └── HttpClient.js
└── middleware/
    ├── authenticate.js      # Includes fastify.requireCommercialOrAdmin decorator
    └── errorHandler.js
```
