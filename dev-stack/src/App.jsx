import { useState, useEffect } from 'react'

// ── Configuración de servicios ────────────────────────────────────
const SERVICES = [
  { name: 'auth-service',             healthUrl: '/api/auth-health',          docsUrl: 'http://localhost:3001/docs' },
  { name: 'catalog-service',          healthUrl: '/api/catalog-health',       docsUrl: 'http://localhost:3002/docs' },
  { name: 'customer-profile-service', healthUrl: '/api/profile-health',       docsUrl: 'http://localhost:3003/docs' },
  { name: 'promotions-service',       healthUrl: '/api/promotions-health',    docsUrl: 'http://localhost:3004/docs' },
  { name: 'cart-service',             healthUrl: '/api/cart-health',          docsUrl: 'http://localhost:3005/docs' },
  { name: 'order-service',            healthUrl: '/api/orders-health',        docsUrl: 'http://localhost:3006/docs' },
  { name: 'notification-service',     healthUrl: '/api/notifications-health', docsUrl: 'http://localhost:3007/docs' },
  { name: 'invoice-service',          healthUrl: '/api/invoices-health',      docsUrl: 'http://localhost:3008/docs' },
  { name: 'audit-service',            healthUrl: '/api/audit-health',         docsUrl: 'http://localhost:3009/docs' },
  { name: 'sap-integration-service',  healthUrl: '/api/sap-health',           docsUrl: 'http://localhost:3010/docs' },
  { name: 'returns-service',          healthUrl: '/api/returns-health',       docsUrl: 'http://localhost:3011/docs' },
  { name: 'content-service',          healthUrl: '/api/content-health',       docsUrl: 'http://localhost:3012/docs' },
  { name: 'intelligence-service',     healthUrl: '/api/intelligence-health',  docsUrl: 'http://localhost:3013/docs' },
  { name: 'commercial-service',       healthUrl: '/api/commercial-health',    docsUrl: 'http://localhost:3014/docs' },
  { name: 'notification-preferences-service', healthUrl: '/api/notif-prefs-health', docsUrl: 'http://localhost:3015/docs' },
  { name: 'sustainability-service',   healthUrl: '/api/sustainability-health',  docsUrl: 'http://localhost:3016/docs' },
  { name: 'subscription-service',    healthUrl: '/api/subscriptions-health',   docsUrl: 'http://localhost:3017/docs' },
]

// ── Helpers ───────────────────────────────────────────────────────
const s = {
  container: { maxWidth: 860, margin: '0 auto', padding: '32px 24px 64px', fontFamily: 'system-ui,sans-serif', color: '#e5e5e5', background: '#0f0f0f', minHeight: '100vh' },
  h1:        { fontSize: 24, fontWeight: 300, margin: '0 0 4px' },
  subtitle:  { color: '#4b5563', fontSize: 13, marginBottom: 28 },
  card:      { background: '#1a1a1a', borderRadius: 10, padding: 20, marginBottom: 16, border: '1px solid #2a2a2a' },
  h2:        { fontSize: 12, fontWeight: 500, margin: '0 0 14px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  td:        { padding: '7px 10px 7px 0', borderBottom: '1px solid #222', fontSize: 13 },
  btn:       (bg) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'system-ui' }),
  badge:     (bg) => ({ borderRadius: 4, padding: '2px 8px', fontSize: 11, background: bg ?? '#1e3a2f', color: '#4ade80' }),
  pre:       { background: '#111', borderRadius: 6, padding: 14, fontSize: 11, color: '#a3e635', overflowX: 'auto', marginTop: 10, lineHeight: 1.6, maxHeight: 280, overflowY: 'auto' },
  statusBadge: (status) => ({ borderRadius: 4, padding: '3px 10px', fontSize: 13, color: '#fff', background: status === 200 || status === 201 ? '#14532d' : status === 403 ? '#7f1d1d' : '#555' })
}

function hu (text) {
  return <span style={s.badge()}>{text}</span>
}

