import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Check, X, Store, LogOut,
  ChevronDown, ChevronUp, LogIn, Users, Sliders, CreditCard,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import type { RestaurantFeatures } from '../../context/AuthContext';
import { subscriptionService, daysUntil, type PlanCode, type SubscriptionStatus } from '../../services/subscriptionService';

const PLAN_CODES: PlanCode[] = ['free', 'starter', 'pro'];
const STATUSES: SubscriptionStatus[] = ['trialing', 'active', 'past_due', 'canceled'];
const SUB_BADGE: Record<string, string> = {
  trialing: 'bg-blue-100 text-blue-700',
  active:   'bg-green-100 text-green-700',
  past_due: 'bg-amber-100 text-amber-700',
  canceled: 'bg-red-100 text-red-600',
};

const FEATURE_LABELS: { key: keyof RestaurantFeatures; label: string; description: string }[] = [
  { key: 'combos',          label: 'Combo Deals',       description: 'Bundle menu items into combo packages' },
  { key: 'menuSchedules',   label: 'Menu Schedules',    description: 'Time-based menus (breakfast, lunch, dinner)' },
  { key: 'bills',           label: 'Bills',             description: 'Bill management and payment processing' },
  { key: 'roomCharges',     label: 'Room Charges',      description: 'Charge orders to hotel room accounts' },
  { key: 'promoCodes',      label: 'Promo Codes',       description: 'Discount codes and promotional offers' },
  { key: 'reports',         label: 'Reports',           description: 'Sales analytics and revenue reports' },
  { key: 'shiftReport',     label: 'Shift Report',      description: 'End-of-shift summary and close reports' },
  { key: 'tableStatus',     label: 'Table Status',      description: 'Live table occupancy overview' },
  { key: 'kitchenDisplay',  label: 'Kitchen Display',   description: 'KDS screen for kitchen staff' },
  { key: 'readyDisplay',    label: 'Ready Display',     description: 'Order-ready notification screen' },
  { key: 'staffPerformance',label: 'Staff Performance', description: 'Staff productivity and tips tracking' },
  { key: 'roster',          label: 'Roster',            description: 'Staff shift scheduling' },
];

const ALL_FEATURES_ON: RestaurantFeatures = {
  combos: true, menuSchedules: true, roomCharges: true, promoCodes: true,
  reports: true, roster: true, shiftReport: true, staffPerformance: true,
  tableStatus: true, readyDisplay: true, kitchenDisplay: true, bills: true,
};

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  features?: RestaurantFeatures;
  plan?: PlanCode;
  subscriptionStatus?: SubscriptionStatus;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}

interface RestaurantUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'kitchen';
}

interface CreatePayload {
  name: string;
  adminUsername: string;
  adminPassword: string;
  adminName: string;
}

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-orange-100 text-orange-700',
  kitchen: 'bg-green-100  text-green-700',
};

