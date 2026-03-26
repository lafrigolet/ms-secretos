# promotions-service

Promotions and benefits management service. Exposes active promotions filtered by customer profile and calculates applicable benefits for a given order.

**Port:** 3004
**User stories:** HU-10 (active promotions), HU-11 (admin promo management), HU-12 (calculate benefits), HU-13 (automatic order-total trigger)

---

## Quick Start

```bash
cd services/promotions-service
npm install
npm run dev     # hot-reload on :3004
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3004/docs` while running.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3004` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level |
| `JWT_SECRET` | — | **Yes** | Must match the secret used by `auth-service` |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/promotions` | JWT | Active promotions applicable to the authenticated user's profile (HU-10) |
| `POST` | `/promotions/calculate` | JWT | Calculate benefits for a given order (HU-12, HU-13) |
| `GET` | `/promotions/admin` | JWT + Admin | All promotions including inactive ones (HU-11) |
| `POST` | `/promotions/admin` | JWT + Admin | Create a new promotion (HU-11) |
| `PATCH` | `/promotions/admin/:id` | JWT + Admin | Edit a promotion (HU-11) |
| `PATCH` | `/promotions/admin/:id/toggle` | JWT + Admin | Enable or disable a promotion (HU-11) |
| `GET` | `/health` | Public | Health check |

### Calculate benefits request

```json
POST /promotions/calculate
{
  "items": [{ "productCode": "P-RT-001", "quantity": 6 }],
  "orderTotal": 280.00
}
```

### Calculate benefits response

```json
{
  "benefits": [
    {
      "promoId": "PROMO-001",
      "promoName": "Promo Otoño — Ritual Timeless",
      "benefit": { "type": "SAMPLE", "description": "Muestra Sérum Raíces" }
    },
    {
      "promoId": "PROMO-003",
      "promoName": "Tester Aceite Brillo ≥250€",
      "benefit": { "type": "GIFT", "description": "Tester Aceite Brillo Argán 10ml" }
    }
  ],
  "count": 2
}
```

---

## Data Model

### Promotion

```json
{
  "id": "PROMO-001",
  "name": "Promo Otoño — Ritual Timeless",
  "type": "GIFT",
  "description": "Compra ×6 Champú → muestra gratis",
  "profiles": ["PREMIUM", "VIP"],
  "active": true,
  "condition": { "productCode": "P-RT-001", "minQuantity": 6 },
  "benefit": { "type": "SAMPLE", "description": "Muestra Sérum Raíces" }
}
```

**Types:** `DISCOUNT` | `GIFT`
**Benefit types:** `SAMPLE` | `GIFT` | `DISCOUNT`
**Condition fields:** `productCode + minQuantity` (product-level) or `minOrderTotal` (order-level, HU-13)

---

## Inter-service Dependencies

None. This service is standalone. It is called by `cart-service` (for the cart summary) and `notification-preferences-service` (for expiring promo alerts).

---

## Storage

Promotions are stored **in memory** (module-level array). Data is lost on restart.

> **Production note:** This should be replaced with a persistent database. The `POST /promotions/admin` endpoint already generates sequential IDs (`PROMO-001`, `PROMO-002`, …) suitable for migration.

---

## Internal Structure

```
src/
├── app.js
├── routes/
│   └── promotions.js     # All promotion endpoints (customer + admin)
└── middleware/
    ├── authenticate.js
    └── errorHandler.js
```
