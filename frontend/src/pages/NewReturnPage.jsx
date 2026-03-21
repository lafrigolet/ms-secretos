import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync.js'
import { returnsApi, ordersApi } from '../api/index.js'
import { Spinner } from '../components/Spinner.jsx'

export function NewReturnPage () {
  const navigate   = useNavigate()
  const location   = useLocation()

  // Puede venir con el orderId precargado desde la página de pedidos
  const preselectedOrderId = location.state?.orderId ?? ''

  const [orderId, setOrderId]       = useState(preselectedOrderId)
  const [reason, setReason]         = useState('')
  const [notes, setNotes]           = useState('')
  const [selectedItems, setSelectedItems] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)

  const { data: reasons } = useAsync(() => returnsApi.getReasons(), [])

  // Cargar el pedido cuando se introduce el orderId
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
      setError(err.message ?? 'Error al crear la solicitud. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted mb-8">
        <button className="hover:text-sage-dark" onClick={() => navigate('/orders')}>Mis pedidos</button>
        <span>›</span>
        <span className="text-charcoal">Nueva devolución</span>
      </div>

      <h1 className="page-title mb-1">Solicitud de devolución</h1>
      <p className="page-subtitle mb-8">Indica el pedido, el motivo y los productos afectados</p>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Paso 1 — Pedido */}
        <div className="card">
          <p className="section-label">1. Pedido a devolver</p>
          <label className="form-label">Número de pedido</label>
          <input
            type="text"
            className="form-input"
            placeholder="Ej: SDA-2025-0890"
            value={orderId}
            onChange={e => { setOrderId(e.target.value); setSelectedItems([]) }}
          />

          {orderLoading && orderId.length > 5 && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted">
              <Spinner size="sm" /> Cargando pedido…
            </div>
          )}

          {order && (
            <div className="mt-4 bg-cream rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-medium text-sm">{order.orderId}</p>
                  <p className="text-xs text-muted">
                    {new Date(order.date).toLocaleDateString('es-ES')} · {order.total?.toFixed(2)}€
                  </p>
                </div>
                <span className="tag bg-[#EEF4EA] text-success text-xs">{order.status}</span>
              </div>

              {/* Paso 2 — Selección de líneas */}
              <p className="text-[10px] uppercase tracking-wider text-muted mb-2">
                Selecciona los productos afectados
              </p>
              <div className="space-y-2">
                {order.items?.map(item => {
                  const selected = selectedItems.find(i => i.productCode === item.productCode)
                  return (
                    <div
                      key={item.productCode}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        selected ? 'border-sage bg-sage-light/10' : 'border-border bg-off-white'
                      }`}
                      onClick={() => toggleItem(item)}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        selected ? 'bg-sage-dark border-sage-dark' : 'border-border'
                      }`}>
                        {selected && <span className="text-white text-xs leading-none">✓</span>}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-charcoal">{item.name}</p>
                        <p className="text-xs text-muted">{item.unitPrice?.toFixed(2)}€ / ud</p>
                      </div>
                      {selected && (
                        <div
                          className="flex items-center gap-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => updateQty(item.productCode, (selected.quantity ?? 1) - 1)}
                            className="w-6 h-6 bg-cream rounded border border-border text-xs hover:bg-sage-light/20 transition-colors"
                          >−</button>
                          <span className="w-8 text-center text-sm font-medium">{selected.quantity ?? 1}</span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.productCode, (selected.quantity ?? 1) + 1)}
                            className="w-6 h-6 bg-cream rounded border border-border text-xs hover:bg-sage-light/20 transition-colors"
                          >+</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Paso 2 — Motivo */}
        <div className="card">
          <p className="section-label">2. Motivo de la devolución</p>
          <div className="space-y-2">
            {reasons?.map(r => (
              <label
                key={r.code}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  reason === r.code ? 'border-sage bg-sage-light/10' : 'border-border hover:border-sage-light'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.code}
                  checked={reason === r.code}
                  onChange={() => setReason(r.code)}
                  className="accent-sage-dark"
                />
                <span className="text-sm text-charcoal">{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Observaciones */}
        <div className="card">
          <p className="section-label">3. Observaciones (opcional)</p>
          <textarea
            className="form-input resize-none"
            rows={3}
            placeholder="Describe el problema con más detalle…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            maxLength={500}
          />
          <p className="text-xs text-muted text-right mt-1">{notes.length}/500</p>
        </div>

        {error && (
          <div className="bg-[#FDF0EE] border border-[#E8C5BF] rounded-lg px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => navigate(-1)}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={submitting || !orderId || !reason || selectedItems.length === 0}
          >
            {submitting
              ? <><Spinner size="sm" />Enviando…</>
              : 'Enviar solicitud de devolución'
            }
          </button>
        </div>
      </form>
    </div>
  )
}
