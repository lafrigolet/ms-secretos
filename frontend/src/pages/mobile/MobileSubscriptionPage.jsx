import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { subscriptionsApi } from '../../api/index.js'
import { Spinner } from '../../components/Spinner.jsx'

const card = { background: '#FDFCFA', boxShadow: '0 2px 16px rgba(44,44,40,0.06)' }

const PLAN_META = {
  'plan-basic':      { color: '#6B7B5E', bg: '#F4F6F2', label: 'Basic',      icon: '📋' },
  'plan-pro':        { color: '#4A7054', bg: '#EEF4EA', label: 'Pro',         icon: '⭐' },
  'plan-enterprise': { color: '#B8963C', bg: '#F7F3E8', label: 'Enterprise',  icon: '👑' },
}

const STATUS_LABELS = {
  ACTIVE:    { label: 'Activa',         color: '#4A7054', bg: '#EEF4EA' },
  TRIALING:  { label: 'Prueba',         color: '#4A5740', bg: '#EEF4EA' },
  CANCELLED: { label: 'Cancelada',      color: '#8A8880', bg: '#F2EFE9' },
  PAST_DUE:  { label: 'Pago pendiente', color: '#B8963C', bg: '#F7F3E8' },
}

function PlanCard ({ plan, current, onSelect, loading }) {
  const meta = PLAN_META[plan.id] ?? PLAN_META['plan-basic']
  const isCurrent = current?.planId === plan.id && current?.status === 'ACTIVE'

  return (
    <div
      style={{ ...card, border: isCurrent ? `2px solid ${meta.color}` : '2px solid #E8E4DC' }}
      className="rounded-2xl p-5 mb-3"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <div>
            <p className="font-medium text-charcoal text-sm">{plan.name}</p>
            <p className="text-xs text-muted">€{plan.price.toFixed(2)} / mes</p>
          </div>
        </div>
        {isCurrent && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: meta.color, background: meta.bg }}>
            Actual
          </span>
        )}
      </div>

      <div className="space-y-1 mb-4">
        {plan.features.map(f => (
          <p key={f} className="text-xs text-muted flex gap-1.5">
            <span style={{ color: meta.color }}>✓</span>{f}
          </p>
        ))}
      </div>

      {!isCurrent && (
        <button
          onClick={() => onSelect(plan)}
          disabled={loading}
          className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{ background: meta.bg, color: meta.color }}
        >
          {loading ? <Spinner size="sm" /> : null}
          {current ? 'Cambiar a este plan' : 'Suscribirse'}
        </button>
      )}
    </div>
  )
}

function ConfirmSheet ({ plan, hasCurrent, onConfirm, onClose, loading }) {
  const meta = PLAN_META[plan.id] ?? PLAN_META['plan-basic']
  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1 bg-charcoal/50 backdrop-blur-sm" />
      <div
        className="bg-[#FDFCFA] rounded-t-3xl px-5 pb-8 pt-4"
        style={{ boxShadow: '0 -8px 40px rgba(44,44,40,0.15)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-9 h-1 bg-border mx-auto mb-5" />
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{meta.icon}</span>
          <div>
            <p className="font-serif text-lg text-charcoal">{hasCurrent ? 'Cambiar a' : 'Suscribirse a'} {plan.name}</p>
            <p className="text-sm text-muted">€{plan.price.toFixed(2)} / mes</p>
          </div>
        </div>
        <p className="text-sm text-muted mb-6">
          Se realizará un cargo mensual en tu método de pago registrado.
        </p>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] mb-3"
          style={{ background: meta.color, color: '#FFF' }}
        >
          {loading ? <Spinner size="sm" /> : null}
          Confirmar suscripción
        </button>
        <button onClick={onClose} className="w-full py-4 text-sm text-muted">
          Cancelar
        </button>
      </div>
    </div>
  )
}

