import { useState, useEffect } from 'react'

const SERVICES = [
  { name: 'auth-service',               url: '/api/auth-health' },
  { name: 'catalog-service',            url: '/api/catalog-health' },
  { name: 'customer-profile-service',   url: '/api/profile-health' },
  { name: 'promotions-service',         url: '/api/promotions-health' },
  { name: 'cart-service',               url: '/api/cart-health' },
  { name: 'order-service',              url: '/api/orders-health' },
  { name: 'invoice-service',            url: '/api/invoices-health' },
  { name: 'audit-service',              url: '/api/audit-health' },
  { name: 'sap-integration-service',    url: '/api/sap-health' },
]

const STATUS = { loading: '⏳', ok: '✅', error: '🔲' }

function ServiceRow({ name, url }) {
  const [status, setStatus] = useState('loading')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setStatus(data.status === 'ok' ? 'ok' : 'error')
        setDetail(`uptime: ${Math.round(data.uptime)}s`)
      })
      .catch(() => {
        setStatus('error')
        setDetail('no disponible')
      })
  }, [url])

  return (
    <tr>
      <td style={td}>{STATUS[status]}</td>
      <td style={{ ...td, fontFamily: 'monospace' }}>{name}</td>
      <td style={{ ...td, color: '#888', fontSize: 12 }}>{detail}</td>
    </tr>
  )
}

export default function App() {
  const [loginResult, setLoginResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function testLogin(sapCode, password) {
    setLoading(true)
    setLoginResult(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sapCode, password })
      })
      const data = await res.json()
      setLoginResult({ status: res.status, data })
    } catch (e) {
      setLoginResult({ status: 'error', data: { message: e.message } })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={container}>
      <h1 style={h1}>Secretos del Agua <span style={badge}>dev</span></h1>
      <p style={subtitle}>Panel de verificación del stack</p>

      {/* ── Estado de servicios ── */}
      <section style={card}>
        <h2 style={h2}>Estado de microservicios</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {SERVICES.map(s => <ServiceRow key={s.name} {...s} />)}
          </tbody>
        </table>
        <p style={{ marginTop: 12, fontSize: 12, color: '#aaa' }}>
          🔲 = pendiente de implementar · ✅ = activo · ⏳ = verificando
        </p>
      </section>

      {/* ── Test de login ── */}
      <section style={card}>
        <h2 style={h2}>Test auth-service</h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          Prueba los distintos escenarios de login (HU-01, HU-02, HU-03)
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn} onClick={() => testLogin('SDA-00423', 'demo1234')}>
            Login Premium (OK)
          </button>
          <button style={btn} onClick={() => testLogin('SDA-00521', 'demo1234')}>
            Login VIP (OK)
          </button>
          <button style={{ ...btn, background: '#7f1d1d' }} onClick={() => testLogin('SDA-00187', 'demo1234')}>
            Login Bloqueada (403)
          </button>
          <button style={{ ...btn, background: '#555' }} onClick={() => testLogin('SDA-00423', 'wrongpass')}>
            Contraseña incorrecta (401)
          </button>
        </div>

        {loading && <p style={{ marginTop: 16, color: '#aaa' }}>Enviando petición…</p>}

        {loginResult && (
          <div style={{ marginTop: 16 }}>
            <span style={{
              ...badge,
              background: loginResult.status === 200 ? '#14532d' : '#7f1d1d',
              fontSize: 13,
              padding: '3px 10px'
            }}>
              HTTP {loginResult.status}
            </span>
            <pre style={pre}>{JSON.stringify(loginResult.data, null, 2)}</pre>
          </div>
        )}
      </section>
    </div>
  )
}

// ── Estilos inline mínimos ────────────────────────────────────────
const container = {
  maxWidth: 720,
  margin: '40px auto',
  padding: '0 24px',
  fontFamily: 'system-ui, sans-serif',
  color: '#e5e5e5',
  background: '#0f0f0f',
  minHeight: '100vh'
}
const h1 = { fontSize: 28, fontWeight: 300, marginBottom: 4 }
const h2 = { fontSize: 15, fontWeight: 500, marginBottom: 16, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em' }
const subtitle = { color: '#666', marginBottom: 32, fontSize: 14 }
const card = { background: '#1a1a1a', borderRadius: 10, padding: 24, marginBottom: 20, border: '1px solid #2a2a2a' }
const td = { padding: '8px 12px 8px 0', borderBottom: '1px solid #222', fontSize: 14 }
const btn = { background: '#14532d', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }
const badge = { background: '#1e3a2f', color: '#4ade80', borderRadius: 4, padding: '2px 8px', fontSize: 11, marginLeft: 8 }
const pre = { background: '#111', borderRadius: 6, padding: 16, fontSize: 12, color: '#a3e635', overflowX: 'auto', marginTop: 12, lineHeight: 1.6 }
