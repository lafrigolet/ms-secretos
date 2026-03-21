import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync.js'
import { intelligenceApi } from '../api/index.js'
import { Spinner } from '../components/Spinner.jsx'

// ── Helpers ───────────────────────────────────────────────────────
function TrendBadge ({ trend, value }) {
  if (trend === 'NO_DATA') return <span className="tag bg-cream text-muted text-xs">Sin datos comparativos</span>
  const up = trend === 'UP'
  return (
    <span className={`tag text-xs ${up ? 'bg-[#EEF4EA] text-success' : 'bg-[#FDF0EE] text-error'}`}>
      {up ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  )
}

function MetricCard ({ label, current, previous, change, trend, unit = '€', children }) {
  return (
    <div className="card">
      <p className="text-[11px] uppercase tracking-widest text-muted mb-3">{label}</p>
      <div className="flex items-baseline gap-3 mb-1">
        <span className="font-serif text-4xl font-light text-charcoal">
          {typeof current === 'number' ? current.toFixed(unit === '€' ? 2 : 0) : current}
          <span className="text-lg text-muted ml-1">{unit}</span>
        </span>
        {change != null && <TrendBadge trend={trend} value={change} />}
      </div>
      {previous != null && (
        <p className="text-xs text-muted">
          Periodo anterior: {typeof previous === 'number' ? previous.toFixed(unit === '€' ? 2 : 0) : previous}{unit}
        </p>
      )}
      {children}
    </div>
  )
}

// ── HU-40 — Comparativa ──────────────────────────────────────────
function ComparisonSection () {
  const [window, setWindow] = useState(90)
  const { data, loading } = useAsync(() => intelligenceApi.getComparison(window), [window])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="section-label mb-0">Comparativa de compras</p>
        <div className="flex gap-1.5">
          {[30, 90, 180].map(d => (
            <button key={d} onClick={() => setWindow(d)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                window === d ? 'bg-sage-dark text-off-white border-sage-dark' : 'bg-cream text-muted border-border hover:border-sage'
              }`}
            >{d} días</button>
          ))}
        </div>
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {data && (
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            label="Volumen de compra"
            current={data.current.total}
            previous={data.previous.total}
            change={data.changes.totalAmount}
            trend={data.changes.trend}
          >
            {data.current.topProducts?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Top productos</p>
                {data.current.topProducts.map(p => (
                  <div key={p.productCode} className="flex justify-between text-xs py-0.5">
                    <span className="text-charcoal">{p.name}</span>
                    <span className="text-muted">×{p.totalQty}</span>
                  </div>
                ))}
              </div>
            )}
          </MetricCard>

          <MetricCard
            label="Número de pedidos"
            current={data.current.orders}
            previous={data.previous.orders}
            change={data.changes.totalOrders}
            trend={data.changes.trend}
            unit=""
          >
            {data.previous.topProducts?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Top periodo anterior</p>
                {data.previous.topProducts.map(p => (
                  <div key={p.productCode} className="flex justify-between text-xs py-0.5">
                    <span className="text-charcoal">{p.name}</span>
                    <span className="text-muted">×{p.totalQty}</span>
                  </div>
                ))}
              </div>
            )}
          </MetricCard>
        </div>
      )}
    </div>
  )
}

// ── HU-41 — Alertas de productos inactivos ────────────────────────
function InactiveAlertsSection () {
  const [weeks, setWeeks] = useState(8)
  const { data, loading } = useAsync(() => intelligenceApi.getInactiveAlerts(weeks), [weeks])
  const navigate = useNavigate()

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="section-label mb-0">Productos sin repostar</p>
        <div className="flex gap-1.5">
          {[4, 8, 12].map(w => (
            <button key={w} onClick={() => setWeeks(w)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                weeks === w ? 'bg-sage-dark text-off-white border-sage-dark' : 'bg-cream text-muted border-border hover:border-sage'
              }`}
            >+{w} semanas</button>
          ))}
        </div>
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {data?.alerts?.length === 0 && (
        <div className="text-center py-8 text-muted">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-sm">Estás al día con todos tus productos habituales</p>
        </div>
      )}

      {data?.alerts?.map(alert => (
        <div key={alert.productCode}
          className="flex items-center gap-4 py-3 border-b border-border last:border-0"
        >
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            alert.weeksSince > 12 ? 'bg-error' : alert.weeksSince > 8 ? 'bg-gold' : 'bg-muted'
          }`} />
          <div className="flex-1">
            <p className="text-sm font-medium text-charcoal">{alert.name}</p>
            <p className="text-xs text-muted">
              Último pedido: {new Date(alert.lastOrderDate).toLocaleDateString('es-ES')} · Pedido {alert.orderCount} veces
            </p>
          </div>
          <span className={`tag text-[10px] ${
            alert.weeksSince > 12 ? 'bg-[#FDF0EE] text-error' :
            alert.weeksSince > 8  ? 'bg-[#F7F3E8] text-gold' :
            'bg-cream text-muted'
          }`}>
            Hace {alert.weeksSince} semanas
          </span>
          <button
            onClick={() => navigate(`/catalog/${alert.productCode}`)}
            className="text-xs text-sage-dark underline underline-offset-2 hover:text-sage border-0 bg-transparent cursor-pointer whitespace-nowrap"
          >
            Pedir →
          </button>
        </div>
      ))}
    </div>
  )
}

// ── HU-42 — Progreso hacia umbrales ──────────────────────────────
function ThresholdsSection () {
  const { data, loading } = useAsync(() => intelligenceApi.getThresholds(), [])

  return (
    <div>
      <p className="section-label mb-4">Progreso hacia beneficios</p>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {data && (
        <>
          <div className="bg-cream rounded-xl p-4 mb-5">
            <div className="flex justify-between items-baseline mb-1">
              <p className="text-sm text-charcoal font-medium">Gasto últimos 30 días</p>
              <p className="font-serif text-2xl font-light text-charcoal">{data.currentPeriodSpend.toFixed(2)}€</p>
            </div>
            {data.next ? (
              <p className="text-xs text-muted">
                Te faltan <strong className="text-charcoal">{data.next.remaining.toFixed(2)}€</strong> para{' '}
                <span className="text-sage-dark">{data.next.label}</span>
              </p>
            ) : (
              <p className="text-xs text-success">✓ Has alcanzado todos los umbrales del periodo</p>
            )}
          </div>

          <div className="space-y-4">
            {data.allThresholds.map(t => (
              <div key={t.threshold}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] ${
                      t.reached ? 'bg-sage-dark text-off-white' : 'bg-cream border border-border text-muted'
                    }`}>
                      {t.reached ? '✓' : ''}
                    </span>
                    <span className={`text-sm ${t.reached ? 'text-charcoal font-medium' : 'text-muted'}`}>
                      {t.label}
                    </span>
                  </div>
                  <span className="text-xs text-muted">{t.threshold}€</span>
                </div>
                <div className="w-full bg-cream rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${t.reached ? 'bg-sage-dark' : 'bg-sage-light'}`}
                    style={{ width: `${t.progressPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── HU-43 — Beneficios acumulados ────────────────────────────────
function BenefitsSummarySection () {
  const [months, setMonths] = useState(6)
  const { data, loading } = useAsync(() => intelligenceApi.getBenefitsSummary(months), [months])

  const BENEFIT_ICONS = { GIFT: '🎁', SAMPLE: '🧪', DISCOUNT: '🏷️', SHIPPING: '📦' }
  const BENEFIT_LABELS = { GIFT: 'Regalos', SAMPLE: 'Muestras', DISCOUNT: 'Descuentos', SHIPPING: 'Envío prioritario' }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="section-label mb-0">Beneficios acumulados</p>
        <div className="flex gap-1.5">
          {[3, 6, 12].map(m => (
            <button key={m} onClick={() => setMonths(m)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                months === m ? 'bg-sage-dark text-off-white border-sage-dark' : 'bg-cream text-muted border-border hover:border-sage'
              }`}
            >{m} meses</button>
          ))}
        </div>
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {data && (
        <>
          {data.totalBenefits === 0 ? (
            <div className="text-center py-8 text-muted">
              <p className="text-2xl mb-2">🎁</p>
              <p className="text-sm">Sin beneficios en los últimos {months} meses</p>
            </div>
          ) : (
            <>
              {/* Resumen por tipo */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {Object.entries(data.byType).map(([type, info]) => (
                  <div key={type} className="bg-cream rounded-xl p-4 flex items-center gap-3">
                    <span className="text-2xl">{BENEFIT_ICONS[type] ?? '⭐'}</span>
                    <div>
                      <p className="font-serif text-2xl font-light text-charcoal leading-none">{info.count}</p>
                      <p className="text-xs text-muted">{BENEFIT_LABELS[type] ?? type}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <p className="section-label mb-3">Historial</p>
              <div className="space-y-2">
                {data.timeline.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <span className="text-lg">{BENEFIT_ICONS[b.benefit?.type] ?? '⭐'}</span>
                    <div className="flex-1">
                      <p className="text-sm text-charcoal">{b.benefit?.description}</p>
                      <p className="text-xs text-muted">{b.promoName}</p>
                    </div>
                    <span className="text-xs text-muted whitespace-nowrap">
                      {new Date(b.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── IntelligencePage ──────────────────────────────────────────────
export function IntelligencePage () {
  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">Inteligencia comercial</h1>
        <p className="page-subtitle">Análisis de tus compras, alertas y progreso de beneficios</p>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* HU-40 */}
        <div className="card col-span-2">
          <ComparisonSection />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* HU-42 */}
        <div className="card">
          <ThresholdsSection />
        </div>
        {/* HU-41 */}
        <div className="card">
          <InactiveAlertsSection />
        </div>
      </div>

      {/* HU-43 */}
      <div className="card">
        <BenefitsSummarySection />
      </div>
    </div>
  )
}
