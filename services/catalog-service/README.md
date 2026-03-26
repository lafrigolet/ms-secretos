# catalog-service

Product catalog service for Secretos del Agua. Exposes product families, per-profile pricing, stock levels, and product recommendations. All data is fetched from `sap-integration-service`.

**Port:** 3002
**User stories:** HU-07 (product families + listing), HU-08 (product detail card), HU-09 (recommendations)

---

## Quick Start

```bash
cd services/catalog-service
npm install
npm run dev     # hot-reload on :3002
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3002/docs` while running.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3002` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level and stub mode |
| `JWT_SECRET` | — | **Yes** | Must match the secret used by `auth-service` |
| `SAP_INTEGRATION_URL` | `http://sap-integration-service:3010` | No | Base URL of the SAP Integration Service |

> **Stub mode:** When `NODE_ENV !== 'production'`, the SAP client uses fixture data from `sap-integration-service`'s stub adapter instead of live SAP data.

---

## API Endpoints

All endpoints require a valid JWT (`Authorization: Bearer <token>`).

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/catalog/families` | JWT | List all product families |
| `GET` | `/catalog/products` | JWT | Products with profile-based pricing and stock. Optional `?familyId=` filter |
| `GET` | `/catalog/products/:sapCode` | JWT | Full product card — price + stock for the authenticated user's profile |
| `GET` | `/catalog/recommendations` | JWT | Up to 4 recommended products based on cart contents (`?cartItems=P1,P2`) |
| `GET` | `/health` | Public | Health check |

### Products response shape

```json
[
  {
    "sapCode": "P-RT-001",
    "name": "Champú Ritual Timeless",
    "familyId": "F01",
    "active": true,
    "price": 24.50,
    "stock": 120,
    "inStock": true
  }
]
```

---

## Inter-service Dependencies

| Service | Call | When |
|---|---|---|
| `sap-integration-service` | `GET /internal/catalog/families` | `GET /catalog/families` |
| `sap-integration-service` | `GET /internal/catalog/products` | `GET /catalog/products` and `/recommendations` |
| `sap-integration-service` | `GET /internal/catalog/products/:sapCode` | `GET /catalog/products/:sapCode` |
| `sap-integration-service` | `GET /internal/catalog/prices/:profile` | Every product listing (price enrichment) |
| `sap-integration-service` | `GET /internal/catalog/stock` | Every product listing (stock enrichment) |

---

## Architecture Notes

- Pricing is **profile-aware**: the token's `profile` claim (`STANDARD` | `PREMIUM` | `VIP`) determines which price tier is applied.
- Products, prices, and stock are fetched in parallel via `Promise.all` to minimise latency.
- Recommendations are based on the product families already in the cart — up to 4 active products from the same families that are not already in the cart.
- No state is held in this service; it is a pure pass-through with enrichment logic.

---

## Internal Structure

```
src/
├── app.js                    # Fastify init, plugins, route registration
├── routes/
│   └── catalog.js            # All catalog endpoints
├── clients/
│   ├── SapIntegrationClient.js  # HTTP client for sap-integration-service (with stub fallback)
│   └── HttpClient.js
└── middleware/
    ├── authenticate.js
    └── errorHandler.js
```
