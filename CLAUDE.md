# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Secretos del Agua** is a B2B order management portal for store managers. It is a Node.js microservices monorepo with 16 independent Fastify services, a React + Vite frontend, and an Nginx reverse proxy. Each service is fully self-contained — no shared packages exist between services.

## Commands

### Tests

```bash
# Run tests for a single service (without Docker)
cd services/<service-name>
npm test                          # node --test src/app.test.js

# Run all services via Docker
./run-tests.sh

# Run a single service via Docker
./run-tests.sh auth-service

# Run integration tests (all services via Docker Compose, real HTTP calls)
bash integration/run-integration-tests.sh
```

### Development (single service, no Docker)

```bash
cd services/<service-name>
npm install
cp .env.example .env
npm run dev     # hot-reload via node --watch
```

### Full stack

```bash
cp .env.example .env
docker compose up --build          # all services + nginx + frontend (builds from source)
docker compose up auth-service     # single service
docker compose build auth-service  # rebuild image after dependency changes

# Production (pulls images from ghcr.io instead of building)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Frontend

```bash
cd frontend
npm install
npm run dev     # dev server on :5173
npm run build
```

## Architecture

### Service structure

Every service follows the same layout:

```
src/
├── app.js              # Fastify init: plugins → auth decorators → error handler → routes → /health
├── app.test.js         # All tests in one file; uses Node built-in test runner
├── routes/             # Endpoint definitions with inline OpenAPI schemas
├── services/           # Business logic
├── schemas/            # JSON Schema / OpenAPI definitions
├── middleware/
│   ├── authenticate.js # Registers fastify.authenticate and fastify.requireAdmin decorators
│   └── errorHandler.js # Normalises all errors to { error, message, ...context }
└── clients/            # HTTP clients for inter-service calls
```

`app.js` always registers plugins in this order: CORS → JWT → Swagger → SwaggerUI → auth decorators → error handler → route plugins → `/health`.

### Tests

Tests use the Node 18+ built-in runner (`node:test` / `node:assert/strict`) — no Jest or Mocha. Each service has a single `src/app.test.js` that creates a fresh Fastify instance via a local `buildApp()` helper. The in-memory data stores (e.g., `AUDIT_LOG`, product lists) are module-level and **persist across tests within a run** — use unique identifiers or relative assertions (`>=`) when test ordering matters.

### Authentication

- JWT payload: `{ sub, name, profile, role, iat, exp }`
- Header: `Authorization: Bearer <token>`
- Protected routes use `preHandler: [fastify.authenticate]` or `[fastify.authenticate, fastify.requireAdmin]`
- No auth is needed for `POST /audit` (internal service-to-service) or public routes marked with `config: { public: true }`

### Inter-service communication

Services call each other via HTTP using Docker service names as DNS (e.g., `http://notification-service:3007`). The URL is read from an env var with that as the fallback. The caller forwards the user's JWT in the `Authorization` header.

### SAP Integration

`sap-integration-service` is the **single stub boundary** for the whole platform:

- In `npm test` (`NODE_ENV=test`): each service uses its own local fixture data — no HTTP calls made
- In `docker compose up` (`NODE_ENV=development`): all services call `sap-integration-service` via HTTP, which returns stub data (`SAP_MODE=stub`)
- In production (`NODE_ENV=production`): all services call `sap-integration-service`, which connects to real SAP (`SAP_MODE=odata`)

Service clients use `const isStubMode = () => process.env.NODE_ENV === 'test'` — checked at call time (not module load time) to avoid ES module hoisting issues. Test files must set `process.env.NODE_ENV = 'test'` before imports take effect (at the top of the file, before any imports that transitively use it — though due to ESM hoisting, the safest approach is relying on the CI/test environment setting it).

### Error contract (from CONVENTIONS.md)

All errors return `{ error: "UPPER_SNAKE_CASE", message: "..." }` with optional extra fields. Validation errors always include a `details` array. HTTP codes: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 503 dependency unavailable.

### Shared enums (defined locally per service — no shared package)

- Customer profiles: `STANDARD | PREMIUM | VIP`
- Roles: `CUSTOMER | ADMIN`
- Order states: `PENDING | CONFIRMED | PREPARING | SHIPPED | DELIVERED | CANCELLED`
- Block reasons: `DEBT | ADMIN | SUSPENDED`

### Ports

| Service                          | Port |
|----------------------------------|------|
| auth-service                     | 3001 |
| catalog-service                  | 3002 |
| customer-profile-service         | 3003 |
| promotions-service               | 3004 |
| cart-service                     | 3005 |
| order-service                    | 3006 |
| notification-service             | 3007 |
| invoice-service                  | 3008 |
| audit-service                    | 3009 |
| sap-integration-service          | 3010 |
| returns-service                  | 3011 |
| content-service                  | 3012 |
| intelligence-service             | 3013 |
| commercial-service               | 3014 |
| notification-preferences-service | 3015 |
| sustainability-service           | 3016 |
| frontend                         | 5173 |
| dev-stack dashboard              | 5174 |

### Adding a new service

1. Create `services/<name>/` following the structure above
2. Assign the next available port
3. Add to `docker-compose.yml` and `infrastructure/nginx/nginx.conf`
4. Add to the `SERVICES` array in `run-tests.sh`
5. Follow all contracts in `CONVENTIONS.md`
