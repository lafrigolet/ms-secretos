import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync.js'
import { returnsApi, ordersApi } from '../../api/index.js'
import { Spinner } from '../../components/Spinner.jsx'

const card = {
  background: '#FDFCFA',
  boxShadow: '0 2px 16px rgba(44,44,40,0.06)',
}

export function MobileNewReturnPage () {
  const navigate = useNavigate()
  const location = useLocation()

  const preselectedOrderId = location.state?.orderId ?? ''

  const [orderId, setOrderId]             = useState(preselectedOrderId)
  const [reason, setReason]               = useState('')
  const [notes, setNotes]                 = useState('')
  const [selectedItems, setSelectedItems] = useState([])
  const [submitting, setSubmitting]       = useState(false)
  const [error, setError]                 = useState(null)

  const { data: reasons } = useAsync(() => returnsApi.getReasons(), [])

  const { data: order, loading: orderLoading } = useAsync(
    () => orderId.length > 5 ? ordersApi.getOrder(orderId) : Promise.resolve(null),
    [orderId]
  )

  function toggleItem (item) {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.productCode === item.productCode)
      if (exists) return prev.filter(i => i.productCode !== item.productCode)
      return [...prev, { ...item }]
    })
  }

  function updateQty (productCode, qty) {
    setSelectedItems(prev =>
      prev.map(i => i.productCode === productCode ? { ...i, quantity: Math.max(1, qty) } : i)
    )
  }

  async function handleSubmit (e) {
    e.preventDefault()
    if (!orderId || !reason || selectedItems.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      await returnsApi.createReturn(orderId, reason, notes, selectedItems)
      navigate('/returns', { state: { success: true } })
    } catch (err) {
      setError(err.message ?? 'Error al crear la solicitud.')
    } finally {
      setSubmitting(false)
    }
  }

  const StepLabel = ({ n, text }) => (
    <div className="flex items-center gap-2.5 mb-4">
      <span
        className="w-6 h-6  flex items-center justify-center text-[11px] font-medium text-off-white flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)' }}
      >
        {n}
      </span>
      <p className="text-sm font-medium text-charcoal">{text}</p>
    </div>
  )

  return (
    <div className="px-4 pt-5 pb-10">
      <div className="mb-6">
        <h1 className="font-serif text-[34px] font-light text-charcoal leading-none mb-1">
          Nueva devolución
        </h1>
        <p className="text-sm text-muted">Indica el pedido, motivo y productos afectados</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">

        {/* Step 1 — Order */}
        <div style={card} className="p-4">
          <StepLabel n="1" text="Pedido a devolver" />
          <input
            type="text"
            className="w-full  px-5 py-4 text-sm text-charcoal outline-none"
            style={{ background: '#F2EFE9' }}
            placeholder="Ej: SDA-2025-0890"
            value={orderId}
            onChange={e => { setOrderId(e.target.value); setSelectedItems([]) }}
          />

          {orderLoading && orderId.length > 5 && (
            <div className="flex items-center gap-2 mt-3 text-xs text-muted">
              <Spinner size="sm" /> Cargando pedido…
            </div>
          )}

          {order && (
            <div
              className="mt-3 p-4 "
              style={{ background: '#F2EFE9' }}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-medium text-sm">{order.orderId}</p>
                  <p className="text-xs text-muted">
                    {new Date(order.date).toLocaleDateString('es-ES')} · {order.total?.toFixed(2)}€
                  </p>
                </div>
                <span className="text-xs  px-2.5 py-1" style={{ background: 'rgba(74,112,84,0.12)', color: '#4A7054' }}>
                  {order.status}
                </span>
              </div>

              <p className="m-label mb-2.5">Selecciona los productos afectados</p>
              <div className="space-y-2">
                {order.items?.map(item => {
                  const selected = selectedItems.find(i => i.productCode === item.productCode)
                  return (
                    <div
                      key={item.productCode}
                      className="flex items-center gap-3 p-3.5  cursor-pointer transition-all active:scale-[0.98]"
                      style={{
                        background: selected ? 'rgba(74,87,64,0.07)' : '#FDFCFA',
                        border: `1.5px solid ${selected ? 'rgba(74,87,64,0.25)' : 'transparent'}`,
                      }}
                      onClick={() => toggleItem(item)}
                    >
                      <div
                        className="w-5 h-5  flex items-center justify-center flex-shrink-0 transition-all"
                        style={selected
                          ? { background: 'linear-gradient(135deg,#4A5740,#6B7B5E)' }
                          : { background: '#E2DDD6' }
                        }
                      >
                        {selected && <span className="text-white text-[10px] leading-none">✓</span>}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-charcoal">{item.name}</p>
                        <p className="text-xs text-muted">{item.unitPrice?.toFixed(2)}€ / ud</p>
                      </div>
                      {selected && (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button type="button"
                            className="w-7 h-7  flex items-center justify-center text-sm"
                            style={{ background: '#E2DDD6' }}
                            onClick={() => updateQty(item.productCode, (selected.quantity ?? 1) - 1)}>−</button>
                          <span className="w-6 text-center text-sm font-medium">{selected.quantity ?? 1}</span>
                          <button type="button"
                            className="w-7 h-7  flex items-center justify-center text-sm"
                            style={{ background: '#E2DDD6' }}
                            onClick={() => updateQty(item.productCode, (selected.quantity ?? 1) + 1)}>+</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Step 2 — Reason */}
        <div style={card} className="p-4">
          <StepLabel n="2" text="Motivo de la devolución" />
          <div className="space-y-2">
            {reasons?.map(r => (
              <label
                key={r.code}
                className="flex items-center gap-3 p-3.5  cursor-pointer transition-all active:scale-[0.98]"
                style={{
                  background: reason === r.code ? 'rgba(74,87,64,0.07)' : '#F2EFE9',
                  border: `1.5px solid ${reason === r.code ? 'rgba(74,87,64,0.25)' : 'transparent'}`,
                }}
              >
                <input type="radio" name="reason" value={r.code}
                  checked={reason === r.code} onChange={() => setReason(r.code)}
                  className="sr-only" />
                <div
                  className="w-5 h-5  flex items-center justify-center flex-shrink-0 transition-all"
                  style={reason === r.code
                    ? { background: 'linear-gradient(135deg,#4A5740,#6B7B5E)' }
                    : { background: '#E2DDD6' }
                  }
                >
                  {reason === r.code && <span className="w-2 h-2 bg-white " />}
                </div>
                <span className="text-sm text-charcoal">{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Step 3 — Notes */}
        <div style={card} className="p-4">
          <StepLabel n="3" text="Observaciones (opcional)" />
          <textarea
            className="w-full  px-5 py-4 text-sm text-charcoal outline-none resize-none"
            style={{ background: '#F2EFE9' }}
            rows={3}
            placeholder="Describe el problema con más detalle…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            maxLength={500}
          />
          <p className="text-xs text-muted text-right mt-1.5">{notes.length}/500</p>
        </div>

        {error && (
          <div className=" px-4 py-3 text-sm text-error"
            style={{ background: 'rgba(139,58,47,0.07)' }}>
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            className="flex-1 py-4  text-sm font-medium text-charcoal bg-[#FDFCFA] active:scale-[0.97] transition-all"
            style={{ boxShadow: '0 1px 8px rgba(44,44,40,0.08)' }}
            onClick={() => navigate(-1)}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 py-4  text-sm font-medium text-off-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.97] transition-all"
            style={{
              background: 'linear-gradient(135deg,#4A5740,#6B7B5E)',
              boxShadow: '0 4px 16px rgba(74,87,64,0.28)',
            }}
            disabled={submitting || !orderId || !reason || selectedItems.length === 0}
          >
            {submitting ? <><Spinner size="sm" />Enviando…</> : 'Enviar solicitud'}
          </button>
        </div>
      </form>
    </div>
  )
}
