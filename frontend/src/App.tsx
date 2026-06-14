import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import axios from 'axios';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SubscriptionConfigProvider, useSubscriptionConfig } from './context/SubscriptionConfigContext';
import { CartProvider } from './context/CartContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { ThemeProvider } from './context/ThemeContext';
import { TagsProvider } from './context/TagsContext';
import { NavModeProvider, useNavMode } from './context/NavModeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InstallPrompt } from './components/InstallPrompt';
import { OfflineBanner } from './components/OfflineBanner';
import { offlineQueue } from './services/offlineQueue';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { stockService } from './services/stockService';


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
import { LauncherPage } from './pages/admin/LauncherPage';
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
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
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
import { LoyaltyPage } from './pages/admin/LoyaltyPage';
import { FloorPlanPage } from './pages/admin/FloorPlanPage';

function OfflineSyncManager() {
  const isOnline = useOnlineStatus();
  const wasOffline = useRef(!isOnline);

  useEffect(() => {
    if (isOnline && wasOffline.current) {
      wasOffline.current = false;
      const queued = offlineQueue.getAll();
      if (!queued.length) return;

      const toastId = toast.loading(`Syncing ${queued.length} queued order${queued.length > 1 ? 's' : ''}…`);
      let synced = 0;
      let failed = 0;

      (async () => {
        for (const req of queued) {
          try {
            if (req.method === 'POST') await axios.post(req.url, req.body);
            else await axios.patch(req.url, req.body);
            offlineQueue.remove(req.id);
            synced++;
          } catch {
            failed++;
          }
        }
        toast.dismiss(toastId);
        if (synced) toast.success(`${synced} order${synced > 1 ? 's' : ''} synced!`);
        if (failed) toast.error(`${failed} order${failed > 1 ? 's' : ''} failed to sync — please retry.`);
      })();
    } else if (!isOnline) {
      wasOffline.current = true;
    }
  }, [isOnline]);

  return null;
}

// Polls for low stock every 5 minutes and toasts when new items drop below threshold
function LowStockChecker() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const seenIds = useRef<Set<string>>(new Set());
  const isFirst = useRef(true);

  useEffect(() => {
    if (!isManager) return;

    const check = async () => {
      try {
        const low = await stockService.getLow();
        if (isFirst.current) {
          low.forEach((i) => seenIds.current.add(i.id));
          isFirst.current = false;
          return;
        }
        const fresh = low.filter((i) => !seenIds.current.has(i.id));
        if (!fresh.length) return;
        fresh.forEach((i) => seenIds.current.add(i.id));
        const names = fresh.map((i) => i.name);
        const msg =
          names.length === 1
            ? `Low stock: ${names[0]}`
            : names.length <= 3
            ? `Low stock: ${names.join(', ')}`
            : `${names.length} items running low`;
        toast(msg, { icon: '⚠️', duration: 7000 });
      } catch {
        // fail silently — don't interrupt the user for polling errors
      }
    };

    check();
    const id = setInterval(check, 5 * 60_000);
    return () => clearInterval(id);
  }, [isManager]);

  return null;
}

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

function AdminHome() {
  const { navMode } = useNavMode();
  if (navMode === 'launcher') return <Navigate to="/admin/launcher" replace />;
  return <DashboardPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SubscriptionConfigProvider>
        <CurrencyProvider>
        <ThemeProvider>
        <NavModeProvider>
        <TagsProvider>
        <CartProvider>
          <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
          <OfflineBanner />
          <OfflineSyncManager />
          <LowStockChecker />
          <InstallPrompt />
          <Routes>
            {/* Root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/:slug" element={<LoginPage />} />
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
            <Route path="/admin" element={<ProtectedRoute roles={['admin','manager','cashier','waiter']}><AdminHome /></ProtectedRoute>} />
            <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin','manager','cashier','waiter']}><DashboardPage /></ProtectedRoute>} />
            <Route path="/admin/launcher" element={<ProtectedRoute roles={['admin','manager','cashier','waiter']}><LauncherPage /></ProtectedRoute>} />
            <Route path="/admin/orders" element={<ProtectedRoute roles={['admin','manager','cashier','waiter']} permission="orders"><OrdersPage /></ProtectedRoute>} />
            <Route path="/admin/menu" element={<ProtectedRoute roles={['admin','manager']} permission="menu"><MenuItemsPage /></ProtectedRoute>} />
            <Route path="/admin/menu-setup" element={<ProtectedRoute roles={['admin','manager']} permission="menu"><MenuSetupPage /></ProtectedRoute>} />
            <Route path="/admin/locations" element={<ProtectedRoute roles={['admin','manager']} permission="locations"><LocationsPage /></ProtectedRoute>} />
            <Route path="/admin/floor-plan" element={<ProtectedRoute roles={['admin','manager']} permission="locations"><FloorPlanPage /></ProtectedRoute>} />
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
            <Route path="/admin/logs" element={<ProtectedRoute roles={['super_admin']}><AuditLogsPage /></ProtectedRoute>} />
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
            <Route path="/admin/loyalty" element={<ProtectedRoute roles={['admin','manager']}><LoyaltyPage /></ProtectedRoute>} />

            {/* Kitchen — accessible by kitchen, admin and manager */}
            <Route path="/kitchen" element={<ProtectedRoute roles={['admin','manager','kitchen']}><KitchenPage /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
        </TagsProvider>
        </NavModeProvider>
        </ThemeProvider>
        </CurrencyProvider>
        </SubscriptionConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
