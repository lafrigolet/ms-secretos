import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { sustainabilityApi } from '../../api/index.js'
import { Spinner } from '../../components/Spinner.jsx'

const TABS = ['Productos', 'Huella CO₂', 'Agrupación']
const FAMILY_META = {
  F01: { emoji: '✨', gradient: 'linear-gradient(135deg,#E8D4A0,#F0E4CB)', color: '#8C6E52' },
  F02: { emoji: '🌿', gradient: 'linear-gradient(135deg,#C8D4BE,#DFE9D9)', color: '#4A7054' },
  F03: { emoji: '💧', gradient: 'linear-gradient(135deg,#B8CDD4,#D4E4EA)', color: '#3A5F8A' },
}
const SHIPPING_LABELS = {
  STANDARD: { label: 'Estándar',          icon: '🚚', desc: 'Entrega en 2-4 días' },
  ECO:      { label: 'Eco-ruta',          icon: '🌿', desc: 'Ruta optimizada · +1 día' },
  EXPRESS:  { label: 'Express',           icon: '✈',  desc: 'Entrega en 24h' },
  PICKUP:   { label: 'Punto de recogida', icon: '📍', desc: 'Recoge en tienda' },
}

const card = { background: '#FDFCFA', boxShadow: '0 2px 16px rgba(44,44,40,0.06)' }