export function RestaurantsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editName, setEditName]       = useState('');

  // expanded restaurant id â†’ its users
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [usersMap, setUsersMap]       = useState<Record<string, RestaurantUser[]>>({});
  const [usersLoading, setUsersLoading] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null); // userId

  // features panel
  const [featuresOpenId, setFeaturesOpenId] = useState<string | null>(null);
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null);
  // billing panel
  const [billingOpenId, setBillingOpenId] = useState<string | null>(null);
  const [billingDraft, setBillingDraft] = useState<{ plan: PlanCode; status: SubscriptionStatus; trialDays: string }>({ plan: 'pro', status: 'active', trialDays: '14' });
  const [savingBilling, setSavingBilling] = useState(false);

  function openBilling(r: Restaurant) {
    if (billingOpenId === r.id) { setBillingOpenId(null); return; }
    setBillingDraft({
      plan: r.plan ?? 'pro',
      status: r.subscriptionStatus ?? 'active',
      trialDays: '14',
    });
    setBillingOpenId(r.id);
  }

  async function saveBilling(r: Restaurant) {
    setSavingBilling(true);
    try {
      await subscriptionService.adminSet(r.id, billingDraft.plan, billingDraft.status, parseInt(billingDraft.trialDays, 10) || undefined);
      // Reflect changes locally (active follows trialing/active).
      const active = billingDraft.status === 'trialing' || billingDraft.status === 'active';
      setRestaurants((p) => p.map((x) => x.id === r.id ? { ...x, plan: billingDraft.plan, subscriptionStatus: billingDraft.status, active } : x));
      toast.success('Subscription updated');
      setBillingOpenId(null);
    } catch {
      toast.error('Failed to update subscription');
    } finally {
      setSavingBilling(false);
    }
  }

  const [form, setForm] = useState<CreatePayload>({
    name: '', adminUsername: '', adminPassword: '', adminName: '',
  });

  const load = () =>
    axios.get<Restaurant[]>('/api/restaurants')
      .then((r) => setRestaurants(r.data))
      .catch(() => toast.error('Failed to load restaurants'))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  // â”€â”€ Toggle active â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function toggleActive(r: Restaurant) {
    const next = !r.active;
    try {
      await axios.patch(`/api/restaurants/${r.id}/active`, { active: next });
      setRestaurants((p) => p.map((x) => x.id === r.id ? { ...x, active: next } : x));
      toast.success(`"${r.name}" ${next ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update status');
    }
  }

  // â”€â”€ Toggle feature flag â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function toggleFeature(r: Restaurant, key: keyof RestaurantFeatures) {
    const current = r.features ?? ALL_FEATURES_ON;
    const next = !current[key];
    setTogglingFeature(`${r.id}:${key}`);
    try {
      const res = await axios.patch<{ features: RestaurantFeatures }>(
        `/api/restaurants/${r.id}/features`, { [key]: next },
      );
      setRestaurants((p) => p.map((x) => x.id === r.id ? { ...x, features: res.data.features } : x));
    } catch {
      toast.error('Failed to update feature');
    } finally {
      setTogglingFeature(null);
    }
  }

  // â”€â”€ Expand / load users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (usersMap[id]) return; // already loaded
    setUsersLoading(true);
    try {
      const res = await axios.get<RestaurantUser[]>(`/api/restaurants/${id}/users`);
      setUsersMap((p) => ({ ...p, [id]: res.data }));
    } catch {
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }

  // â”€â”€ Impersonate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function loginAs(userId: string, username: string) {
    setImpersonating(userId);
    try {
      const res = await axios.post<{ token: string; user: { role: string } }>(
        `/api/restaurants/impersonate/${userId}`,
      );
      // Store token & user exactly like normal login does
      localStorage.setItem('qra_token', res.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      toast.success(`Logged in as ${username}`);
      // Navigate based on role
      const role = res.data.user.role;
      if (role === 'kitchen') navigate('/kitchen', { replace: true });
      else navigate('/admin', { replace: true });
      // Force a page reload so AuthContext re-reads localStorage
      window.location.href = role === 'kitchen' ? '/kitchen' : '/admin';
    } catch {
      toast.error('Failed to impersonate user');
    } finally {
      setImpersonating(null);
    }
  }

  // â”€â”€ Create â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleCreate() {
    if (!form.name.trim() || !form.adminUsername.trim() || !form.adminPassword.trim()) {
      toast.error('Name, admin username and password are required'); return;
    }
    try {
      const res = await axios.post<Restaurant>('/api/restaurants', {
        name: form.name,
        adminUsername: form.adminUsername,
        adminPassword: form.adminPassword,
        adminName: form.adminName || undefined,
      });
      setRestaurants((p) => [...p, res.data]);
      setForm({ name: '', adminUsername: '', adminPassword: '', adminName: '' });
      setShowForm(false);
      toast.success(`"${res.data.name}" created`);
    } catch {
      toast.error('Failed to create restaurant');
    }
  }

  // â”€â”€ Rename â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function startEdit(r: Restaurant) { setEditingId(r.id); setEditName(r.name); }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    try {
      await axios.put(`/api/restaurants/${id}`, { name: editName.trim() });
      setRestaurants((p) => p.map((r) => r.id === id ? { ...r, name: editName.trim() } : r));
      setEditingId(null);
      toast.success('Restaurant renamed');
    } catch {
      toast.error('Failed to update restaurant');
    }
  }

  // â”€â”€ Toggle switch UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function Switch({ on, onChange }: { on: boolean; onChange: () => void }) {
    return (
      <button
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          on ? 'bg-green-500' : 'bg-gray-300'
        }`}
        title={on ? 'Active  -  click to deactivate' : 'Inactive  -  click to activate'}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            on ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
            <Store size={16} className="text-orange-500" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Restaurants</h1>
            <p className="text-xs text-gray-400">Super Admin</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/plans')}
              className="flex items-center gap-1 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <CreditCard size={14} /> Plans & Pricing
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 bg-orange-500 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <Plus size={14} /> New
            </button>
            <button
              onClick={() => { logout(); navigate('/', { replace: true }); }}
              className="text-gray-400 hover:text-red-500 transition-colors p-1.5"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* List */}
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : restaurants.length === 0 ? (
          <p className="text-center text-gray-400 mt-12">No restaurants yet</p>
        ) : (
          restaurants.map((r) => {
            const isExpanded = expandedId === r.id;
            const isFeaturesOpen = featuresOpenId === r.id;
            const users = usersMap[r.id] ?? [];
            const rFeatures = r.features ?? ALL_FEATURES_ON;

            return (
              <div
                key={r.id}
                className={`bg-white rounded-2xl shadow-sm border transition-colors ${
                  r.active ? 'border-gray-100' : 'border-red-100 bg-red-50/30'
                }`}
              >
                {/* â”€â”€ Restaurant row â”€â”€ */}
                <div className="flex items-center gap-3 p-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    r.active ? 'bg-orange-100' : 'bg-gray-100'
                  }`}>
                    <Store size={18} className={r.active ? 'text-orange-500' : 'text-gray-400'} />
                  </div>

                  {/* Name + ID */}
                  <div className="flex-1 min-w-0">
                    {editingId === r.id ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(r.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full border border-orange-300 rounded-lg px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-orange-400"
                      />
                    ) : (
                      <p className={`font-semibold truncate ${r.active ? 'text-gray-900' : 'text-gray-400'}`}>
                        {r.name}
                        {!r.active && (
                          <span className="ml-2 text-xs text-red-400 font-normal">Inactive</span>
                        )}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {r.plan ?? 'pro'}
                      </span>
                      {r.subscriptionStatus && (
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${SUB_BADGE[r.subscriptionStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                          {r.subscriptionStatus.replace('_', ' ')}
                          {r.subscriptionStatus === 'trialing' && r.trialEndsAt ? `  .  ${daysUntil(r.trialEndsAt)}d` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono select-all">{r.id}</p>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Active toggle */}
                    <Switch on={r.active} onChange={() => toggleActive(r)} />

                    {/* Edit / Save */}
                    {editingId === r.id ? (
                      <>
                        <button onClick={() => saveEdit(r.id)} className="text-green-500 hover:text-green-600">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(r)} className="text-gray-400 hover:text-blue-500 transition-colors">
                        <Pencil size={16} />
                      </button>
                    )}

                    {/* Features toggle */}
                    <button
                      onClick={() => setFeaturesOpenId(isFeaturesOpen ? null : r.id)}
                      className={`transition-colors ${isFeaturesOpen ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'}`}
                      title="Manage features"
                    >
                      <Sliders size={16} />
                    </button>

                    {/* Billing toggle */}
                    <button
                      onClick={() => openBilling(r)}
                      className={`transition-colors ${billingOpenId === r.id ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`}
                      title="Manage subscription"
                    >
                      <CreditCard size={16} />
                    </button>

                    {/* Expand users */}
                    <button
                      onClick={() => toggleExpand(r.id)}
                      className="text-gray-400 hover:text-orange-500 transition-colors"
                      title="View users"
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* â”€â”€ Users panel â”€â”€ */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={13} className="text-gray-400" />
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Accounts</p>
                    </div>

                    {usersLoading && !usersMap[r.id] ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-400" />
                      </div>
                    ) : users.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">No users found</p>
                    ) : (
                      <div className="space-y-2">
                        {users.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100"
                          >
                            {/* Role badge */}
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${ROLE_BADGE[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                              {u.role}
                            </span>

                            {/* User info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{u.username}</p>
                              {u.name && u.name !== u.username && (
                                <p className="text-xs text-gray-400 truncate">{u.name}</p>
                              )}
                            </div>

                            {/* Login As */}
                            <button
                              onClick={() => loginAs(u.id, u.username)}
                              disabled={impersonating === u.id}
                              className="flex items-center gap-1 text-xs bg-orange-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 shrink-0"
                              title={`Login as ${u.username}`}
                            >
                              {impersonating === u.id ? (
                                <span className="animate-pulse">â€¦</span>
                              ) : (
                                <>
                                  <LogIn size={12} /> Login As
                                </>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* â”€â”€ Billing panel â”€â”€ */}
                {billingOpenId === r.id && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard size={13} className="text-green-600" />
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subscription</p>
                      <span className="ml-auto text-xs text-gray-400">Override plan &amp; status</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Plan</label>
                        <select
                          value={billingDraft.plan}
                          onChange={(e) => setBillingDraft((d) => ({ ...d, plan: e.target.value as PlanCode }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-green-300 bg-white capitalize"
                        >
                          {PLAN_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Status</label>
                        <select
                          value={billingDraft.status}
                          onChange={(e) => setBillingDraft((d) => ({ ...d, status: e.target.value as SubscriptionStatus }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-green-300 bg-white capitalize"
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Trial days</label>
                        <input
                          type="number"
                          min="0"
                          value={billingDraft.trialDays}
                          onChange={(e) => setBillingDraft((d) => ({ ...d, trialDays: e.target.value }))}
                          disabled={billingDraft.status !== 'trialing'}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-green-300 disabled:bg-gray-50 disabled:text-gray-300"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <button onClick={() => setBillingOpenId(null)} className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                      <button
                        onClick={() => saveBilling(r)}
                        disabled={savingBilling}
                        className="px-4 py-1.5 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
                      >
                        {savingBilling ? 'Savingâ€¦' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {/* â”€â”€ Features panel â”€â”€ */}
                {isFeaturesOpen && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Sliders size={13} className="text-blue-500" />
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Features</p>
                      <span className="ml-auto text-xs text-gray-400">Toggle modules for this restaurant</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {FEATURE_LABELS.map(({ key, label, description }) => {
                        const enabled = rFeatures[key] !== false;
                        const isToggling = togglingFeature === `${r.id}:${key}`;
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors ${
                              enabled ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50 border-gray-100'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                                {label}
                              </p>
                              <p className="text-xs text-gray-400 truncate">{description}</p>
                            </div>
                            <button
                              onClick={() => toggleFeature(r, key)}
                              disabled={isToggling}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0 disabled:opacity-50 ${
                                enabled ? 'bg-blue-500' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                              }`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">New Restaurant</h2>
              <button onClick={() => setShowForm(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Restaurant Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. The Grand Bistro"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                />
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-medium">
                  Initial Admin Account
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={form.adminName}
                    onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
                    placeholder="Full name (optional)"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                  />
                  <input
                    type="text"
                    value={form.adminUsername}
                    onChange={(e) => setForm((f) => ({ ...f, adminUsername: e.target.value }))}
                    placeholder="Username *"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                  />
                  <input
                    type="password"
                    value={form.adminPassword}
                    onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                    placeholder="Password *"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleCreate}
              className="w-full bg-orange-500 text-white py-3 rounded-2xl font-semibold hover:bg-orange-600 transition-colors"
            >
              Create Restaurant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
