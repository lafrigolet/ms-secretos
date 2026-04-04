import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useCartContext } from '../../context/CartContext.jsx'
import { Logo } from '../Logo.jsx'

const MORE_LINKS = [
  { to: '/returns',        icon: '↩', label: 'Devoluciones',  color: '#F4EDE4', tint: '#8C6E52' },
  { to: '/training',       icon: '📚', label: 'Formación',     color: '#EEF4EA', tint: '#4A7054' },
  { to: '/intelligence',   icon: '📊', label: 'Mis datos',     color: '#EBF0F4', tint: '#3A5F8A' },
  { to: '/commercial',     icon: '👤', label: 'Mi comercial',  color: '#F4EDE4', tint: '#8C6E52' },
  { to: '/notifications',  icon: '🔔', label: 'Notificaciones',color: '#F7F3E8', tint: '#B8963C' },
  { to: '/sustainability', icon: '🌿', label: 'Sostenibilidad',color: '#EEF4EA', tint: '#4A7054' },
  { to: '/subscription',  icon: '💳', label: 'Suscripción',   color: '#F7F3E8', tint: '#B8963C' },
]

const MORE_PATHS = MORE_LINKS.map(l => l.to)

function MoreDrawer ({ onClose }) {
  const navigate = useNavigate()
  const { user, logout, isAdmin } = useAuth()

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const profileGrad = {
    VIP:      'linear-gradient(135deg,#4A5740,#B8963C)',
    PREMIUM:  'linear-gradient(135deg,#4A5740,#6B7B5E)',
    STANDARD: 'linear-gradient(135deg,#6B7B5E,#8A8880)',
  }

  async function handleLogout () {
    await logout()
    navigate('/login')
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1 bg-charcoal/50 backdrop-blur-sm" />
      <div
        className="bg-[#FDFCFA] overflow-y-auto"
        style={{
          maxHeight: '88vh',
          boxShadow: '0 -8px 48px rgba(44,44,40,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-border" />
        </div>

        {/* User hero */}
        <div
          className="mx-4 mt-3 mb-4 p-4 flex items-center gap-3"
          style={{ background: profileGrad[user?.profile] ?? profileGrad.STANDARD }}
        >
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm  flex items-center justify-center text-white text-base font-medium flex-shrink-0 border border-white/30">
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{user?.name}</p>
            <p className="text-[11px] text-white/70">{user?.sapCode} · Perfil {user?.profile}</p>
          </div>
        </div>

        {/* Links — 2-column grid */}
        <div className="px-4 grid grid-cols-2 gap-2.5 mb-4">
          {MORE_LINKS.map(link => (
            <button
              key={link.to}
              onClick={() => { navigate(link.to); onClose() }}
              className="flex items-center gap-3 px-4 py-3.5  text-left transition-all active:scale-[0.97]"
              style={{ background: link.color }}
            >
              <span className="text-xl">{link.icon}</span>
              <span className="text-sm font-medium" style={{ color: link.tint }}>{link.label}</span>
            </button>
          ))}

          {isAdmin && (
            <button
              onClick={() => { navigate('/admin'); onClose() }}
              className="flex items-center gap-3 px-4 py-3.5  text-left col-span-2 active:scale-[0.97]"
              style={{ background: '#EEF4EA' }}
            >
              <span className="text-xl">⚙️</span>
              <span className="text-sm font-medium text-sage-dark">Panel de administración</span>
              <span className="ml-auto text-muted text-lg">›</span>
            </button>
          )}
        </div>

        {/* Logout */}
        <div className="px-4 pb-2">
          <button
            onClick={handleLogout}
            className="w-full py-4  bg-cream text-sm text-error font-medium transition-all active:scale-[0.98]"
          >
            Cerrar sesión
          </button>
        </div>
        <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }} />
      </div>
    </div>
  )
}

