import { Routes, Route, Navigate } from 'react-router-dom'
import { CartProvider } from './context/CartContext.jsx'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import { Layout } from './components/Layout.jsx'
import { LoginPage }     from './pages/LoginPage.jsx'
import { CatalogPage }   from './pages/CatalogPage.jsx'
import { ProductPage }   from './pages/ProductPage.jsx'
import { CartPage }      from './pages/CartPage.jsx'
import { OrdersPage }    from './pages/OrdersPage.jsx'
import { AdminPage }     from './pages/AdminPage.jsx'
import { ReturnsPage }   from './pages/ReturnsPage.jsx'
import { NewReturnPage } from './pages/NewReturnPage.jsx'
import { TrainingPage }     from './pages/TrainingPage.jsx'
import { IntelligencePage } from './pages/IntelligencePage.jsx'
import { CommercialPage }   from './pages/CommercialPage.jsx'

export default function App () {
  return (
    <CartProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/catalog" element={
          <ProtectedRoute><Layout><CatalogPage /></Layout></ProtectedRoute>
        } />
        <Route path="/catalog/:sapCode" element={
          <ProtectedRoute><Layout><ProductPage /></Layout></ProtectedRoute>
        } />
        <Route path="/cart" element={
          <ProtectedRoute><Layout><CartPage /></Layout></ProtectedRoute>
        } />
        <Route path="/orders" element={
          <ProtectedRoute><Layout><OrdersPage /></Layout></ProtectedRoute>
        } />
        <Route path="/returns" element={
          <ProtectedRoute><Layout><ReturnsPage /></Layout></ProtectedRoute>
        } />
        <Route path="/returns/new" element={
          <ProtectedRoute><Layout><NewReturnPage /></Layout></ProtectedRoute>
        } />
        <Route path="/training" element={
          <ProtectedRoute><Layout><TrainingPage /></Layout></ProtectedRoute>
        } />
        <Route path="/intelligence" element={
          <ProtectedRoute><Layout><IntelligencePage /></Layout></ProtectedRoute>
        } />
        <Route path="/commercial" element={
          <ProtectedRoute><Layout><CommercialPage /></Layout></ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute adminOnly><Layout><AdminPage /></Layout></ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to="/catalog" replace />} />
        <Route path="*" element={<Navigate to="/catalog" replace />} />
      </Routes>
    </CartProvider>
  )
}
