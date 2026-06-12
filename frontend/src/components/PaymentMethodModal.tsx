import { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';

export type PaymentMethod = 'cash' | 'card' | 'online' | 'voucher';

interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  icon: string;
  description: string;
  color: string;
  border: string;
  selectedBg: string;
}

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    value: 'cash',
    label: 'Cash',
    icon: '💵',
    description: 'Paid in hand',
    color: 'text-green-700',
    border: 'border-green-200 hover:border-green-400',
    selectedBg: 'bg-green-50 border-green-500',
  },
  {
    value: 'card',
    label: 'Card',
    icon: '💳',
    description: 'Debit or credit',
    color: 'text-blue-700',
    border: 'border-blue-200 hover:border-blue-400',
    selectedBg: 'bg-blue-50 border-blue-500',
  },
  {
    value: 'online',
    label: 'Online / QR',
    icon: '📱',
    description: 'Bank transfer or QR',
    color: 'text-purple-700',
    border: 'border-purple-200 hover:border-purple-400',
    selectedBg: 'bg-purple-50 border-purple-500',
  },
  {
    value: 'voucher',
    label: 'Voucher',
    icon: '🎟️',
    description: 'Gift card or coupon',
    color: 'text-orange-700',
    border: 'border-orange-200 hover:border-orange-400',
    selectedBg: 'bg-orange-50 border-orange-500',
  },
];

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return '';
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

export function paymentMethodIcon(method: string | null | undefined): string {
  if (!method) return '';
  return PAYMENT_METHODS.find((m) => m.value === method)?.icon ?? '💰';
}

/** Quick cash amounts: exact + up to 4 common round denominations above total */
function quickAmounts(total: number): number[] {
  const denoms = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const above = denoms.filter((d) => d > total).slice(0, 4);
  return [total, ...above];
}

interface Props {
  title: string;
  subtitle?: string;
  total?: number;        // if provided, shows cash-tendering step for cash payments
  onConfirm: (method: PaymentMethod) => void;
  onClose: () => void;
  loading?: boolean;
}

export function PaymentMethodModal({ title, subtitle, total, onConfirm, onClose, loading }: Props) {
  const { fmt } = useCurrency();
  const [step, setStep] = useState<'method' | 'cash'>('method');
  const [tendered, setTendered] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const amounts = total != null ? quickAmounts(total) : [];
  const effectiveTendered = custom !== '' ? parseFloat(custom) || 0 : (tendered ?? 0);
  const change = total != null ? effectiveTendered - total : 0;
  const sufficient = effectiveTendered >= (total ?? 0);

  useEffect(() => {
    if (step === 'cash') {
      setTendered(null);
      setCustom('');
    }
  }, [step]);

  function handleMethodClick(method: PaymentMethod) {
    if (loading) return;
    if (method === 'cash' && total != null) {
      setStep('cash');
    } else {
      onConfirm(method);
    }
  }

  function handleQuick(amount: number) {
    setCustom('');
    setTendered(amount);
    inputRef.current?.blur();
  }

  function handleCustomChange(v: string) {
    setCustom(v.replace(/[^0-9.]/g, ''));
    setTendered(null);
  }

  function confirmCash() {
    if (!sufficient || loading) return;
    onConfirm('cash');
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            {step === 'cash' && (
              <button
                onClick={() => setStep('method')}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 text-lg">
                {step === 'cash' ? 'Cash Payment' : title}
              </h2>
              {subtitle && <p className="text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0 ml-2"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Method selection ── */}
        {step === 'method' && (
          <div className="px-6 py-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Select Payment Method</p>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  onClick={() => handleMethodClick(method.value)}
                  disabled={loading}
                  className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 transition-all disabled:opacity-50 ${method.border} hover:shadow-sm active:scale-95`}
                >
                  <span className="text-3xl">{method.icon}</span>
                  <div className="text-center">
                    <p className={`font-bold text-sm ${method.color}`}>{method.label}</p>
                    <p className="text-xs text-gray-400">{method.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Cash tendering ── */}
        {step === 'cash' && total != null && (
          <div className="px-6 py-5 space-y-4">

            {/* Total due */}
            <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
              <span className="text-sm font-semibold text-gray-500">Total Due</span>
              <span className="text-xl font-extrabold text-gray-900 tabular-nums">{fmt(total)}</span>
            </div>

            {/* Quick amount buttons */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Cash Received</p>
              <div className="grid grid-cols-3 gap-2">
                {amounts.map((amt) => {
                  const isExact = amt === total;
                  const active = tendered === amt && custom === '';
                  return (
                    <button
                      key={amt}
                      onClick={() => handleQuick(amt)}
                      className={`py-3 rounded-xl text-sm font-bold transition-all active:scale-95 border-2 ${
                        active
                          ? 'bg-green-500 text-white border-green-500 shadow-md'
                          : isExact
                          ? 'bg-green-50 text-green-700 border-green-200 hover:border-green-400'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {isExact ? 'Exact' : fmt(amt)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom amount input */}
            <div className="relative">
              <input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                placeholder="Other amount…"
                value={custom}
                onChange={(e) => handleCustomChange(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-green-400 transition-colors placeholder:font-normal placeholder:text-gray-300"
              />
            </div>

            {/* Change due */}
            {effectiveTendered > 0 && (
              <div className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
                sufficient ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <span className={`text-sm font-semibold ${sufficient ? 'text-green-700' : 'text-red-600'}`}>
                  {sufficient ? 'Change Due' : 'Short by'}
                </span>
                <span className={`text-xl font-extrabold tabular-nums ${sufficient ? 'text-green-700' : 'text-red-600'}`}>
                  {fmt(Math.abs(change))}
                </span>
              </div>
            )}

            {/* Confirm */}
            <button
              onClick={confirmCash}
              disabled={!sufficient || effectiveTendered === 0 || loading}
              className="w-full py-3.5 rounded-2xl bg-green-500 text-white font-bold text-sm transition-all hover:bg-green-600 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing…' : 'Confirm Cash Payment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
