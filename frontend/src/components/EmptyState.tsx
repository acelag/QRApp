import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, compact = false }: Props) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm text-center text-gray-400 ${compact ? 'px-6 py-8' : 'px-6 py-14'}`}>
      {Icon && <Icon size={compact ? 28 : 36} className="mx-auto mb-3 text-gray-200" />}
      <p className="font-medium text-gray-500">{title}</p>
      {description && <p className="text-sm mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
