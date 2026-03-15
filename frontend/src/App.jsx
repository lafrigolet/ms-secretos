import { useState, useEffect } from 'react'

const SERVICES = [
  { name: 'auth-service',              port: 3001, healthUrl: '/api/auth-health',        docsUrl: 'http://localhost:3001/docs' },
  { name: 'catalog-service',           port: 3002, healthUrl: '/api/catalog-health',     docsUrl: 'http://localhost:3002/docs' },
  { name: 'customer-profile-service',  port: 3003, healthUrl: '/api/profile-health',     docsUrl: 'http://localhost:3003/docs' },
  { name: 'promotions-service',        port: 3004, healthUrl: '/api/promotions-health',  docsUrl: 'http://localhost:3004/docs' },
  { name: 'cart-service',              port: 3005, healthUrl: '/api/cart-health',        docsUrl: 'http://localhost:3005/docs' },
  { name: 'order-service',             port: 3006, healthUrl: '/api/orders-health',      docsUrl: 'http://localhost:3006/docs' },
  { name: 'notification-service',      port: 3007, healthUrl: '/api/audit-health', docsUrl: 'http://localhost:3007/docs' },
  { name: 'invoice-service',           port: 3008, healthUrl: '/api/invoices-health',    docsUrl: 'http://localhost:3008/docs' },
  { name: 'audit-service',             port: 3009, healthUrl: '/api/audit-health',       docsUrl: 'http://localhost:3009/docs' },
  { name: 'sap-integration-service',   port: 3010, healthUrl: '/api/sap-health',         docsUrl: 'http://localhost:3010/docs' },
]

const LOGIN_TESTS = [
  { label: 'Premium (OK)',         sapCode: 'SDA-00423', password: 'demo1234',  style: { background: '#14532d' } },
  { label: 'VIP (OK)',             sapCode: 'SDA-00521', password: 'demo1234',  style: { background: '#1e3a5f' } },
  { label: 'Bloqueada — deuda',    sapCode: 'SDA-00187', password: 'demo1234',  style: { background: '#7f1d1d' } },
  { label: 'Bloqueada — admin',    sapCode: 'SDA-00098', password: 'demo1234',  style: { background: '#7f1d1d' } },
  { label: 'Contraseña incorrecta',sapCode: 'SDA-00423', password: 'wrongpass', style: { background: '#555' } },
  { label: 'Código inexistente',   sapCode: 'NO-EXISTE',  password: 'demo1234', style: { background: '#555' } },
  { label: 'Admin',                sapCode: 'ADMIN-001', password: 'admin1234', style: { background: '#4a2970' } },
]

function ServiceRow ({ name, healthUrl, docsUrl }) {
  const [status, setStatus] = useState('loading')
  const [uptime, setUptime] = useState(null)
  const [mode, setMode] = useState(null)

  useEffect(() => {
    fetch(healthUrl)
      .then(r => r.json())
      .then(data => {
        setStatus(data.status === 'ok' ? 'ok' : 'error')
        setUptime(Math.round(data.uptime ?? 0))
        setMode(data.mode ?? null)
      })
      .catch(() => setStatus('pending'))
  }, [healthUrl])

  const icon = { loading: '⏳', ok: '✅', error: '⚠️', pending: '🔲' }[status]
  const color = { ok: '#4ade80', error: '#f87171', pending: '#6b7280', loading: '#facc15' }[status]

  return (
    <tr>
      <td style={td}>{icon}</td>
      <td style={{ ...td, fontFamily: 'monospace', color }}>{name}</td>
      <td style={{ ...td, color: '#6b7280', fontSize: 12 }}>
        {status === 'ok' ? `uptime: ${uptime}s${mode ? ` · modo: ${mode}` : ''}` : status === 'pending' ? 'no disponible' : ''}
      </td>
      <td style={td}>
        {status === 'ok' && (
          <a href={docsUrl} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', fontSize: 12 }}>
            /docs ↗
          </a>
        )}
      </td>
    </tr>
  )
}

