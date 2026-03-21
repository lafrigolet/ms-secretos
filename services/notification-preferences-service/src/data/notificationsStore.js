/**
 * notificationsStore
 * Almacén en memoria de preferencias, alertas y comunicaciones.
 *
 * Tipos de notificación (HU-51):
 * - STOCK_ALERT       → producto agotado vuelve a estar disponible (HU-48)
 * - PROMO_EXPIRY      → promoción próxima a vencer (HU-49)
 * - MIN_ORDER         → aviso de pedido mínimo no alcanzado (HU-50)
 * - COMMERCIAL        → comunicaciones del comercial
 * - ADMIN_BROADCAST   → comunicaciones segmentadas del admin (HU-52)
 *
 * Canales (HU-51):
 * - EMAIL, PUSH, IN_APP
 */

export const NOTIFICATION_TYPES = [
  { id: 'STOCK_ALERT',     label: 'Reposición de stock',          description: 'Aviso cuando un producto agotado vuelve a estar disponible' },
  { id: 'PROMO_EXPIRY',    label: 'Promociones próximas a vencer', description: 'Recordatorio antes de que expire una promoción aplicable' },
  { id: 'MIN_ORDER',       label: 'Pedido mínimo',                 description: 'Aviso antes de confirmar si no se alcanza el mínimo para envío gratis' },
  { id: 'COMMERCIAL',      label: 'Comunicaciones del comercial',  description: 'Mensajes y pedidos sugeridos de tu representante' },
  { id: 'ADMIN_BROADCAST', label: 'Novedades y comunicados',       description: 'Comunicaciones generales de Secretos del Agua' },
]

export const CHANNELS = ['EMAIL', 'PUSH', 'IN_APP']

// Preferencias por defecto para nuevos clientes
const DEFAULT_PREFERENCES = () => ({
  STOCK_ALERT:     { EMAIL: true,  PUSH: true,  IN_APP: true  },
  PROMO_EXPIRY:    { EMAIL: true,  PUSH: false, IN_APP: true  },
  MIN_ORDER:       { EMAIL: false, PUSH: false, IN_APP: true  },
  COMMERCIAL:      { EMAIL: true,  PUSH: true,  IN_APP: true  },
  ADMIN_BROADCAST: { EMAIL: true,  PUSH: false, IN_APP: true  },
})

// Preferencias por cliente { sapCode → preferences }
const preferences = {
  'SDA-00423': DEFAULT_PREFERENCES(),
  'SDA-00521': { ...DEFAULT_PREFERENCES(), PROMO_EXPIRY: { EMAIL: true, PUSH: true, IN_APP: true } },
  'SDA-00387': DEFAULT_PREFERENCES(),
}

// Alertas de stock (HU-48) — productos en watchlist
const stockWatchlist = [
  { sapCode: 'SDA-00423', productCode: 'P-RT-002', productName: 'Mascarilla Timeless', addedAt: '2025-03-01T00:00:00.000Z' },
  { sapCode: 'SDA-00521', productCode: 'P-BN-001', productName: 'Aceite Brillo Argán', addedAt: '2025-02-28T00:00:00.000Z' },
]

// Bandeja de entrada — notificaciones recibidas
const inbox = [
  {
    id: 'NOTIF-001', sapCode: 'SDA-00423', type: 'STOCK_ALERT',
    title: '¡Mascarilla Timeless disponible!',
    body: 'La Mascarilla Timeless que tenías en seguimiento ha vuelto a tener stock. ¡Añádela a tu próximo pedido!',
    read: false, createdAt: '2025-03-12T09:00:00.000Z', metadata: { productCode: 'P-RT-002' }
  },
  {
    id: 'NOTIF-002', sapCode: 'SDA-00423', type: 'PROMO_EXPIRY',
    title: 'Promoción Ritual Timeless vence en 3 días',
    body: 'La promoción "Compra ×6 → muestra gratis" vence el 15 de marzo. ¡No la dejes escapar!',
    read: false, createdAt: '2025-03-12T08:00:00.000Z', metadata: { promoId: 'P001' }
  },
  {
    id: 'NOTIF-003', sapCode: 'SDA-00423', type: 'ADMIN_BROADCAST',
    title: 'Nuevos productos primavera 2025',
    body: 'Descubre los lanzamientos de primavera en nuestro portal. Aceite Brillo Argán edición especial ya disponible.',
    read: true, createdAt: '2025-03-01T09:00:00.000Z', metadata: {}
  },
]

