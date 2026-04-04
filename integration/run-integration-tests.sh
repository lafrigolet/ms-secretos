#!/usr/bin/env bash
set -euo pipefail

COMPOSE="docker compose -f docker-compose.yml -f integration/docker-compose.integration.yml"
TIMEOUT=120  # seconds to wait for all services to become healthy

echo "▶  Starting services for integration tests…"
$COMPOSE up -d --build 2>&1

echo "⏳  Waiting for services to respond (timeout: ${TIMEOUT}s)…"

# Key services that must be up before running tests
HEALTH_CHECKS=(
  "3001/health"   # auth-service
  "3002/health"   # catalog-service
  "3004/health"   # promotions-service
  "3005/health"   # cart-service
  "3006/health"   # order-service
  "3009/health"   # audit-service
  "3010/health"   # sap-integration-service
)

ELAPSED=0
INTERVAL=5
while true; do
  ALL_UP=true
  for endpoint in "${HEALTH_CHECKS[@]}"; do
    PORT="${endpoint%%/*}"
    PATH_="${endpoint#*/}"
    if ! curl -sf "http://localhost:${PORT}/${PATH_}" > /dev/null 2>&1; then
      ALL_UP=false
      break
    fi
  done

  if [ "$ALL_UP" = true ]; then
    echo "✅  All services responding"
    break
  fi

  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "❌  Timeout waiting for services. Current state:"
    $COMPOSE ps
    $COMPOSE down
    exit 1
  fi

  echo "   (${ELAPSED}s) waiting for services…"
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo ""
echo "▶  Running integration tests…"
# Optional first argument: service name (e.g. "catalog-service" or "catalog" runs catalog.test.js)
if [ -n "${1:-}" ]; then
  TEST_NAME="${1%-service}"  # strip trailing -service if present
  TEST_GLOB="integration/tests/${TEST_NAME}.test.js"
else
  TEST_GLOB="integration/tests/*.test.js"
fi
node --test --test-concurrency=1 $TEST_GLOB
TEST_EXIT=$?

echo ""
echo "▶  Tearing down services…"
$COMPOSE down

exit $TEST_EXIT
