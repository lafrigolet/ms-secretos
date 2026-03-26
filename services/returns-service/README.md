# returns-service

Return and complaint management service. Allows store managers to initiate return requests from their order history, track their status, and allows admins to review, approve or reject returns and trigger credit note generation in SAP.

**Port:** 3011
**User stories:** HU-31 (start return from history), HU-32 (select reason and lines), HU-33 (track return status), HU-34 (admin review), HU-35 (generate credit note in SAP)

---

## Quick Start

```bash
cd services/returns-service
npm install
npm run dev     # hot-reload on :3011
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3011/docs` while running.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3011` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level and stub mode |
| `JWT_SECRET` | — | **Yes** | Must match the secret used by `auth-service` |
| `SAP_INTEGRATION_URL` | `http://sap-integration-service:3010` | No | Base URL of the SAP Integration Service |

---

## API Endpoints

### Customer endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/returns/reasons` | Public | List available return reasons |
| `GET` | `/returns` | JWT | All returns for the authenticated customer (HU-33) |
| `GET` | `/returns/:id` | JWT | Return request details. Returns 403 for other customers' returns |
| `POST` | `/returns` | JWT | Create a new return request (HU-31, HU-32) |

### Admin endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/returns` | JWT + Admin | All returns. Optional `?status=` filter (HU-34) |
| `GET` | `/admin/returns/:id` | JWT + Admin | Return details (HU-34) |
| `PATCH` | `/admin/returns/:id` | JWT + Admin | Update return status (HU-34). Automatically triggers credit note generation in SAP when status → `APPROVED` |
| `POST` | `/admin/returns/:id/credit-note` | JWT + Admin | Manually (re)generate credit note in SAP (HU-35) |

### Create return request

```json
POST /returns
{
  "orderId": "ORD-20241101-001",
  "reason": "DAMAGED",
  "notes": "Producto llega roto",
  "items": [
    { "productCode": "P-RT-001", "name": "Champú Ritual Timeless", "quantity": 1, "unitPrice": 24.50 }
  ]
}
```

---

## Return Status Flow

```
PENDING → REVIEWING → APPROVED → RESOLVED
                    ↘ REJECTED
```

When a return is moved to `APPROVED`, a credit note is automatically generated in SAP via `sap-integration-service`. If SAP is unavailable, the return stays in `APPROVED` and the credit note can be retried manually via `POST /admin/returns/:id/credit-note`.

---

## Return Reasons

| Code | Label |
|---|---|
| `DAMAGED` | Producto dañado |
| `WRONG` | Producto incorrecto |
| `MISSING` | Producto faltante |
| `DUPLICATE` | Pedido duplicado |
| `OTHER` | Otro motivo |

---

## Inter-service Dependencies

| Service | Call | When |
|---|---|---|
| `sap-integration-service` | `GET /internal/orders/order/:orderId` | Validate order ownership on return creation |
| `sap-integration-service` | `POST /internal/returns/credit-note` | Generate credit note when return is approved |

---

## Storage

Returns are stored **in memory** (`returnsStore.js`). Data is lost on restart.

> **Production note:** Replace with a persistent database. Returns are business-critical records and must survive service restarts.

---

## Internal Structure

```
src/
├── app.js
├── routes/
│   ├── returns.js        # Customer endpoints
│   └── admin.js          # Admin endpoints
├── data/
│   └── returnsStore.js   # In-memory store + RETURN_REASONS enum
├── clients/
│   ├── SapIntegrationClient.js
│   └── HttpClient.js
└── middleware/
    ├── authenticate.js
    └── errorHandler.js
```
