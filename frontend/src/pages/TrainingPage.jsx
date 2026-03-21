import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync.js'
import { contentApi } from '../api/index.js'
import { Spinner } from '../components/Spinner.jsx'

const FAMILY_NAMES = { F01: 'Ritual Timeless', F02: 'Sensitivo', F03: 'Brillo & Nutrición' }
const FAMILY_EMOJI = { F01: '✨', F02: '🌿', F03: '💧' }
const TABS = ['Novedades', 'Fichas técnicas', 'Vídeos']

// ── Componentes auxiliares ────────────────────────────────────────

function NewsCard ({ item, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`card cursor-pointer hover:border-sage-light hover:-translate-y-0.5 transition-all ${item.featured ? 'border-sage-light' : ''}`}
    >
      {item.featured && (
        <span className="tag bg-[#EEF4EA] text-sage-dark text-[10px] mb-3 inline-block">
          ★ Destacado
        </span>
      )}
      <h3 className="font-serif text-lg font-normal text-charcoal mb-2 leading-snug">
        {item.title}
      </h3>
      <p className="text-sm text-muted mb-3 leading-relaxed">{item.summary}</p>
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {item.tags?.slice(0, 3).map(tag => (
            <span key={tag} className="tag bg-cream text-muted text-[10px]">{tag}</span>
          ))}
        </div>
        <span className="text-xs text-muted">
          {new Date(item.publishedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </div>
  )
}

function DatasheetCard ({ ds }) {
  function handleDownload () {
    // En producción abre el PDF real; en stub muestra el path
    window.open(ds.downloadUrl, '_blank')
  }

  return (
    <div className="card flex items-start gap-4">
      <div className="w-12 h-12 bg-[#FDF0EE] rounded-xl flex items-center justify-center text-xl flex-shrink-0">
        📄
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-sage uppercase tracking-wider mb-1">
          {FAMILY_EMOJI[ds.familyId]} {FAMILY_NAMES[ds.familyId] ?? 'General'}
        </p>
        <h3 className="font-serif text-base font-normal text-charcoal mb-1 leading-snug">
          {ds.title}
        </h3>
        <p className="text-xs text-muted mb-3 leading-relaxed line-clamp-2">{ds.description}</p>
        <div className="flex items-center gap-3">
          <span className="tag bg-cream text-muted text-[10px]">
            {ds.fileType} · {ds.fileSizeKb ? `${(ds.fileSizeKb / 1024).toFixed(1)} MB` : '—'}
          </span>
          <button
            onClick={handleDownload}
            className="text-xs text-sage-dark underline underline-offset-2 hover:text-sage transition-colors bg-transparent border-0 cursor-pointer"
          >
            ↓ Descargar
          </button>
        </div>
      </div>
    </div>
  )
}

function VideoCard ({ vid, onClick }) {
  return (
    <div
      onClick={onClick}
      className="card cursor-pointer hover:border-sage-light hover:-translate-y-0.5 transition-all group"
    >
      {/* Thumbnail placeholder */}
      <div className="h-36 bg-cream rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
        <span className="text-4xl">{FAMILY_EMOJI[vid.familyId] ?? '🎬'}</span>
        <div className="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/10 transition-colors flex items-center justify-center">
          <div className="w-12 h-12 bg-off-white/90 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-charcoal text-xl ml-0.5">▶</span>
          </div>
        </div>
        <span className="absolute bottom-2 right-2 tag bg-charcoal/70 text-off-white text-[10px]">
          {vid.duration}
        </span>
      </div>
      <p className="text-xs text-sage uppercase tracking-wider mb-1">
        {FAMILY_EMOJI[vid.familyId]} {FAMILY_NAMES[vid.familyId] ?? 'General'}
      </p>
      <h3 className="font-serif text-base font-normal text-charcoal mb-1 leading-snug">
        {vid.title}
      </h3>
      <p className="text-xs text-muted line-clamp-2 leading-relaxed">{vid.description}</p>
    </div>
  )
}

// ── Modal: reproductor de vídeo ───────────────────────────────────
function VideoModal ({ vid, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-charcoal/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-off-white rounded-2xl overflow-hidden w-full max-w-3xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="aspect-video bg-charcoal">
          <iframe
            src={vid.videoUrl}
            className="w-full h-full"
            allowFullScreen
            title={vid.title}
          />
        </div>
        <div className="p-5">
          <h3 className="font-serif text-xl font-normal text-charcoal mb-1">{vid.title}</h3>
          <p className="text-sm text-muted mb-3">{vid.description}</p>
          <div className="flex justify-between items-center">
            <span className="tag bg-cream text-muted text-xs">{vid.duration}</span>
            <button className="btn-ghost text-sm" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal: novedad completa ───────────────────────────────────────
function NewsModal ({ item, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-charcoal/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-off-white rounded-2xl p-8 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {item.featured && (
          <span className="tag bg-[#EEF4EA] text-sage-dark text-[10px] mb-4 inline-block">★ Destacado</span>
        )}
        <h2 className="font-serif text-3xl font-light text-charcoal mb-2 leading-tight">{item.title}</h2>
        <p className="text-xs text-muted mb-6">
          {new Date(item.publishedAt).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <p className="text-base text-muted mb-6 leading-relaxed font-medium">{item.summary}</p>
        {item.body && (
          <p className="text-sm text-charcoal leading-relaxed mb-6">{item.body}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {item.tags?.map(tag => (
            <span key={tag} className="tag bg-cream text-muted text-xs">{tag}</span>
          ))}
        </div>
        <button className="btn-ghost text-sm" onClick={onClose}>← Volver</button>
      </div>
    </div>
  )
}

// ── TrainingPage ──────────────────────────────────────────────────
export function TrainingPage () {
  const [activeTab, setActiveTab]     = useState('Novedades')
  const [filterFamily, setFilterFamily] = useState('')
  const [activeVideo, setActiveVideo] = useState(null)
  const [activeNews, setActiveNews]   = useState(null)

  const { data: news,       loading: loadingNews }       = useAsync(() => contentApi.getNews(), [])
  const { data: datasheets, loading: loadingDatasheets } = useAsync(
    () => contentApi.getDatasheets(filterFamily ? { familyId: filterFamily } : undefined),
    [filterFamily]
  )
  const { data: videos,     loading: loadingVideos }     = useAsync(
    () => contentApi.getVideos(filterFamily ? { familyId: filterFamily } : undefined),
    [filterFamily]
  )

  const featured  = news?.filter(n => n.featured) ?? []
  const restNews  = news?.filter(n => !n.featured) ?? []

  const familyFilter = (
    <div className="flex gap-2 mb-6">
      {['', 'F01', 'F02', 'F03'].map(fid => (
        <button key={fid}
          onClick={() => setFilterFamily(fid)}
          className={`px-4 py-1.5 rounded-full border text-xs transition-all ${
            filterFamily === fid
              ? 'bg-sage-dark text-off-white border-sage-dark'
              : 'bg-off-white text-muted border-border hover:border-sage hover:text-sage-dark'
          }`}
        >
          {fid ? `${FAMILY_EMOJI[fid]} ${FAMILY_NAMES[fid]}` : 'Todas las familias'}
        </button>
      ))}
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title">Formación y contenido</h1>
        <p className="page-subtitle">Fichas técnicas, vídeos formativos y novedades de producto</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-sage-dark text-sage-dark'
                : 'border-transparent text-muted hover:text-charcoal'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* HU-38 — Novedades */}
      {activeTab === 'Novedades' && (
        <div>
          {loadingNews && <div className="flex justify-center py-24"><Spinner size="lg" /></div>}

          {/* Destacadas */}
          {featured.length > 0 && (
            <div className="mb-8">
              <p className="section-label">Destacadas</p>
              <div className="grid grid-cols-2 gap-4">
                {featured.map(item => (
                  <NewsCard key={item.id} item={item} onClick={() => setActiveNews(item)} />
                ))}
              </div>
            </div>
          )}

          {/* Resto de noticias */}
          {restNews.length > 0 && (
            <div>
              <p className="section-label">Últimas noticias</p>
              <div className="grid grid-cols-3 gap-4">
                {restNews.map(item => (
                  <NewsCard key={item.id} item={item} onClick={() => setActiveNews(item)} />
                ))}
              </div>
            </div>
          )}

          {!loadingNews && news?.length === 0 && (
            <div className="text-center py-24 text-muted">No hay novedades publicadas</div>
          )}
        </div>
      )}

      {/* HU-36 — Fichas técnicas */}
      {activeTab === 'Fichas técnicas' && (
        <div>
          {familyFilter}
          {loadingDatasheets && <div className="flex justify-center py-24"><Spinner size="lg" /></div>}
          {!loadingDatasheets && datasheets?.length === 0 && (
            <div className="text-center py-24 text-muted">No hay fichas técnicas para este filtro</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {datasheets?.map(ds => <DatasheetCard key={ds.id} ds={ds} />)}
          </div>
        </div>
      )}

      {/* HU-37 — Vídeos formativos */}
      {activeTab === 'Vídeos' && (
        <div>
          {familyFilter}
          {loadingVideos && <div className="flex justify-center py-24"><Spinner size="lg" /></div>}
          {!loadingVideos && videos?.length === 0 && (
            <div className="text-center py-24 text-muted">No hay vídeos para este filtro</div>
          )}
          <div className="grid grid-cols-3 gap-4">
            {videos?.map(vid => (
              <VideoCard key={vid.id} vid={vid} onClick={() => setActiveVideo(vid)} />
            ))}
          </div>
        </div>
      )}

      {/* Modales */}
      {activeVideo && <VideoModal vid={activeVideo} onClose={() => setActiveVideo(null)} />}
      {activeNews  && <NewsModal  item={activeNews} onClose={() => setActiveNews(null)} />}
    </div>
  )
}
