import type { OrderStatus } from '../types';

const config: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  preparing: { label: 'Preparing', className: 'bg-blue-100 text-blue-800' },
  ready: { label: 'Ready', className: 'bg-green-100 text-green-800' },
  served: { label: 'Served', className: 'bg-gray-100 text-gray-600' },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { label, className } = config[status];
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
