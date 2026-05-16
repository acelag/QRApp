import { Minus, Plus } from 'lucide-react';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function QuantitySelector({ value, onChange, min = 1, max = 99 }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        className="w-8 h-8 rounded-full flex items-center justify-center bg-orange-100 text-orange-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-200 transition-colors"
      >
        <Minus size={14} />
      </button>
      <span className="w-6 text-center font-semibold text-gray-800">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        className="w-8 h-8 rounded-full flex items-center justify-center bg-orange-500 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
