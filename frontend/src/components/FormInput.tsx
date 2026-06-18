import type { InputHTMLAttributes } from 'react';
type Props = InputHTMLAttributes<HTMLInputElement>;
export function FormInput({ className = '', ...props }: Props) {
  return (
    <input
      {...props}
      className={`w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent bg-gray-50 focus:bg-white transition-colors ${className}`}
    />
  );
}
