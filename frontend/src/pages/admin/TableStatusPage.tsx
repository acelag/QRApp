import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Users, Clock, CheckCircle2, AlertTriangle, Coffee, Circle } from 'lucide-react';
import { tableService, type TableStatusEntry, type TableOccupancyStatus } from '../../services/tableService';
import { useCurrency } from '../../context/CurrencyContext';
import toast from 'react-hot-toast';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';

const POLL_MS = 10_000;

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function elapsed(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m  = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function ago(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

// â”€â”€ Status config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STATUS_CONFIG: Record<TableOccupancyStatus, {
  label: string;
  cardCls: string;
  numberCls: string;
  badgeCls: string;
  dotCls: string;
  icon: typeof Circle;
}> = {
  free: {
    label: 'Free',
    cardCls: 'bg-green-50 border-green-200 hover:border-green-400',
    numberCls: 'text-green-700',
    badgeCls: 'bg-green-100 text-green-700',
    dotCls: 'bg-green-500',
    icon: CheckCircle2,
  },
  waiting: {
    label: 'Waiting',
    cardCls: 'bg-sky-50 border-sky-200 hover:border-sky-400',
    numberCls: 'text-sky-700',
    badgeCls: 'bg-sky-100 text-sky-700',
    dotCls: 'bg-sky-500',
    icon: Coffee,
  },
  active: {
    label: 'Active',
    cardCls: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    numberCls: 'text-amber-700',
    badgeCls: 'bg-amber-100 text-amber-700',
    dotCls: 'bg-amber-500',
    icon: Users,
  },
  stale: {
    label: 'Stale',
    cardCls: 'bg-red-50 border-red-300 hover:border-red-500 animate-pulse-border',
    numberCls: 'text-red-700',
    badgeCls: 'bg-red-100 text-red-700',
    dotCls: 'bg-red-500',
    icon: AlertTriangle,
  },
};

// â”€â”€ Table card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TableCard({ t, fmt }: { t: TableStatusEntry; fmt: (n: number) => string }) {
  const cfg  = STATUS_CONFIG[t.status];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-2xl border-2 p-4 transition-all cursor-default select-none ${cfg.cardCls}`}>
      {/* Number + badge */}
      <div className="flex items-start justify-between gap-1 mb-2">
        <span className={`text-3xl font-black leading-none ${cfg.numberCls}`}>{t.number}</span>
        <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${cfg.badgeCls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotCls} shrink-0 ${t.status === 'stale' ? 'animate-pulse' : ''}`} />
          {cfg.label}
        </span>
      </div>

      {/* Seats */}
      <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
        <Users size={11} /> {t.seats} seat{t.seats !== 1 ? 's' : ''}
      </p>

      {t.status === 'free' ? (
        <div className="flex items-center gap-1.5 text-green-600">
          <Icon size={14} />
          <span className="text-sm font-medium">Available</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Session duration */}
          {t.sessionStarted && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock size={11} className="shrink-0" />
              <span>Open {elapsed(t.sessionStarted)}</span>
            </div>
          )}

          {t.status === 'waiting' ? (
            <p className="text-xs text-sky-600 font-medium flex items-center gap-1">
              <Coffee size={11} /> Seated â€” no orders yet
            </p>
          ) : (
            <>
              {/* Order count + total */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{t.orderCount} order{t.orderCount !== 1 ? 's' : ''}</span>
                <span className="font-bold text-gray-800">{fmt(t.sessionTotal)}</span>
              </div>

              {/* Last activity */}
              {t.lastOrderAt && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <RefreshCw size={10} className="shrink-0" />
                  <span>Last order {ago(t.lastOrderAt)}</span>
                </div>
              )}

              {/* Active / ready order badges */}
              <div className="flex gap-1.5 flex-wrap mt-1">
                {t.activeOrders > 0 && (
                  <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                    {t.activeOrders} in kitchen
                  </span>
                )}
                {t.readyOrders > 0 && (
                  <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full animate-pulse">
                    {t.readyOrders} ready
                  </span>
                )}
              </div>

              {t.status === 'stale' && (
                <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertTriangle size={11} /> No activity â€” check table
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// â”€â”€ Summary pill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SummaryPill({ count, label, dotCls }: { count: number; label: string; dotCls: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
      <span className={`w-2.5 h-2.5 rounded-full ${dotCls} shrink-0`} />
      <span className="tabular-nums font-bold">{count}</span>
      <span className="text-gray-500">{label}</span>
    </div>
  );
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function TableStatusPage() {
  const { fmt } = useCurrency();
  const [tables, setTables]     = useState<TableStatusEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [filter, setFilter]     = useState<TableOccupancyStatus | 'all'>('all');

  const load = useCallback(async (silent = false) => {
    try {
      const data = await tableService.getStatus();
      setTables(data);
      setLastSync(new Date());
    } catch {
      if (!silent) toast.error('Failed to load table status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // â”€â”€ Counts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const counts = {
    free:    tables.filter((t) => t.status === 'free').length,
    waiting: tables.filter((t) => t.status === 'waiting').length,
    active:  tables.filter((t) => t.status === 'active').length,
    stale:   tables.filter((t) => t.status === 'stale').length,
  };
  const totalRevenue = tables.reduce((s, t) => s + t.sessionTotal, 0);

  const FILTERS: { key: TableOccupancyStatus | 'all'; label: string }[] = [
    { key: 'all',     label: `All (${tables.length})` },
    { key: 'free',    label: `Free (${counts.free})` },
    { key: 'waiting', label: `Waiting (${counts.waiting})` },
    { key: 'active',  label: `Active (${counts.active})` },
    { key: 'stale',   label: `Stale (${counts.stale})` },
  ];

  const visible = filter === 'all' ? tables : tables.filter((t) => t.status === filter);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto mt-14 md:mt-0">
      {/* Header */}
      <AdminHeader
        title="Table Status"
        subtitle={lastSync ? `Live Â· updated ${ago(lastSync.toISOString())}` : undefined}
        backTo="/admin"
      >
        <button
          onClick={() => load()}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
        >
          <RefreshCw size={17} />
        </button>
      </AdminHeader>

      <div className="bg-white shadow-sm">
        {/* Summary bar */}
        {!loading && tables.length > 0 && (
          <div className="px-3 sm:px-4 lg:px-6 pb-3 flex items-center gap-4 flex-wrap">
            <SummaryPill count={counts.free}    label="free"    dotCls="bg-green-500" />
            <SummaryPill count={counts.waiting} label="waiting" dotCls="bg-sky-500"   />
            <SummaryPill count={counts.active}  label="active"  dotCls="bg-amber-500" />
            {counts.stale > 0 && (
              <SummaryPill count={counts.stale} label="stale"   dotCls="bg-red-500 animate-pulse" />
            )}
            {totalRevenue > 0 && (
              <span className="ml-auto text-sm font-semibold text-gray-700">
                Open tabs: <span className="text-orange-600">{fmt(totalRevenue)}</span>
              </span>
            )}
          </div>
        )}

        {/* Filter tabs */}
        <div className="px-3 sm:px-4 lg:px-6 pb-3 flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filter === f.key
                  ? f.key === 'stale' ? 'bg-red-500 text-white'
                  : f.key === 'free'  ? 'bg-green-500 text-white'
                  : f.key === 'waiting' ? 'bg-sky-500 text-white'
                  : f.key === 'active'  ? 'bg-amber-500 text-white'
                  : 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 sm:px-4 lg:px-6 py-4">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 gap-3 text-gray-400">
            <CheckCircle2 size={36} className="text-gray-200" />
            <p>{filter === 'all' ? 'No active tables found' : `No ${filter} tables`}</p>
            {filter === 'all' && (
              <Link to="/admin/tables" className="text-sm text-orange-500 hover:underline">
                Manage Tables â†’
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
            {visible.map((t) => (
              <TableCard key={t.id} t={t} fmt={fmt} />
            ))}
          </div>
        )}
      </div>
      </main>
    </div>
  );
}
