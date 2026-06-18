import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
type Props = InputHTMLAttributes<HTMLInputElement>;
export function SearchInput({ className = '', ...props }: Props) {
  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        {...props}
        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent bg-white transition-colors"
      />
    </div>
  );
}
