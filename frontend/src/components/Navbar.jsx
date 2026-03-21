import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useCartContext } from '../context/CartContext.jsx'
import { Logo } from './Logo.jsx'

export function Navbar () {
  const { user, logout, isAdmin } = useAuth()
  const { itemCount } = useCartContext()
  const navigate = useNavigate()

  async function handleLogout () {
    await logout()
    navigate('/login')
  }

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <nav className="bg-off-white border-b border-border px-10 h-16 flex items-center justify-between sticky top-0 z-50">

      {/* Brand */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/catalog')}>
        <Logo size={36} />
        <div>
          <div className="font-serif text-[17px] tracking-[0.08em] uppercase text-charcoal">
            Secretos del Agua
          </div>
          <div className="text-[10px] tracking-[0.12em] uppercase text-muted -mt-0.5">
            {isAdmin ? 'Panel de Administración' : 'Portal de Pedidos'}
          </div>
        </div>
      </div>

      {/* Navigation links */}
      <div className="flex items-center gap-2">
        {!isAdmin && (
          <>
            <NavLink to="/catalog" className={({ isActive }) =>
              `text-sm px-3.5 py-2 rounded-md transition-colors ${isActive
                ? 'text-sage-dark font-medium bg-sage-light/20'
                : 'text-muted hover:text-sage-dark hover:bg-sage-light/20'}`
            }>
              Catálogo
            </NavLink>
            <NavLink to="/orders" className={({ isActive }) =>
              `text-sm px-3.5 py-2 rounded-md transition-colors ${isActive
                ? 'text-sage-dark font-medium bg-sage-light/20'
                : 'text-muted hover:text-sage-dark hover:bg-sage-light/20'}`
            }>
              Mis pedidos
            </NavLink>
            <NavLink to="/returns" className={({ isActive }) =>
              `text-sm px-3.5 py-2 rounded-md transition-colors ${isActive
                ? 'text-sage-dark font-medium bg-sage-light/20'
                : 'text-muted hover:text-sage-dark hover:bg-sage-light/20'}`
            }>
              Devoluciones
            </NavLink>
            <NavLink to="/training" className={({ isActive }) =>
              `text-sm px-3.5 py-2 rounded-md transition-colors ${isActive
                ? 'text-sage-dark font-medium bg-sage-light/20'
                : 'text-muted hover:text-sage-dark hover:bg-sage-light/20'}`
            }>
              Formación
            </NavLink>
            <NavLink to="/intelligence" className={({ isActive }) =>
              `text-sm px-3.5 py-2 rounded-md transition-colors ${isActive
                ? 'text-sage-dark font-medium bg-sage-light/20'
                : 'text-muted hover:text-sage-dark hover:bg-sage-light/20'}`
            }>
              Mis datos
            </NavLink>
            <NavLink to="/commercial" className={({ isActive }) =>
              `text-sm px-3.5 py-2 rounded-md transition-colors ${isActive
                ? 'text-sage-dark font-medium bg-sage-light/20'
                : 'text-muted hover:text-sage-dark hover:bg-sage-light/20'}`
            }>
              Mi comercial
            </NavLink>

            {/* Cart button */}
            <button
              onClick={() => navigate('/cart')}
              className="bg-sage-dark text-off-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 hover:bg-sage transition-colors ml-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              Cesta
              {itemCount > 0 && (
                <span className="bg-gold text-off-white rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-medium">
                  {itemCount}
                </span>
              )}
            </button>
          </>
        )}

        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) =>
            `text-sm px-3.5 py-2 rounded-md transition-colors ${isActive
              ? 'text-sage-dark font-medium'
              : 'text-muted hover:text-sage-dark'}`
          }>
            Panel Admin
          </NavLink>
        )}

        {/* User pill */}
        <div className="flex items-center gap-2 bg-cream border border-border rounded-full py-1.5 pl-1.5 pr-3 ml-2">
          <div className="w-7 h-7 bg-sage-dark rounded-full flex items-center justify-center text-[11px] text-white font-medium">
            {initials}
          </div>
          <div className="leading-tight">
            <div className="text-xs font-medium text-charcoal">{user?.name}</div>
            <div className="text-[10px] text-muted">{user?.sapCode}</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="text-sm text-muted hover:text-charcoal transition-colors px-2 py-1"
        >
          Salir
        </button>
      </div>
    </nav>
  )
}
