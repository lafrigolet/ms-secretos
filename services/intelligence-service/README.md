# intelligence-service

Commercial intelligence and analytics service. Provides store managers with purchase comparison vs previous periods, alerts for products not reordered recently, benefit threshold progress, and an accumulated benefits summary.

**Port:** 3013
**User stories:** HU-40 (purchase comparison), HU-41 (inactive product alerts), HU-42 (threshold progress), HU-43 (benefits summary)

---

## Quick Start

```bash
cd services/intelligence-service
npm install
npm run dev     # hot-reload on :3013
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3013/docs` while running.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3013` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level and stub mode |
| `JWT_SECRET` | — | **Yes** | Must match the secret used by `auth-service` |
| `SAP_INTEGRATION_URL` | `http://sap-integration-service:3010` | No | Base URL of the SAP Integration Service |

---

## API Endpoints

All endpoints require a valid JWT (`Authorization: Bearer <token>`).

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/intelligence/comparison` | JWT | Purchase volume comparison vs previous period. Optional `?windowDays=90` (30–365) |
| `GET` | `/intelligence/alerts/inactive-products` | JWT | Products ordered ≥2 times historically but not reordered in X weeks. Optional `?weeksThreshold=8` |
| `GET` | `/intelligence/thresholds` | JWT | Progress toward benefit thresholds in the current 30-day period |
| `GET` | `/intelligence/benefits-summary` | JWT | Accumulated benefits (gifts, samples, discounts) over recent months. Optional `?months=6` |
| `GET` | `/health` | Public | Health check |

### Comparison response

```json
{
  "windowDays": 90,
  "current":  { "total": 450.00, "orders": 5, "topProducts": [...] },
  "previous": { "total": 320.00, "orders": 3, "topProducts": [...] },
  "changes":  { "totalAmount": 40.6, "totalOrders": 66.7, "trend": "UP" }
}
```

**Trends:** `UP` | `DOWN` | `FLAT` | `NO_DATA`

### Thresholds

| Amount (30 days) | Benefit |
|---|---|
| ≥ 100 € | Free sample |
| ≥ 200 € | Priority shipping |
| ≥ 350 € | Exclusive tester gift |
| ≥ 500 € | 10% discount on next order |

### Thresholds response

```json
{
  "currentPeriodSpend": 275.00,
  "periodDays": 30,
  "reached": [
    { "threshold": 100, "label": "Muestra gratis", "type": "SAMPLE" },
    { "threshold": 200, "label": "Envío prioritario", "type": "SHIPPING" }
  ],
  "next": {
    "threshold": 350,
    "label": "Tester exclusivo",
    "type": "GIFT",
    "remaining": 75.00,
    "progressPct": 78.6
  }
}
```

---

## Inter-service Dependencies

| Service | Call | When |
|---|---|---|
| `sap-integration-service` | `GET /internal/orders/:sapCode` | All endpoints except benefits summary |
| `sap-integration-service` | `GET /internal/orders/:sapCode/benefits` | `GET /intelligence/benefits-summary` |

---

## Architecture Notes

- All analytics are computed **at request time** from raw order history fetched from SAP.
- No state is persisted in this service.
- The benefit thresholds are hardcoded in the route file — in production these should be configurable (from `promotions-service` or a config store).

---

## Internal Structure

```
src/
├── app.js
├── routes/
│   └── intelligence.js    # All analytics endpoints
├── clients/
│   ├── SapIntegrationClient.js
│   └── HttpClient.js
└── middleware/
    ├── authenticate.js
    └── errorHandler.js
```
