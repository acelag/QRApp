import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SubscriptionConfigProvider, useSubscriptionConfig } from './context/SubscriptionConfigContext';
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
import { MenuSetupPage } from './pages/admin/MenuSetupPage';
import { BillingPage } from './pages/admin/BillingPage';
import { PlansAdminPage } from './pages/admin/PlansAdminPage';
import { LandingPage } from './pages/marketing/LandingPage';
import { PricingPage } from './pages/marketing/PricingPage';
import { SignupPage } from './pages/marketing/SignupPage';
import { MockCheckoutPage } from './pages/marketing/MockCheckoutPage';
import { KitchenPage } from './pages/admin/KitchenPage';
import { ReceiptPage } from './pages/admin/ReceiptPage';
import { KitchenTicketPage } from './pages/admin/KitchenTicketPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { BillsPage } from './pages/admin/BillsPage';
import { SessionReceiptPage } from './pages/admin/SessionReceiptPage';
import { RestaurantsPage } from './pages/admin/RestaurantsPage';
import { NewOrderPage } from './pages/admin/NewOrderPage';
import { ReadyDisplayPage } from './pages/admin/ReadyDisplayPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { PromoCodesPage } from './pages/admin/PromoCodesPage';
import { RoomChargesPage } from './pages/admin/RoomChargesPage';
import { WaitersPage } from './pages/admin/WaitersPage';
import { StaffPerformancePage } from './pages/admin/StaffPerformancePage';
import { TableStatusPage } from './pages/admin/TableStatusPage';
import { LocationsPage } from './pages/admin/LocationsPage';
import { ReservationsPage } from './pages/admin/ReservationsPage';
import { ShiftCloseReportPage } from './pages/admin/ShiftCloseReportPage';
import { RosterPage } from './pages/admin/RosterPage';
import { MenuSchedulesPage } from './pages/admin/MenuSchedulesPage';
import { CombosPage } from './pages/admin/CombosPage';
import { StockPage } from './pages/admin/StockPage';
import { StockReportPage } from './pages/admin/StockReportPage';

function RootRedirect() {
  const { user, loading } = useAuth();
  const { loading: cfgLoading } = useSubscriptionConfig();
  if (loading || cfgLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-orange-500" />
    </div>
  );
  // Anonymous: always show the demo launcher landing page.
  if (!user) return <LandingPage />;
  if (user.role === 'kitchen') return <Navigate to="/kitchen" replace />;
  if (user.role === 'super_admin') return <Navigate to="/admin/restaurants" replace />;
  return <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SubscriptionConfigProvider>
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
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/billing/mock-checkout" element={<MockCheckoutPage />} />

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
            <Route path="/admin/orders" element={<ProtectedRoute roles={['admin','manager','cashier','waiter']} permission="orders"><OrdersPage /></ProtectedRoute>} />
            <Route path="/admin/menu" element={<ProtectedRoute roles={['admin','manager']} permission="menu"><MenuItemsPage /></ProtectedRoute>} />
            <Route path="/admin/menu-setup" element={<ProtectedRoute roles={['admin','manager']} permission="menu"><MenuSetupPage /></ProtectedRoute>} />
            <Route path="/admin/locations" element={<ProtectedRoute roles={['admin','manager']} permission="locations"><LocationsPage /></ProtectedRoute>} />
            <Route path="/admin/reservations" element={<ProtectedRoute roles={['admin','manager','cashier','waiter']} permission="locations"><ReservationsPage /></ProtectedRoute>} />
            <Route path="/receipt/:orderId" element={<ProtectedRoute roles={['admin','manager','cashier']}><ReceiptPage /></ProtectedRoute>} />
            <Route path="/kitchen-ticket/:orderId" element={<ProtectedRoute><KitchenTicketPage /></ProtectedRoute>} />
            <Route path="/session-receipt/:sessionId" element={<ProtectedRoute roles={['admin','manager','cashier']}><SessionReceiptPage /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>} />
            <Route path="/admin/billing" element={<ProtectedRoute roles={['admin','manager']}><BillingPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
            <Route path="/admin/bills" element={<ProtectedRoute roles={['admin','manager','cashier']} permission="bills"><BillsPage /></ProtectedRoute>} />
            <Route path="/admin/restaurants" element={<ProtectedRoute roles={['super_admin']}><RestaurantsPage /></ProtectedRoute>} />
            <Route path="/admin/plans" element={<ProtectedRoute roles={['super_admin']}><PlansAdminPage /></ProtectedRoute>} />
            <Route path="/admin/new-order" element={<ProtectedRoute roles={['admin','manager','cashier','waiter']} permission="newOrder"><NewOrderPage /></ProtectedRoute>} />
            <Route path="/admin/ready-display" element={<ProtectedRoute permission="readyDisplay"><ReadyDisplayPage /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute roles={['admin','manager']} permission="reports"><ReportsPage /></ProtectedRoute>} />
            <Route path="/admin/shift-close" element={<ProtectedRoute roles={['admin','manager','cashier']} permission="shiftReport"><ShiftCloseReportPage /></ProtectedRoute>} />
            <Route path="/admin/promo-codes" element={<ProtectedRoute roles={['admin','manager']} permission="promoCodes"><PromoCodesPage /></ProtectedRoute>} />
            <Route path="/admin/room-charges" element={<ProtectedRoute roles={['admin','manager','cashier']} permission="roomCharges"><RoomChargesPage /></ProtectedRoute>} />
            <Route path="/admin/waiters" element={<ProtectedRoute roles={['admin','manager']} permission="waiters"><WaitersPage /></ProtectedRoute>} />
            <Route path="/admin/staff-performance" element={<ProtectedRoute roles={['admin','manager']} permission="staffPerformance"><StaffPerformancePage /></ProtectedRoute>} />
            <Route path="/admin/roster" element={<ProtectedRoute roles={['admin','manager']} permission="roster"><RosterPage /></ProtectedRoute>} />
            <Route path="/admin/menu-schedules" element={<ProtectedRoute roles={['admin','manager']} permission="menuSchedules"><MenuSchedulesPage /></ProtectedRoute>} />
            <Route path="/admin/combos" element={<ProtectedRoute roles={['admin','manager']} permission="combos"><CombosPage /></ProtectedRoute>} />
            <Route path="/admin/table-status" element={<ProtectedRoute roles={['admin','manager','cashier','waiter']} permission="tableStatus"><TableStatusPage /></ProtectedRoute>} />
            <Route path="/admin/stock" element={<ProtectedRoute roles={['admin','manager']} permission="stock"><StockPage /></ProtectedRoute>} />
            <Route path="/admin/stock-report" element={<ProtectedRoute roles={['admin','manager']} permission="stockReport"><StockReportPage /></ProtectedRoute>} />

            {/* Kitchen — accessible by kitchen, admin and manager */}
            <Route path="/kitchen" element={<ProtectedRoute roles={['admin','manager','kitchen']}><KitchenPage /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
        </TagsProvider>
        </ThemeProvider>
        </CurrencyProvider>
        </SubscriptionConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