function Result ({ result }) {
  if (!result) return null
  return (
    <div>
      <span style={s.statusBadge(result.status)}>HTTP {result.status}</span>
      <pre style={s.pre}>{JSON.stringify(result.data, null, 2)}</pre>
    </div>
  )
}

// ── Estado de servicios ───────────────────────────────────────────
function ServiceRow ({ name, healthUrl, docsUrl }) {
  const [status, setStatus] = useState('loading')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    fetch(healthUrl)
      .then(r => r.json())
      .then(d => {
        setStatus(d.status === 'ok' ? 'ok' : 'error')
        setDetail(`uptime: ${Math.round(d.uptime ?? 0)}s${d.mode ? ` · modo: ${d.mode}` : ''}`)
      })
      .catch(() => setStatus('pending'))
  }, [healthUrl])

  const icon  = { loading: '⏳', ok: '✅', error: '⚠️', pending: '🔲' }[status]
  const color = { ok: '#4ade80', error: '#f87171', pending: '#6b7280', loading: '#facc15' }[status]

  return (
    <tr>
      <td style={s.td}>{icon}</td>
      <td style={{ ...s.td, fontFamily: 'monospace', color }}>{name}</td>
      <td style={{ ...s.td, fontSize: 12, color: '#6b7280' }}>{detail}</td>
      <td style={s.td}>
        {status === 'ok' && <a href={docsUrl} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', fontSize: 12 }}>/docs ↗</a>}
      </td>
    </tr>
  )
}

// ── Hook genérico para llamadas API ───────────────────────────────
function useApiCall () {
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)

  async function call (url, method = 'GET', body = null, token = null) {
    setLoading(true)
    setResult(null)
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {})
      })
      setResult({ status: res.status, data: await res.json() })
    } catch (e) {
      setResult({ status: 0, data: { message: e.message } })
    } finally {
      setLoading(false)
    }
  }

  return { result, loading, call }
}

// ── Secciones de test ─────────────────────────────────────────────
function AuthSection ({ onToken }) {
  const { result, loading, call } = useApiCall()

  async function login (sapCode, password) {
    await call('/api/auth/login', 'POST', { sapCode, password })
  }

  useEffect(() => {
    if (result?.status === 200 && result.data?.token) {
      onToken(result.data.token)
    }
  }, [result])

  const tests = [
    { label: 'Premium (OK)',          args: ['SDA-00423', 'demo1234'],  bg: '#14532d' },
    { label: 'VIP (OK)',              args: ['SDA-00521', 'demo1234'],  bg: '#1e3a5f' },
    { label: 'Bloqueada — deuda',     args: ['SDA-00187', 'demo1234'],  bg: '#7f1d1d' },
    { label: 'Bloqueada — admin',     args: ['SDA-00098', 'demo1234'],  bg: '#7f1d1d' },
    { label: 'Contraseña incorrecta', args: ['SDA-00423', 'wrongpass'], bg: '#555' },
    { label: 'Admin',                 args: ['ADMIN-001', 'admin1234'], bg: '#4a2970' },
  ]

  return (
    <div style={s.card}>
      <div style={s.sectionHeader}><h2 style={s.h2}>auth-service</h2>{hu('HU-01 · HU-02 · HU-03')}</div>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
        Al hacer login correctamente el token se captura y se usa automáticamente en el resto de secciones.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {tests.map(t => (
          <button key={t.label} style={s.btn(t.bg)} onClick={() => login(...t.args)} disabled={loading}>
            {t.label}
          </button>
        ))}
      </div>
      <Result result={result} />
    </div>
  )
}

