import { useNavigate } from 'react-router-dom'
import { useCartContext } from '../context/CartContext.jsx'

// Emoji por familia como placeholder de imagen
const FAMILY_EMOJI = {
  F01: '✨',
  F02: '🌿',
  F03: '💧',
}

export function ProductCard ({ product, familyName }) {
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
      className="bg-off-white border border-border rounded-xl overflow-hidden cursor-pointer transition-all hover:border-sage-light hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.07)] relative"
    >
      {/* Imagen */}
      <div className="h-[180px] bg-cream flex items-center justify-center text-5xl relative">
        {emoji}
        {!product.inStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="tag bg-muted/20 text-muted text-xs">Sin stock</span>
          </div>
        )}
        {product.inStock && product.stock < 20 && (
          <span className="absolute top-2.5 left-2.5 tag bg-[#F7F3E8] text-gold text-[10px]">
            Últimas unidades
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-[10px] tracking-widest uppercase text-sage mb-1">{familyName}</p>
        <h3 className="font-serif text-[17px] font-normal mb-1.5 leading-snug text-charcoal">
          {product.name}
        </h3>
        <p className="text-[11px] text-muted mb-3.5 line-clamp-2 leading-relaxed">
          {product.description}
        </p>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-medium text-charcoal">
              {product.price != null ? `${product.price.toFixed(2)}€` : '—'}
            </span>
            <span className="text-[11px] text-muted ml-1">{product.format}</span>
          </div>

          <button
            onClick={handleAdd}
            disabled={!product.inStock || loading}
            className="w-8 h-8 bg-sage-dark text-white border-0 rounded-lg flex items-center justify-center text-lg hover:bg-sage transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
