# audit-service

Activity audit log service. Records security and business events (logins, orders, profile changes, etc.) sent by other services. Exposes query and statistics endpoints for administrators.

**Port:** 3009
**User stories:** HU-22 (audit trail for incident detection)

---

## Quick Start

```bash
cd services/audit-service
npm install
npm run dev     # hot-reload on :3009
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3009/docs` while running.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3009` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level |
| `JWT_SECRET` | — | **Yes** | Required for the admin query endpoints |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/audit` | Internal (no JWT) | Record an audit event — called by other services |
| `GET` | `/audit` | JWT + Admin | Query audit log. Optional filters: `?sapCode=`, `?action=`, `?limit=` (max 200, default 50) |
| `GET` | `/audit/stats` | JWT + Admin | Activity statistics grouped by action type |
| `GET` | `/health` | Public | Health check |

### Record event request

```json
POST /audit
{
  "action": "ORDER_CREATED",
  "sapCode": "SDA-00423",
  "data": { "orderId": "ORD-20241201-001" },
  "ip": "192.168.1.1"
}
```

### Audit entry response

```json
{
  "id": "AUDIT-1701428000000-a3f2",
  "action": "ORDER_CREATED",
  "sapCode": "SDA-00423",
  "data": { "orderId": "ORD-20241201-001" },
  "ip": "192.168.1.1",
  "timestamp": "2024-12-01T10:00:00.000Z"
}
```

### Stats response

```json
{
  "total": 42,
  "byAction": {
    "LOGIN": 20,
    "ORDER_CREATED": 10,
    "PROFILE_UPDATED": 5,
    ...
  },
  "uniqueUsers": 8
}
```

---

## Valid Actions

| Action | Emitted by |
|---|---|
| `LOGIN` | auth-service |
| `LOGIN_FAILED` | auth-service |
| `LOGIN_BLOCKED` | auth-service |
| `ORDER_CREATED` | order-service |
| `ORDER_VIEWED` | order-service |
| `PROFILE_UPDATED` | customer-profile-service |
| `INVOICE_DOWNLOADED` | invoice-service |
| `PROMO_CREATED` | promotions-service |
| `PROMO_UPDATED` | promotions-service |
| `PROMO_TOGGLED` | promotions-service |

---

## Inter-service Dependencies

None. This service only receives calls — it does not call any other service.

---

## Storage

Audit entries are stored **in memory** (module-level array). Data is lost on restart. Results are returned newest-first.

> **Production note:** Replace with a persistent store. Recommended options: PostgreSQL (structured queries), Elasticsearch/ELK (full-text search + dashboards), or a managed logging service (Datadog, CloudWatch Logs).

---

## Internal Structure

```
src/
├── app.js
├── routes/
│   └── audit.js    # POST / + GET / + GET /stats
└── middleware/
    ├── authenticate.js
    └── errorHandler.js
```
