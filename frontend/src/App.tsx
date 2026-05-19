import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InstallPrompt } from './components/InstallPrompt';

// Register the PWA service worker early so the install prompt can fire
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
}

import { LoginPage } from './pages/LoginPage';
import { MenuPage } from './pages/customer/MenuPage';
import { CartPage } from './pages/customer/CartPage';
import { OrderSuccessPage } from './pages/customer/OrderSuccessPage';
import { OrderHistoryPage } from './pages/customer/OrderHistoryPage';
import { TakeawayMenuPage } from './pages/customer/TakeawayMenuPage';
import { RoomMenuPage } from './pages/customer/RoomMenuPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { OrdersPage } from './pages/admin/OrdersPage';
import { MenuItemsPage } from './pages/admin/MenuItemsPage';
import { TablesPage } from './pages/admin/TablesPage';
import { KitchenPage } from './pages/admin/KitchenPage';
import { ReceiptPage } from './pages/admin/ReceiptPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { BillsPage } from './pages/admin/BillsPage';
import { SessionReceiptPage } from './pages/admin/SessionReceiptPage';
import { RestaurantsPage } from './pages/admin/RestaurantsPage';
import { TakeawayOrderPage } from './pages/admin/TakeawayOrderPage';
import { NewOrderPage } from './pages/admin/NewOrderPage';
import { ReadyDisplayPage } from './pages/admin/ReadyDisplayPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { RoomsPage } from './pages/admin/RoomsPage';
import { PromoCodesPage } from './pages/admin/PromoCodesPage';
import { RoomChargesPage } from './pages/admin/RoomChargesPage';
import { WaitersPage } from './pages/admin/WaitersPage';
import { ReservationsPage } from './pages/admin/ReservationsPage';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'kitchen') return <Navigate to="/kitchen" replace />;
  if (user.role === 'super_admin') return <Navigate to="/admin/restaurants" replace />;
  return <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CurrencyProvider>
        <ThemeProvider>
        <CartProvider>
          <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
          <InstallPrompt />
          <Routes>
            {/* Root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />

            {/* Customer routes — public, no auth required */}
            <Route path="/menu/:tableId" element={<MenuPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/order-success/:orderId" element={<OrderSuccessPage />} />
            <Route path="/order-history/:tableId" element={<OrderHistoryPage />} />
            <Route path="/takeaway/:restaurantId" element={<TakeawayMenuPage />} />
            <Route path="/room/:roomId" element={<RoomMenuPage />} />

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute role="admin"><DashboardPage /></ProtectedRoute>} />
            <Route path="/admin/orders" element={<ProtectedRoute role="admin"><OrdersPage /></ProtectedRoute>} />
            <Route path="/admin/menu" element={<ProtectedRoute role="admin"><MenuItemsPage /></ProtectedRoute>} />
            <Route path="/admin/tables" element={<ProtectedRoute role="admin"><TablesPage /></ProtectedRoute>} />
            <Route path="/receipt/:orderId" element={<ProtectedRoute role="admin"><ReceiptPage /></ProtectedRoute>} />
            <Route path="/session-receipt/:sessionId" element={<ProtectedRoute role="admin"><SessionReceiptPage /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute role="admin"><SettingsPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute role="admin"><UsersPage /></ProtectedRoute>} />
            <Route path="/admin/bills" element={<ProtectedRoute role="admin"><BillsPage /></ProtectedRoute>} />
            <Route path="/admin/restaurants" element={<ProtectedRoute role="super_admin"><RestaurantsPage /></ProtectedRoute>} />
            <Route path="/admin/takeaway" element={<ProtectedRoute role="admin"><TakeawayOrderPage /></ProtectedRoute>} />
            <Route path="/admin/new-order" element={<ProtectedRoute role="admin"><NewOrderPage /></ProtectedRoute>} />
            <Route path="/admin/ready-display" element={<ProtectedRoute role="any"><ReadyDisplayPage /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute role="admin"><ReportsPage /></ProtectedRoute>} />
            <Route path="/admin/rooms" element={<ProtectedRoute role="admin"><RoomsPage /></ProtectedRoute>} />
            <Route path="/admin/promo-codes" element={<ProtectedRoute role="admin"><PromoCodesPage /></ProtectedRoute>} />
            <Route path="/admin/room-charges" element={<ProtectedRoute role="admin"><RoomChargesPage /></ProtectedRoute>} />
            <Route path="/admin/waiters"       element={<ProtectedRoute role="admin"><WaitersPage /></ProtectedRoute>} />
            <Route path="/admin/reservations" element={<ProtectedRoute role="admin"><ReservationsPage /></ProtectedRoute>} />

            {/* Kitchen — accessible by both kitchen and admin */}
            <Route path="/kitchen" element={<ProtectedRoute role="any"><KitchenPage /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
        </ThemeProvider>
        </CurrencyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
