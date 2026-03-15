# CONVENTIONS.md

Contrato de desarrollo para todos los microservicios de **Secretos del Agua**.  
Cada servicio es totalmente independiente, pero todos siguen estas convenciones  
para garantizar coherencia en la API que consume el frontend.

---

## Formato de respuesta de error

Todos los servicios devuelven errores con este formato exacto:

```json
{
  "error": "ERROR_CODE",
  "message": "Mensaje legible para el usuario o el desarrollador"
}
```

El campo `error` es siempre un string en `UPPER_SNAKE_CASE`.  
Se pueden añadir campos adicionales según el contexto (ver ejemplo de bloqueo abajo).

**Ejemplo — cuenta bloqueada (auth-service):**
```json
{
  "error": "ACCOUNT_BLOCKED",
  "message": "Tu cuenta tiene pagos pendientes...",
  "reason": "DEBT",
  "supportContact": { "email": "...", "phone": "...", "hours": "..." }
}
```

---

## Códigos HTTP estándar

| Código | Uso |
|--------|-----|
| `200` | OK |
| `201` | Recurso creado |
| `400` | Error de validación / datos incorrectos |
| `401` | No autenticado (token ausente o inválido) |
| `403` | Autenticado pero sin permiso |
| `404` | Recurso no encontrado |
| `409` | Conflicto (ej: recurso ya existe) |
| `503` | Servicio dependiente no disponible (ej: SAP caído) |

---

## Autenticación entre servicios

El frontend envía el JWT en la cabecera `Authorization`:

```
Authorization: Bearer <token>
```

Para comunicación interna entre servicios, el servicio llamante incluye
la misma cabecera con el JWT del usuario o un token de servicio.

---

## Enums compartidos

Estos valores deben ser idénticos en todos los servicios que los usen.  
Cada servicio los define localmente — no hay paquete compartido.

### Perfiles de cliente
```
STANDARD | PREMIUM | VIP
```

### Roles de usuario
```
CUSTOMER | ADMIN
```

### Estados de pedido
```
PENDING | CONFIRMED | PREPARING | SHIPPED | DELIVERED | CANCELLED
```

### Motivos de bloqueo de cuenta
```
DEBT | ADMIN | SUSPENDED
```

---

## Puertos por defecto (desarrollo local)

| Servicio | Puerto |
|----------|--------|
| `auth-service` | 3001 |
| `catalog-service` | 3002 |
| `customer-profile-service` | 3003 |
| `promotions-service` | 3004 |
| `cart-service` | 3005 |
| `order-service` | 3006 |
| `notification-service` | 3007 |
| `invoice-service` | 3008 |
| `audit-service` | 3009 |
| `sap-integration-service` | 3010 |
| `frontend` | 5173 |

---

## Estructura mínima de cada microservicio

```
service-name/
├── Dockerfile
├── .dockerignore
├── .env.example          # Documenta todas las variables necesarias
├── package.json
├── README.md             # Arranque, endpoints, variables y contratos
└── src/
    ├── app.js            # Arranque y registro de plugins/rutas
    ├── routes/           # Definición de endpoints
    ├── services/         # Lógica de negocio
    ├── schemas/          # Validación JSON Schema y definición OpenAPI
    └── middleware/       # Hooks, decoradores y error handler
```

---

## Health check

Todos los servicios exponen `GET /health` que devuelve:

```json
{
  "status": "ok",
  "service": "sda-nombre-service",
  "uptime": 123.45,
  "timestamp": "2025-03-14T10:00:00.000Z"
}
```

---

## Documentación OpenAPI

Todos los servicios exponen su documentación en `GET /docs`.  
En desarrollo: `http://localhost:<puerto>/docs`