function AuthTests () {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTest, setActiveTest] = useState(null)

  async function runTest (test) {
    setLoading(true)
    setActiveTest(test.label)
    setResult(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sapCode: test.sapCode, password: test.password })
      })
      const data = await res.json()
      setResult({ status: res.status, data, test: test.label })
    } catch (e) {
      setResult({ status: 'error', data: { message: e.message }, test: test.label })
    } finally {
      setLoading(false)
    }
  }

  const statusColor = result
    ? result.status === 200 ? '#14532d' : result.status === 403 ? '#7f1d1d' : '#555'
    : null

  return (
    <section style={card}>
      <div style={sectionHeader}>
        <h2 style={h2}>auth-service — tests de login</h2>
        <span style={{ ...badge, background: '#1e3a2f', color: '#4ade80' }}>HU-01 · HU-02 · HU-03</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {LOGIN_TESTS.map(t => (
          <button
            key={t.label}
            style={{ ...btn, ...t.style, opacity: loading && activeTest !== t.label ? 0.5 : 1 }}
            onClick={() => runTest(t)}
            disabled={loading}
          >
            {t.label}
          </button>
        ))}
      </div>
      {loading && <p style={{ color: '#6b7280', fontSize: 13 }}>Enviando petición…</p>}
      {result && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ ...badge, background: statusColor, fontSize: 13, padding: '3px 10px' }}>
              HTTP {result.status}
            </span>
            <span style={{ color: '#6b7280', fontSize: 12 }}>{result.test}</span>
          </div>
          <pre style={pre}>{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
    </section>
  )
}

function CatalogTests ({ token }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const TESTS = [
    { label: 'Familias',              url: '/api/catalog/families' },
    { label: 'Todos los productos',   url: '/api/catalog/products' },
    { label: 'Familia Ritual (F01)',  url: '/api/catalog/products?familyId=F01' },
    { label: 'Ficha P-RT-001',        url: '/api/catalog/products/P-RT-001' },
    { label: 'Recomendaciones',       url: '/api/catalog/recommendations?cartItems=P-RT-001' },
  ]

  async function runTest (url) {
    if (!token) { setResult({ status: 401, data: { message: 'Necesitas hacer login primero' } }); return }
    setLoading(true)
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      setResult({ status: res.status, data: await res.json(), url })
    } catch (e) {
      setResult({ status: 'error', data: { message: e.message } })
    } finally { setLoading(false) }
  }

  return (
    <section style={card}>
      <div style={sectionHeader}>
        <h2 style={h2}>catalog-service</h2>
        <span style={{ ...badge, background: '#1e3a2f', color: '#4ade80' }}>HU-07 · HU-08 · HU-09</span>
      </div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Necesitas hacer login en auth-service primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {TESTS.map(t => (
          <button key={t.label} style={{ ...btn, background: '#1e3a5f' }} onClick={() => runTest(t.url)} disabled={loading}>{t.label}</button>
        ))}
      </div>
      {result && (
        <>
          <span style={{ ...badge, background: result.status === 200 ? '#14532d' : '#7f1d1d', fontSize: 13, padding: '3px 10px' }}>HTTP {result.status}</span>
          <pre style={pre}>{JSON.stringify(result.data, null, 2)}</pre>
        </>
      )}
    </section>
  )
}

function ProfileTests ({ token }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const TESTS = [
    { label: 'Mi perfil',             url: '/api/profile/me' },
    { label: 'Check ORDER',           url: '/api/profile/check-permission', method: 'POST', body: { sapCode: 'SDA-00423', permission: 'ORDER' } },
    { label: 'Check VIEW_PROMOTIONS', url: '/api/profile/check-permission', method: 'POST', body: { sapCode: 'SDA-00387', permission: 'VIEW_PROMOTIONS' } },
  ]

  async function runTest (t) {
    if (!token) { setResult({ status: 401, data: { message: 'Necesitas hacer login primero' } }); return }
    setLoading(true)
    try {
      const res = await fetch(t.url, {
        method: t.method ?? 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(t.body ? { body: JSON.stringify(t.body) } : {})
      })
      setResult({ status: res.status, data: await res.json() })
    } catch (e) {
      setResult({ status: 'error', data: { message: e.message } })
    } finally { setLoading(false) }
  }

  return (
    <section style={card}>
      <div style={sectionHeader}>
        <h2 style={h2}>customer-profile-service</h2>
        <span style={{ ...badge, background: '#1e3a2f', color: '#4ade80' }}>HU-04 · HU-05</span>
      </div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Necesitas hacer login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {TESTS.map(t => (
          <button key={t.label} style={{ ...btn, background: '#4a2970' }} onClick={() => runTest(t)} disabled={loading}>{t.label}</button>
        ))}
      </div>
      {result && (
        <>
          <span style={{ ...badge, background: result.status === 200 ? '#14532d' : '#7f1d1d', fontSize: 13, padding: '3px 10px' }}>HTTP {result.status}</span>
          <pre style={pre}>{JSON.stringify(result.data, null, 2)}</pre>
        </>
      )}
    </section>
  )
}

