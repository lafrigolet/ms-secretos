# Guía de contribución

Bienvenido al proyecto **Secretos del Agua**. Lee este documento antes de empezar a trabajar.

---

## Ramas

```
main        ← producción, siempre estable
develop     ← integración, base para todo el desarrollo
```

Nunca trabajes directamente en `main` ni en `develop`. Crea siempre una rama propia:

```bash
git checkout develop
git pull
git checkout -b feature/SDA-01-auth-login
```

### Nomenclatura de ramas

| Tipo | Patrón | Ejemplo |
|------|--------|---------|
| Nueva funcionalidad | `feature/SDA-XX-descripcion` | `feature/SDA-07-catalog-familias` |
| Corrección de bug | `fix/SDA-XX-descripcion` | `fix/SDA-14-cart-total-incorrecto` |
| Release | `release/X.X.X` | `release/1.0.0` |
| Hotfix urgente | `hotfix/descripcion` | `hotfix/login-bloqueado` |

El número `SDA-XX` corresponde a la historia de usuario del documento de requisitos.

---

## Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/). Formato:

```
tipo(servicio): descripción corta en imperativo
```

| Tipo | Cuándo usarlo |
|------|---------------|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `refactor` | Cambio interno sin impacto externo |
| `docs` | Solo documentación |
| `chore` | Configuración, build, infra |
| `test` | Tests |

**Ejemplos:**

```bash
git commit -m "feat(auth): añadir endpoint POST /auth/login"
git commit -m "fix(cart): corregir cálculo de gastos de envío"
git commit -m "docs(readme): actualizar instrucciones de arranque"
git commit -m "chore(docker): añadir healthcheck al auth-service"
```

---

## Flujo de trabajo

```bash
# 1. Partir siempre de develop actualizado
git checkout develop && git pull

# 2. Crear la rama
git checkout -b feature/SDA-07-catalog-familias

# 3. Desarrollar y commitear
git commit -m "feat(catalog): añadir GET /catalog/families"

# 4. Antes de hacer PR, actualizar con develop
git fetch origin
git rebase origin/develop

# 5. Subir la rama
git push origin feature/SDA-07-catalog-familias

# 6. Abrir Pull Request hacia develop en GitHub/GitLab
```

---

## Pull Requests

- El título del PR debe seguir el mismo formato que los commits: `feat(catalog): familias de productos`
- Incluye en la descripción las historias de usuario que implementa (`HU-07`, `HU-08`...)
- Un PR = una funcionalidad. No mezcles varias historias de usuario en el mismo PR
- Antes de pedir revisión, comprueba que `docker compose up --build` arranca sin errores

### Requisitos para hacer merge

| Rama destino | Aprobaciones | CI |
|---|---|---|
| `develop` | 1 | Verde obligatorio |
| `main` | 2 | Verde obligatorio |

El pipeline de CI tiene tres niveles que deben pasar en orden:
1. **Unit tests** — `npm test` en cada servicio (rápido, sin Docker)
2. **Integration tests** — todos los servicios arrancados, llamadas HTTP reales
3. **Build & deploy** — solo si los dos anteriores son verdes

---

## Trabajar en un microservicio de forma aislada

Cada servicio es independiente. Puedes arrancarlo sin Docker:

```bash
cd services/nombre-service
npm install
cp .env.example .env
npm run dev
```

Consulta el `README.md` de cada servicio para ver sus variables de entorno y los datos de prueba disponibles.

---

## Convenciones de API

Antes de implementar un nuevo endpoint o microservicio, lee **`CONVENTIONS.md`**.  
Define el formato de errores, códigos HTTP y enums que todos los servicios deben respetar.
