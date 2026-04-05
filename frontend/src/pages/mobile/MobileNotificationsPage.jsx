import { useState, useEffect } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { notifApi } from '../../api/index.js'
import { Spinner } from '../../components/Spinner.jsx'

const TYPE_META = {
  STOCK_ALERT:       { icon: '📦', bg: '#EBF0F4', color: '#3A5F8A' },
  PROMO_EXPIRY:      { icon: '🏷️', bg: '#F7F3E8', color: '#8C6E52' },
  MIN_ORDER:         { icon: '🛒', bg: '#F7F3E8', color: '#8C6E52' },
  COMMERCIAL:        { icon: '👤', bg: '#F4EDE4', color: '#8C6E52' },
  ADMIN_BROADCAST:   { icon: '📢', bg: '#EEF4EA', color: '#4A7054' },
}
const CHANNEL_LABELS = { EMAIL: 'Email', PUSH: 'Push', IN_APP: 'En app' }
const TABS = ['Bandeja', 'Preferencias', 'Seguimiento', 'Promociones']

const card = { background: '#FDFCFA', boxShadow: '0 2px 16px rgba(44,44,40,0.06)' }

function TabBar ({ active, onChange, unread }) {
  return (
    <div className="overflow-x-auto scrollbar-none px-4" style={{ borderBottom: '1px solid rgba(226,221,214,0.6)' }}>
      <div className="flex gap-1" style={{ minWidth: 'max-content' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => onChange(tab)}
            className="px-4 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-1.5"
            style={{ borderColor: active === tab ? '#4A5740' : 'transparent', color: active === tab ? '#4A5740' : '#B0ADA7' }}>
            {tab}
            {tab === 'Bandeja' && unread > 0 && (
              <span className="min-w-[18px] h-[18px] text-off-white text-[10px] font-semibold  flex items-center justify-center px-1"
                style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)' }}>
                {unread}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function InboxTab () {
  const { data, loading, refetch } = useAsync(() => notifApi.getInbox(), [])

  async function handleMarkRead (id) { await notifApi.markRead(id); refetch() }
  async function handleMarkAll ()    { await notifApi.markAllRead(); refetch() }

  return (
    <div>
      {data?.unread > 0 && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-medium px-3 py-1.5  text-off-white"
            style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)' }}>
            {data.unread} nuevas
          </span>
          <button onClick={handleMarkAll} className="text-xs text-muted underline underline-offset-2">
            Marcar todas leídas
          </button>
        </div>
      )}

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}
      {!loading && data?.notifications?.length === 0 && (
        <div className="text-center py-12">
          <div className="w-18 h-18 w-16 h-16  flex items-center justify-center text-3xl mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#C8D4BE,#DFE9D9)' }}>🔔</div>
          <p className="font-serif text-xl font-light text-charcoal mb-1">Sin notificaciones</p>
          <p className="text-sm text-muted">Aquí verás todos tus avisos</p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {data?.notifications?.map(n => {
          const meta = TYPE_META[n.type] ?? { icon: '🔔', bg: '#F2EFE9', color: '#8A8880' }
          return (
            <div key={n.id}
              className="flex items-start gap-3.5 p-4"
              style={!n.read
                ? { ...card, background: '#F7F8F5' }
                : card
              }
            >
              <div className="w-10 h-10  flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: meta.bg, minWidth: '40px' }}>
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <p className={`text-sm ${!n.read ? 'font-medium text-charcoal' : 'text-charcoal'}`}>{n.title}</p>
                  <span className="text-[10px] text-muted/60 whitespace-nowrap flex-shrink-0">
                    {new Date(n.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">{n.body}</p>
              </div>
              {!n.read && (
                <button onClick={() => handleMarkRead(n.id)}
                  className="text-muted/50 w-7 h-7 flex items-center justify-center flex-shrink-0 text-sm">✓</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Toggle ({ checked, onChange }) {
  return (
    <button onClick={onChange}
      className="flex-shrink-0 w-11 h-6  relative transition-colors"
      style={{ background: checked ? 'linear-gradient(135deg,#4A5740,#6B7B5E)' : '#E2DDD6' }}>
      <span className="absolute top-0.5 left-0 w-5 h-5 bg-white shadow-sm transition-transform"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }} />
    </button>
  )
}

function PreferencesTab () {
  const { data, loading } = useAsync(() => notifApi.getPreferences(), [])
  const [localPrefs, setLocalPrefs] = useState(null)

  useEffect(() => {
    if (data?.preferences) setLocalPrefs(data.preferences)
  }, [data])

  async function handleToggle (type, channel) {
    const prev = localPrefs
    const newPrefs = {
      ...localPrefs,
      [type]: { ...localPrefs[type], [channel]: !localPrefs[type][channel] }
    }
    setLocalPrefs(newPrefs)
    try {
      await notifApi.updatePreferences({ [type]: { [channel]: newPrefs[type][channel] } })
    } catch {
      setLocalPrefs(prev)
      alert('Error al guardar')
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>

  return (
    <div>
      <p className="text-sm text-muted mb-5 leading-relaxed">
        Elige qué notificaciones recibir y por qué canal.
      </p>
      <div className="flex flex-col gap-3">
        {data?.types?.map(type => {
          const meta = TYPE_META[type.id] ?? { icon: '🔔', bg: '#F2EFE9' }
          return (
            <div key={type.id} className="p-4" style={card}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10  flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: meta.bg }}>
                  {meta.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-charcoal">{type.label}</p>
                  <p className="text-xs text-muted leading-relaxed">{type.description}</p>
                </div>
              </div>
              <div className="flex gap-4">
                {Object.entries(CHANNEL_LABELS).map(([ch, label]) => {
                  const enabled = localPrefs?.[type.id]?.[ch] ?? false
                  return (
                    <div key={ch} className="flex items-center gap-2">
                      <Toggle checked={enabled} onChange={() => handleToggle(type.id, ch)} />
                      <span className="text-xs text-muted">{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WatchlistTab () {
  const { data: watchlist, loading, refetch } = useAsync(() => notifApi.getWatchlist(), [])
  const [productCode, setProductCode] = useState('')
  const [productName, setProductName] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd (e) {
    e.preventDefault()
    if (!productCode.trim() || !productName.trim()) return
    setAdding(true)
    try { await notifApi.addToWatchlist(productCode.trim(), productName.trim()); setProductCode(''); setProductName(''); refetch() }
    catch { alert('Error al añadir') }
    finally { setAdding(false) }
  }

  async function handleRemove (code) { await notifApi.removeFromWatchlist(code); refetch() }

  return (
    <div>
      <p className="text-sm text-muted mb-4 leading-relaxed">
        Te avisaremos cuando un producto agotado vuelva a tener stock.
      </p>
      <form onSubmit={handleAdd} className="flex flex-col gap-2 mb-6">
        <input type="text" className="w-full  px-5 py-4 text-sm outline-none"
          style={{ background: '#F2EFE9' }}
          placeholder="Código SAP del producto"
          value={productCode} onChange={e => setProductCode(e.target.value)} />
        <input type="text" className="w-full  px-5 py-4 text-sm outline-none"
          style={{ background: '#F2EFE9' }}
          placeholder="Nombre del producto"
          value={productName} onChange={e => setProductName(e.target.value)} />
        <button type="submit" disabled={adding || !productCode || !productName}
          className="py-4  text-sm font-medium text-off-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.97] transition-all"
          style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', boxShadow: '0 4px 14px rgba(74,87,64,0.25)' }}>
          {adding ? <Spinner size="sm" /> : '+ Añadir al seguimiento'}
        </button>
      </form>

      {loading && <div className="flex justify-center py-6"><Spinner /></div>}
      {!loading && watchlist?.length === 0 && (
        <div className="text-center py-8 text-muted">
          <div className="w-14 h-14  flex items-center justify-center text-2xl mx-auto mb-3"
            style={{ background: 'linear-gradient(135deg,#B8CDD4,#D4E4EA)' }}>📦</div>
          <p className="text-sm">No tienes productos en seguimiento</p>
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        {watchlist?.map(item => (
          <div key={item.productCode}
            className="flex items-center gap-3.5 p-4" style={card}>
            <div className="w-10 h-10  flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#B8CDD4,#D4E4EA)' }}>📦</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-charcoal">{item.productName}</p>
              <p className="text-xs text-muted">{item.productCode}</p>
            </div>
            <button onClick={() => handleRemove(item.productCode)}
              className="text-muted/50 w-8 h-8 flex items-center justify-center text-xl active:scale-90 transition-transform">✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExpiringPromosTab () {
  const [days, setDays] = useState(7)
  const { data, loading } = useAsync(() => notifApi.getExpiringPromos(days), [days])

  return (
    <div>
      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-none">
        {[3, 7, 14].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className="px-4 py-2  text-sm transition-all"
            style={d === days
              ? { background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', color: '#FDFCFA', boxShadow: '0 3px 12px rgba(74,87,64,0.25)' }
              : { background: '#FDFCFA', color: '#8A8880', boxShadow: '0 1px 4px rgba(44,44,40,0.06)' }
            }>
            {d} días
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-6"><Spinner /></div>}
      {!loading && data?.promos?.length === 0 && (
        <div className="text-center py-8">
          <div className="w-14 h-14  flex items-center justify-center text-2xl mx-auto mb-3"
            style={{ background: 'linear-gradient(135deg,#E8D4A0,#F0E4CB)' }}>🏷️</div>
          <p className="text-sm text-muted">No hay promociones próximas a vencer</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {data?.promos?.map(promo => (
          <div key={promo.promoId}
            className="flex items-start gap-4 p-4"
            style={{ ...card, background: 'linear-gradient(135deg,#FDF8EE,#FDFBF4)' }}>
            <div className="w-10 h-10  flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: '#F7F3E8' }}>🏷️</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-medium text-charcoal">{promo.name}</p>
                <span className="text-[10px] font-medium px-2 py-0.5 "
                  style={{ background: 'rgba(184,150,60,0.12)', color: '#8C6E52' }}>
                  {promo.daysLeft === 1 ? 'Vence mañana' : `${promo.daysLeft} días`}
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">{promo.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MobileNotificationsPage () {
  const [activeTab, setActiveTab] = useState('Bandeja')
  const { data: inbox } = useAsync(() => notifApi.getInbox(), [])
  const unread = inbox?.unread ?? 0

  return (
    <div>
      <div className="px-4 pt-5 mb-4">
        <h1 className="font-serif text-[34px] font-light text-charcoal leading-none mb-1">Notificaciones</h1>
        <p className="text-sm text-muted">Avisos, preferencias y seguimiento</p>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} unread={unread} />

      <div className="px-4 pt-5 pb-8">
        {activeTab === 'Bandeja'       && <InboxTab />}
        {activeTab === 'Preferencias'  && <PreferencesTab />}
        {activeTab === 'Seguimiento'   && <WatchlistTab />}
        {activeTab === 'Promociones'   && <ExpiringPromosTab />}
      </div>
    </div>
  )
}
