import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Eye, EyeOff, Loader2, CheckCircle2, Users,
  DollarSign, ImagePlus, X, Lock, User, LogOut, ChevronRight, Palette, Hash, Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { restaurantService, CURRENCIES, type RestaurantSettings } from '../../services/restaurantService';
import { uploadImage } from '../../services/uploadService';
import { useCurrency } from '../../context/CurrencyContext';
import { applyTheme } from '../../context/ThemeContext';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const input = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent bg-gray-50 focus:bg-white transition-colors";

export function SettingsPage() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

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
  const [prefixSuccess, setPrefixSuccess] = useState(false);
  const [waitTimeMin, setWaitTimeMin] = useState<number | null>(null);
  const [waitTimeSaving, setWaitTimeSaving] = useState(false);
  const [rsOpen, setRsOpen]   = useState('');
  const [rsClose, setRsClose] = useState('');
  const [rsEnabled, setRsEnabled] = useState(false);
  const [rsSaving, setRsSaving] = useState(false);
  const [rsSuccess, setRsSuccess] = useState(false);
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
      if (r.roomServiceOpen && r.roomServiceClose) {
        setRsEnabled(true);
        setRsOpen(r.roomServiceOpen);
        setRsClose(r.roomServiceClose);
      }
    });
  }, []);

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

  async function saveTheme(hex: string) {
    if (!restaurant) return;
    setThemeColor(hex);
    applyTheme(hex); // instant preview
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
    setPrefixSuccess(false);
    try {
      const updated = await restaurantService.updateOrderPrefix(restaurant.id, clean);
      setRestaurant(updated);
      setOrderPrefix(updated.orderNumberPrefix ?? clean);
      setPrefixSuccess(true);
      setTimeout(() => setPrefixSuccess(false), 3000);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
          <Link to="/admin" className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Settings</h1>
        </div>
      </header>

      <main className="px-3 sm:px-4 lg:px-6 py-6 space-y-4">

        {/* ── Hero profile card ─────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg shadow-orange-200">
          <div className="flex items-center gap-5">
            {/* Logo / avatar */}
            <label className="relative cursor-pointer group flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/20 backdrop-blur border-2 border-white/40 flex items-center justify-center shadow-inner">
                {restaurant?.logo
                  ? <img src={restaurant.logo} alt="logo" className="w-full h-full object-contain" />
                  : <span className="text-white font-bold text-3xl">{user?.name.charAt(0).toUpperCase()}</span>}
              </div>
              {/* Hover overlay */}
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

        {/* ── Two-column grid on lg+, right side splits again on xl ──── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

          {/* ══ COL 1 — Account ══════════════════════════════════════════ */}
          <div className="space-y-4">

        {/* ── Account credentials ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <User size={15} className="text-blue-500" />
            </div>
            <h2 className="font-semibold text-gray-800">Account</h2>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Display Name">
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className={input} />
              </Field>
              <Field label="Username">
                <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} autoComplete="username" className={input} />
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
                    onChange={(e) => setNewPassword(e.target.value)}
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
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    onChange={(e) => setCurrentPassword(e.target.value)}
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

          </div>{/* end LEFT column */}

          {/* ══ COL 2+3 — nested grid: splits into 2 on xl ══════════════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">

          {/* ── COL 2 — Billing + Order Number ───────────────────────── */}
          <div className="space-y-4">

        {/* ── Billing configuration ─────────────────────────────────────── */}
        {restaurant && (
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
                        value={value} onChange={(e) => set(e.target.value)}
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
                  onChange={(e) => setCurrency(e.target.value)}
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

              <button
                onClick={saveBilling}
                disabled={billingLoading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                {billingLoading && <Loader2 size={15} className="animate-spin" />}
                {billingLoading ? 'Saving…' : 'Save Billing Settings'}
              </button>
            </div>
          </div>
        )}

        {/* ── Order Number Prefix ──────────────────────────────────────── */}
        {restaurant && (
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
              {prefixSuccess && (
                <div className="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                  <CheckCircle2 size={14} /> Order prefix saved!
                </div>
              )}

              <Field label="Prefix (letters / numbers only)">
                <input
                  type="text"
                  value={orderPrefix}
                  onChange={(e) => setOrderPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
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

              <button
                onClick={saveOrderPrefix}
                disabled={prefixSaving || !orderPrefix.trim()}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                {prefixSaving && <Loader2 size={15} className="animate-spin" />}
                {prefixSaving ? 'Saving…' : 'Save Order Prefix'}
              </button>
            </div>
          </div>
        )}

          </div>{/* end COL 2 */}

          {/* ── COL 3 — Wait Time + Room Service + Theme ─────────────── */}
          <div className="space-y-4">

        {/* ── Estimated Wait Time ───────────────────────────────────────── */}
        {restaurant && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                <Clock size={15} className="text-amber-500" />
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
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-amber-300 hover:bg-amber-50'
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
                  className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-amber-300 bg-gray-50 focus:bg-white"
                />
                <span className="text-xs text-gray-400">min</span>
              </div>

              <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                waitTimeMin ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-gray-50 text-gray-400'
              }`}>
                <Clock size={14} />
                {waitTimeMin
                  ? `Customers will see "Est. wait: ~${waitTimeMin} min" after ordering`
                  : 'No wait time shown to customers'}
              </div>
            </div>
          </div>
        )}

        {/* ── Room Service Hours ───────────────────────────────────────── */}
        {restaurant && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                <Clock size={15} className="text-blue-500" />
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

              {/* Enable toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setRsEnabled((p) => !p)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${rsEnabled ? 'bg-blue-500' : 'bg-gray-200'}`}
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
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
                  <Clock size={14} />
                  Room service available {rsOpen} – {rsClose}
                  {rsOpen > rsClose ? ' (wraps midnight)' : ''}
                </div>
              )}

              <button
                onClick={saveRoomServiceHours}
                disabled={rsSaving || (rsEnabled && (!rsOpen || !rsClose))}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                {rsSaving && <Loader2 size={15} className="animate-spin" />}
                {rsSaving ? 'Saving…' : 'Save Room Service Hours'}
              </button>
            </div>
          </div>
        )}

        {/* ── Theme colour ─────────────────────────────────────────────── */}
        {restaurant && (
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
                  <p className="text-xs text-gray-400 mt-1.5">Click the swatch to open the colour picker, or type a hex code</p>
                </div>
              </div>
            </div>
          </div>
        )}

          </div>{/* end COL 3 */}

          </div>{/* end nested xl:grid-cols-2 */}
        </div>{/* end outer lg:grid-cols-2 */}

        {/* ── Quick links (full width below grid) ──────────────────────── */}
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

        {/* ── Sign out ──────────────────────────────────────────────────── */}
        <button
          onClick={() => { logout(); navigate('/login', { replace: true }); }}
          className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-500 hover:bg-red-50 py-3.5 rounded-2xl text-sm font-semibold transition-colors"
        >
          <LogOut size={16} />
          Log out of this device
        </button>

        <div className="h-4" />
      </main>
    </div>
  );
}