function ScoreRing ({ score }) {
  const green = score >= 90, gold = score >= 75
  const color = green ? '#4A7054' : gold ? '#B8963C' : '#8A8880'
  return (
    <div className="flex items-center justify-center w-16 h-16 flex-shrink-0">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke="#F2EFE9" strokeWidth="6"/>
        <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${(score / 100) * 163} 163`}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="37" textAnchor="middle" fill={color} fontSize="15" fontWeight="500">{score}</text>
      </svg>
    </div>
  )
}

function ProductDetailModal ({ productCode, onClose }) {
  const { data, loading } = useAsync(() => sustainabilityApi.getProduct(productCode), [productCode])

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1 bg-charcoal/60 backdrop-blur-sm" />
      <div className="bg-[#FDFCFA] overflow-y-auto mt-10"
        style={{ boxShadow: '0 -8px 40px rgba(44,44,40,0.18)', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}>
        <div className="w-9 h-1 bg-border  mx-auto mt-3 mb-5" />
        {loading && <div className="flex justify-center py-10"><Spinner /></div>}
        {data && (
          <div className="px-5 pb-8">
            <div className="flex items-start gap-4 mb-4">
              <ScoreRing score={data.sustainabilityScore} />
              <div className="flex-1">
                <h2 className="font-serif text-xl font-light text-charcoal">{data.name}</h2>
                <p className="text-sm text-muted">{data.origin.country} — {data.origin.supplier}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {data.origin.certifications?.map(c => (
                <span key={c} className="text-xs px-2.5 py-1  font-medium"
                  style={{ background: 'rgba(74,112,84,0.10)', color: '#4A7054' }}>{c}</span>
              ))}
            </div>
            <p className="m-label mb-3">Ingredientes</p>
            <div className="flex flex-col gap-2 mb-5">
              {data.ingredients?.map((ing, i) => (
                <div key={i} className="flex items-center gap-3 p-3.5 "
                  style={{ background: '#F2EFE9' }}>
                  <span>{ing.natural ? '🌿' : '🔬'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-charcoal">{ing.name}</p>
                    <p className="text-xs text-muted">{ing.origin}</p>
                  </div>
                  <span className="text-xs font-medium text-muted tabular-nums">{ing.percentage}%</span>
                </div>
              ))}
            </div>
            <p className="m-label mb-3">Envase</p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[
                ['Material', data.packaging.material],
                ['Reciclable', data.packaging.recyclable ? '✓ Sí' : '✗ No'],
                ['Recargable', data.packaging.refillable ? '✓ Sí' : '✗ No'],
              ].map(([l, v]) => (
                <div key={l} className=" px-3 py-3" style={{ background: '#F2EFE9' }}>
                  <p className="m-label mb-0.5">{l}</p>
                  <p className="text-xs font-medium">{v}</p>
                </div>
              ))}
            </div>
            <button className="w-full py-4  text-sm font-medium text-charcoal active:scale-[0.97] transition-all"
              style={{ background: '#F2EFE9', boxShadow: '0 1px 6px rgba(44,44,40,0.08)' }} onClick={onClose}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ProductsTab () {
  const { data: products, loading } = useAsync(() => sustainabilityApi.getProducts(), [])
  const [selected, setSelected] = useState(null)

  if (loading) return <div className="flex justify-center py-10"><Spinner size="lg" /></div>

  return (
    <div>
      <p className="text-sm text-muted mb-5 leading-relaxed">
        Origen, ingredientes certificados y compromisos medioambientales por producto.
      </p>
      <div className="flex flex-col gap-3">
        {products?.map(p => {
          const score = p.sustainabilityScore
          const green = score >= 90, gold = score >= 75
          const color = green ? '#4A7054' : gold ? '#B8963C' : '#8A8880'
          return (
            <button key={p.productCode} onClick={() => setSelected(p.productCode)}
              className="w-full text-left p-4 active:scale-[0.98] transition-transform" style={card}>
              <div className="flex items-center gap-4 mb-3">
                <ScoreRing score={score} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-base text-charcoal leading-snug">{p.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {p.ecoLabels?.slice(0, 3).map(label => (
                      <span key={label} className="text-[9px] tracking-wide uppercase font-medium px-2 py-0.5 "
                        style={{ background: 'rgba(74,112,84,0.10)', color: '#4A7054' }}>{label}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Natural', `${p.naturalPercentage}%`],
                  ['CO₂', `${p.carbonFootprintKg} kg`],
                  ['Puntuación', `${score}/100`],
                ].map(([l, v]) => (
                  <div key={l} className=" px-2.5 py-2" style={{ background: '#F2EFE9' }}>
                    <p className="m-label mb-0.5">{l}</p>
                    <p className="text-xs font-medium" style={{ color }}>{v}</p>
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>
      {selected && <ProductDetailModal productCode={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function CarbonTab () {
  const [items, setItems] = useState([{ productCode: 'P-RT-001', quantity: 6 }])
  const [method, setMethod] = useState('STANDARD')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function calculate () {
    setLoading(true)
    try { setResult(await sustainabilityApi.getCarbonFootprint(items, method)) }
    catch { alert('Error al calcular') }
    finally { setLoading(false) }
  }

  function updateItem (i, field, value) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
    setResult(null)
  }

  return (
    <div>
      <p className="text-sm text-muted mb-5 leading-relaxed">
        Estima las emisiones de CO₂ de tu próximo envío.
      </p>

      {/* Products */}
      <p className="text-xs font-medium text-charcoal mb-2">Productos del pedido</p>
      <div className="space-y-2 mb-4">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input type="text" className="flex-1  px-4 py-3.5 text-sm outline-none"
              style={{ background: '#F2EFE9' }}
              placeholder="Código SAP"
              value={item.productCode}
              onChange={e => updateItem(i, 'productCode', e.target.value)} />
            <input type="number" className="w-16  px-3 py-3.5 text-sm outline-none text-center"
              style={{ background: '#F2EFE9' }}
              min="1" value={item.quantity}
              onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)} />
            {items.length > 1 && (
              <button onClick={() => { setItems(prev => prev.filter((_, idx) => idx !== i)); setResult(null) }}
                className="text-muted/60 text-xl w-8 h-8 flex items-center justify-center">✕</button>
            )}
          </div>
        ))}
        <button onClick={() => setItems(prev => [...prev, { productCode: '', quantity: 1 }])}
          className="text-sm font-medium underline underline-offset-2" style={{ color: '#4A5740' }}>
          + Añadir producto
        </button>
      </div>

      {/* Shipping methods */}
      <p className="text-xs font-medium text-charcoal mb-2">Modalidad de envío</p>
      <div className="flex flex-col gap-2 mb-5">
        {Object.entries(SHIPPING_LABELS).map(([key, val]) => (
          <label key={key}
            className="flex items-center gap-3.5 p-3.5  cursor-pointer transition-all active:scale-[0.98]"
            style={{
              background: method === key ? 'rgba(74,87,64,0.07)' : '#F2EFE9',
              border: `1.5px solid ${method === key ? 'rgba(74,87,64,0.25)' : 'transparent'}`,
            }}>
            <input type="radio" name="method" value={key} checked={method === key}
              onChange={() => { setMethod(key); setResult(null) }} className="sr-only" />
            <div className="w-5 h-5  flex items-center justify-center"
              style={method === key
                ? { background: 'linear-gradient(135deg,#4A5740,#6B7B5E)' }
                : { background: '#E2DDD6' }
              }>
              {method === key && <span className="w-2 h-2 bg-white " />}
            </div>
            <span className="text-xl">{val.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-charcoal">{val.label}</p>
              <p className="text-xs text-muted">{val.desc}</p>
            </div>
          </label>
        ))}
      </div>

      <button onClick={calculate} disabled={loading}
        className="w-full py-4  text-sm font-medium text-off-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.97] transition-all"
        style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', boxShadow: '0 4px 16px rgba(74,87,64,0.25)' }}>
        {loading ? <><Spinner size="sm" />Calculando…</> : '🌍 Calcular huella'}
      </button>

      {result && (
        <div className="mt-5">
          <div className="p-6 mb-4 text-center"
            style={{ background: 'linear-gradient(135deg,#EEF4EA,#F2F8EF)', boxShadow: '0 2px 16px rgba(74,112,84,0.10)' }}>
            <p className="m-label mb-2">Emisiones estimadas</p>
            <p className="font-serif text-6xl font-light text-charcoal">{result.co2Kg}</p>
            <p className="text-sm text-muted mt-1">kg de CO₂</p>
            <p className="text-xs text-muted mt-3">{result.treeHours}h de absorción por un árbol adulto</p>
          </div>

          {result.alternatives.filter(a => a.co2Kg < result.co2Kg).length > 0 && (
            <>
              <p className="m-label mb-3">Alternativas más sostenibles</p>
              <div className="flex flex-col gap-2">
                {result.alternatives.filter(a => a.co2Kg < result.co2Kg).map(alt => (
                  <div key={alt.method} className="flex items-center gap-3 p-3.5 "
                    style={{ background: '#EEF4EA' }}>
                    <span className="text-xl">{SHIPPING_LABELS[alt.method]?.icon ?? '📦'}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-charcoal">{SHIPPING_LABELS[alt.method]?.label ?? alt.method}</p>
                      <p className="text-xs text-muted">{alt.co2Kg} kg CO₂</p>
                    </div>
                    <span className="text-xs font-medium  px-2.5 py-1"
                      style={{ background: 'rgba(74,112,84,0.15)', color: '#4A7054' }}>
                      −{alt.savings.toFixed(3)} kg
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function GroupingTab () {
  const { data: pref, loading, refetch } = useAsync(() => sustainabilityApi.getGroupingPref(), [])
  const [saving, setSaving] = useState(false)
  const [local, setLocal]   = useState(null)

  const current = local ?? pref

  async function handleSave () {
    setSaving(true)
    try { await sustainabilityApi.updateGroupingPref(current); setLocal(null); refetch() }
    catch { alert('Error al guardar') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>

  return (
    <div>
      <p className="text-sm text-muted mb-5 leading-relaxed">
        Si aceptas un pequeño retraso, podemos agrupar tus pedidos con otros de tu zona y reducir las emisiones de CO₂.
      </p>

      <div className="p-5 mb-4" style={card}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 mr-4">
            <p className="text-sm font-medium text-charcoal mb-0.5">Acepto agrupar mis pedidos</p>
            <p className="text-xs text-muted">Puede suponer un retraso en la entrega</p>
          </div>
          <button
            onClick={() => setLocal(prev => ({ ...(prev ?? pref), acceptDelay: !(prev ?? pref)?.acceptDelay }))}
            className="flex-shrink-0 w-12 h-7  relative transition-all"
            style={{ background: current?.acceptDelay
              ? 'linear-gradient(135deg,#4A5740,#6B7B5E)'
              : '#E2DDD6'
            }}>
            <span className="absolute top-0.5 w-6 h-6 bg-white  shadow-sm transition-transform"
              style={{ transform: current?.acceptDelay ? 'translateX(22px)' : 'translateX(2px)' }} />
          </button>
        </div>

        {current?.acceptDelay && (
          <div>
            <p className="text-xs font-medium text-charcoal mb-3">
              Retraso máximo aceptado: <strong style={{ color: '#4A5740' }}>{current.maxDelayDays} días</strong>
            </p>
            <input type="range" min="1" max="14" step="1"
              value={current.maxDelayDays ?? 3}
              onChange={e => setLocal(prev => ({ ...(prev ?? pref), maxDelayDays: parseInt(e.target.value) }))}
              className="w-full mb-1" style={{ accentColor: '#4A5740' }} />
            <div className="flex justify-between text-xs text-muted">
              <span>1 día</span><span>7 días</span><span>14 días</span>
            </div>
          </div>
        )}
      </div>

      {/* Impact preview */}
      <div
        className=" p-4 mb-5"
        style={{ background: current?.acceptDelay
          ? 'linear-gradient(135deg,#EEF4EA,#F4F8F2)'
          : '#F2EFE9'
        }}>
        <p className="text-sm font-medium mb-1"
          style={{ color: current?.acceptDelay ? '#4A7054' : '#8A8880' }}>
          {current?.acceptDelay ? '🌿 Impacto positivo estimado' : '💡 Activa la agrupación para…'}
        </p>
        <p className="text-xs text-muted leading-relaxed">
          {current?.acceptDelay
            ? `Con hasta ${current.maxDelayDays} días podemos reducir hasta un 40% las emisiones de transporte.`
            : 'Reducir hasta un 40% las emisiones de transporte colaborando con la zona.'}
        </p>
      </div>

      {local && (
        <button onClick={handleSave} disabled={saving}
          className="w-full py-4  text-sm font-medium text-off-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.97] transition-all"
          style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', boxShadow: '0 4px 14px rgba(74,87,64,0.25)' }}>
          {saving ? <><Spinner size="sm" />Guardando…</> : 'Guardar preferencia'}
        </button>
      )}
    </div>
  )
}

export function MobileSustainabilityPage () {
  const [activeTab, setActiveTab] = useState('Productos')

  return (
    <div>
      <div className="px-4 pt-5 mb-4">
        <h1 className="font-serif text-[34px] font-light text-charcoal leading-none mb-1">Sostenibilidad</h1>
        <p className="text-sm text-muted">Transparencia, huella de carbono y agrupación</p>
      </div>

      <div className="overflow-x-auto scrollbar-none px-4" style={{ borderBottom: '1px solid rgba(226,221,214,0.6)' }}>
        <div className="flex gap-1" style={{ minWidth: 'max-content' }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
              style={{ borderColor: activeTab === tab ? '#4A5740' : 'transparent', color: activeTab === tab ? '#4A5740' : '#B0ADA7' }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-5 pb-8">
        {activeTab === 'Productos'   && <ProductsTab />}
        {activeTab === 'Huella CO₂' && <CarbonTab />}
        {activeTab === 'Agrupación'  && <GroupingTab />}
      </div>
    </div>
  )
}
