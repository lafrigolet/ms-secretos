# Secretos del Agua — Portal B2B

Portal de gestión de pedidos B2B para responsables de tienda.  
Arquitectura de microservicios independientes · Fastify · React + Vite · Docker

---

## Estructura del proyecto

```
secretos-del-agua/
│
├── docker-compose.yml              # Orquestación completa en desarrollo
├── .env.example                    # Variables de entorno globales (copiar a .env)
├── CONVENTIONS.md                  # Contrato de API compartido entre equipos
├── README.md
│
├── services/                       # Microservicios backend (cada uno es independiente)
│   │
│   ├── auth-service/               # Puerto 3001 · HU-01, HU-02, HU-03
│   ├── catalog-service/            # Puerto 3002 · HU-07, HU-08, HU-09
│   ├── customer-profile-service/   # Puerto 3003 · HU-04, HU-05
│   ├── promotions-service/         # Puerto 3004 · HU-10, HU-11, HU-12, HU-13
│   ├── cart-service/               # Puerto 3005 · HU-14, HU-15, HU-16
│   ├── order-service/              # Puerto 3006 · HU-17, HU-18, HU-19, HU-21
│   ├── notification-service/       # Puerto 3007 · HU-17
│   ├── invoice-service/            # Puerto 3008 · HU-20
│   ├── audit-service/              # Puerto 3009 · HU-22
│   └── sap-integration-service/    # Puerto 3010 · HU-23
│
├── frontend/                       # React + Vite · Puerto 5173
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── App.jsx
│
└── infrastructure/
    ├── nginx/
    │   └── nginx.conf              # Reverse proxy hacia todos los servicios
    ├── monitoring/                 # (pendiente) Prometheus + Grafana
    └── scripts/                   # Scripts de utilidad
```

---

## Microservicios

Cada servicio es **completamente independiente**: tiene su propio `package.json`,
`Dockerfile`, `.env.example` y `README.md`. Un desarrollador puede clonar el repo
y trabajar en un único servicio sin necesidad de arrancar los demás.

| Servicio | Puerto | Historias de usuario | Estado |
|----------|--------|----------------------|--------|
| `auth-service` | 3001 | HU-01, HU-02, HU-03 | ✅ Implementado |
| `catalog-service` | 3002 | HU-07, HU-08, HU-09 | ✅ Implementado |
| `customer-profile-service` | 3003 | HU-04, HU-05 | ✅ Implementado |
| `promotions-service` | 3004 | HU-10, HU-11, HU-12, HU-13 | ✅ Implementado |
| `cart-service` | 3005 | HU-14, HU-15, HU-16 | ✅ Implementado |
| `order-service` | 3006 | HU-17, HU-18, HU-19, HU-21 | ✅ Implementado |
| `notification-service` | 3007 | HU-17 | ✅ Implementado |
| `invoice-service` | 3008 | HU-20 | ✅ Implementado |
| `audit-service` | 3009 | HU-22 | ✅ Implementado |
| `sap-integration-service` | 3010 | HU-23 | ✅ Pendiente |

---

## Arranque rápido

### Requisitos previos

- Node.js 20+
- Docker y Docker Compose

### Arrancar todo el stack

```bash
git clone <repo>
cd secretos-del-agua
cp .env.example .env
docker compose up
```

El frontend estará disponible en `http://localhost`.

### Trabajar en un único servicio (sin Docker)

```bash
cd services/auth-service
npm install
cp .env.example .env
npm run dev
```

Cada servicio tiene su propio `README.md` con instrucciones detalladas.

### Arrancar solo un servicio con Docker

```bash
docker compose up auth-service
```

---

## Tecnologías

| Capa | Tecnología |
|------|------------|
| Backend (servicios) | Node.js 20 · Fastify 4 |
| Autenticación | JWT (`@fastify/jwt`) |
| Documentación API | OpenAPI 3 (`@fastify/swagger`) |
| Frontend | React + Vite |
| Proxy / Gateway | Nginx |
| Contenedores | Docker · Docker Compose |
| Integración ERP | SAP (OData/RFC — según entorno) |

---

## Convenciones de desarrollo

Lee **`CONVENTIONS.md`** antes de implementar un nuevo servicio.  
Define el formato de errores, códigos HTTP, enums compartidos y la estructura
mínima que debe tener cada microservicio.

No existe código compartido entre servicios (`packages/`).  
Cada servicio define sus propias constantes siguiendo `CONVENTIONS.md`.

---

## Documentación de cada servicio

Todos los servicios exponen su API en `/docs` (Swagger UI) y un health check en `/health`.

| Servicio | Docs (desarrollo) |
|----------|-------------------|
| auth-service | http://localhost:3001/docs |
| catalog-service | http://localhost:3002/docs |
| customer-profile-service | http://localhost:3003/docs |
| promotions-service | http://localhost:3004/docs |
| cart-service | http://localhost:3005/docs |
| order-service | http://localhost:3006/docs |
| invoice-service | http://localhost:3008/docs |

---

## Guía para añadir un nuevo microservicio

1. Crear el directorio en `services/nombre-service/`
2. Seguir la estructura mínima definida en `CONVENTIONS.md`
3. Asignar el puerto correspondiente (ver tabla de microservicios)
4. Añadir el servicio comentado en `docker-compose.yml` y descomentar cuando esté listo
5. Añadir la ruta en `infrastructure/nginx/nginx.conf`
6. Actualizar la tabla de estado en este README
