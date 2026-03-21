/**
 * contentStore
 * Almacén en memoria de fichas técnicas, vídeos y novedades.
 *
 * Tipos de contenido:
 * - DATASHEET   → ficha técnica / protocolo descargable (HU-36)
 * - VIDEO       → vídeo formativo por producto/familia (HU-37)
 * - NEWS        → novedad o lanzamiento (HU-38)
 */

// ── Fichas técnicas — HU-36 ───────────────────────────────────────
export const datasheets = [
  {
    id: 'DS-001',
    productCode: 'P-RT-001',
    familyId: 'F01',
    title: 'Ficha técnica — Champú Restaurador Timeless',
    description: 'Composición, modo de aplicación y beneficios del Champú Restaurador de la línea Ritual Timeless.',
    fileType: 'PDF',
    fileSizeKb: 420,
    downloadUrl: '/content/datasheets/DS-001.pdf',
    createdAt: '2024-09-01T00:00:00.000Z',
    updatedAt: '2024-09-01T00:00:00.000Z',
    active: true
  },
  {
    id: 'DS-002',
    productCode: 'P-RT-002',
    familyId: 'F01',
    title: 'Protocolo de tratamiento — Mascarilla Timeless',
    description: 'Guía paso a paso para aplicar el tratamiento intensivo en cabello dañado o sometido a procesos químicos.',
    fileType: 'PDF',
    fileSizeKb: 610,
    downloadUrl: '/content/datasheets/DS-002.pdf',
    createdAt: '2024-09-15T00:00:00.000Z',
    updatedAt: '2025-01-10T00:00:00.000Z',
    active: true
  },
  {
    id: 'DS-003',
    productCode: null,
    familyId: 'F01',
    title: 'Catálogo completo — Ritual Timeless',
    description: 'Presentación completa de la gama Ritual Timeless con todos los productos, precios de referencia e ingredientes clave.',
    fileType: 'PDF',
    fileSizeKb: 2048,
    downloadUrl: '/content/datasheets/DS-003.pdf',
    createdAt: '2024-10-01T00:00:00.000Z',
    updatedAt: '2025-02-01T00:00:00.000Z',
    active: true
  },
  {
    id: 'DS-004',
    productCode: 'P-SN-001',
    familyId: 'F02',
    title: 'Ficha técnica — Champú Sensitivo',
    description: 'Formulación hipoalergénica sin sulfatos para cueros cabelludos sensibles o reactivos.',
    fileType: 'PDF',
    fileSizeKb: 380,
    downloadUrl: '/content/datasheets/DS-004.pdf',
    createdAt: '2024-11-01T00:00:00.000Z',
    updatedAt: '2024-11-01T00:00:00.000Z',
    active: true
  }
]

// ── Vídeos formativos — HU-37 ─────────────────────────────────────
export const videos = [
  {
    id: 'VID-001',
    productCode: 'P-RT-001',
    familyId: 'F01',
    title: 'Cómo aplicar el Champú Restaurador Timeless',
    description: 'Técnica correcta de aplicación para maximizar el efecto restaurador en cabello con daño severo.',
    duration: '4:32',
    thumbnailUrl: '/content/thumbnails/VID-001.jpg',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    createdAt: '2024-09-10T00:00:00.000Z',
    active: true
  },
  {
    id: 'VID-002',
    productCode: null,
    familyId: 'F01',
    title: 'Ritual Timeless completo — protocolo de 3 pasos',
    description: 'Guía visual del protocolo completo de la línea: champú, mascarilla y aceite acabado.',
    duration: '8:15',
    thumbnailUrl: '/content/thumbnails/VID-002.jpg',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    createdAt: '2024-10-05T00:00:00.000Z',
    active: true
  },
  {
    id: 'VID-003',
    productCode: null,
    familyId: 'F02',
    title: 'Tratamientos para cuero cabelludo reactivo',
    description: 'Formación avanzada sobre cómo abordar pieles sensibles con la gama Sensitivo.',
    duration: '6:48',
    thumbnailUrl: '/content/thumbnails/VID-003.jpg',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    createdAt: '2024-11-20T00:00:00.000Z',
    active: true
  }
]

// ── Novedades y lanzamientos — HU-38 ─────────────────────────────
export const news = [
  {
    id: 'NEWS-001',
    title: 'Lanzamiento: Aceite Brillo Argán — edición especial primavera',
    summary: 'Nuestra nueva formulación con aceite de argán marroquí certificado llega esta primavera con packaging biodegradable.',
    body: 'El nuevo Aceite Brillo Argán incorpora una concentración del 15% de aceite de argán puro certificado por COSMOS Organic. Disponible desde el 1 de abril para todos los perfiles. Los clientes VIP y Premium tendrán acceso anticipado desde el 25 de marzo.',
    imageUrl: '/content/news/NEWS-001.jpg',
    tags: ['lanzamiento', 'Brillo & Nutrición', 'sostenibilidad'],
    publishedAt: '2025-03-01T09:00:00.000Z',
    active: true,
    featured: true
  },
  {
    id: 'NEWS-002',
    title: 'Nueva formación: protocolo anti-rotura intensivo',
    summary: 'Añadimos a nuestra biblioteca un protocolo exclusivo para tratamiento de cabello con rotura severa.',
    body: 'El protocolo anti-rotura intensivo está diseñado para salones que trabajan con clientas con mucho daño por procesos químicos o térmicos. Incluye ficha técnica, vídeo y recomendaciones de reventa.',
    imageUrl: '/content/news/NEWS-002.jpg',
    tags: ['formación', 'protocolo', 'Ritual Timeless'],
    publishedAt: '2025-02-10T09:00:00.000Z',
    active: true,
    featured: false
  },
  {
    id: 'NEWS-003',
    title: 'Secretos del Agua en Cosmoprof Bolonia 2025',
    summary: 'Estaremos presentes en el Pabellón 14, Stand C22. Visítanos del 20 al 23 de marzo.',
    body: 'Presentaremos en exclusiva los nuevos productos de la gama Sensitivo reformulada y las nuevas ediciones limitadas de la colección Ritual Timeless Oro.',
    imageUrl: '/content/news/NEWS-003.jpg',
    tags: ['evento', 'feria', 'novedades'],
    publishedAt: '2025-01-25T09:00:00.000Z',
    active: true,
    featured: false
  }
]

// ── Mutaciones ────────────────────────────────────────────────────
let dsCounter   = datasheets.length + 1
let vidCounter  = videos.length     + 1
let newsCounter = news.length       + 1

export function createDatasheet (data) {
  const ds = { id: `DS-${String(dsCounter++).padStart(3, '0')}`, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), active: true }
  datasheets.push(ds); return ds
}

export function updateDatasheet (id, data) {
  const ds = datasheets.find(d => d.id === id)
  if (!ds) return null
  Object.assign(ds, data, { updatedAt: new Date().toISOString() })
  return ds
}

export function createVideo (data) {
  const vid = { id: `VID-${String(vidCounter++).padStart(3, '0')}`, ...data, createdAt: new Date().toISOString(), active: true }
  videos.push(vid); return vid
}

export function updateVideo (id, data) {
  const vid = videos.find(v => v.id === id)
  if (!vid) return null
  Object.assign(vid, data); return vid
}

export function createNews (data) {
  const item = { id: `NEWS-${String(newsCounter++).padStart(3, '0')}`, ...data, publishedAt: new Date().toISOString(), active: true, featured: data.featured ?? false }
  news.push(item); return item
}

export function updateNews (id, data) {
  const item = news.find(n => n.id === id)
  if (!item) return null
  Object.assign(item, data); return item
}
