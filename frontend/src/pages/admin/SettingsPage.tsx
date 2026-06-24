import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye, EyeOff, Loader2, CheckCircle2, Users,
  DollarSign, ImagePlus, X, Lock, User, LogOut, ChevronRight, Hash, Clock, Printer,
  Store, Smartphone, FileText, Rocket, LayoutDashboard,
  SlidersHorizontal, Receipt, LogIn, Moon, Sun, Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';
import { useAuth } from '../../context/AuthContext';
import { restaurantService, CURRENCIES, type RestaurantSettings } from '../../services/restaurantService';
import { printService } from '../../services/printService';
import { uploadImage } from '../../services/uploadService';
import { useCurrency } from '../../context/CurrencyContext';
import { THEME_COLOR, useTheme } from '../../context/ThemeContext';
import { PAYMENT_METHODS } from '../../components/PaymentMethodModal';
import { WelcomeScreen } from '../../components/WelcomeScreen';
import { useNavMode } from '../../context/NavModeContext';

type TabId = 'account' | 'preferences' | 'restaurant' | 'receipt' | 'operations' | 'branding' | 'login' | 'printers';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const input = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 bg-white transition-colors";

// Full IANA timezone list when the runtime supports it, else a sensible subset.
const TIMEZONES: string[] = (() => {
  try {
    const v = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone');
    if (Array.isArray(v) && v.length) return v;
  } catch { /* ignore */ }
  return ['UTC', 'Asia/Colombo', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney'];
})();

const TABS: { id: TabId; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'account',     label: 'Account',     Icon: User },
  { id: 'preferences', label: 'Preferences', Icon: SlidersHorizontal },
  { id: 'restaurant',  label: 'Restaurant',  Icon: Store },
  { id: 'receipt',     label: 'Receipt',     Icon: Receipt },
  { id: 'operations',  label: 'Operations',  Icon: Clock },
  { id: 'branding',    label: 'Branding',    Icon: Smartphone },
  { id: 'login',       label: 'Login page',  Icon: LogIn },
  { id: 'printers',    label: 'Printers',    Icon: Printer },
];

const ALL_TAB_IDS: TabId[] = TABS.map((t) => t.id);

// Tabs that persist instantly (no sticky save bar needed).
const INSTANT_TABS: TabId[] = ['preferences'];

