import { Routes, Route, Navigate } from 'react-router-dom'
import { CartProvider } from './context/CartContext.jsx'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import { Layout } from './components/Layout.jsx'
import { LoginPage } from './pages/LoginPage.jsx'

// Páginas pendientes de implementar en siguientes iteraciones
function ComingSoon ({ title }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-16 h-16 bg-sage-light/30 rounded-full flex items-center justify-center mb-6">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4A5740" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      </div>
      <h2 className="font-serif text-3xl font-light text-charcoal mb-2">{title}</h2>
      <p className="text-muted text-sm">Esta sección está en desarrollo · Próxima iteración</p>
    </div>
  )
}

export default function App () {
  return (
    <CartProvider>
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protegidas */}
        <Route path="/catalog" element={
          <ProtectedRoute>
            <Layout><ComingSoon title="Catálogo de productos" /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/catalog/:sapCode" element={
          <ProtectedRoute>
            <Layout><ComingSoon title="Ficha de producto" /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/cart" element={
          <ProtectedRoute>
            <Layout><ComingSoon title="Cesta de la compra" /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/orders" element={
          <ProtectedRoute>
            <Layout><ComingSoon title="Mis pedidos" /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/orders/:orderId" element={
          <ProtectedRoute>
            <Layout><ComingSoon title="Detalle de pedido" /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute adminOnly>
            <Layout><ComingSoon title="Panel de administración" /></Layout>
          </ProtectedRoute>
        } />

        {/* Redireccionamiento */}
        <Route path="/" element={<Navigate to="/catalog" replace />} />
        <Route path="*" element={<Navigate to="/catalog" replace />} />
      </Routes>
    </CartProvider>
  )
}
