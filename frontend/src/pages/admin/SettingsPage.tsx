import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Loader2, CheckCircle2, Users,
  DollarSign, ImagePlus, X, Lock, User, LogOut, ChevronRight, Palette, Hash, Clock, Printer,
  Store, Smartphone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminSidebar } from '../../components/AdminSidebar';
import { useAuth } from '../../context/AuthContext';
import { restaurantService, CURRENCIES, type RestaurantSettings } from '../../services/restaurantService';
import { printService } from '../../services/printService';
import { uploadImage } from '../../services/uploadService';
import { useCurrency } from '../../context/CurrencyContext';
import { applyTheme } from '../../context/ThemeContext';
import { WelcomeScreen } from '../../components/WelcomeScreen';

type TabId = 'account' | 'restaurant' | 'operations' | 'content' | 'printers';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const input = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent bg-gray-50 focus:bg-white transition-colors";

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
  { id: 'restaurant',  label: 'Restaurant',  Icon: Store },
  { id: 'operations',  label: 'Operations',  Icon: Clock },
  { id: 'content',     label: 'Content',     Icon: Smartphone },
  { id: 'printers',    label: 'Printers',    Icon: Printer },
];

export function SettingsPage() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>('account');

  // isDirty per tab (account and restaurant track form edits; content and printers too)
  const [isDirty, setIsDirty] = useState<Record<TabId, boolean>>({
    account: false,
    restaurant: false,
    operations: false,
    content: false,
    printers: false,
  });

  function markDirty(tab: TabId) {
    setIsDirty((prev) => prev[tab] ? prev : { ...prev, [tab]: true });
  }
  function markClean(tab: TabId) {
    setIsDirty((prev) => ({ ...prev, [tab]: false }));
  }

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
  const [serviceChargePct, setServiceChargePct] = useState('0');
  const [taxPct, setTaxPct] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSuccess, setBillingSuccess] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem('qra-theme') ?? '#f97316');
  const [themeSaving, setThemeSaving] = useState(false);
  const [orderPrefix, setOrderPrefix] = useState('ORD');
  const [prefixSaving, setPrefixSaving] = useState(false);

  // ── Operations state ───────────────────────────────────────────────────────
  const [waitTimeMin, setWaitTimeMin] = useState<number | null>(null);
  const [waitTimeSaving, setWaitTimeSaving] = useState(false);
  const [timezone, setTimezone] = useState('UTC');
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  const [rsOpen, setRsOpen]   = useState('');
  const [rsClose, setRsClose] = useState('');
  const [rsEnabled, setRsEnabled] = useState(false);
  const [rsSaving, setRsSaving] = useState(false);
  const [rsSuccess, setRsSuccess] = useState(false);

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
  const [socialSuccess, setSocialSuccess] = useState(false);

  // ── Login-page branding state ────────────────────────────────────────────────
  const [loginMedia, setLoginMedia] = useState<string[]>([]);
  const [loginVideoUrl, setLoginVideoUrl] = useState('');
  const [loginUploading, setLoginUploading] = useState(false);
  const [loginSaving, setLoginSaving] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

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

  const { loadCurrency } = useCurrency();

  useEffect(() => {
    restaurantService.getMyRestaurant().then((r) => {
      if (!r) return;
      setRestaurant(r);
      setServiceChargePct(String(r.serviceChargePct));
      setTaxPct(String(r.taxPct));
      setCurrency(r.currency ?? 'USD');
      setThemeColor(r.themeColor ?? '#f97316');
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

  // ── Save functions (all existing, untouched logic) ─────────────────────────
  async function saveTheme(hex: string) {
    if (!restaurant) return;
    setThemeColor(hex);
    applyTheme(hex);
    setThemeSaving(true);
    try {
      const updated = await restaurantService.updateTheme(restaurant.id, hex);
      setRestaurant(updated);
    } finally {
      setThemeSaving(false);
    }
  }

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

  async function saveWaitTime(val: number | null) {
    if (!restaurant) return;
    setWaitTimeSaving(true);
    try {
      const updated = await restaurantService.updateWaitTime(restaurant.id, val);
      setRestaurant(updated);
      setWaitTimeMin(updated.waitTimeMin ?? null);
    } finally {
      setWaitTimeSaving(false);
    }
  }

  async function saveTimezone(tz: string) {
    if (!restaurant) return;
    setTimezone(tz);
    setTimezoneSaving(true);
    try {
      const updated = await restaurantService.updateTimezone(restaurant.id, tz);
      setRestaurant(updated);
    } catch {
      import('react-hot-toast').then(({ default: toast }) => toast.error('Failed to update timezone'));
    } finally {
      setTimezoneSaving(false);
    }
  }

  async function saveRoomServiceHours() {
    if (!restaurant) return;
    setRsSaving(true);
    setRsSuccess(false);
    try {
      const open  = rsEnabled && rsOpen  ? rsOpen  : null;
      const close = rsEnabled && rsClose ? rsClose : null;
      const updated = await restaurantService.updateRoomServiceHours(restaurant.id, open, close);
      setRestaurant(updated);
      setRsSuccess(true);
      setTimeout(() => setRsSuccess(false), 3000);
    } finally {
      setRsSaving(false);
    }
  }

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    setHeroUploading(true);
    try {
      const url = await uploadImage(e.target.files[0]);
      setWelcomeImageUrl(url);
      markDirty('content');
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
    setSocialSuccess(false);
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
      setSocialSuccess(true);
      markClean('content');
      setTimeout(() => setSocialSuccess(false), 3000);
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
      markDirty('content');
    } catch {
      toast.error('Image upload failed');
    } finally {
      setLoginUploading(false);
      e.target.value = '';
    }
  }

  function removeLoginImage(url: string) {
    setLoginMedia((prev) => prev.filter((u) => u !== url));
    markDirty('content');
  }

  async function saveLoginBranding() {
    if (!restaurant) return;
    setLoginSaving(true);
    setLoginSuccess(false);
    try {
      const updated = await restaurantService.updateLoginBranding(restaurant.id, {
        loginMedia,
        loginVideoUrl: loginVideoUrl.trim() || null,
      });
      setRestaurant(updated);
      setLoginSuccess(true);
      setTimeout(() => setLoginSuccess(false), 3000);
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
      const updated = await restaurantService.updateCharges(restaurant.id, { serviceChargePct: sc, taxPct: tax, currency });
      setRestaurant(updated);
      loadCurrency(updated.id);
      setBillingSuccess(true);
      setTimeout(() => setBillingSuccess(false), 3000);
    } finally {
      setBillingLoading(false);
    }
  }

  // Restaurant tab combined save (billing + prefix)
  async function saveRestaurant() {
    await saveBilling();
    await saveOrderPrefix();
    markClean('restaurant');
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
    if (activeTab === 'account') {
      document.getElementById('account-form-submit')?.click();
    } else if (activeTab === 'restaurant') {
      void saveRestaurant();
    } else if (activeTab === 'content') {
      void saveSocial();
    } else if (activeTab === 'printers') {
      void savePrinter();
    }
  }

  // ── Tab content renderers ──────────────────────────────────────────────────

  function renderAccountTab() {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <User size={15} className="text-blue-500" />
            </div>
            <h2 className="font-semibold text-gray-800">Account</h2>
          </div>

          <form id="account-form" onSubmit={handleSubmit} className="p-5 space-y-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div className="border-t border-gray-50 pt-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Lock size={13} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Change Password</span>
              </div>

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

              {newPassword && (
                <Field label="Confirm Password">
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

            <div className="border-t border-gray-50 pt-4">
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

            {/* Hidden submit trigger for sticky bar */}
            <button id="account-form-submit" type="submit" className="hidden" />

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              style={{ backgroundColor: themeColor }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Saving…' : 'Save Account Changes'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  function renderRestaurantTab() {
    if (!restaurant) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>;
    return (
      <div className="space-y-4 max-w-2xl">

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
              {[
                { label: 'Service Charge', value: serviceChargePct, set: setServiceChargePct },
                { label: 'Tax',            value: taxPct,            set: setTaxPct },
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
                    <span>Service Charge ({serviceChargePct}%)</span><span>+{sym}{previewSC.toFixed(2)}</span>
                  </div>
                )}
                {previewTax > 0 && (
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>Tax ({taxPct}%)</span><span>+{sym}{previewTax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-1">
                  <span>Total</span><span className="text-orange-600">{sym}{previewTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
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

        {/* Theme Colour */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: themeColor + '22' }}>
              <Palette size={15} style={{ color: themeColor }} />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-800">Theme Colour</h2>
              <p className="text-xs text-gray-400">Applied to buttons, icons and accents across the app</p>
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-center gap-3">
              <label className="relative cursor-pointer group flex-shrink-0">
                <div
                  className="w-14 h-14 rounded-2xl shadow-sm border-2 border-white ring-1 ring-gray-200 transition-transform group-hover:scale-105 overflow-hidden"
                  style={{ backgroundColor: themeColor }}
                />
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => { applyTheme(e.target.value); setThemeColor(e.target.value); }}
                  onBlur={(e) => saveTheme(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </label>
              <div className="flex-1">
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-3 bg-gray-50">
                  <span className="text-gray-400 text-sm font-mono">#</span>
                  <input
                    type="text"
                    value={themeColor.replace('#', '')}
                    onChange={(e) => {
                      const hex = '#' + e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                      setThemeColor(hex);
                      if (/^#[0-9a-fA-F]{6}$/.test(hex)) applyTheme(hex);
                    }}
                    onBlur={(e) => {
                      const hex = '#' + e.target.value.replace(/[^0-9a-fA-F]/g, '');
                      if (/^#[0-9a-fA-F]{6}$/.test(hex)) saveTheme(hex);
                    }}
                    maxLength={6}
                    className="flex-1 bg-transparent text-sm font-mono text-gray-700 outline-none uppercase tracking-wider"
                    placeholder="f97316"
                  />
                  {themeSaving && <Loader2 size={13} className="animate-spin text-gray-400 flex-shrink-0" />}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Click the swatch to open the colour picker, or type a hex code. Theme auto-saves on blur.</p>
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
            {timezoneSaving && <Loader2 size={14} className="animate-spin text-gray-400" />}
          </div>
          <div className="p-5">
            <select
              value={timezone}
              onChange={(e) => saveTimezone(e.target.value)}
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
            {waitTimeSaving && <Loader2 size={14} className="animate-spin text-gray-400 ml-auto" />}
          </div>

          <div className="p-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              {[null, 10, 15, 20, 25, 30, 45, 60].map((val) => (
                <button
                  key={val ?? 'off'}
                  onClick={() => saveWaitTime(val)}
                  disabled={waitTimeSaving}
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
                onChange={(e) => setWaitTimeMin(e.target.value ? Number(e.target.value) : null)}
                onBlur={() => saveWaitTime(waitTimeMin)}
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
            {rsSuccess && (
              <div className="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <CheckCircle2 size={14} /> Room service hours saved!
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setRsEnabled((p) => !p)}
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
                    onChange={(e) => setRsOpen(e.target.value)}
                    className={input}
                  />
                </Field>
                <Field label="Closes at">
                  <input
                    type="time"
                    value={rsClose}
                    onChange={(e) => setRsClose(e.target.value)}
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

            <button
              onClick={saveRoomServiceHours}
              disabled={rsSaving || (rsEnabled && (!rsOpen || !rsClose))}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
            >
              {rsSaving && <Loader2 size={15} className="animate-spin" />}
              {rsSaving ? 'Saving…' : 'Save Room Service Hours'}
            </button>
          </div>
        </div>

      </div>
    );
  }

  function renderContentTab() {
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
              {socialSuccess && <CheckCircle2 size={14} className="text-green-500" />}
            </div>
            <div className="p-5 space-y-4">
              {socialSuccess && (
                <div className="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                  <CheckCircle2 size={14} /> Welcome screen settings saved!
                </div>
              )}

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
                          onClick={() => { setWelcomeImageUrl(''); markDirty('content'); }}
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
                      onChange={(e) => { setWelcomeImageUrl(e.target.value); markDirty('content'); }}
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
                  onChange={(e) => { setWelcomeHeading(e.target.value); markDirty('content'); }}
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
                  onChange={(e) => { setWelcomeTagline(e.target.value); markDirty('content'); }}
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
                    onChange={(e) => { f.set(e.target.value); markDirty('content'); }}
                  />
                </Field>
              ))}
            </div>
          </div>

          {/* ── Login Page branding ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
              <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <Store size={15} className="text-orange-500" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-800">Login Page</h2>
                <p className="text-xs text-gray-400">Logo, image slider or video shown on your staff login page</p>
              </div>
              {loginUploading && <Loader2 size={14} className="animate-spin text-gray-400" />}
              {loginSuccess && <CheckCircle2 size={14} className="text-green-500" />}
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
                  onChange={(e) => { setLoginVideoUrl(e.target.value); markDirty('content'); }}
                />
                <p className="text-xs text-gray-400 mt-1">If set, the video plays instead of the image slider.</p>
              </div>

              <button
                onClick={saveLoginBranding}
                disabled={loginSaving}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loginSaving && <Loader2 size={14} className="animate-spin" />}
                Save Login Page
              </button>
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
    restaurant:  renderRestaurantTab,
    operations:  renderOperationsTab,
    content:     renderContentTab,
    printers:    renderPrintersTab,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />

      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 flex flex-col">
        <div className="w-full px-4 sm:px-6 py-6 space-y-4 flex-1">

          {/* Page header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage your restaurant configuration</p>
          </div>

          {/* ── Hero profile card ──────────────────────────────────────────── */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg shadow-orange-200">
            <div className="flex items-center gap-5">
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
                <p className="text-xl font-bold truncate">{user?.name}</p>
                <p className="text-sm text-orange-100 truncate">@{user?.username}</p>
                {restaurant && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur rounded-full px-3 py-1">
                    <span className="text-xs font-medium text-white truncate">{restaurant.name}</span>
                  </div>
                )}
              </div>

              {/* Remove logo */}
              {restaurant?.logo && (
                <button
                  onClick={handleLogoRemove}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors flex-shrink-0"
                  title="Remove logo"
                >
                  <X size={13} className="text-white" />
                </button>
              )}
            </div>

            {!restaurant?.logo && (
              <p className="text-xs text-orange-200 mt-3 text-center">
                Tap the avatar to upload your restaurant logo
              </p>
            )}
          </div>

          {/* ── Tab bar ───────────────────────────────────────────────────── */}
          <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none border-b border-gray-100 mb-6">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? 'border-orange-500 text-gray-900 font-bold'
                      : 'border-transparent text-gray-500 font-medium hover:text-gray-700'
                  }`}
                >
                  <tab.Icon size={15} />
                  {tab.label}
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

        {/* ── Sticky save bar ───────────────────────────────────────────── */}
        {isDirty[activeTab] && activeTab !== 'operations' && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-between shadow-md">
            <p className="text-sm text-gray-500">You have unsaved changes</p>
            <button
              onClick={handleStickyBarSave}
              disabled={
                (activeTab === 'account' && loading) ||
                (activeTab === 'restaurant' && (billingLoading || prefixSaving)) ||
                (activeTab === 'content' && socialSaving) ||
                (activeTab === 'printers' && printerSaving)
              }
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              {(loading || billingLoading || prefixSaving || socialSaving || printerSaving) && (
                <Loader2 size={14} className="animate-spin" />
              )}
              Save Changes
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
