import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { Spinner } from '../../components/Spinner.jsx'

export function MobileLoginPage () {
  const [sapCode, setSapCode]   = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)

  const { login } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
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
        setError({ type: 'blocked', message: err.details.message, reason: err.details.reason, support: err.details.supportContact })
      } else if (err.status === 401) {
        setError({ type: 'credentials', message: 'Código SAP o contraseña incorrectos.' })
      } else {
        setError({ type: 'generic', message: 'No se puede conectar con el servidor.' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden relative bg-[#F0ECE4]">

      {/* Organic background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-20 w-80 h-80  opacity-40"
          style={{ background: 'radial-gradient(circle, #C8D4BE 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 -left-24 w-64 h-64  opacity-30"
          style={{ background: 'radial-gradient(circle, #D4B99A 0%, transparent 70%)' }} />
        <div className="absolute -bottom-20 right-8 w-72 h-72  opacity-35"
          style={{ background: 'radial-gradient(circle, #B8963C40 0%, transparent 70%)' }} />
      </div>

      {/* Brand header */}
      <div className="flex-shrink-0 pt-20 pb-10 px-8 relative">
        {/* Botanical monogram */}
        <div className="w-16 h-16 mb-6  flex items-center justify-center text-3xl"
          style={{
            background: 'linear-gradient(135deg, #4A5740, #6B7B5E)',
            boxShadow: '0 8px 24px rgba(74,87,64,0.30)',
          }}>
          💧
        </div>

        <h1 className="font-serif text-[40px] font-light leading-none text-charcoal mb-2">
          Secretos<br />del Agua
        </h1>
        <p className="text-sm text-muted tracking-wide">
          Portal profesional · Acceso exclusivo
        </p>
      </div>

      {/* Floating form card */}
      <div className="flex-1 relative">
        <div
          className="absolute inset-0 bg-[#FDFCFA]"
          style={{ boxShadow: '0 -8px 40px rgba(44,44,40,0.10)' }}
        >
          <div className="px-6 pt-8 pb-safe overflow-y-auto h-full">

            <h2 className="font-serif text-2xl font-light text-charcoal mb-6">
              Iniciar sesión
            </h2>

            {/* Errors */}
            {(error?.type === 'credentials' || error?.type === 'generic') && (
              <div className=" px-4 py-3.5 text-sm text-error flex items-start gap-2.5 mb-5"
                style={{ background: 'rgba(139,58,47,0.07)' }}>
                <span className="mt-0.5 text-base">⚠</span>
                <span className="leading-relaxed">{error.message}</span>
              </div>
            )}

            {error?.type === 'blocked' && (
              <div className=" px-4 py-4 mb-5"
                style={{ background: 'rgba(139,58,47,0.07)' }}>
                <div className="flex items-start gap-2.5 mb-3">
                  <span className="text-error text-base mt-0.5">⊘</span>
                  <p className="text-sm text-error leading-relaxed">{error.message}</p>
                </div>
                {error.support && (
                  <div className="pt-3 border-t border-[#E8C5BF]/60">
                    <p className="m-label mb-1.5">Contacto de soporte</p>
                    <a href={`mailto:${error.support.email}`} className="block text-sm text-sage-dark mb-0.5">{error.support.email}</a>
                    <a href={`tel:${error.support.phone}`} className="block text-sm text-charcoal mb-0.5">{error.support.phone}</a>
                    <p className="text-xs text-muted">{error.support.hours}</p>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* SAP Code */}
              <div className="mb-4">
                <label className="m-label mb-2 block">Código de cliente SAP</label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full bg-[#F2EFE9]  px-5 py-4 text-base text-charcoal outline-none transition-all placeholder:text-muted/60"
                    style={{ caretColor: '#4A5740' }}
                    placeholder="SDA-00000"
                    value={sapCode}
                    onChange={e => setSapCode(e.target.value)}
                    autoComplete="username"
                    autoFocus
                    disabled={loading}
                    onFocus={e => e.target.parentElement.querySelector('input').style.boxShadow = '0 0 0 2px rgba(74,87,64,0.3)'}
                    onBlur={e => e.target.style.boxShadow = ''}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-8">
                <label className="m-label mb-2 block">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="w-full bg-[#F2EFE9]  px-5 py-4 pr-14 text-base text-charcoal outline-none transition-all placeholder:text-muted/60"
                    style={{ caretColor: '#4A5740' }}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-sm"
                  >
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !sapCode || !password}
                className="w-full py-4 text-base font-medium text-off-white  disabled:opacity-40 transition-all active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #4A5740 0%, #6B7B5E 100%)',
                  boxShadow: '0 6px 24px rgba(74,87,64,0.32)',
                }}
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" /> Accediendo…</span>
                  : 'Acceder al portal'}
              </button>
            </form>

            <p className="text-center mt-8 text-xs text-muted leading-relaxed pb-8">
              Acceso restringido a distribuidores autorizados.<br />
              Contacta con tu representante si necesitas ayuda.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
