import { useNavigate } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync.js'
import { returnsApi } from '../api/index.js'
import { Spinner } from '../components/Spinner.jsx'

const STATUS_CONFIG = {
  PENDING:   { label: 'Recibida',       bg: 'bg-[#F7F3E8]', text: 'text-gold',        icon: '⏳' },
  REVIEWING: { label: 'En revisión',    bg: 'bg-[#E8EEF4]', text: 'text-[#3A5F8A]',  icon: '🔍' },
  APPROVED:  { label: 'Aprobada',       bg: 'bg-[#EEF4EA]', text: 'text-success',     icon: '✓' },
  REJECTED:  { label: 'Rechazada',      bg: 'bg-[#FDF0EE]', text: 'text-error',       icon: '✗' },
  RESOLVED:  { label: 'Resuelta',       bg: 'bg-[#EEF4EA]', text: 'text-success',     icon: '✓' },
}

const REASON_LABELS = {
  DAMAGED:   'Producto dañado',
  WRONG:     'Producto incorrecto',
  MISSING:   'Faltaban unidades',
  DUPLICATE: 'Pedido duplicado',
  OTHER:     'Otro motivo',
}

function StatusBadge ({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <span className={`tag ${cfg.bg} ${cfg.text} gap-1`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function ReturnCard ({ ret, onClick }) {
  return (
    <div
      onClick={onClick}
      className="card hover:border-sage-light cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-sm text-charcoal">{ret.id}</p>
          <p className="text-xs text-muted mt-0.5">
            Pedido {ret.orderId} · {new Date(ret.createdAt).toLocaleDateString('es-ES')}
          </p>
        </div>
        <StatusBadge status={ret.status} />
      </div>

      <p className="text-sm text-charcoal mb-1">
        <span className="text-muted">Motivo:</span> {REASON_LABELS[ret.reason] ?? ret.reason}
      </p>

      {ret.notes && (
        <p className="text-xs text-muted italic mb-3 line-clamp-1">"{ret.notes}"</p>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {ret.items?.map((item, i) => (
          <span key={i} className="tag bg-cream text-muted text-[10px]">
            {item.name} ×{item.quantity}
          </span>
        ))}
      </div>

      {ret.creditNoteId && (
        <p className="text-xs text-success mt-3">
          ✓ Nota de crédito {ret.creditNoteId} generada en SAP
        </p>
      )}

      {ret.adminNotes && ret.status === 'REJECTED' && (
        <p className="text-xs text-error mt-2">
          Motivo de rechazo: {ret.adminNotes}
        </p>
      )}
    </div>
  )
}

export function ReturnsPage () {
  const navigate = useNavigate()
  const { data: returns, loading } = useAsync(() => returnsApi.getMyReturns(), [])

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="page-title">Mis reclamaciones</h1>
          <p className="page-subtitle">Seguimiento de devoluciones y solicitudes</p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => navigate('/orders')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7-7 7 7"/>
          </svg>
          Nueva devolución
        </button>
      </div>

      {loading && <div className="flex justify-center py-24"><Spinner size="lg" /></div>}

      {!loading && returns?.length === 0 && (
        <div className="text-center py-24">
          <div className="w-20 h-20 bg-cream rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
            📋
          </div>
          <p className="font-serif text-2xl font-light text-charcoal mb-2">
            No tienes reclamaciones
          </p>
          <p className="text-muted text-sm mb-8">
            Puedes iniciar una devolución desde el historial de pedidos
          </p>
          <button className="btn-secondary" onClick={() => navigate('/orders')}>
            Ver mis pedidos
          </button>
        </div>
      )}

      {!loading && returns?.length > 0 && (
        <>
          {/* Resumen de estados */}
          <div className="grid grid-cols-5 gap-3 mb-8">
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
              const count = returns.filter(r => r.status === status).length
              return (
                <div key={status} className="card text-center py-3">
                  <p className="text-2xl mb-1">{cfg.icon}</p>
                  <p className="font-medium text-lg text-charcoal">{count}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted">{cfg.label}</p>
                </div>
              )
            })}
          </div>

          {/* Lista de reclamaciones */}
          <div className="grid grid-cols-2 gap-4">
            {returns.map(ret => (
              <ReturnCard
                key={ret.id}
                ret={ret}
                onClick={() => navigate(`/returns/${ret.id}`)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
