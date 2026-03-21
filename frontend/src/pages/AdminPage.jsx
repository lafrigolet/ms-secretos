import { useState } from 'react'
import { useAsync } from '../hooks/useAsync.js'
import { profileApi, promotionsApi, returnsApi } from '../api/index.js'
import { Spinner } from '../components/Spinner.jsx'

// ── Componentes auxiliares ────────────────────────────────────────

function StatCard ({ label, value, change, up }) {
  return (
    <div className="card">
      <p className="text-[11px] uppercase tracking-widest text-muted mb-2">{label}</p>
      <p className="font-serif text-[40px] font-light text-charcoal leading-none mb-1">{value}</p>
      <p className={`text-xs ${up ? 'text-success' : 'text-error'}`}>{change}</p>
    </div>
  )
}

const PROFILE_TAG = {
  STANDARD: { bg: 'bg-[#F4EDE4]', text: 'text-earth',    label: 'Estándar' },
  PREMIUM:  { bg: 'bg-[#EEF4EA]', text: 'text-sage-dark', label: 'Premium' },
  VIP:      { bg: 'bg-[#F7F3E8]', text: 'text-gold',      label: 'VIP' },
  ADMIN:    { bg: 'bg-[#EEF4EA]', text: 'text-sage-dark', label: 'Admin' },
}

function ProfileTag ({ profile }) {
  const cfg = PROFILE_TAG[profile] ?? PROFILE_TAG.STANDARD
  return (
    <span className={`tag ${cfg.bg} ${cfg.text} text-[10px]`}>{cfg.label}</span>
  )
}

