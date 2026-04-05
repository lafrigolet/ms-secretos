import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartContext } from '../../context/CartContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { promotionsApi, ordersApi } from '../../api/index.js'
import { Spinner } from '../../components/Spinner.jsx'

const FAMILY_META = {
  F01: { emoji: '✨', gradient: 'linear-gradient(135deg,#E8D4A0,#F0E4CB)' },
  F02: { emoji: '🌿', gradient: 'linear-gradient(135deg,#C8D4BE,#DFE9D9)' },
  F03: { emoji: '💧', gradient: 'linear-gradient(135deg,#B8CDD4,#D4E4EA)' },
}
const DEFAULT_META = { emoji: '🧴', gradient: 'linear-gradient(135deg,#E0D9D0,#EDE8E2)' }

const SHIPPING_THRESHOLD = 150

export function MobileCartPage () {
  const navigate = useNavigate()
  const { cart, updateItem, removeItem, clearCart, loading: cartLoading } = useCartContext()
  const [confirming, setConfirming] = useState(false)
  const [orderResult, setOrderResult] = useState(null)
  const [orderError, setOrderError]   = useState(null)

  const { data: summary } = useAsync(
    () => promotionsApi.calculate(cart.items ?? [], cart.subtotal ?? 0),
    [JSON.stringify(cart.items), cart.subtotal]
  )

  const benefits  = summary?.benefits ?? []
  const items     = cart.items ?? []
  const subtotal  = cart.subtotal ?? 0
  const shipping  = cart.shipping ?? 0
  const total     = cart.total ?? 0
  const remaining = Math.max(0, SHIPPING_THRESHOLD - subtotal)
  const progress  = Math.min(100, (subtotal / SHIPPING_THRESHOLD) * 100)

  async function handleConfirm () {
    if (items.length === 0) return
    setConfirming(true)
    setOrderError(null)
    try {
      const order = await ordersApi.createOrder(items)
      await clearCart()
      setOrderResult(order)
    } catch (err) {
      if (err.code === 'OUT_OF_STOCK') {
        setOrderError(`Sin stock suficiente para "${err.details?.productCode ?? 'un producto'}". Ajusta las cantidades e inténtalo de nuevo.`)
      } else {
        setOrderError(err.message ?? 'Error al confirmar el pedido. Inténtalo de nuevo.')
      }
    } finally {
      setConfirming(false)
    }
  }

  // Success screen
  if (orderResult) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div
          className="w-24 h-24  flex items-center justify-center text-5xl mb-6"
          style={{ background: 'linear-gradient(135deg,#C8D4BE,#DFE9D9)', boxShadow: '0 8px 32px rgba(74,112,84,0.20)' }}
        >
          ✓
        </div>
        <h1 className="font-serif text-4xl font-light text-charcoal mb-2">Pedido enviado</h1>
        <p className="text-muted mb-2 text-sm">Tu pedido ha sido registrado correctamente.</p>
        <p className="text-sm font-medium text-charcoal mb-1">
          Ref: <span className="text-sage-dark">{orderResult.orderId}</span>
        </p>
        <p className="text-xs text-muted mb-10 mt-1">Recibirás confirmación en tu email.</p>
        <div className="w-full max-w-xs flex flex-col gap-3">
          <button
            className="w-full py-4  text-sm font-medium text-off-white transition-all active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', boxShadow: '0 4px 16px rgba(74,87,64,0.28)' }}
            onClick={() => navigate('/catalog')}
          >
            Seguir comprando
          </button>
          <button
            className="w-full py-4  text-sm font-medium text-charcoal bg-cream active:scale-[0.97] transition-all"
            style={{ boxShadow: '0 1px 8px rgba(44,44,40,0.08)' }}
            onClick={() => navigate('/orders')}
          >
            Ver mis pedidos
          </button>
        </div>
      </div>
    )
  }

  // Empty cart
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] px-6 text-center">
        <div
          className="w-24 h-24  flex items-center justify-center text-5xl mb-5"
          style={{ background: 'linear-gradient(135deg,#E8D4A0,#F0E4CB)' }}
        >
          🛍️
        </div>
        <p className="font-serif text-2xl font-light text-charcoal mb-2">Cesta vacía</p>
        <p className="text-sm text-muted mb-8">Explora el catálogo y añade lo que necesites</p>
        <button
          className="py-4 px-8  text-sm font-medium text-off-white transition-all active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', boxShadow: '0 4px 16px rgba(74,87,64,0.28)' }}
          onClick={() => navigate('/catalog')}
        >
          Ir al catálogo
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between px-5 pt-5 mb-4">
        <p className="text-sm text-muted">
          {items.reduce((s, i) => s + i.quantity, 0)} artículos
        </p>
        <button onClick={clearCart} className="text-sm text-muted/70 underline underline-offset-2">
          Vaciar cesta
        </button>
      </div>

      {/* Free shipping banner */}
      <div className="px-4 mb-5">
        <div
          className=" px-5 py-4"
          style={remaining > 0
            ? { background: 'linear-gradient(135deg,#F7F3E8,#FBF7ED)' }
            : { background: 'linear-gradient(135deg,#EEF4EA,#F2F8EF)' }
          }
        >
          {remaining > 0 ? (
            <>
              <p className="text-sm text-charcoal mb-2.5">
                Añade <span className="font-medium text-gold">{remaining.toFixed(2)}€</span> más para envío gratuito
              </p>
              <div className="w-full  overflow-hidden" style={{ height: '5px', background: 'rgba(184,150,60,0.2)' }}>
                <div
                  className="h-full  transition-all"
                  style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#B8963C,#C8A84C)' }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-success flex items-center gap-2">
              <span>✓</span> Envío gratuito aplicado — gracias por tu compra
            </p>
          )}
        </div>
      </div>

      {/* Cart items */}
      <div className="px-4 flex flex-col gap-3 mb-5">
        {items.map(item => {
          const meta = DEFAULT_META
          return (
            <div
              key={item.productCode}
              className="p-4 "
              style={{ background: '#FDFCFA', boxShadow: '0 2px 16px rgba(44,44,40,0.06)' }}
            >
              <div className="flex gap-3.5 items-start mb-4">
                {/* Icon */}
                <div
                  className="w-14 h-14  flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: meta.gradient }}
                >
                  {meta.emoji}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="m-label mb-0.5">{item.productCode}</p>
                  <p className="font-serif text-[17px] text-charcoal leading-snug">{item.name}</p>
                  <p className="text-xs text-muted mt-0.5 tabular-nums">{item.unitPrice?.toFixed(2)}€ / unidad</p>
                </div>

                <button
                  onClick={() => removeItem(item.productCode)}
                  className="w-8 h-8 flex items-center justify-center text-muted/50 text-2xl leading-none flex-shrink-0 transition-all active:scale-90"
                >
                  ×
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div
                  className="flex items-center  overflow-hidden"
                  style={{ boxShadow: '0 1px 6px rgba(44,44,40,0.08)' }}
                >
                  <button
                    onClick={() => item.quantity > 1
                      ? updateItem(item.productCode, item.quantity - 1)
                      : removeItem(item.productCode)
                    }
                    className="w-10 h-10 bg-[#F2EFE9] flex items-center justify-center text-xl text-charcoal active:bg-sage-light/20 transition-colors"
                  >−</button>
                  <span className="w-10 text-center text-sm font-semibold bg-off-white">{item.quantity}</span>
                  <button
                    onClick={() => updateItem(item.productCode, item.quantity + 1)}
                    className="w-10 h-10 bg-[#F2EFE9] flex items-center justify-center text-xl text-charcoal active:bg-sage-light/20 transition-colors"
                  >+</button>
                </div>
                <p className="font-serif text-[22px] font-light text-charcoal tabular-nums">
                  {(item.unitPrice * item.quantity).toFixed(2)}€
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Benefits */}
      {benefits.length > 0 && (
        <div className="px-4 mb-5">
          <p className="m-label mb-3">Beneficios incluidos</p>
          <div className="flex flex-col gap-2">
            {benefits.map((b, i) => {
              const icons = { GIFT: '🎁', SAMPLE: '🧪', DISCOUNT: '🏷️' }
              return (
                <div key={i}
                  className="flex items-center gap-3.5 px-4 py-3.5 "
                  style={{ background: '#EEF4EA' }}
                >
                  <span className="text-2xl">{icons[b.benefit?.type] ?? '🎁'}</span>
                  <div>
                    <p className="text-sm font-medium text-sage-dark">{b.promoName}</p>
                    <p className="text-xs text-muted">{b.benefit?.description ?? ''}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Order summary */}
      <div
        className="mx-4 mb-5 p-5 "
        style={{ background: '#FDFCFA', boxShadow: '0 2px 16px rgba(44,44,40,0.06)' }}
      >
        <p className="m-label mb-4">Resumen</p>
        <div className="space-y-3 mb-4">
          <div className="flex justify-between text-sm text-charcoal">
            <span className="text-muted">Subtotal</span>
            <span className="tabular-nums">{subtotal.toFixed(2)}€</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Envío</span>
            <span className={shipping === 0 ? 'text-success font-medium' : 'text-charcoal tabular-nums'}>
              {shipping === 0 ? 'Gratis' : `${shipping.toFixed(2)}€`}
            </span>
          </div>
        </div>
        <div className="flex justify-between items-baseline pt-4"
          style={{ borderTop: '2px solid #2C2C28' }}>
          <span className="font-serif text-xl font-light text-charcoal">Total</span>
          <span className="font-serif text-3xl font-light text-charcoal tabular-nums">{total.toFixed(2)}€</span>
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 pb-8">
        {orderError && (
          <div className="mb-4 px-4 py-3 text-sm text-red-700 rounded-lg" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            {orderError}
          </div>
        )}
        <button
          onClick={handleConfirm}
          disabled={confirming || cartLoading}
          className="w-full py-4  text-base font-medium text-off-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg,#4A5740,#6B7B5E)',
            boxShadow: '0 6px 24px rgba(74,87,64,0.30)',
          }}
        >
          {confirming ? <><Spinner size="sm" />Confirmando…</> : 'Confirmar pedido'}
        </button>
        <button
          onClick={() => navigate('/catalog')}
          className="w-full mt-3 py-2 text-sm text-muted text-center"
        >
          Seguir comprando
        </button>
      </div>
    </div>
  )
}
