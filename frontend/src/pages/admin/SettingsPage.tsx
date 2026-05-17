import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2, CheckCircle, Users, Receipt, ImagePlus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { restaurantService, CURRENCIES, type RestaurantSettings } from '../../services/restaurantService';
import { uploadImage } from '../../services/uploadService';
import { useCurrency } from '../../context/CurrencyContext';

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

  // ── Billing settings ──────────────────────────────────────────────────────
  const [restaurant, setRestaurant] = useState<RestaurantSettings | null>(null);
  const [serviceChargePct, setServiceChargePct] = useState('0');
  const [taxPct, setTaxPct] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSuccess, setBillingSuccess] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const { loadCurrency } = useCurrency();

  useEffect(() => {
    restaurantService.getMyRestaurant().then((r) => {
      if (!r) return;
      setRestaurant(r);
      setServiceChargePct(String(r.serviceChargePct));
      setTaxPct(String(r.taxPct));
      setCurrency(r.currency ?? 'USD');
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
      // silent — toast is already shown by uploadImage on error
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

  async function saveBilling() {
    if (!restaurant) return;
    const sc  = parseFloat(serviceChargePct);
    const tax = parseFloat(taxPct);
    if ([sc, tax].some((v) => isNaN(v) || v < 0 || v > 100)) return;
    setBillingLoading(true);
    setBillingSuccess(false);
    try {
      const updated = await restaurantService.updateCharges(restaurant.id, {
        serviceChargePct: sc,
        taxPct: tax,
        currency,
      });
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
    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match'); return;
    }
    if (newPassword && newPassword.length < 6) {
      setError('New password must be at least 6 characters'); return;
    }

    setLoading(true);
    try {
      await updateProfile({
        currentPassword,
        newUsername:  newUsername.trim()  !== user?.username ? newUsername.trim()  : undefined,
        newName:      newName.trim()      !== user?.name     ? newName.trim()      : undefined,
        newPassword:  newPassword || undefined,
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-gray-600"><ArrowLeft size={20} /></Link>
          <h1 className="text-xl font-bold text-gray-900">Account Settings</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Current user info + restaurant logo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex items-center gap-4">
          {/* Logo upload avatar */}
          <label className="relative cursor-pointer group flex-shrink-0">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-gray-200 bg-orange-50 flex items-center justify-center">
              {restaurant?.logo
                ? <img src={restaurant.logo} alt="logo" className="w-full h-full object-contain" />
                : <span className="text-orange-600 font-bold text-2xl">{user?.name.charAt(0).toUpperCase()}</span>}
            </div>
            <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {logoUploading
                ? <Loader2 size={16} className="animate-spin text-white" />
                : <ImagePlus size={16} className="text-white" />}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
          </label>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">{user?.name}</p>
            <p className="text-sm text-gray-500">@{user?.username} · <span className="capitalize">{user?.role}</span></p>
            {restaurant && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{restaurant.name}</p>
            )}
          </div>

          {restaurant?.logo && (
            <button onClick={handleLogoRemove} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0" title="Remove logo">
              <X size={16} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Change Credentials</h2>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
              <CheckCircle size={16} /> Credentials updated successfully!
            </div>
          )}

          {/* Display name */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Display Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
            />
          </div>

          {/* New username */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Username</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              autoComplete="username"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
            />
          </div>

          <hr className="border-gray-100" />

          {/* New password */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-11 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
              />
              <button type="button" onClick={() => setShowNew((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm new password */}
          {newPassword && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Confirm New Password</label>
              <input
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Repeat new password"
                className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent ${
                  confirmPassword && confirmPassword !== newPassword
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200'
                }`}
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>
          )}

          <hr className="border-gray-100" />

          {/* Current password to confirm identity */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Current Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter current password to confirm"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-11 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
              />
              <button type="button" onClick={() => setShowCurrent((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-2xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </form>

        {/* User management */}
        <Link
          to="/admin/users"
          className="mt-4 flex items-center gap-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:border-orange-200 transition-colors"
        >
          <div className="bg-orange-50 p-3 rounded-xl text-orange-600">
            <Users size={20} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Manage Users</p>
            <p className="text-sm text-gray-500">Add, edit or remove admin &amp; kitchen accounts</p>
          </div>
        </Link>

        {/* Billing settings */}
        {restaurant && (
          <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-orange-500" />
              <h2 className="font-semibold text-gray-800">Billing Configuration</h2>
            </div>
            <p className="text-xs text-gray-400 -mt-2">
              Service charge applies to dine-in orders only. Tax applies to all orders.
            </p>

            {billingSuccess && (
              <div className="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <CheckCircle size={15} /> Billing settings saved!
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Service Charge', value: serviceChargePct, set: setServiceChargePct },
                { label: 'Tax',            value: taxPct,            set: setTaxPct },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">{label}</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Currency */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} — {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Live preview */}
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1 border border-gray-100">
              <p className="font-medium text-gray-700 mb-2">Preview on $100.00 subtotal</p>
              {(() => {
                const sub = 100;
                const sc  = sub * (parseFloat(serviceChargePct) || 0) / 100;
                const tax = (sub + sc) * (parseFloat(taxPct) || 0) / 100;
                const tot = sub + sc + tax;
                return (
                  <>
                    {(() => { const sym = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency; return (<>
                    <div className="flex justify-between"><span>Subtotal</span><span>{sym}100.00</span></div>
                    {sc  > 0 && <div className="flex justify-between"><span>Service Charge ({serviceChargePct}%)</span><span>+{sym}{sc.toFixed(2)}</span></div>}
                    {tax > 0 && <div className="flex justify-between"><span>Tax ({taxPct}%)</span><span>+{sym}{tax.toFixed(2)}</span></div>}
                    <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                      <span>Total</span><span>{sym}{tot.toFixed(2)}</span>
                    </div>
                  </>); })()}
                  </>
                );
              })()}
            </div>

            <button
              onClick={saveBilling}
              disabled={billingLoading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-2xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
            >
              {billingLoading && <Loader2 size={15} className="animate-spin" />}
              {billingLoading ? 'Saving…' : 'Save Billing Settings'}
            </button>
          </div>
        )}

        {/* Danger zone */}
        <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Session</h2>
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
            className="w-full border border-red-200 text-red-500 hover:bg-red-50 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Log out of this device
          </button>
        </div>
      </main>
    </div>
  );
}
