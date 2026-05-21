import type { OrderStatus } from '../types';

const config: Record<string, { label: string; className: string }> = {
  pending:  { label: 'Pending',   className: 'bg-yellow-100 text-yellow-800' },
  preparing:{ label: 'Preparing', className: 'bg-blue-100 text-blue-800' },
  ready:    { label: 'Ready',     className: 'bg-green-100 text-green-800' },
  // legacy — kept for orders already in the DB
  served:   { label: 'Served',    className: 'bg-gray-100 text-gray-600' },
};

export function StatusBadge({ status }: { status: OrderStatus | string }) {
  const { label, className } = config[status] ?? { label: status, className: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