function PromotionsTests ({ token }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const TESTS = [
    { label: 'Mis promociones',        url: '/api/promotions/', method: 'GET' },
    { label: 'Calcular (6 uds)',        url: '/api/promotions/calculate', method: 'POST', body: { items: [{ productCode: 'P-RT-001', quantity: 6 }], orderTotal: 96 } },
    { label: 'Calcular (>250€)',        url: '/api/promotions/calculate', method: 'POST', body: { items: [], orderTotal: 300 } },
  ]

  async function runTest (t) {
    if (!token) { setResult({ status: 401, data: { message: 'Necesitas hacer login primero' } }); return }
    setLoading(true)
    try {
      const res = await fetch(t.url, {
        method: t.method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(t.body ? { body: JSON.stringify(t.body) } : {})
      })
      setResult({ status: res.status, data: await res.json() })
    } catch (e) {
      setResult({ status: 'error', data: { message: e.message } })
    } finally { setLoading(false) }
  }

  return (
    <section style={card}>
      <div style={sectionHeader}>
        <h2 style={h2}>promotions-service</h2>
        <span style={{ ...badge, background: '#1e3a2f', color: '#4ade80' }}>HU-10 · HU-11 · HU-12 · HU-13</span>
      </div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Necesitas hacer login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {TESTS.map(t => (
          <button key={t.label} style={{ ...btn, background: '#78350f' }} onClick={() => runTest(t)} disabled={loading}>{t.label}</button>
        ))}
      </div>
      {result && (
        <>
          <span style={{ ...badge, background: result.status === 200 ? '#14532d' : '#7f1d1d', fontSize: 13, padding: '3px 10px' }}>HTTP {result.status}</span>
          <pre style={pre}>{JSON.stringify(result.data, null, 2)}</pre>
        </>
      )}
    </section>
  )
}

function CartTests ({ token, setCartToken }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function call (url, method = 'GET', body = null) {
    if (!token) { setResult({ status: 401, data: { message: 'Necesitas hacer login primero' } }); return }
    setLoading(true)
    try {
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {})
      })
      setResult({ status: res.status, data: await res.json() })
    } catch (e) {
      setResult({ status: 'error', data: { message: e.message } })
    } finally { setLoading(false) }
  }

  return (
    <section style={card}>
      <div style={sectionHeader}>
        <h2 style={h2}>cart-service</h2>
        <span style={{ ...badge, background: '#1e3a2f', color: '#4ade80' }}>HU-14 · HU-15 · HU-16</span>
      </div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Necesitas hacer login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button style={{ ...btn, background: '#1e4040' }} onClick={() => call('/api/cart/')} disabled={loading}>Ver cesta</button>
        <button style={{ ...btn, background: '#1e4040' }} onClick={() => call('/api/cart/items', 'POST', { productCode: 'P-RT-001', name: 'Champú Restaurador', quantity: 2, unitPrice: 16.00 })} disabled={loading}>Añadir producto</button>
        <button style={{ ...btn, background: '#1e4040' }} onClick={() => call('/api/cart/items/P-RT-001', 'PATCH', { quantity: 5 })} disabled={loading}>Cambiar cantidad (5)</button>
        <button style={{ ...btn, background: '#1e4040' }} onClick={() => call('/api/cart/summary')} disabled={loading}>Resumen + beneficios</button>
        <button style={{ ...btn, background: '#7f1d1d' }} onClick={() => call('/api/cart/', 'DELETE')} disabled={loading}>Vaciar cesta</button>
      </div>
      {result && (
        <>
          <span style={{ ...badge, background: result.status === 200 || result.status === 201 ? '#14532d' : '#7f1d1d', fontSize: 13, padding: '3px 10px' }}>HTTP {result.status}</span>
          <pre style={pre}>{JSON.stringify(result.data, null, 2)}</pre>
        </>
      )}
    </section>
  )
}

