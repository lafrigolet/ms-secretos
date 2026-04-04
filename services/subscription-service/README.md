# subscription-service

SaaS billing and subscription management for Secretos del Agua B2B portal.

## Port

**3017** — `http://localhost:3017/docs`

## Plans

| ID | Name | Price/month |
|----|------|-------------|
| `plan-basic` | Basic | €29.99 |
| `plan-pro` | Pro | €79.99 |
| `plan-enterprise` | Enterprise | €199.99 |

## Endpoints

### Customer (authenticated)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/subscriptions/plans` | List available plans |
| GET | `/subscriptions/me` | Current subscription |
| POST | `/subscriptions` | Subscribe to a plan |
| PATCH | `/subscriptions/me` | Upgrade / downgrade plan |
| DELETE | `/subscriptions/me` | Cancel subscription |
| GET | `/subscriptions/me/billing` | Billing history |
| POST | `/subscriptions/me/payment-method` | Add/update payment method |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/subscriptions/admin` | All subscriptions |
| GET | `/subscriptions/admin/:sapCode` | One customer's subscription |
| PATCH | `/subscriptions/admin/:sapCode` | Override subscription (manual grant) |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3017` | Service port |
| `JWT_SECRET` | — | Must match all other services |
| `PAYMENT_MODE` | `stub` | `stub` = fake payments, `stripe` = real Stripe (future) |
| `NODE_ENV` | `development` | Controls logging and stub behaviour |

## Payment modes

- `NODE_ENV=test` — built-in stub (no network, used in unit tests)
- `PAYMENT_MODE=stub` — returns fake successful payment responses (default in development)
- `PAYMENT_MODE=stripe` — calls real Stripe API (not yet implemented)

## Running

```bash
cd services/subscription-service
npm install
cp .env.example .env
npm run dev     # hot-reload on port 3017
npm test        # unit tests
```
