import { useState } from 'react'
import { useAsync } from '../hooks/useAsync.js'
import { sustainabilityApi } from '../api/index.js'
import { Spinner } from '../components/Spinner.jsx'

const TABS = ['Nuestros productos', 'Calculadora CO₂', 'Mis preferencias']

// ── HU-53 — Ficha de sostenibilidad ──────────────────────────────
function ScoreBar ({ value, max = 100, color = 'bg-sage-dark' }) {
  return (
    <div className="w-full bg-cream rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${(value / max) * 100}%` }} />
    </div>
  )
}

function ProductSustainabilityCard ({ product, onClick }) {
  const score = product.sustainabilityScore
  const scoreColor = score >= 90 ? 'text-success' : score >= 75 ? 'text-gold' : 'text-muted'
  const barColor   = score >= 90 ? 'bg-success'   : score >= 75 ? 'bg-gold'   : 'bg-muted'

  return (
    <div onClick={onClick} className="card cursor-pointer hover:border-sage-light hover:-translate-y-0.5 transition-all">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-serif text-base font-normal text-charcoal leading-snug flex-1">{product.name}</h3>
        <span className={`font-serif text-2xl font-light ml-3 ${scoreColor}`}>{score}</span>
      </div>

      <ScoreBar value={score} color={barColor} />
      <p className="text-xs text-muted mt-1 mb-3">Puntuación de sostenibilidad</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {product.ecoLabels?.map(label => (
          <span key={label} className="tag bg-[#EEF4EA] text-sage-dark text-[10px]">{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-cream rounded-lg px-2.5 py-2">
          <p className="text-muted mb-0.5">Ingredientes naturales</p>
          <p className="font-medium text-charcoal">{product.naturalPercentage}%</p>
        </div>
        <div className="bg-cream rounded-lg px-2.5 py-2">
          <p className="text-muted mb-0.5">Huella del producto</p>
          <p className="font-medium text-charcoal">{product.carbonFootprintKg} kg CO₂</p>
        </div>
      </div>
    </div>
  )
}

function ProductDetailModal ({ productCode, onClose }) {
  const { data, loading } = useAsync(
    () => sustainabilityApi.getProduct(productCode),
    [productCode]
  )

  return (
    <div className="fixed inset-0 bg-charcoal/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-off-white rounded-2xl p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {loading && <div className="flex justify-center py-8"><Spinner /></div>}
        {data && (
          <>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="font-serif text-2xl font-light text-charcoal">{data.name}</h2>
                <p className="text-muted text-sm">{data.origin.country} — {data.origin.supplier}</p>
              </div>
              <span className="font-serif text-3xl font-light text-success">{data.sustainabilityScore}</span>
            </div>

            {/* Certificaciones */}
            <div className="flex flex-wrap gap-2 mb-5">
              {data.origin.certifications?.map(c => (
                <span key={c} className="tag bg-[#EEF4EA] text-sage-dark text-xs">{c}</span>
              ))}
            </div>

            {/* Ingredientes */}
            <p className="section-label">Ingredientes y origen</p>
            <div className="space-y-2 mb-5">
              {data.ingredients?.map((ing, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-cream rounded-lg">
                  <span className="text-sm">{ing.natural ? '🌿' : '🔬'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-charcoal">{ing.name}</p>
                    <p className="text-xs text-muted">{ing.origin}</p>
                  </div>
                  <span className="text-xs text-muted font-medium">{ing.percentage}%</span>
                </div>
              ))}
            </div>

            {/* Envase */}
            <p className="section-label">Envase</p>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-cream rounded-lg px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Material</p>
                <p className="text-sm font-medium">{data.packaging.material}</p>
              </div>
              <div className="bg-cream rounded-lg px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Reciclable</p>
                <p className="text-sm font-medium">{data.packaging.recyclable ? '✓ Sí' : '✗ No'}</p>
              </div>
              <div className="bg-cream rounded-lg px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Recargable</p>
                <p className="text-sm font-medium">{data.packaging.refillable ? '✓ Sí' : '✗ No'}</p>
              </div>
            </div>

            <button className="btn-ghost text-sm" onClick={onClose}>← Cerrar</button>
          </>
        )}
      </div>
    </div>
  )
}

function ProductsTab () {
  const { data: products, loading } = useAsync(() => sustainabilityApi.getProducts(), [])
  const [selected, setSelected] = useState(null)

  return (
    <div>
      <p className="section-label mb-1">Transparencia de producto</p>
      <p className="text-sm text-muted mb-6">
        Origen, ingredientes y compromisos medioambientales de nuestra gama.
      </p>
      {loading && <div className="flex justify-center py-8"><Spinner size="lg" /></div>}
      <div className="grid grid-cols-3 gap-4">
        {products?.map(p => (
          <ProductSustainabilityCard key={p.productCode} product={p} onClick={() => setSelected(p.productCode)} />
        ))}
      </div>
      {selected && <ProductDetailModal productCode={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ── HU-54 — Calculadora de huella de carbono ──────────────────────
const SHIPPING_LABELS = {
  STANDARD: { label: 'Estándar',          icon: '🚚', desc: 'Entrega en 2-4 días hábiles' },
  ECO:      { label: 'Eco-ruta',           icon: '🌿', desc: 'Ruta optimizada, baja emisión. +1 día' },
  EXPRESS:  { label: 'Express',           icon: '✈',  desc: 'Entrega en 24h' },
  PICKUP:   { label: 'Punto de recogida', icon: '📍', desc: 'Recoge en tienda o punto de conveniencia' },
}

function CarbonTab () {
  const [items, setItems]   = useState([{ productCode: 'P-RT-001', quantity: 6 }])
  const [method, setMethod] = useState('STANDARD')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function calculate () {
    setLoading(true)
    try {
      const data = await sustainabilityApi.getCarbonFootprint(items, method)
      setResult(data)
    } catch { alert('Error al calcular la huella de carbono') }
    finally { setLoading(false) }
  }

  function updateItem (i, field, value) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
    setResult(null)
  }

  return (
    <div>
      <p className="section-label mb-1">Calculadora de huella de carbono</p>
      <p className="text-sm text-muted mb-6">
        Estima el impacto ambiental del envío de tu pedido y compara modalidades.
      </p>

      <div className="grid grid-cols-2 gap-6">
        {/* Configurador */}
        <div>
          <p className="text-xs font-medium text-charcoal mb-3">Productos del pedido</p>
          <div className="space-y-2 mb-4">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input type="text" className="form-input text-sm flex-1" placeholder="Código SAP"
                  value={item.productCode}
                  onChange={e => updateItem(i, 'productCode', e.target.value)} />
                <input type="number" className="form-input text-sm w-20" min="1" placeholder="Uds"
                  value={item.quantity}
                  onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)} />
                {items.length > 1 && (
                  <button onClick={() => { setItems(prev => prev.filter((_, idx) => idx !== i)); setResult(null) }}
                    className="text-muted hover:text-error border-0 bg-transparent cursor-pointer">✕</button>
                )}
              </div>
            ))}
            <button onClick={() => setItems(prev => [...prev, { productCode: '', quantity: 1 }])}
              className="btn-ghost text-xs">+ Añadir producto</button>
          </div>

          <p className="text-xs font-medium text-charcoal mb-3">Modalidad de envío</p>
          <div className="space-y-2 mb-5">
            {Object.entries(SHIPPING_LABELS).map(([key, val]) => (
              <label key={key} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                method === key ? 'border-sage bg-sage-light/10' : 'border-border hover:border-sage-light'
              }`}>
                <input type="radio" name="method" value={key} checked={method === key}
                  onChange={() => { setMethod(key); setResult(null) }} className="accent-sage-dark" />
                <span className="text-xl">{val.icon}</span>
                <div>
                  <p className="text-sm font-medium text-charcoal">{val.label}</p>
                  <p className="text-xs text-muted">{val.desc}</p>
                </div>
              </label>
            ))}
          </div>

          <button onClick={calculate} disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <><Spinner size="sm" />Calculando…</> : '🌍 Calcular huella'}
          </button>
        </div>

        {/* Resultado */}
        <div>
          {result && (
            <>
              <div className="bg-[#EEF4EA] border border-sage-light/50 rounded-2xl p-6 mb-4 text-center">
                <p className="text-xs uppercase tracking-wider text-sage mb-2">Emisiones estimadas</p>
                <p className="font-serif text-5xl font-light text-charcoal mb-1">{result.co2Kg}</p>
                <p className="text-sm text-muted">kg de CO₂</p>
                <p className="text-xs text-muted mt-3">
                  Equivale a {result.treeHours}h de absorción de un árbol adulto
                </p>
                <p className="text-xs text-muted">Peso del paquete: {result.grossWeightKg} kg</p>
              </div>

              <p className="text-xs font-medium text-charcoal mb-3">Alternativas más sostenibles</p>
              <div className="space-y-2">
                {result.alternatives.filter(a => a.co2Kg < result.co2Kg).map(alt => (
                  <div key={alt.method} className="flex items-center gap-3 p-3 bg-cream rounded-lg">
                    <span>{SHIPPING_LABELS[alt.method]?.icon ?? '📦'}</span>
                    <div className="flex-1">
                      <p className="text-sm text-charcoal">{SHIPPING_LABELS[alt.method]?.label ?? alt.method}</p>
                      <p className="text-xs text-muted">{alt.co2Kg} kg CO₂</p>
                    </div>
                    <span className="tag bg-[#EEF4EA] text-success text-[10px]">
                      −{alt.savings.toFixed(3)} kg
                    </span>
                  </div>
                ))}
                {result.alternatives.every(a => a.co2Kg >= result.co2Kg) && (
                  <p className="text-xs text-success text-center py-2">
                    ✓ Ya has elegido la modalidad más sostenible
                  </p>
                )}
              </div>
            </>
          )}

          {!result && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 text-muted">
              <p className="text-4xl mb-4">🌍</p>
              <p className="text-sm">Configura tu pedido y calcula<br />el impacto ambiental del envío</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── HU-55 — Preferencias de agrupación ───────────────────────────
function GroupingTab () {
  const { data: pref, loading, refetch } = useAsync(() => sustainabilityApi.getGroupingPref(), [])
  const [saving, setSaving] = useState(false)
  const [local, setLocal]   = useState(null)

  const current = local ?? pref

  async function handleSave () {
    setSaving(true)
    try {
      await sustainabilityApi.updateGroupingPref(current)
      setLocal(null)
      refetch()
    } catch { alert('Error al guardar las preferencias') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div>
      <p className="section-label mb-1">Agrupación de pedidos</p>
      <p className="text-sm text-muted mb-6">
        Si aceptas un pequeño retraso, podemos agrupar tus pedidos con otros de la zona y reducir
        el número de envíos y las emisiones de CO₂ asociadas.
      </p>

      <div className="card max-w-lg">
        {/* Toggle principal */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-medium text-charcoal mb-0.5">Acepto retrasar mis pedidos para agruparlos</p>
            <p className="text-xs text-muted">Contribuyes a reducir el impacto ambiental de los envíos</p>
          </div>
          <button
            onClick={() => setLocal(prev => ({ ...(prev ?? pref), acceptDelay: !(prev ?? pref)?.acceptDelay }))}
            className={`w-12 h-7 rounded-full transition-colors relative border-0 cursor-pointer ${
              current?.acceptDelay ? 'bg-sage-dark' : 'bg-cream border border-border'
            }`}
          >
            <span className={`absolute top-0.5 w-6 h-6 bg-off-white rounded-full shadow-sm transition-transform ${
              current?.acceptDelay ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        {/* Días máximos */}
        {current?.acceptDelay && (
          <div className="mb-5">
            <p className="text-xs font-medium text-charcoal mb-3">
              Retraso máximo aceptado: <strong>{current.maxDelayDays} días</strong>
            </p>
            <input
              type="range" min="1" max="14" step="1"
              value={current.maxDelayDays ?? 3}
              onChange={e => setLocal(prev => ({ ...(prev ?? pref), maxDelayDays: parseInt(e.target.value) }))}
              className="w-full accent-sage-dark"
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>1 día</span>
              <span>7 días</span>
              <span>14 días</span>
            </div>
          </div>
        )}

        {/* Impacto estimado */}
        <div className={`rounded-xl p-4 mb-5 ${current?.acceptDelay ? 'bg-[#EEF4EA]' : 'bg-cream'}`}>
          <p className="text-xs font-medium mb-1">
            {current?.acceptDelay ? '🌿 Impacto positivo estimado' : '💡 Si activaras la agrupación…'}
          </p>
          <p className="text-xs text-muted">
            {current?.acceptDelay
              ? `Con un retraso de hasta ${current.maxDelayDays} días podemos reducir hasta un 40% las emisiones de transporte de tu zona.`
              : 'Podrías contribuir a reducir hasta un 40% las emisiones de transporte agrupando con otros pedidos de tu zona.'}
          </p>
        </div>

        {local && (
          <button onClick={handleSave} disabled={saving}
            className="btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <><Spinner size="sm" />Guardando…</> : 'Guardar preferencia'}
          </button>
        )}
        {!local && pref?.updatedAt && (
          <p className="text-xs text-muted text-center">
            Última actualización: {new Date(pref.updatedAt).toLocaleDateString('es-ES')}
          </p>
        )}
      </div>
    </div>
  )
}

// ── SustainabilityPage ────────────────────────────────────────────
export function SustainabilityPage () {
  const [activeTab, setActiveTab] = useState('Nuestros productos')

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">Sostenibilidad</h1>
        <p className="page-subtitle">Transparencia de producto, huella de carbono y compromisos medioambientales</p>
      </div>

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

      <div className={activeTab !== 'Calculadora CO₂' ? 'card' : ''}>
        {activeTab === 'Nuestros productos' && <ProductsTab />}
        {activeTab === 'Calculadora CO₂'   && <div className="card"><CarbonTab /></div>}
        {activeTab === 'Mis preferencias'  && <GroupingTab />}
      </div>
    </div>
  )
}
