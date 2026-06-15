import { useEffect, useState } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Tag, Loader2, Percent, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { promoCodeService, type PromoCode } from '../../services/promoCodeService';
import { useCurrency } from '../../context/CurrencyContext';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';

const EMPTY_FORM = {
  code: '',
  type: 'percentage' as 'percentage' | 'fixed',
  value: '',
  minOrder: '',
  maxUses: '',
  expiresAt: '',
};

export function PromoCodesPage({ embedded = false }: { embedded?: boolean }) {
  const { fmt } = useCurrency();
  const [codes, setCodes]       = useState<PromoCode[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [form, setForm]         = useState(EMPTY_FORM);

  useEffect(() => {
    promoCodeService.list()
      .then(setCodes)
      .catch(() => toast.error('Failed to load promo codes'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.value) return;
    setSaving(true);
    try {
      const created = await promoCodeService.create({
        code:      form.code.trim().toUpperCase(),
        type:      form.type,
        value:     Number(form.value),
        minOrder:  form.minOrder ? Number(form.minOrder) : 0,
        maxUses:   form.maxUses  ? Number(form.maxUses)  : null,
        expiresAt: form.expiresAt || null,
      });
      setCodes((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast.success(`Promo code "${created.code}" created!`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Failed to create promo code');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(code: PromoCode) {
    if (toggling.has(code.id)) return;
    setToggling((s) => new Set(s).add(code.id));
    try {
      const updated = await promoCodeService.update(code.id, { active: !code.active });
      setCodes((prev) => prev.map((c) => (c.id === code.id ? updated : c)));
      toast.success(`"${code.code}" ${updated.active ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update');
    } finally {
      setToggling((s) => { const n = new Set(s); n.delete(code.id); return n; });
    }
  }

  async function handleDelete(code: PromoCode) {
    if (!confirm(`Delete promo code "${code.code}"?`)) return;
    setDeleting((s) => new Set(s).add(code.id));
    try {
      await promoCodeService.remove(code.id);
      setCodes((prev) => prev.filter((c) => c.id !== code.id));
      toast.success(`"${code.code}" deleted`);
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting((s) => { const n = new Set(s); n.delete(code.id); return n; });
    }
  }

  function discountLabel(code: PromoCode) {
    return code.type === 'percentage' ? `${code.value}% off` : `${fmt(code.value)} off`;
  }

  const activeCodes   = codes.filter((c) => c.active);
  const inactiveCodes = codes.filter((c) => !c.active);

  const newCodeBtn = (
    <button
      onClick={() => { setShowForm((v) => !v); setForm(EMPTY_FORM); }}
      className="flex items-center gap-1.5 bg-orange-500 text-white px-4 py-2 rounded-2xl text-sm font-semibold hover:bg-orange-600 transition-colors"
    >
      <Plus size={15} /> New Code
    </button>
  );

  const innerContent = (
    <>
      {embedded && (
        <div className="px-3 sm:px-4 lg:px-6 py-2.5 bg-white border-b border-gray-100 flex items-center justify-end gap-2">
          {newCodeBtn}
        </div>
      )}
      <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-5 max-w-3xl">
        {/* â”€â”€ Create form â”€â”€ */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-orange-200 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Plus size={16} className="text-orange-500" /> Create Promo Code
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Code + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. SAVE20"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono font-bold focus:outline-none focus:border-orange-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'percentage' | 'fixed' }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
              </div>

              {/* Value + Min Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                    {form.type === 'percentage' ? 'Discount %' : 'Discount Amount'} *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {form.type === 'percentage' ? <Percent size={13} /> : <DollarSign size={13} />}
                    </span>
                    <input
                      type="number"
                      placeholder={form.type === 'percentage' ? '10' : '5.00'}
                      min="0.01"
                      max={form.type === 'percentage' ? '100' : undefined}
                      step="0.01"
                      value={form.value}
                      onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Min Order (optional)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={form.minOrder}
                    onChange={(e) => setForm((f) => ({ ...f, minOrder: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
              </div>

              {/* Max Uses + Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Max Uses (optional)</label>
                  <input
                    type="number"
                    placeholder="Unlimited"
                    min="1"
                    step="1"
                    value={form.maxUses}
                    onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Expiry Date (optional)</label>
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-2xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white py-2.5 rounded-2xl text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? 'Creating…' : 'Create Code'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center pt-16">
            <Loader2 size={28} className="animate-spin text-orange-500" />
          </div>
        ) : codes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-14 text-center text-gray-400">
            <Tag size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="font-medium">No promo codes yet</p>
            <p className="text-sm mt-1">Create your first discount code to get started</p>
          </div>
        ) : (
          <>
            {/* Active codes */}
            {activeCodes.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Active ({activeCodes.length})</p>
                {activeCodes.map((code) => (
                  <PromoCodeCard
                    key={code.id}
                    code={code}
                    discountLabel={discountLabel(code)}
                    toggling={toggling.has(code.id)}
                    deleting={deleting.has(code.id)}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </section>
            )}

            {/* Inactive codes */}
            {inactiveCodes.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Inactive ({inactiveCodes.length})</p>
                {inactiveCodes.map((code) => (
                  <PromoCodeCard
                    key={code.id}
                    code={code}
                    discountLabel={discountLabel(code)}
                    toggling={toggling.has(code.id)}
                    deleting={deleting.has(code.id)}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className="h-full overflow-y-auto bg-gray-50">{innerContent}</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto mt-14 md:mt-0">
      <AdminHeader title="Promo Codes" backTo="/admin" icon={Tag}>
        {newCodeBtn}
      </AdminHeader>
      {innerContent}
      </main>
    </div>
  );
}

interface CardProps {
  code: PromoCode;
  discountLabel: string;
  toggling: boolean;
  deleting: boolean;
  onToggle: (c: PromoCode) => void;
  onDelete: (c: PromoCode) => void;
}

function PromoCodeCard({ code, discountLabel, toggling, deleting, onToggle, onDelete }: CardProps) {
  const isExpired = code.expiresAt ? new Date(code.expiresAt) < new Date() : false;
  const isMaxed   = code.maxUses != null && code.uses >= code.maxUses;
  const statusTag = !code.active ? null : isExpired ? 'Expired' : isMaxed ? 'Maxed out' : null;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm px-4 py-4 flex items-center gap-4 ${
      code.active && !isExpired && !isMaxed ? 'border-gray-100' : 'border-gray-100 opacity-60'
    }`}>
      {/* Code badge */}
      <div className="bg-orange-50 rounded-xl px-3 py-2 shrink-0">
        <p className="font-mono font-bold text-orange-600 text-sm tracking-widest">{code.code}</p>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 text-sm">{discountLabel}</p>
          {statusTag && (
            <span className="text-xs bg-red-100 text-red-600 font-medium px-2 py-0.5 rounded-full">{statusTag}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
          {code.minOrder > 0 && <span>Min. order: {code.minOrder.toFixed(2)}</span>}
          {code.maxUses != null && <span>Uses: {code.uses}/{code.maxUses}</span>}
          {code.maxUses == null && code.uses > 0 && <span>{code.uses} uses</span>}
          {code.expiresAt && <span>Expires {new Date(code.expiresAt).toLocaleDateString()}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onToggle(code)}
          disabled={toggling}
          className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors disabled:opacity-50"
          title={code.active ? 'Deactivate' : 'Activate'}
        >
          {toggling
            ? <Loader2 size={16} className="animate-spin" />
            : code.active
              ? <ToggleRight size={20} className="text-green-500" />
              : <ToggleLeft size={20} />}
        </button>
        <button
          onClick={() => onDelete(code)}
          disabled={deleting}
          className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          title="Delete"
        >
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </div>
  );
}
