import { Loader2 } from 'lucide-react';

interface SpinnerProps { size?: number; className?: string; }
export function Spinner({ size = 16, className = '' }: SpinnerProps) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}

export function PageSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 size={28} className="animate-spin text-orange-500" />
    </div>
  );
}