function CatalogSection ({ token }) {
  const { result, loading, call } = useApiCall()

  const tests = [
    { label: 'Familias',             url: '/api/catalog/families' },
    { label: 'Todos los productos',  url: '/api/catalog/products' },
    { label: 'Familia F01',          url: '/api/catalog/products?familyId=F01' },
    { label: 'Ficha P-RT-001',       url: '/api/catalog/products/P-RT-001' },
    { label: 'Recomendaciones',      url: '/api/catalog/recommendations?cartItems=P-RT-001' },
  ]

  return (
    <div style={s.card}>
      <div style={s.sectionHeader}><h2 style={s.h2}>catalog-service</h2>{hu('HU-07 · HU-08 · HU-09')}</div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Haz login primero para obtener el token</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {tests.map(t => (
          <button key={t.label} style={s.btn('#1e3a5f')} onClick={() => call(t.url, 'GET', null, token)} disabled={loading || !token}>
            {t.label}
          </button>
        ))}
      </div>
      <Result result={result} />
    </div>
  )
}

function ProfileSection ({ token }) {
  const { result, loading, call } = useApiCall()

  const tests = [
    { label: 'Mi perfil',              url: '/api/profile/me',               method: 'GET' },
    { label: 'Check ORDER',            url: '/api/profile/check-permission', method: 'POST', body: { sapCode: 'SDA-00423', permission: 'ORDER' } },
    { label: 'Check VIEW_PROMOTIONS',  url: '/api/profile/check-permission', method: 'POST', body: { sapCode: 'SDA-00387', permission: 'VIEW_PROMOTIONS' } },
    { label: 'Check SPECIAL_CONDITIONS',url: '/api/profile/check-permission',method: 'POST', body: { sapCode: 'SDA-00521', permission: 'SPECIAL_CONDITIONS' } },
  ]

  return (
    <div style={s.card}>
      <div style={s.sectionHeader}><h2 style={s.h2}>customer-profile-service</h2>{hu('HU-04 · HU-05')}</div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Haz login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {tests.map(t => (
          <button key={t.label} style={s.btn('#4a2970')} onClick={() => call(t.url, t.method, t.body ?? null, token)} disabled={loading || !token}>
            {t.label}
          </button>
        ))}
      </div>
      <Result result={result} />
    </div>
  )
}

function PromotionsSection ({ token }) {
  const { result, loading, call } = useApiCall()

  const tests = [
    { label: 'Mis promociones',   url: '/api/promotions/',          method: 'GET' },
    { label: 'Calcular 6 uds',    url: '/api/promotions/calculate', method: 'POST', body: { items: [{ productCode: 'P-RT-001', quantity: 6 }], orderTotal: 96 } },
    { label: 'Calcular >250€',    url: '/api/promotions/calculate', method: 'POST', body: { items: [], orderTotal: 300 } },
    { label: 'Sin umbral',        url: '/api/promotions/calculate', method: 'POST', body: { items: [], orderTotal: 50 } },
  ]

  return (
    <div style={s.card}>
      <div style={s.sectionHeader}><h2 style={s.h2}>promotions-service</h2>{hu('HU-10 · HU-11 · HU-12 · HU-13')}</div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Haz login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {tests.map(t => (
          <button key={t.label} style={s.btn('#78350f')} onClick={() => call(t.url, t.method, t.body ?? null, token)} disabled={loading || !token}>
            {t.label}
          </button>
        ))}
      </div>
      <Result result={result} />
    </div>
  )
}

function CartSection ({ token }) {
  const { result, loading, call } = useApiCall()

  return (
    <div style={s.card}>
      <div style={s.sectionHeader}><h2 style={s.h2}>cart-service</h2>{hu('HU-14 · HU-15 · HU-16')}</div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Haz login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/cart/', 'GET', null, token)} disabled={loading || !token}>Ver cesta</button>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/cart/items', 'POST', { productCode: 'P-RT-001', name: 'Champú Restaurador', quantity: 2, unitPrice: 16.00 }, token)} disabled={loading || !token}>Añadir producto</button>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/cart/items/P-RT-001', 'PATCH', { quantity: 5 }, token)} disabled={loading || !token}>Cambiar cantidad</button>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/cart/summary', 'GET', null, token)} disabled={loading || !token}>Resumen + beneficios</button>
        <button style={s.btn('#7f1d1d')} onClick={() => call('/api/cart/', 'DELETE', null, token)} disabled={loading || !token}>Vaciar cesta</button>
      </div>
      <Result result={result} />
    </div>
  )
}

