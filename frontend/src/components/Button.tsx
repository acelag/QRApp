import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

// Variants carry the semantic colour intent so call sites stop hand-rolling
// button styles. `primary` uses the orange utilities, which the theme layer
// remaps to the brand accent (Forest green).
const VARIANTS: Record<Variant, string> = {
  primary:   'bg-orange-500 text-white hover:bg-orange-600 shadow-sm',
  secondary: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
  danger:    'bg-red-500 text-white hover:bg-red-600 shadow-sm',
  ghost:     'text-gray-600 hover:bg-gray-100',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3  py-1.5 text-sm  rounded-lg  gap-1.5',
  md: 'px-4  py-2.5 text-sm  rounded-xl  gap-2',
  lg: 'px-5  py-3.5 text-base rounded-2xl gap-2',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  className = '',
  children,
  disabled,
  ...props
}: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold transition-colors active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading && <Loader2 size={size === 'lg' ? 18 : 16} className="animate-spin" />}
      {!loading && leftIcon}
      {children}
    </button>
  );
}
