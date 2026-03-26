# sustainability-service

Sustainability and environmental impact service. Exposes product origin, ingredient, and certification data; estimates carbon footprint for orders; and manages each customer's order grouping preference to reduce delivery emissions.

**Port:** 3016
**User stories:** HU-53 (product origin and ingredients), HU-54 (carbon footprint estimate), HU-55 (order grouping preference)

---

## Quick Start

```bash
cd services/sustainability-service
npm install
npm run dev     # hot-reload on :3016
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3016/docs` while running.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3016` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level |
| `JWT_SECRET` | — | **Yes** | Must match the secret used by `auth-service` |

---

## API Endpoints

All endpoints require a valid JWT (`Authorization: Bearer <token>`).

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/sustainability/products` | JWT | Summary list of all products with sustainability data available |
| `GET` | `/sustainability/products/:productCode` | JWT | Full sustainability profile for a product (HU-53) |
| `POST` | `/sustainability/carbon-footprint` | JWT | Estimate carbon footprint for an order (HU-54) |
| `GET` | `/sustainability/grouping-preference` | JWT | Get the authenticated customer's order grouping preference (HU-55) |
| `PATCH` | `/sustainability/grouping-preference` | JWT | Update order grouping preference (HU-55) |
| `GET` | `/health` | Public | Health check |

---

## Data Models

### Product sustainability profile

```json
{
  "productCode": "P-RT-001",
  "name": "Champú Ritual Timeless",
  "sustainabilityScore": 87,
  "naturalPercentage": 94,
  "carbonFootprintKg": 0.32,
  "origin": {
    "country": "España",
    "region": "Cataluña",
    "certifications": ["COSMOS ORGANIC", "ECOCERT"]
  },
  "ecoLabels": ["Cruelty-free", "Biodegradable packaging"],
  "ingredients": [
    { "name": "Aloe Vera", "origin": "España", "organic": true, "percentage": 30 }
  ]
}
```

### Carbon footprint request

```json
POST /sustainability/carbon-footprint
{
  "items": [
    { "productCode": "P-RT-001", "quantity": 2 },
    { "productCode": "P-BN-001", "quantity": 1 }
  ],
  "shippingMethod": "ECO"
}
```

**Shipping methods:** `STANDARD` | `EXPRESS` | `ECO` | `PICKUP`

### Grouping preference

```json
{
  "sapCode": "SDA-00423",
  "acceptDelay": true,
  "maxDelayDays": 5,
  "updatedAt": "2024-11-20T09:00:00.000Z"
}
```

Setting `acceptDelay: true` indicates the customer is willing to wait up to `maxDelayDays` days to have their order grouped with others, reducing total emissions.

---

## Inter-service Dependencies

None. This service is fully standalone and holds its own sustainability data.

---

## Storage

Product sustainability data is defined as static fixture data in `sustainabilityStore.js`. Grouping preferences are stored **in memory** (per-user Map). Data is lost on restart.

> **Production note:** Product sustainability data should be managed via an admin interface or imported from an external source. Grouping preferences should be persisted in a database.

---

## Internal Structure

```
src/
├── app.js
├── routes/
│   └── sustainability.js        # All endpoints
├── data/
│   └── sustainabilityStore.js   # Product data, carbon footprint calc, grouping prefs
└── middleware/
    ├── authenticate.js
    └── errorHandler.js
```