function BottomNav () {
  const { itemCount } = useCartContext()
  const location      = useLocation()
  const [showMore, setShowMore] = useState(false)

  const isMoreActive = MORE_PATHS.some(p => location.pathname.startsWith(p))

  const tabs = [
    {
      to: '/catalog',
      label: 'Catálogo',
      icon: (active) => (
        <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? '#4A5740' : 'none'} stroke={active ? '#4A5740' : '#B0ADA7'} strokeWidth="1.7">
          <rect x="3" y="3" width="7" height="7" rx="1.5"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5"/>
        </svg>
      ),
    },
    {
      to: '/cart',
      label: 'Cesta',
      icon: (active) => (
        <div className="relative">
          <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? '#4A5740' : 'none'} stroke={active ? '#4A5740' : '#B0ADA7'} strokeWidth="1.7">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          {itemCount > 0 && (
            <span className="absolute -top-2 -right-2 min-w-[17px] h-[17px] bg-gold text-white  flex items-center justify-center text-[9px] font-semibold px-1"
              style={{ boxShadow: '0 2px 6px rgba(184,150,60,0.5)' }}>
              {itemCount}
            </span>
          )}
        </div>
      ),
    },
    {
      to: '/orders',
      label: 'Pedidos',
      icon: (active) => (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? '#4A5740' : '#B0ADA7'} strokeWidth="1.7">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <path d="M9 12h6M9 16h4"/>
        </svg>
      ),
    },
  ]

  const moreIcon = (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <circle cx="5"  cy="12" r="1.5" fill={isMoreActive ? '#4A5740' : '#B0ADA7'}/>
      <circle cx="12" cy="12" r="1.5" fill={isMoreActive ? '#4A5740' : '#B0ADA7'}/>
      <circle cx="19" cy="12" r="1.5" fill={isMoreActive ? '#4A5740' : '#B0ADA7'}/>
    </svg>
  )

  return (
    <>
      {showMore && <MoreDrawer onClose={() => setShowMore(false)} />}

      <nav
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: 'rgba(253,252,250,0.92)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: '0 -1px 0 rgba(226,221,214,0.6), 0 -4px 24px rgba(44,44,40,0.06)',
        }}
      >
        <div className="flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {tabs.map(tab => {
            const isActive = location.pathname.startsWith(tab.to)
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className="flex-1 flex flex-col items-center justify-center pt-2.5 pb-2 gap-0.5 min-h-[56px] relative"
              >
                {({ isActive: routerActive }) => (
                  <>
                    {/* Active pill background */}
                    {(routerActive || isActive) && (
                      <span className="absolute top-1.5 w-12 h-7 bg-sage-light/30  -z-10" />
                    )}
                    {tab.icon(isActive || routerActive)}
                    <span className={`text-[10px] font-medium mt-0.5 ${isActive ? 'text-sage-dark' : 'text-muted/70'}`}>
                      {tab.label}
                    </span>
                  </>
                )}
              </NavLink>
            )
          })}

          <button
            onClick={() => setShowMore(true)}
            className="flex-1 flex flex-col items-center justify-center pt-2.5 pb-2 gap-0.5 min-h-[56px] relative"
          >
            {isMoreActive && (
              <span className="absolute top-1.5 w-12 h-7 bg-sage-light/30  -z-10" />
            )}
            {moreIcon}
            <span className={`text-[10px] font-medium mt-0.5 ${isMoreActive ? 'text-sage-dark' : 'text-muted/70'}`}>
              Más
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}

function TopBar ({ showBack }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAdmin } = useAuth()

  // Derive title from route
  const titleMap = {
    '/cart':           'Cesta',
    '/orders':         'Pedidos',
    '/returns/new':    'Nueva devolución',
    '/returns':        'Devoluciones',
    '/training':       'Formación',
    '/intelligence':   'Inteligencia',
    '/commercial':     'Mi comercial',
    '/notifications':  'Notificaciones',
    '/sustainability': 'Sostenibilidad',
    '/subscription':  'Suscripción',
    '/admin':         'Administración',
  }
  const isProductPage = /^\/catalog\/.+/.test(location.pathname)
  const titleFromMap  = titleMap[location.pathname]

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex items-center px-4 gap-3"
      style={{
        height: '52px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'rgba(253,252,250,0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: '0 1px 0 rgba(226,221,214,0.6)',
      }}
    >
      {showBack ? (
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 -ml-1 flex items-center justify-center  bg-cream text-charcoal transition-all active:scale-90"
          style={{ boxShadow: '0 1px 4px rgba(44,44,40,0.08)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
      ) : (
        <div
          className="w-9 h-9  bg-cream flex items-center justify-center flex-shrink-0"
          style={{ boxShadow: '0 1px 4px rgba(44,44,40,0.08)' }}
        >
          <Logo size={22} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        {titleFromMap || isProductPage ? (
          <h1 className="font-serif text-[17px] text-charcoal truncate">
            {isProductPage ? 'Detalle de producto' : titleFromMap}
          </h1>
        ) : (
          <>
            <div className="font-serif text-[15px] tracking-wide text-charcoal leading-none">
              Secretos del Agua
            </div>
            <div className="text-[9px] tracking-[0.12em] uppercase text-muted mt-0.5">
              {isAdmin ? 'Administración' : `Portal B2B · ${user?.profile ?? ''}`}
            </div>
          </>
        )}
      </div>
    </header>
  )
}

const SUB_PAGES = ['/catalog/', '/returns/new', '/cart', '/orders', '/returns', '/training', '/intelligence', '/commercial', '/notifications', '/sustainability', '/subscription', '/admin']

export function MobileLayout ({ children }) {
  const location = useLocation()
  const { isAdmin } = useAuth()

  const isSubPage =
    location.pathname.includes('/catalog/') ||
    location.pathname === '/returns/new' ||
    (location.pathname !== '/catalog' &&
      SUB_PAGES.some(p => location.pathname === p))

  return (
    <div className="min-h-screen bg-[#F2EFE9] flex flex-col">
      <TopBar showBack={isSubPage} />

      <main
        className="flex-1 pt-[52px] overflow-y-auto"
        style={{ paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </main>

      {!isAdmin && <BottomNav />}

      {isAdmin && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            background: 'rgba(253,252,250,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 -1px 0 rgba(226,221,214,0.6)',
          }}
        >
          <NavLink to="/admin"
            className="flex-1 flex flex-col items-center justify-center pt-2.5 pb-2 gap-0.5 min-h-[56px]">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#4A5740" strokeWidth="1.7">
              <path d="M12 2l9 4.5V11c0 5.25-3.75 10.15-9 11.5C6.75 21.15 3 16.25 3 11V6.5L12 2z"/>
            </svg>
            <span className="text-[10px] font-medium text-sage-dark mt-0.5">Admin</span>
          </NavLink>
        </nav>
      )}
    </div>
  )
}
