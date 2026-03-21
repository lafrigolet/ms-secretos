import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync.js'
import { commercialApi, cartApi } from '../api/index.js'
import { useCartContext } from '../context/CartContext.jsx'
import { Spinner } from '../components/Spinner.jsx'

const STATUS_CONFIG = {
  PENDING:  { label: 'Pendiente',  bg: 'bg-[#F7F3E8]', text: 'text-gold' },
  ACCEPTED: { label: 'Aceptado',   bg: 'bg-[#EEF4EA]', text: 'text-success' },
  REJECTED: { label: 'Rechazado',  bg: 'bg-[#FDF0EE]', text: 'text-error' },
}

export function CommercialPage () {
  const navigate   = useNavigate()
  const { refresh: refreshCart } = useCartContext()
  const [responding, setResponding] = useState(null)

  const { data: commercial, loading: loadingC, error: errorC } = useAsync(
    () => commercialApi.getMyCommercial(), []
  )
  const { data: suggestions, loading: loadingS, refetch: refetchS } = useAsync(
    () => commercialApi.getSuggestedOrders(), []
  )

  async function handleRespond (sug, status) {
    setResponding(sug.id)
    try {
      await commercialApi.respondSuggested(sug.id, status)
      if (status === 'ACCEPTED') {
        // Cargar los items sugeridos en la cesta
        for (const item of sug.items) {
          await cartApi.addItem(item.productCode, item.name, item.quantity, item.unitPrice)
        }
        await refreshCart()
        refetchS()
        navigate('/cart')
      } else {
        refetchS()
      }
    } catch { alert('Error al responder el pedido sugerido') }
    finally { setResponding(null) }
  }

  const pending  = suggestions?.filter(s => s.status === 'PENDING')  ?? []
  const history  = suggestions?.filter(s => s.status !== 'PENDING')  ?? []

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">Mi comercial</h1>
        <p className="page-subtitle">Contacto y pedidos sugeridos por tu representante</p>
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* HU-44 — Datos del comercial */}
        <div className="card">
          <p className="section-label">Tu representante comercial</p>

          {loadingC && <div className="flex justify-center py-8"><Spinner /></div>}

          {errorC && (
            <div className="text-center py-8 text-muted">
              <p className="text-3xl mb-3">👤</p>
              <p className="text-sm">Aún no tienes un comercial asignado.</p>
              <p className="text-xs mt-1">Contacta con administración para que te asignen uno.</p>
            </div>
          )}

          {commercial && (
            <div>
              {/* Avatar */}
              <div className="flex items-center gap-4 mb-6 p-4 bg-cream rounded-xl">
                <div className="w-16 h-16 bg-sage-dark rounded-full flex items-center justify-center text-off-white text-2xl font-serif font-light flex-shrink-0">
                  {commercial.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-serif text-xl font-normal text-charcoal">{commercial.name}</h2>
                  <p className="text-sm text-muted">{commercial.zone}</p>
                  <p className="text-xs text-muted mt-0.5">
                    Tu comercial desde {commercial.assignedAt
                      ? new Date(commercial.assignedAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Datos de contacto */}
              <p className="section-label">Datos de contacto</p>
              <div className="space-y-3">
                <a href={`mailto:${commercial.email}`}
                  className="flex items-center gap-3 p-3 bg-cream rounded-lg hover:bg-sage-light/20 transition-colors group">
                  <span className="text-lg">✉</span>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Email</p>
                    <p className="text-sm text-sage-dark group-hover:underline">{commercial.email}</p>
                  </div>
                </a>
                <a href={`tel:${commercial.phone}`}
                  className="flex items-center gap-3 p-3 bg-cream rounded-lg hover:bg-sage-light/20 transition-colors group">
                  <span className="text-lg">📞</span>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Teléfono</p>
                    <p className="text-sm text-charcoal">{commercial.phone}</p>
                  </div>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* HU-45 — Pedidos sugeridos */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <p className="section-label mb-0">Pedidos sugeridos</p>
            {pending.length > 0 && (
              <span className="tag bg-[#F7F3E8] text-gold text-[10px]">{pending.length} pendiente{pending.length > 1 ? 's' : ''}</span>
            )}
          </div>

          {loadingS && <div className="flex justify-center py-8"><Spinner /></div>}

          {!loadingS && suggestions?.length === 0 && (
            <div className="text-center py-8 text-muted">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-sm">Tu comercial no te ha enviado pedidos sugeridos todavía</p>
            </div>
          )}

          {/* Pendientes */}
          {pending.map(sug => (
            <div key={sug.id} className="border border-sage-light/50 rounded-xl p-4 mb-3 bg-[#F7F8F5]">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs font-medium text-sage-dark mb-0.5">{sug.commercialName}</p>
                  <p className="text-xs text-muted">
                    {new Date(sug.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
                <span className="tag bg-[#F7F3E8] text-gold text-[10px]">Pendiente</span>
              </div>

              {sug.message && (
                <p className="text-sm text-charcoal italic mb-3 leading-relaxed">"{sug.message}"</p>
              )}

              <div className="space-y-1.5 mb-4">
                {sug.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-charcoal">{item.name}</span>
                    <span className="text-muted">×{item.quantity} · {(item.unitPrice * item.quantity).toFixed(2)}€</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-medium pt-1.5 border-t border-border">
                  <span>Total estimado</span>
                  <span>{sug.items?.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2)}€</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleRespond(sug, 'REJECTED')}
                  disabled={responding === sug.id}
                  className="flex-1 py-2 text-xs border border-border rounded-lg text-muted hover:border-error hover:text-error transition-colors bg-transparent cursor-pointer"
                >
                  Rechazar
                </button>
                <button
                  onClick={() => handleRespond(sug, 'ACCEPTED')}
                  disabled={responding === sug.id}
                  className="flex-1 py-2 text-xs bg-sage-dark text-off-white rounded-lg hover:bg-sage transition-colors border-0 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {responding === sug.id ? <><Spinner size="sm" />Cargando…</> : '✓ Aceptar y añadir a cesta'}
                </button>
              </div>
            </div>
          ))}

          {/* Historial */}
          {history.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-wider text-muted mb-2 mt-4">Historial</p>
              {history.map(sug => {
                const cfg = STATUS_CONFIG[sug.status]
                return (
                  <div key={sug.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                    <div className="flex-1">
                      <p className="text-xs text-charcoal">{sug.items?.length} producto{sug.items?.length > 1 ? 's' : ''}</p>
                      <p className="text-xs text-muted">
                        {new Date(sug.createdAt).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <span className={`tag ${cfg.bg} ${cfg.text} text-[10px]`}>{cfg.label}</span>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
