# content-service

Content management service. Serves technical datasheets, training videos, and news/launches to store managers. Admins can create, edit, and retire content items.

**Port:** 3012
**User stories:** HU-36 (technical datasheets), HU-37 (training videos), HU-38 (news and launches), HU-39 (admin content management)

---

## Quick Start

```bash
cd services/content-service
npm install
npm run dev     # hot-reload on :3012
npm test        # node --test src/app.test.js
```

OpenAPI docs available at `http://localhost:3012/docs` while running.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3012` | No | Port to listen on |
| `HOST` | `0.0.0.0` | No | Bind address |
| `NODE_ENV` | — | No | `development` \| `production`. Controls log level |
| `JWT_SECRET` | — | **Yes** | Must match the secret used by `auth-service` |

---

## API Endpoints

### Customer endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/content/datasheets` | JWT | Active datasheets. Optional filters: `?familyId=`, `?productCode=` |
| `GET` | `/content/datasheets/:id` | JWT | Single datasheet |
| `GET` | `/content/videos` | JWT | Active training videos. Optional filters: `?familyId=`, `?productCode=` |
| `GET` | `/content/videos/:id` | JWT | Single video |
| `GET` | `/content/news` | JWT | Active news, sorted newest-first. Optional `?featured=true` |
| `GET` | `/content/news/:id` | JWT | Single news item |

### Admin endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/content/datasheets` | JWT + Admin | All datasheets including inactive |
| `POST` | `/admin/content/datasheets` | JWT + Admin | Create a new datasheet |
| `PATCH` | `/admin/content/datasheets/:id` | JWT + Admin | Edit or retire a datasheet |
| `GET` | `/admin/content/videos` | JWT + Admin | All videos including inactive |
| `POST` | `/admin/content/videos` | JWT + Admin | Add a training video |
| `PATCH` | `/admin/content/videos/:id` | JWT + Admin | Edit or retire a video |
| `GET` | `/admin/content/news` | JWT + Admin | All news including inactive |
| `POST` | `/admin/content/news` | JWT + Admin | Publish a news item |
| `PATCH` | `/admin/content/news/:id` | JWT + Admin | Edit or retire a news item |
| `GET` | `/health` | Public | Health check |

---

## Data Models

### Datasheet

```json
{
  "id": "DS-001",
  "title": "Ficha técnica Champú Ritual Timeless",
  "familyId": "F01",
  "productCode": "P-RT-001",
  "fileType": "PDF",
  "downloadUrl": "https://cdn.secretosdelagua.com/datasheets/DS-001.pdf",
  "active": true
}
```

**File types:** `PDF` | `DOCX` | `ZIP`

### Video

```json
{
  "id": "VID-001",
  "title": "Técnica de aplicación Ritual Timeless",
  "familyId": "F01",
  "productCode": "P-RT-001",
  "videoUrl": "https://vimeo.com/...",
  "duration": "5:32",
  "thumbnailUrl": "https://cdn.../thumb.jpg",
  "active": true
}
```

### News

```json
{
  "id": "NEWS-001",
  "title": "Lanzamiento nueva gama Brillo Natural",
  "body": "<p>...</p>",
  "featured": true,
  "tags": ["lanzamiento", "brillo"],
  "publishedAt": "2024-11-15T09:00:00.000Z",
  "active": true
}
```

---

## Inter-service Dependencies

None. This service is standalone — it holds its own content data.

---

## Storage

All content (datasheets, videos, news) is stored **in memory** (`contentStore.js`). Data is lost on restart.

> **Production note:** Replace with a persistent database (PostgreSQL, MongoDB). File assets should be stored in object storage (S3, Azure Blob) and referenced by URL.

---

## Internal Structure

```
src/
├── app.js
├── routes/
│   ├── content.js        # Customer endpoints
│   └── admin.js          # Admin CRUD endpoints
├── data/
│   └── contentStore.js   # In-memory arrays for datasheets, videos, news
└── middleware/
    ├── authenticate.js
    └── errorHandler.js
```