// Comunicaciones segmentadas (HU-52)
const broadcasts = [
  {
    id: 'BC-001', adminId: 'ADMIN-001',
    title: 'Campaña primavera 2025',
    body: 'Os presentamos los nuevos productos de la colección primavera. Disponibles para pedido desde el 1 de abril.',
    segments: { profiles: ['PREMIUM', 'VIP'], status: 'ACTIVE' },
    channel: 'EMAIL', sentAt: '2025-03-01T09:00:00.000Z', recipientCount: 12
  }
]

let notifCounter = inbox.length + 1
let bcCounter    = broadcasts.length + 1

// ── Funciones de preferencias (HU-51) ────────────────────────────
export function getPreferences (sapCode) {
  if (!preferences[sapCode]) preferences[sapCode] = DEFAULT_PREFERENCES()
  return preferences[sapCode]
}

export function updatePreferences (sapCode, updates) {
  if (!preferences[sapCode]) preferences[sapCode] = DEFAULT_PREFERENCES()
  for (const [type, channels] of Object.entries(updates)) {
    if (preferences[sapCode][type]) {
      Object.assign(preferences[sapCode][type], channels)
    }
  }
  return preferences[sapCode]
}

// ── Funciones de bandeja de entrada ──────────────────────────────
export function getInbox (sapCode) {
  return inbox.filter(n => n.sapCode === sapCode)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function markAsRead (sapCode, notifId) {
  const notif = inbox.find(n => n.id === notifId && n.sapCode === sapCode)
  if (notif) notif.read = true
  return notif
}

export function markAllAsRead (sapCode) {
  inbox.filter(n => n.sapCode === sapCode).forEach(n => { n.read = true })
}

export function getUnreadCount (sapCode) {
  return inbox.filter(n => n.sapCode === sapCode && !n.read).length
}

// ── Funciones de watchlist (HU-48) ───────────────────────────────
export function getWatchlist (sapCode) {
  return stockWatchlist.filter(w => w.sapCode === sapCode)
}

export function addToWatchlist (sapCode, productCode, productName) {
  const existing = stockWatchlist.find(w => w.sapCode === sapCode && w.productCode === productCode)
  if (existing) return existing
  const entry = { sapCode, productCode, productName, addedAt: new Date().toISOString() }
  stockWatchlist.push(entry)
  return entry
}

export function removeFromWatchlist (sapCode, productCode) {
  const idx = stockWatchlist.findIndex(w => w.sapCode === sapCode && w.productCode === productCode)
  if (idx === -1) return false
  stockWatchlist.splice(idx, 1)
  return true
}

// ── Funciones de broadcast (HU-52) ───────────────────────────────
export function getBroadcasts () {
  return [...broadcasts].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
}

export function createBroadcast (adminId, { title, body, segments, channel }) {
  const bc = {
    id: `BC-${String(bcCounter++).padStart(3, '0')}`,
    adminId, title, body,
    segments: segments ?? { profiles: ['STANDARD', 'PREMIUM', 'VIP'], status: 'ACTIVE' },
    channel: channel ?? 'EMAIL',
    sentAt: new Date().toISOString(),
    recipientCount: 0  // en producción se calcularía según segmento
  }
  // Crear notificaciones in-app para todos los destinatarios del segmento
  const profiles = segments?.profiles ?? ['STANDARD', 'PREMIUM', 'VIP']
  const targetCodes = Object.keys(preferences)
  for (const sapCode of targetCodes) {
    const prefs = preferences[sapCode]
    if (prefs?.ADMIN_BROADCAST?.IN_APP) {
      inbox.push({
        id: `NOTIF-${String(notifCounter++).padStart(3, '0')}`,
        sapCode, type: 'ADMIN_BROADCAST',
        title, body, read: false,
        createdAt: bc.sentAt, metadata: { broadcastId: bc.id }
      })
      bc.recipientCount++
    }
  }
  broadcasts.push(bc)
  return bc
}