// ── Modal: cambiar perfil ─────────────────────────────────────────
function ChangeProfileModal ({ customer, onClose, onSave }) {
  const [profile, setProfile] = useState(customer.profile)
  const [saving, setSaving]   = useState(false)

  async function handleSave () {
    setSaving(true)
    try {
      await profileApi.updateProfile(customer.sapCode, profile)
      onSave()
      onClose()
    } catch {
      alert('Error al actualizar el perfil')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-charcoal/40 flex items-center justify-center z-50">
      <div className="bg-off-white rounded-2xl p-8 w-[400px] border border-border shadow-xl">
        <h3 className="font-serif text-2xl font-light mb-1">{customer.name}</h3>
        <p className="text-muted text-sm mb-6">{customer.businessName} · {customer.sapCode}</p>

        <p className="form-label">Nuevo perfil</p>
        <div className="flex gap-2 mb-6">
          {['STANDARD', 'PREMIUM', 'VIP'].map(p => (
            <button
              key={p}
              onClick={() => setProfile(p)}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                profile === p
                  ? 'bg-sage-dark text-off-white border-sage-dark'
                  : 'bg-cream text-muted border-border hover:border-sage'
              }`}
            >
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            onClick={handleSave}
            disabled={saving || profile === customer.profile}
          >
            {saving ? <><Spinner size="sm" /> Guardando…</> : 'Guardar cambio'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: nueva promoción ────────────────────────────────────────
function NewPromoModal ({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', type: 'GIFT', description: '',
    profiles: ['PREMIUM', 'VIP'],
    condition: { minOrderTotal: 0 },
    benefit: { type: 'GIFT', description: '' }
  })
  const [saving, setSaving] = useState(false)

  function toggleProfile (p) {
    setForm(f => ({
      ...f,
      profiles: f.profiles.includes(p)
        ? f.profiles.filter(x => x !== p)
        : [...f.profiles, p]
    }))
  }

  async function handleSave () {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await promotionsApi.create(form)
      onSave()
      onClose()
    } catch {
      alert('Error al crear la promoción')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-charcoal/40 flex items-center justify-center z-50">
      <div className="bg-off-white rounded-2xl p-8 w-[480px] border border-border shadow-xl">
        <h3 className="font-serif text-2xl font-light mb-6">Nueva promoción</h3>

        <div className="mb-4">
          <label className="form-label">Nombre</label>
          <input
            type="text"
            className="form-input"
            placeholder="Ej: Promo Primavera — Ritual Timeless"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div className="mb-4">
          <label className="form-label">Tipo</label>
          <div className="flex gap-2">
            {['GIFT', 'DISCOUNT'].map(t => (
              <button key={t}
                onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`flex-1 py-2 rounded-lg border text-sm transition-all ${
                  form.type === t
                    ? 'bg-sage-dark text-off-white border-sage-dark'
                    : 'bg-cream text-muted border-border hover:border-sage'
                }`}
              >
                {t === 'GIFT' ? '🎁 Regalo' : '🏷️ Descuento'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="form-label">Perfiles</label>
          <div className="flex gap-2">
            {['STANDARD', 'PREMIUM', 'VIP'].map(p => (
              <button key={p}
                onClick={() => toggleProfile(p)}
                className={`flex-1 py-2 rounded-lg border text-sm transition-all ${
                  form.profiles.includes(p)
                    ? 'bg-sage-dark text-off-white border-sage-dark'
                    : 'bg-cream text-muted border-border hover:border-sage'
                }`}
              >
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="form-label">Importe mínimo del pedido (€)</label>
          <input
            type="number"
            className="form-input"
            placeholder="0 = sin mínimo"
            value={form.condition.minOrderTotal}
            onChange={e => setForm(f => ({ ...f, condition: { minOrderTotal: Number(e.target.value) } }))}
          />
        </div>

        <div className="mb-6">
          <label className="form-label">Descripción del beneficio</label>
          <input
            type="text"
            className="form-input"
            placeholder="Ej: Muestra Sérum Raíces 15ml"
            value={form.benefit.description}
            onChange={e => setForm(f => ({ ...f, benefit: { ...f.benefit, description: e.target.value } }))}
          />
        </div>

        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
          >
            {saving ? <><Spinner size="sm" />Guardando…</> : 'Crear promoción'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AdminPage principal ───────────────────────────────────────────
export function AdminPage () {
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [showNewPromo, setShowNewPromo]       = useState(false)

  // HU-06 — datos del panel
  const { data: profiles, refetch: refetchProfiles } = useAsync(
    () => profileApi.getAll(), []
  )

  // HU-11 — todas las promociones incluyendo inactivas
  const { data: promotions, refetch: refetchPromos } = useAsync(
    () => promotionsApi.getAll(), []
  )

  // HU-34 — devoluciones pendientes
  const { data: pendingReturns, refetch: refetchReturns } = useAsync(
    () => returnsApi.getAllReturns('PENDING'), []
  )

  async function handleUpdateReturn (id, status, adminNotes) {
    await returnsApi.updateReturn(id, status, adminNotes)
    refetchReturns()
  }
  const activeCount  = profiles?.filter(p => p.status === 'ACTIVE').length ?? 0
  const blockedCount = profiles?.filter(p => p.status === 'BLOCKED').length ?? 0

  // HU-11 — activar/desactivar promoción
  async function handleTogglePromo (id) {
    await promotionsApi.toggle(id)
    refetchPromos()
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="page-title">Panel de Administración</h1>
          <span className="tag bg-[#EEF4EA] text-sage-dark text-xs">⚙ Modo Administrador</span>
        </div>
        <p className="page-subtitle">Gestión de clientes, perfiles y promociones · SAP conectado</p>
      </div>

      {/* HU-22 — Estadísticas */}
      <div className="grid grid-cols-4 gap-5 mb-10">
        <StatCard
          label="Clientes activos"
          value={activeCount || '—'}
          change="↑ Clientes con acceso al portal"
          up
        />
        <StatCard
          label="Promociones activas"
          value={promotions?.filter(p => p.active).length ?? '—'}
          change="↑ Visible para clientes ahora mismo"
          up
        />
        <StatCard
          label="Cuentas bloqueadas"
          value={blockedCount || 0}
          change={blockedCount > 0 ? '↑ Requieren atención' : '✓ Sin bloqueos activos'}
          up={blockedCount === 0}
        />
        <StatCard
          label="Devoluciones pendientes"
          value={pendingReturns?.length ?? '—'}
          change={pendingReturns?.length > 0 ? '↑ Pendientes de revisión' : '✓ Sin pendientes'}
          up={!pendingReturns?.length}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* HU-05 — Gestión de perfiles de cliente */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <p className="section-label mb-0">Clientes</p>
          </div>

          {!profiles && (
            <div className="flex justify-center py-8"><Spinner /></div>
          )}

          {profiles?.map(customer => (
            <div key={customer.sapCode}
              className="flex items-center gap-3 py-3 border-b border-border last:border-0"
            >
              {/* Dot de estado */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                customer.status === 'ACTIVE' ? 'bg-sage' : 'bg-error'
              }`} />

              {/* Nombre */}
              <div className="flex-1 min-w-0">
                <span className="text-sm text-charcoal">{customer.name}</span>
                {customer.businessName && (
                  <span className="text-xs text-muted ml-1.5">· {customer.businessName}</span>
                )}
              </div>

              {/* Código */}
              <span className="text-xs text-muted">{customer.sapCode}</span>

              {/* Perfil + acción */}
              {customer.status === 'BLOCKED' ? (
                <span className="tag bg-[#FDF0EE] text-error text-[10px]">Bloqueada</span>
              ) : (
                <>
                  <ProfileTag profile={customer.profile} />
                  {customer.role !== 'ADMIN' && (
                    <button
                      onClick={() => setEditingCustomer(customer)}
                      className="text-xs text-muted hover:text-sage-dark transition-colors border-0 bg-transparent cursor-pointer underline underline-offset-2"
                    >
                      Cambiar
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* HU-11 — Gestión de promociones */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <p className="section-label mb-0">Promociones</p>
            <button
              className="bg-sage-dark text-off-white rounded-lg px-3.5 py-1.5 text-xs font-medium hover:bg-sage transition-colors border-0 cursor-pointer"
              onClick={() => setShowNewPromo(true)}
            >
              + Nueva
            </button>
          </div>

          {!promotions && (
            <div className="flex justify-center py-8"><Spinner /></div>
          )}

          {promotions?.map(promo => (
            <div key={promo.id}
              className="flex items-center gap-3 py-3 border-b border-border last:border-0"
            >
              {/* Indicador activo */}
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                promo.active ? 'bg-success' : 'bg-border'
              }`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${!promo.active ? 'text-muted' : 'text-charcoal'}`}>
                  {promo.name}
                </p>
                <p className="text-xs text-muted truncate">
                  {promo.description} · {promo.profiles?.join(', ')}
                </p>
              </div>

              {/* Acciones */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleTogglePromo(promo.id)}
                  title={promo.active ? 'Desactivar' : 'Activar'}
                  className="w-7 h-7 rounded-md border border-border bg-off-white text-xs text-muted hover:border-sage hover:text-sage-dark transition-colors cursor-pointer flex items-center justify-center"
                >
                  {promo.active ? '⏸' : '▶'}
                </button>
              </div>
            </div>
          ))}

          {/* Sincronización SAP */}
          <hr className="border-border my-5" />
          <p className="section-label mb-3">Sincronización SAP</p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Modo stub activo · datos locales</p>
            <button className="btn-secondary text-xs py-1.5 px-3">
              Sincronizar
            </button>
          </div>
        </div>
      </div>

      {/* HU-34 — Devoluciones pendientes */}
      {pendingReturns?.length > 0 && (
        <div className="card mt-6">
          <p className="section-label mb-5">Devoluciones pendientes de revisión</p>
          <div className="space-y-3">
            {pendingReturns.map(ret => (
              <div key={ret.id} className="flex items-start gap-4 p-4 bg-cream rounded-xl">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{ret.id}</p>
                    <span className="tag bg-[#F7F3E8] text-gold text-[10px]">Pendiente</span>
                  </div>
                  <p className="text-xs text-muted mb-1">
                    {ret.sapCode} · Pedido {ret.orderId}
                  </p>
                  <p className="text-xs text-charcoal">
                    {ret.reasonLabel}
                    {ret.notes && <span className="text-muted"> — "{ret.notes}"</span>}
                  </p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {ret.items?.map((item, i) => (
                      <span key={i} className="tag bg-border/30 text-muted text-[10px]">
                        {item.name} ×{item.quantity}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleUpdateReturn(ret.id, 'REVIEWING')}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border bg-off-white text-muted hover:border-sage hover:text-sage-dark transition-colors cursor-pointer"
                  >
                    Revisar
                  </button>
                  <button
                    onClick={() => handleUpdateReturn(ret.id, 'APPROVED', 'Aprobada por administrador')}
                    className="text-xs px-3 py-1.5 rounded-lg bg-sage-dark text-off-white hover:bg-sage transition-colors cursor-pointer border-0"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => handleUpdateReturn(ret.id, 'REJECTED', 'No cumple condiciones')}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[#E8C5BF] bg-[#FDF0EE] text-error hover:bg-[#f5e0dc] transition-colors cursor-pointer"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modales */}
      {editingCustomer && (
        <ChangeProfileModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSave={refetchProfiles}
        />
      )}

      {showNewPromo && (
        <NewPromoModal
          onClose={() => setShowNewPromo(false)}
          onSave={refetchPromos}
        />
      )}
    </div>
  )
}
