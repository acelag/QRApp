import { useState } from 'react';
import { X, RotateCcw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { refundService, type CreateRefundPayload } from '../services/refundService';
import { useCurrency } from '../context/CurrencyContext';

const METHODS = [
  { value: 'cash',          label: 'Cash',          icon: '💵' },
  { value: 'card',          label: 'Card',           icon: '💳' },
  { value: 'bank_transfer', label: 'Bank Transfer',  icon: '🏦' },
  { value: 'other',         label: 'Other',          icon: '📋' },
];

const QUICK_REASONS = [
  'Wrong item delivered',
  'Customer complaint',
  'Duplicate charge',
  'Order cancelled after payment',
  'Item unavailable',
];

interface Props {
  label:      string;       // e.g. "Table 4" or order number
  maxAmount:  number;
  orderId?:   string;
  sessionId?: string;
  onSuccess:  () => void;
  onClose:    () => void;
}

export function RefundModal({ label, maxAmount, orderId, sessionId, onSuccess, onClose }: Props) {
  const { fmt } = useCurrency();
  const [amount,  setAmount]  = useState(maxAmount.toFixed(2));
  const [reason,  setReason]  = useState('');
  const [method,  setMethod]  = useState('cash');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { toast.error('Enter a valid amount'); return; }
    if (parsed > maxAmount)           { toast.error(`Cannot exceed ${fmt(maxAmount)}`); return; }
    if (!reason.trim())               { toast.error('Reason is required'); return; }

    setLoading(true);
    try {
      const payload: CreateRefundPayload = { amount: parsed, reason: reason.trim(), refundMethod: method };
      if (orderId)   payload.orderId   = orderId;
      if (sessionId) payload.sessionId = sessionId;

      await refundService.createRefund(payload);
      toast.success(`Refund of ${fmt(parsed)} issued`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Failed to issue refund');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="bg-red-100 p-1.5 rounded-lg">
                <RotateCcw size={15} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Issue Refund</h2>
            </div>
            <p className="text-sm text-gray-500 ml-8">{label} · max {fmt(maxAmount)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 -mt-1 -mr-1">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Refund Amount</label>
            <input
              type="number"
              min="0.01"
              max={maxAmount}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
            />
            <div className="flex gap-2 mt-2">
              {[0.25, 0.5, 0.75, 1].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setAmount((maxAmount * pct).toFixed(2))}
                  className="flex-1 text-xs py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors font-medium"
                >
                  {pct === 1 ? 'Full' : `${pct * 100}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Quick reason chips */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    reason === r
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Or type a custom reason…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
            />
          </div>

          {/* Refund method */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Return Via</label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    method === m.value
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base">{m.icon}</span> {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-semibold py-3 rounded-2xl transition-colors text-sm"
          >
            {loading ? <Loader2 size={17} className="animate-spin" /> : <RotateCcw size={17} />}
            {loading ? 'Processing…' : `Refund ${!isNaN(parseFloat(amount)) ? fmt(parseFloat(amount)) : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
