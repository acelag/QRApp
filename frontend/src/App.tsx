import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { ThemeProvider } from './context/ThemeContext';
import { TagsProvider } from './context/TagsContext';
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
import { PhoneLookupPage } from './pages/customer/PhoneLookupPage';
import { WelcomePage } from './pages/customer/WelcomePage';
import { TakeawayMenuPage } from './pages/customer/TakeawayMenuPage';
import { RoomMenuPage } from './pages/customer/RoomMenuPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { OrdersPage } from './pages/admin/OrdersPage';
import { MenuItemsPage } from './pages/admin/MenuItemsPage';
import { KitchenPage } from './pages/admin/KitchenPage';
import { ReceiptPage } from './pages/admin/ReceiptPage';
import { KitchenTicketPage } from './pages/admin/KitchenTicketPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { BillsPage } from './pages/admin/BillsPage';
import { SessionReceiptPage } from './pages/admin/SessionReceiptPage';
import { RestaurantsPage } from './pages/admin/RestaurantsPage';
import { TakeawayOrderPage } from './pages/admin/TakeawayOrderPage';
import { NewOrderPage } from './pages/admin/NewOrderPage';
import { ReadyDisplayPage } from './pages/admin/ReadyDisplayPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { PromoCodesPage } from './pages/admin/PromoCodesPage';
import { RoomChargesPage } from './pages/admin/RoomChargesPage';
import { WaitersPage } from './pages/admin/WaitersPage';
import { StaffPerformancePage } from './pages/admin/StaffPerformancePage';
import { TableStatusPage } from './pages/admin/TableStatusPage';
import { LocationsPage } from './pages/admin/LocationsPage';

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
        <TagsProvider>
        <CartProvider>
          <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
          <InstallPrompt />
          <Routes>
            {/* Root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />

            {/* Customer routes — public, no auth required */}
            <Route path="/welcome/:tableId" element={<WelcomePage />} />
            <Route path="/menu/:tableId" element={<MenuPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/order-success/:orderId" element={<OrderSuccessPage />} />
            <Route path="/order-history/:tableId" element={<OrderHistoryPage />} />
            <Route path="/my-orders" element={<PhoneLookupPage />} />
            <Route path="/takeaway/:restaurantId" element={<TakeawayMenuPage />} />
            <Route path="/room/:roomId" element={<RoomMenuPage />} />

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute roles={['admin','manager','cashier','waiter']}><DashboardPage /></ProtectedRoute>} />
            <Route path="/admin/orders" element={<ProtectedRoute roles={['admin','manager','cashier','waiter']}><OrdersPage /></ProtectedRoute>} />
            <Route path="/admin/menu" element={<ProtectedRoute roles={['admin','manager']}><MenuItemsPage /></ProtectedRoute>} />
            <Route path="/admin/locations" element={<ProtectedRoute roles={['admin','manager']}><LocationsPage /></ProtectedRoute>} />
            <Route path="/admin/tables" element={<Navigate to="/admin/locations" replace />} />
            <Route path="/receipt/:orderId" element={<ProtectedRoute roles={['admin','manager','cashier']}><ReceiptPage /></ProtectedRoute>} />
            <Route path="/kitchen-ticket/:orderId" element={<ProtectedRoute><KitchenTicketPage /></ProtectedRoute>} />
            <Route path="/session-receipt/:sessionId" element={<ProtectedRoute roles={['admin','manager','cashier']}><SessionReceiptPage /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
            <Route path="/admin/bills" element={<ProtectedRoute roles={['admin','manager','cashier']}><BillsPage /></ProtectedRoute>} />
            <Route path="/admin/restaurants" element={<ProtectedRoute roles={['super_admin']}><RestaurantsPage /></ProtectedRoute>} />
            <Route path="/admin/takeaway" element={<ProtectedRoute roles={['admin','manager','cashier','waiter']}><TakeawayOrderPage /></ProtectedRoute>} />
            <Route path="/admin/new-order" element={<ProtectedRoute roles={['admin','manager','cashier','waiter']}><NewOrderPage /></ProtectedRoute>} />
            <Route path="/admin/ready-display" element={<ProtectedRoute><ReadyDisplayPage /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute roles={['admin','manager']}><ReportsPage /></ProtectedRoute>} />
            <Route path="/admin/rooms" element={<Navigate to="/admin/locations" replace />} />
            <Route path="/admin/promo-codes" element={<ProtectedRoute roles={['admin','manager']}><PromoCodesPage /></ProtectedRoute>} />
            <Route path="/admin/room-charges" element={<ProtectedRoute roles={['admin','manager','cashier']}><RoomChargesPage /></ProtectedRoute>} />
            <Route path="/admin/waiters" element={<ProtectedRoute roles={['admin','manager']}><WaitersPage /></ProtectedRoute>} />
            <Route path="/admin/staff-performance" element={<ProtectedRoute roles={['admin','manager']}><StaffPerformancePage /></ProtectedRoute>} />
            <Route path="/admin/table-status" element={<ProtectedRoute roles={['admin','manager','cashier','waiter']}><TableStatusPage /></ProtectedRoute>} />

            {/* Kitchen — accessible by kitchen, admin and manager */}
            <Route path="/kitchen" element={<ProtectedRoute roles={['admin','manager','kitchen']}><KitchenPage /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
        </TagsProvider>
        </ThemeProvider>
        </CurrencyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
