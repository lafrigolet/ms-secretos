import { useState } from 'react'
import { useAsync } from '../hooks/useAsync.js'
import { subscriptionsApi } from '../api/index.js'
import { Spinner } from '../components/Spinner.jsx'

const PLAN_COLORS = {
  'plan-basic':      { badge: 'bg-cream text-charcoal',        border: 'border-border',      accent: 'text-charcoal' },
  'plan-pro':        { badge: 'bg-sage-light/30 text-sage-dark', border: 'border-sage-light', accent: 'text-sage-dark' },
  'plan-enterprise': { badge: 'bg-gold/10 text-gold',           border: 'border-gold/40',     accent: 'text-gold' },
}

const STATUS_LABELS = {
  ACTIVE:    { label: 'Activa',      color: 'text-success bg-[#EEF4EA]' },
  TRIALING:  { label: 'Prueba',      color: 'text-sage-dark bg-sage-light/20' },
  CANCELLED: { label: 'Cancelada',   color: 'text-muted bg-cream' },
  PAST_DUE:  { label: 'Pago pendiente', color: 'text-gold bg-gold/10' },
}

function PlanCard ({ plan, current, onSelect, loading }) {
  const isCurrent = current?.planId === plan.id && current?.status === 'ACTIVE'
  const colors = PLAN_COLORS[plan.id] ?? PLAN_COLORS['plan-basic']

  return (
    <div className={`card border-2 transition-all flex flex-col ${isCurrent ? colors.border : 'border-border'}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className={`tag text-xs font-medium ${colors.badge}`}>{plan.name}</span>
          <div className="mt-3 flex items-baseline gap-1">
            <span className={`font-serif text-3xl font-light ${colors.accent}`}>
              €{plan.price.toFixed(2)}
            </span>
            <span className="text-xs text-muted">/ mes</span>
          </div>
        </div>
        {isCurrent && (
          <span className="tag bg-[#EEF4EA] text-success text-[10px]">Plan actual</span>
        )}
      </div>

      <ul className="space-y-1.5 flex-1 mb-6">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-muted">
            <span className="text-sage-dark mt-0.5">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {!isCurrent && (
        <button
          onClick={() => onSelect(plan)}
          disabled={loading}
          className="btn-primary w-full text-sm flex items-center justify-center gap-2"
        >
          {loading ? <Spinner size="sm" /> : null}
          {current ? 'Cambiar a este plan' : 'Suscribirse'}
        </button>
      )}
    </div>
  )
}

// ── Current subscription summary ───────────────────────────────────
function SubscriptionSummary ({ subscription, plan, onCancel, cancelling }) {
  const status = STATUS_LABELS[subscription.status] ?? { label: subscription.status, color: 'text-muted' }

  return (
    <div className="card mb-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="section-label mb-1">Tu suscripción</p>
          <div className="flex items-center gap-3 mb-3">
            <span className="font-serif text-xl text-charcoal">{plan?.name ?? subscription.planId}</span>
            <span className={`tag text-xs font-medium ${status.color}`}>{status.label}</span>
          </div>
          <div className="flex gap-6 text-sm text-muted">
            <div>
              <span className="text-[10px] uppercase tracking-wider block mb-0.5">Período actual</span>
              <span className="text-charcoal text-xs">
                {new Date(subscription.currentPeriodStart).toLocaleDateString('es-ES')}
                {' — '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
              </span>
            </div>
            {subscription.paymentMethod && (
              <div>
                <span className="text-[10px] uppercase tracking-wider block mb-0.5">Método de pago</span>
                <span className="text-charcoal text-xs">{subscription.paymentMethod}</span>
              </div>
            )}
          </div>
          {subscription.cancelAtPeriodEnd && (
            <p className="text-xs text-gold mt-3">
              ⚠ Suscripción cancelada — acceso hasta el {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
            </p>
          )}
        </div>

        {subscription.status === 'ACTIVE' && !subscription.cancelAtPeriodEnd && (
          <button
            onClick={onCancel}
            disabled={cancelling}
            className="btn-ghost text-sm text-muted hover:text-error flex items-center gap-1.5"
          >
            {cancelling ? <Spinner size="sm" /> : null}
            Cancelar suscripción
          </button>
        )}
      </div>
    </div>
  )
}

// ── Billing history ────────────────────────────────────────────────
function BillingHistory () {
  const { data: records, loading } = useAsync(() => subscriptionsApi.getBillingHistory(), [])

  const STATUS_BILL = {
    PAID:    { label: 'Pagado',  color: 'text-success bg-[#EEF4EA]' },
    PENDING: { label: 'Pendiente', color: 'text-gold bg-gold/10' },
    FAILED:  { label: 'Fallido', color: 'text-error bg-red-50' },
  }

  if (loading) return <div className="flex justify-center py-6"><Spinner /></div>
  if (!records?.length) return (
    <p className="text-sm text-muted text-center py-6">No hay registros de facturación.</p>
  )

  return (
    <div className="space-y-2">
      {records.map(r => {
        const s = STATUS_BILL[r.status] ?? { label: r.status, color: 'text-muted' }
        return (
          <div key={r.id} className="flex items-center justify-between p-4 bg-cream rounded-xl">
            <div>
              <p className="text-sm font-medium text-charcoal">
                €{r.amount.toFixed(2)} {r.currency}
              </p>
              <p className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <span className={`tag text-[10px] font-medium ${s.color}`}>{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Subscribe modal ────────────────────────────────────────────────
function SubscribeModal ({ plan, hasCurrent, onConfirm, onClose, loading }) {
  const action = hasCurrent ? 'Cambiar a' : 'Suscribirse a'
  return (
    <div className="fixed inset-0 bg-charcoal/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-off-white rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="font-serif text-xl font-light text-charcoal mb-2">{action} {plan.name}</h2>
        <p className="text-sm text-muted mb-6">
          Se realizará un cargo de <strong>€{plan.price.toFixed(2)}/mes</strong> en tu método de pago.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancelar</button>
          <button onClick={onConfirm} disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
            {loading ? <Spinner size="sm" /> : null}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SubscriptionPage ───────────────────────────────────────────────
export function SubscriptionPage () {
  const TABS = ['Mi plan', 'Facturación']
  const [activeTab, setActiveTab] = useState('Mi plan')
  const [confirming, setConfirming] = useState(null) // plan to confirm
  const [working, setWorking] = useState(false)

  const { data: plans, loading: loadingPlans } = useAsync(() => subscriptionsApi.getPlans(), [])
  const { data: subscription, loading: loadingSub, refetch: refetchSub, error: subError } = useAsync(
    () => subscriptionsApi.getMySubscription().catch(err => {
      if (err.status === 404) return null
      throw err
    }),
    []
  )

  const currentPlan = plans?.find(p => p.id === subscription?.planId)

  async function handleSelectPlan (plan) {
    setConfirming(plan)
  }

  async function handleConfirmPlan () {
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
    if (!window.confirm('¿Seguro que quieres cancelar tu suscripción? Mantendrás el acceso hasta el final del período actual.')) return
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

  const loading = loadingPlans || loadingSub

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">Suscripción</h1>
        <p className="page-subtitle">Gestiona tu plan de acceso al portal B2B</p>
      </div>

      {/* Current subscription banner */}
      {subscription && (
        <SubscriptionSummary
          subscription={subscription}
          plan={currentPlan}
          onCancel={handleCancel}
          cancelling={working}
        />
      )}
      {!loadingSub && !subscription && (
        <div className="card mb-8 bg-sage-light/10 border-sage-light text-center py-8">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm font-medium text-charcoal mb-1">Sin suscripción activa</p>
          <p className="text-sm text-muted">Elige un plan a continuación para acceder a todas las funciones.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-border">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab ? 'border-sage-dark text-sage-dark' : 'border-transparent text-muted hover:text-charcoal'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Plans tab */}
      {activeTab === 'Mi plan' && (
        <div>
          {loading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}
          {!loading && (
            <div className="grid grid-cols-3 gap-5">
              {plans?.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  current={subscription}
                  onSelect={handleSelectPlan}
                  loading={working}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Billing tab */}
      {activeTab === 'Facturación' && (
        <div className="card">
          <p className="section-label mb-4">Historial de facturación</p>
          <BillingHistory />
        </div>
      )}

      {/* Confirm modal */}
      {confirming && (
        <SubscribeModal
          plan={confirming}
          hasCurrent={!!subscription}
          onConfirm={handleConfirmPlan}
          onClose={() => setConfirming(null)}
          loading={working}
        />
      )}
    </div>
  )
}
