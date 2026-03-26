# auth-service

Microservicio de autenticación del portal B2B **Secretos del Agua**.

## Historias de usuario que implementa

| HU | Descripción |
|----|-------------|
| HU-01 | Inicio de sesión con código de cliente SAP |
| HU-02 | Bloqueo de acceso a cuentas suspendidas (morosidad, admin) |
| HU-03 | Mensaje informativo + contacto de soporte en caso de bloqueo |

## Endpoints

| Método | Ruta | Descripción | Auth requerida |
|--------|------|-------------|----------------|
| `POST` | `/auth/login` | Login con código SAP | No |
| `GET` | `/auth/me` | Datos del usuario autenticado | JWT |
| `POST` | `/auth/logout` | Cierre de sesión | JWT |
| `POST` | `/auth/verify` | Verifica un JWT (uso interno entre servicios) | No |
| `GET` | `/health` | Health check | No |
| `GET` | `/docs` | Documentación OpenAPI interactiva | No |

## Arranque local (sin Docker)

```bash
npm install
cp .env.example .env
npm run dev
```

El servicio arranca en `http://localhost:3001`.  
La documentación OpenAPI está disponible en `http://localhost:3001/docs`.

## Arranque con Docker

```bash
docker build -t sda-auth-service .
docker run --env-file .env -p 3001:3001 sda-auth-service
```

## Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores:

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto del servidor | `3001` |
| `HOST` | Host de escucha | `0.0.0.0` |
| `JWT_SECRET` | Secreto para firmar JWT — **cambiar en producción** | — |
| `JWT_EXPIRES_IN` | Duración del token | `8h` |
| `SAP_INTEGRATION_URL` | URL del SAP Integration Service | `http://sap-integration-service:3010` |
| `NODE_ENV` | Entorno (`development` \| `production`) | `development` |

## Modo STUB (desarrollo)

En `NODE_ENV=development` el servicio funciona sin SAP Integration Service,  
usando los siguientes clientes de prueba:

| Código SAP | Contraseña | Perfil | Estado |
|------------|------------|--------|--------|
| `SDA-00423` | `demo1234` | PREMIUM | Activo |
| `SDA-00387` | `demo1234` | STANDARD | Activo |
| `SDA-00187` | `demo1234` | STANDARD | **Bloqueado (deuda)** |
| `SDA-00521` | `demo1234` | VIP | Activo |
| `ADMIN-001` | `admin1234` | ADMIN | Activo |

## Contrato JWT

El token firmado contiene el siguiente payload:

```json
{
  "sub": "SDA-00423",
  "name": "Rosa Canals",
  "profile": "PREMIUM",
  "role": "CUSTOMER",
  "iat": 1234567890,
  "exp": 1234596690
}
```

Valores posibles de `profile`: `STANDARD` · `PREMIUM` · `VIP` · `ADMIN`  
Valores posibles de `role`: `CUSTOMER` · `ADMIN`

## Contrato de errores

Todos los errores siguen el mismo formato:

```json
{
  "error": "ERROR_CODE",
  "message": "Mensaje legible para el usuario"
}
```

En caso de cuenta bloqueada (403) se añaden campos adicionales:

```json
{
  "error": "ACCOUNT_BLOCKED",
  "message": "Tu cuenta tiene pagos pendientes...",
  "reason": "DEBT",
  "supportContact": {
    "email": "soporte@secretosdelagua.com",
    "phone": "+34 900 000 000",
    "hours": "L-V 9:00-18:00"
  }
}
```

## Dependencias entre servicios

| Servicio | Llamada | Cuándo |
|---|---|---|
| `sap-integration-service` | `POST /internal/customers/verify` | Cada intento de login para verificar credenciales y estado de la cuenta |

En modo stub (`NODE_ENV !== 'production'`), esta llamada HTTP es sustituida por una búsqueda en la lista de fixtures en memoria.

## Estructura interna

```
src/
├── app.js                        # Arranque, plugins y registro de rutas
├── routes/
│   ├── auth.js                   # POST /login · GET /me · POST /logout · POST /verify
│   └── health.js                 # GET /health
├── services/
│   ├── authService.js            # Lógica de negocio (HU-01, HU-02, HU-03)
│   └── sapIntegrationClient.js   # Cliente HTTP hacia SAP Integration Service (con STUB)
├── schemas/
│   └── auth.js                   # Validación JSON Schema + definición OpenAPI
└── middleware/
    ├── authenticate.js            # Decorador fastify.authenticate para rutas protegidas
    └── errorHandler.js            # Gestión centralizada de errores
```

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Arranque con hot-reload (`--watch`) |
| `npm start` | Arranque en producción |
| `npm test` | Ejecuta los tests |

## Puerto por defecto

`3001` — cada microservicio usa un puerto distinto para poder arrancarlos todos localmente sin conflictos.
