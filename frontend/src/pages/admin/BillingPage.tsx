import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, CreditCard } from 'lucide-react';
import { AdminSidebar } from '../../components/AdminSidebar';
import { useAuth } from '../../context/AuthContext';
import {
  subscriptionService, daysUntil,
  type Plan, type MySubscription, type PlanCode,
} from '../../services/subscriptionService';

const STATUS_STYLE: Record<string, string> = {
  trialing: 'bg-blue-100 text-blue-700',
  active:   'bg-green-100 text-green-700',
  past_due: 'bg-amber-100 text-amber-700',
  canceled: 'bg-red-100 text-red-600',
};

export function BillingPage() {
  const { user } = useAuth();
  const [sub, setSub] = useState<MySubscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PlanCode | null>(null);
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  useEffect(() => {
    Promise.all([subscriptionService.getMine(), subscriptionService.getPlans()])
      .then(([s, p]) => { setSub(s); setPlans(p.plans); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function choose(plan: PlanCode) {
    setBusy(plan);
    try {
      const { url } = await subscriptionService.checkout(plan, '/admin/billing', interval);
      window.location.href = url; // mock checkout (or real gateway later)
    } catch {
      setBusy(null);
    }
  }

  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
            <Link to="/admin" className="text-gray-600"><ArrowLeft size={20} /></Link>
            <h1 className="text-xl font-bold text-gray-900 flex-1">Subscription &amp; Billing</h1>
          </div>
        </header>

        <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-4 max-w-5xl">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={28} /></div>
          ) : (
            <>
              {/* Current plan */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center"><CreditCard size={18} /></div>
                  <h2 className="font-semibold text-gray-800">Current plan</h2>
                  {sub && (
                    <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[sub.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {sub.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
                {sub ? (
                  <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                    <span className="text-2xl font-extrabold text-gray-900">{sub.planName}</span>
                    {sub.status === 'trialing' && sub.trialEndsAt && (
                      <span className="text-blue-600 font-medium">Trial ends in {daysUntil(sub.trialEndsAt)} day(s) · {fmtDate(sub.trialEndsAt)}</span>
                    )}
                    {sub.status === 'active' && sub.currentPeriodEnd && (
                      <span className="text-gray-500">Renews {fmtDate(sub.currentPeriodEnd)}</span>
                    )}
                    {sub.status === 'past_due' && <span className="text-amber-600 font-medium">Payment failed — please update billing.</span>}
                    {sub.status === 'canceled' && <span className="text-red-500 font-medium">Subscription canceled — choose a plan to reactivate.</span>}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No subscription info.</p>
                )}
              </div>

              {/* Interval toggle */}
              <div className="flex justify-center">
                <div className="inline-flex bg-gray-100 rounded-full p-1 text-sm font-medium">
                  <button onClick={() => setInterval('month')} className={`px-4 py-1.5 rounded-full transition-colors ${interval === 'month' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}>Monthly</button>
                  <button onClick={() => setInterval('year')} className={`px-4 py-1.5 rounded-full transition-colors ${interval === 'year' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}>Annual</button>
                </div>
              </div>

              {/* Plans */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((p) => {
                  const isCurrent = sub?.plan === p.code;
                  return (
                    <div key={p.code} className={`rounded-2xl border bg-white p-5 flex flex-col ${isCurrent ? 'border-orange-300 ring-1 ring-orange-200' : 'border-gray-200'}`}>
                      <h3 className="font-bold text-gray-900">{p.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5 min-h-[2rem]">{p.tagline}</p>
                      <div className="mt-2 mb-3">
                        {p.priceUsd === 0 && p.priceLkr === 0 ? (
                          <span className="text-2xl font-extrabold">Free</span>
                        ) : interval === 'year' ? (
                          <><span className="text-2xl font-extrabold">${p.priceUsdYear.toLocaleString()}</span><span className="text-gray-400 text-sm">/yr · Rs.{p.priceLkrYear.toLocaleString()}</span></>
                        ) : (
                          <><span className="text-2xl font-extrabold">${p.priceUsd}</span><span className="text-gray-400 text-sm">/mo · Rs.{p.priceLkr.toLocaleString()}</span></>
                        )}
                      </div>
                      {isCurrent ? (
                        <button disabled className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-400">Current plan</button>
                      ) : p.code === 'free' ? (
                        <button disabled className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-50 text-gray-300" title="Contact support to downgrade">Free</button>
                      ) : (
                        <button
                          onClick={() => choose(p.code)}
                          disabled={busy !== null}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {busy === p.code && <Loader2 size={15} className="animate-spin" />}
                          {sub && sub.plan === 'pro' && p.code === 'starter' ? 'Switch' : 'Upgrade'}
                        </button>
                      )}
                      <ul className="mt-4 space-y-1.5">
                        {p.highlights.map((h) => (
                          <li key={h} className="flex items-start gap-1.5 text-xs text-gray-600"><Check size={14} className="text-green-500 shrink-0 mt-0.5" /> {h}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {user?.role !== 'admin' && (
                <p className="text-xs text-gray-400">Only the account admin can change the subscription.</p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
