import { useState, useMemo } from 'react'
import { useAsync } from '../hooks/useAsync.js'
import { catalogApi } from '../api/index.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ProductRow } from '../components/ProductRow.jsx'
import { Spinner } from '../components/Spinner.jsx'

const FAMILY_EMOJI = { F01: '✨', F02: '🌿', F03: '💧' }

export function CatalogPage () {
  const { isPremium, isVip, user } = useAuth()
  const [activeFamily, setActiveFamily] = useState(null)
  const [search, setSearch] = useState('')

  // HU-07 — familias
  const { data: families } = useAsync(() => catalogApi.getFamilies(), [])

  // HU-07, HU-08 — productos con precio y stock del perfil del cliente
  const { data: products, loading } = useAsync(
    () => catalogApi.getProducts(activeFamily),
    [activeFamily]
  )

  // Filtro local por búsqueda
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
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="page-title">Catálogo</h1>
          <p className="page-subtitle">
            Productos exclusivos · Precios para perfil {user?.profile}
          </p>
        </div>
      </div>

      {/* HU-10 — Banner de promoción para PREMIUM/VIP */}
      {showPromoBanner && (
        <div className="rounded-xl p-5 px-7 text-white flex items-center justify-between mb-8"
          style={{ background: 'linear-gradient(135deg, #4A5740, #6B7B5E)' }}>
          <div>
            <h3 className="font-serif text-[22px] font-light mb-1">
              Promociones activas para tu perfil
            </h3>
            <p className="text-sm opacity-85">
              Compra ×6 Champú Restaurador y recibe una muestra gratis · Tester con pedidos +250€
            </p>
          </div>
          <button className="bg-white/20 border border-white/40 text-white text-sm px-4 py-2 rounded-lg hover:bg-white/30 transition-colors whitespace-nowrap ml-6">
            Ver promociones
          </button>
        </div>
      )}

      {/* HU-07 — Tabs de familias + Búsqueda en la misma línea */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setActiveFamily(null)}
            className={`px-5 py-2.5 rounded-full border text-sm transition-all ${
              activeFamily === null
                ? 'bg-sage-dark text-off-white border-sage-dark'
                : 'bg-off-white text-muted border-border hover:border-sage hover:text-sage-dark'
            }`}
          >
            Todos
          </button>
          {families?.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFamily(f.id)}
              className={`px-5 py-2.5 rounded-full border text-sm transition-all flex items-center gap-2 ${
                activeFamily === f.id
                  ? 'bg-sage-dark text-off-white border-sage-dark'
                  : 'bg-off-white text-muted border-border hover:border-sage hover:text-sage-dark'
              }`}
            >
              <span>{FAMILY_EMOJI[f.id]}</span>
              {f.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 bg-off-white border border-border rounded-xl px-4 py-2.5 flex-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8880" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar productos…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-muted"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted hover:text-charcoal text-lg leading-none">×</button>
          )}
        </div>
      </div>

      {/* Grid de productos */}
      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-muted">
          <p className="text-lg mb-2">No se encontraron productos</p>
          <button className="btn-ghost" onClick={() => { setSearch(''); setActiveFamily(null) }}>
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map(p => (
            <ProductRow
              key={p.sapCode}
              product={p}
              familyName={familyName(p.familyId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
