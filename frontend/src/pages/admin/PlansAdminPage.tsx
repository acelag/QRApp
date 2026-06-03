import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { subscriptionService, FEATURE_OPTIONS, type Plan } from '../../services/subscriptionService';
import { useSubscriptionConfig } from '../../context/SubscriptionConfigContext';

type Draft = {
  name: string; tagline: string; priceLkr: string; priceUsd: string;
  priceLkrYear: string; priceUsdYear: string;
  features: Set<string>; highlights: string; visible: boolean;
};

function toDraft(p: Plan): Draft {
  return {
    name: p.name,
    tagline: p.tagline,
    priceLkr: String(p.priceLkr),
    priceUsd: String(p.priceUsd),
    priceLkrYear: String(p.priceLkrYear),
    priceUsdYear: String(p.priceUsdYear),
    features: new Set(p.features),
    highlights: p.highlights.join('\n'),
    visible: p.visible !== false,
  };
}

export function PlansAdminPage() {
  const navigate = useNavigate();
  const { enabled, refresh } = useSubscriptionConfig();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [togglingSystem, setTogglingSystem] = useState(false);

  async function toggleSystem() {
    setTogglingSystem(true);
    try {
      await subscriptionService.adminSetConfig(!enabled);
      await refresh();
      toast.success(`Subscriptions ${!enabled ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update');
    } finally {
      setTogglingSystem(false);
    }
  }

  useEffect(() => {
    subscriptionService.adminGetPlans()
      .then(({ plans }) => {
        setPlans(plans);
        setDrafts(Object.fromEntries(plans.map((p) => [p.code, toDraft(p)])));
      })
      .catch(() => toast.error('Failed to load plans'))
      .finally(() => setLoading(false));
  }, []);

  function patch(code: string, p: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [code]: { ...d[code], ...p } }));
  }
  function toggleFeature(code: string, key: string) {
    setDrafts((d) => {
      const f = new Set(d[code].features);
      f.has(key) ? f.delete(key) : f.add(key);
      return { ...d, [code]: { ...d[code], features: f } };
    });
  }

  async function save(code: string) {
    const d = drafts[code];
    setSaving(code);
    try {
      const updated = await subscriptionService.adminUpdatePlan(code as Plan['code'], {
        name: d.name.trim(),
        tagline: d.tagline.trim(),
        priceLkr: parseInt(d.priceLkr, 10) || 0,
        priceUsd: parseInt(d.priceUsd, 10) || 0,
        priceLkrYear: parseInt(d.priceLkrYear, 10) || 0,
        priceUsdYear: parseInt(d.priceUsdYear, 10) || 0,
        features: [...d.features],
        highlights: d.highlights.split('\n').map((h) => h.trim()).filter(Boolean),
        visible: d.visible,
      });
      setPlans((p) => p.map((x) => x.code === code ? updated : x));
      toast.success(`${updated.name} plan saved`);
    } catch {
      toast.error('Failed to save plan');
    } finally {
      setSaving(null);
    }
  }

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 lg:px-6 py-4 flex items-center gap-3 max-w-6xl mx-auto">
          <button onClick={() => navigate('/admin/restaurants')} className="text-gray-600"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Plans &amp; Pricing</h1>
        </div>
      </header>

      <div className="px-4 lg:px-6 py-6 max-w-6xl mx-auto space-y-5">
        {/* Master switch */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
          <div className="flex-1">
            <h2 className="font-semibold text-gray-800">Subscription system</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {enabled
                ? 'On — marketing site, signup, trials and billing are active.'
                : 'Off — pricing/signup are hidden and all restaurants have full access.'}
            </p>
          </div>
          <button
            onClick={toggleSystem}
            disabled={togglingSystem}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
            title={enabled ? 'Turn off' : 'Turn on'}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={28} /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {plans.map((p) => {
              const d = drafts[p.code];
              if (!d) return null;
              return (
                <div key={p.code} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{p.code}</span>
                    <button
                      onClick={() => patch(p.code, { visible: !d.visible })}
                      className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${d.visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {d.visible ? <Eye size={12} /> : <EyeOff size={12} />} {d.visible ? 'Visible' : 'Hidden'}
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Name</label>
                    <input className={input} value={d.name} onChange={(e) => patch(p.code, { name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Tagline</label>
                    <input className={input} value={d.tagline} onChange={(e) => patch(p.code, { tagline: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">USD /mo</label>
                      <input type="number" min="0" className={input} value={d.priceUsd} onChange={(e) => patch(p.code, { priceUsd: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">LKR /mo</label>
                      <input type="number" min="0" className={input} value={d.priceLkr} onChange={(e) => patch(p.code, { priceLkr: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">USD /yr</label>
                      <input type="number" min="0" className={input} value={d.priceUsdYear} onChange={(e) => patch(p.code, { priceUsdYear: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">LKR /yr</label>
                      <input type="number" min="0" className={input} value={d.priceLkrYear} onChange={(e) => patch(p.code, { priceLkrYear: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Included features</label>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {FEATURE_OPTIONS.map((f) => {
                        const on = d.features.has(f.key);
                        return (
                          <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={on} onChange={() => toggleFeature(p.code, f.key)} className="accent-orange-500 w-4 h-4" />
                            <span className={on ? 'text-gray-800' : 'text-gray-400'}>{f.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Highlights (one per line)</label>
                    <textarea
                      rows={5}
                      className={`${input} resize-none`}
                      value={d.highlights}
                      onChange={(e) => patch(p.code, { highlights: e.target.value })}
                    />
                  </div>

                  <button
                    onClick={() => save(p.code)}
                    disabled={saving === p.code}
                    className="w-full bg-orange-500 text-white py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {saving === p.code ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Save {d.name}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