function OrdersSection ({ token }) {
  const { result, loading, call } = useApiCall()

  return (
    <div style={s.card}>
      <div style={s.sectionHeader}><h2 style={s.h2}>order-service · invoice-service</h2>{hu('HU-17 · HU-18 · HU-19 · HU-20 · HU-21')}</div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Haz login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button style={s.btn('#1c3a5e')} onClick={() => call('/api/orders/', 'GET', null, token)} disabled={loading || !token}>Historial pedidos</button>
        <button style={s.btn('#1c3a5e')} onClick={() => call('/api/orders/SDA-2025-0890', 'GET', null, token)} disabled={loading || !token}>Estado pedido</button>
        <button style={s.btn('#14532d')} onClick={() => call('/api/orders/', 'POST', { items: [{ productCode: 'P-RT-001', name: 'Champú', quantity: 2, unitPrice: 16.00 }] }, token)} disabled={loading || !token}>Confirmar pedido</button>
        <button style={s.btn('#1c3a5e')} onClick={() => call('/api/orders/SDA-2025-0890/repeat', 'POST', {}, token)} disabled={loading || !token}>Repetir pedido</button>
        <button style={s.btn('#3b2a5e')} onClick={() => call('/api/invoices/', 'GET', null, token)} disabled={loading || !token}>Mis facturas</button>
        <button style={s.btn('#3b2a5e')} onClick={() => call('/api/invoices/FAC-2025-0890', 'GET', null, token)} disabled={loading || !token}>Factura FAC-0890</button>
      </div>
      <Result result={result} />
    </div>
  )
}

function ReturnsSection ({ token }) {
  const { result, loading, call } = useApiCall()

  return (
    <div style={s.card}>
      <div style={s.sectionHeader}><h2 style={s.h2}>returns-service</h2>{hu('HU-31 · HU-32 · HU-33 · HU-34 · HU-35')}</div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Haz login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/returns/reasons')} disabled={loading}>Motivos</button>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/returns/', 'GET', null, token)} disabled={loading || !token}>Mis reclamaciones</button>
        <button style={s.btn('#14532d')} onClick={() => call('/api/returns/', 'POST', { orderId: 'SDA-2025-0890', reason: 'DAMAGED', notes: 'Test', items: [{ productCode: 'P-RT-001', name: 'Champú', quantity: 1, unitPrice: 16 }] }, token)} disabled={loading || !token}>Crear devolución</button>
        <button style={s.btn('#4a2970')} onClick={() => call('/api/admin/returns/', 'GET', null, token)} disabled={loading || !token}>Admin — todas</button>
        <button style={s.btn('#4a2970')} onClick={() => call('/api/admin/returns/?status=PENDING', 'GET', null, token)} disabled={loading || !token}>Admin — pendientes</button>
        <button style={s.btn('#78350f')} onClick={() => call('/api/admin/returns/RET-2025-001', 'PATCH', { status: 'APPROVED', adminNotes: 'Aprobada desde dev-stack' }, token)} disabled={loading || !token}>Aprobar RET-001 (→ SAP)</button>
      </div>
      <Result result={result} />
    </div>
  )
}

