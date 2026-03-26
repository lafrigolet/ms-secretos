import { useNavigate } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync.js'
import { returnsApi } from '../../api/index.js'
import { Spinner } from '../../components/Spinner.jsx'

const STATUS_CONFIG = {
  PENDING:   { label: 'Recibida',    icon: '⏳', dot: '#B8963C', bg: 'rgba(184,150,60,0.10)',  text: '#8C6E52' },
  REVIEWING: { label: 'En revisión', icon: '🔍', dot: '#3A5F8A', bg: 'rgba(58,95,138,0.10)',   text: '#3A5F8A' },
  APPROVED:  { label: 'Aprobada',   icon: '✓',  dot: '#4A7054', bg: 'rgba(74,112,84,0.10)',   text: '#4A7054' },
  REJECTED:  { label: 'Rechazada',  icon: '✗',  dot: '#8B3A2F', bg: 'rgba(139,58,47,0.10)',   text: '#8B3A2F' },
  RESOLVED:  { label: 'Resuelta',   icon: '✓',  dot: '#4A7054', bg: 'rgba(74,112,84,0.10)',   text: '#4A7054' },
}

const REASON_LABELS = {
  DAMAGED:   'Producto dañado',
  WRONG:     'Producto incorrecto',
  MISSING:   'Faltaban unidades',
  DUPLICATE: 'Pedido duplicado',
  OTHER:     'Otro motivo',
}

function ReturnCard ({ ret }) {
  const cfg = STATUS_CONFIG[ret.status] ?? STATUS_CONFIG.PENDING

  return (
    <div
      className="p-4 "
      style={{ background: '#FDFCFA', boxShadow: '0 2px 16px rgba(44,44,40,0.06)' }}
    >
      <div className="flex items-start justify-between mb-2.5">
        <div>
          <p className="font-medium text-sm text-charcoal">{ret.id}</p>
          <p className="text-xs text-muted mt-0.5">
            Pedido {ret.orderId} · {new Date(ret.createdAt).toLocaleDateString('es-ES')}
          </p>
        </div>
        <span
          className="text-[11px] font-medium px-2.5 py-1  flex items-center gap-1.5"
          style={{ background: cfg.bg, color: cfg.text }}
        >
          <span className="w-1.5 h-1.5 " style={{ background: cfg.dot }} />
          {cfg.label}
        </span>
      </div>

      <p className="text-sm text-charcoal mb-2">
        <span className="text-muted">Motivo: </span>
        {REASON_LABELS[ret.reason] ?? ret.reason}
      </p>

      {ret.notes && (
        <p className="text-xs text-muted italic mb-3 leading-relaxed line-clamp-2">"{ret.notes}"</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {ret.items?.map((item, i) => (
          <span key={i}
            className="text-[10px] px-2.5 py-1 "
            style={{ background: '#F2EFE9', color: '#8A8880' }}
          >
            {item.name} ×{item.quantity}
          </span>
        ))}
      </div>

      {ret.creditNoteId && (
        <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: '#4A7054' }}>
          <span>✓</span> Nota de crédito {ret.creditNoteId}
        </p>
      )}

      {ret.status === 'REJECTED' && ret.adminNotes && (
        <p className="text-xs text-error mt-2">Rechazo: {ret.adminNotes}</p>
      )}
    </div>
  )
}

export function MobileReturnsPage () {
  const navigate = useNavigate()
  const { data: returns, loading } = useAsync(() => returnsApi.getMyReturns(), [])

  return (
    <div className="px-4 pt-5 pb-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-[34px] font-light text-charcoal leading-none mb-1">
            Reclamaciones
          </h1>
          <p className="text-sm text-muted">Seguimiento de tus devoluciones</p>
        </div>
        <button
          className="py-3 px-4  text-sm font-medium text-off-white flex-shrink-0 active:scale-[0.97] transition-all"
          style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', boxShadow: '0 3px 12px rgba(74,87,64,0.25)' }}
          onClick={() => navigate('/orders')}
        >
          + Nueva
        </button>
      </div>

      {loading && <div className="flex justify-center py-16"><Spinner size="lg" /></div>}

      {!loading && returns?.length === 0 && (
        <div className="flex flex-col items-center text-center py-16">
          <div
            className="w-24 h-24  flex items-center justify-center text-5xl mb-5"
            style={{ background: 'linear-gradient(135deg,#C8D4BE,#DFE9D9)' }}
          >
            📋
          </div>
          <p className="font-serif text-2xl font-light text-charcoal mb-2">Sin reclamaciones</p>
          <p className="text-sm text-muted mb-7">Puedes iniciar una devolución desde el historial de pedidos</p>
          <button
            className="py-4 px-6  text-sm font-medium border border-border text-charcoal active:scale-[0.97] transition-all bg-off-white"
            style={{ boxShadow: '0 1px 8px rgba(44,44,40,0.08)' }}
            onClick={() => navigate('/orders')}
          >
            Ver mis pedidos
          </button>
        </div>
      )}

      {!loading && returns?.length > 0 && (
        <>
          {/* Status summary chips — horizontal scroll */}
          <div className="overflow-x-auto scrollbar-none mb-5 -mx-1">
            <div className="flex gap-2 px-1 pb-1" style={{ minWidth: 'max-content' }}>
              {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
                const count = returns.filter(r => r.status === status).length
                if (count === 0) return null
                return (
                  <div
                    key={status}
                    className=" px-4 py-3 text-center min-w-[76px]"
                    style={{ background: '#FDFCFA', boxShadow: '0 2px 10px rgba(44,44,40,0.06)' }}
                  >
                    <p className="text-xl mb-0.5">{cfg.icon}</p>
                    <p className="font-serif text-2xl font-light" style={{ color: cfg.text }}>{count}</p>
                    <p className="text-[9px] tracking-wide text-muted">{cfg.label}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {returns.map(ret => <ReturnCard key={ret.id} ret={ret} />)}
          </div>
        </>
      )}
    </div>
  )
}