export function SettingsPage() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { navMode, setNavMode } = useNavMode();
  const { dark, toggleDark } = useTheme();

  // Active tab is synced to the URL (?tab=…) so tabs are bookmarkable and the
  // browser back button moves between them.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabId | null;
  const activeTab: TabId = tabParam && ALL_TAB_IDS.includes(tabParam) ? tabParam : 'account';
  function setActiveTab(tab: TabId) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  }

  // isDirty per tab — every editable tab routes its save through the sticky bar.
  const [isDirty, setIsDirty] = useState<Record<TabId, boolean>>({
    account: false,
    preferences: false,
    restaurant: false,
    receipt: false,
    operations: false,
    branding: false,
    login: false,
    printers: false,
  });

  function markDirty(tab: TabId) {
    setIsDirty((prev) => prev[tab] ? prev : { ...prev, [tab]: true });
  }
  function markClean(tab: TabId) {
    setIsDirty((prev) => ({ ...prev, [tab]: false }));
  }

  const anyDirty = ALL_TAB_IDS.some((t) => isDirty[t]);

  // Warn before leaving (reload / close / external navigation) with unsaved edits.
  useEffect(() => {
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [anyDirty]);

  // ── Account state ──────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState(user?.username ?? '');
  const [newName, setNewName] = useState(user?.name ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // ── Restaurant state ───────────────────────────────────────────────────────
  const [restaurant, setRestaurant] = useState<RestaurantSettings | null>(null);
  const [restaurantName, setRestaurantName] = useState('');
  const [serviceChargePct,  setServiceChargePct]  = useState('0');
  const [taxPct,            setTaxPct]            = useState('0');
  const [serviceChargeName, setServiceChargeName] = useState('Service Charge');
  const [taxName,           setTaxName]           = useState('Tax');
  const [currency, setCurrency] = useState('USD');
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSuccess, setBillingSuccess] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const themeColor = THEME_COLOR;
  const [orderPrefix, setOrderPrefix] = useState('ORD');
  const [payMethods, setPayMethods] = useState<string[]>(['cash', 'card', 'online', 'voucher']);
  const [prefixSaving, setPrefixSaving] = useState(false);

  // ── Operations state ───────────────────────────────────────────────────────
  const [waitTimeMin, setWaitTimeMin] = useState<number | null>(null);
  const [timezone, setTimezone] = useState('UTC');
  const [rsOpen, setRsOpen]   = useState('');
  const [rsClose, setRsClose] = useState('');
  const [rsEnabled, setRsEnabled] = useState(false);
  const [rsSaving, setRsSaving] = useState(false);

  // ── Content state ──────────────────────────────────────────────────────────
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [welcomeImageUrl, setWelcomeImageUrl] = useState('');
  const [welcomeHeading, setWelcomeHeading] = useState('');
  const [welcomeTagline, setWelcomeTagline] = useState('');
  const [heroUploading, setHeroUploading] = useState(false);
  const [socialSaving, setSocialSaving] = useState(false);

  // ── Login-page branding state ────────────────────────────────────────────────
  const [loginMedia, setLoginMedia] = useState<string[]>([]);
  const [loginVideoUrl, setLoginVideoUrl] = useState('');
  const [loginUploading, setLoginUploading] = useState(false);
  const [loginSaving, setLoginSaving] = useState(false);

  // ── Printer state ──────────────────────────────────────────────────────────
  const [receiptPrinterIp,   setReceiptPrinterIp]   = useState('');
  const [receiptPrinterPort, setReceiptPrinterPort] = useState('9100');
  const [kitchenPrinterIp,   setKitchenPrinterIp]   = useState('');
  const [kitchenPrinterPort, setKitchenPrinterPort] = useState('9100');
  const [printerType,        setPrinterType]        = useState<'epson' | 'star'>('epson');
  const [autoPrintKitchen,   setAutoPrintKitchen]   = useState(false);
  const [autoPrintReceipt,   setAutoPrintReceipt]   = useState(false);
  const [printerSaving,      setPrinterSaving]      = useState(false);
  const [printerSuccess,     setPrinterSuccess]     = useState(false);
  const [testingPrinter,     setTestingPrinter]     = useState<'receipt' | 'kitchen' | null>(null);

  // ── Receipt customization state ────────────────────────────────────────────
  const [receiptHeaderLine1,   setReceiptHeaderLine1]   = useState('');
  const [receiptHeaderLine2,   setReceiptHeaderLine2]   = useState('');
  const [receiptFooterLine1,   setReceiptFooterLine1]   = useState('Thank you for dining with us!');
  const [receiptFooterLine2,   setReceiptFooterLine2]   = useState('Please come again 🙏');
  const [receiptShowOrderNo,   setReceiptShowOrderNo]   = useState(true);
  const [receiptShowUnitPrice, setReceiptShowUnitPrice] = useState(true);
  const [receiptSaving,        setReceiptSaving]        = useState(false);

  // ── Currency conversion state ──────────────────────────────────────────────
  const [displayCurrencies,  setDisplayCurrencies]  = useState<Array<{code:string;rateManual:string}>>([]);
  const [newCurrencyCode,    setNewCurrencyCode]    = useState('');
  const [newCurrencyRate,    setNewCurrencyRate]    = useState('');
  const [newRateType,        setNewRateType]        = useState<'live'|'manual'>('live');
  const [fetchingNewRate,    setFetchingNewRate]    = useState(false);
  const [exchangeSaving,     setExchangeSaving]     = useState(false);

  const { loadCurrency } = useCurrency();

  useEffect(() => {
    restaurantService.getMyRestaurant().then((r) => {
      if (!r) return;
      setRestaurant(r);
      setRestaurantName(r.name ?? '');
      setPayMethods(r.enabledPaymentMethods?.length ? r.enabledPaymentMethods : ['cash', 'card', 'online', 'voucher']);
      setServiceChargePct(String(r.serviceChargePct));
      setTaxPct(String(r.taxPct));
      setServiceChargeName(r.serviceChargeName ?? 'Service Charge');
      setTaxName(r.taxName ?? 'Tax');
      setCurrency(r.currency ?? 'USD');
      setOrderPrefix(r.orderNumberPrefix ?? 'ORD');
      setWaitTimeMin(r.waitTimeMin ?? null);
      setTimezone(r.timezone ?? 'UTC');
      if (r.roomServiceOpen && r.roomServiceClose) {
        setRsEnabled(true);
        setRsOpen(r.roomServiceOpen);
        setRsClose(r.roomServiceClose);
      }
      setFacebookUrl(r.facebookUrl ?? '');
      setInstagramUrl(r.instagramUrl ?? '');
      setTiktokUrl(r.tiktokUrl ?? '');
      setWhatsappUrl(r.whatsappUrl ?? '');
      setYoutubeUrl(r.youtubeUrl ?? '');
      setTwitterUrl(r.twitterUrl ?? '');
      setWelcomeImageUrl(r.welcomeImageUrl ?? '');
      setWelcomeHeading(r.welcomeHeading ?? '');
      setWelcomeTagline(r.welcomeTagline ?? '');
      setLoginMedia(r.loginMedia ?? []);
      setLoginVideoUrl(r.loginVideoUrl ?? '');
      setReceiptPrinterIp(r.receiptPrinterIp ?? '');
      setReceiptPrinterPort(String(r.receiptPrinterPort ?? 9100));
      setKitchenPrinterIp(r.kitchenPrinterIp ?? '');
      setKitchenPrinterPort(String(r.kitchenPrinterPort ?? 9100));
      setPrinterType(r.printerType ?? 'epson');
      setAutoPrintKitchen(r.autoPrintKitchen ?? false);
      setAutoPrintReceipt(r.autoPrintReceipt ?? false);
      setReceiptHeaderLine1(r.receiptHeaderLine1 ?? '');
      setReceiptHeaderLine2(r.receiptHeaderLine2 ?? '');
      setReceiptFooterLine1(r.receiptFooterLine1 ?? 'Thank you for dining with us!');
      setReceiptFooterLine2(r.receiptFooterLine2 ?? 'Please come again 🙏');
      setReceiptShowOrderNo(r.receiptShowOrderNo !== false);
      setReceiptShowUnitPrice(r.receiptShowUnitPrice !== false);
      setDisplayCurrencies((r.displayCurrencies ?? []).map((c) => ({ code: c.code, rateManual: c.rateManual != null ? String(c.rateManual) : '' })));
    });
  }, []);

  // ── Logo handlers ──────────────────────────────────────────────────────────
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!restaurant || !e.target.files?.[0]) return;
    setLogoUploading(true);
    try {
      const url = await uploadImage(e.target.files[0]);
      const updated = await restaurantService.updateLogo(restaurant.id, url);
      setRestaurant(updated);
    } catch {
      //
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  }

  async function handleLogoRemove() {
    if (!restaurant) return;
    const updated = await restaurantService.updateLogo(restaurant.id, null);
    setRestaurant(updated);
  }

  // ── Hero banner image ──────────────────────────────────────────────────────
  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!restaurant || !e.target.files?.[0]) return;
    setBannerUploading(true);
    try {
      const url = await uploadImage(e.target.files[0]);
      const updated = await restaurantService.updateBanner(restaurant.id, url);
      setRestaurant(updated);
      toast.success('Banner updated');
    } catch {
      toast.error('Banner upload failed');
    } finally {
      setBannerUploading(false);
      e.target.value = '';
    }
  }

  async function handleBannerRemove() {
    if (!restaurant) return;
    const updated = await restaurantService.updateBanner(restaurant.id, null);
    setRestaurant(updated);
  }

  // ── Save functions (all existing, untouched logic) ─────────────────────────
  async function saveOrderPrefix() {
    if (!restaurant) return;
    const clean = orderPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    if (!clean) return;
    setPrefixSaving(true);
    try {
      const updated = await restaurantService.updateOrderPrefix(restaurant.id, clean);
      setRestaurant(updated);
      setOrderPrefix(updated.orderNumberPrefix ?? clean);
    } finally {
      setPrefixSaving(false);
    }
  }

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    setHeroUploading(true);
    try {
      const url = await uploadImage(e.target.files[0]);
      setWelcomeImageUrl(url);
      markDirty('branding');
    } catch {
      //
    } finally {
      setHeroUploading(false);
      e.target.value = '';
    }
  }

  async function saveSocial() {
    if (!restaurant) return;
    setSocialSaving(true);
    try {
      const updated = await restaurantService.updateSocial(restaurant.id, {
        facebookUrl:     facebookUrl.trim() || null,
        instagramUrl:    instagramUrl.trim() || null,
        tiktokUrl:       tiktokUrl.trim() || null,
        whatsappUrl:     whatsappUrl.trim() || null,
        youtubeUrl:      youtubeUrl.trim() || null,
        twitterUrl:      twitterUrl.trim() || null,
        welcomeImageUrl: welcomeImageUrl.trim() || null,
        welcomeHeading:  welcomeHeading.trim() || null,
        welcomeTagline:  welcomeTagline.trim() || null,
      });
      setRestaurant(updated);
      markClean('branding');
      toast.success('Branding saved');
    } finally {
      setSocialSaving(false);
    }
  }

  async function handleLoginImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setLoginUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 10)) {
        uploaded.push(await uploadImage(file));
      }
      setLoginMedia((prev) => [...prev, ...uploaded].slice(0, 10));
      markDirty('login');
    } catch {
      toast.error('Image upload failed');
    } finally {
      setLoginUploading(false);
      e.target.value = '';
    }
  }

  function removeLoginImage(url: string) {
    setLoginMedia((prev) => prev.filter((u) => u !== url));
    markDirty('login');
  }

  async function saveLoginBranding() {
    if (!restaurant) return;
    setLoginSaving(true);
    try {
      const updated = await restaurantService.updateLoginBranding(restaurant.id, {
        loginMedia,
        loginVideoUrl: loginVideoUrl.trim() || null,
      });
      setRestaurant(updated);
      toast.success('Login page updated');
    } catch {
      toast.error('Failed to save login page');
    } finally {
      setLoginSaving(false);
    }
  }

  async function savePrinter() {
    if (!restaurant) return;
    setPrinterSaving(true);
    setPrinterSuccess(false);
    try {
      const updated = await restaurantService.updatePrinter(restaurant.id, {
        receiptPrinterIp:   receiptPrinterIp.trim() || null,
        receiptPrinterPort: parseInt(receiptPrinterPort, 10) || 9100,
        kitchenPrinterIp:   kitchenPrinterIp.trim() || null,
        kitchenPrinterPort: parseInt(kitchenPrinterPort, 10) || 9100,
        printerType, autoPrintKitchen, autoPrintReceipt,
      });
      setRestaurant(updated);
      setPrinterSuccess(true);
      markClean('printers');
      setTimeout(() => setPrinterSuccess(false), 3000);
    } finally {
      setPrinterSaving(false);
    }
  }

  async function handleTestPrint(role: 'receipt' | 'kitchen') {
    setTestingPrinter(role);
    const result = await printService.test(role);
    setTestingPrinter(null);
    if (result.success) {
      import('react-hot-toast').then(({ default: toast }) => toast.success(result.message));
    } else {
      import('react-hot-toast').then(({ default: toast }) => toast.error(result.message));
    }
  }

  async function saveBilling() {
    if (!restaurant) return;
    const sc  = parseFloat(serviceChargePct);
    const tax = parseFloat(taxPct);
    if ([sc, tax].some((v) => isNaN(v) || v < 0 || v > 100)) return;
    setBillingLoading(true);
    setBillingSuccess(false);
    try {
      const updated = await restaurantService.updateCharges(restaurant.id, {
        serviceChargePct: sc, taxPct: tax, currency,
        serviceChargeName: serviceChargeName.trim() || 'Service Charge',
        taxName: taxName.trim() || 'Tax',
      });
      setRestaurant(updated);
      loadCurrency(updated.id);
      setBillingSuccess(true);
      setTimeout(() => setBillingSuccess(false), 3000);
    } finally {
      setBillingLoading(false);
    }
  }

  async function fetchLiveRateForNew() {
    if (!currency || !newCurrencyCode || newCurrencyCode === currency) return;
    setFetchingNewRate(true);
    try {
      const resp = await fetch(`https://open.er-api.com/v6/latest/${currency}`);
      const data = await resp.json() as { result: string; rates: Record<string, number> };
      if (data.result === 'success' && data.rates[newCurrencyCode] != null) {
        setNewCurrencyRate(String(data.rates[newCurrencyCode]));
        toast.success('Live rate fetched!');
      } else {
        toast.error('Rate not available for this pair');
      }
    } catch {
      toast.error('Failed to fetch exchange rate');
    } finally {
      setFetchingNewRate(false);
    }
  }

  async function fetchLiveRateForRow(code: string, index: number) {
    if (!currency || !code) return;
    try {
      const resp = await fetch(`https://open.er-api.com/v6/latest/${currency}`);
      const data = await resp.json() as { result: string; rates: Record<string, number> };
      if (data.result === 'success' && data.rates[code] != null) {
        setDisplayCurrencies((prev) => prev.map((c, i) => i === index ? { ...c, rateManual: String(data.rates[code]) } : c));
        toast.success('Rate updated');
      } else {
        toast.error('Rate not available');
      }
    } catch {
      toast.error('Failed to fetch rate');
    }
  }

  function addDisplayCurrency() {
    if (!newCurrencyCode || newCurrencyCode === currency) return;
    if (displayCurrencies.some((c) => c.code === newCurrencyCode)) return;
    const rate = newRateType === 'manual' ? newCurrencyRate : '';
    setDisplayCurrencies((prev) => [...prev, { code: newCurrencyCode, rateManual: rate }]);
    setNewCurrencyCode('');
    setNewCurrencyRate('');
    setNewRateType('live');
  }

  function removeDisplayCurrency(index: number) {
    setDisplayCurrencies((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveExchangeSettings() {
    if (!restaurant) return;
    setExchangeSaving(true);
    try {
      const payload = displayCurrencies.map((c) => ({
        code: c.code,
        rateManual: c.rateManual ? parseFloat(c.rateManual) : null,
      }));
      const updated = await restaurantService.updateExchangeSettings(restaurant.id, { displayCurrencies: payload });
      setRestaurant(updated);
      loadCurrency(updated.id);
      toast.success('Currency display settings saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setExchangeSaving(false);
    }
  }

  async function saveReceiptConfig() {
    if (!restaurant) return;
    setReceiptSaving(true);
    try {
      const updated = await restaurantService.updateReceiptConfig(restaurant.id, {
        receiptHeaderLine1, receiptHeaderLine2,
        receiptFooterLine1: receiptFooterLine1 || 'Thank you for dining with us!',
        receiptFooterLine2,
        receiptShowOrderNo, receiptShowUnitPrice,
      });
      setRestaurant(updated);
      toast.success('Receipt layout saved');
    } catch {
      toast.error('Failed to save receipt settings');
    } finally {
      setReceiptSaving(false);
    }
  }

  // Persist the restaurant name (Restaurant tab → Restaurant profile).
  async function saveName() {
    if (!restaurant) return;
    const clean = restaurantName.trim();
    if (!clean || clean === restaurant.name) return;
    const updated = await restaurantService.updateName(restaurant.id, clean);
    setRestaurant(updated);
    setRestaurantName(updated.name ?? clean);
  }

  // Persist which payment methods appear in the "How was this paid?" modal.
  async function savePaymentMethods() {
    if (!restaurant) return;
    const updated = await restaurantService.updatePaymentMethods(restaurant.id, payMethods);
    setRestaurant(updated);
    setPayMethods(updated.enabledPaymentMethods ?? payMethods);
  }

  // Restaurant tab combined save (name + billing + prefix + payment methods)
  async function saveRestaurant() {
    await saveName();
    await saveBilling();
    await saveOrderPrefix();
    await savePaymentMethods();
    markClean('restaurant');
  }

  // Operations tab combined save (timezone + wait time + room-service hours).
  // These used to auto-save individually; now they route through the sticky bar.
  async function saveOperations() {
    if (!restaurant) return;
    setRsSaving(true);
    try {
      const open  = rsEnabled && rsOpen  ? rsOpen  : null;
      const close = rsEnabled && rsClose ? rsClose : null;
      const updated = await restaurantService.updateRoomServiceHours(restaurant.id, open, close);
      await restaurantService.updateTimezone(restaurant.id, timezone);
      const r2 = await restaurantService.updateWaitTime(restaurant.id, waitTimeMin);
      setRestaurant(r2 ?? updated);
      markClean('operations');
      toast.success('Operations settings saved');
    } catch {
      toast.error('Failed to save operations settings');
    } finally {
      setRsSaving(false);
    }
  }

  // Branding tab save (welcome screen + social links).
  async function saveBranding() {
    await saveSocial();
    markClean('branding');
  }

  // Login-page tab save.
  async function saveLogin() {
    await saveLoginBranding();
    markClean('login');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (!currentPassword) { setError('Current password is required'); return; }
    if (newPassword && newPassword !== confirmPassword) { setError('New passwords do not match'); return; }
    if (newPassword && newPassword.length < 6) { setError('New password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await updateProfile({
        currentPassword,
        newUsername: newUsername.trim() !== user?.username ? newUsername.trim() : undefined,
        newName:     newName.trim()     !== user?.name     ? newName.trim()     : undefined,
        newPassword: newPassword || undefined,
      });
      setSuccess(true);
      markClean('account');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to update. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const sym = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;
  const previewSC  = 100 * (parseFloat(serviceChargePct) || 0) / 100;
  const previewTax = (100 + previewSC) * (parseFloat(taxPct) || 0) / 100;
  const previewTotal = 100 + previewSC + previewTax;

  // ── Sticky save bar handler per active tab ─────────────────────────────────
  function handleStickyBarSave() {
    switch (activeTab) {
      case 'account':    document.getElementById('account-form-submit')?.click(); break;
      case 'restaurant': void saveRestaurant(); break;
      case 'receipt':    void saveReceiptConfig().then(() => markClean('receipt')); break;
      case 'operations': void saveOperations(); break;
      case 'branding':   void saveBranding(); break;
      case 'login':      void saveLogin(); break;
      case 'printers':   void savePrinter(); break;
    }
  }

  // True while the active tab's save is in flight (drives the sticky bar spinner).
  const savingByTab: Record<TabId, boolean> = {
    account:     loading,
    preferences: false,
    restaurant:  billingLoading || prefixSaving,
    receipt:     receiptSaving,
    operations:  rsSaving,
    branding:    socialSaving,
    login:       loginSaving,
    printers:    printerSaving,
  };

  // ── Tab content renderers ──────────────────────────────────────────────────

  function renderAccountTab() {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
            <User size={18} className="text-gray-900" />
            <div>
              <h2 className="font-bold text-gray-900 leading-tight">Account</h2>
              <p className="text-xs text-gray-400">Your display name, username &amp; password</p>
            </div>
          </div>

          <form id="account-form" onSubmit={handleSubmit}>
            <div className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                  <X size={14} /> {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                  <CheckCircle2 size={14} /> Credentials updated successfully!
                </div>
              )}

              {/* Profile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Display Name">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => { setNewName(e.target.value); markDirty('account'); }}
                    className={input}
                  />
                </Field>
                <Field label="Username">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => { setNewUsername(e.target.value); markDirty('account'); }}
                    autoComplete="username"
                    className={input}
                  />
                </Field>
              </div>

              {/* Change password — grouped panel */}
              <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Lock size={13} className="text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Change Password</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="New Password">
                    <div className="relative">
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); markDirty('account'); }}
                        autoComplete="new-password"
                        placeholder="Leave blank to keep current"
                        className={input + ' pr-11'}
                      />
                      <button type="button" onClick={() => setShowNew((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </Field>

                  <Field label="Current Password *">
                    <div className="relative">
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => { setCurrentPassword(e.target.value); markDirty('account'); }}
                        autoComplete="current-password"
                        placeholder="Required to save changes"
                        required
                        className={input + ' pr-11'}
                      />
                      <button type="button" onClick={() => setShowCurrent((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </Field>
                </div>

                {newPassword && (
                  <Field label="Confirm New Password">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); markDirty('account'); }}
                      autoComplete="new-password"
                      placeholder="Repeat new password"
                      className={`${input} ${confirmPassword && confirmPassword !== newPassword ? 'border-red-300 bg-red-50' : ''}`}
                    />
                    {confirmPassword && confirmPassword !== newPassword && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                  </Field>
                )}
              </div>

              {/* Hidden submit trigger for sticky bar */}
              <button id="account-form-submit" type="submit" className="hidden" />
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderPreferencesTab() {
    return (
      <div className="space-y-4 max-w-2xl">
        {/* Navigation Style */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
              <Rocket size={15} className="text-orange-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Navigation Style</h2>
              <p className="text-xs text-gray-400">Choose how the admin panel is navigated</p>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setNavMode('sidebar')}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                navMode === 'sidebar'
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${navMode === 'sidebar' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                <LayoutDashboard size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-800">Sidebar</p>
                <p className="text-xs text-gray-400 mt-0.5">Traditional left navigation with all pages accessible from the sidebar</p>
              </div>
            </button>
            <button
              onClick={() => setNavMode('launcher')}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                navMode === 'launcher'
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${navMode === 'launcher' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                <Rocket size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-800">Launcher</p>
                <p className="text-xs text-gray-400 mt-0.5">Icon grid navigation — no sidebar, access all sections from the launcher</p>
              </div>
            </button>
          </div>
        </div>

        {/* Appearance — light / dark */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
              {dark ? <Moon size={15} className="text-orange-500" /> : <Sun size={15} className="text-orange-500" />}
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Appearance</h2>
              <p className="text-xs text-gray-400">Switch between light and dark mode</p>
            </div>
          </div>
          <div className="p-5">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span className="text-sm font-medium text-gray-700">
                {dark ? 'Dark mode' : 'Light mode'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={dark}
                aria-label="Toggle dark mode"
                onClick={toggleDark}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${dark ? 'bg-orange-500' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${dark ? 'translate-x-5' : ''}`} />
              </button>
            </label>
          </div>
        </div>
      </div>
    );
  }

  function renderRestaurantTab() {
    if (!restaurant) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>;
    return (
      <div className="space-y-4 max-w-2xl">

        {/* Restaurant Profile */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
              <Building2 size={15} className="text-orange-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Restaurant Profile</h2>
              <p className="text-xs text-gray-400">The name &amp; logo customers see</p>
            </div>
          </div>
          <div className="p-5 flex items-start gap-4">
            {/* Logo */}
            <label className="relative cursor-pointer group flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                {restaurant.logo
                  ? <img src={restaurant.logo} alt="logo" className="w-full h-full object-contain" />
                  : <Store size={22} className="text-gray-300" />}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5">
                {logoUploading
                  ? <Loader2 size={16} className="animate-spin text-white" />
                  : <><ImagePlus size={16} className="text-white" /><span className="text-white text-[9px] font-medium">Logo</span></>}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
            </label>

            <div className="flex-1 space-y-2">
              <Field label="Restaurant Name">
                <input
                  type="text"
                  maxLength={80}
                  value={restaurantName}
                  onChange={(e) => { setRestaurantName(e.target.value); markDirty('restaurant'); }}
                  placeholder="e.g. The Garden Table"
                  className={input}
                />
              </Field>
              {restaurant.logo && (
                <button
                  type="button"
                  onClick={handleLogoRemove}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-500 transition-colors"
                >
                  <X size={13} /> Remove logo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
              <DollarSign size={15} className="text-green-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Billing</h2>
              <p className="text-xs text-gray-400">Service charge: dine-in only · Tax: all orders</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {billingSuccess && (
              <div className="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <CheckCircle2 size={14} /> Billing settings saved!
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Service Charge Name">
                <input
                  type="text" maxLength={30}
                  value={serviceChargeName}
                  onChange={(e) => { setServiceChargeName(e.target.value); markDirty('restaurant'); }}
                  placeholder="e.g. Service Charge"
                  className={input}
                />
              </Field>
              <Field label="Tax Name">
                <input
                  type="text" maxLength={30}
                  value={taxName}
                  onChange={(e) => { setTaxName(e.target.value); markDirty('restaurant'); }}
                  placeholder="e.g. VAT, GST, Tax"
                  className={input}
                />
              </Field>
              {[
                { label: 'Service Charge Rate', value: serviceChargePct, set: setServiceChargePct },
                { label: 'Tax Rate',            value: taxPct,            set: setTaxPct },
              ].map(({ label, value, set }) => (
                <Field key={label} label={label}>
                  <div className="relative">
                    <input
                      type="number" min="0" max="100" step="0.01"
                      value={value}
                      onChange={(e) => { set(e.target.value); markDirty('restaurant'); }}
                      className={input + ' pr-8'}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">%</span>
                  </div>
                </Field>
              ))}
            </div>

            <Field label="Currency">
              <select
                value={currency}
                onChange={(e) => { setCurrency(e.target.value); markDirty('restaurant'); }}
                className={input}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.symbol} — {c.name} ({c.code})</option>
                ))}
              </select>
            </Field>

            {/* Live preview */}
            <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-100/60 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preview · {sym}100 subtotal</p>
              </div>
              <div className="px-4 py-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span><span>{sym}100.00</span>
                </div>
                {previewSC > 0 && (
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>{serviceChargeName || 'Service Charge'} ({serviceChargePct}%)</span><span>+{sym}{previewSC.toFixed(2)}</span>
                  </div>
                )}
                {previewTax > 0 && (
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>{taxName || 'Tax'} ({taxPct}%)</span><span>+{sym}{previewTax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-1">
                  <span>Total</span><span className="text-orange-600">{sym}{previewTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Currency Display */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <DollarSign size={15} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Currency Display</h2>
              <p className="text-xs text-gray-400">Currencies customers can switch between on menu pages</p>
            </div>
          </div>
          <div className="p-5 space-y-4">

            {/* Configured currencies list */}
            <div className="space-y-2">
              {/* Base currency row */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide w-10">{currency}</span>
                <span className="text-xs text-gray-500 flex-1">Base currency (prices stored in this)</span>
                <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Base</span>
              </div>

              {/* Display currency rows */}
              {displayCurrencies.map((c, i) => (
                <div key={c.code} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                  <span className="text-xs font-bold text-emerald-700 w-10">{c.code}</span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-xs text-emerald-600 shrink-0">1 {currency} =</span>
                    <input
                      type="number"
                      value={c.rateManual}
                      onChange={(e) => setDisplayCurrencies((prev) => prev.map((x, idx) => idx === i ? { ...x, rateManual: e.target.value } : x))}
                      placeholder="live"
                      step="any"
                      min="0"
                      className="w-28 text-xs bg-white border border-emerald-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-300"
                    />
                    <span className="text-xs text-emerald-600 shrink-0">{c.code}</span>
                    <button
                      type="button"
                      onClick={() => fetchLiveRateForRow(c.code, i)}
                      className="text-xs text-emerald-600 underline underline-offset-2 hover:text-emerald-800 shrink-0"
                    >Live</button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDisplayCurrency(i)}
                    className="text-gray-400 hover:text-red-500 transition-colors shrink-0 ml-1"
                    aria-label="Remove"
                  ><X size={14} /></button>
                </div>
              ))}
            </div>

            {/* Add new currency */}
            <div className="border border-dashed border-gray-200 rounded-xl p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Currency</p>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={newCurrencyCode}
                  onChange={(e) => setNewCurrencyCode(e.target.value)}
                  className="flex-1 min-w-32 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                >
                  <option value="">Select currency…</option>
                  {CURRENCIES.filter((c) => c.code !== currency && !displayCurrencies.some((d) => d.code === c.code)).map((c) => (
                    <option key={c.code} value={c.code}>{c.symbol} {c.name} ({c.code})</option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3">
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="radio" name="rateType" value="live" checked={newRateType === 'live'} onChange={() => setNewRateType('live')} className="accent-orange-500" />
                    Live
                  </label>
                  <label className="flex items-center gap-1 text-xs cursor-pointer ml-2">
                    <input type="radio" name="rateType" value="manual" checked={newRateType === 'manual'} onChange={() => setNewRateType('manual')} className="accent-orange-500" />
                    Manual
                  </label>
                </div>
              </div>
              {newRateType === 'manual' && newCurrencyCode && (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={newCurrencyRate}
                    onChange={(e) => setNewCurrencyRate(e.target.value)}
                    placeholder={`1 ${currency} = ? ${newCurrencyCode}`}
                    step="any"
                    min="0"
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-orange-300"
                  />
                  <button
                    type="button"
                    onClick={fetchLiveRateForNew}
                    disabled={fetchingNewRate}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {fetchingNewRate ? <Loader2 size={13} className="animate-spin" /> : null}
                    {fetchingNewRate ? 'Fetching…' : 'Fetch Live'}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={addDisplayCurrency}
                disabled={!newCurrencyCode || newCurrencyCode === currency}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40"
              >
                + Add
              </button>
            </div>

            <button
              type="button"
              onClick={saveExchangeSettings}
              disabled={exchangeSaving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-50"
            >
              {exchangeSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Save Display Currencies
            </button>
          </div>
        </div>

        {/* Order Number Prefix */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Hash size={15} className="text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Order Number</h2>
              <p className="text-xs text-gray-400">Prefix for sequential 6-digit order numbers</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <Field label="Prefix (letters / numbers only)">
              <input
                type="text"
                value={orderPrefix}
                onChange={(e) => {
                  setOrderPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10));
                  markDirty('restaurant');
                }}
                placeholder="e.g. ORD"
                maxLength={10}
                className={input}
              />
            </Field>

            <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-500 mb-1.5 font-semibold uppercase tracking-wide">Preview</p>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3].map((n) => (
                  <span key={n} className="bg-orange-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full tracking-wide">
                    {(orderPrefix || 'ORD')}{String(n).padStart(3, '0')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
              <DollarSign size={15} className="text-green-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Payment Methods</h2>
              <p className="text-xs text-gray-400">Which options show on the “How was this paid?” screen</p>
            </div>
          </div>
          <div className="p-5 space-y-2">
            {PAYMENT_METHODS.map((m) => {
              const on = payMethods.includes(m.value);
              const isLast = on && payMethods.length === 1;
              return (
                <label
                  key={m.value}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                    on ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
                  } ${isLast ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="text-xl">{m.icon}</span>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${on ? 'text-orange-700' : 'text-gray-600'}`}>{m.label}</p>
                    <p className="text-xs text-gray-400">{m.description}</p>
                  </div>
                  <div
                    role="switch"
                    aria-checked={on}
                    onClick={() => {
                      if (isLast) return; // keep at least one method enabled
                      setPayMethods((prev) =>
                        prev.includes(m.value) ? prev.filter((v) => v !== m.value) : [...prev, m.value],
                      );
                      markDirty('restaurant');
                    }}
                    className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${on ? 'bg-orange-500' : 'bg-gray-300'} ${isLast ? 'opacity-50' : ''}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${on ? 'translate-x-5' : ''}`} />
                  </div>
                </label>
              );
            })}
            <p className="text-xs text-gray-400">At least one method must stay enabled.</p>
          </div>
        </div>

      </div>
    );
  }

  function renderReceiptTab() {
    if (!restaurant) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>;
    return (
      <div className="space-y-4 max-w-2xl">
        {/* Receipt Layout */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <FileText size={15} className="text-indigo-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Receipt Layout</h2>
              <p className="text-xs text-gray-400">Header info, footer message, and which fields to print</p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Header lines */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Header (below restaurant name)</p>
              <div className="space-y-2">
                <Field label="Line 1 — address or tagline">
                  <input
                    type="text" maxLength={100}
                    value={receiptHeaderLine1}
                    onChange={(e) => { setReceiptHeaderLine1(e.target.value); markDirty('receipt'); }}
                    placeholder="e.g. 123 High Street, London"
                    className={input}
                  />
                </Field>
                <Field label="Line 2 — phone / website">
                  <input
                    type="text" maxLength={100}
                    value={receiptHeaderLine2}
                    onChange={(e) => { setReceiptHeaderLine2(e.target.value); markDirty('receipt'); }}
                    placeholder="e.g. Tel: +44 20 1234 5678 · www.myrest.com"
                    className={input}
                  />
                </Field>
              </div>
            </div>

            {/* Footer lines */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Footer message</p>
              <div className="space-y-2">
                <Field label="Line 1">
                  <input
                    type="text" maxLength={100}
                    value={receiptFooterLine1}
                    onChange={(e) => { setReceiptFooterLine1(e.target.value); markDirty('receipt'); }}
                    placeholder="Thank you for dining with us!"
                    className={input}
                  />
                </Field>
                <Field label="Line 2">
                  <input
                    type="text" maxLength={100}
                    value={receiptFooterLine2}
                    onChange={(e) => { setReceiptFooterLine2(e.target.value); markDirty('receipt'); }}
                    placeholder="Please come again 🙏"
                    className={input}
                  />
                </Field>
              </div>
            </div>

            {/* Layout toggles */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Print options</p>
              <div className="space-y-2">
                {[
                  { label: 'Show order number', sub: 'Prints the ORD-XXXX reference on the receipt', value: receiptShowOrderNo, set: setReceiptShowOrderNo },
                  { label: 'Show unit price per line', sub: 'Prints "× $12.00 each" below each item', value: receiptShowUnitPrice, set: setReceiptShowUnitPrice },
                ].map(({ label, sub, value, set }) => (
                  <label key={label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${value ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div
                      onClick={() => { set(!value); markDirty('receipt'); }}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-indigo-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${value ? 'text-indigo-700' : 'text-gray-600'}`}>{label}</p>
                      <p className="text-xs text-gray-400">{sub}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Live mini receipt preview */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Live preview</p>
              <div className="flex justify-center">
                <div className="font-mono text-[10px] bg-white border border-gray-300 rounded-lg p-4 w-[210px] leading-relaxed text-gray-800 shadow-sm select-none">
                  {restaurant?.logo && (
                    <div className="flex justify-center mb-1">
                      <img src={restaurant.logo} alt="logo" className="w-8 h-8 object-contain" />
                    </div>
                  )}
                  <p className="text-center font-bold text-xs">{restaurant?.name ?? 'RESTAURANT'}</p>
                  {receiptHeaderLine1 && <p className="text-center text-gray-500 text-[9px]">{receiptHeaderLine1}</p>}
                  {receiptHeaderLine2 && <p className="text-center text-gray-500 text-[9px]">{receiptHeaderLine2}</p>}
                  <p className="text-center text-gray-400 my-0.5">{'─'.repeat(26)}</p>
                  <p className="text-center font-bold text-[9px]">DINING BILL</p>
                  <p className="text-center text-gray-400 my-0.5">{'─'.repeat(26)}</p>
                  {receiptShowOrderNo && (
                    <div className="flex justify-between font-bold text-[9px]"><span>Order No:</span><span>ORD001</span></div>
                  )}
                  <div className="flex justify-between text-[9px]"><span>1x Grilled Chicken</span><span>$12.00</span></div>
                  {receiptShowUnitPrice && <div className="pl-2 text-gray-400 text-[9px]">$12.00 each</div>}
                  <div className="flex justify-between text-[9px]"><span>1x Garden Salad</span><span>$8.00</span></div>
                  {receiptShowUnitPrice && <div className="pl-2 text-gray-400 text-[9px]">$8.00 each</div>}
                  <p className="text-gray-400 my-0.5">{'─'.repeat(26)}</p>
                  <div className="flex justify-between text-[9px]"><span>Subtotal</span><span>$20.00</span></div>
                  <div className="flex justify-between font-bold text-[9px] mt-0.5"><span>TOTAL</span><span>$20.00</span></div>
                  <p className="text-gray-400 my-0.5">{'─'.repeat(26)}</p>
                  <p className="text-center text-[9px]">{receiptFooterLine1 || 'Thank you for dining with us!'}</p>
                  {receiptFooterLine2 && <p className="text-center text-gray-400 text-[8px]">{receiptFooterLine2}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderOperationsTab() {
    if (!restaurant) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>;
    return (
      <div className="space-y-4 max-w-2xl">

        {/* Timezone */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Clock size={15} className="text-blue-500" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-800">Timezone</h2>
              <p className="text-xs text-gray-400">Used for reservations &amp; date-based reports</p>
            </div>
          </div>
          <div className="p-5">
            <select
              value={timezone}
              onChange={(e) => { setTimezone(e.target.value); markDirty('operations'); }}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent bg-gray-50 focus:bg-white transition-colors"
            >
              {!TIMEZONES.includes(timezone) && <option value={timezone}>{timezone}</option>}
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-2">
              Current local time: {new Date().toLocaleString([], { timeZone: timezone, hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>

        {/* Estimated Wait Time */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
              <Clock size={15} className="text-orange-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Estimated Wait Time</h2>
              <p className="text-xs text-gray-400">Shown to customers on the order success page</p>
            </div>
          </div>

          <div className="p-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              {[null, 10, 15, 20, 25, 30, 45, 60].map((val) => (
                <button
                  key={val ?? 'off'}
                  onClick={() => { setWaitTimeMin(val); markDirty('operations'); }}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50 ${
                    waitTimeMin === val
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-200 hover:bg-orange-50'
                  }`}
                >
                  {val == null ? 'Off' : `${val} min`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Custom:</span>
              <input
                type="number"
                min="1"
                max="180"
                value={waitTimeMin ?? ''}
                onChange={(e) => { setWaitTimeMin(e.target.value ? Number(e.target.value) : null); markDirty('operations'); }}
                placeholder="e.g. 35"
                className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300 bg-gray-50 focus:bg-white"
              />
              <span className="text-xs text-gray-400">min</span>
            </div>

            <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
              waitTimeMin ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-gray-50 text-gray-400'
            }`}>
              <Clock size={14} />
              {waitTimeMin
                ? `Customers will see "Est. wait: ~${waitTimeMin} min" after ordering`
                : 'No wait time shown to customers'}
            </div>
          </div>
        </div>

        {/* Room Service Hours */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
              <Clock size={15} className="text-orange-500" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-800">Room Service Hours</h2>
              <p className="text-xs text-gray-400">Customers cannot order outside these hours</p>
            </div>
            {rsSaving && <Loader2 size={14} className="animate-spin text-gray-400" />}
          </div>

          <div className="p-5 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => { setRsEnabled((p) => !p); markDirty('operations'); }}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${rsEnabled ? 'bg-orange-500' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${rsEnabled ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {rsEnabled ? 'Restricted hours enabled' : 'Always open (no restriction)'}
              </span>
            </label>

            {rsEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Opens at">
                  <input
                    type="time"
                    value={rsOpen}
                    onChange={(e) => { setRsOpen(e.target.value); markDirty('operations'); }}
                    className={input}
                  />
                </Field>
                <Field label="Closes at">
                  <input
                    type="time"
                    value={rsClose}
                    onChange={(e) => { setRsClose(e.target.value); markDirty('operations'); }}
                    className={input}
                  />
                </Field>
              </div>
            )}

            {rsEnabled && rsOpen && rsClose && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-sm text-orange-600 flex items-center gap-2">
                <Clock size={14} />
                Room service available {rsOpen} – {rsClose}
                {rsOpen > rsClose ? ' (wraps midnight)' : ''}
              </div>
            )}
          </div>
        </div>

      </div>
    );
  }

  function renderBrandingTab() {
    if (!restaurant) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>;

    const socialFields: { label: string; placeholder: string; value: string; set: (v: string) => void; type?: string }[] = [
      { label: 'Facebook URL',  placeholder: 'https://facebook.com/yourpage',   value: facebookUrl,  set: setFacebookUrl },
      { label: 'Instagram URL', placeholder: 'https://instagram.com/yourhandle', value: instagramUrl, set: setInstagramUrl },
      { label: 'TikTok URL',    placeholder: 'https://tiktok.com/@yourhandle',   value: tiktokUrl,    set: setTiktokUrl },
      { label: 'WhatsApp number',  placeholder: 'e.g. +1 555 123 4567 (or a wa.me link)', value: whatsappUrl,  set: setWhatsappUrl, type: 'text' },
      { label: 'YouTube URL',   placeholder: 'https://youtube.com/@yourchannel', value: youtubeUrl,   set: setYoutubeUrl },
      { label: 'X (Twitter) URL', placeholder: 'https://x.com/yourhandle',       value: twitterUrl,   set: setTwitterUrl },
    ];

    return (
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        {/* ── Form column ── */}
        <div className="space-y-4 max-w-2xl">
          {/* Welcome screen content */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
              <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <ImagePlus size={15} className="text-orange-500" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-800">Welcome Screen</h2>
                <p className="text-xs text-gray-400">The landing screen customers see after scanning a QR code</p>
              </div>
              {socialSaving && <Loader2 size={14} className="animate-spin text-gray-400" />}
            </div>
            <div className="p-5 space-y-4">
              {/* Hero / background image */}
              <Field label="Background Image">
                <div className="flex items-start gap-3">
                  <div className="w-28 h-20 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {welcomeImageUrl
                      ? <img src={welcomeImageUrl} alt="hero" className="w-full h-full object-cover" />
                      : <ImagePlus size={20} className="text-gray-300" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
                        {heroUploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                        {heroUploading ? 'Uploading…' : 'Upload image'}
                        <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} disabled={heroUploading} />
                      </label>
                      {welcomeImageUrl && (
                        <button
                          type="button"
                          onClick={() => { setWelcomeImageUrl(''); markDirty('branding'); }}
                          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-500 px-2 py-2 rounded-lg transition-colors"
                        >
                          <X size={13} /> Remove
                        </button>
                      )}
                    </div>
                    <input
                      className={input}
                      type="url"
                      placeholder="…or paste an image URL (leave blank for default)"
                      value={welcomeImageUrl}
                      onChange={(e) => { setWelcomeImageUrl(e.target.value); markDirty('branding'); }}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">Shown full-screen behind your logo and name. Recommended: a wide, high-quality photo.</p>
              </Field>

              <Field label="Welcome Heading">
                <input
                  className={input}
                  type="text"
                  maxLength={120}
                  placeholder={restaurant.name}
                  value={welcomeHeading}
                  onChange={(e) => { setWelcomeHeading(e.target.value); markDirty('branding'); }}
                />
                <p className="text-xs text-gray-400 mt-1">Big title on the welcome screen. Leave blank to use the restaurant name.</p>
              </Field>

              <Field label="Welcome Tagline">
                <input
                  className={input}
                  type="text"
                  maxLength={200}
                  placeholder="e.g. Scan, browse & order — right from your table"
                  value={welcomeTagline}
                  onChange={(e) => { setWelcomeTagline(e.target.value); markDirty('branding'); }}
                />
              </Field>
            </div>
          </div>

          {/* Social media links */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
              <div className="w-8 h-8 rounded-xl bg-pink-50 flex items-center justify-center flex-shrink-0">
                <Smartphone size={15} className="text-pink-500" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-800">Social Media Links</h2>
                <p className="text-xs text-gray-400">Icons shown on the welcome screen — leave blank to hide</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {socialFields.map((f) => (
                <Field key={f.label} label={f.label}>
                  <input
                    className={input}
                    type={f.type ?? 'url'}
                    placeholder={f.placeholder}
                    value={f.value}
                    onChange={(e) => { f.set(e.target.value); markDirty('branding'); }}
                  />
                </Field>
              ))}
            </div>
          </div>
        </div>

        {/* ── Live preview column ── */}
        <div className="xl:sticky xl:top-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Eye size={14} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Live Preview</span>
          </div>
          <div className="mx-auto w-[280px] h-[580px] rounded-[2.5rem] border-[10px] border-gray-900 bg-gray-900 shadow-2xl overflow-hidden relative">
            <WelcomeScreen
              restaurantName={restaurant.name}
              logo={restaurant.logo}
              themeColor={themeColor}
              heroUrl={welcomeImageUrl || null}
              heading={welcomeHeading}
              tagline={welcomeTagline || 'Scan, browse & order — right from your table'}
              subtitle="Table 5"
              social={{
                facebookUrl, instagramUrl, tiktokUrl,
                whatsappUrl, youtubeUrl, twitterUrl,
              }}
              followUsLabel="Follow us"
              ctaLabel="View Menu"
              poweredByLabel="Powered by QRApp"
              onEnter={() => {}}
              contained
            />
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">Updates as you type</p>
        </div>
      </div>
    );
  }

  function renderLoginTab() {
    if (!restaurant) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>;
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <LogIn size={15} className="text-orange-500" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-800">Login Page</h2>
              <p className="text-xs text-gray-400">Logo, image slider or video shown on your staff login page</p>
            </div>
            {loginUploading && <Loader2 size={14} className="animate-spin text-gray-400" />}
          </div>
          <div className="p-5 space-y-4">
            {/* Branded login link */}
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Your login link</p>
              <a
                href={`/login/${restaurant.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-orange-600 font-medium break-all hover:underline"
              >
                {`${window.location.origin}/login/${restaurant.slug}`}
              </a>
            </div>

            {/* Image slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Slider Images ({loginMedia.length}/10)</label>
                <label className="text-xs text-orange-600 font-semibold hover:underline cursor-pointer">
                  + Add images
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleLoginImageUpload} disabled={loginUploading} />
                </label>
              </div>
              {loginMedia.length === 0 ? (
                <p className="text-xs text-gray-400">No images yet — add a few photos for an auto-rotating slider.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {loginMedia.map((url) => (
                    <div key={url} className="relative group aspect-video rounded-lg overflow-hidden border border-gray-100">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeLoginImage(url)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Video URL */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Background Video URL (optional)</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
                placeholder="https://…/video.mp4"
                value={loginVideoUrl}
                onChange={(e) => { setLoginVideoUrl(e.target.value); markDirty('login'); }}
              />
              <p className="text-xs text-gray-400 mt-1">If set, the video plays instead of the image slider.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderPrintersTab() {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <Printer size={17} className="text-orange-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">Printer Settings</h2>
              <p className="text-xs text-gray-400">ESC/POS thermal printers via TCP/IP (server must be on the same network as the printer)</p>
            </div>
          </div>

          {printerSuccess && (
            <div className="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
              <CheckCircle2 size={14} /> Printer settings saved!
            </div>
          )}

          {/* Printer type */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Printer Protocol</label>
            <div className="flex gap-2">
              {(['epson', 'star'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setPrinterType(t); markDirty('printers'); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    printerType === t ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-200 text-gray-600 hover:border-orange-200'
                  }`}
                >
                  {t === 'epson' ? 'Epson / ESC-POS' : 'Star Micronics'}
                </button>
              ))}
            </div>
          </div>

          {/* Receipt printer */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Receipt Printer</p>
            <div className="flex gap-2">
              <input
                value={receiptPrinterIp}
                onChange={(e) => { setReceiptPrinterIp(e.target.value); markDirty('printers'); }}
                placeholder="192.168.1.100"
                className={`${input} flex-1`}
              />
              <input
                value={receiptPrinterPort}
                onChange={(e) => { setReceiptPrinterPort(e.target.value); markDirty('printers'); }}
                placeholder="9100"
                className={`${input} w-24`}
              />
            </div>
            <button
              type="button"
              onClick={() => handleTestPrint('receipt')}
              disabled={!receiptPrinterIp.trim() || testingPrinter === 'receipt'}
              className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 disabled:opacity-40 font-medium"
            >
              {testingPrinter === 'receipt' ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
              Test Print
            </button>
          </div>

          {/* Kitchen printer */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Kitchen Printer</p>
            <div className="flex gap-2">
              <input
                value={kitchenPrinterIp}
                onChange={(e) => { setKitchenPrinterIp(e.target.value); markDirty('printers'); }}
                placeholder="192.168.1.101"
                className={`${input} flex-1`}
              />
              <input
                value={kitchenPrinterPort}
                onChange={(e) => { setKitchenPrinterPort(e.target.value); markDirty('printers'); }}
                placeholder="9100"
                className={`${input} w-24`}
              />
            </div>
            <button
              type="button"
              onClick={() => handleTestPrint('kitchen')}
              disabled={!kitchenPrinterIp.trim() || testingPrinter === 'kitchen'}
              className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 disabled:opacity-40 font-medium"
            >
              {testingPrinter === 'kitchen' ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
              Test Print
            </button>
          </div>

          {/* Auto-print toggles */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Auto-Print</p>
            {([
              { key: 'kitchen', label: 'Auto-print kitchen ticket when new order arrives', value: autoPrintKitchen, set: setAutoPrintKitchen },
              { key: 'receipt', label: 'Auto-print receipt when bill is settled',          value: autoPrintReceipt, set: setAutoPrintReceipt },
            ] as const).map(({ key, label, value, set }) => (
              <label key={key} className="flex items-center justify-between gap-4 cursor-pointer">
                <span className="text-sm text-gray-700">{label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={value}
                  onClick={() => { set(!value); markDirty('printers'); }}
                  className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${value ? 'bg-orange-500' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${value ? 'translate-x-5' : ''}`} />
                </button>
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const tabContentMap: Record<TabId, () => React.ReactNode> = {
    account:     renderAccountTab,
    preferences: renderPreferencesTab,
    restaurant:  renderRestaurantTab,
    receipt:     renderReceiptTab,
    operations:  renderOperationsTab,
    branding:    renderBrandingTab,
    login:       renderLoginTab,
    printers:    renderPrintersTab,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />

      <main className="flex-1 overflow-y-auto mt-14 md:mt-0 flex flex-col">
        <AdminHeader title="Settings" subtitle="Manage your restaurant configuration" />
        <div className="w-full px-4 sm:px-6 py-6 space-y-4 flex-1">

          {/* ── Hero profile card ──────────────────────────────────────────── */}
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg shadow-orange-200">
            {/* Optional banner background image */}
            {restaurant?.bannerImage && (
              <>
                <img src={restaurant.bannerImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/45 to-black/30" />
              </>
            )}

            {/* Banner controls */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
              <label className="cursor-pointer flex items-center gap-1.5 bg-black/25 hover:bg-black/40 backdrop-blur text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors">
                {bannerUploading
                  ? <Loader2 size={13} className="animate-spin" />
                  : <ImagePlus size={13} />}
                {restaurant?.bannerImage ? 'Change banner' : 'Add banner'}
                <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} disabled={bannerUploading} />
              </label>
              {restaurant?.bannerImage && (
                <button
                  onClick={handleBannerRemove}
                  className="w-7 h-7 rounded-full bg-black/25 hover:bg-black/40 flex items-center justify-center transition-colors"
                  title="Remove banner"
                >
                  <X size={13} className="text-white" />
                </button>
              )}
            </div>

            <div className="relative flex items-center gap-5">
              {/* Logo / avatar */}
              <label className="relative cursor-pointer group flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/20 backdrop-blur border-2 border-white/40 flex items-center justify-center shadow-inner">
                  {restaurant?.logo
                    ? <img src={restaurant.logo} alt="logo" className="w-full h-full object-contain" />
                    : <span className="text-white font-bold text-3xl">{user?.name.charAt(0).toUpperCase()}</span>}
                </div>
                <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                  {logoUploading
                    ? <Loader2 size={18} className="animate-spin text-white" />
                    : <><ImagePlus size={18} className="text-white" /><span className="text-white text-[10px] font-medium">Upload</span></>}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
              </label>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold truncate drop-shadow">{user?.name}</p>
                <p className="text-sm text-orange-100 truncate drop-shadow">@{user?.username}</p>
                {restaurant && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur rounded-full px-3 py-1">
                    <span className="text-xs font-medium text-white truncate">{restaurant.name}</span>
                  </div>
                )}
              </div>
            </div>

            {!restaurant?.bannerImage && (
              <p className="relative text-xs text-orange-200 mt-3 text-center">
                Add a banner image to personalise this header
              </p>
            )}
          </div>

          {/* ── Tab bar (segmented pills, wrap so every tab stays visible) ──── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 flex flex-wrap gap-1 mb-6">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              const dirty = isDirty[tab.id];
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap rounded-xl transition-colors ${
                    active
                      ? 'bg-gray-900 text-white font-semibold'
                      : 'text-gray-500 font-medium hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <tab.Icon size={15} />
                  {tab.label}
                  {dirty && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-amber-500'}`}
                      aria-label="unsaved changes"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Tab content ───────────────────────────────────────────────── */}
          {tabContentMap[activeTab]()}

          {/* ── Footer links (always visible below tab content) ───────────── */}
          <div className="pt-4 space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
              <Link
                to="/admin/users"
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <Users size={17} className="text-purple-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">Manage Users</p>
                  <p className="text-xs text-gray-400">Add, edit or remove admin &amp; kitchen accounts</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </Link>
            </div>

            <button
              onClick={() => { logout(); navigate('/', { replace: true }); }}
              className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-500 hover:bg-red-50 py-3.5 rounded-2xl text-sm font-semibold transition-colors"
            >
              <LogOut size={16} />
              Log out of this device
            </button>

            <div className="h-4" />
          </div>

        </div>

        {/* ── Sticky save bar (unified across every editable tab) ───────────── */}
        {isDirty[activeTab] && !INSTANT_TABS.includes(activeTab) && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-between shadow-md">
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              You have unsaved changes
            </p>
            <button
              onClick={handleStickyBarSave}
              disabled={savingByTab[activeTab]}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              {savingByTab[activeTab] && <Loader2 size={14} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