export function MobileSubscriptionPage () {
  const [activeTab, setActiveTab] = useState('planes')
  const [confirming, setConfirming] = useState(null)
  const [working, setWorking] = useState(false)

  const { data: plans, loading: loadingPlans } = useAsync(() => subscriptionsApi.getPlans(), [])
  const { data: subscription, loading: loadingSub, refetch: refetchSub } = useAsync(
    () => subscriptionsApi.getMySubscription().catch(err => {
      if (err.status === 404) return null
      throw err
    }),
    []
  )
  const { data: billing, loading: loadingBilling } = useAsync(
    () => activeTab === 'facturacion' ? subscriptionsApi.getBillingHistory() : Promise.resolve(null),
    [activeTab]
  )

  const currentMeta = subscription ? (PLAN_META[subscription.planId] ?? PLAN_META['plan-basic']) : null
  const currentStatus = subscription ? (STATUS_LABELS[subscription.status] ?? { label: subscription.status, color: '#8A8880', bg: '#F2EFE9' }) : null

  async function handleConfirm () {
    if (!confirming) return
    setWorking(true)
    try {
      if (subscription) {
        await subscriptionsApi.changePlan(confirming.id)
      } else {
        await subscriptionsApi.subscribe(confirming.id)
      }
      setConfirming(null)
      refetchSub()
    } catch (err) {
      alert(err.message ?? 'Error al procesar la suscripción')
    } finally {
      setWorking(false)
    }
  }

  async function handleCancel () {
    if (!window.confirm('¿Cancelar tu suscripción? Mantendrás el acceso hasta el final del período.')) return
    setWorking(true)
    try {
      await subscriptionsApi.cancel()
      refetchSub()
    } catch (err) {
      alert(err.message ?? 'Error al cancelar la suscripción')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="px-4 pt-4 pb-6">
      {/* Current subscription banner */}
      {loadingSub && (
        <div className="flex justify-center py-6"><Spinner /></div>
      )}

      {!loadingSub && subscription && currentMeta && (
        <div
          className="rounded-2xl p-4 mb-4 flex items-center gap-4"
          style={{ background: currentMeta.bg, border: `1.5px solid ${currentMeta.color}20` }}
        >
          <span className="text-3xl">{currentMeta.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-medium text-sm text-charcoal">{currentMeta.label}</p>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: currentStatus.color, background: '#fff' }}>
                {currentStatus.label}
              </span>
            </div>
            <p className="text-xs text-muted">
              Hasta {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
            </p>
            {subscription.cancelAtPeriodEnd && (
              <p className="text-xs mt-1" style={{ color: '#B8963C' }}>⚠ Cancelada al término del período</p>
            )}
          </div>
          {subscription.status === 'ACTIVE' && !subscription.cancelAtPeriodEnd && (
            <button
              onClick={handleCancel}
              disabled={working}
              className="text-xs px-3 py-1.5 rounded-xl border border-border text-muted"
            >
              {working ? '…' : 'Cancelar'}
            </button>
          )}
        </div>
      )}

      {!loadingSub && !subscription && (
        <div className="rounded-2xl p-5 mb-4 text-center" style={card}>
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm font-medium text-charcoal mb-0.5">Sin suscripción activa</p>
          <p className="text-xs text-muted">Elige un plan para acceder a todas las funciones.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl bg-cream">
        {[['planes', 'Planes'], ['facturacion', 'Facturación']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
              background: activeTab === id ? '#FDFCFA' : 'transparent',
              color: activeTab === id ? '#4A5740' : '#8A8880',
              boxShadow: activeTab === id ? '0 1px 6px rgba(44,44,40,0.08)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Plans tab */}
      {activeTab === 'planes' && (
        <>
          {loadingPlans && <div className="flex justify-center py-6"><Spinner /></div>}
          {!loadingPlans && plans?.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              current={subscription}
              onSelect={setConfirming}
              loading={working}
            />
          ))}
        </>
      )}

      {/* Billing tab */}
      {activeTab === 'facturacion' && (
        <div>
          {loadingBilling && <div className="flex justify-center py-6"><Spinner /></div>}
          {!loadingBilling && !billing?.length && (
            <div className="text-center py-10">
              <p className="text-3xl mb-3">🧾</p>
              <p className="text-sm text-muted">No hay registros de facturación.</p>
            </div>
          )}
          {billing?.map(r => (
            <div key={r.id} className="flex items-center justify-between p-4 rounded-xl mb-2" style={card}>
              <div>
                <p className="text-sm font-medium text-charcoal">€{r.amount.toFixed(2)} {r.currency}</p>
                <p className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                color: r.status === 'PAID' ? '#4A7054' : '#B8963C',
                background: r.status === 'PAID' ? '#EEF4EA' : '#F7F3E8',
              }}>
                {r.status === 'PAID' ? 'Pagado' : r.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Confirm sheet */}
      {confirming && (
        <ConfirmSheet
          plan={confirming}
          hasCurrent={!!subscription}
          onConfirm={handleConfirm}
          onClose={() => setConfirming(null)}
          loading={working}
        />
      )}
    </div>
  )
}
