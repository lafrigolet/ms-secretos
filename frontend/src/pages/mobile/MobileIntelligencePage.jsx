import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync.js'
import { intelligenceApi } from '../../api/index.js'
import { Spinner } from '../../components/Spinner.jsx'

const SECTIONS = ['Comparativa', 'Sin repostar', 'Beneficios', 'Umbrales']
const card = { background: '#FDFCFA', boxShadow: '0 2px 16px rgba(44,44,40,0.06)' }

function TabBar ({ active, onChange }) {
  return (
    <div className="overflow-x-auto scrollbar-none px-4" style={{ borderBottom: '1px solid rgba(226,221,214,0.6)' }}>
      <div className="flex gap-1" style={{ minWidth: 'max-content' }}>
        {SECTIONS.map(s => (
          <button key={s} onClick={() => onChange(s)}
            className="px-4 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
            style={{ borderColor: active === s ? '#4A5740' : 'transparent', color: active === s ? '#4A5740' : '#B0ADA7' }}>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function TrendChip ({ trend, value }) {
  if (trend === 'NO_DATA') return (
    <span className="text-xs px-2.5 py-1 " style={{ background: '#F2EFE9', color: '#8A8880' }}>Sin datos</span>
  )
  const up = trend === 'UP'
  return (
    <span className="text-xs font-medium px-2.5 py-1 "
      style={up
        ? { background: 'rgba(74,112,84,0.12)', color: '#4A7054' }
        : { background: 'rgba(139,58,47,0.10)', color: '#8B3A2F' }
      }>
      {up ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  )
}

function PeriodFilter ({ value, options, onChange }) {
  return (
    <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-none">
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className="px-4 py-2  text-sm transition-all whitespace-nowrap"
          style={value === opt.value
            ? { background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', color: '#FDFCFA', boxShadow: '0 3px 12px rgba(74,87,64,0.25)' }
            : { background: '#FDFCFA', color: '#8A8880', boxShadow: '0 1px 4px rgba(44,44,40,0.06)' }
          }>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function StatCard ({ label, main, sub, badge }) {
  return (
    <div className="p-4" style={card}>
      <p className="m-label mb-2">{label}</p>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-serif text-[40px] font-light text-charcoal leading-none">{main}</span>
        {badge}
      </div>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  )
}

function ComparisonSection () {
  const [window, setWindow] = useState(90)
  const { data, loading } = useAsync(() => intelligenceApi.getComparison(window), [window])

  return (
    <div>
      <PeriodFilter
        value={window}
        options={[{ value: 30, label: '30 días' }, { value: 90, label: '90 días' }, { value: 180, label: '6 meses' }]}
        onChange={setWindow}
      />
      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {data && (
        <div className="flex flex-col gap-3">
          <StatCard
            label="Volumen de compra"
            main={`${data.current.total.toFixed(2)}€`}
            sub={`Periodo anterior: ${data.previous.total.toFixed(2)}€`}
            badge={<TrendChip trend={data.changes.trend} value={data.changes.totalAmount} />}
          />
          <StatCard
            label="Pedidos realizados"
            main={data.current.orders}
            sub={`Periodo anterior: ${data.previous.orders} pedidos`}
            badge={<TrendChip trend={data.changes.trend} value={data.changes.totalOrders} />}
          />
          {data.current.topProducts?.length > 0 && (
            <div className="p-4" style={card}>
              <p className="m-label mb-3">Productos más pedidos</p>
              <div className="flex flex-col gap-0">
                {data.current.topProducts.map((p, i) => (
                  <div key={p.productCode} className="flex items-center gap-3 py-3"
                    style={{ borderTop: i > 0 ? '1px solid rgba(226,221,214,0.5)' : 'none' }}>
                    <span className="font-serif text-lg font-light text-muted w-5 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-charcoal truncate">{p.name}</p>
                    </div>
                    <span className="text-xs font-medium text-muted tabular-nums">×{p.totalQty}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InactiveAlertsSection () {
  const [weeks, setWeeks] = useState(8)
  const { data, loading } = useAsync(() => intelligenceApi.getInactiveAlerts(weeks), [weeks])
  const navigate = useNavigate()

  return (
    <div>
      <PeriodFilter
        value={weeks}
        options={[{ value: 4, label: '+4 semanas' }, { value: 8, label: '+8 semanas' }, { value: 12, label: '+12 semanas' }]}
        onChange={setWeeks}
      />
      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {data?.alerts?.length === 0 && (
        <div className="text-center py-10">
          <div className="w-20 h-20  flex items-center justify-center text-4xl mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#C8D4BE,#DFE9D9)' }}>✓</div>
          <p className="font-serif text-xl font-light text-charcoal mb-1">Al día</p>
          <p className="text-sm text-muted">No tienes productos pendientes de reabastecimiento</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {data?.alerts?.map(alert => {
          const urgent  = alert.weeksSince > 12
          const warning = alert.weeksSince > 8
          const dotColor   = urgent ? '#8B3A2F' : warning ? '#B8963C' : '#8A8880'
          const chipStyle  = urgent
            ? { background: 'rgba(139,58,47,0.10)', color: '#8B3A2F' }
            : warning
            ? { background: 'rgba(184,150,60,0.12)', color: '#8C6E52' }
            : { background: '#F2EFE9', color: '#8A8880' }

          return (
            <div key={alert.productCode} className="p-4" style={card}>
              <div className="flex items-start gap-3 mb-3">
                <span className="w-2 h-2  mt-1.5 flex-shrink-0"
                  style={{ background: dotColor, minWidth: '8px' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-charcoal">{alert.name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    Último pedido: {new Date(alert.lastOrderDate).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <span className="text-[10px] font-medium px-2.5 py-1  flex-shrink-0"
                  style={chipStyle}>
                  Hace {alert.weeksSince} sem
                </span>
              </div>
              <button
                onClick={() => navigate(`/catalog/${alert.productCode}`)}
                className="w-full py-2.5  text-xs font-medium text-off-white active:scale-[0.97] transition-all"
                style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', boxShadow: '0 3px 10px rgba(74,87,64,0.20)' }}>
                Pedir ahora →
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BenefitsSummarySection () {
  const [months, setMonths] = useState(6)
  const { data, loading } = useAsync(() => intelligenceApi.getBenefitsSummary(months), [months])

  const BENEFIT_META = {
    GIFT:     { icon: '🎁', label: 'Regalos',   bg: '#F7F3E8', color: '#8C6E52' },
    SAMPLE:   { icon: '🧪', label: 'Muestras',  bg: '#EBF0F4', color: '#3A5F8A' },
    DISCOUNT: { icon: '🏷️', label: 'Descuentos', bg: '#F4EDE4', color: '#8C6E52' },
    SHIPPING: { icon: '📦', label: 'Envíos',    bg: '#EEF4EA', color: '#4A7054' },
  }

  return (
    <div>
      <PeriodFilter
        value={months}
        options={[{ value: 3, label: '3 meses' }, { value: 6, label: '6 meses' }, { value: 12, label: '12 meses' }]}
        onChange={setMonths}
      />
      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {data && (
        data.totalBenefits === 0 ? (
          <div className="text-center py-10">
            <div className="w-20 h-20  flex items-center justify-center text-4xl mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg,#E8D4A0,#F0E4CB)' }}>🎁</div>
            <p className="font-serif text-xl font-light text-charcoal mb-1">Sin beneficios</p>
            <p className="text-sm text-muted">No has acumulado beneficios en los últimos {months} meses</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {Object.entries(data.byType).map(([type, info]) => {
                const meta = BENEFIT_META[type] ?? { icon: '⭐', label: type, bg: '#F2EFE9', color: '#8A8880' }
                return (
                  <div key={type} className="p-4 flex items-center gap-3"
                    style={{ ...card, background: meta.bg }}>
                    <span className="text-3xl">{meta.icon}</span>
                    <div>
                      <p className="font-serif text-3xl font-light" style={{ color: meta.color, lineHeight: 1 }}>{info.count}</p>
                      <p className="text-xs text-muted">{meta.label}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="m-label mb-3">Historial</p>
            <div style={card}>
              {data.timeline.map((b, i) => {
                const meta = BENEFIT_META[b.benefit?.type] ?? { icon: '⭐', color: '#8A8880' }
                return (
                  <div key={i} className="flex items-center gap-3.5 p-4"
                    style={{ borderTop: i > 0 ? '1px solid rgba(226,221,214,0.5)' : 'none' }}>
                    <span className="text-2xl w-8 text-center flex-shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-charcoal leading-tight">{b.benefit?.description}</p>
                      <p className="text-xs text-muted">{b.promoName}</p>
                    </div>
                    <span className="text-xs text-muted whitespace-nowrap flex-shrink-0">
                      {new Date(b.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )
      )}
    </div>
  )
}

function ThresholdsSection () {
  const { data, loading } = useAsync(() => intelligenceApi.getThresholds(), [])

  return (
    <div>
      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {data && (
        <>
          {/* Current spend hero */}
          <div className="p-5 mb-5"
            style={{ ...card, background: 'linear-gradient(135deg,#EEF4EA,#F4F8F2)' }}>
            <p className="m-label mb-1">Gasto en los últimos 30 días</p>
            <p className="font-serif text-[48px] font-light text-charcoal leading-none mb-2">
              {data.currentPeriodSpend.toFixed(2)}€
            </p>
            {data.next ? (
              <p className="text-sm text-muted">
                Te faltan <strong className="text-charcoal">{data.next.remaining.toFixed(2)}€</strong> para{' '}
                <span style={{ color: '#4A5740' }}>{data.next.label}</span>
              </p>
            ) : (
              <p className="text-sm" style={{ color: '#4A7054' }}>✓ Has alcanzado todos los umbrales del periodo</p>
            )}
          </div>

          <p className="m-label mb-3">Progreso de umbrales</p>
          <div className="flex flex-col gap-3">
            {data.allThresholds.map(t => (
              <div key={t.threshold} className="p-4" style={card}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6  flex items-center justify-center text-[11px] font-medium flex-shrink-0"
                      style={t.reached
                        ? { background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', color: '#FDFCFA' }
                        : { background: '#F2EFE9', color: '#8A8880' }
                      }>
                      {t.reached ? '✓' : ''}
                    </div>
                    <span className="text-sm" style={{ color: t.reached ? '#2C2C28' : '#8A8880', fontWeight: t.reached ? 500 : 400 }}>
                      {t.label}
                    </span>
                  </div>
                  <span className="text-xs text-muted tabular-nums">{t.threshold}€</span>
                </div>
                <div className="w-full  overflow-hidden" style={{ height: '6px', background: '#F2EFE9' }}>
                  <div className="h-full  transition-all"
                    style={{
                      width: `${t.progressPct}%`,
                      background: t.reached
                        ? 'linear-gradient(90deg,#4A5740,#6B7B5E)'
                        : 'linear-gradient(90deg,#C8D4BE,#DFE9D9)',
                    }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function MobileIntelligencePage () {
  const [activeSection, setActiveSection] = useState('Comparativa')

  return (
    <div>
      <div className="px-4 pt-5 mb-4">
        <h1 className="font-serif text-[34px] font-light text-charcoal leading-none mb-1">Inteligencia</h1>
        <p className="text-sm text-muted">Análisis de compras, alertas y beneficios</p>
      </div>

      <TabBar active={activeSection} onChange={setActiveSection} />

      <div className="px-4 pt-5 pb-8">
        {activeSection === 'Comparativa'  && <ComparisonSection />}
        {activeSection === 'Sin repostar' && <InactiveAlertsSection />}
        {activeSection === 'Beneficios'   && <BenefitsSummarySection />}
        {activeSection === 'Umbrales'     && <ThresholdsSection />}
      </div>
    </div>
  )
}
