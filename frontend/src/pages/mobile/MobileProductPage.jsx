import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync.js'
import { catalogApi } from '../../api/index.js'
import { useCartContext } from '../../context/CartContext.jsx'
import { Spinner } from '../../components/Spinner.jsx'

const FAMILY_META = {
  F01: {
    emoji: '✨', name: 'Ritual Timeless',
    gradient: 'linear-gradient(160deg,#E8D4A0 0%,#F0E4CB 50%,#F7F0E2 100%)',
    tag: '#8C6E52',
  },
  F02: {
    emoji: '🌿', name: 'Sensitivo',
    gradient: 'linear-gradient(160deg,#C8D4BE 0%,#DFE9D9 50%,#EBF2E7 100%)',
    tag: '#4A7054',
  },
  F03: {
    emoji: '💧', name: 'Brillo & Nutrición',
    gradient: 'linear-gradient(160deg,#B8CDD4 0%,#D4E4EA 50%,#E8F2F6 100%)',
    tag: '#3A5F8A',
  },
}
const DEFAULT_META = {
  emoji: '🧴', name: 'General',
  gradient: 'linear-gradient(160deg,#E0D9D0,#EDE8E2)',
  tag: '#8A8880',
}

export function MobileProductPage () {
  const { sapCode } = useParams()
  const navigate    = useNavigate()
  const { addItem, cart } = useCartContext()
  const [qty, setQty]     = useState(1)
  const [added, setAdded] = useState(false)

  const { data: product, loading } = useAsync(
    () => catalogApi.getProduct(sapCode),
    [sapCode]
  )

  const cartCodes = cart.items?.map(i => i.productCode) ?? []
  const { data: recommendations } = useAsync(
    () => catalogApi.getRecommendations([...cartCodes, sapCode]),
    [sapCode, cartCodes.join(',')]
  )

  async function handleAddToCart () {
    if (!product) return
    await addItem(product, qty)
    setAdded(true)
    setTimeout(() => setAdded(false), 2200)
  }

  if (loading) return (
    <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  )

  if (!product) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-20 h-20 bg-cream  flex items-center justify-center text-4xl mb-5">🔍</div>
      <p className="font-serif text-xl font-light text-charcoal mb-2">Producto no encontrado</p>
      <button
        className="mt-4 text-sage-dark text-sm underline"
        onClick={() => navigate('/catalog')}
      >
        Volver al catálogo
      </button>
    </div>
  )

  const meta = FAMILY_META[product.familyId] ?? DEFAULT_META

  return (
    <div>
      {/* Hero gradient area */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ height: '260px', background: meta.gradient }}
      >
        {/* Organic blob */}
        <div className="absolute inset-0 flex items-center justify-center opacity-30">
          <div className="w-60 h-60 "
            style={{ background: 'radial-gradient(circle,rgba(255,255,255,0.7),transparent 70%)' }} />
        </div>
        <span className="text-[100px] relative z-10 select-none" style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.10))' }}>
          {meta.emoji}
        </span>

        {/* Stock badge overlay */}
        {!product.inStock && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-charcoal/70 text-white text-xs px-4 py-1.5  backdrop-blur-sm">
            Sin stock
          </div>
        )}
      </div>

      {/* Content card — overlaps hero */}
      <div
        className="relative -mt-6 mx-2 bg-[#FDFCFA] pb-28"
        style={{ boxShadow: '0 -4px 32px rgba(44,44,40,0.10)' }}
      >
        <div className="px-6 pt-6">
          {/* Family tag */}
          <span
            className="inline-block text-[10px] tracking-[0.14em] uppercase font-medium px-3 py-1.5  mb-4"
            style={{ background: `${meta.tag}15`, color: meta.tag }}
          >
            {meta.name}
          </span>

          {/* Name + price */}
          <h1 className="font-serif text-[30px] font-light leading-tight text-charcoal mb-1">
            {product.name}
          </h1>
          <p className="font-serif italic text-muted text-base mb-5">{product.format}</p>

          <div className="flex items-center justify-between mb-6">
            <span className="font-serif text-[38px] font-light text-charcoal tabular-nums">
              {product.price != null ? `${product.price.toFixed(2)}€` : '—'}
            </span>
            {product.inStock ? (
              <span
                className="text-xs px-3 py-1.5 "
                style={{ background: 'rgba(74,112,84,0.1)', color: '#4A7054' }}
              >
                ✓ En stock · {product.stock} uds
              </span>
            ) : (
              <span className="text-xs bg-cream text-muted px-3 py-1.5 ">Sin stock</span>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-muted leading-relaxed mb-7">{product.description}</p>

          {/* Attribute grid */}
          <p className="m-label mb-3">Detalles</p>
          <div className="grid grid-cols-2 gap-2 mb-8">
            {[
              { label: 'Formato', value: product.format },
              { label: 'Referencia', value: product.sapCode },
              { label: 'Colección', value: meta.name },
              { label: 'Stock', value: `${product.stock ?? 0} unidades` },
            ].map(attr => (
              <div key={attr.label}
                className=" px-4 py-3.5"
                style={{ background: '#F2EFE9' }}
              >
                <p className="m-label mb-1">{attr.label}</p>
                <p className="text-sm font-medium text-charcoal">{attr.value}</p>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {recommendations?.length > 0 && (
            <div className="mb-6">
              <p className="m-label mb-3">Completa el ritual</p>
              <div className="flex flex-col gap-2.5">
                {recommendations.map(rec => {
                  const rm = FAMILY_META[rec.familyId] ?? DEFAULT_META
                  return (
                    <div
                      key={rec.sapCode}
                      onClick={() => navigate(`/catalog/${rec.sapCode}`)}
                      className="flex gap-3.5 items-center p-3.5  active:scale-[0.98] transition-transform cursor-pointer"
                      style={{ boxShadow: '0 2px 12px rgba(44,44,40,0.06)' }}
                    >
                      <div
                        className="w-13 h-13 w-12 h-12  flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: rm.gradient, minWidth: '48px' }}
                      >
                        {rm.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-sm text-charcoal truncate">{rec.name}</p>
                        <p className="text-sm font-medium tabular-nums" style={{ color: rm.tag }}>
                          {rec.price != null ? `${rec.price.toFixed(2)}€` : '—'}
                        </p>
                      </div>
                      <span className="text-muted text-xl">›</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom bar — add to cart */}
      {product.inStock && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 px-4"
          style={{
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            background: 'rgba(253,252,250,0.94)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 -1px 0 rgba(226,221,214,0.6), 0 -4px 20px rgba(44,44,40,0.07)',
          }}
        >
          <div className="flex gap-3 items-center pt-3">
            {/* Qty stepper */}
            <div
              className="flex items-center  overflow-hidden"
              style={{ boxShadow: '0 1px 8px rgba(44,44,40,0.10)' }}
            >
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-11 h-11 bg-cream flex items-center justify-center text-xl text-charcoal active:bg-sage-light/20 transition-colors"
              >−</button>
              <span className="w-10 text-center text-sm font-semibold bg-off-white">{qty}</span>
              <button
                onClick={() => setQty(q => q + 1)}
                className="w-11 h-11 bg-cream flex items-center justify-center text-xl text-charcoal active:bg-sage-light/20 transition-colors"
              >+</button>
            </div>

            <button
              onClick={handleAddToCart}
              className="flex-1 h-11  text-sm font-medium transition-all active:scale-[0.97]"
              style={added
                ? { background: '#4A7054', color: '#FDFCFA', boxShadow: '0 4px 16px rgba(74,112,84,0.28)' }
                : { background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', color: '#FDFCFA', boxShadow: '0 4px 16px rgba(74,87,64,0.28)' }
              }
            >
              {added ? '✓ Añadido' : 'Añadir a la cesta'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
