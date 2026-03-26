# notification-preferences-service

Notification preferences and alerts service. Manages per-customer notification channel preferences, an in-app notification inbox, a stock watchlist, and enables admins to send segmented broadcast communications.

**Port:** 3015
**User stories:** HU-48 (stock watchlist), HU-49 (expiring promo alerts), HU-50 (minimum order alerts), HU-51 (notification preferences), HU-52 (segmented broadcasts)

---

## Quick Start

```bash
cd services/notification-preferences-service
npm install
npm run dev     # hot-reload on :3015
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3015/docs` while running.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3015` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level |
| `JWT_SECRET` | — | **Yes** | Must match the secret used by `auth-service` |

---

## API Endpoints

### Public

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/notifications/types` | Public | Available notification types and channels |

### Customer endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/notifications/preferences` | JWT | Get notification preferences for the authenticated user (HU-51) |
| `PATCH` | `/notifications/preferences` | JWT | Update preferences — partial update, send only changed types (HU-51) |
| `GET` | `/notifications/inbox` | JWT | In-app notification inbox |
| `PATCH` | `/notifications/inbox/:id/read` | JWT | Mark a notification as read |
| `PATCH` | `/notifications/inbox/read-all` | JWT | Mark all notifications as read |
| `GET` | `/notifications/watchlist` | JWT | Products currently on stock watchlist (HU-48) |
| `POST` | `/notifications/watchlist` | JWT | Add a product to the stock watchlist (HU-48) |
| `DELETE` | `/notifications/watchlist/:productCode` | JWT | Remove a product from the watchlist (HU-48) |
| `GET` | `/notifications/alerts/expiring-promos` | JWT | Promotions applicable to the customer's profile expiring soon. Optional `?daysAhead=7` (HU-49) |
| `POST` | `/notifications/alerts/check-min-order` | JWT | Check if the cart total meets free-shipping and promo thresholds (HU-50) |

### Admin endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/notifications/broadcasts` | JWT + Admin | History of sent broadcasts (HU-52) |
| `POST` | `/notifications/broadcasts` | JWT + Admin | Send a segmented broadcast to customers (HU-52) |

---

## Notification Types and Channels

| Type | Channels |
|---|---|
| `ORDER_CONFIRMED` | `EMAIL`, `IN_APP` |
| `ORDER_SHIPPED` | `EMAIL`, `PUSH`, `IN_APP` |
| `PROMO_EXPIRING` | `EMAIL`, `IN_APP` |
| `STOCK_AVAILABLE` | `EMAIL`, `PUSH`, `IN_APP` |
| `COMMERCIAL_SUGGESTION` | `EMAIL`, `IN_APP` |
| `BROADCAST` | `EMAIL`, `PUSH`, `IN_APP` |

**Available channels:** `EMAIL` | `PUSH` | `IN_APP`

### Preferences update example

```json
PATCH /notifications/preferences
{
  "ORDER_CONFIRMED": { "EMAIL": true, "IN_APP": true },
  "PROMO_EXPIRING":  { "EMAIL": false }
}
```

---

## Business Thresholds

| Rule | Value |
|---|---|
| Free shipping alert threshold | 150 € |
| Promo activation threshold | 100 € |

---

## Broadcast Segmentation

```json
POST /notifications/broadcasts
{
  "title": "Nueva gama disponible",
  "body": "Te presentamos nuestra nueva gama...",
  "channel": "EMAIL",
  "segments": {
    "profiles": ["PREMIUM", "VIP"],
    "status": "ACTIVE"
  }
}
```

---

## Inter-service Dependencies

None. This service is standalone. The expiring promo alerts endpoint uses a stub — in production it should call `promotions-service` to retrieve real expiry data.

---

## Storage

All data (preferences, inbox, watchlist, broadcasts) is stored **in memory** (`notificationsStore.js`). Data is lost on restart.

> **Production note:** Replace with a persistent database. Push notifications require a push gateway (FCM/APNs). The inbox should use a message queue or event streaming system for reliability.

---

## Internal Structure

```
src/
├── app.js
├── routes/
│   └── notifications.js        # All endpoints
├── data/
│   └── notificationsStore.js   # In-memory store, NOTIFICATION_TYPES, CHANNELS
└── middleware/
    ├── authenticate.js
    └── errorHandler.js
```