function ContentSection ({ token }) {
  const { result, loading, call } = useApiCall()
  return (
    <div style={s.card}>
      <div style={s.sectionHeader}><h2 style={s.h2}>content-service</h2>{hu('HU-36 · HU-37 · HU-38 · HU-39')}</div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Haz login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/content/datasheets', 'GET', null, token)} disabled={loading || !token}>Fichas técnicas</button>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/content/videos', 'GET', null, token)} disabled={loading || !token}>Vídeos</button>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/content/news', 'GET', null, token)} disabled={loading || !token}>Novedades</button>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/content/news?featured=true', 'GET', null, token)} disabled={loading || !token}>Novedades destacadas</button>
        <button style={s.btn('#4a2970')} onClick={() => call('/api/admin/content/datasheets', 'GET', null, token)} disabled={loading || !token}>Admin — fichas</button>
        <button style={s.btn('#14532d')} onClick={() => call('/api/admin/content/news', 'POST', { title: 'Test dev-stack', summary: 'Resumen test', featured: false }, token)} disabled={loading || !token}>Admin — crear noticia</button>
      </div>
      <Result result={result} />
    </div>
  )
}

function IntelligenceSection ({ token }) {
  const { result, loading, call } = useApiCall()
  return (
    <div style={s.card}>
      <div style={s.sectionHeader}><h2 style={s.h2}>intelligence-service</h2>{hu('HU-40 · HU-41 · HU-42 · HU-43')}</div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Haz login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button style={s.btn('#1e3a5f')} onClick={() => call('/api/intelligence/comparison?windowDays=90', 'GET', null, token)} disabled={loading || !token}>Comparativa 90d</button>
        <button style={s.btn('#1e3a5f')} onClick={() => call('/api/intelligence/comparison?windowDays=30', 'GET', null, token)} disabled={loading || !token}>Comparativa 30d</button>
        <button style={s.btn('#78350f')} onClick={() => call('/api/intelligence/alerts/inactive-products?weeksThreshold=4', 'GET', null, token)} disabled={loading || !token}>Alertas 4 semanas</button>
        <button style={s.btn('#78350f')} onClick={() => call('/api/intelligence/alerts/inactive-products', 'GET', null, token)} disabled={loading || !token}>Alertas 8 semanas</button>
        <button style={s.btn('#14532d')} onClick={() => call('/api/intelligence/thresholds', 'GET', null, token)} disabled={loading || !token}>Umbrales beneficios</button>
        <button style={s.btn('#4a2970')} onClick={() => call('/api/intelligence/benefits-summary?months=6', 'GET', null, token)} disabled={loading || !token}>Beneficios 6 meses</button>
      </div>
      <Result result={result} />
    </div>
  )
}

function CommercialSection ({ token }) {
  const { result, loading, call } = useApiCall()
  return (
    <div style={s.card}>
      <div style={s.sectionHeader}><h2 style={s.h2}>commercial-service</h2>{hu('HU-44 · HU-45 · HU-46 · HU-47')}</div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Haz login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button style={s.btn('#1e3a5f')} onClick={() => call('/api/commercial/my-commercial', 'GET', null, token)} disabled={loading || !token}>Mi comercial (HU-44)</button>
        <button style={s.btn('#1e3a5f')} onClick={() => call('/api/commercial/suggested-orders', 'GET', null, token)} disabled={loading || !token}>Pedidos sugeridos (HU-45)</button>
        <button style={s.btn('#14532d')} onClick={() => call('/api/commercial/suggested-orders', 'POST', { sapCode: 'SDA-00423', message: 'Test dev-stack', items: [{ productCode: 'P-RT-001', name: 'Champú', quantity: 3, unitPrice: 16 }] }, token)} disabled={loading || !token}>Crear sugerido (HU-45)</button>
        <button style={s.btn('#78350f')} onClick={() => call('/api/commercial/portfolio', 'GET', null, token)} disabled={loading || !token}>Mi cartera (HU-46)</button>
        <button style={s.btn('#4a2970')} onClick={() => call('/api/commercial/commercials', 'GET', null, token)} disabled={loading || !token}>Admin — comerciales (HU-47)</button>
        <button style={s.btn('#4a2970')} onClick={() => call('/api/commercial/assignments', 'GET', null, token)} disabled={loading || !token}>Admin — asignaciones (HU-47)</button>
      </div>
      <Result result={result} />
    </div>
  )
}

