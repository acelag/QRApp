import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { printService, type PrinterStatus } from '../services/printService';

// Only roles that can reach the print routes / care about printing.
const CAN_VIEW = ['admin', 'manager', 'cashier'];

/**
 * Header indicator showing whether a configured thermal printer is reachable.
 * Hidden entirely when no printer is set up. Green dot = online, amber = offline.
 */
export function PrinterStatusIndicator() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PrinterStatus | null>(null);

  useEffect(() => {
    if (!user?.restaurantId || !CAN_VIEW.includes(user.role)) return;
    let active = true;
    const load = () => printService.status().then((s) => { if (active) setStatus(s); }).catch(() => {});
    load();
    const id = setInterval(load, 120_000); // re-check every 2 min
    return () => { active = false; clearInterval(id); };
  }, [user?.restaurantId, user?.role]);

  if (!status) return null;
  const configured = status.receipt.configured || status.kitchen.configured;
  if (!configured) return null; // no printer set up — nothing to show

  const online = status.receipt.online || status.kitchen.online;
  const parts: string[] = [];
  if (status.receipt.configured) parts.push(`Receipt printer ${status.receipt.online ? 'online' : 'offline'}`);
  if (status.kitchen.configured) parts.push(`Kitchen printer ${status.kitchen.online ? 'online' : 'offline'}`);
  const title = `${online ? 'Printer connected' : 'Printer offline'} — ${parts.join(' · ')}`;

  return (
    <Link
      to="/admin/settings"
      title={title}
      aria-label={title}
      className={`relative shrink-0 transition-colors ${online ? 'text-gray-500 hover:text-gray-800' : 'text-amber-500 hover:text-amber-600'}`}
    >
      <Printer size={18} />
      <span
        className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-white ${online ? 'bg-green-500' : 'bg-amber-500'}`}
      />
    </Link>
  );
}
