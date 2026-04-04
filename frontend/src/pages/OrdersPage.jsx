import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync.js'
import { ordersApi, invoicesApi } from '../api/index.js'
import { useCartContext } from '../context/CartContext.jsx'
import { Spinner } from '../components/Spinner.jsx'

const STATUS_CONFIG = {
  CONFIRMED:  { label: 'Confirmado',   bg: 'bg-[#F7F3E8]',  text: 'text-gold' },
  PREPARING:  { label: 'En preparación', bg: 'bg-[#E8EEF4]', text: 'text-[#3A5F8A]' },
  SHIPPED:    { label: 'En tránsito',  bg: 'bg-[#E8EEF4]',  text: 'text-[#3A5F8A]' },
  DELIVERED:  { label: 'Entregado',    bg: 'bg-[#EEF4EA]',  text: 'text-success' },
  CANCELLED:  { label: 'Cancelado',    bg: 'bg-[#FDF0EE]',  text: 'text-error' },
  PENDING:    { label: 'Pendiente',    bg: 'bg-[#F7F3E8]',  text: 'text-gold' },
}

function StatusBadge ({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <span className={`tag ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
  )
}

function IconBtn ({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 rounded-md border border-border bg-off-white cursor-pointer flex items-center justify-center text-sm text-muted hover:border-sage hover:text-sage-dark transition-colors"
    >
      {children}
    </button>
  )
}

function RepeatCartModal ({ order, onAdd, onReplace, onCancel }) {
  return (
    <div className="fixed inset-0 bg-charcoal/60 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-off-white rounded-2xl p-8 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="font-serif text-xl font-light text-charcoal mb-2">Tu cesta tiene artículos</h2>
        <p className="text-sm text-muted mb-6">
          ¿Qué deseas hacer con los artículos del pedido <span className="font-medium text-charcoal">{order.orderId}</span>?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onAdd}
            className="btn-primary w-full"
          >
            Añadir a la cesta
          </button>
          <button
            onClick={onReplace}
            className="btn-secondary w-full"
          >
            Reemplazar la cesta
          </button>
          <button
            onClick={onCancel}
            className="btn-ghost w-full text-sm text-muted"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export function OrdersPage () {
  const navigate = useNavigate()
  const { cart, addItem, clearCart } = useCartContext()
  const [repeatModal, setRepeatModal] = useState(null) // { order, items }

  // HU-18 — historial de pedidos
  const { data: orders, loading, error } = useAsync(() => ordersApi.getOrders(), [])

  // HU-20 — facturas
  const { data: invoices } = useAsync(() => invoicesApi.getInvoices(), [])

  // HU-19 — repetir pedido: carga items en la cesta
  async function handleRepeat (order) {
    try {
      const result = await ordersApi.repeatOrder(order.orderId)
      if (cart.items.length > 0) {
        setRepeatModal({ order, items: result.items })
      } else {
        await loadRepeatItems(result.items)
      }
    } catch {
      alert('No se pudo cargar el pedido en la cesta.')
    }
  }

  async function loadRepeatItems (items, replace = false) {
    setRepeatModal(null)
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

  // Descarga de factura
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
    <div>
      {/* Repeat cart modal */}
      {repeatModal && (
        <RepeatCartModal
          order={repeatModal.order}
          onAdd={() => loadRepeatItems(repeatModal.items, false)}
          onReplace={() => loadRepeatItems(repeatModal.items, true)}
          onCancel={() => setRepeatModal(null)}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title">Mis pedidos</h1>
        <p className="page-subtitle">Historial completo · Estado en tiempo real</p>
      </div>

      {loading && (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      )}

      {error && (
        <div className="text-center py-24 text-muted">
          <p>No se pudieron cargar los pedidos.</p>
        </div>
      )}

      {!loading && !error && orders?.length === 0 && (
        <div className="text-center py-24">
          <div className="w-20 h-20 bg-cream rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
            📦
          </div>
          <p className="font-serif text-2xl font-light text-charcoal mb-2">
            Aún no tienes pedidos
          </p>
          <p className="text-muted text-sm mb-8">
            Cuando realices tu primer pedido aparecerá aquí
          </p>
          <button className="btn-primary" onClick={() => navigate('/catalog')}>
            Ir al catálogo
          </button>
        </div>
      )}

      {!loading && orders?.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Pedido', 'Fecha', 'Productos', 'Estado', 'Importe', ''].map(h => (
                  <th key={h} className="text-left text-[10px] tracking-widest uppercase text-muted px-4 py-3 border-b border-border font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const invoice = invoiceMap[order.orderId]
                return (
                  <tr key={order.orderId} className="hover:bg-cream/50 transition-colors">

                    {/* Referencia */}
                    <td className="px-4 py-4 border-b border-border">
                      <p className="font-medium text-sm text-charcoal">{order.orderId}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {order.date ? new Date(order.date).toLocaleDateString('es-ES') : '—'}
                      </p>
                    </td>

                    {/* Fecha */}
                    <td className="px-4 py-4 border-b border-border text-sm text-charcoal">
                      {order.date
                        ? new Date(order.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>

                    {/* Productos */}
                    <td className="px-4 py-4 border-b border-border">
                      {order.items?.slice(0, 2).map((item, i) => (
                        <p key={i} className="text-xs text-muted leading-relaxed">
                          {item.name} ×{item.quantity}
                        </p>
                      ))}
                      {order.items?.length > 2 && (
                        <p className="text-xs text-muted">+{order.items.length - 2} más</p>
                      )}
                    </td>

                    {/* HU-21 — Estado en tiempo real */}
                    <td className="px-4 py-4 border-b border-border">
                      <StatusBadge status={order.status} />
                    </td>

                    {/* Importe */}
                    <td className="px-4 py-4 border-b border-border">
                      <p className="text-base font-medium text-charcoal">
                        {order.total?.toFixed(2)}€
                      </p>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-4 border-b border-border">
                      <div className="flex gap-2">
                        {/* HU-19 — Repetir pedido */}
                        <IconBtn
                          onClick={() => handleRepeat(order)}
                          title="Repetir pedido"
                        >
                          ↻
                        </IconBtn>

                        {/* HU-20 — Descargar factura */}
                        {invoice && (
                          <IconBtn
                            onClick={() => handleDownload(invoice.invoiceId)}
                            title="Descargar factura"
                          >
                            ↓
                          </IconBtn>
                        )}

                        {/* HU-31 — Iniciar devolución (solo pedidos entregados) */}
                        {order.status === 'DELIVERED' && (
                          <IconBtn
                            onClick={() => navigate('/returns/new', { state: { orderId: order.orderId } })}
                            title="Solicitar devolución"
                          >
                            ↩
                          </IconBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
