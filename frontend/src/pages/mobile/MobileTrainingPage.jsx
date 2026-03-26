import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { contentApi } from '../../api/index.js'
import { Spinner } from '../../components/Spinner.jsx'

const FAMILY_META = {
  F01: { emoji: '✨', name: 'Ritual Timeless',  gradient: 'linear-gradient(135deg,#E8D4A0,#F0E4CB)', color: '#8C6E52' },
  F02: { emoji: '🌿', name: 'Sensitivo',         gradient: 'linear-gradient(135deg,#C8D4BE,#DFE9D9)', color: '#4A7054' },
  F03: { emoji: '💧', name: 'Brillo & Nutrición',gradient: 'linear-gradient(135deg,#B8CDD4,#D4E4EA)', color: '#3A5F8A' },
}
const TABS = ['Novedades', 'Fichas técnicas', 'Vídeos']

const card = {
  background: '#FDFCFA',
  boxShadow: '0 2px 16px rgba(44,44,40,0.06)',
}

function PageHeader ({ title, subtitle }) {
  return (
    <div className="px-4 pt-5 mb-5">
      <h1 className="font-serif text-[34px] font-light text-charcoal leading-none mb-1">{title}</h1>
      <p className="text-sm text-muted">{subtitle}</p>
    </div>
  )
}

