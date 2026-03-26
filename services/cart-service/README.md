# cart-service

Shopping cart service. Manages per-user in-memory carts and provides a summary with totals, shipping cost, and applicable promotional benefits.

**Port:** 3005
**User stories:** HU-14 (cart management), HU-15 (cart summary), HU-16 (shipping threshold)

---

## Quick Start

```bash
cd services/cart-service
npm install
npm run dev     # hot-reload on :3005
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3005/docs` while running.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3005` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level |
| `JWT_SECRET` | — | **Yes** | Must match the secret used by `auth-service` |
| `PROMOTIONS_URL` | `http://promotions-service:3004` | No | Base URL of the Promotions Service |

---

## API Endpoints

All endpoints require a valid JWT (`Authorization: Bearer <token>`).

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/cart` | JWT | Get the current user's cart with totals |
| `POST` | `/cart/items` | JWT | Add a product to the cart. Increments quantity if already present |
| `PATCH` | `/cart/items/:productCode` | JWT | Update item quantity. Set `quantity: 0` to remove the item |
| `DELETE` | `/cart/items/:productCode` | JWT | Remove a specific product from the cart |
| `DELETE` | `/cart` | JWT | Empty the cart |
| `GET` | `/cart/summary` | JWT | Cart with totals, shipping, remaining-to-free-shipping, and promo benefits |
| `GET` | `/health` | Public | Health check |

### Add item request

```json
POST /cart/items
{ "productCode": "P-RT-001", "name": "Champú Ritual Timeless", "quantity": 2, "unitPrice": 24.50 }
```

### Summary response

```json
{
  "items": [...],
  "subtotal": 49.00,
  "shipping": 8.50,
  "total": 57.50,
  "benefits": [{ "promoId": "...", "promoName": "...", "benefit": {...} }],
  "shippingThreshold": 150,
  "freeShippingRemaining": 101.00
}
```

---

## Business Rules

| Rule | Value |
|---|---|
| Free shipping threshold | 150 € |
| Shipping cost (below threshold) | 8.50 € |
| Shipping cost (above threshold) | 0 € |

---

## Inter-service Dependencies

| Service | Call | When |
|---|---|---|
| `promotions-service` | `POST /promotions/calculate` | `GET /cart/summary` — to calculate applicable benefits |

The promotions call is **fire-and-forget** style (if it fails, the summary still returns without benefits).

---

## Storage

Carts are stored **in memory** in a `Map` keyed by `sapCode`. Data is lost on restart. Each service instance has its own map — not suitable for horizontally scaled deployments without a shared store (Redis, etc.).

> **Production note:** Replace the in-memory `Map` with a persistent session store (e.g. Redis) to survive restarts and support horizontal scaling.

---

## Internal Structure

```
src/
├── app.js
├── routes/
│   └── cart.js               # All cart endpoints
├── clients/
│   ├── PromotionsClient.js   # HTTP client for promotions-service
│   └── HttpClient.js
└── middleware/
    ├── authenticate.js
    └── errorHandler.js
```
