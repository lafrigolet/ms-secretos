# Development Guide

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Git

## Quick start (full stack)

```bash
git clone https://github.com/lafrigolet/ms-secretos.git
cd ms-secretos
cp .env.example .env
docker compose up --build
```

The app is available at `http://localhost` (proxied through Nginx).

## Environment variables

All variables are defined in `.env.example`. Copy it to `.env` before running anything:

```bash
cp .env.example .env
```

`.env` is gitignored — never commit it. The key variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | Controls logging format and stub behavior |
| `JWT_SECRET` | `dev_secret_change_in_production` | Must match across all services |
| `SAP_MODE` | `stub` | `stub` = fixture data, `odata` = real SAP |

## Stub mode and SAP integration

The architecture has a single stub boundary: **`sap-integration-service`**.

| Context | `NODE_ENV` | What happens |
|---------|-----------|--------------|
| `npm test` (unit tests) | `test` | Each service uses its own local fixture data — no HTTP calls |
| `docker compose up` (local) | `development` | Services call `sap-integration-service`, which returns stub data (`SAP_MODE=stub`) |
| Production | `production` | Services call `sap-integration-service`, which connects to real SAP (`SAP_MODE=odata`) |

This means you can run the full stack locally and every service will behave realistically, with `sap-integration-service` acting as the single mock boundary.

## Running the full stack

```bash
# Start everything
docker compose up --build

# Start a single service (and its dependencies)
docker compose up auth-service

# Rebuild a service after changing dependencies
docker compose build auth-service

# View logs
docker compose logs -f catalog-service
```

## Working on a single service (without Docker)

Each service is fully self-contained and can run in isolation:

```bash
cd services/auth-service
npm install
cp .env.example .env
npm run dev     # hot-reload via node --watch
```

The service will start on its designated port (see port table below). When running alone, inter-service calls fall back to local stubs automatically (since `NODE_ENV` is not `production`).

## Frontend

```bash
cd frontend
npm install
npm run dev     # Vite dev server on :5173
```

Or run it via Docker as part of the full stack.

## Running tests

```bash
# Single service — fast, no Docker needed
cd services/auth-service
npm install
npm test

# All services — runs in Docker containers
./run-tests.sh

# Single service via Docker
./run-tests.sh auth-service
```

Tests use Node's built-in test runner (`node:test`) — no Jest or Mocha. Each service has a single `src/app.test.js`.

**Important:** In-memory data stores are module-level and shared across all tests in a run. Use unique identifiers or relative assertions (`>=`) when test order matters.

## Service ports

| Service | Port | Swagger UI |
|---------|------|------------|
| auth-service | 3001 | http://localhost:3001/docs |
| catalog-service | 3002 | http://localhost:3002/docs |
| customer-profile-service | 3003 | http://localhost:3003/docs |
| promotions-service | 3004 | http://localhost:3004/docs |
| cart-service | 3005 | http://localhost:3005/docs |
| order-service | 3006 | http://localhost:3006/docs |
| notification-service | 3007 | http://localhost:3007/docs |
| invoice-service | 3008 | http://localhost:3008/docs |
| audit-service | 3009 | http://localhost:3009/docs |
| sap-integration-service | 3010 | http://localhost:3010/docs |
| returns-service | 3011 | http://localhost:3011/docs |
| content-service | 3012 | http://localhost:3012/docs |
| intelligence-service | 3013 | http://localhost:3013/docs |
| commercial-service | 3014 | http://localhost:3014/docs |
| notification-preferences-service | 3015 | http://localhost:3015/docs |
| sustainability-service | 3016 | http://localhost:3016/docs |
| frontend | 5173 | — |
| dev-stack dashboard | 5174 | — |

## Adding a new service

1. Create `services/<name>/` following the structure in `CONVENTIONS.md`
2. Assign the next available port
3. Add to `docker-compose.yml` and `docker-compose.prod.yml`
4. Add upstream and location block to `infrastructure/nginx/nginx.conf`
5. Add to the `SERVICES` array in `run-tests.sh`
6. Add to the matrix in `.github/workflows/deploy.yml`
7. Update the port table in this file and in `README.md`

## Code conventions

Read `CONVENTIONS.md` before implementing anything. It defines:
- Error response format (`{ error, message, ...context }`)
- HTTP status codes
- Shared enums (profiles, roles, order states)
- Minimum service structure
