# customer-profile-service

Customer profile management service. Stores and exposes customer profiles, permissions, and account status. Used by admins to manage the customer base and by other services to check permissions.

**Port:** 3003
**User stories:** HU-04 (personalised profile), HU-05 (admin profile management), HU-24 (customer search), HU-25 (advanced filtering), HU-28 (activate/block account)

---

## Quick Start

```bash
cd services/customer-profile-service
npm install
npm run dev     # hot-reload on :3003
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3003/docs` while running.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3003` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level and stub mode |
| `JWT_SECRET` | — | **Yes** | Must match the secret used by `auth-service` |
| `SAP_INTEGRATION_URL` | `http://sap-integration-service:3010` | No | Base URL of the SAP Integration Service |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/profile/me` | JWT | Get own profile and permissions |
| `GET` | `/profile/search?q=` | JWT + Admin | Search customers by SAP code, name, business name, city, or email (HU-24) |
| `GET` | `/profile/filter` | JWT + Admin | Filter by `status`, `profile`, or `city` (HU-25) |
| `POST` | `/profile/check-permission` | Internal | Check whether a customer has a specific permission — used by other services |
| `GET` | `/profile/:sapCode` | JWT + Admin | Get a specific customer's profile |
| `GET` | `/profile` | JWT + Admin | List all customer profiles |
| `PATCH` | `/profile/:sapCode` | JWT + Admin | Change customer profile tier (`STANDARD` \| `PREMIUM` \| `VIP`) (HU-05) |
| `PATCH` | `/profile/:sapCode/status` | JWT + Admin | Activate or block a customer account (HU-28) |
| `GET` | `/health` | Public | Health check |

### Internal: check-permission

Used by other services (no JWT required on this endpoint):

```json
POST /profile/check-permission
{ "sapCode": "SDA-00423", "permission": "place_orders" }

→ { "sapCode": "SDA-00423", "permission": "place_orders", "allowed": true }
```

---

## Inter-service Dependencies

| Service | Call | When |
|---|---|---|
| `sap-integration-service` | `GET /internal/customers` | List / search all profiles |
| `sap-integration-service` | `GET /internal/customers/:sapCode` | Get individual profile |
| `sap-integration-service` | `PATCH /internal/customers/:sapCode` | Update profile tier |
| `sap-integration-service` | `PATCH /internal/customers/:sapCode/status` | Activate / block account |

---

## Data Models

### CustomerProfile

```json
{
  "sapCode": "SDA-00423",
  "name": "Rosa Canals",
  "businessName": "Salón Canals Barcelona",
  "profile": "PREMIUM",
  "role": "CUSTOMER",
  "status": "ACTIVE",
  "blockReason": null,
  "city": "Barcelona",
  "permissions": ["place_orders", "view_invoices", "view_promotions"]
}
```

**Profiles:** `STANDARD` | `PREMIUM` | `VIP`
**Statuses:** `ACTIVE` | `BLOCKED`
**Block reasons:** `DEBT` | `ADMIN` | `SUSPENDED`

---

## Internal Structure

```
src/
├── app.js
├── routes/
│   ├── profile.js            # All profile endpoints
│   └── health.js
├── services/
│   └── ProfileService.js     # Business logic: get, search, filter, update, permissions
├── clients/
│   ├── SapIntegrationClient.js
│   └── HttpClient.js
└── middleware/
    ├── authenticate.js       # fastify.authenticate + fastify.requireAdmin decorators
    └── errorHandler.js
```
