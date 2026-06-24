import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useRef } from 'react';
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
import { DeployFooter } from './components/DeployFooter';
import { offlineQueue } from './services/offlineQueue';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { stockService } from './services/stockService';

// Customer pages — small, load eagerly (on critical render path)
import { LoginPage } from './pages/LoginPage';
import { MenuPage } from './pages/customer/MenuPage';
import { CartPage } from './pages/customer/CartPage';
import { OrderSuccessPage } from './pages/customer/OrderSuccessPage';
import { OrderHistoryPage } from './pages/customer/OrderHistoryPage';
import { PhoneLookupPage } from './pages/customer/PhoneLookupPage';
import { WelcomePage } from './pages/customer/WelcomePage';
import { TakeawayMenuPage } from './pages/customer/TakeawayMenuPage';
import { RoomMenuPage } from './pages/customer/RoomMenuPage';
import { BillPage } from './pages/customer/BillPage';
import { OrderBillPage } from './pages/customer/OrderBillPage';

// Marketing pages
const LandingPage          = lazy(() => import('./pages/marketing/LandingPage').then(m => ({ default: m.LandingPage })));
const PricingPage          = lazy(() => import('./pages/marketing/PricingPage').then(m => ({ default: m.PricingPage })));
const SignupPage           = lazy(() => import('./pages/marketing/SignupPage').then(m => ({ default: m.SignupPage })));
const MockCheckoutPage     = lazy(() => import('./pages/marketing/MockCheckoutPage').then(m => ({ default: m.MockCheckoutPage })));

