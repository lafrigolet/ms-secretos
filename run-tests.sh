#!/bin/bash

# ══════════════════════════════════════════════════════════════════
# Secretos del Agua — Test Runner
# Compatible con Node 18+ (--test-reporter=tap)
#
# Uso:
#   ./run-tests.sh                  # todos los servicios
#   ./run-tests.sh auth-service     # solo un servicio
# ══════════════════════════════════════════════════════════════════

SERVICES=(
  auth-service
  catalog-service
  customer-profile-service
  promotions-service
  cart-service
  order-service
  notification-service
  invoice-service
  audit-service
  sap-integration-service
  returns-service
  content-service
  intelligence-service
  commercial-service
  notification-preferences-service
  sustainability-service
)

if [ -n "$1" ]; then
  SERVICES=("$1")
fi

TOTAL_PASS=0
TOTAL_FAIL=0
FAILED_SERVICES=()

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        Secretos del Agua — Test Suite                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

for SVC in "${SERVICES[@]}"; do
  echo "── $SVC ─────────────────────────────────────────────────────"

  OUTPUT=$(docker compose run --rm "$SVC" \
    node --test --test-reporter=tap src/app.test.js 2>&1)

  EXIT_CODE=$?

  PASS=$(echo "$OUTPUT" | grep -cE "^ok [0-9]")
  FAIL=$(echo "$OUTPUT" | grep -cE "^not ok [0-9]")

  TOTAL_PASS=$((TOTAL_PASS + PASS))
  TOTAL_FAIL=$((TOTAL_FAIL + FAIL))

  if [ "$EXIT_CODE" -ne 0 ] && [ "$PASS" -eq 0 ] && [ "$FAIL" -eq 0 ]; then
    echo "  ⚠️  Error al ejecutar (¿imagen no construida?). Ejecuta: docker compose build $SVC"
    FAILED_SERVICES+=("$SVC")
  elif [ "$FAIL" -eq 0 ]; then
    echo "  ✅  $PASS tests pasados"
  else
    echo "  ❌  $PASS pasados · $FAIL fallidos"
    FAILED_SERVICES+=("$SVC")
    echo "$OUTPUT" | grep -E "^not ok [0-9]" | sed 's/^not ok [0-9]* /     ✗ /'
  fi
  echo ""
done

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  RESULTADO FINAL                                             ║"
printf "║  ✅ Pasados:  %-3s   ❌ Fallidos: %-3s                       ║\n" "$TOTAL_PASS" "$TOTAL_FAIL"
echo "╚══════════════════════════════════════════════════════════════╝"

if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
  echo ""
  echo "  Servicios con problemas:"
  for SVC in "${FAILED_SERVICES[@]}"; do
    echo "    · $SVC"
  done
  echo ""
  exit 1
else
  echo ""
  echo "  Todos los tests han pasado correctamente."
  echo ""
  exit 0
fi
