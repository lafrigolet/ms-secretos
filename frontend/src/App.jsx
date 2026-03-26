import { Routes, Route, Navigate } from 'react-router-dom'
import { CartProvider } from './context/CartContext.jsx'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import { useIsMobile } from './hooks/useIsMobile.js'

// Desktop layout + pages
import { Layout }             from './components/Layout.jsx'
import { LoginPage }          from './pages/LoginPage.jsx'
import { CatalogPage }        from './pages/CatalogPage.jsx'
import { ProductPage }        from './pages/ProductPage.jsx'
import { CartPage }           from './pages/CartPage.jsx'
import { OrdersPage }         from './pages/OrdersPage.jsx'
import { AdminPage }          from './pages/AdminPage.jsx'
import { ReturnsPage }        from './pages/ReturnsPage.jsx'
import { NewReturnPage }      from './pages/NewReturnPage.jsx'
import { TrainingPage }       from './pages/TrainingPage.jsx'
import { IntelligencePage }   from './pages/IntelligencePage.jsx'
import { CommercialPage }     from './pages/CommercialPage.jsx'
import { NotificationsPage }  from './pages/NotificationsPage.jsx'
import { SustainabilityPage } from './pages/SustainabilityPage.jsx'

// Mobile layout + pages
import { MobileLayout }             from './components/mobile/MobileLayout.jsx'
import { MobileLoginPage }          from './pages/mobile/MobileLoginPage.jsx'
import { MobileCatalogPage }        from './pages/mobile/MobileCatalogPage.jsx'
import { MobileProductPage }        from './pages/mobile/MobileProductPage.jsx'
import { MobileCartPage }           from './pages/mobile/MobileCartPage.jsx'
import { MobileOrdersPage }         from './pages/mobile/MobileOrdersPage.jsx'
import { MobileAdminPage }          from './pages/mobile/MobileAdminPage.jsx'
import { MobileReturnsPage }        from './pages/mobile/MobileReturnsPage.jsx'
import { MobileNewReturnPage }      from './pages/mobile/MobileNewReturnPage.jsx'
import { MobileTrainingPage }       from './pages/mobile/MobileTrainingPage.jsx'
import { MobileIntelligencePage }   from './pages/mobile/MobileIntelligencePage.jsx'
import { MobileCommercialPage }     from './pages/mobile/MobileCommercialPage.jsx'
import { MobileNotificationsPage }  from './pages/mobile/MobileNotificationsPage.jsx'
import { MobileSustainabilityPage } from './pages/mobile/MobileSustainabilityPage.jsx'

function AppRoutes () {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
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
        <Route path="/admin" element={
          <ProtectedRoute adminOnly><MobileLayout><MobileAdminPage /></MobileLayout></ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to="/catalog" replace />} />
        <Route path="*" element={<Navigate to="/catalog" replace />} />
      </Routes>
    )
  }

  return (
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
      <Route path="/admin" element={
        <ProtectedRoute adminOnly><Layout><AdminPage /></Layout></ProtectedRoute>
      } />

      <Route path="/" element={<Navigate to="/catalog" replace />} />
      <Route path="*" element={<Navigate to="/catalog" replace />} />
    </Routes>
  )
}

export default function App () {
  return (
    <CartProvider>
      <AppRoutes />
    </CartProvider>
  )
}