// Admin pages — all lazy loaded so kitchen/waiter roles don't download unused code
const DashboardPage        = lazy(() => import('./pages/admin/DashboardPage').then(m => ({ default: m.DashboardPage })));
const LauncherPage         = lazy(() => import('./pages/admin/LauncherPage').then(m => ({ default: m.LauncherPage })));
const OrdersPage           = lazy(() => import('./pages/admin/OrdersPage').then(m => ({ default: m.OrdersPage })));
const MenuItemsPage        = lazy(() => import('./pages/admin/MenuItemsPage').then(m => ({ default: m.MenuItemsPage })));
const MenuSetupPage        = lazy(() => import('./pages/admin/MenuSetupPage').then(m => ({ default: m.MenuSetupPage })));
const BillingPage          = lazy(() => import('./pages/admin/BillingPage').then(m => ({ default: m.BillingPage })));
const PlansAdminPage       = lazy(() => import('./pages/admin/PlansAdminPage').then(m => ({ default: m.PlansAdminPage })));
const KitchenPage          = lazy(() => import('./pages/admin/KitchenPage').then(m => ({ default: m.KitchenPage })));
const ReceiptPage          = lazy(() => import('./pages/admin/ReceiptPage').then(m => ({ default: m.ReceiptPage })));
const KitchenTicketPage    = lazy(() => import('./pages/admin/KitchenTicketPage').then(m => ({ default: m.KitchenTicketPage })));
const SettingsPage         = lazy(() => import('./pages/admin/SettingsPage').then(m => ({ default: m.SettingsPage })));
const UsersPage            = lazy(() => import('./pages/admin/UsersPage').then(m => ({ default: m.UsersPage })));
const BillsPage            = lazy(() => import('./pages/admin/BillsPage').then(m => ({ default: m.BillsPage })));
const SessionReceiptPage   = lazy(() => import('./pages/admin/SessionReceiptPage').then(m => ({ default: m.SessionReceiptPage })));
const RestaurantsPage      = lazy(() => import('./pages/admin/RestaurantsPage').then(m => ({ default: m.RestaurantsPage })));
const NewOrderPage         = lazy(() => import('./pages/admin/NewOrderPage').then(m => ({ default: m.NewOrderPage })));
const ReadyDisplayPage     = lazy(() => import('./pages/admin/ReadyDisplayPage').then(m => ({ default: m.ReadyDisplayPage })));
const ReportsPage          = lazy(() => import('./pages/admin/ReportsPage').then(m => ({ default: m.ReportsPage })));
const AuditLogsPage        = lazy(() => import('./pages/admin/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const PromoCodesPage       = lazy(() => import('./pages/admin/PromoCodesPage').then(m => ({ default: m.PromoCodesPage })));
const RoomChargesPage      = lazy(() => import('./pages/admin/RoomChargesPage').then(m => ({ default: m.RoomChargesPage })));
const WaitersPage          = lazy(() => import('./pages/admin/WaitersPage').then(m => ({ default: m.WaitersPage })));
const StaffPerformancePage = lazy(() => import('./pages/admin/StaffPerformancePage').then(m => ({ default: m.StaffPerformancePage })));
const TableStatusPage      = lazy(() => import('./pages/admin/TableStatusPage').then(m => ({ default: m.TableStatusPage })));
const LocationsPage        = lazy(() => import('./pages/admin/LocationsPage').then(m => ({ default: m.LocationsPage })));
const ReservationsPage     = lazy(() => import('./pages/admin/ReservationsPage').then(m => ({ default: m.ReservationsPage })));
const ShiftCloseReportPage = lazy(() => import('./pages/admin/ShiftCloseReportPage').then(m => ({ default: m.ShiftCloseReportPage })));
const RosterPage           = lazy(() => import('./pages/admin/RosterPage').then(m => ({ default: m.RosterPage })));
const MenuSchedulesPage    = lazy(() => import('./pages/admin/MenuSchedulesPage').then(m => ({ default: m.MenuSchedulesPage })));
const CombosPage           = lazy(() => import('./pages/admin/CombosPage').then(m => ({ default: m.CombosPage })));
const StockPage            = lazy(() => import('./pages/admin/StockPage').then(m => ({ default: m.StockPage })));
const StockReportPage      = lazy(() => import('./pages/admin/StockReportPage').then(m => ({ default: m.StockReportPage })));
const LoyaltyPage          = lazy(() => import('./pages/admin/LoyaltyPage').then(m => ({ default: m.LoyaltyPage })));
const FloorPlanPage        = lazy(() => import('./pages/admin/FloorPlanPage').then(m => ({ default: m.FloorPlanPage })));
const FloorPage            = lazy(() => import('./pages/admin/FloorPage').then(m => ({ default: m.FloorPage })));
const FinancePage          = lazy(() => import('./pages/admin/FinancePage').then(m => ({ default: m.FinancePage })));

// Staff-only deploy ribbon: shown on admin/kitchen/receipt routes, hidden on
// the public customer QR-ordering flow and marketing pages.
function DeployRibbon() {
  const { pathname } = useLocation();
  const STAFF_PREFIXES = ['/admin', '/kitchen', '/receipt', '/kitchen-ticket', '/session-receipt'];
  const show = STAFF_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p));
  if (!show) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 flex justify-center pointer-events-none">
      <DeployFooter className="bg-white border border-b-0 border-gray-100 rounded-t-lg px-3 py-1 shadow-sm" />
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 size={28} className="animate-spin text-orange-400" />
    </div>
  );
}

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
          {/* Tiny deploy-status ribbon pinned to the bottom — staff routes only
              (pointer-events-none so it never blocks taps on content below). */}
          <DeployRibbon />
          <Suspense fallback={<PageLoader />}>
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
            <Route path="/bill/:sessionId" element={<BillPage />} />
            <Route path="/order/:orderId/bill" element={<OrderBillPage />} />
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
            <Route path="/admin/floor" element={<ProtectedRoute roles={['admin','manager','cashier','waiter']} permission="locations"><FloorPage /></ProtectedRoute>} />
            <Route path="/admin/finance" element={<ProtectedRoute roles={['admin','manager','cashier']} permission="bills"><FinancePage /></ProtectedRoute>} />
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
          </Suspense>
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