function VideoModal ({ vid, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1 bg-charcoal/70 backdrop-blur-sm" />
      <div
        className="bg-[#FDFCFA] overflow-hidden"
        style={{ boxShadow: '0 -8px 40px rgba(44,44,40,0.18)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-9 h-1 bg-border mx-auto mt-3 mb-0" />
        <div className="aspect-video bg-charcoal">
          <iframe src={vid.videoUrl} className="w-full h-full" allowFullScreen title={vid.title} />
        </div>
        <div className="p-5">
          <h3 className="font-serif text-xl font-light text-charcoal mb-1">{vid.title}</h3>
          <p className="text-sm text-muted mb-5 leading-relaxed">{vid.description}</p>
          <button
            className="w-full py-4  text-sm font-medium text-charcoal active:scale-[0.97] transition-all"
            style={{ background: '#F2EFE9', boxShadow: '0 1px 6px rgba(44,44,40,0.08)' }}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

function NewsModal ({ item, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="mt-12 bg-[#FDFCFA] flex-1 overflow-y-auto"
        style={{ boxShadow: '0 -8px 40px rgba(44,44,40,0.18)' }}
        onClick={e => e.stopPropagation()}>
        <div className="w-9 h-1 bg-border mx-auto mt-3 mb-5" />
        <div className="px-5 pb-8">
          {item.featured && (
            <span className="inline-block text-[10px] tracking-[0.14em] uppercase px-3 py-1.5  mb-4 font-medium"
              style={{ background: 'rgba(74,112,84,0.10)', color: '#4A7054' }}>
              ★ Destacado
            </span>
          )}
          <h2 className="font-serif text-[28px] font-light text-charcoal mb-2 leading-tight">{item.title}</h2>
          <p className="text-xs text-muted mb-4 tracking-wide">
            {new Date(item.publishedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-base text-muted mb-4 leading-relaxed font-medium">{item.summary}</p>
          {item.body && <p className="text-sm text-charcoal leading-relaxed mb-5">{item.body}</p>}
          <div className="flex flex-wrap gap-1.5 mb-6">
            {item.tags?.map(tag => (
              <span key={tag} className="text-[10px] px-2.5 py-1 "
                style={{ background: '#F2EFE9', color: '#8A8880' }}>{tag}</span>
            ))}
          </div>
          <button className="w-full py-4  text-sm font-medium text-charcoal active:scale-[0.97] transition-all"
            style={{ background: '#F2EFE9', boxShadow: '0 1px 6px rgba(44,44,40,0.08)' }}
            onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

function FamilyFilter ({ value, onChange }) {
  return (
    <div className="overflow-x-auto scrollbar-none mb-5 -mx-1">
      <div className="flex gap-2 px-1 pb-1" style={{ minWidth: 'max-content' }}>
        {[['', 'Todas'], ['F01', ''], ['F02', ''], ['F03', '']].map(([fid]) => {
          const meta = fid ? FAMILY_META[fid] : null
          const isActive = value === fid
          return (
            <button key={fid} onClick={() => onChange(fid)}
              className="flex items-center gap-1.5 px-4 py-2  text-sm transition-all active:scale-[0.97]"
              style={isActive
                ? { background: 'linear-gradient(135deg,#4A5740,#6B7B5E)', color: '#FDFCFA', boxShadow: '0 3px 12px rgba(74,87,64,0.25)' }
                : { background: '#FDFCFA', color: '#8A8880', boxShadow: '0 1px 4px rgba(44,44,40,0.06)' }
              }>
              {meta ? <><span>{meta.emoji}</span> {meta.name}</> : 'Todas las colecciones'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TabBar ({ active, onChange }) {
  return (
    <div className="flex gap-1 px-4 border-b mb-0" style={{ borderColor: 'rgba(226,221,214,0.6)' }}>
      {TABS.map(tab => (
        <button key={tab} onClick={() => onChange(tab)}
          className="px-4 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
          style={{ borderColor: active === tab ? '#4A5740' : 'transparent', color: active === tab ? '#4A5740' : '#B0ADA7' }}>
          {tab}
        </button>
      ))}
    </div>
  )
}

export function MobileTrainingPage () {
  const [activeTab,    setActiveTab]    = useState('Novedades')
  const [filterFamily, setFilterFamily] = useState('')
  const [activeVideo,  setActiveVideo]  = useState(null)
  const [activeNews,   setActiveNews]   = useState(null)

  const { data: news,       loading: loadingNews }       = useAsync(() => contentApi.getNews(), [])
  const { data: datasheets, loading: loadingDatasheets } = useAsync(
    () => contentApi.getDatasheets(filterFamily ? { familyId: filterFamily } : undefined),
    [filterFamily]
  )
  const { data: videos, loading: loadingVideos } = useAsync(
    () => contentApi.getVideos(filterFamily ? { familyId: filterFamily } : undefined),
    [filterFamily]
  )

  const featured = news?.filter(n => n.featured) ?? []
  const restNews = news?.filter(n => !n.featured) ?? []

  return (
    <div>
      <PageHeader title="Formación" subtitle="Novedades, fichas técnicas y vídeos" />
      <TabBar active={activeTab} onChange={setActiveTab} />

      <div className="px-4 pt-5 pb-8">

        {/* Novedades */}
        {activeTab === 'Novedades' && (
          <div>
            {loadingNews && <div className="flex justify-center py-10"><Spinner size="lg" /></div>}

            {featured.length > 0 && (
              <div className="mb-5">
                <p className="m-label mb-3">Destacadas</p>
                {featured.map(item => (
                  <button key={item.id} onClick={() => setActiveNews(item)}
                    className="w-full text-left p-5 mb-3 active:scale-[0.98] transition-transform"
                    style={{ ...card, background: 'linear-gradient(135deg,#EEF4EA,#F4F8F2)' }}>
                    <span className="inline-block text-[10px] tracking-[0.14em] uppercase font-medium px-3 py-1.5  mb-3"
                      style={{ background: 'rgba(74,112,84,0.12)', color: '#4A7054' }}>
                      ★ Destacado
                    </span>
                    <h3 className="font-serif text-[20px] font-light text-charcoal leading-snug mb-1">{item.title}</h3>
                    <p className="text-xs text-muted line-clamp-2 leading-relaxed">{item.summary}</p>
                  </button>
                ))}
              </div>
            )}

            {restNews.length > 0 && (
              <div>
                <p className="m-label mb-3">Últimas noticias</p>
                <div className="flex flex-col gap-3">
                  {restNews.map(item => (
                    <button key={item.id} onClick={() => setActiveNews(item)}
                      className="w-full text-left p-4 active:scale-[0.98] transition-transform"
                      style={card}>
                      <h3 className="font-serif text-base text-charcoal mb-1 leading-snug">{item.title}</h3>
                      <p className="text-xs text-muted line-clamp-2 mb-2 leading-relaxed">{item.summary}</p>
                      <p className="text-[10px] text-muted/60">{new Date(item.publishedAt).toLocaleDateString('es-ES')}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!loadingNews && news?.length === 0 && (
              <p className="text-center py-12 text-muted text-sm">No hay novedades publicadas</p>
            )}
          </div>
        )}

        {/* Fichas técnicas */}
        {activeTab === 'Fichas técnicas' && (
          <div>
            <FamilyFilter value={filterFamily} onChange={setFilterFamily} />
            {loadingDatasheets && <div className="flex justify-center py-10"><Spinner /></div>}
            <div className="flex flex-col gap-3">
              {datasheets?.map(ds => {
                const meta = FAMILY_META[ds.familyId]
                return (
                  <div key={ds.id} className="flex gap-4 p-4" style={card}>
                    <div className="w-12 h-12  flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: meta?.gradient ?? '#F2EFE9' }}>
                      📄
                    </div>
                    <div className="flex-1 min-w-0">
                      {meta && <p className="text-[10px] font-medium mb-0.5" style={{ color: meta.color }}>
                        {meta.emoji} {meta.name}
                      </p>}
                      <h3 className="font-serif text-sm text-charcoal mb-1">{ds.title}</h3>
                      <p className="text-xs text-muted line-clamp-2 mb-2 leading-relaxed">{ds.description}</p>
                      <button onClick={() => window.open(ds.downloadUrl, '_blank')}
                        className="text-xs font-medium underline underline-offset-2"
                        style={{ color: '#4A7054' }}>
                        ↓ Descargar {ds.fileType}
                      </button>
                    </div>
                  </div>
                )
              })}
              {!loadingDatasheets && datasheets?.length === 0 && (
                <p className="text-center py-12 text-muted text-sm">No hay fichas para este filtro</p>
              )}
            </div>
          </div>
        )}

        {/* Vídeos */}
        {activeTab === 'Vídeos' && (
          <div>
            <FamilyFilter value={filterFamily} onChange={setFilterFamily} />
            {loadingVideos && <div className="flex justify-center py-10"><Spinner /></div>}
            <div className="flex flex-col gap-3">
              {videos?.map(vid => {
                const meta = FAMILY_META[vid.familyId]
                return (
                  <button key={vid.id} onClick={() => setActiveVideo(vid)}
                    className="w-full text-left overflow-hidden active:scale-[0.98] transition-transform"
                    style={card}>
                    <div className="h-44 flex items-center justify-center relative overflow-hidden"
                      style={{ background: meta?.gradient ?? '#F2EFE9' }}>
                      <span className="text-6xl opacity-70">{meta?.emoji ?? '🎬'}</span>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14  flex items-center justify-center"
                          style={{ background: 'rgba(253,252,250,0.90)', boxShadow: '0 4px 20px rgba(44,44,40,0.15)' }}>
                          <span className="text-charcoal text-2xl ml-1">▶</span>
                        </div>
                      </div>
                      {vid.duration && (
                        <span className="absolute bottom-3 right-3 text-[10px] px-2.5 py-1 "
                          style={{ background: 'rgba(44,44,40,0.65)', color: '#FDFCFA', backdropFilter: 'blur(8px)' }}>
                          {vid.duration}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      {meta && <p className="text-[10px] font-medium mb-0.5" style={{ color: meta.color }}>
                        {meta.emoji} {meta.name}
                      </p>}
                      <h3 className="font-serif text-base text-charcoal mb-1">{vid.title}</h3>
                      <p className="text-xs text-muted line-clamp-2 leading-relaxed">{vid.description}</p>
                    </div>
                  </button>
                )
              })}
              {!loadingVideos && videos?.length === 0 && (
                <p className="text-center py-12 text-muted text-sm">No hay vídeos para este filtro</p>
              )}
            </div>
          </div>
        )}
      </div>

      {activeVideo && <VideoModal vid={activeVideo} onClose={() => setActiveVideo(null)} />}
      {activeNews  && <NewsModal  item={activeNews}  onClose={() => setActiveNews(null)} />}
    </div>
  )
}
