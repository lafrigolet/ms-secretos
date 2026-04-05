# TODO

## Operacional

- [ ] **Versionado de imágenes Docker** — publicar cada imagen con el SHA del commit además de `:latest` para poder hacer rollback a una release concreta
- [ ] **Health checks en docker-compose** — añadir `healthcheck:` en cada servicio para que Docker sepa si arrancó correctamente
- [ ] **Logs centralizados** — agregar los logs de todos los servicios en un único sitio (Loki, Papertrail, etc.) para facilitar el diagnóstico en producción

## Seguridad

- [ ] **Rate limiting en login** — el endpoint `POST /auth/login` es vulnerable a fuerza bruta; añadir límite de intentos por IP
- [ ] **Refresh token** — los JWT actuales tienen expiración larga; introducir tokens de corta duración + refresh token reduce el impacto de una filtración
- [ ] **HTTPS** — verificar que Nginx termina TLS en producción; si el tráfico va por HTTP es un problema grave

## Resiliencia

- [ ] **Reintentos con backoff en clientes HTTP** — los clientes entre servicios fallan inmediatamente si el destino tarda; añadir reintentos con espera exponencial
- [ ] **Circuit breaker** — si un servicio dependiente cae, el llamante sigue intentando y puede colapsar en cascada; un circuit breaker corta el ciclo

## Frontend

- [ ] **Caché de API responses con React Query** — sustituir `useAsync` por `useQuery` en las páginas de catálogo, pedidos y promociones para mostrar datos en caché inmediatamente mientras se refresca en background
- [ ] **PWA / offline** — añadir un service worker básico para que la app funcione sin conexión en consulta de catálogo y pedidos recientes

## Producto

- [ ] **Notificaciones push** — el servicio de notificaciones ya existe; añadir Web Push para que los managers reciban alertas aunque la app esté cerrada
