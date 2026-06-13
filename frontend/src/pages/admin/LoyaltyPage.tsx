import { useEffect, useState, useRef } from 'react';
import {
  Star, Users, ChevronDown, ChevronRight, Plus, Minus,
  Check, X, Loader2, Search,
} from 'lucide-react';
import { loyaltyService } from '../../services/loyaltyService';
import type { LoyaltyConfig, LoyaltyAccount, LoyaltyTransaction } from '../../services/loyaltyService';
import { useCurrency } from '../../context/CurrencyContext';
import toast from 'react-hot-toast';

// â”€â”€â”€ Config panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ConfigPanel() {
  const [cfg, setCfg] = useState<LoyaltyConfig | null>(null);
  const [draft, setDraft] = useState<LoyaltyConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loyaltyService.getConfig().then((c) => { setCfg(c); setDraft(c); }).catch(() => {});
  }, []);

  function onChange<K extends keyof LoyaltyConfig>(key: K, value: LoyaltyConfig[K]) {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const updated = await loyaltyService.updateConfig(draft);
      setCfg(updated);
      setDraft(updated);
      toast.success('Loyalty settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  const dirty = JSON.stringify(cfg) !== JSON.stringify(draft);

  if (!draft) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">
          <Star size={16} className="text-amber-500" /> Program Settings
        </h2>
        {/* Enable toggle */}
        <button
          onClick={() => onChange('enabled', !draft.enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            draft.enabled ? 'bg-amber-400' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              draft.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {!draft.enabled && (
        <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
          Loyalty program is disabled. Customers won't earn or redeem points until you enable it.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Points per 1 currency unit"
          hint="e.g. 1 = earn 1 pt per Rs 1 spent"
          value={draft.pointsPerUnit}
          onChange={(v) => onChange('pointsPerUnit', v)}
          min={0.01} step={0.1}
        />
        <Field
          label="Points to redeem for 1 unit"
          hint="e.g. 100 = 100 pts = Rs 1 off"
          value={draft.redeemRate}
          onChange={(v) => onChange('redeemRate', v)}
          min={1} step={1}
        />
        <Field
          label="Minimum points to redeem"
          hint="Threshold before redemption is allowed"
          value={draft.minRedeemPoints}
          onChange={(v) => onChange('minRedeemPoints', v)}
          min={0} step={10}
        />
        <Field
          label="Max % of order via points"
          hint="e.g. 50 = points can cover at most 50% of bill"
          value={draft.maxRedeemPct}
          onChange={(v) => onChange('maxRedeemPct', v)}
          min={1} max={100} step={5}
        />
      </div>

      {/* Summary row */}
      <div className="bg-amber-50 rounded-xl px-3 py-2.5 text-xs text-amber-700 space-y-0.5">
        <p>- Customers earn <strong>{draft.pointsPerUnit} pt(s)</strong> per 1 currency unit spent.</p>
        <p>- <strong>{draft.redeemRate} pts</strong> = 1 currency unit discount.</p>
        <p>- Minimum <strong>{draft.minRedeemPoints} pts</strong> required before redemption.</p>
        <p>- Points can cover up to <strong>{draft.maxRedeemPct}%</strong> of an order total.</p>
      </div>

      <button
        onClick={save}
        disabled={!dirty || saving}
        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        Save Settings
      </button>
    </div>
  );
}

function Field({
  label, hint, value, onChange, min = 0, max, step = 1,
}: {
  label: string; hint?: string; value: number;
  onChange: (v: number) => void; min?: number; max?: number; step?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {hint && <p className="text-[11px] text-gray-400 mb-1.5">{hint}</p>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
      />
    </div>
  );
}

// â”€â”€â”€ Members panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MembersPanel() {
  const { fmt } = useCurrency();
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [cfg, setCfg] = useState<LoyaltyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [txns, setTxns] = useState<Record<string, LoyaltyTransaction[]>>({});
  const [txnLoading, setTxnLoading] = useState<string | null>(null);
  const [adjustPhone, setAdjustPhone] = useState<string | null>(null);
  const [adjustPts, setAdjustPts] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  useEffect(() => {
    load('');
    loyaltyService.getConfig().then(setCfg).catch(() => {});
  }, []);

  function load(q: string) {
    setLoading(true);
    loyaltyService.getAccounts(q || undefined)
      .then(setAccounts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function onSearch(v: string) {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(v), 400);
  }

  async function toggleExpand(phone: string) {
    if (expanded === phone) { setExpanded(null); return; }
    setExpanded(phone);
    if (!txns[phone]) {
      setTxnLoading(phone);
      try {
        const rows = await loyaltyService.getTransactions(phone);
        setTxns((prev) => ({ ...prev, [phone]: rows }));
      } catch {
        toast.error('Failed to load transactions');
      } finally {
        setTxnLoading(null);
      }
    }
  }

  async function doAdjust() {
    if (!adjustPhone) return;
    const pts = parseInt(adjustPts, 10);
    if (isNaN(pts) || pts === 0) { toast.error('Enter a non-zero number of points'); return; }
    setAdjustSaving(true);
    try {
      const updated = await loyaltyService.adjust(adjustPhone, pts, adjustDesc || undefined);
      setAccounts((prev) => prev.map((a) => a.phone === adjustPhone ? updated : a));
      // refresh txns for this account
      const rows = await loyaltyService.getTransactions(adjustPhone);
      setTxns((prev) => ({ ...prev, [adjustPhone]: rows }));
      toast.success(`${pts > 0 ? '+' : ''}${pts} pts applied to ${adjustPhone}`);
      setAdjustPhone(null); setAdjustPts(''); setAdjustDesc('');
    } catch {
      toast.error('Adjustment failed');
    } finally {
      setAdjustSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">
          <Users size={16} className="text-blue-500" /> Members
          {!loading && (
            <span className="ml-1 text-xs font-normal text-gray-400">({accounts.length})</span>
          )}
        </h2>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by phone or nameâ€¦"
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 w-56"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-10">No members yet.</p>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <div key={acc.id} className="border border-gray-100 rounded-xl overflow-hidden">
              {/* Row */}
              <button
                onClick={() => toggleExpand(acc.phone)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Star size={13} className="text-amber-500 fill-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {acc.name || acc.phone}
                  </p>
                  {acc.name && <p className="text-xs text-gray-400">{acc.phone}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-amber-600">{acc.pointsBalance} pts</p>
                  <p className="text-[11px] text-gray-400">{acc.lifetimePoints} lifetime</p>
                </div>
                <div className="text-gray-400 ml-1">
                  {expanded === acc.phone ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </button>

              {/* Expanded detail */}
              {expanded === acc.phone && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
                  {/* Adjust */}
                  {adjustPhone === acc.phone ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Points (+/-)</label>
                        <input
                          type="number"
                          value={adjustPts}
                          onChange={(e) => setAdjustPts(e.target.value)}
                          placeholder="e.g. 50 or -20"
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-28 outline-none focus:ring-2 focus:ring-amber-200"
                        />
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Reason (optional)</label>
                        <input
                          type="text"
                          value={adjustDesc}
                          onChange={(e) => setAdjustDesc(e.target.value)}
                          placeholder="e.g. Birthday bonus"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                        />
                      </div>
                      <button
                        onClick={doAdjust}
                        disabled={adjustSaving}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
                      >
                        {adjustSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Apply
                      </button>
                      <button
                        onClick={() => { setAdjustPhone(null); setAdjustPts(''); setAdjustDesc(''); }}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setAdjustPhone(acc.phone); setAdjustPts(''); }}
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-white border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
                      >
                        <Plus size={11} /> Add Points
                      </button>
                      <button
                        onClick={() => { setAdjustPhone(acc.phone); setAdjustPts('-'); }}
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Minus size={11} /> Deduct Points
                      </button>
                    </div>
                  )}

                  {/* Transactions */}
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Transaction History</p>
                    {txnLoading === acc.phone ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                        <Loader2 size={12} className="animate-spin" /> Loadingâ€¦
                      </div>
                    ) : (txns[acc.phone] ?? []).length === 0 ? (
                      <p className="text-xs text-gray-400">No transactions yet.</p>
                    ) : (
                      <ul className="space-y-1 max-h-48 overflow-y-auto">
                        {(txns[acc.phone] ?? []).map((tx) => (
                          <li key={tx.id} className="flex items-center gap-2 text-xs">
                            <span className={`font-bold w-14 text-right shrink-0 ${
                              tx.type === 'earn' ? 'text-green-600' :
                              tx.type === 'redeem' ? 'text-red-500' : 'text-blue-500'
                            }`}>
                              {tx.type === 'earn' ? '+' : tx.type === 'redeem' ? '-' : ''}
                              {Math.abs(tx.points)} pts
                            </span>
                            <span className={`capitalize px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                              tx.type === 'earn' ? 'bg-green-100 text-green-700' :
                              tx.type === 'redeem' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                              {tx.type}
                            </span>
                            <span className="text-gray-500 truncate flex-1">
                              {tx.description ?? (tx.orderId ? `Order #${tx.orderId.slice(-6).toUpperCase()}` : ' - ')}
                            </span>
                            <span className="text-gray-300 shrink-0">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Balance summary */}
                  <div className="flex items-center gap-4 pt-1 border-t border-gray-200">
                    <div className="text-xs text-gray-500">
                      Balance: <span className="font-bold text-amber-600">{acc.pointsBalance} pts</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Lifetime: <span className="font-semibold text-gray-700">{acc.lifetimePoints} pts</span>
                    </div>
                    {cfg && (
                      <div className="text-xs text-gray-500">
                        Value: <span className="font-semibold text-gray-700">
                          {fmt(acc.pointsBalance / cfg.redeemRate)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function LoyaltyPage() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
          <Star size={20} className="text-amber-500 fill-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Loyalty Program</h1>
          <p className="text-sm text-gray-500">Configure your points program and manage members</p>
        </div>
      </div>

      <ConfigPanel />
      <MembersPanel />
    </div>
  );
}
