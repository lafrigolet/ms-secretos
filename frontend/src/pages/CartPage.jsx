import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartContext } from '../context/CartContext.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { promotionsApi, ordersApi } from '../api/index.js'
import { Spinner } from '../components/Spinner.jsx'

const FAMILY_EMOJI = { F01: '✨', F02: '🌿', F03: '💧' }
const SHIPPING_THRESHOLD = 150

function BenefitItem ({ benefit }) {
  const icons = { GIFT: '🎁', SAMPLE: '🧪', DISCOUNT: '🏷️' }
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-cream rounded-lg mb-2">
      <span className="text-xl">{icons[benefit.benefit?.type] ?? '🎁'}</span>
      <div>
        <p className="text-xs font-medium text-charcoal">{benefit.promoName}</p>
        <p className="text-xs text-muted">{benefit.benefit?.description ?? ''}</p>
      </div>
    </div>
  )
}

export function CartPage () {
  const navigate = useNavigate()
  const { cart, updateItem, removeItem, clearCart, loading: cartLoading } = useCartContext()
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed]   = useState(false)
  const [orderResult, setOrderResult] = useState(null)

  // HU-12, HU-13 — calcular beneficios automáticamente
  const { data: summary } = useAsync(
    () => promotionsApi.calculate(cart.items ?? [], cart.subtotal ?? 0),
    [JSON.stringify(cart.items), cart.subtotal]
  )

  const benefits = summary?.benefits ?? []
  const items    = cart.items ?? []
  const subtotal = cart.subtotal ?? 0
  const shipping = cart.shipping ?? 0
  const total    = cart.total ?? 0
  const freeShippingRemaining = Math.max(0, SHIPPING_THRESHOLD - subtotal)

  // HU-17 — confirmar pedido
  async function handleConfirm () {
    if (items.length === 0) return
    setConfirming(true)
    try {
      const order = await ordersApi.createOrder(items)
      await clearCart()
      setOrderResult(order)
      setConfirmed(true)
    } catch (err) {
      alert('Error al confirmar el pedido. Inténtalo de nuevo.')
    } finally {
      setConfirming(false)
    }
  }

  // Pantalla de confirmación tras el pedido
  if (confirmed && orderResult) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <div className="w-20 h-20 bg-[#EEF4EA] rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
          ✓
        </div>
        <h1 className="font-serif text-4xl font-light text-charcoal mb-3">
          Pedido confirmado
        </h1>
        <p className="text-muted mb-1">Tu pedido ha sido registrado correctamente.</p>
        <p className="text-sm font-medium text-charcoal mb-8">
          Referencia: <span className="text-sage-dark">{orderResult.orderId}</span>
        </p>
        <p className="text-sm text-muted mb-8">
          Recibirás una confirmación por email en breve.
        </p>
        <div className="flex gap-3 justify-center">
          <button className="btn-primary" onClick={() => navigate('/catalog')}>
            Seguir comprando
          </button>
          <button className="btn-secondary" onClick={() => navigate('/orders')}>
            Ver mis pedidos
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="page-title">Cesta de la compra</h1>
          <p className="page-subtitle">
            {items.length === 0 ? 'Tu cesta está vacía' : `${items.reduce((s, i) => s + i.quantity, 0)} artículos`}
          </p>
        </div>
        {items.length > 0 && (
          <button
            className="btn-ghost text-sm text-muted hover:text-error"
            onClick={clearCart}
          >
            Vaciar cesta
          </button>
        )}
      </div>

      {/* Cesta vacía */}
      {items.length === 0 && (
        <div className="text-center py-24">
          <div className="w-20 h-20 bg-cream rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
            🛍️
          </div>
          <p className="font-serif text-2xl font-light text-charcoal mb-2">
            Tu cesta está vacía
          </p>
          <p className="text-muted text-sm mb-8">
            Explora el catálogo y añade productos
          </p>
          <button className="btn-primary" onClick={() => navigate('/catalog')}>
            Ir al catálogo
          </button>
        </div>
      )}

      {/* Layout cesta + resumen */}
      {items.length > 0 && (
        <div className="grid grid-cols-[1fr_360px] gap-8 items-start">

          {/* HU-14 — Líneas de la cesta */}
          <div className="card">
            {items.map(item => (
              <div key={item.productCode}
                className="flex gap-5 items-center py-5 border-b border-border last:border-0"
              >
                {/* Imagen */}
                <div className="w-[72px] h-[72px] bg-cream rounded-xl flex items-center justify-center text-3xl flex-shrink-0">
                  {FAMILY_EMOJI['F01'] ?? '🧴'}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-sage mb-0.5">
                    {item.productCode}
                  </p>
                  <p className="font-serif text-[18px] mb-1">{item.name}</p>
                  <p className="text-xs text-muted">{item.unitPrice?.toFixed(2)}€ / ud</p>
                </div>

                {/* HU-14 — Control de cantidad */}
                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => item.quantity > 1
                      ? updateItem(item.productCode, item.quantity - 1)
                      : removeItem(item.productCode)
                    }
                    className="w-8 h-8 bg-cream border-0 cursor-pointer text-base text-charcoal flex items-center justify-center hover:bg-sage-light/20 transition-colors"
                  >−</button>
                  <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateItem(item.productCode, item.quantity + 1)}
                    className="w-8 h-8 bg-cream border-0 cursor-pointer text-base text-charcoal flex items-center justify-center hover:bg-sage-light/20 transition-colors"
                  >+</button>
                </div>

                {/* Precio línea */}
                <p className="text-lg font-medium min-w-[80px] text-right">
                  {(item.unitPrice * item.quantity).toFixed(2)}€
                </p>

                {/* Eliminar */}
                <button
                  onClick={() => removeItem(item.productCode)}
                  className="text-muted hover:text-error transition-colors border-0 bg-transparent cursor-pointer p-1 text-lg"
                  title="Eliminar"
                >×</button>
              </div>
            ))}
          </div>

          {/* HU-15, HU-16 — Resumen del pedido */}
          <div className="card sticky top-20">
            <p className="section-label">Resumen del pedido</p>

            {/* Progreso envío gratis */}
            {freeShippingRemaining > 0 && (
              <div className="bg-[#F7F3E8] rounded-lg px-3 py-2.5 mb-4 text-xs text-gold">
                Añade <strong>{freeShippingRemaining.toFixed(2)}€</strong> más para envío gratis
                <div className="w-full bg-gold/20 rounded-full h-1 mt-2">
                  <div
                    className="bg-gold h-1 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (subtotal / SHIPPING_THRESHOLD) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {freeShippingRemaining === 0 && (
              <div className="bg-[#EEF4EA] rounded-lg px-3 py-2 mb-4 text-xs text-success flex items-center gap-1.5">
                ✓ Envío gratuito aplicado
              </div>
            )}

            {/* Líneas de totales */}
            <div className="space-y-0">
              <div className="flex justify-between text-sm py-2 text-charcoal">
                <span>Subtotal</span>
                <span>{subtotal.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between text-sm py-2 text-muted">
                <span>Gastos de envío</span>
                <span>{shipping === 0 ? 'Gratis' : `${shipping.toFixed(2)}€`}</span>
              </div>

              {/* HU-12 — Beneficios */}
              {benefits.length > 0 && (
                <div className="border-t border-border pt-3 mt-1">
                  <p className="text-[10px] uppercase tracking-widest text-sage mb-2">
                    Beneficios incluidos
                  </p>
                  {benefits.map((b, i) => <BenefitItem key={i} benefit={b} />)}
                </div>
              )}
            </div>

            {/* Total */}
            <div className="flex justify-between text-xl font-medium pt-4 mt-2 border-t-2 border-charcoal">
              <span>Total</span>
              <span>{total.toFixed(2)}€</span>
            </div>

            {/* HU-16 — Confirmar pedido */}
            <button
              onClick={handleConfirm}
              disabled={confirming || cartLoading || items.length === 0}
              className="btn-primary w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirming ? <><Spinner size="sm" /> Confirmando…</> : 'Confirmar pedido'}
            </button>

            <button
              onClick={() => navigate('/catalog')}
              className="btn-ghost w-full mt-3 text-sm text-center"
            >
              Seguir comprando
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
