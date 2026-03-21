import { useState, useMemo } from 'react'
import { useAsync } from '../hooks/useAsync.js'
import { profileApi, promotionsApi, returnsApi, contentApi, commercialApi } from '../api/index.js'
import { Spinner } from '../components/Spinner.jsx'

// ── Helpers ───────────────────────────────────────────────────────

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
  return <span className={`tag ${cfg.bg} ${cfg.text} text-[10px]`}>{cfg.label}</span>
}

// ── Modal: cambiar perfil ─────────────────────────────────────────
function ChangeProfileModal ({ customer, onClose, onSave }) {
  const [profile, setProfile] = useState(customer.profile)
  const [saving, setSaving]   = useState(false)

  async function handleSave () {
    setSaving(true)
    try { await profileApi.updateProfile(customer.sapCode, profile); onSave(); onClose() }
    catch { alert('Error al actualizar el perfil') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-charcoal/40 flex items-center justify-center z-50">
      <div className="bg-off-white rounded-2xl p-8 w-[400px] border border-border shadow-xl">
        <h3 className="font-serif text-2xl font-light mb-1">{customer.name}</h3>
        <p className="text-muted text-sm mb-6">{customer.businessName} · {customer.sapCode}</p>
        <p className="form-label">Nuevo perfil</p>
        <div className="flex gap-2 mb-6">
          {['STANDARD', 'PREMIUM', 'VIP'].map(p => (
            <button key={p} onClick={() => setProfile(p)}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                profile === p ? 'bg-sage-dark text-off-white border-sage-dark' : 'bg-cream text-muted border-border hover:border-sage'
              }`}
            >{p.charAt(0) + p.slice(1).toLowerCase()}</button>
          ))}
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={handleSave}
            disabled={saving || profile === customer.profile}>
            {saving ? <><Spinner size="sm" />Guardando…</> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: nueva promoción ────────────────────────────────────────
function NewPromoModal ({ onClose, onSave }) {
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
    try { await promotionsApi.create(form); onSave(); onClose() }
    catch { alert('Error al crear la promoción') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-charcoal/40 flex items-center justify-center z-50">
      <div className="bg-off-white rounded-2xl p-8 w-[480px] border border-border shadow-xl">
        <h3 className="font-serif text-2xl font-light mb-6">Nueva promoción</h3>
        <div className="mb-4">
          <label className="form-label">Nombre</label>
          <input type="text" className="form-input" placeholder="Ej: Promo Primavera — Ritual Timeless"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="mb-4">
          <label className="form-label">Tipo</label>
          <div className="flex gap-2">
            {['GIFT', 'DISCOUNT'].map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`flex-1 py-2 rounded-lg border text-sm transition-all ${
                  form.type === t ? 'bg-sage-dark text-off-white border-sage-dark' : 'bg-cream text-muted border-border hover:border-sage'
                }`}>{t === 'GIFT' ? '🎁 Regalo' : '🏷️ Descuento'}</button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="form-label">Perfiles</label>
          <div className="flex gap-2">
            {['STANDARD', 'PREMIUM', 'VIP'].map(p => (
              <button key={p} onClick={() => toggleProfile(p)}
                className={`flex-1 py-2 rounded-lg border text-sm transition-all ${
                  form.profiles.includes(p) ? 'bg-sage-dark text-off-white border-sage-dark' : 'bg-cream text-muted border-border hover:border-sage'
                }`}>{p.charAt(0) + p.slice(1).toLowerCase()}</button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="form-label">Importe mínimo (€)</label>
          <input type="number" className="form-input" placeholder="0 = sin mínimo"
            value={form.condition.minOrderTotal}
            onChange={e => setForm(f => ({ ...f, condition: { minOrderTotal: Number(e.target.value) } }))} />
        </div>
        <div className="mb-6">
          <label className="form-label">Descripción del beneficio</label>
          <input type="text" className="form-input" placeholder="Ej: Muestra Sérum Raíces 15ml"
            value={form.benefit.description}
            onChange={e => setForm(f => ({ ...f, benefit: { ...f.benefit, description: e.target.value } }))} />
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={handleSave}
            disabled={saving || !form.name.trim()}>
            {saving ? <><Spinner size="sm" />Guardando…</> : 'Crear promoción'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: ficha completa del cliente (HU-27) ─────────────────────
function CustomerDetailModal ({ customer, onClose, onStatusChange }) {
  const [blocking, setBlocking] = useState(false)
  const [blockReason, setBlockReason] = useState('')
  const [showBlockForm, setShowBlockForm] = useState(false)

  async function handleBlock () {
    setBlocking(true)
    try {
      await profileApi.updateStatus(customer.sapCode, 'BLOCKED', blockReason)
      onStatusChange()
      onClose()
    } catch { alert('Error al bloquear la cuenta') }
    finally { setBlocking(false) }
  }

  async function handleActivate () {
    setBlocking(true)
    try {
      await profileApi.updateStatus(customer.sapCode, 'ACTIVE')
      onStatusChange()
      onClose()
    } catch { alert('Error al activar la cuenta') }
    finally { setBlocking(false) }
  }

  return (
    <div className="fixed inset-0 bg-charcoal/40 flex items-center justify-center z-50 p-4">
      <div className="bg-off-white rounded-2xl p-8 w-[560px] border border-border shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="font-serif text-2xl font-light">{customer.name}</h3>
            <p className="text-muted text-sm">{customer.businessName}</p>
          </div>
          <span className={`tag text-xs ${customer.status === 'ACTIVE' ? 'bg-[#EEF4EA] text-success' : 'bg-[#FDF0EE] text-error'}`}>
            {customer.status === 'ACTIVE' ? '✓ Activa' : '⊘ Bloqueada'}
          </span>
        </div>

        {/* Datos de contacto */}
        <p className="section-label">Datos de contacto</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            ['Código SAP', customer.sapCode],
            ['Email', customer.email],
            ['Teléfono', customer.phone ?? '—'],
            ['Ciudad', customer.city ?? '—'],
            ['Código postal', customer.postalCode ?? '—'],
            ['Perfil', customer.profile],
          ].map(([label, value]) => (
            <div key={label} className="bg-cream rounded-lg px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">{label}</p>
              <p className="text-sm font-medium text-charcoal">{value}</p>
            </div>
          ))}
        </div>

        {/* Actividad */}
        <p className="section-label">Actividad</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-cream rounded-lg px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Cliente desde</p>
            <p className="text-sm font-medium">{customer.joinedAt ? new Date(customer.joinedAt).toLocaleDateString('es-ES') : '—'}</p>
          </div>
          <div className="bg-cream rounded-lg px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Último pedido</p>
            <p className="text-sm font-medium">{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString('es-ES') : 'Sin pedidos'}</p>
          </div>
        </div>

        {/* HU-28 — Acciones de cuenta */}
        {customer.role !== 'ADMIN' && (
          <>
            <p className="section-label">Gestión de cuenta</p>
            {customer.status === 'ACTIVE' ? (
              showBlockForm ? (
                <div className="bg-[#FDF0EE] border border-[#E8C5BF] rounded-xl p-4 mb-4">
                  <p className="text-sm text-error font-medium mb-2">Motivo del bloqueo</p>
                  <input type="text" className="form-input mb-3" placeholder="Ej: Deuda pendiente de pago"
                    value={blockReason} onChange={e => setBlockReason(e.target.value)} />
                  <div className="flex gap-2">
                    <button className="btn-secondary text-sm flex-1" onClick={() => setShowBlockForm(false)}>Cancelar</button>
                    <button
                      className="text-sm flex-1 py-2.5 rounded-lg bg-error text-white border-0 cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      onClick={handleBlock} disabled={blocking}>
                      {blocking ? <><Spinner size="sm" />Bloqueando…</> : 'Confirmar bloqueo'}
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn-secondary text-sm w-full text-error hover:border-error"
                  onClick={() => setShowBlockForm(true)}>
                  ⊘ Bloquear esta cuenta
                </button>
              )
            ) : (
              <button className="btn-primary text-sm w-full flex items-center justify-center gap-2"
                onClick={handleActivate} disabled={blocking}>
                {blocking ? <><Spinner size="sm" />Activando…</> : '✓ Activar esta cuenta'}
              </button>
            )}
          </>
        )}

        <button className="btn-ghost text-sm mt-4 w-full text-center" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  )
}

// ── Sección de clientes con búsqueda y filtros (HU-24, HU-25, HU-26) ──
function CustomersSection ({ onProfileChange }) {
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilterStatus]   = useState('')
  const [filterProfile, setFilterProfile] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing]   = useState(null)

  const { data: allProfiles, refetch } = useAsync(() => profileApi.getAll(), [])

  // HU-24, HU-25 — filtrado local combinado
  const filtered = useMemo(() => {
    if (!allProfiles) return []
    return allProfiles.filter(c => {
      if (filterStatus  && c.status  !== filterStatus)  return false
      if (filterProfile && c.profile !== filterProfile) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          c.sapCode?.toLowerCase().includes(q) ||
          c.name?.toLowerCase().includes(q) ||
          c.businessName?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allProfiles, search, filterStatus, filterProfile])

  // HU-26 — exportar a CSV
  function handleExport () {
    const headers = ['Código SAP', 'Nombre', 'Empresa', 'Email', 'Ciudad', 'Perfil', 'Estado']
    const rows = filtered.map(c => [
      c.sapCode, c.name, c.businessName, c.email, c.city ?? '', c.profile, c.status
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `clientes-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="section-label mb-0">Clientes</p>
          <button onClick={handleExport}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:border-sage hover:text-sage-dark transition-colors cursor-pointer bg-transparent">
            ↓ CSV
          </button>
        </div>

        {/* HU-24 — Búsqueda */}
        <div className="flex items-center gap-2 bg-cream border border-border rounded-lg px-3 py-2 mb-3">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8A8880" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Buscar por nombre, SAP, ciudad…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none text-charcoal placeholder:text-muted" />
        </div>

        {/* HU-25 — Filtros */}
        <div className="flex gap-2 mb-4">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-cream text-charcoal outline-none cursor-pointer flex-1">
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activas</option>
            <option value="BLOCKED">Bloqueadas</option>
          </select>
          <select value={filterProfile} onChange={e => setFilterProfile(e.target.value)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-cream text-charcoal outline-none cursor-pointer flex-1">
            <option value="">Todos los perfiles</option>
            <option value="STANDARD">Estándar</option>
            <option value="PREMIUM">Premium</option>
            <option value="VIP">VIP</option>
          </select>
          {(search || filterStatus || filterProfile) && (
            <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterProfile('') }}
              className="text-xs text-muted hover:text-charcoal border-0 bg-transparent cursor-pointer px-1">
              ✕
            </button>
          )}
        </div>

        {/* Contador */}
        {filtered.length !== allProfiles?.length && (
          <p className="text-xs text-muted mb-3">{filtered.length} de {allProfiles?.length} clientes</p>
        )}

        {!allProfiles && <div className="flex justify-center py-8"><Spinner /></div>}

        {/* Lista */}
        {filtered.map(customer => (
          <div key={customer.sapCode} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${customer.status === 'ACTIVE' ? 'bg-sage' : 'bg-error'}`} />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-charcoal">{customer.name}</span>
              {customer.businessName && <span className="text-xs text-muted ml-1.5">· {customer.businessName}</span>}
            </div>
            <span className="text-xs text-muted hidden sm:block">{customer.sapCode}</span>
            {customer.status === 'BLOCKED'
              ? <span className="tag bg-[#FDF0EE] text-error text-[10px]">Bloqueada</span>
              : <ProfileTag profile={customer.profile} />
            }
            {/* HU-27 — Ver ficha completa */}
            <button onClick={() => setSelected(customer)}
              className="text-xs text-muted hover:text-sage-dark border-0 bg-transparent cursor-pointer">
              Ver
            </button>
            {customer.role !== 'ADMIN' && customer.status !== 'BLOCKED' && (
              <button onClick={() => setEditing(customer)}
                className="text-xs text-muted hover:text-sage-dark border-0 bg-transparent cursor-pointer underline underline-offset-2">
                Cambiar
              </button>
            )}
          </div>
        ))}
      </div>

      {selected && (
        <CustomerDetailModal
          customer={selected}
          onClose={() => setSelected(null)}
          onStatusChange={() => { refetch(); onProfileChange() }}
        />
      )}
      {editing && (
        <ChangeProfileModal
          customer={editing}
          onClose={() => setEditing(null)}
          onSave={() => { refetch(); onProfileChange() }}
        />
      )}
    </>
  )
}

// ── HU-47 — Asignación de comerciales ────────────────────────────
function CommercialAssignmentsSection () {
  const { data: commercials }  = useAsync(() => commercialApi.getCommercials(), [])
  const { data: assignments, refetch } = useAsync(() => commercialApi.getAssignments(), [])
  const { data: profiles }     = useAsync(() => profileApi.getAll(), [])
  const [saving, setSaving]    = useState(null)

  async function handleAssign (sapCode, commercialId) {
    setSaving(sapCode)
    try { await commercialApi.assignCommercial(sapCode, commercialId); refetch() }
    catch { alert('Error al asignar el comercial') }
    finally { setSaving(null) }
  }

  const getAssignment = (sapCode) => assignments?.find(a => a.sapCode === sapCode)?.commercialId ?? ''
  const customers = profiles?.filter(p => p.role !== 'ADMIN') ?? []

  return (
    <div className="card mt-6">
      <p className="section-label mb-5">Asignación de comerciales</p>
      {!customers.length && <div className="flex justify-center py-4"><Spinner /></div>}
      <div className="space-y-2">
        {customers.map(customer => (
          <div key={customer.sapCode} className="flex items-center gap-4 py-2.5 border-b border-border last:border-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${customer.status === 'ACTIVE' ? 'bg-sage' : 'bg-error'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-charcoal">{customer.name}</p>
              <p className="text-xs text-muted">{customer.sapCode}</p>
            </div>
            <select
              value={getAssignment(customer.sapCode)}
              onChange={e => handleAssign(customer.sapCode, e.target.value)}
              disabled={saving === customer.sapCode || !commercials}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-cream text-charcoal outline-none cursor-pointer"
            >
              <option value="">Sin comercial</option>
              {commercials?.map(c => (
                <option key={c.id} value={c.id}>{c.name} · {c.zone}</option>
              ))}
            </select>
            {saving === customer.sapCode && <Spinner size="sm" />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── HU-39 — Gestión de contenidos ────────────────────────────────
function ContentManagementSection () {
  const [tab, setTab]             = useState('datasheets')
  const [showForm, setShowForm]   = useState(false)
  const [formType, setFormType]   = useState(null)

  const { data: datasheets, refetch: refetchDS } = useAsync(() => contentApi.adminGetDatasheets(), [])
  const { data: videos,     refetch: refetchVid } = useAsync(() => contentApi.adminGetVideos(), [])
  const { data: news,       refetch: refetchNews } = useAsync(() => contentApi.adminGetNews(), [])

  async function toggleActive (type, id, current) {
    if (type === 'datasheet') { await contentApi.adminUpdateDatasheet(id, { active: !current }); refetchDS() }
    if (type === 'video')     { await contentApi.adminUpdateVideo(id,     { active: !current }); refetchVid() }
    if (type === 'news')      { await contentApi.adminUpdateNews(id,      { active: !current }); refetchNews() }
  }

  async function toggleFeatured (id, current) {
    await contentApi.adminUpdateNews(id, { featured: !current })
    refetchNews()
  }

  const tabs = [
    { key: 'datasheets', label: 'Fichas técnicas', count: datasheets?.length },
    { key: 'videos',     label: 'Vídeos',          count: videos?.length },
    { key: 'news',       label: 'Novedades',        count: news?.length },
  ]

  return (
    <div className="card mt-6">
      <div className="flex items-center justify-between mb-5">
        <p className="section-label mb-0">Contenido formativo</p>
        <button
          onClick={() => { setFormType(tab); setShowForm(true) }}
          className="bg-sage-dark text-off-white rounded-lg px-3.5 py-1.5 text-xs font-medium hover:bg-sage transition-colors border-0 cursor-pointer"
        >
          + Añadir
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key ? 'border-sage-dark text-sage-dark' : 'border-transparent text-muted hover:text-charcoal'
            }`}
          >
            {t.label}
            {t.count != null && <span className="ml-1.5 tag bg-cream text-muted text-[10px]">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Fichas técnicas */}
      {tab === 'datasheets' && (
        <div className="space-y-2">
          {datasheets?.map(ds => (
            <div key={ds.id} className={`flex items-center gap-3 p-3 rounded-lg ${ds.active ? 'bg-cream' : 'bg-cream/40 opacity-60'}`}>
              <span className="text-lg">📄</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal truncate">{ds.title}</p>
                <p className="text-xs text-muted">{ds.fileType} · {ds.familyId ?? 'General'}</p>
              </div>
              <span className={`tag text-[10px] ${ds.active ? 'bg-[#EEF4EA] text-success' : 'bg-cream text-muted'}`}>
                {ds.active ? 'Activa' : 'Retirada'}
              </span>
              <button onClick={() => toggleActive('datasheet', ds.id, ds.active)}
                className="text-xs text-muted hover:text-charcoal border-0 bg-transparent cursor-pointer">
                {ds.active ? 'Retirar' : 'Publicar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Vídeos */}
      {tab === 'videos' && (
        <div className="space-y-2">
          {videos?.map(vid => (
            <div key={vid.id} className={`flex items-center gap-3 p-3 rounded-lg ${vid.active ? 'bg-cream' : 'bg-cream/40 opacity-60'}`}>
              <span className="text-lg">🎬</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal truncate">{vid.title}</p>
                <p className="text-xs text-muted">{vid.duration} · {vid.familyId ?? 'General'}</p>
              </div>
              <span className={`tag text-[10px] ${vid.active ? 'bg-[#EEF4EA] text-success' : 'bg-cream text-muted'}`}>
                {vid.active ? 'Activo' : 'Retirado'}
              </span>
              <button onClick={() => toggleActive('video', vid.id, vid.active)}
                className="text-xs text-muted hover:text-charcoal border-0 bg-transparent cursor-pointer">
                {vid.active ? 'Retirar' : 'Publicar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Novedades */}
      {tab === 'news' && (
        <div className="space-y-2">
          {news?.map(item => (
            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg ${item.active ? 'bg-cream' : 'bg-cream/40 opacity-60'}`}>
              <span className="text-lg">📢</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal truncate">{item.title}</p>
                <p className="text-xs text-muted">{new Date(item.publishedAt).toLocaleDateString('es-ES')}</p>
              </div>
              {item.featured && <span className="tag bg-[#F7F3E8] text-gold text-[10px]">★</span>}
              <button onClick={() => toggleFeatured(item.id, item.featured)}
                className="text-xs text-muted hover:text-gold border-0 bg-transparent cursor-pointer">
                {item.featured ? 'Quitar destacado' : 'Destacar'}
              </button>
              <button onClick={() => toggleActive('news', item.id, item.active)}
                className="text-xs text-muted hover:text-charcoal border-0 bg-transparent cursor-pointer">
                {item.active ? 'Retirar' : 'Publicar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario rápido de creación */}
      {showForm && <QuickCreateForm type={formType} onClose={() => setShowForm(false)}
        onSave={() => { setShowForm(false); refetchDS(); refetchVid(); refetchNews() }} />}
    </div>
  )
}

function QuickCreateForm ({ type, onClose, onSave }) {
  const [form, setForm] = useState({ title: '', familyId: '', active: true })
  const [saving, setSaving] = useState(false)

  const labels = { datasheets: 'Ficha técnica', videos: 'Vídeo formativo', news: 'Novedad' }

  async function handleSave () {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (type === 'datasheets') await contentApi.adminCreateDatasheet({ ...form, fileType: 'PDF', downloadUrl: '#' })
      if (type === 'videos')     await contentApi.adminCreateVideo({ ...form, videoUrl: form.videoUrl || '#', duration: form.duration || '—' })
      if (type === 'news')       await contentApi.adminCreateNews({ ...form, summary: form.summary || form.title })
      onSave()
    } catch { alert('Error al crear el contenido') }
    finally { setSaving(false) }
  }

  return (
    <div className="mt-5 p-4 bg-cream rounded-xl border border-border">
      <p className="text-sm font-medium text-charcoal mb-3">Nuevo {labels[type]}</p>
      <div className="space-y-3">
        <input type="text" className="form-input text-sm" placeholder="Título"
          value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        {type !== 'news' && (
          <select className="form-input text-sm" value={form.familyId}
            onChange={e => setForm(f => ({ ...f, familyId: e.target.value }))}>
            <option value="">Familia (opcional)</option>
            <option value="F01">✨ Ritual Timeless</option>
            <option value="F02">🌿 Sensitivo</option>
            <option value="F03">💧 Brillo & Nutrición</option>
          </select>
        )}
        {type === 'videos' && (
          <>
            <input type="text" className="form-input text-sm" placeholder="URL del vídeo (YouTube embed)"
              value={form.videoUrl || ''} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} />
            <input type="text" className="form-input text-sm" placeholder="Duración (ej: 4:32)"
              value={form.duration || ''} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
          </>
        )}
        {type === 'news' && (
          <textarea className="form-input text-sm resize-none" rows={2} placeholder="Resumen"
            value={form.summary || ''} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} />
        )}
        <input type="text" className="form-input text-sm" placeholder="Descripción (opcional)"
          value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
      <div className="flex gap-2 mt-3">
        <button className="btn-secondary text-xs flex-1" onClick={onClose} disabled={saving}>Cancelar</button>
        <button className="btn-primary text-xs flex-1 flex items-center justify-center gap-1"
          onClick={handleSave} disabled={saving || !form.title.trim()}>
          {saving ? <><Spinner size="sm" />Guardando…</> : 'Crear'}
        </button>
      </div>
    </div>
  )
}

// ── AdminPage principal ───────────────────────────────────────────
export function AdminPage () {
  const [showNewPromo, setShowNewPromo] = useState(false)
  const [profilesKey, setProfilesKey]   = useState(0)

  const { data: profiles } = useAsync(() => profileApi.getAll(), [profilesKey])
  const { data: promotions, refetch: refetchPromos } = useAsync(() => promotionsApi.getAll(), [])
  const { data: pendingReturns, refetch: refetchReturns } = useAsync(() => returnsApi.getAllReturns('PENDING'), [])

  const activeCount  = profiles?.filter(p => p.status === 'ACTIVE').length  ?? 0
  const blockedCount = profiles?.filter(p => p.status === 'BLOCKED').length ?? 0

  async function handleTogglePromo (id) {
    await promotionsApi.toggle(id)
    refetchPromos()
  }

  async function handleUpdateReturn (id, status, adminNotes) {
    await returnsApi.updateReturn(id, status, adminNotes)
    refetchReturns()
  }

  // HU-30 — Estado de sincronización SAP
  const { data: sapHealth } = useAsync(async () => {
    try {
      const res = await fetch('/api/sap-health')
      return await res.json()
    } catch { return { status: 'error' } }
  }, [])

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

      {/* HU-29 — Dashboard de métricas */}
      <div className="grid grid-cols-4 gap-5 mb-10">
        <StatCard label="Clientes activos"         value={activeCount || '—'}                         change="↑ Con acceso al portal"                     up />
        <StatCard label="Promociones activas"      value={promotions?.filter(p => p.active).length ?? '—'} change="↑ Visibles para clientes"              up />
        <StatCard label="Cuentas bloqueadas"       value={blockedCount || 0}
          change={blockedCount > 0 ? '↑ Requieren atención' : '✓ Sin bloqueos'}
          up={blockedCount === 0} />
        <StatCard label="Devoluciones pendientes"  value={pendingReturns?.length ?? '—'}
          change={pendingReturns?.length > 0 ? '↑ Pendientes de revisión' : '✓ Sin pendientes'}
          up={!pendingReturns?.length} />
      </div>

      {/* HU-30 — Alerta de SAP si hay error */}
      {sapHealth?.status !== 'ok' && (
        <div className="bg-[#FDF0EE] border border-[#E8C5BF] rounded-xl px-5 py-4 mb-6 flex items-center gap-3">
          <span className="text-error text-xl">⚠</span>
          <div>
            <p className="text-sm font-medium text-error">Fallo de sincronización con SAP</p>
            <p className="text-xs text-muted">El SAP Integration Service no responde. Los datos pueden no estar actualizados.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">

        {/* HU-24, HU-25, HU-26, HU-27, HU-28 — Gestión de clientes */}
        <CustomersSection onProfileChange={() => setProfilesKey(k => k + 1)} />

        {/* HU-11 — Gestión de promociones */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <p className="section-label mb-0">Promociones</p>
            <button onClick={() => setShowNewPromo(true)}
              className="bg-sage-dark text-off-white rounded-lg px-3.5 py-1.5 text-xs font-medium hover:bg-sage transition-colors border-0 cursor-pointer">
              + Nueva
            </button>
          </div>

          {!promotions && <div className="flex justify-center py-8"><Spinner /></div>}

          {promotions?.map(promo => (
            <div key={promo.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${promo.active ? 'bg-success' : 'bg-border'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${!promo.active ? 'text-muted' : 'text-charcoal'}`}>{promo.name}</p>
                <p className="text-xs text-muted truncate">{promo.description} · {promo.profiles?.join(', ')}</p>
              </div>
              <button onClick={() => handleTogglePromo(promo.id)} title={promo.active ? 'Desactivar' : 'Activar'}
                className="w-7 h-7 rounded-md border border-border bg-off-white text-xs text-muted hover:border-sage hover:text-sage-dark transition-colors cursor-pointer flex items-center justify-center">
                {promo.active ? '⏸' : '▶'}
              </button>
            </div>
          ))}

          <hr className="border-border my-5" />

          {/* HU-30 — Estado sincronización SAP */}
          <p className="section-label mb-3">Sincronización SAP</p>
          <div className="flex items-center justify-between">
            <div>
              {sapHealth?.status === 'ok'
                ? <p className="text-xs text-success">✓ Conectado · uptime: {Math.round(sapHealth.uptime ?? 0)}s</p>
                : <p className="text-xs text-error">⚠ Sin conexión con SAP</p>
              }
            </div>
            <button className="btn-secondary text-xs py-1.5 px-3"
              onClick={() => window.location.reload()}>
              Verificar
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
                  <p className="text-xs text-muted mb-1">{ret.sapCode} · Pedido {ret.orderId}</p>
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
                  <button onClick={() => handleUpdateReturn(ret.id, 'REVIEWING')}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border bg-off-white text-muted hover:border-sage hover:text-sage-dark transition-colors cursor-pointer">
                    Revisar
                  </button>
                  <button onClick={() => handleUpdateReturn(ret.id, 'APPROVED', 'Aprobada')}
                    className="text-xs px-3 py-1.5 rounded-lg bg-sage-dark text-off-white hover:bg-sage transition-colors cursor-pointer border-0">
                    Aprobar
                  </button>
                  <button onClick={() => handleUpdateReturn(ret.id, 'REJECTED', 'No cumple condiciones')}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[#E8C5BF] bg-[#FDF0EE] text-error hover:bg-[#f5e0dc] transition-colors cursor-pointer">
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HU-47 — Asignación de comerciales */}
      <CommercialAssignmentsSection />

      {/* HU-39 — Gestión de contenidos formativos */}
      <ContentManagementSection />

      {showNewPromo && (
        <NewPromoModal onClose={() => setShowNewPromo(false)} onSave={refetchPromos} />
      )}
    </div>
  )
}
