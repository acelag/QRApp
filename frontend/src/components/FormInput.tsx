import { useId, type InputHTMLAttributes } from 'react';
import { FormLabel } from './FormLabel';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  /** When provided, renders a label correctly associated to the input via id/htmlFor. */
  label?: string;
};

export function FormInput({ className = '', label, id, required, ...props }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;

  const input = (
    <input
      id={inputId}
      required={required}
      {...props}
      className={`w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent bg-gray-50 focus:bg-white transition-colors ${className}`}
    />
  );

  if (!label) return input;

  return (
    <div>
      <FormLabel htmlFor={inputId} required={required}>{label}</FormLabel>
      {input}
    </div>
  );
}
