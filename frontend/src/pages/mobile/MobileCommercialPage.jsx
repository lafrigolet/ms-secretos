import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync.js'
import { commercialApi, cartApi } from '../../api/index.js'
import { useCartContext } from '../../context/CartContext.jsx'
import { Spinner } from '../../components/Spinner.jsx'

const card = {
  background: '#FDFCFA',
  boxShadow: '0 2px 16px rgba(44,44,40,0.06)',
}

const TABS = ['Mi comercial', 'Pedidos sugeridos']

export function MobileCommercialPage () {
  const navigate   = useNavigate()
  const { refresh: refreshCart } = useCartContext()
  const [activeTab, setActiveTab] = useState('Mi comercial')
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
        for (const item of sug.items) {
          await cartApi.addItem(item.productCode, item.name, item.quantity, item.unitPrice)
        }
        await refreshCart()
        refetchS()
        navigate('/cart')
      } else {
        refetchS()
      }
    } catch { alert('Error al responder') }
    finally { setResponding(null) }
  }

  const pending = suggestions?.filter(s => s.status === 'PENDING') ?? []
  const history = suggestions?.filter(s => s.status !== 'PENDING') ?? []

  return (
    <div>
      <div className="px-4 pt-5 mb-4">
        <h1 className="font-serif text-[34px] font-light text-charcoal leading-none mb-1">Mi comercial</h1>
        <p className="text-sm text-muted">Contacto y pedidos sugeridos</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 mb-0" style={{ borderBottom: '1px solid rgba(226,221,214,0.6)' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-1.5"
            style={{ borderColor: activeTab === tab ? '#4A5740' : 'transparent', color: activeTab === tab ? '#4A5740' : '#B0ADA7' }}>
            {tab}
            {tab === 'Pedidos sugeridos' && pending.length > 0 && (
              <span className="min-w-[18px] h-[18px] text-off-white text-[10px] font-semibold  flex items-center justify-center px-1"
                style={{ background: 'linear-gradient(135deg,#B8963C,#C8A84C)', boxShadow: '0 2px 6px rgba(184,150,60,0.35)' }}>
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="px-4 pt-5 pb-8">

        {/* Mi comercial */}
        {activeTab === 'Mi comercial' && (
          <div>
            {loadingC && <div className="flex justify-center py-12"><Spinner /></div>}

            {errorC && (
              <div className="flex flex-col items-center text-center py-12">
                <div className="w-20 h-20  flex items-center justify-center text-4xl mb-4"
                  style={{ background: 'linear-gradient(135deg,#E8D4A0,#F0E4CB)' }}>👤</div>
                <p className="font-serif text-xl font-light text-charcoal mb-1">Sin comercial asignado</p>
                <p className="text-sm text-muted">Contacta con administración para que te asignen uno.</p>
              </div>
            )}

            {commercial && (
              <div>
                {/* Commercial hero card */}
                <div className="p-5 mb-4"
                  style={{ ...card, background: 'linear-gradient(135deg,#EEF4EA,#F4F8F2)' }}>
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-16 h-16  flex items-center justify-center text-2xl text-off-white font-serif font-light flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', boxShadow: '0 4px 16px rgba(74,87,64,0.25)' }}
                    >
                      {commercial.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-serif text-xl text-charcoal font-light">{commercial.name}</h2>
                      <p className="text-sm text-muted">{commercial.zone}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted">
                    Tu responsable comercial desde{' '}
                    {commercial.assignedAt
                      ? new Date(commercial.assignedAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                      : '—'}
                  </p>
                </div>

                {/* Contact actions */}
                <p className="m-label mb-3">Contacto directo</p>
                <div className="space-y-2.5">
                  <a href={`mailto:${commercial.email}`}
                    className="flex items-center gap-4 p-4 active:scale-[0.98] transition-transform" style={card}>
                    <div className="w-11 h-11  flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: '#EEF4EA' }}>✉</div>
                    <div className="flex-1 min-w-0">
                      <p className="m-label">Email profesional</p>
                      <p className="text-sm truncate" style={{ color: '#4A5740' }}>{commercial.email}</p>
                    </div>
                    <span className="text-muted text-xl">›</span>
                  </a>
                  <a href={`tel:${commercial.phone}`}
                    className="flex items-center gap-4 p-4 active:scale-[0.98] transition-transform" style={card}>
                    <div className="w-11 h-11  flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: '#F7F3E8' }}>📞</div>
                    <div className="flex-1 min-w-0">
                      <p className="m-label">Teléfono</p>
                      <p className="text-sm text-charcoal">{commercial.phone}</p>
                    </div>
                    <span className="text-muted text-xl">›</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pedidos sugeridos */}
        {activeTab === 'Pedidos sugeridos' && (
          <div>
            {loadingS && <div className="flex justify-center py-12"><Spinner /></div>}

            {!loadingS && suggestions?.length === 0 && (
              <div className="flex flex-col items-center text-center py-12">
                <div className="w-20 h-20  flex items-center justify-center text-4xl mb-4"
                  style={{ background: 'linear-gradient(135deg,#C8D4BE,#DFE9D9)' }}>📋</div>
                <p className="font-serif text-xl font-light text-charcoal mb-1">Sin pedidos sugeridos</p>
                <p className="text-sm text-muted">Tu comercial aún no te ha enviado sugerencias</p>
              </div>
            )}

            {/* Pending */}
            {pending.map(sug => (
              <div key={sug.id} className="p-4 mb-3"
                style={{ ...card, background: 'linear-gradient(135deg,#F7F8F5,#FAFBF9)' }}>
                <div className="flex items-start justify-between mb-2.5">
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: '#4A5740' }}>{sug.commercialName}</p>
                    <p className="text-xs text-muted">
                      {new Date(sug.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium px-2.5 py-1 "
                    style={{ background: 'rgba(184,150,60,0.12)', color: '#8C6E52' }}>
                    Pendiente
                  </span>
                </div>

                {sug.message && (
                  <p className="text-sm text-charcoal italic mb-3 leading-relaxed">"{sug.message}"</p>
                )}

                <div className="space-y-1 mb-4">
                  {sug.items?.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-charcoal">{item.name}</span>
                      <span className="text-muted tabular-nums">×{item.quantity} · {(item.unitPrice * item.quantity).toFixed(2)}€</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-medium pt-2"
                    style={{ borderTop: '1px solid rgba(226,221,214,0.6)', marginTop: '6px' }}>
                    <span>Total estimado</span>
                    <span className="tabular-nums">{sug.items?.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2)}€</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => handleRespond(sug, 'REJECTED')} disabled={responding === sug.id}
                    className="flex-1 py-3.5 text-sm  text-muted active:scale-[0.97] transition-all"
                    style={{ background: '#F2EFE9', boxShadow: '0 1px 6px rgba(44,44,40,0.08)' }}>
                    Rechazar
                  </button>
                  <button onClick={() => handleRespond(sug, 'ACCEPTED')} disabled={responding === sug.id}
                    className="flex-1 py-3.5 text-sm  text-off-white flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all"
                    style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', boxShadow: '0 4px 14px rgba(74,87,64,0.28)' }}>
                    {responding === sug.id ? <><Spinner size="sm" />…</> : '✓ Aceptar'}
                  </button>
                </div>
              </div>
            ))}

            {/* History */}
            {history.length > 0 && (
              <div className="mt-2">
                <p className="m-label mb-3">Historial</p>
                <div style={card} className="divide-y" style={{ ...card }}>
                  {history.map((sug, i) => {
                    const statusCfg = {
                      ACCEPTED: { label: 'Aceptado',  text: '#4A7054', bg: 'rgba(74,112,84,0.10)' },
                      REJECTED: { label: 'Rechazado', text: '#8B3A2F', bg: 'rgba(139,58,47,0.10)' },
                    }[sug.status] ?? { label: sug.status, text: '#8A8880', bg: '#F2EFE9' }
                    return (
                      <div key={sug.id} className="flex items-center gap-3 p-4">
                        <div className="flex-1">
                          <p className="text-sm text-charcoal">{sug.items?.length} producto{sug.items?.length !== 1 ? 's' : ''}</p>
                          <p className="text-xs text-muted">{new Date(sug.createdAt).toLocaleDateString('es-ES')}</p>
                        </div>
                        <span className="text-[10px] font-medium px-2.5 py-1 "
                          style={{ background: statusCfg.bg, color: statusCfg.text }}>
                          {statusCfg.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