function NotificationsSection ({ token }) {
  const { result, loading, call } = useApiCall()
  return (
    <div style={s.card}>
      <div style={s.sectionHeader}><h2 style={s.h2}>notification-preferences-service</h2>{hu('HU-48 · HU-49 · HU-50 · HU-51 · HU-52')}</div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Haz login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/notifications/inbox', 'GET', null, token)} disabled={loading || !token}>Bandeja (HU-48)</button>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/notifications/preferences', 'GET', null, token)} disabled={loading || !token}>Preferencias (HU-51)</button>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/notifications/watchlist', 'GET', null, token)} disabled={loading || !token}>Watchlist stock (HU-48)</button>
        <button style={s.btn('#14532d')} onClick={() => call('/api/notifications/watchlist', 'POST', { productCode: 'P-TEST', productName: 'Producto Test' }, token)} disabled={loading || !token}>Añadir watchlist</button>
        <button style={s.btn('#78350f')} onClick={() => call('/api/notifications/alerts/expiring-promos', 'GET', null, token)} disabled={loading || !token}>Promos venciendo (HU-49)</button>
        <button style={s.btn('#78350f')} onClick={() => call('/api/notifications/alerts/check-min-order', 'POST', { cartTotal: 80 }, token)} disabled={loading || !token}>Check mínimo 80€ (HU-50)</button>
        <button style={s.btn('#4a2970')} onClick={() => call('/api/notifications/broadcasts', 'GET', null, token)} disabled={loading || !token}>Admin — broadcasts (HU-52)</button>
        <button style={s.btn('#14532d')} onClick={() => call('/api/notifications/broadcasts', 'POST', { title: 'Test dev-stack', body: 'Mensaje de prueba', channel: 'IN_APP', segments: { profiles: ['PREMIUM'] } }, token)} disabled={loading || !token}>Admin — enviar broadcast</button>
      </div>
      <Result result={result} />
    </div>
  )
}

function SustainabilitySection ({ token }) {
  const { result, loading, call } = useApiCall()
  return (
    <div style={s.card}>
      <div style={s.sectionHeader}><h2 style={s.h2}>sustainability-service</h2>{hu('HU-53 · HU-54 · HU-55')}</div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Haz login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/sustainability/products', 'GET', null, token)} disabled={loading || !token}>Todos productos (HU-53)</button>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/sustainability/products/P-RT-001', 'GET', null, token)} disabled={loading || !token}>Ficha P-RT-001 (HU-53)</button>
        <button style={s.btn('#78350f')} onClick={() => call('/api/sustainability/carbon-footprint', 'POST', { items: [{ productCode: 'P-RT-001', quantity: 6 }, { productCode: 'P-RT-002', quantity: 3 }], shippingMethod: 'STANDARD' }, token)} disabled={loading || !token}>Huella STANDARD (HU-54)</button>
        <button style={s.btn('#78350f')} onClick={() => call('/api/sustainability/carbon-footprint', 'POST', { items: [{ productCode: 'P-RT-001', quantity: 6 }], shippingMethod: 'ECO' }, token)} disabled={loading || !token}>Huella ECO (HU-54)</button>
        <button style={s.btn('#14532d')} onClick={() => call('/api/sustainability/grouping-preference', 'GET', null, token)} disabled={loading || !token}>Ver agrupación (HU-55)</button>
        <button style={s.btn('#14532d')} onClick={() => call('/api/sustainability/grouping-preference', 'PATCH', { acceptDelay: true, maxDelayDays: 5 }, token)} disabled={loading || !token}>Activar agrupación (HU-55)</button>
      </div>
      <Result result={result} />
    </div>
  )
}

