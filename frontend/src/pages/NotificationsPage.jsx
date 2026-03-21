import { useState } from 'react'
import { useAsync } from '../hooks/useAsync.js'
import { notifApi } from '../api/index.js'
import { Spinner } from '../components/Spinner.jsx'

const TYPE_ICONS = { STOCK_ALERT: '📦', PROMO_EXPIRY: '🏷️', MIN_ORDER: '🛒', COMMERCIAL: '👤', ADMIN_BROADCAST: '📢' }
const CHANNEL_LABELS = { EMAIL: 'Email', PUSH: 'Push', IN_APP: 'En la app' }
const TABS = ['Bandeja', 'Preferencias', 'Seguimiento de stock', 'Promociones']

// ── Bandeja de entrada ────────────────────────────────────────────
function InboxTab () {
  const { data, loading, refetch } = useAsync(() => notifApi.getInbox(), [])

  async function handleMarkRead (id) {
    await notifApi.markRead(id)
    refetch()
  }

  async function handleMarkAll () {
    await notifApi.markAllRead()
    refetch()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="section-label mb-0">Bandeja de entrada</p>
          {data?.unread > 0 && (
            <span className="tag bg-sage-dark text-off-white text-[10px]">{data.unread} nuevas</span>
          )}
        </div>
        {data?.unread > 0 && (
          <button onClick={handleMarkAll}
            className="text-xs text-muted hover:text-charcoal border-0 bg-transparent cursor-pointer underline underline-offset-2">
            Marcar todas como leídas
          </button>
        )}
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {!loading && data?.notifications?.length === 0 && (
        <div className="text-center py-12 text-muted">
          <p className="text-3xl mb-3">🔔</p>
          <p className="text-sm">Sin notificaciones</p>
        </div>
      )}

      <div className="space-y-2">
        {data?.notifications?.map(n => (
          <div
            key={n.id}
            className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
              !n.read ? 'bg-[#F7F8F5] border-sage-light/50' : 'bg-off-white border-border'
            }`}
          >
            <span className="text-xl flex-shrink-0">{TYPE_ICONS[n.type] ?? '🔔'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm ${!n.read ? 'font-medium text-charcoal' : 'text-charcoal'}`}>
                  {n.title}
                </p>
                <span className="text-xs text-muted whitespace-nowrap">
                  {new Date(n.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">{n.body}</p>
            </div>
            {!n.read && (
              <button onClick={() => handleMarkRead(n.id)}
                className="text-xs text-muted hover:text-charcoal border-0 bg-transparent cursor-pointer flex-shrink-0">
                ✓
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── HU-51 — Preferencias ─────────────────────────────────────────
function PreferencesTab () {
  const { data, loading, refetch } = useAsync(() => notifApi.getPreferences(), [])
  const [saving, setSaving] = useState(false)

  async function handleToggle (type, channel) {
    setSaving(true)
    try {
      const current = data.preferences[type][channel]
      await notifApi.updatePreferences({ [type]: { [channel]: !current } })
      refetch()
    } catch { alert('Error al guardar las preferencias') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div>
      <p className="section-label mb-1">Preferencias de notificación</p>
      <p className="text-xs text-muted mb-5">Elige qué notificaciones quieres recibir y por qué canal.</p>

      <div className="space-y-0">
        {/* Header de columnas */}
        <div className="flex items-center gap-4 py-2 border-b border-border">
          <div className="flex-1" />
          {Object.keys(CHANNEL_LABELS).map(ch => (
            <div key={ch} className="w-16 text-center text-[10px] uppercase tracking-wider text-muted font-medium">
              {CHANNEL_LABELS[ch]}
            </div>
          ))}
        </div>

        {data?.types?.map(type => (
          <div key={type.id} className="flex items-center gap-4 py-4 border-b border-border last:border-0">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span>{TYPE_ICONS[type.id] ?? '🔔'}</span>
                <p className="text-sm font-medium text-charcoal">{type.label}</p>
              </div>
              <p className="text-xs text-muted leading-relaxed">{type.description}</p>
            </div>
            {Object.keys(CHANNEL_LABELS).map(ch => {
              const enabled = data?.preferences?.[type.id]?.[ch] ?? false
              return (
                <div key={ch} className="w-16 flex justify-center">
                  <button
                    onClick={() => handleToggle(type.id, ch)}
                    disabled={saving}
                    className={`w-10 h-6 rounded-full transition-colors relative border-0 cursor-pointer ${
                      enabled ? 'bg-sage-dark' : 'bg-cream border border-border'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-off-white rounded-full shadow-sm transition-transform ${
                      enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── HU-48 — Watchlist de stock ────────────────────────────────────
function WatchlistTab () {
  const { data: watchlist, loading, refetch } = useAsync(() => notifApi.getWatchlist(), [])
  const [productCode, setProductCode] = useState('')
  const [productName, setProductName] = useState('')
  const [adding, setAdding]           = useState(false)

  async function handleAdd (e) {
    e.preventDefault()
    if (!productCode.trim() || !productName.trim()) return
    setAdding(true)
    try {
      await notifApi.addToWatchlist(productCode.trim(), productName.trim())
      setProductCode(''); setProductName('')
      refetch()
    } catch { alert('Error al añadir al seguimiento') }
    finally { setAdding(false) }
  }

  async function handleRemove (code) {
    await notifApi.removeFromWatchlist(code)
    refetch()
  }

  return (
    <div>
      <p className="section-label mb-1">Seguimiento de stock</p>
      <p className="text-xs text-muted mb-5">
        Te avisaremos cuando un producto agotado vuelva a estar disponible.
      </p>

      {/* Formulario de alta */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input type="text" className="form-input text-sm flex-1" placeholder="Código SAP del producto"
          value={productCode} onChange={e => setProductCode(e.target.value)} />
        <input type="text" className="form-input text-sm flex-1" placeholder="Nombre del producto"
          value={productName} onChange={e => setProductName(e.target.value)} />
        <button type="submit" disabled={adding || !productCode || !productName}
          className="btn-primary text-sm flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50">
          {adding ? <Spinner size="sm" /> : '+ Añadir'}
        </button>
      </form>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {!loading && watchlist?.length === 0 && (
        <div className="text-center py-8 text-muted">
          <p className="text-3xl mb-2">📦</p>
          <p className="text-sm">No tienes productos en seguimiento</p>
        </div>
      )}

      <div className="space-y-2">
        {watchlist?.map(item => (
          <div key={item.productCode} className="flex items-center gap-4 p-4 bg-cream rounded-xl">
            <span className="text-xl">📦</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-charcoal">{item.productName}</p>
              <p className="text-xs text-muted">{item.productCode} · Añadido el {new Date(item.addedAt).toLocaleDateString('es-ES')}</p>
            </div>
            <button onClick={() => handleRemove(item.productCode)}
              className="text-xs text-muted hover:text-error border-0 bg-transparent cursor-pointer transition-colors">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── HU-49 — Promociones próximas a vencer ────────────────────────
function ExpiringPromosTab () {
  const [days, setDays] = useState(7)
  const { data, loading } = useAsync(() => notifApi.getExpiringPromos(days), [days])

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="section-label mb-0.5">Promociones próximas a vencer</p>
          <p className="text-xs text-muted">Aplicables a tu perfil de cliente</p>
        </div>
        <div className="flex gap-1.5">
          {[3, 7, 14].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                days === d ? 'bg-sage-dark text-off-white border-sage-dark' : 'bg-cream text-muted border-border hover:border-sage'
              }`}
            >{d} días</button>
          ))}
        </div>
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {!loading && data?.promos?.length === 0 && (
        <div className="text-center py-8 text-muted">
          <p className="text-3xl mb-2">🏷️</p>
          <p className="text-sm">No hay promociones próximas a vencer en los próximos {days} días</p>
        </div>
      )}

      <div className="space-y-3">
        {data?.promos?.map(promo => (
          <div key={promo.promoId} className="flex items-start gap-4 p-4 bg-[#FDF8EE] border border-[#E8D9B0] rounded-xl">
            <span className="text-2xl">🏷️</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-charcoal">{promo.name}</p>
                <span className="tag bg-[#F7F3E8] text-gold text-[10px]">
                  {promo.daysLeft === 1 ? 'Vence mañana' : `Vence en ${promo.daysLeft} días`}
                </span>
              </div>
              <p className="text-xs text-muted">{promo.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── NotificationsPage ─────────────────────────────────────────────
export function NotificationsPage () {
  const [activeTab, setActiveTab] = useState('Bandeja')
  const { data: inbox } = useAsync(() => notifApi.getInbox(), [])
  const unread = inbox?.unread ?? 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">Notificaciones</h1>
        <p className="page-subtitle">Alertas, seguimiento de stock y preferencias de comunicación</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-border">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === tab ? 'border-sage-dark text-sage-dark' : 'border-transparent text-muted hover:text-charcoal'
            }`}
          >
            {tab}
            {tab === 'Bandeja' && unread > 0 && (
              <span className="tag bg-sage-dark text-off-white text-[10px]">{unread}</span>
            )}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'Bandeja'               && <InboxTab />}
        {activeTab === 'Preferencias'          && <PreferencesTab />}
        {activeTab === 'Seguimiento de stock'  && <WatchlistTab />}
        {activeTab === 'Promociones'           && <ExpiringPromosTab />}
      </div>
    </div>
  )
}
