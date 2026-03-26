import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync.js'
import { catalogApi } from '../../api/index.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useCartContext } from '../../context/CartContext.jsx'
import { Spinner } from '../../components/Spinner.jsx'

const FAMILY_META = {
  F01: { emoji: '✨', gradient: 'linear-gradient(135deg,#E8D4A0,#F0E4CB)', tag: '#8C6E52' },
  F02: { emoji: '🌿', gradient: 'linear-gradient(135deg,#C8D4BE,#DFE9D9)', tag: '#4A7054' },
  F03: { emoji: '💧', gradient: 'linear-gradient(135deg,#B8CDD4,#D4E4EA)', tag: '#3A5F8A' },
}
const DEFAULT_META = { emoji: '🧴', gradient: 'linear-gradient(135deg,#E0D9D0,#EDE8E2)', tag: '#8A8880' }

function ProductCard ({ product, familyName }) {
  const navigate  = useNavigate()
  const { addItem, loading } = useCartContext()
  const meta = FAMILY_META[product.familyId] ?? DEFAULT_META

  async function handleAdd (e) {
    e.stopPropagation()
    await addItem(product, 1)
  }

  return (
    <div
      onClick={() => navigate(`/catalog/${product.sapCode}`)}
      className="flex items-center gap-3.5 p-4 active:scale-[0.98] transition-transform cursor-pointer"
      style={{
        background: '#FDFCFA',
        boxShadow: '0 2px 16px rgba(44,44,40,0.06), 0 1px 4px rgba(44,44,40,0.04)',
      }}
    >
      {/* Family gradient thumbnail */}
      <div
        className="w-14 h-14 flex items-center justify-center text-2xl  flex-shrink-0 relative overflow-hidden"
        style={{ background: meta.gradient }}
      >
        {meta.emoji}
        {!product.inStock && (
          <div className="absolute inset-0 bg-white/55 flex items-end justify-center pb-1">
            <span className="text-[8px] font-medium text-muted/80 leading-none">Agotado</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-serif text-[16px] text-charcoal leading-snug truncate">{product.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px]" style={{ color: meta.tag }}>{familyName}</span>
          {product.inStock && product.stock > 0 && product.stock < 20 && (
            <span className="text-[9px] bg-[#F7F3E8] text-gold px-1.5 py-0.5 ">
              Últimas {product.stock}
            </span>
          )}
        </div>
      </div>

      {/* Price + add */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="font-medium text-[15px] text-charcoal tabular-nums">
          {product.price != null ? `${product.price.toFixed(2)}€` : '—'}
        </span>
        <button
          onClick={handleAdd}
          disabled={!product.inStock || loading}
          className="w-9 h-9 flex items-center justify-center text-off-white text-xl font-light  disabled:opacity-35 transition-all active:scale-90"
          style={{
            background: 'linear-gradient(135deg,#4A5740,#6B7B5E)',
            boxShadow: product.inStock ? '0 3px 10px rgba(74,87,64,0.25)' : 'none',
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}

export function MobileCatalogPage () {
  const { isPremium, isVip } = useAuth()
  const [activeFamily, setActiveFamily] = useState(null)
  const [search, setSearch] = useState('')

  const { data: families } = useAsync(() => catalogApi.getFamilies(), [])
  const { data: products, loading } = useAsync(
    () => catalogApi.getProducts(activeFamily),
    [activeFamily]
  )

  const filtered = useMemo(() => {
    if (!products) return []
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    )
  }, [products, search])

  const familyName = (id) => families?.find(f => f.id === id)?.name ?? ''
  const showPromoBanner = isPremium || isVip

  return (
    <div>
      {/* Promo banner */}
      {showPromoBanner && (
        <div
          className="mx-4 mt-5  p-5 text-white overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg,#3D4A34 0%,#5C6B52 60%,#7A8A6A 100%)' }}
        >
          <div className="absolute -right-4 -top-6 w-28 h-28  opacity-15"
            style={{ background: 'radial-gradient(circle,#B8963C,transparent)' }} />
          <p className="text-[10px] tracking-[0.14em] uppercase text-white/60 mb-1.5">Promociones activas</p>
          <p className="font-serif text-[20px] font-light leading-tight">
            Ofertas exclusivas<br />para tu perfil
          </p>
          <p className="text-xs text-white/70 mt-2 leading-relaxed">
            ×6 Champú Restaurador → muestra gratis · Tester con pedidos +250€
          </p>
        </div>
      )}

      {/* Search */}
      <div className="px-4 mt-4">
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{
            background: '#FDFCFA',
            boxShadow: '0 2px 12px rgba(44,44,40,0.06)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0ADA7" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar productos…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-muted/60"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="text-muted/70 text-lg leading-none w-6 h-6 flex items-center justify-center">
              ×
            </button>
          )}
        </div>
      </div>

      {/* Family filter — horizontal scroll pills */}
      <div className="px-4 mt-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
          {/* "Todos" pill */}
          <button
            onClick={() => setActiveFamily(null)}
            className="flex items-center gap-1.5 px-4 py-2  text-sm transition-all"
            style={activeFamily === null
              ? { background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', color: '#FDFCFA', boxShadow: '0 3px 12px rgba(74,87,64,0.25)' }
              : { background: '#FDFCFA', color: '#8A8880', boxShadow: '0 1px 4px rgba(44,44,40,0.06)' }
            }
          >
            Todos
          </button>
          {families?.map(f => {
            const meta = FAMILY_META[f.id] ?? DEFAULT_META
            const isActive = activeFamily === f.id
            return (
              <button
                key={f.id}
                onClick={() => setActiveFamily(f.id)}
                className="flex items-center gap-1.5 px-4 py-2  text-sm transition-all"
                style={isActive
                  ? { background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', color: '#FDFCFA', boxShadow: '0 3px 12px rgba(74,87,64,0.25)' }
                  : { background: '#FDFCFA', color: '#8A8880', boxShadow: '0 1px 4px rgba(44,44,40,0.06)' }
                }
              >
                <span>{meta.emoji}</span>
                <span>{f.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Product list */}
      <div className="px-4 mt-5 pb-6">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div
              className="w-20 h-20  flex items-center justify-center text-4xl mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg,#E8D4A0,#F0E4CB)' }}
            >
              🔍
            </div>
            <p className="font-serif text-xl font-light text-charcoal mb-2">Sin resultados</p>
            <p className="text-sm text-muted mb-5">No hay productos que coincidan con tu búsqueda</p>
            <button
              className="text-sage-dark text-sm underline"
              onClick={() => { setSearch(''); setActiveFamily(null) }}
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="m-label">{filtered.length} productos</p>
            {filtered.map(p => (
              <ProductCard key={p.sapCode} product={p} familyName={familyName(p.familyId)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