function SubscriptionSection ({ token }) {
  const { result, loading, call } = useApiCall()
  return (
    <div style={s.card}>
      <div style={s.sectionHeader}><h2 style={s.h2}>subscription-service</h2>{hu('SaaS billing')}</div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Haz login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button style={s.btn('#1e3a5f')} onClick={() => call('/api/subscriptions/plans', 'GET', null, token)} disabled={loading || !token}>Planes disponibles</button>
        <button style={s.btn('#1e3a5f')} onClick={() => call('/api/subscriptions/me', 'GET', null, token)} disabled={loading || !token}>Mi suscripción</button>
        <button style={s.btn('#14532d')} onClick={() => call('/api/subscriptions/', 'POST', { planId: 'plan-pro' }, token)} disabled={loading || !token}>Suscribirse — Pro</button>
        <button style={s.btn('#14532d')} onClick={() => call('/api/subscriptions/', 'POST', { planId: 'plan-basic' }, token)} disabled={loading || !token}>Suscribirse — Basic</button>
        <button style={s.btn('#78350f')} onClick={() => call('/api/subscriptions/me', 'PATCH', { planId: 'plan-enterprise' }, token)} disabled={loading || !token}>Cambiar a Enterprise</button>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/subscriptions/me/billing', 'GET', null, token)} disabled={loading || !token}>Historial facturación</button>
        <button style={s.btn('#1e4040')} onClick={() => call('/api/subscriptions/me/payment-method', 'POST', { paymentMethod: 'card_test_4242' }, token)} disabled={loading || !token}>Actualizar método pago</button>
        <button style={s.btn('#7f1d1d')} onClick={() => call('/api/subscriptions/me', 'DELETE', null, token)} disabled={loading || !token}>Cancelar suscripción</button>
        <button style={s.btn('#4a2970')} onClick={() => call('/api/subscriptions/admin', 'GET', null, token)} disabled={loading || !token}>Admin — todas</button>
        <button style={s.btn('#4a2970')} onClick={() => call('/api/subscriptions/admin/SDA-00423', 'GET', null, token)} disabled={loading || !token}>Admin — SDA-00423</button>
        <button style={s.btn('#4a2970')} onClick={() => call('/api/subscriptions/admin/SDA-00387', 'PATCH', { planId: 'plan-enterprise', status: 'TRIALING' }, token)} disabled={loading || !token}>Admin — conceder Enterprise</button>
      </div>
      <Result result={result} />
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────
export default function App () {
  const [token, setToken]     = useState(null)
  const [tokenInfo, setTokenInfo] = useState(null)

  function handleToken (t) {
    setToken(t)
    try {
      const payload = JSON.parse(atob(t.split('.')[1]))
      setTokenInfo(payload)
    } catch {}
  }

  return (
    <div style={s.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <h1 style={s.h1}>
          Secretos del Agua{' '}
          <span style={s.badge()}>dev-stack</span>
        </h1>
        {tokenInfo && (
          <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>
            <div style={{ color: '#4ade80' }}>✓ Token activo</div>
            <div>{tokenInfo.sub} · {tokenInfo.profile}</div>
          </div>
        )}
      </div>
      <p style={s.subtitle}>
        Panel de verificación del stack · Puerto 5174 ·{' '}
        <a href="http://localhost" style={{ color: '#60a5fa' }}>Portal →</a>
      </p>

      {/* Estado de servicios */}
      <div style={s.card}>
        <h2 style={s.h2}>Estado de microservicios</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {SERVICES.map(svc => <ServiceRow key={svc.name} {...svc} />)}
          </tbody>
        </table>
        <p style={{ marginTop: 10, fontSize: 11, color: '#4b5563' }}>
          ✅ activo · 🔲 no disponible · ⏳ verificando · ⚠️ error
        </p>
      </div>

      <AuthSection onToken={handleToken} />
      <CatalogSection token={token} />
      <ProfileSection token={token} />
      <PromotionsSection token={token} />
      <CartSection token={token} />
      <OrdersSection token={token} />
      <ReturnsSection token={token} />
      <ContentSection token={token} />
      <IntelligenceSection token={token} />
      <CommercialSection token={token} />
      <NotificationsSection token={token} />
      <SustainabilitySection token={token} />
      <SubscriptionSection token={token} />
    </div>
  )
}
