import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { subscriptionService, type Plan } from '../../services/subscriptionService';

const CURRENCY: { code: 'usd' | 'lkr'; label: string } = { code: 'usd', label: 'USD' };

export function PricingGrid({ ctaLabel = 'Start free trial' }: { ctaLabel?: string }) {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trialDays, setTrialDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<'usd' | 'lkr'>(CURRENCY.code);
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  useEffect(() => {
    subscriptionService.getPlans()
      .then((d) => { setPlans(d.plans); setTrialDays(d.trialDays); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-orange-500" size={28} /></div>;
  }

  const sym = currency === 'usd' ? '$' : 'Rs.';
  const monthly = (p: Plan) => currency === 'usd' ? p.priceUsd : p.priceLkr;
  const yearly  = (p: Plan) => currency === 'usd' ? p.priceUsdYear : p.priceLkrYear;
  // Shown price for the selected interval, plus annual savings %.
  const priceInfo = (p: Plan) => {
    if (interval === 'year') {
      const yr = yearly(p);
      const mo = monthly(p);
      const savingsPct = mo > 0 && yr > 0 ? Math.round((1 - yr / (mo * 12)) * 100) : 0;
      return { n: yr, suffix: '/yr', savingsPct };
    }
    return { n: monthly(p), suffix: '/mo', savingsPct: 0 };
  };

  return (
    <div>
      {/* Currency + interval toggles */}
      <div className="flex flex-wrap justify-center items-center gap-3 mb-8">
        <div className="inline-flex bg-gray-100 rounded-full p-1 text-sm font-medium">
          {(['usd', 'lkr'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-4 py-1.5 rounded-full transition-colors ${currency === c ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="inline-flex bg-gray-100 rounded-full p-1 text-sm font-medium">
          <button onClick={() => setInterval('month')} className={`px-4 py-1.5 rounded-full transition-colors ${interval === 'month' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}>Monthly</button>
          <button onClick={() => setInterval('year')} className={`px-4 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${interval === 'year' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}>
            Annual <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Save</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((p) => {
          const featured = p.code === 'starter';
          const { n, suffix, savingsPct } = priceInfo(p);
          return (
            <div
              key={p.code}
              className={`rounded-3xl border bg-white p-7 flex flex-col ${featured ? 'border-orange-300 ring-2 ring-orange-200 shadow-lg md:-translate-y-2' : 'border-gray-200 shadow-sm'}`}
            >
              {featured && (
                <span className="self-start mb-3 text-xs font-bold uppercase tracking-wide bg-orange-100 text-orange-600 px-3 py-1 rounded-full">Most popular</span>
              )}
              <h3 className="text-xl font-bold text-gray-900">{p.name}</h3>
              <p className="text-sm text-gray-500 mt-1 min-h-[2.5rem]">{p.tagline}</p>
              <div className="mt-4 mb-1">
                {p.priceUsd === 0 && p.priceLkr === 0 ? (
                  <span className="text-4xl font-extrabold text-gray-900">Free</span>
                ) : (
                  <>
                    <span className="text-4xl font-extrabold text-gray-900">{sym}{n.toLocaleString()}</span>
                    <span className="text-gray-400 text-sm">{suffix}</span>
                    {savingsPct > 0 && (
                      <span className="ml-2 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Save {savingsPct}%</span>
                    )}
                  </>
                )}
              </div>
              <button
                onClick={() => navigate(`/signup?plan=${p.code}&interval=${interval}`)}
                className={`mt-5 w-full py-3 rounded-xl font-semibold transition-colors ${featured ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
              >
                {p.code === 'free' ? 'Get started' : ctaLabel}
              </button>
              <ul className="mt-6 space-y-2.5">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check size={16} className="text-green-500 shrink-0 mt-0.5" /> {h}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="text-center text-sm text-gray-400 mt-8">All paid plans include a {trialDays}-day free trial. No credit card required to start.</p>
    </div>
  );
}
