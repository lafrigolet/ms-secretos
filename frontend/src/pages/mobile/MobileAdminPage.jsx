import { useState, useMemo } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { profileApi, promotionsApi, returnsApi, notifApi } from '../../api/index.js'
import { Spinner } from '../../components/Spinner.jsx'

const TABS = ['Clientes', 'Promociones', 'Devoluciones', 'Notificar']
const card = { background: '#FDFCFA', boxShadow: '0 2px 16px rgba(44,44,40,0.06)' }

const PROFILE_STYLE = {
  STANDARD: { bg: '#F4EDE4', color: '#8C6E52', label: 'Estándar' },
  PREMIUM:  { bg: '#EEF4EA', color: '#4A7054', label: 'Premium'  },
  VIP:      { bg: '#F7F3E8', color: '#B8963C', label: 'VIP'      },
  ADMIN:    { bg: '#EEF4EA', color: '#4A7054', label: 'Admin'     },
}

function ProfileTag ({ profile }) {
  const s = PROFILE_STYLE[profile] ?? PROFILE_STYLE.STANDARD
  return (
    <span className="text-[10px] font-medium px-2.5 py-1 "
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function PrimaryBtn ({ children, onClick, disabled, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={` text-sm font-medium text-off-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.97] transition-all ${className}`}
      style={{ background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', boxShadow: '0 4px 14px rgba(74,87,64,0.25)' }}
    >
      {children}
    </button>
  )
}

function SecondaryBtn ({ children, onClick, disabled, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={` text-sm font-medium text-charcoal active:scale-[0.97] transition-all ${className}`}
      style={{ background: '#F2EFE9', boxShadow: '0 1px 6px rgba(44,44,40,0.08)' }}
    >
      {children}
    </button>
  )
}

function TabBar ({ active, onChange }) {
  return (
    <div className="overflow-x-auto scrollbar-none px-4" style={{ borderBottom: '1px solid rgba(226,221,214,0.6)' }}>
      <div className="flex gap-1" style={{ minWidth: 'max-content' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => onChange(tab)}
            className="px-4 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
            style={{ borderColor: active === tab ? '#4A5740' : 'transparent', color: active === tab ? '#4A5740' : '#B0ADA7' }}>
            {tab}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Customer detail sheet ───────────────────────────────────────
function CustomerSheet ({ customer, onClose, onRefresh }) {
  const [profile, setProfile]           = useState(customer.profile)
  const [blockReason, setBlockReason]   = useState('')
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [saving, setSaving]             = useState(false)

  async function handleSaveProfile () {
    setSaving(true)
    try { await profileApi.updateProfile(customer.sapCode, profile); onRefresh(); onClose() }
    catch { alert('Error al actualizar el perfil') }
    finally { setSaving(false) }
  }

  async function handleBlock () {
    setSaving(true)
    try { await profileApi.updateStatus(customer.sapCode, 'BLOCKED', blockReason); onRefresh(); onClose() }
    catch { alert('Error al bloquear') }
    finally { setSaving(false) }
  }

  async function handleActivate () {
    setSaving(true)
    try { await profileApi.updateStatus(customer.sapCode, 'ACTIVE'); onRefresh(); onClose() }
    catch { alert('Error al activar') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}
      style={{ background: 'rgba(44,44,40,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="mt-10 bg-[#FDFCFA] flex-1 overflow-y-auto"
        style={{ boxShadow: '0 -8px 40px rgba(44,44,40,0.18)' }}
        onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="w-9 h-1 bg-border  mx-auto mb-5" />

          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-serif text-2xl font-light text-charcoal">{customer.name}</h3>
              <p className="text-sm text-muted">{customer.businessName}</p>
            </div>
            <span className="text-xs font-medium px-2.5 py-1.5 "
              style={customer.status === 'ACTIVE'
                ? { background: 'rgba(74,112,84,0.10)', color: '#4A7054' }
                : { background: 'rgba(139,58,47,0.10)', color: '#8B3A2F' }
              }>
              {customer.status === 'ACTIVE' ? '✓ Activa' : '⊘ Bloqueada'}
            </span>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            {[['SAP', customer.sapCode], ['Email', customer.email], ['Ciudad', customer.city ?? '—'], ['Perfil', customer.profile]].map(([l, v]) => (
              <div key={l} className=" px-3.5 py-3" style={{ background: '#F2EFE9' }}>
                <p className="m-label mb-0.5">{l}</p>
                <p className="text-xs font-medium text-charcoal truncate">{v}</p>
              </div>
            ))}
          </div>

          {customer.role !== 'ADMIN' && (
            <>
              <p className="m-label mb-3">Cambiar perfil</p>
              <div className="flex gap-2 mb-4">
                {['STANDARD', 'PREMIUM', 'VIP'].map(p => (
                  <button key={p} onClick={() => setProfile(p)}
                    className="flex-1 py-3  text-xs font-medium transition-all active:scale-[0.97]"
                    style={profile === p
                      ? { background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', color: '#FDFCFA', boxShadow: '0 3px 10px rgba(74,87,64,0.25)' }
                      : { background: '#F2EFE9', color: '#8A8880' }
                    }>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              {profile !== customer.profile && (
                <PrimaryBtn onClick={handleSaveProfile} disabled={saving} className="w-full py-3.5 mb-4">
                  {saving ? <><Spinner size="sm" />Guardando…</> : 'Guardar perfil'}
                </PrimaryBtn>
              )}

              {customer.status === 'ACTIVE' ? (
                showBlockForm ? (
                  <div className=" p-4" style={{ background: 'rgba(139,58,47,0.07)' }}>
                    <p className="text-sm text-error font-medium mb-2.5">Motivo del bloqueo</p>
                    <input type="text"
                      className="w-full  px-4 py-3 text-sm outline-none mb-3"
                      style={{ background: '#FDFCFA' }}
                      placeholder="Ej: Deuda pendiente"
                      value={blockReason} onChange={e => setBlockReason(e.target.value)} />
                    <div className="flex gap-2">
                      <SecondaryBtn className="flex-1 py-3" onClick={() => setShowBlockForm(false)}>Cancelar</SecondaryBtn>
                      <button onClick={handleBlock} disabled={saving}
                        className="flex-1 py-3  text-xs font-medium text-white flex items-center justify-center gap-1 active:scale-[0.97]"
                        style={{ background: '#8B3A2F' }}>
                        {saving ? <Spinner size="sm" /> : '⊘ Bloquear'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="w-full py-3.5  text-sm text-error font-medium active:scale-[0.97] transition-all"
                    style={{ background: 'rgba(139,58,47,0.07)' }}
                    onClick={() => setShowBlockForm(true)}>
                    ⊘ Bloquear esta cuenta
                  </button>
                )
              ) : (
                <PrimaryBtn onClick={handleActivate} disabled={saving} className="w-full py-3.5">
                  {saving ? <><Spinner size="sm" />Activando…</> : '✓ Activar esta cuenta'}
                </PrimaryBtn>
              )}
            </>
          )}

          <button className="w-full mt-5 text-sm text-muted text-center py-2" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ── Customers tab ───────────────────────────────────────────────
function CustomersTab () {
  const [search, setSearch]           = useState('')
  const [filterProfile, setFilterProfile] = useState('')
  const [selected, setSelected]       = useState(null)

  const { data: allProfiles, refetch } = useAsync(() => profileApi.getAll(), [])

  const filtered = useMemo(() => {
    if (!allProfiles) return []
    return allProfiles.filter(c => {
      if (filterProfile && c.profile !== filterProfile) return false
      if (search) {
        const q = search.toLowerCase()
        return c.sapCode?.toLowerCase().includes(q) ||
          c.name?.toLowerCase().includes(q) ||
          c.businessName?.toLowerCase().includes(q)
      }
      return true
    })
  }, [allProfiles, search, filterProfile])

  return (
    <div>
      {/* Search */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 mb-3"
        style={{ background: '#FDFCFA', boxShadow: '0 2px 12px rgba(44,44,40,0.06)' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B0ADA7" strokeWidth="2.2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" placeholder="Buscar clientes…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none text-charcoal placeholder:text-muted/60" />
        {search && <button onClick={() => setSearch('')} className="text-muted/50 text-lg">×</button>}
      </div>

      {/* Profile filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none">
        {[['', 'Todos'], ['STANDARD', 'Estándar'], ['PREMIUM', 'Premium'], ['VIP', 'VIP']].map(([val, label]) => (
          <button key={val} onClick={() => setFilterProfile(val)}
            className="px-3.5 py-2  text-xs whitespace-nowrap transition-all"
            style={filterProfile === val
              ? { background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', color: '#FDFCFA', boxShadow: '0 3px 10px rgba(74,87,64,0.25)' }
              : { background: '#FDFCFA', color: '#8A8880', boxShadow: '0 1px 4px rgba(44,44,40,0.06)' }
            }>
            {label}
          </button>
        ))}
      </div>

      {!allProfiles && <div className="flex justify-center py-8"><Spinner /></div>}

      <div className="flex flex-col gap-2.5">
        {filtered.map(customer => (
          <button key={customer.sapCode} onClick={() => setSelected(customer)}
            className="w-full text-left p-4 active:scale-[0.98] transition-transform"
            style={card}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-charcoal">{customer.name}</p>
              <div className="flex items-center gap-2">
                <ProfileTag profile={customer.profile} />
                <span className="w-2 h-2 "
                  style={{ background: customer.status === 'ACTIVE' ? '#4A7054' : '#8B3A2F' }} />
              </div>
            </div>
            <p className="text-xs text-muted">{customer.businessName} · {customer.sapCode}</p>
          </button>
        ))}
      </div>

      {selected && (
        <CustomerSheet
          customer={selected}
          onClose={() => setSelected(null)}
          onRefresh={refetch}
        />
      )}
    </div>
  )
}

// ── Promotions tab ──────────────────────────────────────────────
function PromotionsTab () {
  const { data: promos, loading, refetch } = useAsync(() => promotionsApi.getActive(), [])
  const [creating, setCreating] = useState(false)

  async function handleDeactivate (id) {
    if (!confirm('¿Desactivar esta promoción?')) return
    try { await promotionsApi.deactivate(id); refetch() }
    catch { alert('Error al desactivar') }
  }

  return (
    <div>
      <PrimaryBtn onClick={() => setCreating(true)} className="w-full py-4 mb-5">
        + Nueva promoción
      </PrimaryBtn>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      <div className="flex flex-col gap-3">
        {promos?.map(promo => (
          <div key={promo.id} className="p-4" style={card}>
            <div className="flex items-start justify-between mb-2.5">
              <h3 className="font-serif text-base text-charcoal font-normal">{promo.name}</h3>
              <span className="text-[10px] font-medium px-2.5 py-1 "
                style={promo.active
                  ? { background: 'rgba(74,112,84,0.10)', color: '#4A7054' }
                  : { background: '#F2EFE9', color: '#8A8880' }
                }>
                {promo.active ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {promo.profiles?.map(p => <ProfileTag key={p} profile={p} />)}
              {promo.condition?.minOrderTotal > 0 && (
                <span className="text-[10px] px-2.5 py-1 "
                  style={{ background: '#F2EFE9', color: '#8A8880' }}>
                  Min. {promo.condition.minOrderTotal}€
                </span>
              )}
            </div>
            {promo.active && (
              <button onClick={() => handleDeactivate(promo.id)}
                className="text-xs text-muted underline underline-offset-2">
                Desactivar
              </button>
            )}
          </div>
        ))}
      </div>

      {creating && (
        <NewPromoSheet onClose={() => setCreating(false)} onSave={() => { refetch(); setCreating(false) }} />
      )}
    </div>
  )
}

function NewPromoSheet ({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', type: 'GIFT', profiles: ['PREMIUM', 'VIP'],
    condition: { minOrderTotal: 0 }, benefit: { type: 'GIFT', description: '' }
  })
  const [saving, setSaving] = useState(false)

  function toggleProfile (p) {
    setForm(f => ({ ...f, profiles: f.profiles.includes(p) ? f.profiles.filter(x => x !== p) : [...f.profiles, p] }))
  }

  async function handleSave () {
    if (!form.name.trim()) return
    setSaving(true)
    try { await promotionsApi.create(form); onSave() }
    catch { alert('Error al crear') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}
      style={{ background: 'rgba(44,44,40,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="mt-10 bg-[#FDFCFA] flex-1 overflow-y-auto"
        style={{ boxShadow: '0 -8px 40px rgba(44,44,40,0.18)' }}
        onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="w-9 h-1 bg-border  mx-auto mb-5" />
          <h3 className="font-serif text-2xl font-light text-charcoal mb-5">Nueva promoción</h3>

          {[
            { label: 'Nombre', key: 'name', placeholder: 'Ej: Promo Primavera', type: 'text' },
          ].map(f => (
            <div key={f.key} className="mb-4">
              <label className="m-label mb-2 block">{f.label}</label>
              <input type={f.type}
                className="w-full  px-5 py-4 text-sm outline-none"
                style={{ background: '#F2EFE9' }}
                placeholder={f.placeholder}
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
          ))}

          <div className="mb-4">
            <label className="m-label mb-2 block">Tipo</label>
            <div className="flex gap-2">
              {['GIFT', 'DISCOUNT'].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                  className="flex-1 py-3  text-sm transition-all active:scale-[0.97]"
                  style={form.type === t
                    ? { background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', color: '#FDFCFA', boxShadow: '0 3px 10px rgba(74,87,64,0.25)' }
                    : { background: '#F2EFE9', color: '#8A8880' }
                  }>
                  {t === 'GIFT' ? '🎁 Regalo' : '🏷️ Descuento'}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="m-label mb-2 block">Perfiles</label>
            <div className="flex gap-2">
              {['STANDARD', 'PREMIUM', 'VIP'].map(p => (
                <button key={p} onClick={() => toggleProfile(p)}
                  className="flex-1 py-3  text-xs transition-all active:scale-[0.97]"
                  style={form.profiles.includes(p)
                    ? { background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', color: '#FDFCFA', boxShadow: '0 3px 10px rgba(74,87,64,0.25)' }
                    : { background: '#F2EFE9', color: '#8A8880' }
                  }>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="m-label mb-2 block">Importe mínimo (€)</label>
            <input type="number"
              className="w-full  px-5 py-4 text-sm outline-none"
              style={{ background: '#F2EFE9' }}
              placeholder="0 = sin mínimo"
              value={form.condition.minOrderTotal}
              onChange={e => setForm(f => ({ ...f, condition: { minOrderTotal: Number(e.target.value) } }))} />
          </div>

          <div className="mb-6">
            <label className="m-label mb-2 block">Descripción del beneficio</label>
            <input type="text"
              className="w-full  px-5 py-4 text-sm outline-none"
              style={{ background: '#F2EFE9' }}
              placeholder="Ej: Muestra Sérum 15ml"
              value={form.benefit.description}
              onChange={e => setForm(f => ({ ...f, benefit: { ...f.benefit, description: e.target.value } }))} />
          </div>

          <div className="flex gap-3">
            <SecondaryBtn className="flex-1 py-3.5" onClick={onClose} disabled={saving}>Cancelar</SecondaryBtn>
            <PrimaryBtn className="flex-1 py-3.5" onClick={handleSave}
              disabled={saving || !form.name.trim()}>
              {saving ? <><Spinner size="sm" />Creando…</> : 'Crear'}
            </PrimaryBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Returns admin tab ───────────────────────────────────────────
function ReturnsAdminTab () {
  const { data: returns, loading, refetch } = useAsync(() => returnsApi.getAll(), [])
  const [processing, setProcessing] = useState(null)

  async function handleApprove (ret) {
    setProcessing(ret.id)
    try { await returnsApi.processReturn(ret.id, 'APPROVED', 'Aprobado'); refetch() }
    catch { alert('Error') }
    finally { setProcessing(null) }
  }

  async function handleReject (ret) {
    const notes = prompt('Motivo del rechazo:')
    if (!notes) return
    setProcessing(ret.id)
    try { await returnsApi.processReturn(ret.id, 'REJECTED', notes); refetch() }
    catch { alert('Error') }
    finally { setProcessing(null) }
  }

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div className="flex flex-col gap-3">
      {returns?.length === 0 && (
        <div className="flex flex-col items-center text-center py-12">
          <div className="w-20 h-20  flex items-center justify-center text-4xl mb-4"
            style={{ background: 'linear-gradient(135deg,#C8D4BE,#DFE9D9)' }}>📋</div>
          <p className="font-serif text-xl font-light text-charcoal mb-1">Sin devoluciones pendientes</p>
        </div>
      )}
      {returns?.map(ret => (
        <div key={ret.id} className="p-4" style={card}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-charcoal">{ret.id}</p>
              <p className="text-xs text-muted">Cliente: {ret.customerId}</p>
            </div>
            <span className="text-[10px] font-medium px-2.5 py-1 "
              style={ret.status === 'PENDING'
                ? { background: 'rgba(184,150,60,0.12)', color: '#8C6E52' }
                : ret.status === 'APPROVED'
                ? { background: 'rgba(74,112,84,0.10)', color: '#4A7054' }
                : { background: 'rgba(139,58,47,0.10)', color: '#8B3A2F' }
              }>
              {ret.status}
            </span>
          </div>
          <p className="text-xs text-muted mb-1">Pedido {ret.orderId} · {new Date(ret.createdAt).toLocaleDateString('es-ES')}</p>
          {ret.notes && <p className="text-xs text-muted italic mb-3 leading-relaxed">"{ret.notes}"</p>}
          {ret.status === 'PENDING' && (
            <div className="flex gap-2">
              <SecondaryBtn className="flex-1 py-3 text-sm" onClick={() => handleReject(ret)}
                disabled={processing === ret.id}>
                Rechazar
              </SecondaryBtn>
              <PrimaryBtn className="flex-1 py-3" onClick={() => handleApprove(ret)}
                disabled={processing === ret.id}>
                {processing === ret.id ? <Spinner size="sm" /> : '✓ Aprobar'}
              </PrimaryBtn>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Broadcast tab ───────────────────────────────────────────────
function BroadcastTab () {
  const [title, setTitle] = useState('')
  const [body, setBody]   = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend (e) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSending(true)
    try { await notifApi.broadcast(title, body); setTitle(''); setBody(''); alert('Notificación enviada') }
    catch { alert('Error al enviar') }
    finally { setSending(false) }
  }

  return (
    <form onSubmit={handleSend}>
      <p className="text-sm text-muted mb-5 leading-relaxed">
        Envía un comunicado a todos los clientes de la plataforma.
      </p>

      <div className="mb-4">
        <label className="m-label mb-2 block">Título</label>
        <input type="text"
          className="w-full  px-5 py-4 text-sm outline-none"
          style={{ background: '#F2EFE9' }}
          placeholder="Ej: Nueva colección disponible"
          value={title} onChange={e => setTitle(e.target.value)} />
      </div>

      <div className="mb-6">
        <label className="m-label mb-2 block">Mensaje</label>
        <textarea
          className="w-full  px-5 py-4 text-sm outline-none resize-none"
          style={{ background: '#F2EFE9' }}
          rows={4}
          placeholder="Escribe el mensaje para todos los clientes…"
          value={body} onChange={e => setBody(e.target.value)}
          maxLength={500} />
        <p className="text-xs text-muted text-right mt-1.5">{body.length}/500</p>
      </div>

      <PrimaryBtn className="w-full py-4" disabled={sending || !title.trim() || !body.trim()}>
        {sending ? <><Spinner size="sm" />Enviando…</> : '📢 Enviar a todos los clientes'}
      </PrimaryBtn>
    </form>
  )
}

// ── MobileAdminPage ─────────────────────────────────────────────
export function MobileAdminPage () {
  const [activeTab, setActiveTab] = useState('Clientes')

  return (
    <div>
      <div className="px-4 pt-5 mb-4">
        <h1 className="font-serif text-[34px] font-light text-charcoal leading-none mb-1">Administración</h1>
        <p className="text-sm text-muted">Clientes, promociones y comunicados</p>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />

      <div className="px-4 pt-5 pb-8">
        {activeTab === 'Clientes'     && <CustomersTab />}
        {activeTab === 'Promociones'  && <PromotionsTab />}
        {activeTab === 'Devoluciones' && <ReturnsAdminTab />}
        {activeTab === 'Notificar'    && <BroadcastTab />}
      </div>
    </div>
  )
}
