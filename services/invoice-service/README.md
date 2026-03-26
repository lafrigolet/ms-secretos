# invoice-service

Invoice management service. Lists and retrieves invoice data from SAP. Provides a download endpoint that in production returns the PDF from SAP.

**Port:** 3008
**User stories:** HU-20 (invoice listing and download)

---

## Quick Start

```bash
cd services/invoice-service
npm install
npm run dev     # hot-reload on :3008
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3008/docs` while running.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3008` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level and stub mode |
| `JWT_SECRET` | — | **Yes** | Must match the secret used by `auth-service` |
| `SAP_INTEGRATION_URL` | `http://sap-integration-service:3010` | No | Base URL of the SAP Integration Service |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/invoices` | JWT | List all invoices for the authenticated customer |
| `GET` | `/invoices/:invoiceId` | JWT | Invoice details. Returns 403 for invoices belonging to another customer (admins can view all) |
| `GET` | `/invoices/:invoiceId/download` | JWT | Download URL / PDF for the invoice. In stub mode returns a placeholder URL |
| `GET` | `/health` | Public | Health check |

### Invoices list response

Derived from orders that have an associated `invoiceId`:

```json
[
  {
    "invoiceId": "INV-2024-001",
    "orderId": "ORD-20241101-001",
    "date": "2024-11-01T00:00:00.000Z",
    "total": 98.00,
    "status": "DELIVERED"
  }
]
```

### Download response (stub)

```json
{
  "invoiceId": "INV-2024-001",
  "downloadUrl": "/invoices/INV-2024-001/download",
  "message": "En producción aquí se devuelve el PDF desde SAP"
}
```

---

## Inter-service Dependencies

| Service | Call | When |
|---|---|---|
| `sap-integration-service` | `GET /internal/orders/:sapCode` | `GET /invoices` — filters orders that have an invoiceId |
| `sap-integration-service` | `GET /internal/orders/invoice/:invoiceId` | `GET /invoices/:invoiceId` and `/download` |

---

## Architecture Notes

- Invoice data is derived from orders stored in SAP — an invoice exists when an order has an `invoiceId` field.
- Ownership check: a customer can only access their own invoices. Admins can access any invoice.
- The download endpoint is a stub in development. In production it should stream the PDF from SAP (e.g. via SAP Document Management or OData media link).

---

## Internal Structure

```
src/
├── app.js
├── routes/
│   └── invoices.js
├── clients/
│   ├── SapIntegrationClient.js
│   └── HttpClient.js
└── middleware/
    ├── authenticate.js
    └── errorHandler.js
```
