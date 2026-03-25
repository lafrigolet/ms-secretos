import { useNavigate } from 'react-router-dom'
import { useCartContext } from '../context/CartContext.jsx'

const FAMILY_EMOJI = {
  F01: '✨',
  F02: '🌿',
  F03: '💧',
}

export function ProductRow ({ product, familyName }) {
  const navigate = useNavigate()
  const { addItem, loading } = useCartContext()

  async function handleAdd (e) {
    e.stopPropagation()
    await addItem(product, 1)
  }

  const emoji = FAMILY_EMOJI[product.familyId] ?? '🧴'

  return (
    <div
      onClick={() => navigate(`/catalog/${product.sapCode}`)}
      className="bg-off-white border border-border rounded-lg flex items-center gap-4 px-4 py-2.5 cursor-pointer transition-all hover:border-sage-light hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
    >
      {/* Icono */}
      <div className="w-9 h-9 bg-cream rounded-md flex items-center justify-center text-lg flex-shrink-0 relative">
        {emoji}
        {!product.inStock && (
          <div className="absolute inset-0 bg-white/70 rounded-md" />
        )}
      </div>

      {/* Nombre + descripción */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="font-serif text-[14px] font-normal text-charcoal truncate">
            {product.name}
          </h3>
          <span className="text-[10px] tracking-widest uppercase text-sage flex-shrink-0">{familyName}</span>
        </div>
        <p className="text-[11px] text-muted truncate leading-tight">{product.description}</p>
      </div>

      {/* Badges */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {!product.inStock && (
          <span className="tag bg-muted/20 text-muted text-[10px]">Sin stock</span>
        )}
        {product.inStock && product.stock < 20 && (
          <span className="tag bg-[#F7F3E8] text-gold text-[10px]">Últimas unidades</span>
        )}
        <span className="text-[11px] text-muted">{product.format}</span>
      </div>

      {/* Precio */}
      <div className="flex-shrink-0 w-16 text-right">
        <span className="text-sm font-medium text-charcoal">
          {product.price != null ? `${product.price.toFixed(2)}€` : '—'}
        </span>
      </div>

      {/* Acción */}
      <button
        onClick={handleAdd}
        disabled={!product.inStock || loading}
        className="flex-shrink-0 w-7 h-7 bg-sage-dark text-white border-0 rounded-md flex items-center justify-center text-base hover:bg-sage transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        +
      </button>
    </div>
  )
}