function OrderTests ({ token }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function call (url, method = 'GET', body = null) {
    if (!token) { setResult({ status: 401, data: { message: 'Necesitas hacer login primero' } }); return }
    setLoading(true)
    try {
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {})
      })
      setResult({ status: res.status, data: await res.json() })
    } catch (e) {
      setResult({ status: 'error', data: { message: e.message } })
    } finally { setLoading(false) }
  }

  return (
    <section style={card}>
      <div style={sectionHeader}>
        <h2 style={h2}>order-service · invoice-service</h2>
        <span style={{ ...badge, background: '#1e3a2f', color: '#4ade80' }}>HU-17 · HU-18 · HU-19 · HU-20 · HU-21</span>
      </div>
      {!token && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>⚠️ Necesitas hacer login primero</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button style={{ ...btn, background: '#1c3a5e' }} onClick={() => call('/api/orders/')} disabled={loading}>Historial pedidos</button>
        <button style={{ ...btn, background: '#1c3a5e' }} onClick={() => call('/api/orders/SDA-2025-0890')} disabled={loading}>Estado pedido</button>
        <button style={{ ...btn, background: '#14532d' }} onClick={() => call('/api/orders/', 'POST', { items: [{ productCode: 'P-RT-001', name: 'Champú', quantity: 2, unitPrice: 16.00 }] })} disabled={loading}>Confirmar pedido</button>
        <button style={{ ...btn, background: '#1c3a5e' }} onClick={() => call('/api/orders/SDA-2025-0890/repeat', 'POST')} disabled={loading}>Repetir pedido</button>
        <button style={{ ...btn, background: '#3b2a5e' }} onClick={() => call('/api/invoices/')} disabled={loading}>Mis facturas</button>
        <button style={{ ...btn, background: '#3b2a5e' }} onClick={() => call('/api/invoices/FAC-2025-0890')} disabled={loading}>Factura FAC-0890</button>
      </div>
      {result && (
        <>
          <span style={{ ...badge, background: [200, 201].includes(result.status) ? '#14532d' : '#7f1d1d', fontSize: 13, padding: '3px 10px' }}>HTTP {result.status}</span>
          <pre style={pre}>{JSON.stringify(result.data, null, 2)}</pre>
        </>
      )}
    </section>
  )
}

// ── App principal ─────────────────────────────────────────────────
export default function App () {
  const [token, setToken] = useState(null)
  const [tokenInfo, setTokenInfo] = useState(null)

  // Capturar el token cuando se hace login desde AuthTests
  useEffect(() => {
    const original = window.fetch
    window.fetch = async (...args) => {
      const res = await original(...args)
      const clone = res.clone()
      try {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url
        if (url.includes('/auth/login') && res.ok) {
          const data = await clone.json()
          if (data.token) {
            setToken(data.token)
            setTokenInfo(data.customer)
          }
        }
      } catch {}
      return res
    }
    return () => { window.fetch = original }
  }, [])

  return (
    <div style={container}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={h1}>Secretos del Agua <span style={{ ...badge, background: '#1e3a2f', color: '#4ade80' }}>dev-stack</span></h1>
        {tokenInfo && (
          <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>
            <div style={{ color: '#4ade80' }}>✓ {tokenInfo.name}</div>
            <div>{tokenInfo.sapCode} · {tokenInfo.profile}</div>
          </div>
        )}
      </div>
      <p style={subtitle}>Panel de verificación del stack · <code style={{ fontSize: 11 }}>localhost/dev-stack</code></p>

      {/* Estado de servicios */}
      <section style={card}>
        <h2 style={h2}>Estado de microservicios</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {SERVICES.map(s => <ServiceRow key={s.name} {...s} />)}
          </tbody>
        </table>
        <p style={{ marginTop: 10, fontSize: 11, color: '#4b5563' }}>
          ✅ activo · 🔲 no disponible · ⏳ verificando · ⚠️ error
        </p>
      </section>

      <AuthTests />
      <CatalogTests token={token} />
      <ProfileTests token={token} />
      <PromotionsTests token={token} />
      <CartTests token={token} />
      <OrderTests token={token} />
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────
const container  = { maxWidth: 860, margin: '0 auto', padding: '32px 24px 64px', fontFamily: 'system-ui, sans-serif', color: '#e5e5e5', background: '#0f0f0f', minHeight: '100vh' }
const h1         = { fontSize: 26, fontWeight: 300, margin: 0 }
const h2         = { fontSize: 12, fontWeight: 500, margin: '0 0 14px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }
const subtitle   = { color: '#4b5563', fontSize: 13, marginBottom: 28 }
const card       = { background: '#1a1a1a', borderRadius: 10, padding: 20, marginBottom: 16, border: '1px solid #2a2a2a' }
const sectionHeader = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }
const td         = { padding: '7px 10px 7px 0', borderBottom: '1px solid #222', fontSize: 13 }
const btn        = { color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'system-ui' }
const badge      = { borderRadius: 4, padding: '2px 8px', fontSize: 11 }
const pre        = { background: '#111', borderRadius: 6, padding: 14, fontSize: 11, color: '#a3e635', overflowX: 'auto', marginTop: 10, lineHeight: 1.6, maxHeight: 300, overflowY: 'auto' }
