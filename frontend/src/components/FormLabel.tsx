import type { ReactNode } from 'react';
interface Props { children: ReactNode; required?: boolean; htmlFor?: string; }
export function FormLabel({ children, required, htmlFor }: Props) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}
