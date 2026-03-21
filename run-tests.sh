#!/bin/bash

# ══════════════════════════════════════════════════════════════════
# Secretos del Agua — Test Runner
# Ejecuta los tests de todos los microservicios y muestra un
# informe agregado con el total de tests pasados/fallidos.
# ══════════════════════════════════════════════════════════════════
#
# Uso:
#   ./run-tests.sh                  # todos los servicios
#   ./run-tests.sh auth-service     # solo un servicio

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
)

# Si se pasa un argumento, ejecutar solo ese servicio
if [ -n "$1" ]; then
  SERVICES=("$1")
fi

TOTAL_PASS=0
TOTAL_FAIL=0
FAILED_SERVICES=()

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        Secretos del Agua — Test Suite                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

for SVC in "${SERVICES[@]}"; do
  echo "── $SVC ─────────────────────────────────────────────────────"

  # Ejecutar tests dentro del contenedor y capturar salida
  OUTPUT=$(docker compose run --rm "$SVC" \
    node --test --reporter=tap src/app.test.js 2>/dev/null)

  # Extraer pass y fail del output TAP
  PASS=$(echo "$OUTPUT" | grep -c "^ok ")
  FAIL=$(echo "$OUTPUT" | grep -c "^not ok ")

  TOTAL_PASS=$((TOTAL_PASS + PASS))
  TOTAL_FAIL=$((TOTAL_FAIL + FAIL))

  if [ "$FAIL" -eq 0 ]; then
    echo "  ✅  $PASS tests pasados"
  else
    echo "  ❌  $PASS pasados · $FAIL fallidos"
    FAILED_SERVICES+=("$SVC")
    # Mostrar qué tests fallaron
    echo "$OUTPUT" | grep "^not ok " | sed 's/^not ok [0-9]* /     ✗ /'
  fi
  echo ""
done

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  RESULTADO FINAL                                            ║"
printf "║  ✅ Pasados:  %-3s   ❌ Fallidos: %-3s                       ║\n" "$TOTAL_PASS" "$TOTAL_FAIL"
echo "╚══════════════════════════════════════════════════════════════╝"

if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
  echo ""
  echo "  Servicios con fallos:"
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
