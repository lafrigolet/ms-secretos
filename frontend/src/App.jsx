import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { CartProvider } from './context/CartContext.jsx'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import { useIsMobile } from './hooks/useIsMobile.js'
import { Spinner } from './components/Spinner.jsx'

// Static imports (shared infrastructure — always needed)
import { Layout }       from './components/Layout.jsx'
import { MobileLayout } from './components/mobile/MobileLayout.jsx'

// Desktop pages — lazy loaded
const LoginPage          = lazy(() => import('./pages/LoginPage.jsx').then(m => ({ default: m.LoginPage })))
const CatalogPage        = lazy(() => import('./pages/CatalogPage.jsx').then(m => ({ default: m.CatalogPage })))
const ProductPage        = lazy(() => import('./pages/ProductPage.jsx').then(m => ({ default: m.ProductPage })))
const CartPage           = lazy(() => import('./pages/CartPage.jsx').then(m => ({ default: m.CartPage })))
const OrdersPage         = lazy(() => import('./pages/OrdersPage.jsx').then(m => ({ default: m.OrdersPage })))
const AdminPage          = lazy(() => import('./pages/AdminPage.jsx').then(m => ({ default: m.AdminPage })))
const ReturnsPage        = lazy(() => import('./pages/ReturnsPage.jsx').then(m => ({ default: m.ReturnsPage })))
const NewReturnPage      = lazy(() => import('./pages/NewReturnPage.jsx').then(m => ({ default: m.NewReturnPage })))
const TrainingPage       = lazy(() => import('./pages/TrainingPage.jsx').then(m => ({ default: m.TrainingPage })))
const IntelligencePage   = lazy(() => import('./pages/IntelligencePage.jsx').then(m => ({ default: m.IntelligencePage })))
const CommercialPage     = lazy(() => import('./pages/CommercialPage.jsx').then(m => ({ default: m.CommercialPage })))
const NotificationsPage  = lazy(() => import('./pages/NotificationsPage.jsx').then(m => ({ default: m.NotificationsPage })))
const SustainabilityPage = lazy(() => import('./pages/SustainabilityPage.jsx').then(m => ({ default: m.SustainabilityPage })))
const SubscriptionPage   = lazy(() => import('./pages/SubscriptionPage.jsx').then(m => ({ default: m.SubscriptionPage })))

// Mobile pages — lazy loaded
const MobileLoginPage          = lazy(() => import('./pages/mobile/MobileLoginPage.jsx').then(m => ({ default: m.MobileLoginPage })))
const MobileCatalogPage        = lazy(() => import('./pages/mobile/MobileCatalogPage.jsx').then(m => ({ default: m.MobileCatalogPage })))
const MobileProductPage        = lazy(() => import('./pages/mobile/MobileProductPage.jsx').then(m => ({ default: m.MobileProductPage })))
const MobileCartPage           = lazy(() => import('./pages/mobile/MobileCartPage.jsx').then(m => ({ default: m.MobileCartPage })))
const MobileOrdersPage         = lazy(() => import('./pages/mobile/MobileOrdersPage.jsx').then(m => ({ default: m.MobileOrdersPage })))
const MobileAdminPage          = lazy(() => import('./pages/mobile/MobileAdminPage.jsx').then(m => ({ default: m.MobileAdminPage })))
const MobileReturnsPage        = lazy(() => import('./pages/mobile/MobileReturnsPage.jsx').then(m => ({ default: m.MobileReturnsPage })))
const MobileNewReturnPage      = lazy(() => import('./pages/mobile/MobileNewReturnPage.jsx').then(m => ({ default: m.MobileNewReturnPage })))
const MobileTrainingPage       = lazy(() => import('./pages/mobile/MobileTrainingPage.jsx').then(m => ({ default: m.MobileTrainingPage })))
const MobileIntelligencePage   = lazy(() => import('./pages/mobile/MobileIntelligencePage.jsx').then(m => ({ default: m.MobileIntelligencePage })))
const MobileCommercialPage     = lazy(() => import('./pages/mobile/MobileCommercialPage.jsx').then(m => ({ default: m.MobileCommercialPage })))
const MobileNotificationsPage  = lazy(() => import('./pages/mobile/MobileNotificationsPage.jsx').then(m => ({ default: m.MobileNotificationsPage })))
const MobileSustainabilityPage = lazy(() => import('./pages/mobile/MobileSustainabilityPage.jsx').then(m => ({ default: m.MobileSustainabilityPage })))
const MobileSubscriptionPage   = lazy(() => import('./pages/mobile/MobileSubscriptionPage.jsx').then(m => ({ default: m.MobileSubscriptionPage })))

const fallback = (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <Spinner size="lg" />
  </div>
)

function AppRoutes () {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Suspense fallback={fallback}>
        <Routes>
          <Route path="/login" element={<MobileLoginPage />} />

          <Route path="/catalog" element={
            <ProtectedRoute><MobileLayout><MobileCatalogPage /></MobileLayout></ProtectedRoute>
          } />
          <Route path="/catalog/:sapCode" element={
            <ProtectedRoute><MobileLayout><MobileProductPage /></MobileLayout></ProtectedRoute>
          } />
          <Route path="/cart" element={
            <ProtectedRoute><MobileLayout><MobileCartPage /></MobileLayout></ProtectedRoute>
          } />
          <Route path="/orders" element={
            <ProtectedRoute><MobileLayout><MobileOrdersPage /></MobileLayout></ProtectedRoute>
          } />
          <Route path="/returns" element={
            <ProtectedRoute><MobileLayout><MobileReturnsPage /></MobileLayout></ProtectedRoute>
          } />
          <Route path="/returns/new" element={
            <ProtectedRoute><MobileLayout><MobileNewReturnPage /></MobileLayout></ProtectedRoute>
          } />
          <Route path="/training" element={
            <ProtectedRoute><MobileLayout><MobileTrainingPage /></MobileLayout></ProtectedRoute>
          } />
          <Route path="/intelligence" element={
            <ProtectedRoute><MobileLayout><MobileIntelligencePage /></MobileLayout></ProtectedRoute>
          } />
          <Route path="/commercial" element={
            <ProtectedRoute><MobileLayout><MobileCommercialPage /></MobileLayout></ProtectedRoute>
          } />
          <Route path="/notifications" element={
            <ProtectedRoute><MobileLayout><MobileNotificationsPage /></MobileLayout></ProtectedRoute>
          } />
          <Route path="/sustainability" element={
            <ProtectedRoute><MobileLayout><MobileSustainabilityPage /></MobileLayout></ProtectedRoute>
          } />
          <Route path="/subscription" element={
            <ProtectedRoute><MobileLayout><MobileSubscriptionPage /></MobileLayout></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute adminOnly><MobileLayout><MobileAdminPage /></MobileLayout></ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/catalog" replace />} />
          <Route path="*" element={<Navigate to="/catalog" replace />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <Suspense fallback={fallback}>
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
        <Route path="/notifications" element={
          <ProtectedRoute><Layout><NotificationsPage /></Layout></ProtectedRoute>
        } />
        <Route path="/sustainability" element={
          <ProtectedRoute><Layout><SustainabilityPage /></Layout></ProtectedRoute>
        } />
        <Route path="/subscription" element={
          <ProtectedRoute><Layout><SubscriptionPage /></Layout></ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute adminOnly><Layout><AdminPage /></Layout></ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to="/catalog" replace />} />
        <Route path="*" element={<Navigate to="/catalog" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App () {
  return (
    <CartProvider>
      <AppRoutes />
    </CartProvider>
  )
}
