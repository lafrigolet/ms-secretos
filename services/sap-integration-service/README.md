# sap-integration-service

SAP adapter service. Acts as the single gateway between all other microservices and SAP. Supports three operation modes: `stub` (in-memory fixtures for development/testing), `odata` (SAP Gateway via OData/REST for production), and the `rfc` variant for direct RFC/BAPI connectivity.

**Port:** 3010
**Type:** Internal — no JWT required. Only called by other microservices, never by the frontend directly.

---

## Quick Start

```bash
cd services/sap-integration-service
npm install
npm run dev     # stub mode by default, hot-reload on :3010
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3010/docs` while running.

---

## Environment Variables

### Common

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3010` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level |
| `SAP_MODE` | `stub` | No | Operation mode: `stub` \| `odata` |

### Cache TTLs (seconds, 0 = disabled)

| Variable | Default | Description |
|---|---|---|
| `CACHE_TTL_CUSTOMERS` | `0` | Cache TTL for customer data |
| `CACHE_TTL_PRODUCTS` | `0` | Cache TTL for products, families, and invoices |
| `CACHE_TTL_PRICES` | `0` | Cache TTL for price lists |
| `CACHE_TTL_STOCK` | `0` | Cache TTL for stock levels |

### SAP OData credentials (required when `SAP_MODE=odata`)

| Variable | Default | Required | Description |
|---|---|---|---|
| `SAP_BASE_URL` | — | **Yes** | SAP Gateway base URL (e.g. `https://sap.example.com:8000`) |
| `SAP_USER` | — | **Yes** | SAP technical user for service account |
| `SAP_PASSWORD` | — | **Yes** | SAP technical user password |
| `SAP_CLIENT` | `100` | No | SAP client/mandant number |
| `SAP_LANGUAGE` | `ES` | No | SAP language key |

---

## Operation Modes

| Mode | When to use | How to activate |
|---|---|---|
| `stub` | Local development and automated tests | `SAP_MODE=stub` (default) |
| `odata` | Production — requires SAP Gateway with OData services | `SAP_MODE=odata` + SAP credentials |

The mode is selected once at startup via the `SapService` factory. All routes delegate to the active adapter through the same interface.

---

## API Endpoints

All routes are prefixed with `/internal/` — they are not exposed through Nginx to the public internet.

### Customers (`/internal/customers`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/internal/customers/verify` | Verify SAP credentials — used by `auth-service` |
| `GET` | `/internal/customers` | List all customers — used by `customer-profile-service` |
| `GET` | `/internal/customers/:sapCode` | Customer master data |
| `PATCH` | `/internal/customers/:sapCode` | Update customer profile tier |
| `PATCH` | `/internal/customers/:sapCode/status` | Activate or block a customer account |

### Catalog (`/internal/catalog`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/internal/catalog/families` | Product families |
| `GET` | `/internal/catalog/products` | All products, optional `?familyId=` filter |
| `GET` | `/internal/catalog/products/:sapCode` | Single product |
| `GET` | `/internal/catalog/prices/:profile` | All prices for a profile (`STANDARD` \| `PREMIUM` \| `VIP`) |
| `GET` | `/internal/catalog/prices/:profile/:productCode` | Price for a specific product + profile |
| `GET` | `/internal/catalog/stock` | All stock levels |
| `GET` | `/internal/catalog/stock/:productCode` | Stock for a specific product |

### Orders & Invoices (`/internal/orders`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/internal/orders/:sapCode` | All orders for a customer |
| `GET` | `/internal/orders/:sapCode/benefits` | Accumulated benefits for a customer |
| `GET` | `/internal/orders/order/:orderId` | Single order details |
| `POST` | `/internal/orders` | Create a new order in SAP |
| `GET` | `/internal/orders/invoice/:invoiceId` | Invoice data |

### Returns (`/internal/returns`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/internal/returns/credit-note` | Generate a credit note in SAP |

### Health (`/health`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check including SAP mode and cache stats |

---

## Caching

`SapService` wraps every adapter call with an optional in-memory cache keyed by resource type. TTLs are controlled per resource type via environment variables.

- Credentials are **never** cached.
- Orders are **never** cached (always fresh).
- Creating an order **invalidates** all stock cache entries.
- Updating a customer profile or status **invalidates** the affected customer cache entry.

---

## SAP OData Services Required (production)

| OData Service | Purpose |
|---|---|
| `ZSD_CUSTOMERS_SRV` | Customer master data and authentication |
| `ZSD_CATALOG_SRV` | Products, families, prices, and stock |
| `ZSD_ORDERS_SRV` | Orders and invoices |

> Service names are illustrative — adjust to match the actual SAP system's naming conventions.

---

## Internal Structure

```
src/
├── app.js                     # Registers SapService as fastify.sap decoration
├── routes/
│   ├── customers.js
│   ├── catalog.js
│   ├── orders.js              # Orders + invoices
│   ├── returns.js
│   └── health.js
├── services/
│   ├── SapService.js          # Factory + cache layer
│   ├── StubAdapter.js         # In-memory fixture data
│   └── ODataAdapter.js        # SAP Gateway HTTP client
├── data/
│   └── stubData.js            # Fixture customers, products, orders, invoices
└── middleware/
    └── errorHandler.js
```
