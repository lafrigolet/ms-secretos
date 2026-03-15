import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Logo } from '../components/Logo.jsx'
import { Spinner } from '../components/Spinner.jsx'

export function LoginPage () {
  const [sapCode, setSapCode]   = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  const { login, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname ?? '/catalog'

  async function handleSubmit (e) {
    e.preventDefault()
    if (!sapCode.trim() || !password.trim()) return

    setLoading(true)
    setError(null)

    try {
      const data = await login(sapCode.trim(), password)
      navigate(data.customer?.role === 'ADMIN' ? '/admin' : from, { replace: true })
    } catch (err) {
      if (err.status === 403 && err.details?.error === 'ACCOUNT_BLOCKED') {
        // HU-02 y HU-03: cuenta bloqueada con mensaje claro
        setError({
          type: 'blocked',
          message: err.details.message,
          reason: err.details.reason,
          support: err.details.supportContact
        })
      } else if (err.status === 401) {
        setError({ type: 'credentials', message: 'Código SAP o contraseña incorrectos.' })
      } else {
        setError({ type: 'generic', message: 'No se puede conectar con el servidor. Inténtalo de nuevo.' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center relative overflow-hidden">

      {/* Background decoration */}
      <svg
        className="absolute -right-28 -top-20 opacity-[0.04] w-[600px] pointer-events-none"
        viewBox="0 0 100 90"
      >
        <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="#4A5740" />
      </svg>

      {/* Login box */}
      <div className="bg-off-white border border-border rounded-[20px] px-[52px] py-14 w-[440px] relative z-10 shadow-[0_24px_80px_rgba(0,0,0,0.06)]">

        {/* Brand */}
        <div className="flex flex-col items-center mb-10 gap-3">
          <Logo size={48} />
          <div>
            <h1 className="font-serif text-[28px] font-light text-center tracking-wide text-charcoal">
              Secretos del Agua
            </h1>
            <p className="text-xs text-muted text-center tracking-[0.04em] mt-1">
              Portal profesional B2B · Acceso exclusivo
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Error — credenciales */}
          {error?.type === 'credentials' && (
            <div className="bg-[#FDF0EE] border border-[#E8C5BF] rounded-lg px-4 py-3 text-xs text-error flex items-center gap-2 mb-5">
              <span>⚠</span>
              {error.message}
            </div>
          )}

          {/* Error — servicio no disponible */}
          {error?.type === 'generic' && (
            <div className="bg-[#FDF0EE] border border-[#E8C5BF] rounded-lg px-4 py-3 text-xs text-error flex items-center gap-2 mb-5">
              <span>⚠</span>
              {error.message}
            </div>
          )}

          {/* HU-03 — cuenta bloqueada */}
          {error?.type === 'blocked' && (
            <div className="bg-[#FDF0EE] border border-[#E8C5BF] rounded-xl px-4 py-4 mb-5">
              <div className="flex items-start gap-2 mb-3">
                <span className="text-error text-base leading-none mt-0.5">⊘</span>
                <p className="text-xs text-error leading-relaxed">{error.message}</p>
              </div>
              {error.support && (
                <div className="border-t border-[#E8C5BF] pt-3 mt-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted mb-1.5 font-medium">
                    Contacto de soporte
                  </p>
                  <div className="text-xs text-charcoal space-y-0.5">
                    <div>{error.support.email}</div>
                    <div>{error.support.phone}</div>
                    <div className="text-muted">{error.support.hours}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SAP Code */}
          <div className="mb-5">
            <label className="form-label">Código de cliente SAP</label>
            <input
              type="text"
              className="form-input"
              placeholder="SDA-00000"
              value={sapCode}
              onChange={e => setSapCode(e.target.value)}
              autoComplete="username"
              autoFocus
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !sapCode || !password}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <><Spinner size="sm" /> Accediendo…</> : 'Acceder al portal'}
          </button>
        </form>

        <p className="text-center mt-6 text-[11px] text-muted">
          ¿Problemas de acceso? Contacta con tu representante comercial.
        </p>
      </div>
    </div>
  )
}
