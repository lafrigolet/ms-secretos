import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync.js'
import { catalogApi } from '../api/index.js'
import { useCartContext } from '../context/CartContext.jsx'
import { Spinner } from '../components/Spinner.jsx'

const FAMILY_EMOJI  = { F01: '✨', F02: '🌿', F03: '💧' }
const FAMILY_NAMES  = { F01: 'Ritual Timeless', F02: 'Sensitivo', F03: 'Brillo & Nutrición' }

export function ProductPage () {
  const { sapCode } = useParams()
  const navigate    = useNavigate()
  const { addItem, cart } = useCartContext()
  const [qty, setQty]     = useState(1)
  const [added, setAdded] = useState(false)

  // HU-08 — ficha de producto
  const { data: product, loading, error } = useAsync(
    () => catalogApi.getProduct(sapCode),
    [sapCode]
  )

  // HU-09 — recomendaciones basadas en la cesta actual
  const cartCodes = cart.items?.map(i => i.productCode) ?? []
  const { data: recommendations } = useAsync(
    () => catalogApi.getRecommendations([...cartCodes, sapCode]),
    [sapCode, cartCodes.join(',')]
  )

  async function handleAddToCart () {
    if (!product) return
    await addItem(product, qty)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  if (loading) return (
    <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  )

  if (error || !product) return (
    <div className="text-center py-24">
      <p className="text-muted mb-4">Producto no encontrado</p>
      <button className="btn-secondary" onClick={() => navigate('/catalog')}>
        Volver al catálogo
      </button>
    </div>
  )

  const emoji      = FAMILY_EMOJI[product.familyId] ?? '🧴'
  const familyName = FAMILY_NAMES[product.familyId] ?? ''

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted mb-8">
        <button className="hover:text-sage-dark transition-colors" onClick={() => navigate('/catalog')}>
          Catálogo
        </button>
        <span>›</span>
        <span>{familyName}</span>
        <span>›</span>
        <span className="text-charcoal">{product.name}</span>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-2 gap-16 items-start">

        {/* Imagen */}
        <div className="bg-off-white border border-border rounded-2xl h-[460px] flex items-center justify-center text-[100px] sticky top-20">
          {emoji}
        </div>

        {/* Detalle */}
        <div>
          <p className="text-[11px] tracking-[0.12em] uppercase text-sage mb-2">{familyName}</p>

          <h1 className="font-serif text-[42px] font-light leading-[1.15] text-charcoal mb-2">
            {product.name}
          </h1>

          <p className="font-serif italic text-muted text-lg mb-5">{product.format}</p>

          {/* Precio */}
          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-[32px] font-medium text-charcoal">
              {product.price != null ? `${product.price.toFixed(2)}€` : '—'}
            </span>
            {product.inStock ? (
              <span className="tag bg-[#EEF4EA] text-success text-xs">En stock · {product.stock} uds</span>
            ) : (
              <span className="tag bg-muted/10 text-muted text-xs">Sin stock</span>
            )}
          </div>

          {/* Descripción */}
          <p className="text-muted text-sm leading-[1.8] mb-7">{product.description}</p>

          {/* Atributos */}
          <div className="grid grid-cols-2 gap-3 mb-7">
            <div className="bg-cream rounded-lg px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-widest text-muted mb-0.5">Formato</p>
              <p className="text-sm font-medium text-charcoal">{product.format}</p>
            </div>
            <div className="bg-cream rounded-lg px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-widest text-muted mb-0.5">Referencia</p>
              <p className="text-sm font-medium text-charcoal">{product.sapCode}</p>
            </div>
            <div className="bg-cream rounded-lg px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-widest text-muted mb-0.5">Familia</p>
              <p className="text-sm font-medium text-charcoal">{familyName}</p>
            </div>
            <div className="bg-cream rounded-lg px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-widest text-muted mb-0.5">Stock</p>
              <p className="text-sm font-medium text-charcoal">{product.stock ?? 0} unidades</p>
            </div>
          </div>

          {/* Cantidad + añadir */}
          {product.inStock && (
            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-10 h-10 bg-cream border-0 cursor-pointer text-lg text-charcoal flex items-center justify-center hover:bg-sage-light/30 transition-colors"
                >−</button>
                <span className="w-12 text-center text-base font-medium bg-off-white">{qty}</span>
                <button
                  onClick={() => setQty(q => q + 1)}
                  className="w-10 h-10 bg-cream border-0 cursor-pointer text-lg text-charcoal flex items-center justify-center hover:bg-sage-light/30 transition-colors"
                >+</button>
              </div>

              <button
                onClick={handleAddToCart}
                className={`btn-primary flex-1 flex items-center justify-center gap-2 transition-all ${added ? 'bg-success' : ''}`}
              >
                {added ? (
                  <>✓ Añadido a la cesta</>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                      <line x1="3" y1="6" x2="21" y2="6"/>
                      <path d="M16 10a4 4 0 01-8 0"/>
                    </svg>
                    Añadir a la cesta
                  </>
                )}
              </button>
            </div>
          )}

          <button
            onClick={() => navigate('/catalog')}
            className="btn-ghost text-sm"
          >
            ← Volver al catálogo
          </button>

          {/* HU-09 — Productos recomendados */}
          {recommendations?.length > 0 && (
            <div className="mt-12">
              <p className="section-label">Completa el tratamiento</p>
              <div className="grid grid-cols-3 gap-3">
                {recommendations.map(rec => (
                  <div
                    key={rec.sapCode}
                    onClick={() => navigate(`/catalog/${rec.sapCode}`)}
                    className="bg-off-white border border-border rounded-xl p-3.5 cursor-pointer hover:border-sage-light transition-colors flex gap-3 items-center"
                  >
                    <div className="w-13 h-13 bg-cream rounded-lg flex items-center justify-center text-2xl flex-shrink-0 w-[52px] h-[52px]">
                      {FAMILY_EMOJI[rec.familyId] ?? '🧴'}
                    </div>
                    <div>
                      <p className="font-serif text-sm leading-tight mb-0.5">{rec.name}</p>
                      <p className="text-sm font-medium text-sage-dark">
                        {rec.price != null ? `${rec.price.toFixed(2)}€` : '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
