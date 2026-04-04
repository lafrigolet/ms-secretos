import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync.js'
import { ordersApi, invoicesApi } from '../../api/index.js'
import { useCartContext } from '../../context/CartContext.jsx'
import { Spinner } from '../../components/Spinner.jsx'

const STATUS_CONFIG = {
  CONFIRMED: { label: 'Confirmado', dot: '#B8963C',  bg: 'rgba(184,150,60,0.10)',  text: '#8C6E52' },
  PREPARING: { label: 'Preparando', dot: '#3A5F8A',  bg: 'rgba(58,95,138,0.10)',   text: '#3A5F8A' },
  SHIPPED:   { label: 'En tránsito',dot: '#3A5F8A',  bg: 'rgba(58,95,138,0.10)',   text: '#3A5F8A' },
  DELIVERED: { label: 'Entregado',  dot: '#4A7054',  bg: 'rgba(74,112,84,0.10)',   text: '#4A7054' },
  CANCELLED: { label: 'Cancelado',  dot: '#8B3A2F',  bg: 'rgba(139,58,47,0.10)',   text: '#8B3A2F' },
  PENDING:   { label: 'Pendiente',  dot: '#B8963C',  bg: 'rgba(184,150,60,0.10)',  text: '#8C6E52' },
}

function StatusBadge ({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <span
      className="text-[11px] font-medium px-2.5 py-1  flex items-center gap-1.5"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      <span className="w-1.5 h-1.5  flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

function OrderCard ({ order, invoice, onRepeat, onDownload, onReturn }) {
  return (
    <div
      className="p-4 "
      style={{ background: '#FDFCFA', boxShadow: '0 2px 16px rgba(44,44,40,0.06)' }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-sm text-charcoal">{order.orderId}</p>
          <p className="text-xs text-muted mt-0.5">
            {order.date
              ? new Date(order.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—'}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Items preview */}
      <div className="mb-3.5">
        {order.items?.slice(0, 2).map((item, i) => (
          <p key={i} className="text-xs text-muted leading-relaxed">
            {item.name} <span className="text-muted/60">×{item.quantity}</span>
          </p>
        ))}
        {order.items?.length > 2 && (
          <p className="text-xs text-muted/60">+{order.items.length - 2} más</p>
        )}
      </div>

      {/* Total + actions */}
      <div
        className="flex items-center justify-between pt-3.5"
        style={{ borderTop: '1px solid rgba(226,221,214,0.7)' }}
      >
        <span className="font-serif text-[22px] font-light text-charcoal tabular-nums">
          {order.total?.toFixed(2)}€
        </span>
        <div className="flex gap-2">
          {[
            { show: true,                         label: '↻', title: 'Repetir', action: () => onRepeat(order) },
            { show: !!invoice,                    label: '↓', title: 'Factura', action: () => onDownload(invoice.invoiceId) },
            { show: order.status === 'DELIVERED', label: '↩', title: 'Devolver', action: () => onReturn(order) },
          ].filter(a => a.show).map((a, i) => (
            <button
              key={i}
              onClick={a.action}
              title={a.title}
              className="w-9 h-9  bg-[#F2EFE9] flex items-center justify-center text-base text-muted transition-all active:scale-90"
              style={{ boxShadow: '0 1px 4px rgba(44,44,40,0.08)' }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function RepeatCartSheet ({ order, onAdd, onReplace, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onCancel}>
      <div className="flex-1 bg-charcoal/50 backdrop-blur-sm" />
      <div
        className="bg-[#FDFCFA] rounded-t-3xl px-5 pb-10 pt-4"
        style={{ boxShadow: '0 -4px 32px rgba(44,44,40,0.12)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        <p className="font-serif text-xl font-light text-charcoal mb-1">Tu cesta tiene artículos</p>
        <p className="text-sm text-muted mb-6">
          ¿Qué deseas hacer con los artículos del pedido <span className="font-medium text-charcoal">{order.orderId}</span>?
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onAdd}
            className="w-full py-4 text-sm font-medium text-off-white transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', boxShadow: '0 4px 16px rgba(74,87,64,0.28)' }}
          >
            Añadir a la cesta
          </button>
          <button
            onClick={onReplace}
            className="w-full py-4 text-sm font-medium text-charcoal bg-cream active:scale-[0.98] transition-all"
            style={{ boxShadow: '0 1px 8px rgba(44,44,40,0.08)' }}
          >
            Reemplazar la cesta
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 text-sm text-muted text-center"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export function MobileOrdersPage () {
  const navigate = useNavigate()
  const { cart, addItem, clearCart } = useCartContext()
  const [repeatSheet, setRepeatSheet] = useState(null) // { order, items }

  const { data: orders, loading, error } = useAsync(() => ordersApi.getOrders(), [])
  const { data: invoices } = useAsync(() => invoicesApi.getInvoices(), [])

  async function handleRepeat (order) {
    try {
      const result = await ordersApi.repeatOrder(order.orderId)
      if (cart.items.length > 0) {
        setRepeatSheet({ order, items: result.items })
      } else {
        await loadRepeatItems(result.items)
      }
    } catch {
      alert('No se pudo cargar el pedido en la cesta.')
    }
  }

  async function loadRepeatItems (items, replace = false) {
    setRepeatSheet(null)
    try {
      if (replace) await clearCart()
      for (const item of items) {
        await addItem(
          { sapCode: item.productCode, name: item.name, price: item.unitPrice },
          item.quantity
        )
      }
      navigate('/cart')
    } catch {
      alert('No se pudo cargar el pedido en la cesta.')
    }
  }

  async function handleDownload (invoiceId) {
    try {
      const data = await invoicesApi.download(invoiceId)
      alert(`Descarga disponible en: ${data.downloadUrl}`)
    } catch {
      alert('No se pudo descargar la factura.')
    }
  }

  const invoiceMap = (invoices ?? []).reduce((acc, inv) => {
    acc[inv.orderId] = inv
    return acc
  }, {})

  return (
    <div className="px-4 pt-5 pb-6">
      {/* Repeat cart sheet */}
      {repeatSheet && (
        <RepeatCartSheet
          order={repeatSheet.order}
          onAdd={() => loadRepeatItems(repeatSheet.items, false)}
          onReplace={() => loadRepeatItems(repeatSheet.items, true)}
          onCancel={() => setRepeatSheet(null)}
        />
      )}

      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-serif text-[34px] font-light text-charcoal leading-none mb-1">Mis pedidos</h1>
        <p className="text-sm text-muted">Historial completo · Estado en tiempo real</p>
      </div>

      {loading && <div className="flex justify-center py-16"><Spinner size="lg" /></div>}
      {error   && <p className="text-center py-16 text-muted text-sm">No se pudieron cargar los pedidos.</p>}

      {!loading && !error && orders?.length === 0 && (
        <div className="flex flex-col items-center text-center py-16">
          <div
            className="w-24 h-24  flex items-center justify-center text-5xl mb-5"
            style={{ background: 'linear-gradient(135deg,#C8D4BE,#DFE9D9)' }}
          >
            📦
          </div>
          <p className="font-serif text-2xl font-light text-charcoal mb-2">Sin pedidos</p>
          <p className="text-sm text-muted mb-7">Tu historial aparecerá aquí cuando realices tu primer pedido</p>
          <button
            className="py-4 px-8  text-sm font-medium text-off-white active:scale-[0.97] transition-all"
            style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', boxShadow: '0 4px 16px rgba(74,87,64,0.28)' }}
            onClick={() => navigate('/catalog')}
          >
            Explorar el catálogo
          </button>
        </div>
      )}

      {!loading && orders?.length > 0 && (
        <div className="flex flex-col gap-3">
          {orders.map(order => (
            <OrderCard
              key={order.orderId}
              order={order}
              invoice={invoiceMap[order.orderId]}
              onRepeat={handleRepeat}
              onDownload={handleDownload}
              onReturn={(o) => navigate('/returns/new', { state: { orderId: o.orderId } })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
