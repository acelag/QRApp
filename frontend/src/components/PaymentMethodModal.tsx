import { X } from 'lucide-react';

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

interface Props {
  title: string;
  subtitle?: string;
  onConfirm: (method: PaymentMethod) => void;
  onClose: () => void;
  loading?: boolean;
}

export function PaymentMethodModal({ title, subtitle, onConfirm, onClose, loading }: Props) {
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
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Select Payment Method</p>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.value}
                onClick={() => !loading && onConfirm(method.value)}
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
      </div>
    </div>
  );
}
